import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "./AuthContext";

export default function Layout() {
  const { user, logout } = useAuth();

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
