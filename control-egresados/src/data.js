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
  arrayUnion,
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
  telefonoDelegada,
  nombreDelegada,
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
    telefonoDelegada: telefonoDelegada || "",
    nombreDelegada: nombreDelegada || "",
    createdAt: serverTimestamp(),
  });
}

export async function actualizarColegio(colegioId, data) {
  return updateDoc(doc(db, "colegios", colegioId), data);
}

// Aplica un monto de cuota y/o de seña nuevo a las cuotas y señas que
// todavía estén PENDIENTES de todos los alumnos de un colegio (no toca las
// ya pagadas, ni los extras, ni los alumnos que tengan un precio
// personalizado cargado a propósito). Si una cuota ya tenía un extra
// repartido sumado, se le respeta esa parte y solo se actualiza el monto
// base del plan.
export async function actualizarCuotasPendientesColegio(colegioId, { nuevoMontoCuota, nuevoMontoSena }) {
  const alumnosSnap = await getDocs(query(collection(db, "alumnos"), where("colegioId", "==", colegioId)));
  const idsConPrecioPersonalizado = new Set();
  const extraAgregadoPorCuota = {};
  alumnosSnap.forEach((d) => {
    const a = d.data();
    if (a.precioPersonalizado) idsConPrecioPersonalizado.add(d.id);
    (a.extras || []).forEach((ex) => {
      (ex.cuotasAfectadas || []).forEach((ca) => {
        extraAgregadoPorCuota[ca.id] = (extraAgregadoPorCuota[ca.id] || 0) + ca.montoAgregado;
      });
    });
  });

  const cuotasSnap = await getDocs(query(collection(db, "cuotas"), where("colegioId", "==", colegioId)));
  const batch = writeBatch(db);
  cuotasSnap.forEach((d) => {
    const c = d.data();
    if (c.estado === "pagada" || c.esExtra) return;
    if (idsConPrecioPersonalizado.has(c.alumnoId)) return;
    const base = c.esSena ? nuevoMontoSena : nuevoMontoCuota;
    if (base === undefined || base === null || Number.isNaN(base)) return;
    const extra = extraAgregadoPorCuota[d.id] || 0;
    batch.update(doc(db, "cuotas", d.id), {
      monto: Math.round((base + extra) * 100) / 100,
      mpPreferenceId: null,
      mpInitPoint: null,
    });
  });
  await batch.commit();
}

// Ajusta la CANTIDAD de cuotas de los alumnos ya cargados de un colegio a
// la nueva cantidad configurada: agrega las cuotas que falten (con el monto
// y vencimiento correspondientes) o quita las que sobren, siempre que
// todavía estén pendientes (nunca borra una cuota ya pagada). No toca a los
// alumnos con precio personalizado.
export async function actualizarCantidadCuotasColegio(colegioId, colegio) {
  const alumnosSnap = await getDocs(query(collection(db, "alumnos"), where("colegioId", "==", colegioId)));
  const cuotasSnap = await getDocs(query(collection(db, "cuotas"), where("colegioId", "==", colegioId)));

  const cuotasPorAlumno = {};
  cuotasSnap.forEach((d) => {
    const c = d.data();
    if (c.esSena || c.esExtra) return;
    if (!cuotasPorAlumno[c.alumnoId]) cuotasPorAlumno[c.alumnoId] = [];
    cuotasPorAlumno[c.alumnoId].push({ id: d.id, ...c });
  });

  const batch = writeBatch(db);
  let agregadas = 0;
  let quitadas = 0;

  alumnosSnap.forEach((d) => {
    const alumno = d.data();
    if (alumno.precioPersonalizado) return;
    const alumnoId = d.id;
    const cuotasActuales = cuotasPorAlumno[alumnoId] || [];
    const cantidadActual = cuotasActuales.length;
    const cantidadNueva = colegio.cantidadCuotas;

    if (cantidadNueva > cantidadActual) {
      for (let i = cantidadActual + 1; i <= cantidadNueva; i++) {
        const cuotaRef = doc(collection(db, "cuotas"));
        batch.set(cuotaRef, {
          alumnoId,
          colegioId,
          numero: i,
          esSena: false,
          esExtra: false,
          monto: colegio.montoCuota,
          fechaVencimiento: calcularVencimiento(colegio, i),
          estado: "pendiente",
          metodoPago: null,
          mpPreferenceId: null,
          mpInitPoint: null,
          fechaPago: null,
          createdAt: serverTimestamp(),
        });
        agregadas++;
      }
    } else if (cantidadNueva < cantidadActual) {
      cuotasActuales
        .filter((c) => c.numero > cantidadNueva && c.estado !== "pagada")
        .forEach((c) => {
          batch.delete(doc(db, "cuotas", c.id));
          quitadas++;
        });
    }
  });

  await batch.commit();
  return { agregadas, quitadas };
}

