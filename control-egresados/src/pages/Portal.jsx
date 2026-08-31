import { useState } from "react";

function formatFecha(fechaISO) {
  if (!fechaISO) return "";
  const [y, m, d] = fechaISO.split("-");
  return `${d}/${m}/${y}`;
}

export default function Portal() {
  const [busqueda, setBusqueda] = useState("");
  const [resultados, setResultados] = useState(null);
  const [error, setError] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [pagando, setPagando] = useState(null);

  // Si escribió solo números, buscamos por DNI o teléfono. Si no, por nombre y apellido.
  const esSoloNumeros = /^\d+$/.test(busqueda.trim());

  async function handleBuscar(e) {
    e.preventDefault();
    setError("");
    setBuscando(true);
    setResultados(null);
    try {
      const valor = busqueda.trim();
      const url = esSoloNumeros
        ? `/api/portal-alumno?dni=${encodeURIComponent(valor)}`
        : `/api/portal-alumno?q=${encodeURIComponent(valor)}`;
      const resp = await fetch(url);
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "No encontramos resultados");
      setResultados(data.resultados);
    } catch (err) {
      setError(err.message);
    } finally {
      setBuscando(false);
    }
  }

  async function handlePagar(alumnoId, cuotaId) {
    setPagando(cuotaId);
    setError("");
    try {
      const resp = await fetch("/api/portal-alumno", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alumnoId, cuotaId }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "No se pudo generar el link");
      window.location.href = data.initPoint;
    } catch (err) {
      setError(err.message);
      setPagando(null);
    }
  }

  return (
    <div className="login-screen">
      <div className="login-card" style={{ width: 460 }}>
        {!resultados && (
          <form onSubmit={handleBuscar}>
            <div className="field">
              <label>DNI, celular o nombre y apellido</label>
              <input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Ej: 30123456, 3411234567 o Juan Pérez"
                required
                autoFocus
              />
            </div>
            {error && <div className="error-text">{error}</div>}
            <button
              className="btn btn-primary"
              type="submit"
              disabled={buscando}
              style={{ width: "100%", justifyContent: "center" }}
            >
              {buscando ? "Buscando…" : "Buscar"}
            </button>
          </form>
        )}

        {resultados && (
          <div>
            {error && <div className="error-text" style={{ marginBottom: 12 }}>{error}</div>}
            {resultados.map(({ alumno, colegio, cuotas }) => (
              <div key={alumno.id} style={{ marginBottom: 20 }}>
                <h3 style={{ fontSize: 16, marginBottom: 2 }}>
                  {alumno.apellido}, {alumno.nombre}
                  {alumno.apodo && <span style={{ color: "var(--slate)" }}> "{alumno.apodo}"</span>}
                </h3>
                <div style={{ fontSize: 12, color: "var(--slate)" }}>{colegio?.nombre}</div>
                {(alumno.prendaSuperior || alumno.prendaAbrigo || alumno.extrasResumen?.length > 0) && (
                  <div style={{ fontSize: 12, color: "var(--gold)", marginBottom: 8 }}>
                    {[alumno.prendaSuperior, alumno.prendaAbrigo, ...(alumno.extrasResumen || [])]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                )}
                {!(alumno.prendaSuperior || alumno.prendaAbrigo || alumno.extrasResumen?.length > 0) && (
                  <div style={{ marginBottom: 8 }} />
                )}

                {cuotas.map((c) => {
                  const label = c.esExtra ? c.descripcion : c.esSena ? "Seña" : `Cuota ${c.numero}`;
                  return (
                    <div
                      key={c.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "8px 0",
                        borderBottom: "1px solid var(--line)",
                        fontSize: 14,
                      }}
                    >
                      <div>
                        <div>{label}</div>
                        <div style={{ fontSize: 12, color: "var(--slate)" }}>
                          ${Number(c.monto).toLocaleString("es-AR")}
                          {c.fechaVencimiento && ` · vence ${formatFecha(c.fechaVencimiento)}`}
                          {c.vencida && <span style={{ color: "var(--rust)" }}> · vencida</span>}
                        </div>
                      </div>
                      {c.estado === "pagada" ? (
                        <span className="badge badge-green">Pagada</span>
                      ) : (
                        <button
                          className="btn btn-gold btn-sm"
                          disabled={pagando === c.id}
                          onClick={() => handlePagar(alumno.id, c.id)}
                        >
                          {pagando === c.id ? "Generando…" : "Pagar ahora"}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setResultados(null);
                setBusqueda("");
              }}
            >
              Buscar de nuevo
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
