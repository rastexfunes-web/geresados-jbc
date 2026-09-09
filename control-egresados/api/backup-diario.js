import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

function getDb() {
  if (getApps().length === 0) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (!raw) {
      throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY no está definida");
    }
    const parsed = JSON.parse(raw);
    initializeApp({ credential: cert(parsed) });
  }
  return getFirestore();
}

const COLECCIONES = ["colegios", "alumnos", "cuotas", "trabajos"];
const DIAS_A_CONSERVAR = 30;

export default async function handler(req, res) {
  try {
    const db = getDb();

    // GET ?listar=1 -> lista los backups disponibles (sin los datos completos).
    if (req.method === "GET" && req.query.listar) {
      const snap = await db.collection("backups").orderBy("fecha", "desc").limit(30).get();
      const lista = snap.docs.map((d) => {
        const data = d.data();
        return { fecha: data.fecha, creadoEn: data.creadoEn, resumen: data.resumen };
      });
      res.status(200).json({ backups: lista });
      return;
    }

    // GET ?descargar=YYYY-MM-DD -> devuelve ese backup completo.
    if (req.method === "GET" && req.query.descargar) {
      const snap = await db.collection("backups").doc(String(req.query.descargar)).get();
      if (!snap.exists) {
        res.status(404).json({ error: "No existe un backup con esa fecha" });
        return;
      }
      res.status(200).json(snap.data());
      return;
    }

    const fecha = new Date().toISOString().slice(0, 10);

    const datos = {};
    for (const coleccion of COLECCIONES) {
      const snap = await db.collection(coleccion).get();
      datos[coleccion] = snap.docs.map((d) => {
        const raw = d.data();
        // Los Timestamp de Firestore no se pueden guardar tal cual dentro de
        // un campo "datos": los pasamos a texto ISO para que el backup
        // quede como JSON plano.
        const limpio = {};
        Object.entries(raw).forEach(([key, value]) => {
          limpio[key] = value && typeof value.toDate === "function" ? value.toDate().toISOString() : value;
        });
        return { id: d.id, ...limpio };
      });
    }

    const resumen = Object.fromEntries(COLECCIONES.map((c) => [c, datos[c].length]));

    await db.collection("backups").doc(fecha).set({
      fecha,
      creadoEn: new Date().toISOString(),
      resumen,
      datos,
    });

    // Borramos backups más viejos que DIAS_A_CONSERVAR, para no acumular
    // para siempre.
    const backupsSnap = await db.collection("backups").get();
    const limite = new Date();
    limite.setDate(limite.getDate() - DIAS_A_CONSERVAR);
    const borrarPromesas = [];
    backupsSnap.forEach((d) => {
      if (d.id < limite.toISOString().slice(0, 10)) {
        borrarPromesas.push(d.ref.delete());
      }
    });
    await Promise.all(borrarPromesas);

    res.status(200).json({ ok: true, fecha, resumen });
  } catch (err) {
    console.error("Error en backup-diario:", err);
    res.status(500).json({ error: err.message || "No se pudo hacer el backup" });
  }
}
