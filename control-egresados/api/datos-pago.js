import { MercadoPagoConfig, Payment } from "mercadopago";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { datosPagador } from "./_pagador.js";

function init() {
  if (getApps().length === 0) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY no está definida");
    initializeApp({ credential: cert(JSON.parse(raw)) });
  }
}

// POST { cuotaId } con "Authorization: Bearer <token de Firebase>".
// Busca en Mercado Pago el pago aprobado de esa cuota y devuelve quién pagó
// (DNI, nombre, mail) y cuánto. Solo para usuarios logueados del sistema.
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Método no permitido" });
    return;
  }
  try {
    init();
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!token) {
      res.status(401).json({ error: "No autorizado" });
      return;
    }
    let usuario;
    try {
      usuario = await getAuth().verifyIdToken(token);
    } catch {
      res.status(401).json({ error: "No autorizado" });
      return;
    }
    if (!usuario.email || usuario.firebase?.sign_in_provider === "anonymous") {
      res.status(401).json({ error: "No autorizado" });
      return;
    }

    const cuotaId = String(req.body?.cuotaId || "");
    if (!cuotaId) {
      res.status(400).json({ error: "Falta la cuota" });
      return;
    }
    if (!process.env.MP_ACCESS_TOKEN) {
      res.status(500).json({ error: "Falta configurar MP_ACCESS_TOKEN" });
      return;
    }

    const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });
    const busqueda = await new Payment(client).search({
      options: { external_reference: cuotaId, sort: "date_approved", criteria: "desc", limit: 10 },
    });
    const aprobado = (busqueda.results || []).find((p) => p.status === "approved");
    if (!aprobado) {
      res.status(404).json({ error: "No encontré un pago aprobado de Mercado Pago para esta cuota" });
      return;
    }

    const datos = datosPagador(aprobado);
    // Lo dejamos guardado en la cuota para no volver a consultarlo.
    await getFirestore().collection("cuotas").doc(cuotaId).update({
      pagador: datos,
      mpPaymentId: datos.paymentId,
      montoPagado: datos.montoPagado,
    });
    res.status(200).json({ ok: true, ...datos });
  } catch (err) {
    console.error("Error en datos-pago:", err);
    res.status(500).json({ error: "No se pudieron traer los datos de Mercado Pago" });
  }
}
