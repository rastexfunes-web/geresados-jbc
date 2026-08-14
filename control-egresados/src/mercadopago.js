import { doc, updateDoc } from "firebase/firestore";
import { db } from "./firebase";
import { montoConRecargo } from "./data";

// Pide a la función de Vercel que genere el cupón de pago (preference) de
// Mercado Pago para una cuota puntual, y guarda el link generado en Firestore.
export async function generarCuponCuota(cuota, alumno, colegio) {
  const detalle = cuota.esExtra
    ? cuota.descripcion
    : cuota.esSena
    ? "Seña"
    : `Cuota ${cuota.numero} / ${colegio.cantidadCuotas}`;
  const monto = montoConRecargo(cuota, colegio);
  const resp = await fetch("/api/crear-preference", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      cuotaId: cuota.id,
      alumnoId: alumno.id,
      colegioId: colegio.id,
      titulo: `JBC Egresados - ${colegio.nombre} - ${alumno.apellido} ${alumno.nombre} - ${detalle}`,
      monto,
    }),
  });

  if (!resp.ok) {
    throw new Error("No se pudo generar el cupón de pago");
  }

  const data = await resp.json();

  await updateDoc(doc(db, "cuotas", cuota.id), {
    mpPreferenceId: data.preferenceId,
    mpInitPoint: data.initPoint,
  });

  return data.initPoint;
}
