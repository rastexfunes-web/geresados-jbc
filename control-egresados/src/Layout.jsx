import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { listColegios, listAlumnos, listCuotasAlumno, resumenDeuda } from "./data";

export default function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [colegios, setColegios] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [alumnosPorColegio, setAlumnosPorColegio] = useState({});
  const [loadingAlumnosId, setLoadingAlumnosId] = useState(null);

  useEffect(() => {
    refreshColegios();
  }, []);

  async function refreshColegios() {
    setColegios(await listColegios());
  }

  const colegioMatch = location.pathname.match(/^\/colegios\/([^/]+)/);
  const activeColegioId = colegioMatch ? colegioMatch[1] : null;
  const alumnoMatch = location.pathname.match(/\/alumnos\/([^/]+)/);
  const activeAlumnoId = alumnoMatch ? alumnoMatch[1] : null;

  // Cuando la URL apunta a un colegio (o a un alumno de un colegio),
  // desplegamos ese colegio en el sidebar y traemos sus alumnos.
  useEffect(() => {
    if (activeColegioId) {
      setExpandedId(activeColegioId);
      cargarAlumnos(activeColegioId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeColegioId, activeAlumnoId]);

  async function cargarAlumnos(colegioId) {
    setLoadingAlumnosId(colegioId);
    const colegio = colegios?.find((c) => c.id === colegioId);
    const al = await listAlumnos(colegioId);
    const conResumen = await Promise.all(
      al.map(async (a) => {
        const cuotas = await listCuotasAlumno(a.id);
        return { ...a, resumen: resumenDeuda(cuotas, colegio) };
      })
    );
    setAlumnosPorColegio((prev) => ({ ...prev, [colegioId]: conResumen }));
    setLoadingAlumnosId(null);
  }

  function toggleColegio(colegioId) {
    if (expandedId === colegioId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(colegioId);
    cargarAlumnos(colegioId);
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="mark"><span className="seal" /> Egresados</div>
          <div className="sub">JBC Egresados</div>
        </div>

        <nav className="sidebar-nav">
          <NavLink to="/" end className={({ isActive }) => (isActive ? "active" : "")}>
            Colegios
          </NavLink>
          <NavLink to="/contable" className={({ isActive }) => (isActive ? "active" : "")}>
            Contable
          </NavLink>

          <div className="sidebar-tree">
            {colegios === null && <div className="sidebar-loading">Cargando…</div>}

            {colegios?.map((c) => (
              <div key={c.id} className="sidebar-colegio">
                <button
                  className={`sidebar-colegio-btn ${activeColegioId === c.id ? "active" : ""}`}
                  onClick={() => {
                    toggleColegio(c.id);
                    navigate(`/colegios/${c.id}`);
                  }}
                >
                  <span className={`chevron ${expandedId === c.id ? "open" : ""}`}>›</span>
                  <span className="sidebar-colegio-name">{c.nombre}</span>
                </button>

                {expandedId === c.id && (
                  <div className="sidebar-alumnos">
                    {loadingAlumnosId === c.id && <div className="sidebar-loading">Cargando…</div>}
                    {loadingAlumnosId !== c.id && alumnosPorColegio[c.id]?.length === 0 && (
                      <div className="sidebar-loading">Sin alumnos</div>
                    )}
                    {alumnosPorColegio[c.id]?.map((a) => (
                      <button
                        key={a.id}
                        className={`sidebar-alumno-btn ${activeAlumnoId === a.id ? "active" : ""}`}
                        onClick={() => navigate(`/colegios/${c.id}/alumnos/${a.id}`)}
                        title={a.resumen.saldo === 0 ? "Al día" : `Debe $${a.resumen.saldo.toLocaleString("es-AR")}`}
                      >
                        <span className={`pago-dot ${a.resumen.saldo === 0 ? "ok" : "debe"}`} />
                        {a.apellido}, {a.nombre}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </nav>

        <div className="sidebar-footer">
          <div style={{ marginBottom: 8 }}>{user?.email}</div>
          <button onClick={logout}>Cerrar sesión</button>
        </div>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
