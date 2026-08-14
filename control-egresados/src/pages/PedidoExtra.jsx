import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

const TIPOS_EXTRA = ["Remera", "Chomba", "Buzo", "Campera", "Emoji"];

export default function PedidoExtra() {
  const { colegioId, alumnoId } = useParams();
  const [info, setInfo] = useState(null);
  const [tipoExtra, setTipoExtra] = useState("");
  const [talle, setTalle] = useState("");
  const [cantidad, setCantidad] = useState(1);
  const [precioUnitario, setPrecioUnitario] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const [enviado, setEnviado] = useState(false);

  const esEmoji = tipoExtra === "Emoji";
  const total = (Number(cantidad) || 0) * (Number(precioUnitario) || 0);

  useEffect(() => {
    fetch(`/api/extra-publico?colegioId=${colegioId}&alumnoId=${alumnoId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setInfo)
      .catch(() =>
        setError("No pudimos encontrar tu pedido. Pedile el link de nuevo a quien te lo mandó.")
      );
  }, [colegioId, alumnoId]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!tipoExtra) {
      setError("Elegí qué querés agregar.");
      return;
    }
    setEnviando(true);
    try {
      const detalle = Number(cantidad) > 1 ? `${tipoExtra} (x${cantidad})` : tipoExtra;
      const talleFinal = esEmoji ? "" : talle;
      const resp = await fetch("/api/extra-publico", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ colegioId, alumnoId, descripcion: detalle, monto: total, talle: talleFinal }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error || "No se pudo enviar el pedido.");
      }
      if (data.initPoint) {
        window.location.href = data.initPoint;
      } else {
        setEnviado(true);
      }
    } catch (err) {
      setError(err.message || "No se pudo enviar el pedido. Probá de nuevo en un rato.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="mark">
          <span className="seal" /> Egresados
        </div>

        {info && (
          <div className="sub">
            {info.colegioNombre} — {info.apellido}, {info.nombre}
          </div>
        )}
        {!info && !error && <div className="sub">Cargando…</div>}

        {error && <div className="error-text">{error}</div>}

        {!enviado && info && (
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label>¿Qué querés agregar?</label>
              <div className="chip-group">
                {TIPOS_EXTRA.map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={`chip ${tipoExtra === t ? "selected" : ""}`}
                    onClick={() => setTipoExtra(tipoExtra === t ? "" : t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            {!esEmoji && (
              <div className="field">
                <label>Talle (opcional)</label>
                <input
                  value={talle}
                  onChange={(e) => setTalle(e.target.value)}
                  placeholder="S, M, L, 12, 14…"
                />
              </div>
            )}
            <div className="form-row">
              <div className="field" style={{ maxWidth: 110 }}>
                <label>Cantidad</label>
                <input
                  type="number"
                  min="1"
                  value={cantidad}
                  onChange={(e) => setCantidad(e.target.value)}
                  required
                />
              </div>
              <div className="field">
                <label>Precio unitario ($)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={precioUnitario}
                  onChange={(e) => setPrecioUnitario(e.target.value)}
                  required
                />
              </div>
            </div>
            <p style={{ fontSize: 13, color: "var(--slate)" }}>
              Total: <strong>${total.toLocaleString("es-AR")}</strong>
            </p>
            <button
              className="btn btn-primary"
              type="submit"
              disabled={enviando}
              style={{ width: "100%", justifyContent: "center" }}
            >
              {enviando ? "Enviando…" : "Agregar a mis cuotas"}
            </button>
          </form>
        )}

        {enviado && (
          <p style={{ color: "var(--slate)", fontSize: 14 }}>
            ¡Listo! Se sumó a tus próximas cuotas.
          </p>
        )}
      </div>
    </div>
  );
}
