import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  listColegios,
  listTodosLosAlumnos,
  listTodasLasCuotas,
  esCuotaVencida,
  montoConRecargo,
  formatFechaAR,
} from "../data";

function fechaPagoISO(cuota) {
  if (!cuota.fechaPago) return null;
  const d = cuota.fechaPago.toDate ? cuota.fechaPago.toDate() : new Date(cuota.fechaPago);
  return d.toISOString().slice(0, 10);
}

function timestampISO(ts) {
  if (!ts) return null;
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toISOString().slice(0, 10);
}

function dentroDelRango(fechaISO, desde, hasta) {
  if (!fechaISO) return false;
  if (desde && fechaISO < desde) return false;
  if (hasta && fechaISO > hasta) return false;
  return true;
}

export default function Contable() {
  const [colegios, setColegios] = useState(null);
  const [alumnos, setAlumnos] = useState(null);
  const [cuotas, setCuotas] = useState(null);
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [colegioFiltro, setColegioFiltro] = useState("");

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

  const hayFiltro = Boolean(desde || hasta);

  const resumen = useMemo(() => {
    if (!cuotas) return null;

    let facturado = 0;
    let cobrado = 0;
    let enMora = 0;
    const proximos = [];

    const cuotasFiltradas = colegioFiltro
      ? cuotas.filter((c) => c.colegioId === colegioFiltro)
      : cuotas;

    cuotasFiltradas.forEach((c) => {
      const colegio = colegiosPorId[c.colegioId];
      const alumno = alumnosPorId[c.alumnoId];

      // Facturado en el período: cuotas cuyo vencimiento cae dentro del rango.
      // La seña no tiene vencimiento propio, así que usamos la fecha de alta
      // del alumno como referencia. Si tampoco hay alumno (dato huérfano),
      // solo se cuenta cuando no hay filtro activo.
      const fechaReferencia = c.fechaVencimiento || timestampISO(alumno?.createdAt);
      const enPeriodoPorVencimiento = fechaReferencia
        ? dentroDelRango(fechaReferencia, desde, hasta)
        : !hayFiltro;
      if (enPeriodoPorVencimiento) {
        facturado += c.monto;
      }

      // Cobrado en el período: según la fecha real de pago.
      if (c.estado === "pagada") {
        const fPago = fechaPagoISO(c);
        const enPeriodoPorPago = fPago ? dentroDelRango(fPago, desde, hasta) : !hayFiltro;
        if (enPeriodoPorPago) {
          cobrado += c.monto;
        }
      }

      // En mora: pendiente, ya vencida a hoy, y con vencimiento dentro del rango.
      if (c.estado !== "pagada" && esCuotaVencida(c) && enPeriodoPorVencimiento) {
        enMora += montoConRecargo(c, colegio);
      }

      // Próximos vencimientos: pendientes, no vencidas, dentro del rango.
      if (c.estado !== "pagada" && c.fechaVencimiento && !esCuotaVencida(c) && enPeriodoPorVencimiento) {
        proximos.push(c);
      }
    });

    proximos.sort((a, b) => a.fechaVencimiento.localeCompare(b.fechaVencimiento));

    return {
      facturado,
      cobrado,
      enMora,
      saldoPendiente: facturado - cobrado,
      proximos: proximos.slice(0, 30),
    };
  }, [cuotas, colegiosPorId, desde, hasta, hayFiltro, colegioFiltro]);

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

      <div className="card" style={{ padding: "16px 20px", marginBottom: 24, display: "flex", gap: 16, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Colegio</label>
          <select value={colegioFiltro} onChange={(e) => setColegioFiltro(e.target.value)}>
            <option value="">Todos los colegios</option>
            {colegios.map((c) => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Desde</label>
          <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Hasta</label>
          <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </div>
        {(hayFiltro || colegioFiltro) && (
          <button className="btn btn-ghost btn-sm" onClick={() => { setDesde(""); setHasta(""); setColegioFiltro(""); }}>
            Ver todo el historial
          </button>
        )}
      </div>

      <div className="grid-cards" style={{ marginBottom: 28 }}>
        <div className="card" style={{ padding: 20 }}>
          <div className="deuda-stat">
            <div className="label">Cobrado en el período</div>
            <div className="value green">${resumen.cobrado.toLocaleString("es-AR")}</div>
          </div>
        </div>
        <div className="card" style={{ padding: 20 }}>
          <div className="deuda-stat">
            <div className="label">Facturado en el período</div>
            <div className="value">${resumen.facturado.toLocaleString("es-AR")}</div>
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
            <div className="label">Saldo pendiente del período</div>
            <div className={`value ${resumen.saldoPendiente > 0 ? "rust" : "green"}`}>
              ${resumen.saldoPendiente.toLocaleString("es-AR")}
            </div>
          </div>
        </div>
      </div>

      <h2 style={{ fontSize: 18, marginBottom: 12 }}>
        {hayFiltro ? "Vencimientos en el período" : "Próximos vencimientos"}
      </h2>

      {resumen.proximos.length === 0 && (
        <div className="card empty">
          <h3>No hay vencimientos para mostrar</h3>
          <p>No hay cuotas pendientes con vencimiento en el rango seleccionado.</p>
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
