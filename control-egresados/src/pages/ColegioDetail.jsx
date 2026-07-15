import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  getColegio,
  actualizarColegio,
  listAlumnos,
  crearAlumno,
  eliminarAlumno,
  listCuotasAlumno,
  resumenDeuda,
} from "../data";

export default function ColegioDetail() {
  const { colegioId } = useParams();
  const navigate = useNavigate();
  const [colegio, setColegio] = useState(null);
  const [alumnos, setAlumnos] = useState(null);
  const [resumenes, setResumenes] = useState({});
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  async function refresh() {
    const c = await getColegio(colegioId);
    if (!c) {
      navigate("/");
      return;
    }
    setColegio(c);
    const al = await listAlumnos(colegioId);
    setAlumnos(al);

    const entries = await Promise.all(
      al.map(async (a) => {
        const cuotas = await listCuotasAlumno(a.id);
        return [a.id, resumenDeuda(cuotas, c)];
      })
    );
    setResumenes(Object.fromEntries(entries));
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colegioId]);

  if (!colegio) return <div className="empty">Cargando…</div>;

  const totalColegio = alumnos?.length
    ? ((colegio.montoSena || 0) + colegio.cantidadCuotas * colegio.montoCuota) * alumnos.length
    : 0;

  function handleImprimirTalles() {
    const filas = alumnos
      .map(
        (a) => `
        <tr>
          <td>${a.apellido}, ${a.nombre}</td>
          <td>${a.apodo || "—"}</td>
          <td>${a.prendaSuperior || "—"}</td>
          <td>${a.talleSuperior || "—"}</td>
          <td>${a.prendaAbrigo || "—"}</td>
          <td>${a.talleAbrigo || "—"}</td>
        </tr>`
      )
      .join("");

    // Conteo para producción: cuántas prendas de cada tipo y talle hay que hacer.
    const conteo = {};
    alumnos.forEach((a) => {
      if (a.prendaSuperior) {
        const talle = a.talleSuperior || "sin talle";
        conteo[a.prendaSuperior] = conteo[a.prendaSuperior] || {};
        conteo[a.prendaSuperior][talle] = (conteo[a.prendaSuperior][talle] || 0) + 1;
      }
      if (a.prendaAbrigo) {
        const talle = a.talleAbrigo || "sin talle";
        conteo[a.prendaAbrigo] = conteo[a.prendaAbrigo] || {};
        conteo[a.prendaAbrigo][talle] = (conteo[a.prendaAbrigo][talle] || 0) + 1;
      }
    });

    const filasResumen = Object.entries(conteo)
      .map(([prenda, talles]) => {
        const detalle = Object.entries(talles)
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([talle, cant]) => `<td>${talle}: <strong>${cant}</strong></td>`)
          .join("");
        return `<tr><td><strong>${prenda}</strong></td>${detalle}</tr>`;
      })
      .join("");

    const html = `
      <html>
        <head>
          <title>Talles — ${colegio.nombre}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #17233F; }
            h1 { font-size: 20px; margin-bottom: 2px; }
            h2 { font-size: 15px; margin: 28px 0 10px; }
            .sub { color: #5B6472; font-size: 13px; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; font-size: 13px; }
            th, td { border: 1px solid #ccc; padding: 8px 10px; text-align: left; }
            th { background: #17233F; color: white; }
            tr:nth-child(even) { background: #F7F5EF; }
            .resumen td { border: 1px solid #ccc; }
          </style>
        </head>
        <body>
          <h1>${colegio.nombre} — Talles para producción</h1>
          <div class="sub">${alumnos.length} alumnos${colegio.fechaEntrega ? ` · Entrega estimada: ${formatFecha(colegio.fechaEntrega)}` : ""}</div>
          <table>
            <thead>
              <tr>
                <th>Alumno</th>
                <th>Apodo</th>
                <th>Remera/Chomba</th>
                <th>Talle</th>
                <th>Campera/Buzo</th>
                <th>Talle</th>
              </tr>
            </thead>
            <tbody>${filas}</tbody>
          </table>

          <h2>Resumen para producción (cantidad por talle)</h2>
          <table class="resumen">
            <tbody>${filasResumen}</tbody>
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
      <div className="crumb"><Link to="/">Colegios</Link> / {colegio.nombre}</div>
      <div className="page-header">
        <div>
          <div className="eyebrow">Colegio</div>
          <h1>{colegio.nombre}</h1>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn btn-outline" onClick={() => setShowEditModal(true)}>
            Editar colegio
          </button>
          <button className="btn btn-outline" onClick={handleImprimirTalles} disabled={!alumnos?.length}>
            Imprimir talles
          </button>
          <button className="btn btn-gold" onClick={() => setShowModal(true)}>
            + Nuevo alumno
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: 20, marginBottom: 24, display: "flex", gap: 20 }}>
        {colegio.imagenUrl && (
          <img
            src={colegio.imagenUrl}
            alt={`Diseño ${colegio.nombre}`}
            style={{ width: 120, height: 120, objectFit: "cover", borderRadius: 8, flexShrink: 0 }}
          />
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 14, color: "var(--slate)" }}>
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
            <div><strong style={{ color: "var(--navy)" }}>{colegio.cantidadCuotas}</strong> cuotas por alumno</div>
            <div><strong style={{ color: "var(--navy)" }}>${Number(colegio.montoCuota).toLocaleString("es-AR")}</strong> por cuota</div>
            {colegio.montoSena > 0 && (
              <div><strong style={{ color: "var(--navy)" }}>${Number(colegio.montoSena).toLocaleString("es-AR")}</strong> de seña</div>
            )}
            <div><strong style={{ color: "var(--navy)" }}>{alumnos?.length ?? 0}</strong> alumnos cargados</div>
          </div>
          {colegio.fechaEntrega && (
            <div>Entrega aproximada: <strong style={{ color: "var(--navy)" }}>{formatFecha(colegio.fechaEntrega)}</strong></div>
          )}
          {colegio.recargoPorcentaje > 0 && (
            <div>Recargo por mora: <strong style={{ color: "var(--navy)" }}>{colegio.recargoPorcentaje}%</strong></div>
          )}
          {alumnos?.length > 0 && (
            <div>
              Importe total a cobrar ({alumnos.length} alumno{alumnos.length !== 1 ? "s" : ""}, cuotas + señas):{" "}
              <strong style={{ color: "var(--navy)" }}>${totalColegio.toLocaleString("es-AR")}</strong>
            </div>
          )}
        </div>
      </div>

      {alumnos?.length === 0 && (
        <div className="card empty">
          <h3>Sin alumnos todavía</h3>
          <p>Agregá el primer alumno de {colegio.nombre} para generar su plan de cuotas.</p>
        </div>
      )}

      {alumnos?.length > 0 && (
        <div className="card">
          <table className="table">
            <thead>
              <tr>
                <th>Alumno</th>
                <th>Cuotas</th>
                <th>Pagado</th>
                <th>Saldo</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {alumnos.map((a) => {
                const r = resumenes[a.id];
                return (
                  <tr key={a.id} className="clickable" onClick={() => navigate(`/colegios/${colegioId}/alumnos/${a.id}`)}>
                    <td>
                      <strong>{a.apellido}, {a.nombre}</strong>
                      {a.apodo && <span style={{ color: "var(--slate)" }}> "{a.apodo}"</span>}
                      <div style={{ fontSize: 12, color: "var(--slate)" }}>
                        {[a.prendaSuperior, a.prendaAbrigo, a.telefono].filter(Boolean).join(" · ")}
                      </div>
                    </td>
                    <td>{r ? `${r.cuotasPagas} / ${r.cuotasTotales}` : "…"}</td>
                    <td>{r ? `$${r.pagado.toLocaleString("es-AR")}` : "…"}</td>
                    <td>
                      {r && (
                        <span className={`badge ${r.saldo === 0 ? "badge-green" : "badge-rust"}`}>
                          {r.saldo === 0 ? "Al día" : `$${r.saldo.toLocaleString("es-AR")}`}
                        </span>
                      )}
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={async () => {
                          if (confirm(`¿Eliminar a ${a.nombre} ${a.apellido}? Se borran también sus cuotas.`)) {
                            await eliminarAlumno(a.id);
                            refresh();
                          }
                        }}
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <NuevoAlumnoModal
          colegio={colegio}
          onClose={() => setShowModal(false)}
          onCreated={() => {
            setShowModal(false);
            refresh();
          }}
        />
      )}

      {showEditModal && (
        <EditarColegioModal
          colegio={colegio}
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

function formatFecha(fechaISO) {
  const [y, m, d] = fechaISO.split("-");
  return `${d}/${m}/${y}`;
}

function EditarColegioModal({ colegio, onClose, onSaved }) {
  const [fechaEntrega, setFechaEntrega] = useState(colegio.fechaEntrega || "");
  const [imagenUrl, setImagenUrl] = useState(colegio.imagenUrl || "");
  const [fechaPrimerVencimiento, setFechaPrimerVencimiento] = useState(colegio.fechaPrimerVencimiento || "");
  const [frecuenciaDias, setFrecuenciaDias] = useState(colegio.frecuenciaDias || 30);
  const [recargoPorcentaje, setRecargoPorcentaje] = useState(colegio.recargoPorcentaje || "");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await actualizarColegio(colegio.id, {
        fechaEntrega,
        imagenUrl,
        fechaPrimerVencimiento,
        frecuenciaDias: Number(frecuenciaDias) || 30,
        recargoPorcentaje: Number(recargoPorcentaje) || 0,
      });
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Editar {colegio.nombre}</h2>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Fecha de entrega aproximada</label>
            <input type="date" value={fechaEntrega} onChange={(e) => setFechaEntrega(e.target.value)} />
          </div>
          <div className="field">
            <label>Link a la foto del diseño</label>
            <input type="url" placeholder="https://..." value={imagenUrl} onChange={(e) => setImagenUrl(e.target.value)} />
          </div>
          <div className="form-row">
            <div className="field">
              <label>Vencimiento 1° cuota</label>
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
            <label>Recargo por pago fuera de término (%)</label>
            <input
              type="number"
              min="0"
              step="0.1"
              value={recargoPorcentaje}
              onChange={(e) => setRecargoPorcentaje(e.target.value)}
              placeholder="0"
            />
          </div>
          <p style={{ fontSize: 12, color: "var(--slate)" }}>
            Estos cambios de vencimiento y recargo solo aplican a los alumnos que cargues de ahora en adelante.
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

const PRENDAS_SUPERIOR = ["Remera", "Chomba"];
const PRENDAS_ABRIGO = ["Campera", "Buzo"];

function NuevoAlumnoModal({ colegio, onClose, onCreated }) {
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [apodo, setApodo] = useState("");
  const [dni, setDni] = useState("");
  const [telefono, setTelefono] = useState("");
  const [prendaSuperior, setPrendaSuperior] = useState("");
  const [prendaAbrigo, setPrendaAbrigo] = useState("");
  const [talleSuperior, setTalleSuperior] = useState("");
  const [talleAbrigo, setTalleAbrigo] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await crearAlumno(
        {
          colegioId: colegio.id,
          nombre,
          apellido,
          apodo,
          dni,
          telefono,
          prendaSuperior,
          prendaAbrigo,
          talleSuperior,
          talleAbrigo,
        },
        colegio
      );
      onCreated();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Nuevo alumno — {colegio.nombre}</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="field">
              <label>Nombre</label>
              <input value={nombre} onChange={(e) => setNombre(e.target.value)} required autoFocus />
            </div>
            <div className="field">
              <label>Apellido</label>
              <input value={apellido} onChange={(e) => setApellido(e.target.value)} required />
            </div>
          </div>
          <div className="field">
            <label>Apodo (opcional)</label>
            <input value={apodo} onChange={(e) => setApodo(e.target.value)} />
          </div>
          <div className="field">
            <label>Remera o chomba</label>
            <div className="chip-group">
              {PRENDAS_SUPERIOR.map((p) => (
                <button
                  key={p}
                  type="button"
                  className={`chip ${prendaSuperior === p ? "selected" : ""}`}
                  onClick={() => setPrendaSuperior(prendaSuperior === p ? "" : p)}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <label>Talle remera/chomba (opcional)</label>
            <input value={talleSuperior} onChange={(e) => setTalleSuperior(e.target.value)} placeholder="S, M, L, 12, 14…" />
          </div>
          <div className="field">
            <label>Campera o buzo</label>
            <div className="chip-group">
              {PRENDAS_ABRIGO.map((p) => (
                <button
                  key={p}
                  type="button"
                  className={`chip ${prendaAbrigo === p ? "selected" : ""}`}
                  onClick={() => setPrendaAbrigo(prendaAbrigo === p ? "" : p)}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <label>Talle buzo/campera (opcional)</label>
            <input value={talleAbrigo} onChange={(e) => setTalleAbrigo(e.target.value)} placeholder="S, M, L, 12, 14…" />
          </div>
          <div className="form-row">
            <div className="field">
              <label>DNI (opcional)</label>
              <input value={dni} onChange={(e) => setDni(e.target.value)} />
            </div>
            <div className="field">
              <label>Teléfono (opcional)</label>
              <input value={telefono} onChange={(e) => setTelefono(e.target.value)} />
            </div>
          </div>
          <p style={{ fontSize: 13, color: "var(--slate)" }}>
            Se van a generar automáticamente {colegio.cantidadCuotas} cuotas de $
            {Number(colegio.montoCuota).toLocaleString("es-AR")} para este alumno.
          </p>
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Creando…" : "Crear alumno"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
