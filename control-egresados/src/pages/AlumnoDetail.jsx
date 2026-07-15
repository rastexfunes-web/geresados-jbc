import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  getAlumno,
  getColegio,
  listCuotasAlumno,
  resumenDeuda,
  marcarCuotaPagaManual,
  desmarcarCuota,
} from "../data";
import { generarCuponCuota } from "../mercadopago";

export default function AlumnoDetail() {
  const { alumnoId } = useParams();
  const navigate = useNavigate();
  const [alumno, setAlumno] = useState(null);
  const [colegio, setColegio] = useState(null);
  const [cuotas, setCuotas] = useState(null);
  const [busyCuotaId, setBusyCuotaId] = useState(null);
  const [error, setError] = useState("");

  async function refresh() {
    const a = await getAlumno(alumnoId);
    if (!a) {
      navigate("/");
      return;
    }
    setAlumno(a);
    const [c, cu] = await Promise.all([getColegio(a.colegioId), listCuotasAlumno(alumnoId)]);
    setColegio(c);
    setCuotas(cu);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alumnoId]);

  if (!alumno || !colegio || !cuotas) return <div className="empty">Cargando…</div>;

  const resumen = resumenDeuda(cuotas);

  async function handleGenerarCupon(cuota) {
    setError("");
    setBusyCuotaId(cuota.id);
    try {
      const link = await generarCuponCuota(cuota, alumno, colegio);
      window.open(link, "_blank");
      refresh();
    } catch (err) {
      console.error(err);
      setError("No se pudo generar el cupón de pago. Revisá la configuración de Mercado Pago.");
    } finally {
      setBusyCuotaId(null);
    }
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
            <div style={{ marginTop: 6, display: "flex", gap: 6 }}>
              {alumno.prendaSuperior && <span className="badge badge-gold">{alumno.prendaSuperior}</span>}
              {alumno.prendaAbrigo && <span className="badge badge-gold">{alumno.prendaAbrigo}</span>}
            </div>
          )}
        </div>
      </div>

      <div className="ribbon" style={{ marginBottom: 24 }}>
        {cuotas.map((c) => (
          <div
            key={c.id}
            className={`ribbon-seg ${c.estado === "pagada" ? "pagada" : ""}`}
            title={c.esSena ? "Seña" : `Cuota ${c.numero}`}
          >
            {c.esSena ? "S" : c.numero}
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

      {error && <div className="error-text" style={{ marginBottom: 12 }}>{error}</div>}

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Cuota</th>
              <th>Monto</th>
              <th>Estado</th>
              <th>Método</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {cuotas.map((c) => (
              <tr key={c.id}>
                <td>{c.esSena ? "Seña" : `#${c.numero}`}</td>
                <td>${Number(c.monto).toLocaleString("es-AR")}</td>
                <td>
                  <span className={`badge ${c.estado === "pagada" ? "badge-green" : "badge-rust"}`}>
                    {c.estado === "pagada" ? "Pagada" : "Pendiente"}
                  </span>
                </td>
                <td style={{ fontSize: 13, color: "var(--slate)" }}>
                  {c.metodoPago === "mercadopago" ? "Mercado Pago" : c.metodoPago === "manual" ? "Manual" : "—"}
                </td>
                <td style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
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
                        <a className="btn btn-outline btn-sm" href={c.mpInitPoint} target="_blank" rel="noreferrer">
                          Abrir link
                        </a>
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
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
