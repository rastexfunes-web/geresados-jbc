const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { MercadoPagoConfig, Preference, Payment } = require("mercadopago");

initializeApp();
const db = getFirestore();

const MP_ACCESS_TOKEN = defineSecret("MP_ACCESS_TOKEN");
const REGION = "southamerica-east1";

// URL pública de tu app (para las páginas de vuelta y el webhook).
// Actualizala con tu dominio real antes de deployar.
const APP_URL = "https://control-egresados.vercel.app";

/**
 * Callable invocada desde el frontend para generar el cupón de pago
 * (preference de Mercado Pago Checkout Pro) de una cuota puntual.
 */
exports.crearPreferenceMP = onCall(
  { region: REGION, secrets: [MP_ACCESS_TOKEN] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Necesitás estar logueado.");
    }

    const { cuotaId, alumnoId, titulo, monto } = request.data;
    if (!cuotaId || !alumnoId || !monto) {
      throw new HttpsError("invalid-argument", "Faltan datos de la cuota.");
    }

    const client = new MercadoPagoConfig({ accessToken: MP_ACCESS_TOKEN.value() });
    const preference = new Preference(client);

    const result = await preference.create({
      body: {
        items: [
          {
            title: titulo || "Cuota egresados",
            quantity: 1,
            unit_price: Number(monto),
            currency_id: "ARS",
          },
        ],
        external_reference: cuotaId,
        back_urls: {
          success: `${APP_URL}/alumnos/${alumnoId}`,
          pending: `${APP_URL}/alumnos/${alumnoId}`,
          failure: `${APP_URL}/alumnos/${alumnoId}`,
        },
        auto_return: "approved",
        notification_url: `https://${REGION}-${process.env.GCLOUD_PROJECT}.cloudfunctions.net/webhookMP`,
      },
    });

    return {
      preferenceId: result.id,
      initPoint: result.init_point,
    };
  }
);

/**
 * Webhook público que Mercado Pago llama cuando cambia el estado de un pago.
 * Marca la cuota correspondiente como pagada cuando el pago está aprobado.
 */
exports.webhookMP = onRequest(
  { region: REGION, secrets: [MP_ACCESS_TOKEN] },
  async (req, res) => {
    try {
      const paymentId = req.query["data.id"] || req.body?.data?.id;
      const type = req.query.type || req.body?.type;

      if (type !== "payment" || !paymentId) {
        res.status(200).send("ignorado");
        return;
      }

      const client = new MercadoPagoConfig({ accessToken: MP_ACCESS_TOKEN.value() });
      const paymentClient = new Payment(client);
      const payment = await paymentClient.get({ id: paymentId });

      const cuotaId = payment.external_reference;
      if (!cuotaId) {
        res.status(200).send("sin referencia");
        return;
      }

      if (payment.status === "approved") {
        await db.collection("cuotas").doc(cuotaId).update({
          estado: "pagada",
          metodoPago: "mercadopago",
          fechaPago: FieldValue.serverTimestamp(),
        });
      }

      res.status(200).send("ok");
    } catch (err) {
      console.error("Error en webhookMP:", err);
      res.status(500).send("error");
    }
  }
);
