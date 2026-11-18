// Facturación electrónica (ARCA) de los cobros de egresados. La factura la
// emite una función de Rastex Gestión (mismo CUIT, punto de venta y
// certificado); acá solo se la llama con el usuario logueado y se guarda el
// resultado en la cuota.
import { doc, updateDoc } from "firebase/firestore";
import { auth, db } from "./firebase";

const URL_FUNCION = "https://us-central1-pos-rastex.cloudfunctions.net/facturarEgresado";

async function llamar(body) {
  const user = auth.currentUser;
  if (!user) throw new Error("Tenés que iniciar sesión para facturar");
  const token = await user.getIdToken();
  const resp = await fetch(URL_FUNCION, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(data.error || "No se pudo facturar");
  return data;
}

export function numeroFactura(f) {
  return `${String(f.puntoVenta).padStart(4, "0")}-${String(f.numero).padStart(8, "0")}`;
}

export function descripcionCuota(cuota, alumno) {
  const que = cuota.esSena ? "Seña" : cuota.esExtra ? cuota.descripcion || "Extra" : `Cuota ${cuota.numero}`;
  return `Conjunto egresado de ${alumno.nombre} ${alumno.apellido} - ${que}`;
}

// Emite la factura y la deja guardada en la cuota (cuota.factura). Si esa
// cuota ya tenía factura en ARCA, devuelve la misma sin emitir otra.
export async function emitirFactura({ cuota, alumno, monto }) {
  const data = await llamar({
    accion: "emitir",
    cuotaId: cuota.id,
    monto,
    descripcion: descripcionCuota(cuota, alumno),
  });
  const f = data.factura;
  const resumen = {
    cae: f.cae,
    caeVencimiento: f.caeVencimiento,
    numero: f.numero,
    puntoVenta: f.puntoVenta,
    tipoComprobante: f.tipoComprobante,
    fecha: f.fecha,
    total: f.total,
  };
  await updateDoc(doc(db, "cuotas", cuota.id), { factura: resumen });
  return resumen;
}

// Abre el PDF oficial de la factura en otra pestaña. Se abre la pestaña antes
// de esperar a la función para que el navegador no la bloquee.
export async function abrirPdfFactura(cuotaId) {
  const ventana = window.open("", "_blank");
  try {
    const data = await llamar({ accion: "pdf", cuotaId });
    if (ventana) ventana.location.href = data.url;
    else window.location.href = data.url;
  } catch (err) {
    if (ventana) ventana.close();
    throw err;
  }
}

// Trae de Mercado Pago quién pagó la cuota (DNI, nombre, monto).
export async function traerDatosPagoMP(cuotaId) {
  const user = auth.currentUser;
  if (!user) throw new Error("Tenés que iniciar sesión");
  const token = await user.getIdToken();
  const resp = await fetch("/api/datos-pago", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ cuotaId }),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(data.error || `No se pudieron traer los datos (error ${resp.status})`);
  return data;
}
