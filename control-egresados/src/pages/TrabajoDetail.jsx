import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  getTrabajo,
  actualizarTrabajo,
  marcarSenaPagada,
  marcarSaldoPagado,
  eliminarTrabajo,
} from "../data";

export default function TrabajoDetail() {
  const { trabajoId } = useParams();
  const navigate = useNavigate();
  const [trabajo, setTrabajo] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);

  async function refresh() {
    const t = await getTrabajo(trabajoId);
    if (!t) {
      navigate("/trabajos");
      return;
    }
    setTrabajo(t);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trabajoId]);

  if (!trabajo) return <div className="empty">Cargando…</div>;

  const saldo = trabajo.total - (trabajo.montoSena || 0);

  function handleImprimir() {
    const filas = [];
    trabajo.productos.forEach((p) => {
      if (p.talles?.length) {
        p.talles.forEach((t) => {
          filas.push(`
            <tr>
              <td>${p.nombre}</td>
              <td>${p.color || "—"}</td>
              <td>${t.talle}</td>
              <td style="text-align:center;"><strong>${t.cantidad}</strong></td>
            </tr>`);
        });
      } else {
        filas.push(`
          <tr>
            <td>${p.nombre}</td>
            <td>${p.color || "—"}</td>
            <td>—</td>
            <td style="text-align:center;"><strong>${p.cantidad}</strong></td>
          </tr>`);
      }
    });

    const html = `
      <html>
        <head>
          <title>${trabajo.empresa} — Producción</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #17233F; }
            h1 { font-size: 20px; margin-bottom: 2px; }
            .sub { color: #5B6472; font-size: 13px; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; font-size: 15px; }
            th, td { border: 1px solid #ccc; padding: 12px 14px; text-align: left; }
            th { background: #17233F; color: white; }
            tr:nth-child(even) { background: #F7F5EF; }
          </style>
        </head>
        <body>
          <h1>${trabajo.empresa} — Orden de producción</h1>
          <div class="sub">${trabajo.productos.length} producto${trabajo.productos.length !== 1 ? "s" : ""}</div>
          <table>
            <thead>
              <tr><th>Producto</th><th>Color</th><th>Talle</th><th style="text-align:center;">Cantidad</th></tr>
            </thead>
            <tbody>${filas.join("")}</tbody>
          </table>
        </body>
      </html>
    `;

    const ventana = window.open("", "_blank");
    ventana.document.write(html);
    ventana.document.close();
    ventana.focus();
    ventana.print();
  }

  return (
    <div>
      <div className="crumb"><Link to="/trabajos">Trabajos para empresas</Link> / {trabajo.empresa}</div>
      <div className="page-header">
        <div>
          <div className="eyebrow">Trabajo</div>
          <h1>{trabajo.empresa}</h1>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn btn-outline" onClick={() => setShowEditModal(true)}>
            Editar trabajo
          </button>
          <button className="btn btn-outline" onClick={handleImprimir}>
            Imprimir para producción
          </button>
          <button
            className="btn btn-danger"
            onClick={async () => {
              if (confirm(`¿Eliminar el trabajo de "${trabajo.empresa}"?`)) {
                await eliminarTrabajo(trabajo.id);
                navigate("/trabajos");
              }
            }}
          >
            Eliminar
          </button>
        </div>
      </div>

      <div className="card deuda-panel">
        <div className="deuda-stat">
          <div className="label">Total del trabajo</div>
          <div className="value">${Number(trabajo.total).toLocaleString("es-AR")}</div>
        </div>
        <div className="deuda-stat">
          <div className="label">Seña</div>
          <div className="value">${Number(trabajo.montoSena || 0).toLocaleString("es-AR")}</div>
        </div>
        <div className="deuda-stat">
          <div className="label">Saldo</div>
          <div className={`value ${saldo > 0 ? "rust" : "green"}`}>${saldo.toLocaleString("es-AR")}</div>
        </div>
        <div className="deuda-stat">
          <div className="label">Forma de pago</div>
          <div className="value" style={{ fontSize: 16 }}>{trabajo.formaPago || "—"}</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
        <button
          className={`btn ${trabajo.senaPagada ? "btn-outline" : "btn-gold"}`}
          onClick={async () => {
            await marcarSenaPagada(trabajo.id, !trabajo.senaPagada);
            refresh();
          }}
        >
          {trabajo.senaPagada ? "✓ Seña cobrada" : "Marcar seña cobrada"}
        </button>
        <button
          className={`btn ${trabajo.saldoPagado ? "btn-outline" : "btn-gold"}`}
          onClick={async () => {
            await marcarSaldoPagado(trabajo.id, !trabajo.saldoPagado);
            refresh();
          }}
        >
          {trabajo.saldoPagado ? "✓ Saldo cobrado" : "Marcar saldo cobrado"}
        </button>
      </div>

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Producto</th>
              <th>Color</th>
              <th>Cantidad</th>
              <th>Precio unitario</th>
              <th>Subtotal</th>
              <th>Talles</th>
            </tr>
          </thead>
          <tbody>
            {trabajo.productos.map((p, i) => (
              <tr key={i}>
                <td><strong>{p.nombre}</strong></td>
                <td style={{ color: "var(--slate)" }}>{p.color || "—"}</td>
                <td>{p.cantidad}</td>
                <td>${Number(p.precioUnitario).toLocaleString("es-AR")}</td>
                <td>${Number(p.cantidad * p.precioUnitario).toLocaleString("es-AR")}</td>
                <td style={{ fontSize: 13, color: "var(--slate)" }}>
                  {p.talles?.length ? p.talles.map((t) => `${t.talle}: ${t.cantidad}`).join(" · ") : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showEditModal && (
        <EditarTrabajoModal
          trabajo={trabajo}
          onClose={() => setShowEditModal(false)}
          onSaved={() => {
            setShowEditModal(false);
            refresh();
          }}
        />
      )}
    </div>
  );
}

const FORMAS_PAGO = ["Efectivo", "Transferencia", "Mercado Pago"];

function EditarTrabajoModal({ trabajo, onClose, onSaved }) {
  const [empresa, setEmpresa] = useState(trabajo.empresa);
  const [formaPago, setFormaPago] = useState(trabajo.formaPago || "");
  const [montoSena, setMontoSena] = useState(trabajo.montoSena || "");
  const [productos, setProductos] = useState(
    trabajo.productos.map((p) => ({
      nombre: p.nombre,
      color: p.color || "",
      precioUnitario: p.precioUnitario,
      talles: p.talles?.length ? p.talles.map((t) => ({ ...t })) : [{ talle: "", cantidad: "" }],
    }))
  );
  const [saving, setSaving] = useState(false);

  function actualizarProducto(i, campo, valor) {
    setProductos((prev) => prev.map((p, idx) => (idx === i ? { ...p, [campo]: valor } : p)));
  }

  function agregarProducto() {
    setProductos((prev) => [...prev, { nombre: "", color: "", precioUnitario: "", talles: [{ talle: "", cantidad: "" }] }]);
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
      prev.map((p, idx) => (idx === pIdx ? { ...p, talles: p.talles.filter((_, ti) => ti !== tIdx) } : p))
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
      const productosLimpios = productos.map((p) => {
        const talles = (p.talles || [])
          .filter((t) => t.talle)
          .map((t) => ({ talle: t.talle, cantidad: Number(t.cantidad) || 0 }));
        const cantidad = talles.reduce((acc, t) => acc + t.cantidad, 0);
        return {
          nombre: p.nombre,
          color: p.color || "",
          cantidad,
          precioUnitario: Number(p.precioUnitario) || 0,
          talles,
        };
      });
      const total = productosLimpios.reduce((acc, p) => acc + p.cantidad * p.precioUnitario, 0);

      await actualizarTrabajo(trabajo.id, {
        empresa,
        formaPago,
        montoSena: Number(montoSena) || 0,
        productos: productosLimpios,
        total,
      });
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: 560 }} onClick={(e) => e.stopPropagation()}>
        <h2>Editar {trabajo.empresa}</h2>
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
                <label style={{ fontSize: 12, color: "var(--slate)" }}>Talles</label>
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
            <label>Seña ($)</label>
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
            Total: <strong>${totalEstimado.toLocaleString("es-AR")}</strong>
          </p>

          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Guardando…" : "Guardar cambios"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
