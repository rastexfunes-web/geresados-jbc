import { useEffect, useState } from "react";
import {
  listTrabajos,
  crearTrabajo,
  marcarTrabajoPagado,
  desmarcarTrabajoPagado,
  eliminarTrabajo,
} from "../data";

export default function Trabajos() {
  const [trabajos, setTrabajos] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [busyId, setBusyId] = useState(null);

  async function refresh() {
    setTrabajos(await listTrabajos());
  }

  useEffect(() => {
    refresh();
  }, []);

  async function togglePagado(t) {
    setBusyId(t.id);
    try {
      if (t.pagado) {
        await desmarcarTrabajoPagado(t.id);
      } else {
        await marcarTrabajoPagado(t.id);
      }
      refresh();
    } finally {
      setBusyId(null);
    }
  }

  const totalPendiente = trabajos?.filter((t) => !t.pagado).reduce((acc, t) => acc + t.monto, 0) || 0;

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

      {trabajos?.length > 0 && (
        <div className="card" style={{ padding: "14px 20px", marginBottom: 24, fontSize: 14, color: "var(--slate)" }}>
          <strong style={{ color: "var(--navy)" }}>{trabajos.length}</strong> trabajos cargados ·
          {" "}saldo pendiente de cobro: <strong className={totalPendiente > 0 ? "" : ""} style={{ color: totalPendiente > 0 ? "var(--rust)" : "var(--green)" }}>
            ${totalPendiente.toLocaleString("es-AR")}
          </strong>
        </div>
      )}

      {trabajos === null && <div className="empty">Cargando…</div>}

      {trabajos?.length === 0 && (
        <div className="card empty">
          <h3>Todavía no cargaste ningún trabajo</h3>
          <p>Creá el primero para empezar a llevar el control de trabajos para empresas.</p>
        </div>
      )}

      {trabajos?.length > 0 && (
        <div className="card">
          <table className="table">
            <thead>
              <tr>
                <th>Empresa</th>
                <th>Trabajo</th>
                <th>Monto</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {trabajos.map((t) => (
                <tr key={t.id}>
                  <td><strong>{t.empresa}</strong></td>
                  <td style={{ color: "var(--slate)" }}>{t.descripcion || "—"}</td>
                  <td>${Number(t.monto).toLocaleString("es-AR")}</td>
                  <td>
                    <span className={`badge ${t.pagado ? "badge-green" : "badge-rust"}`}>
                      {t.pagado ? "Pagado" : "Pendiente"}
                    </span>
                  </td>
                  <td style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                    <button
                      className="btn btn-gold btn-sm"
                      disabled={busyId === t.id}
                      onClick={() => togglePagado(t)}
                    >
                      {t.pagado ? "Marcar pendiente" : "Marcar pagado"}
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={async () => {
                        if (confirm(`¿Eliminar el trabajo de "${t.empresa}"?`)) {
                          await eliminarTrabajo(t.id);
                          refresh();
                        }
                      }}
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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

function NuevoTrabajoModal({ onClose, onCreated }) {
  const [empresa, setEmpresa] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [monto, setMonto] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await crearTrabajo({ empresa, descripcion, monto });
      onCreated();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Nuevo trabajo para empresa</h2>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Nombre de la empresa</label>
            <input value={empresa} onChange={(e) => setEmpresa(e.target.value)} required autoFocus />
          </div>
          <div className="field">
            <label>Descripción del trabajo</label>
            <input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Ej: 50 remeras estampadas" />
          </div>
          <div className="field">
            <label>Monto total ($)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              required
            />
          </div>
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
