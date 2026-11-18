// Saca de un pago de Mercado Pago los datos de quien pagó (para facturar).
// Prefiere los datos de identificación del pagador; si no están, usa los del
// titular de la tarjeta.
export function datosPagador(payment) {
  const payer = payment?.payer || {};
  const titular = payment?.card?.cardholder || {};
  const ident = payer.identification?.number ? payer.identification : titular.identification || {};
  const extra = payment?.additional_info?.payer || {};
  const nombrePagador =
    [payer.first_name, payer.last_name].filter(Boolean).join(" ").trim() ||
    [extra.first_name, extra.last_name].filter(Boolean).join(" ").trim();
  return {
    tipoDoc: String(ident.type || "").toUpperCase(),
    dni: String(ident.number || "").replace(/\D/g, ""),
    nombre: nombrePagador || String(titular.name || "").trim(),
    email: payer.email || "",
    paymentId: payment?.id ? String(payment.id) : "",
    montoPagado: Number(payment?.transaction_amount) || null,
  };
}
