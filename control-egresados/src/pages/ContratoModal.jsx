import { useState } from "react";
import { actualizarColegio } from "../data";
import { contratoHTML, telefonoWhatsapp } from "../contrato";

const hoyISO = () => {
  const ar = new Date(Date.now() - 3 * 60 * 60 * 1000);
  return ar.toISOString().slice(0, 10);
};

export default function ContratoModal({ colegio, alumnos, onClose, onSaved }) {
  const g = colegio.contrato || {};
  const prendas = new Set(
    (alumnos || []).flatMap((a) => [a.prendaSuperior, a.prendaAbrigo]).filter(Boolean).map((p) => p.toLowerCase())
  );
  const totalPlan = (colegio.montoSena || 0) + (colegio.cantidadCuotas || 0) * (colegio.montoCuota || 0);
  const diaPrimerVenc = colegio.fechaPrimerVencimiento
    ? Number(colegio.fechaPrimerVencimiento.split("-")[2])
    : 10;

  const [f, setF] = useState({
    fecha: g.fecha || hoyISO(),
    numeroContrato: g.numeroContrato || "",
    localidad: g.localidad || "",
    curso: g.curso || "",
    cantidadAlumnos: g.cantidadAlumnos ?? (alumnos?.length || ""),
    delegada: g.delegada ?? colegio.nombreDelegada ?? "",
    dniDelegada: g.dniDelegada || "",
    whatsapp: g.whatsapp ?? colegio.telefonoDelegada ?? "",
    campera: g.indumentaria?.campera ?? prendas.has("campera"),
    buzo: g.indumentaria?.buzo ?? prendas.has("buzo"),
    remera: g.indumentaria?.remera ?? prendas.has("remera"),
    chomba: g.indumentaria?.chomba ?? prendas.has("chomba"),
    pantalon: g.indumentaria?.pantalon ?? false,
    otra: g.indumentaria?.otra || "",
    modelo: g.modelo || "",
    colores: g.colores || "",
    bordados: g.bordados || "",
    precioTotal: g.precioTotal ?? (totalPlan || ""),
    remeraAdicional: g.remeraAdicional ?? (colegio.preciosExtras?.Remera || ""),
    sena: g.sena ?? (colegio.montoSena || ""),
    cuotas: g.cuotas ?? (colegio.cantidadCuotas || ""),
    valorCuota: g.valorCuota ?? (colegio.montoCuota || ""),
    diaVencimiento: g.diaVencimiento ?? diaPrimerVenc,
    recargo: g.recargo ?? (colegio.recargoPorcentaje || 20),
    tomaTalles: g.tomaTalles || "",
    entrega: g.entrega ?? (colegio.fechaEntrega || ""),
    observaciones: g.observaciones || "",
    representante: g.representante ?? "Marcelo Silva",
    dniRepresentante: g.dniRepresentante || "",
  });
  const [guardando, setGuardando] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });

  function datos() {
    return {
      colegio: colegio.nombre,
      ...f,
      indumentaria: {
        campera: f.campera, buzo: f.buzo, remera: f.remera, chomba: f.chomba, pantalon: f.pantalon, otra: f.otra,
      },
    };
  }

  async function guardarDatos() {
    setGuardando(true);
    try {
      const { campera, buzo, remera, chomba, pantalon, otra, ...resto } = f;
      await actualizarColegio(colegio.id, {
        contrato: { ...resto, indumentaria: { campera, buzo, remera, chomba, pantalon, otra } },
      });
      onSaved?.();
    } catch (err) {
      console.error(err);
      alert(`No se pudieron guardar los datos del contrato: ${err.message || err}`);
    } finally {
      setGuardando(false);
    }
  }

  async function handleImprimir() {
    await guardarDatos();
    const ventana = window.open("", "_blank");
    ventana.document.write(contratoHTML(datos()));
    ventana.document.close();
    ventana.focus();
    ventana.print();
  }

  async function handleDescargarWord() {
    await guardarDatos();
    const blob = new Blob(["﻿", contratoHTML(datos())], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Contrato JBC Egresados - ${colegio.nombre}.doc`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleWhatsapp() {
    await guardarDatos();
    const saludo = f.delegada ? `Hola ${f.delegada}!` : "Hola!";
    const mensaje = `${saludo} Te paso el contrato de indumentaria de ${colegio.nombre} (JBC Egresados) para que lo revises y lo firmes. Cualquier duda me avisás.`;
    const tel = telefonoWhatsapp(f.whatsapp);
    const base = tel ? `https://wa.me/${tel}` : "https://wa.me/";
    window.open(`${base}?text=${encodeURIComponent(mensaje)}`, "_blank");
  }

  const campo = (label, k, props = {}) => (
    <div className="field" style={props.style}>
      <label>{label}</label>
      <input value={f[k]} onChange={set(k)} {...props} style={undefined} />
    </div>
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: 620 }} onClick={(e) => e.stopPropagation()}>
        <h2>Contrato — {colegio.nombre}</h2>
        <p style={{ fontSize: 13, color: "var(--slate)", marginTop: -8 }}>
          Ya cargué lo que tiene el colegio. Completá lo que falte; lo que quede vacío queda como línea para llenar a mano.
        </p>

        <div className="form-row">
          {campo("Fecha", "fecha", { type: "date" })}
          {campo("N.º de contrato", "numeroContrato")}
        </div>

        <h3 style={{ fontSize: 14, margin: "14px 0 6px" }}>Datos del grupo</h3>
        <div className="form-row">
          {campo("Localidad", "localidad")}
          {campo("Curso / división", "curso")}
          {campo("Cant. de alumnos", "cantidadAlumnos")}
        </div>
        <div className="form-row">
          {campo("Delegada/o", "delegada")}
          {campo("DNI delegada/o", "dniDelegada")}
          {campo("WhatsApp", "whatsapp")}
        </div>

        <h3 style={{ fontSize: 14, margin: "14px 0 6px" }}>Indumentaria</h3>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginBottom: 10, fontSize: 14 }}>
          {[["campera", "Campera"], ["buzo", "Buzo"], ["remera", "Remera"], ["chomba", "Chomba"], ["pantalon", "Pantalón"]].map(([k, l]) => (
            <label key={k} style={{ display: "flex", gap: 6, alignItems: "center", cursor: "pointer" }}>
              <input type="checkbox" checked={f[k]} onChange={set(k)} /> {l}
            </label>
          ))}
        </div>
        {campo("Otra prenda", "otra")}
        {campo("Modelo / descripción", "modelo")}
        {campo("Colores", "colores")}
        {campo("Bordados / estampados / personalizaciones", "bordados")}
        <div className="form-row">
          {campo("Precio total por alumno ($)", "precioTotal", { type: "number" })}
          {campo("Remera adicional ($)", "remeraAdicional", { type: "number" })}
        </div>

        <h3 style={{ fontSize: 14, margin: "14px 0 6px" }}>Precio y forma de pago</h3>
        <div className="form-row">
          {campo("Seña ($)", "sena", { type: "number" })}
          {campo("Cantidad de cuotas", "cuotas", { type: "number" })}
          {campo("Valor cuota ($)", "valorCuota", { type: "number" })}
        </div>
        <div className="form-row">
          {campo("Vence hasta el día", "diaVencimiento", { type: "number" })}
          {campo("Recargo (%)", "recargo", { type: "number" })}
        </div>

        <h3 style={{ fontSize: 14, margin: "14px 0 6px" }}>Entrega</h3>
        <div className="form-row">
          {campo("Toma de talles", "tomaTalles", { type: "date" })}
          {campo("Entrega estimada", "entrega", { type: "date" })}
        </div>
        <div className="field">
          <label>Observaciones</label>
          <textarea rows={3} value={f.observaciones} onChange={set("observaciones")} />
        </div>

        <h3 style={{ fontSize: 14, margin: "14px 0 6px" }}>JBC Egresados</h3>
        <div className="form-row">
          {campo("Representante", "representante")}
          {campo("DNI representante", "dniRepresentante")}
        </div>

        <div className="modal-actions" style={{ flexWrap: "wrap" }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cerrar</button>
          <button type="button" className="btn btn-outline" onClick={handleDescargarWord} disabled={guardando}>
            Descargar Word
          </button>
          <button type="button" className="btn btn-outline" onClick={handleWhatsapp} disabled={guardando}>
            Enviar por WhatsApp
          </button>
          <button type="button" className="btn btn-primary" onClick={handleImprimir} disabled={guardando}>
            Imprimir / PDF
          </button>
        </div>
      </div>
    </div>
  );
}
