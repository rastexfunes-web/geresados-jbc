import { MercadoPagoConfig, Preference } from "mercadopago";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

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

const APP_URL = "https://geresados-jbc.vercel.app";

function esCuotaVencida(cuota) {
  if (cuota.estado === "pagada" || !cuota.fechaVencimiento) return false;
  const hoy = new Date().toISOString().slice(0, 10);
  return cuota.fechaVencimiento < hoy;
}

function montoConRecargo(cuota, colegio) {
  if (!esCuotaVencida(cuota)) return cuota.monto;
  const recargo = colegio?.recargoPorcentaje || 0;
  return Math.round(cuota.monto * (1 + recargo / 100));
}

export default async function handler(req, res) {
  try {
    const db = getDb();

    // GET: busca a todos los alumnos que tengan ese DNI cargado (puede haber
    // más de uno, ej. si un mismo DNI de un padre quedó puesto en varios
    // hermanos) y devuelve, para cada uno, su colegio y sus cuotas.
    if (req.method === "GET") {
      const dni = String(req.query.dni || "").trim();
      if (!dni) {
        res.status(400).json({ error: "Ingresá un DNI" });
        return;
      }

      const alumnosSnap = await db.collection("alumnos").where("dni", "==", dni).get();
      if (alumnosSnap.empty) {
        res.status(404).json({ error: "No encontramos ningún alumno con ese DNI" });
        return;
      }

      const resultados = [];
      for (const alumnoDoc of alumnosSnap.docs) {
        const alumno = { id: alumnoDoc.id, ...alumnoDoc.data() };
        const colegioSnap = await db.collection("colegios").doc(alumno.colegioId).get();
        const colegio = colegioSnap.exists ? { id: colegioSnap.id, ...colegioSnap.data() } : null;
        const cuotasSnap = await db
          .collection("cuotas")
          .where("alumnoId", "==", alumno.id)
          .get();
        const cuotas = cuotasSnap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (a.numero || 0) - (b.numero || 0))
          .map((c) => ({
            id: c.id,
            numero: c.numero,
            esSena: c.esSena,
            esExtra: c.esExtra,
            descripcion: c.descripcion || "",
            estado: c.estado,
            monto: montoConRecargo(c, colegio),
            vencida: esCuotaVencida(c),
            fechaVencimiento: c.fechaVencimiento || "",
            tieneCupon: Boolean(c.mpInitPoint),
          }));

        resultados.push({
          alumno: { id: alumno.id, nombre: alumno.nombre, apellido: alumno.apellido, apodo: alumno.apodo || "" },
          colegio: colegio ? { id: colegio.id, nombre: colegio.nombre } : null,
          cuotas,
        });
      }

      res.status(200).json({ resultados });
      return;
    }

    // POST: genera (o reutiliza) el cupón de pago de una cuota puntual,
    // verificando que el DNI coincida con el del alumno dueño de esa cuota.
    if (req.method === "POST") {
      const { dni, alumnoId, cuotaId } = req.body;
      if (!dni || !alumnoId || !cuotaId) {
        res.status(400).json({ error: "Faltan datos" });
        return;
      }

      const alumnoSnap = await db.collection("alumnos").doc(alumnoId).get();
      if (!alumnoSnap.exists || String(alumnoSnap.data().dni || "").trim() !== String(dni).trim()) {
        res.status(403).json({ error: "No coincide el DNI con este alumno" });
        return;
      }
      const alumno = alumnoSnap.data();

      const cuotaRef = db.collection("cuotas").doc(cuotaId);
      const cuotaSnap = await cuotaRef.get();
      if (!cuotaSnap.exists || cuotaSnap.data().alumnoId !== alumnoId) {
        res.status(404).json({ error: "Cuota no encontrada" });
        return;
      }
      const cuota = cuotaSnap.data();

      if (cuota.estado === "pagada") {
        res.status(400).json({ error: "Esta cuota ya está pagada" });
        return;
      }

      if (cuota.mpInitPoint) {
        res.status(200).json({ initPoint: cuota.mpInitPoint });
        return;
      }

      const colegioSnap = await db.collection("colegios").doc(alumno.colegioId).get();
      const colegio = colegioSnap.exists ? colegioSnap.data() : {};
      const monto = montoConRecargo(cuota, colegio);
      const detalle = cuota.esExtra
        ? cuota.descripcion
        : cuota.esSena
        ? "Seña"
        : `Cuota ${cuota.numero} / ${colegio.cantidadCuotas}`;

      if (!process.env.MP_ACCESS_TOKEN) {
        res.status(500).json({ error: "Falta configurar Mercado Pago" });
        return;
      }

      const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });
      const preference = new Preference(client);
      const backUrl = `${APP_URL}/pago-realizado`;

      const result = await preference.create({
        body: {
          items: [
            {
              title: `JBC Egresados - ${colegio.nombre} - ${alumno.apellido} ${alumno.nombre} - ${detalle}`,
              quantity: 1,
              unit_price: Number(monto),
              currency_id: "ARS",
            },
          ],
          external_reference: cuotaId,
          back_urls: { success: backUrl, pending: backUrl, failure: backUrl },
          auto_return: "approved",
          notification_url: `${APP_URL}/api/webhook-mp`,
        },
      });

      await cuotaRef.update({
        mpPreferenceId: result.id,
        mpInitPoint: result.init_point,
      });

      res.status(200).json({ initPoint: result.init_point });
      return;
    }

    res.status(405).json({ error: "Método no permitido" });
  } catch (err) {
    console.error("Error en portal-alumno:", err);
    res.status(500).json({ error: "No se pudo procesar la consulta" });
  }
}
