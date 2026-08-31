import { MercadoPagoConfig, Preference } from "mercadopago";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

function getDb() {
  if (getApps().length === 0) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (!raw) {
      throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY no está definida");
    }
    const parsed = JSON.parse(raw);
    initializeApp({ credential: cert(parsed) });
  }
  return getFirestore();
}

const APP_URL = "https://www.jbc-egresados.com.ar";

export default async function handler(req, res) {
  try {
    const db = getDb();

    // GET: trae el nombre del alumno y del colegio para mostrar en la
    // pantalla pública (el alumno no está logueado, así que no puede leer
    // Firestore directamente por las reglas de seguridad).
    if (req.method === "GET") {
      const { colegioId, alumnoId } = req.query;
      if (!colegioId || !alumnoId) {
        res.status(400).json({ error: "Faltan datos" });
        return;
      }
      const [alumnoSnap, colegioSnap] = await Promise.all([
        db.collection("alumnos").doc(String(alumnoId)).get(),
        db.collection("colegios").doc(String(colegioId)).get(),
      ]);
      if (!alumnoSnap.exists || !colegioSnap.exists) {
        res.status(404).json({ error: "No encontrado" });
        return;
      }
      const alumno = alumnoSnap.data();
      const colegio = colegioSnap.data();
      res.status(200).json({
        nombre: alumno.nombre,
        apellido: alumno.apellido,
        colegioNombre: colegio.nombre,
      });
      return;
    }

    // POST: si el alumno tiene cuotas pendientes, reparte el extra entre
    // ellas. Si ya las pagó todas, no hay dónde repartirlo, así que se crea
    // como un cobro aparte con su propio cupón de pago (y se manda a pagar).
    if (req.method === "POST") {
      const { colegioId, alumnoId, descripcion, monto, talle } = req.body;
      if (!colegioId || !alumnoId || !descripcion || !monto) {
        res.status(400).json({ error: "Faltan datos" });
        return;
      }

      const [alumnoSnap, colegioSnap, cuotasSnap] = await Promise.all([
        db.collection("alumnos").doc(alumnoId).get(),
        db.collection("colegios").doc(colegioId).get(),
        db.collection("cuotas").where("alumnoId", "==", alumnoId).get(),
      ]);
      if (!alumnoSnap.exists || !colegioSnap.exists) {
        res.status(404).json({ error: "No encontrado" });
        return;
      }
      const alumno = alumnoSnap.data();
      const colegio = colegioSnap.data();

      const cuotasPendientes = [];
      let maxNumero = 0;
      cuotasSnap.forEach((d) => {
        const c = d.data();
        if ((c.numero || 0) > maxNumero) maxNumero = c.numero || 0;
        if (!c.esSena && !c.esExtra && c.estado !== "pagada") {
          cuotasPendientes.push({ id: d.id, monto: c.monto });
        }
      });

      const montoTotal = Number(monto);

      if (cuotasPendientes.length > 0) {
        // Reparte el extra entre las cuotas pendientes.
        const cantidad = cuotasPendientes.length;
        const base = Math.floor((montoTotal / cantidad) * 100) / 100;

        const batch = db.batch();
        const cuotasAfectadas = [];
        cuotasPendientes.forEach((c, i) => {
          const esUltima = i === cantidad - 1;
          const montoAgregado = Math.round((esUltima ? montoTotal - base * (cantidad - 1) : base) * 100) / 100;
          batch.update(db.collection("cuotas").doc(c.id), {
            monto: Math.round((c.monto + montoAgregado) * 100) / 100,
            mpPreferenceId: null,
            mpInitPoint: null,
          });
          cuotasAfectadas.push({ id: c.id, montoAgregado });
        });
        batch.update(db.collection("alumnos").doc(alumnoId), {
          extras: FieldValue.arrayUnion({
            descripcion,
            talle: talle || "",
            monto: montoTotal,
            repartidoEnCuotas: cantidad,
            cuotasAfectadas,
            fecha: new Date().toISOString(),
            creadoPorAlumno: true,
          }),
        });
        await batch.commit();

        res.status(200).json({ ok: true, initPoint: null });
        return;
      }

      // No hay cuotas pendientes: se crea un cobro aparte con cupón propio.
      const cuotaRef = db.collection("cuotas").doc();
      await cuotaRef.set({
        alumnoId,
        colegioId,
        numero: maxNumero + 1,
        esSena: false,
        esExtra: true,
        descripcion,
        talle: talle || "",
        monto: montoTotal,
        fechaVencimiento: "",
        estado: "pendiente",
        metodoPago: null,
        mpPreferenceId: null,
        mpInitPoint: null,
        fechaPago: null,
        creadoPorAlumno: true,
        createdAt: new Date(),
      });

      if (!process.env.MP_ACCESS_TOKEN) {
        res.status(200).json({ ok: true, initPoint: null });
        return;
      }

      const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });
      const preference = new Preference(client);
      const backUrl = `${APP_URL}/pago-realizado`;

      const result = await preference.create({
        body: {
          items: [
            {
              title: `JBC Egresados - ${colegio.nombre} - ${alumno.apellido} ${alumno.nombre} - ${descripcion}`,
              quantity: 1,
              unit_price: montoTotal,
              currency_id: "ARS",
            },
          ],
          external_reference: cuotaRef.id,
          back_urls: { success: backUrl, pending: backUrl, failure: backUrl },
          auto_return: "approved",
          notification_url: `${APP_URL}/api/webhook-mp`,
        },
      });

      await cuotaRef.update({
        mpPreferenceId: result.id,
        mpInitPoint: result.init_point,
      });

      res.status(200).json({ ok: true, initPoint: result.init_point });
      return;
    }

    res.status(405).json({ error: "Método no permitido" });
  } catch (err) {
    console.error("Error en extra-publico:", err);
    res.status(500).json({ error: "No se pudo procesar el pedido" });
  }
}
