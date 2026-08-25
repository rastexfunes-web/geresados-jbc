import { MercadoPagoConfig, Payment, Preference } from "mercadopago";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

function getDb() {
  if (getApps().length === 0) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (!raw) {
      throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY no está definida");
    }
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      throw new Error(
        `FIREBASE_SERVICE_ACCOUNT_KEY no es un JSON válido (largo actual: ${raw.length} caracteres). Detalle: ${err.message}`
      );
    }
    if (!parsed.private_key || !parsed.client_email || !parsed.project_id) {
      throw new Error(
        "FIREBASE_SERVICE_ACCOUNT_KEY es JSON válido pero le faltan campos (private_key, client_email o project_id). Puede que el archivo se haya pegado incompleto."
      );
    }
    initializeApp({
      credential: cert(parsed),
    });
  }
  return getFirestore();
}

export default async function handler(req, res) {
  try {
    // Mercado Pago manda notificaciones en dos formatos posibles:
    // 1) Nuevo: ?type=payment&data.id=123
    // 2) IPN clásico: ?topic=payment&id=123
    let paymentId = null;

    if (req.query.type === "payment" || req.body?.type === "payment") {
      paymentId = req.query["data.id"] || req.body?.data?.id;
    } else if (req.query.topic === "payment" || req.body?.topic === "payment") {
      paymentId = req.query.id || req.body?.id;
    }

    if (!paymentId) {
      // Ignoramos notificaciones que no son de un pago puntual
      // (ej. merchant_order, u otros tipos de evento).
      res.status(200).send("ignorado");
      return;
    }

    if (!process.env.MP_ACCESS_TOKEN || !process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      console.error("Faltan variables de entorno MP_ACCESS_TOKEN o FIREBASE_SERVICE_ACCOUNT_KEY");
      res.status(500).send("falta configuración");
      return;
    }

    const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });
    const paymentClient = new Payment(client);
    const payment = await paymentClient.get({ id: paymentId });

    const cuotaId = payment.external_reference;
    if (!cuotaId) {
      res.status(200).send("sin referencia");
      return;
    }

    if (payment.status === "approved") {
      const db = getDb();
      const cuotaRef = db.collection("cuotas").doc(cuotaId);
      const cuotaSnap = await cuotaRef.get();

      await cuotaRef.update({
        estado: "pagada",
        metodoPago: "mercadopago",
        fechaPago: FieldValue.serverTimestamp(),
      });

      // Vencemos el link de pago para que no se pueda volver a usar y
      // cobrar dos veces por error (por ejemplo si el alumno lo reabre
      // desde el chat de WhatsApp después de haber pagado).
      const preferenceId = cuotaSnap.exists ? cuotaSnap.data().mpPreferenceId : null;
      if (preferenceId) {
        try {
          const preferenceClient = new Preference(client);
          const ahora = new Date().toISOString();
          await preferenceClient.update({
            id: preferenceId,
            body: {
              expires: true,
              expiration_date_from: ahora,
              expiration_date_to: ahora,
            },
          });
        } catch (err) {
          // Si falla el vencimiento del link no rompemos el webhook: la
          // cuota ya quedó marcada como pagada, que es lo importante.
          console.error("No se pudo vencer la preference de MP:", err);
        }
      }
    }

    res.status(200).send("ok");
  } catch (err) {
    console.error("Error en webhook MP:", err);
    res.status(500).send("error");
  }
}
