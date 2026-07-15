import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "./firebase";

const crearPreferenceFn = httpsCallable(functions, "crearPreferenceMP");

// Pide al backend que genere el cupón de pago (preference) de Mercado Pago
// para una cuota puntual, y guarda el link generado en Firestore.
export async function generarCuponCuota(cuota, alumno, colegio) {
  const detalle = cuota.esSena ? "Seña" : `Cuota ${cuota.numero}/${colegio.cantidadCuotas}`;
  const { data } = await crearPreferenceFn({
    cuotaId: cuota.id,
    alumnoId: alumno.id,
    titulo: `${colegio.nombre} - ${alumno.apellido} ${alumno.nombre} - ${detalle}`,
    monto: cuota.monto,
  });

  await updateDoc(doc(db, "cuotas", cuota.id), {
    mpPreferenceId: data.preferenceId,
    mpInitPoint: data.initPoint,
  });

  return data.initPoint;
}