export async function eliminarColegio(colegioId) {
  const alumnos = await listAlumnos(colegioId);
  for (const a of alumnos) {
    await eliminarAlumno(a.id);
  }
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
// Crea el alumno y genera automáticamente sus cuotas según el plan del colegio.
// Si el alumno tiene un plan reducido (ej: solo remera, sin buzo/campera),
// se le puede pasar montoCuotaPersonalizado y/o montoSenaPersonalizado para
// cobrarle un monto distinto al estándar del colegio.
export async function crearAlumno(
  {
    colegioId,
    nombre,
    apellido,
    apodo,
    dni,
    telefono,
    prendaSuperior,
    prendaAbrigo,
    talleSuperior,
    talleAbrigo,
    montoCuotaPersonalizado,
    montoSenaPersonalizado,
  },
  colegio
) {
  const tienePrecioPersonalizado =
    (montoCuotaPersonalizado !== undefined && montoCuotaPersonalizado !== "") ||
    (montoSenaPersonalizado !== undefined && montoSenaPersonalizado !== "");

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
    precioPersonalizado: tienePrecioPersonalizado,
    createdAt: serverTimestamp(),
  });

  const montoCuota =
    montoCuotaPersonalizado !== undefined && montoCuotaPersonalizado !== ""
      ? Number(montoCuotaPersonalizado)
      : colegio.montoCuota;
  const montoSena =
    montoSenaPersonalizado !== undefined && montoSenaPersonalizado !== ""
      ? Number(montoSenaPersonalizado)
      : colegio.montoSena || 0;

  const batch = writeBatch(db);

  // La seña se guarda como un ítem especial (numero 0) para que aparezca
  // primero y se pueda cobrar y marcar igual que una cuota.
  if (montoSena > 0) {
    const senaRef = doc(collection(db, "cuotas"));
    batch.set(senaRef, {
      alumnoId: alumnoRef.id,
      colegioId,
      numero: 0,
      esSena: true,
      monto: montoSena,
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
      monto: montoCuota,
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

/* ---------- Trabajos para empresas ---------- */

export async function listTrabajos() {
  const q = query(collection(db, "trabajos"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getTrabajo(trabajoId) {
  const snap = await getDoc(doc(db, "trabajos", trabajoId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

// productos: [{ nombre, cantidad, precioUnitario, talles: [{ talle, cantidad }] }]
export async function crearTrabajo({ empresa, formaPago, montoSena, productos }) {
  const productosLimpios = productos.map((p) => {
    const talles = (p.talles || [])
      .filter((t) => t.talle)
      .map((t) => ({ talle: t.talle, cantidad: Number(t.cantidad) || 0 }));
    const cantidad = talles.reduce((acc, t) => acc + t.cantidad, 0);
    return {
      nombre: p.nombre,
      color: p.color || "",
      cantidad,
      precioUnitario: Number(p.precioUnitario) || 0,
      talles,
    };
  });

  const total = productosLimpios.reduce((acc, p) => acc + p.cantidad * p.precioUnitario, 0);

  return addDoc(collection(db, "trabajos"), {
    empresa,
    formaPago: formaPago || "",
    productos: productosLimpios,
    total,
    montoSena: Number(montoSena) || 0,
    senaPagada: false,
    saldoPagado: false,
    createdAt: serverTimestamp(),
  });
}

export async function actualizarTrabajo(trabajoId, data) {
  return updateDoc(doc(db, "trabajos", trabajoId), data);
}

export async function marcarSenaPagada(trabajoId, pagada) {
  return updateDoc(doc(db, "trabajos", trabajoId), { senaPagada: pagada });
}

export async function marcarSaldoPagado(trabajoId, pagado) {
  return updateDoc(doc(db, "trabajos", trabajoId), { saldoPagado: pagado });
}

export async function eliminarTrabajo(trabajoId) {
  return deleteDoc(doc(db, "trabajos", trabajoId));
}

/* ---------- Contable (vista global) ---------- */

// Una cuota sin fecha de vencimiento asignada (ej. alumnos viejos, o la
// seña) se considera ya devengada, para no perderla de la contabilidad.
export function cuotaYaDevengada(cuota) {
  if (!cuota.fechaVencimiento) return true;
  const hoy = new Date().toISOString().slice(0, 10);
  return cuota.fechaVencimiento <= hoy;
}

export async function listTodosLosAlumnos() {
  const snap = await getDocs(collection(db, "alumnos"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function listTodasLasCuotas() {
  const snap = await getDocs(collection(db, "cuotas"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// Agrega un cobro extra (ej: remera de más, un agregado con emoji, etc.)
// que se suma como un ítem más a pagar, aparte del plan de cuotas.
export async function agregarExtraAlumno({ alumnoId, colegioId, descripcion, monto, numero, talle }) {
  return addDoc(collection(db, "cuotas"), {
    alumnoId,
    colegioId,
    numero,
    esSena: false,
    esExtra: true,
    descripcion: descripcion || "Extra",
    talle: talle || "",
    monto: Number(monto) || 0,
    fechaVencimiento: "",
    estado: "pendiente",
    metodoPago: null,
    mpPreferenceId: null,
    mpInitPoint: null,
    fechaPago: null,
    createdAt: serverTimestamp(),
  });
}

// Reparte un monto extra (ej: remera de más, agregado con emoji) entre las
// cuotas todavía pendientes del alumno, sumándoselo a cada una en partes
// iguales, en vez de crear un cobro aparte. Las cuotas afectadas pierden su
// cupón de Mercado Pago ya generado (si tenían), porque el monto cambió y
// hay que generar uno nuevo.
export async function repartirExtraEnCuotas({ alumnoId, descripcion, montoTotal, cuotasPendientes, talle }) {
  if (!cuotasPendientes.length) {
    throw new Error("No hay cuotas pendientes para repartir el extra.");
  }
  const cantidad = cuotasPendientes.length;
  const base = Math.floor((montoTotal / cantidad) * 100) / 100;

  const batch = writeBatch(db);
  const cuotasAfectadas = [];
  cuotasPendientes.forEach((c, i) => {
    const esUltima = i === cantidad - 1;
    // La última cuota absorbe el resto del redondeo, para que sume exacto.
    const montoAgregado = Math.round((esUltima ? montoTotal - base * (cantidad - 1) : base) * 100) / 100;
    batch.update(doc(db, "cuotas", c.id), {
      monto: Math.round((c.monto + montoAgregado) * 100) / 100,
      mpPreferenceId: null,
      mpInitPoint: null,
    });
    cuotasAfectadas.push({ id: c.id, montoAgregado });
  });

  batch.update(doc(db, "alumnos", alumnoId), {
    extras: arrayUnion({
      descripcion,
      talle: talle || "",
      monto: montoTotal,
      repartidoEnCuotas: cantidad,
      cuotasAfectadas,
      fecha: new Date().toISOString(),
    }),
  });

  await batch.commit();
}

// Edita el talle de un extra ya cargado que se repartió entre cuotas (vive
// dentro del array "extras" del alumno, así que hay que reescribir el
// array completo con ese ítem corregido).
export async function editarTalleExtraRepartido(alumnoId, extrasActuales, indice, nuevoTalle) {
  const nuevosExtras = extrasActuales.map((ex, i) =>
    i === indice ? { ...ex, talle: nuevoTalle } : ex
  );
  return updateDoc(doc(db, "alumnos", alumnoId), { extras: nuevosExtras });
}

// Edita el talle de un extra que quedó como cobro aparte (vive como su
// propia cuota en la colección "cuotas").
export async function editarTalleCuotaExtra(cuotaId, nuevoTalle) {
  return updateDoc(doc(db, "cuotas", cuotaId), { talle: nuevoTalle });
}

// Elimina un extra que se había repartido entre cuotas: le resta el monto
// que le había sumado a cada cuota afectada (solo si esa cuota todavía no
// está pagada, para no descuadrar plata ya cobrada) y lo saca del historial.
// "cuotasAlumno" son las cuotas actuales del alumno (ya cargadas en pantalla),
// usadas como respaldo para extras viejos que no guardaron el detalle de
// qué cuotas afectaron.
export async function eliminarExtraRepartido(alumnoId, extrasActuales, indice, cuotasAlumno) {
  const extra = extrasActuales[indice];
  const batch = writeBatch(db);

  if (extra.cuotasAfectadas?.length) {
    for (const ca of extra.cuotasAfectadas) {
      const snap = await getDoc(doc(db, "cuotas", ca.id));
      if (snap.exists() && snap.data().estado !== "pagada") {
        const montoActual = snap.data().monto;
        batch.update(doc(db, "cuotas", ca.id), {
          monto: Math.max(0, Math.round((montoActual - ca.montoAgregado) * 100) / 100),
          mpPreferenceId: null,
          mpInitPoint: null,
        });
      }
    }
  } else {
    // Extra viejo (cargado antes de que guardáramos qué cuotas afectó):
    // aproximamos repartiendo la resta en partes iguales entre las cuotas
    // que hoy están pendientes, igual que se hizo al repartirlo.
    const pendientes = (cuotasAlumno || []).filter(
      (c) => !c.esSena && !c.esExtra && c.estado !== "pagada"
    );
    if (pendientes.length > 0) {
      const cantidad = pendientes.length;
      const base = Math.floor((extra.monto / cantidad) * 100) / 100;
      pendientes.forEach((c, i) => {
        const esUltima = i === cantidad - 1;
        const montoARestar = Math.round((esUltima ? extra.monto - base * (cantidad - 1) : base) * 100) / 100;
        batch.update(doc(db, "cuotas", c.id), {
          monto: Math.max(0, Math.round((c.monto - montoARestar) * 100) / 100),
          mpPreferenceId: null,
          mpInitPoint: null,
        });
      });
    }
  }

  const nuevosExtras = extrasActuales.filter((_, i) => i !== indice);
  batch.update(doc(db, "alumnos", alumnoId), { extras: nuevosExtras });
  await batch.commit();
}

// Elimina un extra que había quedado como cobro aparte (su propia cuota).
export async function eliminarCuotaExtra(cuotaId) {
  return deleteDoc(doc(db, "cuotas", cuotaId));
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
