import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listTrabajos, crearTrabajo } from "../data";

function nuevoProducto() {
  return { nombre: "", color: "", precioUnitario: "", talles: [{ talle: "", cantidad: "" }] };
}

export default function Trabajos() {
  const [trabajos, setTrabajos] = useState(null);
  const [showModal, setShowModal] = useState(false);

  async function refresh() {
    setTrabajos(await listTrabajos());
  }

  useEffect(() => {
    refresh();
  }, []);

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="eyebrow">Panel</div>
          <h1>Trabajos para empresas</h1>
        </div>
        <button className="btn btn-gold" onClick={() => setShowModal(true)}>
          + Nuevo trabajo
        </button>
      </div>

      {trabajos === null && <div className="empty">Cargando…</div>}

      {trabajos?.length === 0 && (
        <div className="card empty">
          <h3>Todavía no cargaste ningún trabajo</h3>
          <p>Creá el primero para empezar a llevar el control de trabajos para empresas.</p>
        </div>
      )}

      {trabajos?.length > 0 && (
        <div className="grid-cards">
          {trabajos.map((t) => {
            const saldo = t.total - (t.montoSena || 0);
            const alDia = t.senaPagada && t.saldoPagado;
            return (
              <Link to={`/trabajos/${t.id}`} className="card colegio-card" key={t.id}>
                <h3>{t.empresa}</h3>
                <div className="meta">
                  {t.productos?.length || 0} producto{t.productos?.length !== 1 ? "s" : ""} · Total ${Number(t.total).toLocaleString("es-AR")}
                </div>
                <span className={`badge ${alDia ? "badge-green" : "badge-rust"}`} style={{ alignSelf: "flex-start" }}>
                  {alDia ? "Cobrado" : `Saldo $${saldo.toLocaleString("es-AR")}`}
                </span>
              </Link>
            );
          })}
        </div>
      )}

      {showModal && (
        <NuevoTrabajoModal
          onClose={() => setShowModal(false)}
          onCreated={() => {
            setShowModal(false);
            refresh();
          }}
        />
      )}
    </div>
  );
}

const FORMAS_PAGO = ["Efectivo", "Transferencia", "Mercado Pago"];

