import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./AuthContext";
import PrivateRoute from "./PrivateRoute";
import Layout from "./Layout";
import Login from "./pages/Login";
import Colegios from "./pages/Colegios";
import ColegioDetail from "./pages/ColegioDetail";
import AlumnoDetail from "./pages/AlumnoDetail";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <PrivateRoute>
                <Layout />
              </PrivateRoute>
            }
          >
            <Route index element={<Colegios />} />
            <Route path="colegios/:colegioId" element={<ColegioDetail />} />
            <Route path="colegios/:colegioId/alumnos/:alumnoId" element={<AlumnoDetail />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
