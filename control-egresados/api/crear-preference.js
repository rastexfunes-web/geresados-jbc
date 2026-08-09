import { MercadoPagoConfig, Preference } from "mercadopago";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Método no permitido" });
    return;
  }

  try {
    const { cuotaId, alumnoId, colegioId, titulo, monto } = req.body;

    if (!cuotaId || !alumnoId || !colegioId || !monto) {
      res.status(400).json({ error: "Faltan datos de la cuota" });
      return;
    }

    if (!process.env.MP_ACCESS_TOKEN) {
      res.status(500).json({ error: "Falta configurar MP_ACCESS_TOKEN en Vercel" });
      return;
    }

    const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });
    const preference = new Preference(client);

    const appUrl = `https://${req.headers.host}`;
    const backUrl = `${appUrl}/colegios/${colegioId}/alumnos/${alumnoId}`;

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
          success: backUrl,
          pending: backUrl,
          failure: backUrl,
        },
        auto_return: "approved",
        notification_url: `${appUrl}/api/webhook-mp`,
      },
    });

    res.status(200).json({
      preferenceId: result.id,
      initPoint: result.init_point,
    });
  } catch (err) {
    console.error("Error creando preference:", err);
    res.status(500).json({ error: "No se pudo generar el cupón de pago" });
  }
}
