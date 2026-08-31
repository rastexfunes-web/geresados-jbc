import { useState } from "react";

function formatFecha(fechaISO) {
  if (!fechaISO) return "";
  const [y, m, d] = fechaISO.split("-");
  return `${d}/${m}/${y}`;
}

function IconoPersona() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  );
}

function IconoBuscar() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function IconoEscudo() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2 4 5v6c0 5 3.4 8.7 8 11 4.6-2.3 8-6 8-11V5l-8-3Z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

function EscudoJBC() {
  return (
    <svg className="shield" width="52" height="58" viewBox="0 0 52 58" fill="none">
      <path
        d="M26 2 4 9v14c0 15 9.5 25.6 22 33 12.5-7.4 22-18 22-33V9L26 2Z"
        fill="#17233F"
        stroke="#F3EEE1"
        strokeWidth="1.5"
        strokeDasharray="2 2"
      />
      <text x="26" y="30" textAnchor="middle" fontFamily="Bevan, serif" fontSize="14" fill="#F3EEE1">
        JBC
      </text>
      <text x="26" y="42" textAnchor="middle" fontFamily="Oswald, sans-serif" fontSize="5.5" letterSpacing="1" fill="#5E90C4">
        EGRESADOS
      </text>
    </svg>
  );
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
    <div className="portal-screen">
      <div className="portal-chevron">
        <div className="jbc-word">JBC</div>
        <div className="jbc-sub">EGRESADOS</div>
        <div className="jbc-est">EST. 2024</div>
        <div className="jbc-star">★</div>
      </div>

      <div className="portal-body">
        <div className="portal-card">
          {!resultados && (
            <>
              <div className="portal-eyebrow">BIENVENIDOS AL</div>
              <h1 className="portal-titulo">PORTAL DE PAGOS</h1>
              <div className="portal-ribbon">• JBC EGRESADOS •</div>
              <div className="portal-divider">★</div>

              <form onSubmit={handleBuscar}>
                <div className="portal-subtitulo">
                  Ingresá tu DNI, celular o nombre y apellido para buscar tu cuenta
                </div>
                <div className="portal-input-wrap">
                  <div className="portal-input-icon">
                    <IconoPersona />
                  </div>
                  <input
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    placeholder="Ej: 30123456, 3411234567 o Juan"
                    required
                    autoFocus
                  />
                </div>
                {error && <div className="error-text" style={{ marginBottom: 12 }}>{error}</div>}
                <button className="portal-btn-buscar" type="submit" disabled={buscando}>
                  <IconoBuscar /> {buscando ? "Buscando…" : "Buscar"}
                </button>
              </form>

              <div className="portal-info">
                <IconoEscudo />
                <div>
                  Tu información está protegida.
                  <br />
                  Este es un portal seguro de JBC Egresados.
                </div>
              </div>
            </>
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
                    <div style={{ fontSize: 12, color: "var(--varsity-blue-dark)", marginBottom: 8 }}>
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

      <div className="portal-footer">
        <EscudoJBC />
        <div className="portal-footer-tag">
          <span>★ COMPAÑEROS HOY</span>
          <span>AMIGOS SIEMPRE ★</span>
        </div>
      </div>
    </div>
  );
}
