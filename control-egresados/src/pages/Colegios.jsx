import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listColegios, crearColegio, eliminarColegio } from "../data";

export default function Colegios() {
  const [colegios, setColegios] = useState(null);
  const [showModal, setShowModal] = useState(false);

  async function refresh() {
    setColegios(await listColegios());
  }

  useEffect(() => {
    refresh();
  }, []);

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="eyebrow">Panel</div>
          <h1>Colegios</h1>
        </div>
        <button className="btn btn-gold" onClick={() => setShowModal(true)}>
          + Nuevo colegio
        </button>
      </div>

      {colegios === null && <div className="empty">Cargando…</div>}

      {colegios?.length === 0 && (
        <div className="card empty">
          <h3>Todavía no cargaste ningún colegio</h3>
          <p>Creá el primero para empezar a cargar alumnos y planes de cuotas.</p>
        </div>
      )}

      {colegios?.length > 0 && (
        <div className="grid-cards">
          {colegios.map((c) => (
            <Link to={`/colegios/${c.id}`} className="card colegio-card" key={c.id}>
              <h3>{c.nombre}</h3>
              <div className="meta">
                {c.cantidadCuotas} cuotas de ${Number(c.montoCuota).toLocaleString("es-AR")}
                {c.montoSena > 0 && <> + seña ${Number(c.montoSena).toLocaleString("es-AR")}</>}
              </div>
              <button
                className="btn btn-danger btn-sm"
                style={{ alignSelf: "flex-start", marginTop: 4 }}
                onClick={async (e) => {
                  e.preventDefault();
                  if (confirm(`¿Eliminar el colegio "${c.nombre}"? Esto no borra sus alumnos.`)) {
                    await eliminarColegio(c.id);
                    refresh();
                  }
                }}
              >
                Eliminar
              </button>
            </Link>
          ))}
        </div>
      )}

      {showModal && (
        <NuevoColegioModal
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

function NuevoColegioModal({ onClose, onCreated }) {
  const [nombre, setNombre] = useState("");
  const [cantidadCuotas, setCantidadCuotas] = useState(6);
  const [montoCuota, setMontoCuota] = useState("");
  const [montoSena, setMontoSena] = useState("");
  const [fechaEntrega, setFechaEntrega] = useState("");
  const [imagenUrl, setImagenUrl] = useState("");
  const [fechaPrimerVencimiento, setFechaPrimerVencimiento] = useState("");
  const [frecuenciaDias, setFrecuenciaDias] = useState(30);
  const [recargoPorcentaje, setRecargoPorcentaje] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await crearColegio({
        nombre,
        cantidadCuotas,
        montoCuota,
        montoSena,
        fechaEntrega,
        imagenUrl,
        fechaPrimerVencimiento,
        frecuenciaDias,
        recargoPorcentaje,
      });
      onCreated();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Nuevo colegio</h2>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Nombre del colegio</label>
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} required autoFocus />
          </div>
          <div className="form-row">
            <div className="field">
              <label>Cantidad de cuotas</label>
              <input
                type="number"
                min="1"
                value={cantidadCuotas}
                onChange={(e) => setCantidadCuotas(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label>Monto por cuota ($)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={montoCuota}
                onChange={(e) => setMontoCuota(e.target.value)}
                required
              />
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
          <div className="form-row">
            <div className="field">
              <label>Vencimiento 1° cuota (opcional)</label>
              <input
                type="date"
                value={fechaPrimerVencimiento}
                onChange={(e) => setFechaPrimerVencimiento(e.target.value)}
              />
            </div>
            <div className="field">
              <label>Frecuencia entre cuotas (días)</label>
              <input
                type="number"
                min="1"
                value={frecuenciaDias}
                onChange={(e) => setFrecuenciaDias(e.target.value)}
              />
            </div>
          </div>
          <div className="field">
            <label>Recargo por pago fuera de término (%, opcional)</label>
            <input
              type="number"
              min="0"
              step="0.1"
              value={recargoPorcentaje}
              onChange={(e) => setRecargoPorcentaje(e.target.value)}
              placeholder="0"
            />
          </div>
          <div className="field">
            <label>Fecha de entrega aproximada (opcional)</label>
            <input
              type="date"
              value={fechaEntrega}
              onChange={(e) => setFechaEntrega(e.target.value)}
            />
          </div>
          <div className="field">
            <label>Link a la foto del diseño (opcional)</label>
            <input
              type="url"
              placeholder="https://..."
              value={imagenUrl}
              onChange={(e) => setImagenUrl(e.target.value)}
            />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Creando…" : "Crear colegio"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
