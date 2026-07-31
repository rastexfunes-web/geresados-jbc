import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  getTrabajo,
  marcarSenaPagada,
  marcarSaldoPagado,
  eliminarTrabajo,
} from "../data";

export default function TrabajoDetail() {
  const { trabajoId } = useParams();
  const navigate = useNavigate();
  const [trabajo, setTrabajo] = useState(null);

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
    const filasProductos = trabajo.productos
      .map(
        (p) => `
        <tr>
          <td>${p.nombre}</td>
          <td>${p.cantidad}</td>
          <td>$${Number(p.precioUnitario).toLocaleString("es-AR")}</td>
          <td>$${Number(p.cantidad * p.precioUnitario).toLocaleString("es-AR")}</td>
        </tr>`
      )
      .join("");

    const filasTalles = trabajo.productos
      .filter((p) => p.talles?.length)
      .map(
        (p) => `
        <tr>
          <td><strong>${p.nombre}</strong></td>
          <td>${p.talles.map((t) => `${t.talle}: <strong>${t.cantidad}</strong>`).join(" · ")}</td>
        </tr>`
      )
      .join("");

    const html = `
      <html>
        <head>
          <title>${trabajo.empresa} — Producción</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #17233F; }
            h1 { font-size: 20px; margin-bottom: 2px; }
            h2 { font-size: 15px; margin: 28px 0 10px; }
            .sub { color: #5B6472; font-size: 13px; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; font-size: 13px; }
            th, td { border: 1px solid #ccc; padding: 8px 10px; text-align: left; }
            th { background: #17233F; color: white; }
            tr:nth-child(even) { background: #F7F5EF; }
          </style>
        </head>
        <body>
          <h1>${trabajo.empresa} — Orden de producción</h1>
          <div class="sub">Forma de pago: ${trabajo.formaPago || "—"} · Total: $${Number(trabajo.total).toLocaleString("es-AR")}</div>
          <table>
            <thead>
              <tr><th>Producto</th><th>Cantidad</th><th>Precio unitario</th><th>Subtotal</th></tr>
            </thead>
            <tbody>${filasProductos}</tbody>
          </table>
          ${filasTalles ? `
          <h2>Desglose de talles</h2>
          <table>
            <thead><tr><th>Producto</th><th>Talles</th></tr></thead>
            <tbody>${filasTalles}</tbody>
          </table>` : ""}
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
    </div>
  );
}
