// Script para purgar datos de Firebase Firestore dejando solo SuperAdmin y Autoservicio
const API_KEY = "AIzaSyD0_dbHio6HBwmUJZnjRT6yg40SVvkHsfA";
const BASE_URL = "https://firestore.googleapis.com/v1/projects/tubodeguitadeconfianza/databases/(default)/documents";

const COLLECTIONS_TO_PURGE = [
  "productos",
  "clientes",
  "ventas",
  "abonos",
  "transacciones",
  "auditorias",
  "eliminaciones",
  "clientesEliminados",
  "canjesPremios",
  "PagosPorVerificar",
  "facturas_compras",
  "kardex_inventario",
  "proveedores",
  "app_state"
];

async function deleteDoc(docPath) {
  const url = `https://firestore.googleapis.com/v1/${docPath}?key=${API_KEY}`;
  const res = await fetch(url, { method: "DELETE" });
  return res.ok;
}

async function purgeCollection(colName) {
  let deletedCount = 0;
  try {
    const res = await fetch(`${BASE_URL}/${colName}?key=${API_KEY}&pageSize=300`);
    if (res.ok) {
      const json = await res.json();
      const docs = json.documents || [];
      for (const d of docs) {
        const ok = await deleteDoc(d.name);
        if (ok) deletedCount++;
      }
    }
  } catch (err) {
    console.error(`Error purging ${colName}:`, err.message);
  }
  return deletedCount;
}

async function purgeUsuariosExceptSuperAdminAndAutoservicio() {
  let deletedCount = 0;
  try {
    const res = await fetch(`${BASE_URL}/usuarios?key=${API_KEY}&pageSize=300`);
    if (res.ok) {
      const json = await res.json();
      const docs = json.documents || [];
      for (const d of docs) {
        const id = d.name.split("/").pop();
        const idLower = id.toLowerCase();
        if (idLower !== "superadmin" && idLower !== "autoservicio") {
          console.log(`Deleting user "${id}"...`);
          const ok = await deleteDoc(d.name);
          if (ok) deletedCount++;
        } else {
          console.log(`Preserving authorized user doc: ${d.name}`);
        }
      }
    }
  } catch (err) {
    console.error(`Error purging usuarios:`, err.message);
  }
  return deletedCount;
}

async function ensureAutoservicioUser() {
  const url = `${BASE_URL}/usuarios/Autoservicio?key=${API_KEY}`;
  const body = {
    fields: {
      id: { stringValue: "Autoservicio" },
      cedula: { stringValue: "Autoservicio" },
      nombre: { stringValue: "Auto-servicio de Confianza" },
      telefono: { stringValue: "" },
      email: { stringValue: "autoservicio@tubodeguita.com" },
      password: { stringValue: "efe8564971192c24d29c7aedb7c5230aeaf13dbac7815bb7bd2206bdcc483350" },
      rol: { stringValue: "autoservicio" },
      estado: { stringValue: "ACTIVO" },
      puntosAcumulados: { integerValue: "0" },
      puntosCanjeados: { integerValue: "0" },
      fechaRegistro: { stringValue: new Date().toISOString().replace('T', ' ').substring(0, 16) }
    }
  };
  await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

async function resetConfig() {
  const url = `${BASE_URL}/config/global?key=${API_KEY}`;
  const body = {
    fields: {
      nextProductSequence: { integerValue: "1" },
      lastPurge: { timestampValue: new Date().toISOString() },
      cuentasBancarias: { arrayValue: { values: [] } },
      telefonoWhatsApp: { stringValue: "" }
    }
  };
  const res = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  console.log("Config reset status:", res.status);
}

async function main() {
  console.log("--- STARTING FIRESTORE PURGE TO VIRGIN PRODUCTION STATE ---");
  const userDeletedCount = await purgeUsuariosExceptSuperAdminAndAutoservicio();
  console.log(`Collection "usuarios": deleted ${userDeletedCount} secondary user documents`);

  await ensureAutoservicioUser();

  for (const col of COLLECTIONS_TO_PURGE) {
    const count = await purgeCollection(col);
    console.log(`Collection "${col}": deleted ${count} documents`);
  }

  // Segunda pasada rápida de verificación y limpieza
  for (const col of COLLECTIONS_TO_PURGE) {
    await purgeCollection(col);
  }

  await resetConfig();

  console.log("--- VERIFYING COLLECTIONS POST-PURGE ---");
  const allCols = [...COLLECTIONS_TO_PURGE, "usuarios", "config"];
  for (const col of allCols) {
    const res = await fetch(`${BASE_URL}/${col}?key=${API_KEY}&pageSize=100`);
    if (res.ok) {
      const json = await res.json();
      const docs = json.documents || [];
      console.log(`Verified "${col}": ${docs.length} docs remaining`);
      docs.forEach(d => console.log(`  -> ${d.name.split("/").pop()}`));
    }
  }
  console.log("--- PURGE COMPLETED SUCCESSFULLY ---");
}

main().catch(console.error);
