import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  getColegio,
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
        return [a.id, resumenDeuda(cuotas)];
      })
    );
    setResumenes(Object.fromEntries(entries));
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colegioId]);

  if (!colegio) return <div className="empty">Cargando…</div>;

  return (
    <div>
      <div className="crumb"><Link to="/">Colegios</Link> / {colegio.nombre}</div>
      <div className="page-header">
        <div>
          <div className="eyebrow">Colegio</div>
          <h1>{colegio.nombre}</h1>
        </div>
        <button className="btn btn-gold" onClick={() => setShowModal(true)}>
          + Nuevo alumno
        </button>
      </div>

      <div className="card" style={{ padding: "14px 20px", marginBottom: 24, display: "flex", gap: 24, fontSize: 14, color: "var(--slate)" }}>
        <div><strong style={{ color: "var(--navy)" }}>{colegio.cantidadCuotas}</strong> cuotas por alumno</div>
        <div><strong style={{ color: "var(--navy)" }}>${Number(colegio.montoCuota).toLocaleString("es-AR")}</strong> por cuota</div>
        <div><strong style={{ color: "var(--navy)" }}>{alumnos?.length ?? 0}</strong> alumnos cargados</div>
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
                  <tr key={a.id} className="clickable" onClick={() => navigate(`/alumnos/${a.id}`)}>
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