function NuevoTrabajoModal({ onClose, onCreated }) {
  const [empresa, setEmpresa] = useState("");
  const [formaPago, setFormaPago] = useState("");
  const [montoSena, setMontoSena] = useState("");
  const [productos, setProductos] = useState([nuevoProducto()]);
  const [saving, setSaving] = useState(false);

  function actualizarProducto(i, campo, valor) {
    setProductos((prev) => prev.map((p, idx) => (idx === i ? { ...p, [campo]: valor } : p)));
  }

  function agregarProducto() {
    setProductos((prev) => [...prev, nuevoProducto()]);
  }

  function quitarProducto(i) {
    setProductos((prev) => prev.filter((_, idx) => idx !== i));
  }

  function actualizarTalle(pIdx, tIdx, campo, valor) {
    setProductos((prev) =>
      prev.map((p, idx) => {
        if (idx !== pIdx) return p;
        const talles = p.talles.map((t, ti) => (ti === tIdx ? { ...t, [campo]: valor } : t));
        return { ...p, talles };
      })
    );
  }

  function agregarTalle(pIdx) {
    setProductos((prev) =>
      prev.map((p, idx) => (idx === pIdx ? { ...p, talles: [...p.talles, { talle: "", cantidad: "" }] } : p))
    );
  }

  function quitarTalle(pIdx, tIdx) {
    setProductos((prev) =>
      prev.map((p, idx) =>
        idx === pIdx ? { ...p, talles: p.talles.filter((_, ti) => ti !== tIdx) } : p
      )
    );
  }

  const totalEstimado = productos.reduce((acc, p) => {
    const cantidad = p.talles.reduce((a, t) => a + (Number(t.cantidad) || 0), 0);
    return acc + cantidad * (Number(p.precioUnitario) || 0);
  }, 0);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await crearTrabajo({ empresa, formaPago, montoSena, productos });
      onCreated();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: 560 }} onClick={(e) => e.stopPropagation()}>
        <h2>Nuevo trabajo para empresa</h2>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Nombre de la empresa</label>
            <input value={empresa} onChange={(e) => setEmpresa(e.target.value)} required autoFocus />
          </div>

          <label style={{ fontSize: 13, fontWeight: 600, color: "var(--navy)" }}>Productos</label>
          {productos.map((p, pIdx) => (
            <div key={pIdx} className="producto-row">
              <div className="form-row">
                <div className="field">
                  <label>Producto</label>
                  <input
                    value={p.nombre}
                    onChange={(e) => actualizarProducto(pIdx, "nombre", e.target.value)}
                    placeholder="Ej: Remera estampada"
                    required
                  />
                </div>
                <div className="field" style={{ maxWidth: 110 }}>
                  <label>Color</label>
                  <input
                    value={p.color}
                    onChange={(e) => actualizarProducto(pIdx, "color", e.target.value)}
                    placeholder="Ej: Blanco"
                  />
                </div>
                <div className="field" style={{ maxWidth: 130 }}>
                  <label>Precio unitario</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={p.precioUnitario}
                    onChange={(e) => actualizarProducto(pIdx, "precioUnitario", e.target.value)}
                    required
                  />
                </div>
              </div>

              <div style={{ marginLeft: 4 }}>
                <label style={{ fontSize: 12, color: "var(--slate)" }}>Talles (opcional)</label>
                {p.talles.map((t, tIdx) => (
                  <div key={tIdx} className="form-row" style={{ marginBottom: 6 }}>
                    <input
                      style={{ flex: 1, border: "1px solid var(--line)", borderRadius: 8, padding: "7px 10px", fontSize: 13 }}
                      placeholder="Talle (S, M, L…)"
                      value={t.talle}
                      onChange={(e) => actualizarTalle(pIdx, tIdx, "talle", e.target.value)}
                    />
                    <input
                      type="number"
                      min="0"
                      style={{ width: 80, border: "1px solid var(--line)", borderRadius: 8, padding: "7px 10px", fontSize: 13 }}
                      placeholder="Cant."
                      value={t.cantidad}
                      onChange={(e) => actualizarTalle(pIdx, tIdx, "cantidad", e.target.value)}
                    />
                    {p.talles.length > 1 && (
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => quitarTalle(pIdx, tIdx)}>✕</button>
                    )}
                  </div>
                ))}
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => agregarTalle(pIdx)}>
                  + Agregar talle
                </button>
                <div style={{ fontSize: 12, color: "var(--slate)", marginTop: 6 }}>
                  Cantidad total (suma de talles): <strong style={{ color: "var(--navy)" }}>
                    {p.talles.reduce((acc, t) => acc + (Number(t.cantidad) || 0), 0)}
                  </strong>
                </div>
              </div>

              {productos.length > 1 && (
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  style={{ marginTop: 8 }}
                  onClick={() => quitarProducto(pIdx)}
                >
                  Quitar producto
                </button>
              )}
              <hr style={{ border: "none", borderTop: "1px solid var(--line)", margin: "16px 0" }} />
            </div>
          ))}

          <button type="button" className="btn btn-outline btn-sm" onClick={agregarProducto} style={{ marginBottom: 16 }}>
            + Agregar otro producto
          </button>

          <div className="field">
            <label>Forma de pago</label>
            <div className="chip-group">
              {FORMAS_PAGO.map((f) => (
                <button
                  key={f}
                  type="button"
                  className={`chip ${formaPago === f ? "selected" : ""}`}
                  onClick={() => setFormaPago(formaPago === f ? "" : f)}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <label>Seña ($, opcional)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={montoSena}
              onChange={(e) => setMontoSena(e.target.value)}
              placeholder="0"
            />
          </div>

          <p style={{ fontSize: 13, color: "var(--slate)" }}>
            Total estimado: <strong>${totalEstimado.toLocaleString("es-AR")}</strong>
          </p>

          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Creando…" : "Crear trabajo"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
