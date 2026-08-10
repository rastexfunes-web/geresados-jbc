import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./AuthContext";
import PrivateRoute from "./PrivateRoute";
import Layout from "./Layout";
import Login from "./pages/Login";
import PagoRealizado from "./pages/PagoRealizado";
import Colegios from "./pages/Colegios";
import ColegioDetail from "./pages/ColegioDetail";
import AlumnoDetail from "./pages/AlumnoDetail";
import Contable from "./pages/Contable";
import Trabajos from "./pages/Trabajos";
import TrabajoDetail from "./pages/TrabajoDetail";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/pago-realizado" element={<PagoRealizado />} />
          <Route
            path="/"
            element={
              <PrivateRoute>
                <Layout />
              </PrivateRoute>
            }
          >
            <Route index element={<Colegios />} />
            <Route path="contable" element={<Contable />} />
            <Route path="trabajos" element={<Trabajos />} />
            <Route path="trabajos/:trabajoId" element={<TrabajoDetail />} />
            <Route path="colegios/:colegioId" element={<ColegioDetail />} />
            <Route path="colegios/:colegioId/alumnos/:alumnoId" element={<AlumnoDetail />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
