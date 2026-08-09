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
    const paymentId = req.query["data.id"] || req.body?.data?.id;
    const type = req.query.type || req.body?.type;

    if (type !== "payment" || !paymentId) {
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
