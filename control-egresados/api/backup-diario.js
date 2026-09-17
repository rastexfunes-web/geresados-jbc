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
const DIAS_A_CONSERVAR = 5;

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

    // POST { accion: "restaurar", fecha, confirmacion } -> vuelve a escribir
    // en Firestore los datos de ese backup, reemplazando lo que haya ahora
    // en esas 4 colecciones. Es destructivo, por eso pide una confirmación
    // exacta además del método POST.
    if (req.method === "POST" && req.body?.accion === "restaurar") {
      if (req.body.confirmacion !== "RESTAURAR") {
        res.status(400).json({ error: "Falta la confirmación exacta para restaurar" });
        return;
      }
      const fechaBackup = String(req.body.fecha || "");
      const snap = await db.collection("backups").doc(fechaBackup).get();
      if (!snap.exists) {
        res.status(404).json({ error: "No existe un backup con esa fecha" });
        return;
      }
      const backup = snap.data();

      // Antes de pisar nada, guardamos un backup del estado ACTUAL (por si
      // la restauración fue un error, poder volver atrás).
      const fechaPreRestauracion = `pre-restauracion-${new Date().toISOString().replace(/[:.]/g, "-")}`;
      const datosActuales = {};
      for (const coleccion of COLECCIONES) {
        const actualSnap = await db.collection(coleccion).get();
        datosActuales[coleccion] = actualSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      }
      await db.collection("backups").doc(fechaPreRestauracion).set({
        fecha: fechaPreRestauracion,
        creadoEn: new Date().toISOString(),
        resumen: Object.fromEntries(COLECCIONES.map((c) => [c, datosActuales[c].length])),
        datos: datosActuales,
      });

      // Borramos lo que hay actualmente en cada colección y volvemos a
      // escribir lo que dice el backup elegido. Los batches de Firestore
      // admiten hasta 500 operaciones, así que vamos de a tandas.
      function enTandas(arr, tam) {
        const tandas = [];
        for (let i = 0; i < arr.length; i += tam) tandas.push(arr.slice(i, i + tam));
        return tandas;
      }

      let restaurados = 0;
      for (const coleccion of COLECCIONES) {
        const actualSnap = await db.collection(coleccion).get();
        for (const tanda of enTandas(actualSnap.docs, 450)) {
          const batchBorrar = db.batch();
          tanda.forEach((d) => batchBorrar.delete(d.ref));
          await batchBorrar.commit();
        }

        const documentos = backup.datos?.[coleccion] || [];
        for (const tanda of enTandas(documentos, 450)) {
          const batchEscribir = db.batch();
          tanda.forEach((doc) => {
            const { id, ...resto } = doc;
            batchEscribir.set(db.collection(coleccion).doc(id), resto);
          });
          await batchEscribir.commit();
        }
        restaurados += documentos.length;
      }

      res.status(200).json({ ok: true, restaurados, backupDePreRestauracion: fechaPreRestauracion });
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
