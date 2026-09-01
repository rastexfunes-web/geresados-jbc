import { MercadoPagoConfig, Payment } from "mercadopago";
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

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Método no permitido" });
    return;
  }

  try {
    const horas = Number(req.body?.horas) || 5;

    if (!process.env.MP_ACCESS_TOKEN) {
      res.status(500).json({ error: "Falta configurar MP_ACCESS_TOKEN" });
      return;
    }

    const desde = new Date(Date.now() - horas * 60 * 60 * 1000).toISOString();
    const hasta = new Date().toISOString();

    const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });
    const paymentClient = new Payment(client);

    // Le preguntamos directo a Mercado Pago qué pagos aprobó en el rango,
    // en vez de depender de que el aviso (webhook) haya llegado bien.
    const busqueda = await paymentClient.search({
      options: {
        sort: "date_approved",
        criteria: "desc",
        range: "date_approved",
        begin_date: desde,
        end_date: hasta,
        status: "approved",
        limit: 100,
      },
    });

    const pagos = busqueda.results || [];
    const db = getDb();
    const revisados = [];
    let corregidos = 0;
    let yaEstaban = 0;
    let sinReferencia = 0;

    for (const pago of pagos) {
      const cuotaId = pago.external_reference;
      if (!cuotaId) {
        sinReferencia++;
        continue;
      }
      const cuotaRef = db.collection("cuotas").doc(cuotaId);
      const cuotaSnap = await cuotaRef.get();
      if (!cuotaSnap.exists) {
        revisados.push({ cuotaId, estado: "no encontrada" });
        continue;
      }
      const cuota = cuotaSnap.data();
      if (cuota.estado === "pagada") {
        yaEstaban++;
        continue;
      }
      await cuotaRef.update({
        estado: "pagada",
        metodoPago: "mercadopago",
        fechaPago: FieldValue.serverTimestamp(),
      });
      corregidos++;
      revisados.push({ cuotaId, estado: "corregida" });
    }

    res.status(200).json({
      ok: true,
      pagosEncontrados: pagos.length,
      corregidos,
      yaEstaban,
      sinReferencia,
      detalle: revisados,
    });
  } catch (err) {
    console.error("Error en reconciliar-pagos:", err);
    res.status(500).json({ error: err.message || "No se pudo reconciliar" });
  }
}
