import { MercadoPagoConfig, Payment } from "mercadopago";
import admin from "firebase-admin";

function getDb() {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)),
    });
  }
  return admin.firestore();
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
      await db.collection("cuotas").doc(cuotaId).update({
        estado: "pagada",
        metodoPago: "mercadopago",
        fechaPago: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    res.status(200).send("ok");
  } catch (err) {
    console.error("Error en webhook MP:", err);
    res.status(500).send("error");
  }
}
