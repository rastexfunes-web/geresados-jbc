import { useState } from "react";

export default function Portal() {
  const [dni, setDni] = useState("");
  const [resultados, setResultados] = useState(null);
  const [error, setError] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [pagando, setPagando] = useState(null);

  async function handleBuscar(e) {
    e.preventDefault();
    setError("");
    setBuscando(true);
    setResultados(null);
    try {
      const resp = await fetch(`/api/portal-alumno?dni=${encodeURIComponent(dni.trim())}`);
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "No encontramos ese DNI");
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
        body: JSON.stringify({ dni: dni.trim(), alumnoId, cuotaId }),
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
        <div className="mark">
          <span className="seal" /> Egresados
        </div>
        <div className="sub">Consultá y pagá tus cuotas con tu DNI</div>

        {!resultados && (
          <form onSubmit={handleBuscar}>
            <div className="field">
              <label>DNI (sin puntos)</label>
              <input
                value={dni}
                onChange={(e) => setDni(e.target.value)}
                placeholder="Ej: 30123456"
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
                <div style={{ fontSize: 12, color: "var(--slate)", marginBottom: 8 }}>{colegio?.nombre}</div>

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
                setDni("");
              }}
            >
              Buscar otro DNI
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
