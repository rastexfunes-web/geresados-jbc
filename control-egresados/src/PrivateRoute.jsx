import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

export default function PrivateRoute({ children }) {
  const { user } = useAuth();

  if (user === undefined) return <div className="empty">Cargando…</div>;
  if (user === null) return <Navigate to="/login" replace />;

  return children;
}
