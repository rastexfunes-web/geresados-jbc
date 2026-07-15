import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  listColegios,
  listTodosLosAlumnos,
  listTodasLasCuotas,
  esCuotaVencida,
  montoConRecargo,
  cuotaYaDevengada,
  formatFechaAR,
} from "../data";

export default function Contable() {
  const [colegios, setColegios] = useState(null);
  const [alumnos, setAlumnos] = useState(null);
  const [cuotas, setCuotas] = useState(null);

  useEffect(() => {
    Promise.all([listColegios(), listTodosLosAlumnos(), listTodasLasCuotas()]).then(
      ([c, a, cu]) => {
        setColegios(c);
        setAlumnos(a);
        setCuotas(cu);
      }
    );
  }, []);

  const colegiosPorId = useMemo(() => {
    const map = {};
    colegios?.forEach((c) => (map[c.id] = c));
    return map;
  }, [colegios]);

  const alumnosPorId = useMemo(() => {
    const map = {};
    alumnos?.forEach((a) => (map[a.id] = a));
    return map;
  }, [alumnos]);

  const resumen = useMemo(() => {
    if (!cuotas) return null;

    let cobrado = 0;
    let deberiaCobrar = 0;
    let enMora = 0;
    const proximos = [];

    cuotas.forEach((c) => {
      const colegio = colegiosPorId[c.colegioId];

      if (c.estado === "pagada") {
        cobrado += c.monto;
      }

      if (cuotaYaDevengada(c)) {
        deberiaCobrar += c.monto;
      }

      if (c.estado !== "pagada" && esCuotaVencida(c)) {
        enMora += montoConRecargo(c, colegio);
      }

      if (c.estado !== "pagada" && c.fechaVencimiento && !esCuotaVencida(c)) {
        proximos.push(c);
      }
    });

    proximos.sort((a, b) => a.fechaVencimiento.localeCompare(b.fechaVencimiento));

    return {
      cobrado,
      deberiaCobrar,
      enMora,
      saldoPendiente: deberiaCobrar - cobrado,
      proximos: proximos.slice(0, 20),
    };
  }, [cuotas, colegiosPorId]);

  if (!colegios || !alumnos || !cuotas || !resumen) {
    return <div className="empty">Cargando…</div>;
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="eyebrow">Panel</div>
          <h1>Contable</h1>
        </div>
      </div>

      <div className="grid-cards" style={{ marginBottom: 28 }}>
        <div className="card" style={{ padding: 20 }}>
          <div className="deuda-stat">
            <div className="label">Cobrado a la fecha</div>
            <div className="value green">${resumen.cobrado.toLocaleString("es-AR")}</div>
          </div>
        </div>
        <div className="card" style={{ padding: 20 }}>
          <div className="deuda-stat">
            <div className="label">Debería estar cobrado</div>
            <div className="value">${resumen.deberiaCobrar.toLocaleString("es-AR")}</div>
          </div>
        </div>
        <div className="card" style={{ padding: 20 }}>
          <div className="deuda-stat">
            <div className="label">En mora (con recargo)</div>
            <div className="value rust">${resumen.enMora.toLocaleString("es-AR")}</div>
          </div>
        </div>
        <div className="card" style={{ padding: 20 }}>
          <div className="deuda-stat">
            <div className="label">Saldo pendiente total</div>
            <div className={`value ${resumen.saldoPendiente > 0 ? "rust" : "green"}`}>
              ${resumen.saldoPendiente.toLocaleString("es-AR")}
            </div>
          </div>
        </div>
      </div>

      <h2 style={{ fontSize: 18, marginBottom: 12 }}>Próximos vencimientos</h2>

      {resumen.proximos.length === 0 && (
        <div className="card empty">
          <h3>No hay vencimientos próximos</h3>
          <p>Todas las cuotas pendientes están vencidas o no tienen fecha asignada.</p>
        </div>
      )}

      {resumen.proximos.length > 0 && (
        <div className="card">
          <table className="table">
            <thead>
              <tr>
                <th>Vencimiento</th>
                <th>Alumno</th>
                <th>Colegio</th>
                <th>Cuota</th>
                <th>Monto</th>
              </tr>
            </thead>
            <tbody>
              {resumen.proximos.map((c) => {
                const alumno = alumnosPorId[c.alumnoId];
                const colegio = colegiosPorId[c.colegioId];
                return (
                  <tr key={c.id}>
                    <td>{formatFechaAR(c.fechaVencimiento)}</td>
                    <td>
                      {alumno ? (
                        <Link to={`/colegios/${c.colegioId}/alumnos/${c.alumnoId}`}>
                          {alumno.apellido}, {alumno.nombre}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>{colegio?.nombre || "—"}</td>
                    <td>{c.esSena ? "Seña" : `#${c.numero}`}</td>
                    <td>${Number(c.monto).toLocaleString("es-AR")}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
