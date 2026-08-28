// Envía un mensaje de plantilla (template) por la API de WhatsApp Business
// (Meta Cloud API). Se usa tanto para la plantilla de "confirmar contacto"
// como para la de "Cuponera" (el link de pago).
//
// Variables de entorno necesarias en Vercel:
// - WHATSAPP_ACCESS_TOKEN: el token permanente del usuario del sistema.
// - WHATSAPP_PHONE_NUMBER_ID: el ID del número de teléfono de WhatsApp Business.
// - WHATSAPP_TEMPLATE_CONFIRMACION: nombre exacto de la plantilla de confirmación de contacto.
// - WHATSAPP_TEMPLATE_CUPONERA: nombre exacto de la plantilla del cupón de pago.
// - WHATSAPP_TEMPLATE_LANG: código de idioma usado al crear las plantillas (ej: "es_AR" o "es").

// Normaliza un teléfono argentino al formato que espera WhatsApp:
// 54 9 <código de área><número>, solo dígitos, sin +, espacios ni guiones.
function formatTelefonoWhatsapp(telefono) {
  let digitos = (telefono || "").replace(/\D/g, "");
  if (!digitos) return null;

  // Si ya viene con el 54 al principio, lo dejamos; si no, se lo agregamos.
  if (!digitos.startsWith("54")) {
    digitos = "54" + digitos;
  }
  // Los celulares argentinos necesitan el "9" después del 54.
  if (!digitos.startsWith("549")) {
    digitos = "54" + "9" + digitos.slice(2);
  }
  return digitos;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Método no permitido" });
    return;
  }

  try {
    const { telefono, tipo, parametros } = req.body;

    if (!telefono || !tipo || !Array.isArray(parametros)) {
      res.status(400).json({ error: "Faltan datos (telefono, tipo, parametros)" });
      return;
    }

    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const lang = process.env.WHATSAPP_TEMPLATE_LANG || "es_AR";

    const templateName =
      tipo === "confirmacion"
        ? process.env.WHATSAPP_TEMPLATE_CONFIRMACION
        : tipo === "cuponera"
        ? process.env.WHATSAPP_TEMPLATE_CUPONERA
        : null;

    if (!accessToken || !phoneNumberId) {
      res.status(500).json({ error: "Falta configurar WHATSAPP_ACCESS_TOKEN o WHATSAPP_PHONE_NUMBER_ID en Vercel" });
      return;
    }
    if (!templateName) {
      res.status(500).json({
        error: `Falta configurar el nombre de la plantilla '${tipo}' en Vercel (WHATSAPP_TEMPLATE_${tipo.toUpperCase()})`,
      });
      return;
    }

    const numeroDestino = formatTelefonoWhatsapp(telefono);
    if (!numeroDestino) {
      res.status(400).json({ error: "El alumno no tiene un teléfono cargado" });
      return;
    }

    const body = {
      messaging_product: "whatsapp",
      to: numeroDestino,
      type: "template",
      template: {
        name: templateName,
        language: { code: lang },
        components: [
          {
            type: "body",
            parameters: parametros.map((texto) => ({ type: "text", text: String(texto) })),
          },
        ],
      },
    };

    const resp = await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await resp.json();

    if (!resp.ok) {
      console.error("Error de WhatsApp API:", data);
      res.status(500).json({ error: data.error?.message || "Error al enviar el mensaje de WhatsApp" });
      return;
    }

    res.status(200).json({ ok: true, data });
  } catch (err) {
    console.error("Error en enviar-whatsapp-template:", err);
    res.status(500).json({ error: "No se pudo enviar el mensaje" });
  }
}
