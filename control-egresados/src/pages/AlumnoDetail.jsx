import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  getAlumno,
  getColegio,
  listCuotasAlumno,
  resumenDeuda,
  marcarCuotaPagaManual,
  desmarcarCuota,
  esCuotaVencida,
  montoConRecargo,
  formatFechaAR,
  agregarExtraAlumno,
  repartirExtraEnCuotas,
  editarTalleExtraRepartido,
  editarTalleCuotaExtra,
  eliminarExtraRepartido,
  eliminarCuotaExtra,
  actualizarAlumno,
} from "../data";
import { generarCuponCuota } from "../mercadopago";

export default function AlumnoDetail() {
  const { colegioId, alumnoId } = useParams();
  const navigate = useNavigate();
  const [alumno, setAlumno] = useState(null);
  const [colegio, setColegio] = useState(null);
  const [cuotas, setCuotas] = useState(null);
  const [busyCuotaId, setBusyCuotaId] = useState(null);
  const [error, setError] = useState("");
  const [showExtraModal, setShowExtraModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  async function refresh() {
    const [a, c, cu] = await Promise.all([
      getAlumno(alumnoId),
      getColegio(colegioId),
      listCuotasAlumno(alumnoId),
    ]);
    if (!a || !c) {
      navigate("/");
      return;
    }
    setAlumno(a);
    setColegio(c);
    setCuotas(cu);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alumnoId, colegioId]);

  if (!alumno || !colegio || !cuotas) return <div className="empty">Cargando…</div>;

  const resumen = resumenDeuda(cuotas, colegio);

  async function handleGenerarCupon(cuota) {
    setError("");
    setBusyCuotaId(cuota.id);
    try {
      await generarCuponCuota(cuota, alumno, colegio);
      refresh();
    } catch (err) {
      console.error(err);
      setError("No se pudo generar el cupón de pago. Revisá la configuración de Mercado Pago.");
    } finally {
      setBusyCuotaId(null);
    }
  }

  async function handleCopiarLink(link) {
    try {
      await navigator.clipboard.writeText(link);
      setError("");
    } catch {
      // si el navegador bloquea el clipboard, no rompemos nada
    }
  }

  function linkWhatsapp(cuota) {
    const detalle = cuota.esExtra ? cuota.descripcion : cuota.esSena ? "la seña" : `la cuota #${cuota.numero}`;
    const monto = montoConRecargo(cuota, colegio);
    const mensaje = `Hola ${alumno.nombre}! Te paso el link para pagar ${detalle} de ${colegio.nombre} ($${Number(monto).toLocaleString("es-AR")}): ${cuota.mpInitPoint}`;
    const telefono = (alumno.telefono || "").replace(/\D/g, "");
    const base = telefono ? `https://wa.me/${telefono}` : "https://wa.me/";
    return `${base}?text=${encodeURIComponent(mensaje)}`;
  }

  function linkWhatsappPedidoExtra() {
    const url = `https://geresados-jbc.vercel.app/colegios/${colegio.id}/alumnos/${alumno.id}/extra`;
    const mensaje = `Hola ${alumno.nombre}! Si querés agregar algo extra a tu pedido de ${colegio.nombre} (por ejemplo otra remera), entrá acá y lo cargás vos mismo: ${url}`;
    const telefono = (alumno.telefono || "").replace(/\D/g, "");
    const base = telefono ? `https://wa.me/${telefono}` : "https://wa.me/";
    return `${base}?text=${encodeURIComponent(mensaje)}`;
  }

  async function handleMarcarManual(cuota) {
    setBusyCuotaId(cuota.id);
    try {
      await marcarCuotaPagaManual(cuota.id);
      refresh();
    } finally {
      setBusyCuotaId(null);
    }
  }

  async function handleDesmarcar(cuota) {
    setBusyCuotaId(cuota.id);
    try {
      await desmarcarCuota(cuota.id);
      refresh();
    } finally {
      setBusyCuotaId(null);
    }
  }

  async function handleEditarTalleExtraRepartido(indice, talleActual) {
    const nuevoTalle = window.prompt("Nuevo talle para este extra:", talleActual || "");
    if (nuevoTalle === null) return;
    await editarTalleExtraRepartido(alumno.id, alumno.extras, indice, nuevoTalle);
    refresh();
  }

  async function handleEditarTalleCuotaExtra(cuota) {
    const nuevoTalle = window.prompt("Nuevo talle para este extra:", cuota.talle || "");
    if (nuevoTalle === null) return;
    await editarTalleCuotaExtra(cuota.id, nuevoTalle);
    refresh();
  }

  async function handleEliminarExtraRepartido(indice, ex) {
    if (!confirm(`¿Eliminar el extra "${ex.descripcion}"? Se le resta el monto a las cuotas que todavía estén pendientes.`)) return;
    await eliminarExtraRepartido(alumno.id, alumno.extras, indice);
    refresh();
  }

  async function handleEliminarCuotaExtra(cuota) {
    const mensaje = cuota.estado === "pagada"
      ? `¿Eliminar el extra "${cuota.descripcion}"? Ya está marcado como pagado, esto solo lo saca de la lista.`
      : `¿Eliminar el extra "${cuota.descripcion}"?`;
    if (!confirm(mensaje)) return;
    await eliminarCuotaExtra(cuota.id);
    refresh();
  }

  return (
    <div>
      <div className="crumb">
        <Link to="/">Colegios</Link> / <Link to={`/colegios/${colegio.id}`}>{colegio.nombre}</Link> / {alumno.apellido}, {alumno.nombre}
      </div>
      <div className="page-header">
        <div>
          <div className="eyebrow">Alumno</div>
          <h1>
            {alumno.apellido}, {alumno.nombre}
            {alumno.apodo && <span style={{ color: "var(--slate)", fontSize: 20 }}> "{alumno.apodo}"</span>}
          </h1>
          {(alumno.prendaSuperior || alumno.prendaAbrigo) && (
            <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap" }}>
              {alumno.prendaSuperior && (
                <span className="badge badge-gold">
                  {alumno.prendaSuperior}{alumno.talleSuperior ? ` · talle ${alumno.talleSuperior}` : ""}
                </span>
              )}
              {alumno.prendaAbrigo && (
                <span className="badge badge-gold">
                  {alumno.prendaAbrigo}{alumno.talleAbrigo ? ` · talle ${alumno.talleAbrigo}` : ""}
                </span>
              )}
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn btn-outline" onClick={() => setShowEditModal(true)}>
            Editar alumno
          </button>
          <a
            className="btn btn-outline"
            href={linkWhatsappPedidoExtra()}
            target="_blank"
            rel="noreferrer"
          >
            Enviar link para pedir extra
          </a>
          <button className="btn btn-outline" onClick={() => setShowExtraModal(true)}>
            + Agregar extra
          </button>
        </div>
      </div>

      <div className="ribbon" style={{ marginBottom: 24 }}>
        {cuotas.map((c) => (
          <div
            key={c.id}
            className={`ribbon-seg ${c.estado === "pagada" ? "pagada" : ""}`}
            title={c.esExtra ? c.descripcion : c.esSena ? "Seña" : `Cuota ${c.numero}`}
          >
            {c.esExtra ? "+" : c.esSena ? "S" : c.numero}
          </div>
        ))}
      </div>

      <div className="card deuda-panel">
        <div className="deuda-stat">
          <div className="label">Total del plan</div>
          <div className="value">${resumen.total.toLocaleString("es-AR")}</div>
        </div>
        <div className="deuda-stat">
          <div className="label">Pagado</div>
          <div className="value green">${resumen.pagado.toLocaleString("es-AR")}</div>
        </div>
        <div className="deuda-stat">
          <div className="label">Saldo pendiente</div>
          <div className={`value ${resumen.saldo > 0 ? "rust" : "green"}`}>
            ${resumen.saldo.toLocaleString("es-AR")}
          </div>
        </div>
        <div className="deuda-stat">
          <div className="label">Cuotas pagas</div>
          <div className="value">{resumen.cuotasPagas} / {resumen.cuotasTotales}</div>
        </div>
      </div>

      {alumno.extras?.length > 0 && (
        <div className="card" style={{ padding: "14px 20px", marginBottom: 24, fontSize: 13, color: "var(--slate)" }}>
          <strong style={{ color: "var(--navy)", display: "block", marginBottom: 6 }}>Extras aplicados</strong>
          {alumno.extras.map((ex, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
              <span>
                {ex.descripcion}{ex.talle ? ` (talle ${ex.talle})` : ""} — ${Number(ex.monto).toLocaleString("es-AR")} (repartido en {ex.repartidoEnCuotas} cuota{ex.repartidoEnCuotas !== 1 ? "s" : ""})
              </span>
              <button
                className="btn btn-ghost btn-sm"
                style={{ padding: "2px 6px", fontSize: 12 }}
                onClick={() => handleEditarTalleExtraRepartido(i, ex.talle)}
              >
                Editar talle
              </button>
              <button
                className="btn btn-danger btn-sm"
                style={{ padding: "2px 6px", fontSize: 12 }}
                onClick={() => handleEliminarExtraRepartido(i, ex)}
              >
                Eliminar
              </button>
            </div>
          ))}
        </div>
      )}

      {error && <div className="error-text" style={{ marginBottom: 12 }}>{error}</div>}

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Cuota</th>
              <th>Vencimiento</th>
              <th>Monto</th>
              <th>Estado</th>
              <th>Método</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {cuotas.map((c) => {
              const vencida = esCuotaVencida(c);
              const monto = montoConRecargo(c, colegio);
              return (
                <tr key={c.id}>
                  <td>{c.esExtra ? `${c.descripcion}${c.talle ? ` (talle ${c.talle})` : ""}` : c.esSena ? "Seña" : `#${c.numero}`}</td>
                  <td style={{ fontSize: 13, color: "var(--slate)" }}>
                    {c.fechaVencimiento ? formatFechaAR(c.fechaVencimiento) : "—"}
                  </td>
                  <td>
                    ${Number(monto).toLocaleString("es-AR")}
                    {vencida && monto !== c.monto && (
                      <div style={{ fontSize: 11, color: "var(--rust)" }}>
                        (${Number(c.monto).toLocaleString("es-AR")} + recargo)
                      </div>
                    )}
                  </td>
                  <td>
                    <span className={`badge ${c.estado === "pagada" ? "badge-green" : vencida ? "badge-rust" : "badge-gold"}`}>
                      {c.estado === "pagada" ? "Pagada" : vencida ? "Vencida" : "Pendiente"}
                    </span>
                  </td>
                  <td style={{ fontSize: 13, color: "var(--slate)" }}>
                    {c.metodoPago === "mercadopago" ? "Mercado Pago" : c.metodoPago === "manual" ? "Manual" : "—"}
                  </td>
                  <td style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                    {c.esExtra && (
                      <>
                        <button
                          className="btn btn-outline btn-sm"
                          onClick={() => handleEditarTalleCuotaExtra(c)}
                        >
                          Editar talle
                        </button>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleEliminarCuotaExtra(c)}
                        >
                          Eliminar
                        </button>
                      </>
                    )}
                    {c.estado !== "pagada" && (
                      <>
                        <button
                          className="btn btn-outline btn-sm"
                          disabled={busyCuotaId === c.id}
                          onClick={() => handleGenerarCupon(c)}
                        >
                          {c.mpInitPoint ? "Reenviar cupón" : "Generar cupón"}
                        </button>
                        {c.mpInitPoint && (
                          <>
                            <button
                              className="btn btn-outline btn-sm"
                              onClick={() => handleCopiarLink(c.mpInitPoint)}
                            >
                              Copiar link
                            </button>
                            <a
                              className="btn btn-outline btn-sm"
                              href={linkWhatsapp(c)}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Enviar por WhatsApp
                            </a>
                          </>
                        )}
                        <button
                          className="btn btn-gold btn-sm"
                          disabled={busyCuotaId === c.id}
                          onClick={() => handleMarcarManual(c)}
                        >
                          Marcar pagada
                        </button>
                      </>
                    )}
                    {c.estado === "pagada" && (
                      <button
                        className="btn btn-ghost btn-sm"
                        disabled={busyCuotaId === c.id}
                        onClick={() => handleDesmarcar(c)}
                      >
                        Deshacer
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showExtraModal && (
        <ExtraModal
          alumno={alumno}
          colegio={colegio}
          cuotas={cuotas}
          onClose={() => setShowExtraModal(false)}
          onCreated={() => {
            setShowExtraModal(false);
            refresh();
          }}
        />
      )}

      {showEditModal && (
        <EditarAlumnoModal
          alumno={alumno}
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

const PRENDAS_SUPERIOR = ["Remera", "Chomba"];
const PRENDAS_ABRIGO = ["Campera", "Buzo"];

function EditarAlumnoModal({ alumno, onClose, onSaved }) {
  const [nombre, setNombre] = useState(alumno.nombre || "");
  const [apellido, setApellido] = useState(alumno.apellido || "");
  const [apodo, setApodo] = useState(alumno.apodo || "");
  const [dni, setDni] = useState(alumno.dni || "");
  const [telefono, setTelefono] = useState(alumno.telefono || "");
  const [prendaSuperior, setPrendaSuperior] = useState(alumno.prendaSuperior || "");
  const [prendaAbrigo, setPrendaAbrigo] = useState(alumno.prendaAbrigo || "");
  const [talleSuperior, setTalleSuperior] = useState(alumno.talleSuperior || "");
  const [talleAbrigo, setTalleAbrigo] = useState(alumno.talleAbrigo || "");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await actualizarAlumno(alumno.id, {
        nombre,
        apellido,
        apodo,
        dni,
        telefono,
        prendaSuperior,
        prendaAbrigo,
        talleSuperior,
        talleAbrigo,
      });
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Editar alumno</h2>
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

const TIPOS_EXTRA = ["Remera", "Chomba", "Buzo", "Campera", "Emoji"];

function ExtraModal({ alumno, colegio, cuotas, onClose, onCreated }) {
  const [tipoExtra, setTipoExtra] = useState("");
  const [talle, setTalle] = useState("");
  const [cantidad, setCantidad] = useState(1);
  const [precioUnitario, setPrecioUnitario] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const esEmoji = tipoExtra === "Emoji";
  const total = (Number(cantidad) || 0) * (Number(precioUnitario) || 0);
  const cuotasPendientes = cuotas.filter((c) => !c.esSena && !c.esExtra && c.estado !== "pagada");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!tipoExtra) {
      setError("Elegí qué se está agregando.");
      return;
    }
    setSaving(true);
    try {
      const detalle = Number(cantidad) > 1 ? `${tipoExtra} (x${cantidad})` : tipoExtra;
      const talleFinal = esEmoji ? "" : talle;
      if (cuotasPendientes.length > 0) {
        await repartirExtraEnCuotas({
          alumnoId: alumno.id,
          descripcion: detalle,
          montoTotal: total,
          cuotasPendientes,
          talle: talleFinal,
        });
      } else {
        // No hay cuotas pendientes para repartir (ej: alumno ya pagó todo),
        // así que el extra queda como un cobro aparte con su propio cupón.
        const siguienteNumero = Math.max(0, ...cuotas.map((c) => c.numero || 0)) + 1;
        await agregarExtraAlumno({
          alumnoId: alumno.id,
          colegioId: colegio.id,
          descripcion: detalle,
          monto: total,
          numero: siguienteNumero,
          talle: talleFinal,
        });
      }
      onCreated();
    } catch (err) {
      setError(err.message || "No se pudo agregar el extra.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Agregar extra — {alumno.apellido}, {alumno.nombre}</h2>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>¿Qué se agrega?</label>
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
          <p style={{ fontSize: 13, color: "var(--slate)" }}>
            {cuotasPendientes.length > 0
              ? `Se reparte en partes iguales entre las ${cuotasPendientes.length} cuota${cuotasPendientes.length !== 1 ? "s" : ""} pendientes del alumno (se suma al monto de cada una).`
              : "Este alumno ya tiene todas sus cuotas pagas, así que este extra va a quedar como un cobro aparte, con su propio cupón de pago."}
          </p>
          {error && <div className="error-text">{error}</div>}
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Agregando…" : "Agregar extra"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
