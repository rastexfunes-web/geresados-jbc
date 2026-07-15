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

export async function crearColegio({ nombre, cantidadCuotas, montoCuota, montoSena }) {
  return addDoc(collection(db, "colegios"), {
    nombre,
    cantidadCuotas: Number(cantidadCuotas),
    montoCuota: Number(montoCuota),
    montoSena: Number(montoSena) || 0,
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
export async function crearAlumno({ colegioId, nombre, apellido, apodo, dni, telefono, prendaSuperior, prendaAbrigo }, colegio) {
  const alumnoRef = await addDoc(collection(db, "alumnos"), {
    colegioId,
    nombre,
    apellido,
    apodo: apodo || "",
    dni: dni || "",
    telefono: telefono || "",
    prendaSuperior: prendaSuperior || "",
    prendaAbrigo: prendaAbrigo || "",
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

export function resumenDeuda(cuotas) {
  const total = cuotas.reduce((acc, c) => acc + c.monto, 0);
  const pagadas = cuotas.filter((c) => c.estado === "pagada");
  const pagado = pagadas.reduce((acc, c) => acc + c.monto, 0);
  return {
    total,
    pagado,
    saldo: total - pagado,
    cuotasPagas: pagadas.length,
    cuotasTotales: cuotas.length,
  };
}
