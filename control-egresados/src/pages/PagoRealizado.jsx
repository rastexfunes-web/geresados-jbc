import { useSearchParams } from "react-router-dom";

const MENSAJES = {
  approved: {
    titulo: "¡Pago recibido!",
    texto: "Tu pago se registró correctamente. Ya podés cerrar esta página.",
    color: "var(--green)",
  },
  pending: {
    titulo: "Pago en proceso",
    texto: "Tu pago está siendo procesado. En cuanto se confirme, quedará registrado.",
    color: "var(--gold)",
  },
  rejected: {
    titulo: "El pago no se pudo completar",
    texto: "Hubo un problema al procesar el pago. Podés volver a intentarlo con el mismo link, o pedir uno nuevo.",
    color: "var(--rust)",
  },
};

export default function PagoRealizado() {
  const [searchParams] = useSearchParams();
  const status = searchParams.get("collection_status") || searchParams.get("status") || "pending";
  const info = MENSAJES[status] || MENSAJES.pending;

  return (
    <div className="login-screen">
      <div className="login-card" style={{ textAlign: "center" }}>
        <div className="mark" style={{ justifyContent: "center" }}>
          <span className="seal" /> Egresados
        </div>
        <h2 style={{ margin: "20px 0 10px", color: info.color }}>{info.titulo}</h2>
        <p style={{ color: "var(--slate)", fontSize: 14 }}>{info.texto}</p>
      </div>
    </div>
  );
}
