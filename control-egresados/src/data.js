import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  writeBatch,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebase";

/* ---------- Colegios ---------- */

export async function listColegios() {
  const q = query(collection(db, "colegios"), orderBy("nombre"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getColegio(colegioId) {
  const snap = await getDoc(doc(db, "colegios", colegioId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function crearColegio({
  nombre,
  cantidadCuotas,
  montoCuota,
  montoSena,
  fechaEntrega,
  imagenUrl,
  fechaPrimerVencimiento,
  frecuenciaDias,
  recargoPorcentaje,
}) {
  return addDoc(collection(db, "colegios"), {
    nombre,
    cantidadCuotas: Number(cantidadCuotas),
    montoCuota: Number(montoCuota),
    montoSena: Number(montoSena) || 0,
    fechaEntrega: fechaEntrega || "",
    imagenUrl: imagenUrl || "",
    fechaPrimerVencimiento: fechaPrimerVencimiento || "",
    frecuenciaDias: Number(frecuenciaDias) || 30,
    recargoPorcentaje: Number(recargoPorcentaje) || 0,
    createdAt: serverTimestamp(),
  });
}

export async function actualizarColegio(colegioId, data) {
  return updateDoc(doc(db, "colegios", colegioId), data);
}

export async function eliminarColegio(colegioId) {
  return deleteDoc(doc(db, "colegios", colegioId));
}

/* ---------- Alumnos ---------- */

export async function listAlumnos(colegioId) {
  const q = query(
    collection(db, "alumnos"),
    where("colegioId", "==", colegioId),
    orderBy("apellido")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getAlumno(alumnoId) {
  const snap = await getDoc(doc(db, "alumnos", alumnoId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

// Crea el alumno y genera automáticamente sus cuotas según el plan del colegio
export async function crearAlumno({ colegioId, nombre, apellido, apodo, dni, telefono, prendaSuperior, prendaAbrigo, talleSuperior, talleAbrigo }, colegio) {
  const alumnoRef = await addDoc(collection(db, "alumnos"), {
    colegioId,
    nombre,
    apellido,
    apodo: apodo || "",
    dni: dni || "",
    telefono: telefono || "",
    prendaSuperior: prendaSuperior || "",
    prendaAbrigo: prendaAbrigo || "",
    talleSuperior: talleSuperior || "",
    talleAbrigo: talleAbrigo || "",
    createdAt: serverTimestamp(),
  });

  const batch = writeBatch(db);

  // La seña se guarda como un ítem especial (numero 0) para que aparezca
  // primero y se pueda cobrar y marcar igual que una cuota.
  if (colegio.montoSena > 0) {
    const senaRef = doc(collection(db, "cuotas"));
    batch.set(senaRef, {
      alumnoId: alumnoRef.id,
      colegioId,
      numero: 0,
      esSena: true,
      monto: colegio.montoSena,
      estado: "pendiente",
      metodoPago: null,
      mpPreferenceId: null,
      mpInitPoint: null,
      fechaPago: null,
      createdAt: serverTimestamp(),
    });
  }

  for (let i = 1; i <= colegio.cantidadCuotas; i++) {
    const cuotaRef = doc(collection(db, "cuotas"));
    batch.set(cuotaRef, {
      alumnoId: alumnoRef.id,
      colegioId,
      numero: i,
      esSena: false,
      monto: colegio.montoCuota,
      fechaVencimiento: calcularVencimiento(colegio, i),
      estado: "pendiente", // pendiente | pagada
      metodoPago: null, // "mercadopago" | "manual"
      mpPreferenceId: null,
      mpInitPoint: null,
      fechaPago: null,
      createdAt: serverTimestamp(),
    });
  }
  await batch.commit();

  return alumnoRef;
}

// Calcula la fecha de vencimiento de la cuota N a partir de la fecha del
// primer vencimiento y la frecuencia (en días) configuradas en el colegio.
function calcularVencimiento(colegio, numeroCuota) {
  if (!colegio.fechaPrimerVencimiento) return "";
  const base = new Date(colegio.fechaPrimerVencimiento + "T00:00:00");
  const frecuencia = colegio.frecuenciaDias || 30;
  base.setDate(base.getDate() + frecuencia * (numeroCuota - 1));
  return base.toISOString().slice(0, 10);
}

export function formatFechaAR(fechaISO) {
  if (!fechaISO) return "";
  const [y, m, d] = fechaISO.split("-");
  return `${d}/${m}/${y}`;
}

export function esCuotaVencida(cuota) {
  if (cuota.estado === "pagada" || !cuota.fechaVencimiento) return false;
  const hoy = new Date().toISOString().slice(0, 10);
  return cuota.fechaVencimiento < hoy;
}

export function montoConRecargo(cuota, colegio) {
  if (!esCuotaVencida(cuota)) return cuota.monto;
  const recargo = colegio?.recargoPorcentaje || 0;
  return Math.round(cuota.monto * (1 + recargo / 100));
}

export async function actualizarAlumno(alumnoId, data) {
  return updateDoc(doc(db, "alumnos", alumnoId), data);
}

export async function eliminarAlumno(alumnoId) {
  // Borra alumno + sus cuotas
  const cuotas = await listCuotasAlumno(alumnoId);
  const batch = writeBatch(db);
  cuotas.forEach((c) => batch.delete(doc(db, "cuotas", c.id)));
  batch.delete(doc(db, "alumnos", alumnoId));
  await batch.commit();
}

/* ---------- Cuotas ---------- */

export async function listCuotasAlumno(alumnoId) {
  const q = query(
    collection(db, "cuotas"),
    where("alumnoId", "==", alumnoId),
    orderBy("numero")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function marcarCuotaPagaManual(cuotaId) {
  return updateDoc(doc(db, "cuotas", cuotaId), {
    estado: "pagada",
    metodoPago: "manual",
    fechaPago: serverTimestamp(),
  });
}

export async function desmarcarCuota(cuotaId) {
  return updateDoc(doc(db, "cuotas", cuotaId), {
    estado: "pendiente",
    metodoPago: null,
    fechaPago: null,
  });
}

export function resumenDeuda(cuotas, colegio) {
  let total = 0;
  let pagado = 0;
  const pagadas = cuotas.filter((c) => c.estado === "pagada");

  cuotas.forEach((c) => {
    if (c.estado === "pagada") {
      total += c.monto;
      pagado += c.monto;
    } else {
      total += montoConRecargo(c, colegio);
    }
  });

  return {
    total,
    pagado,
    saldo: total - pagado,
    cuotasPagas: pagadas.length,
    cuotasTotales: cuotas.length,
  };
}
