import "dotenv/config";
import app from "./app.js";
import { cerrarBaseDatos } from "./config/baseDatos.js";
import { detenerPlanificador, iniciarPlanificador } from "./trabajos/planificador.js";

const puerto = Number(process.env.PORT ?? process.env.PUERTO_BACKEND ?? 3001);
const host = process.env.HOST_BACKEND ?? "0.0.0.0";

import { execSync } from "node:child_process";

// Garantizar que la base de datos SQLite y sus tablas existan al arrancar
try {
  console.log("Sincronizando esquema de base de datos SQLite...");
  execSync("npx prisma db push --skip-generate", { stdio: "inherit" });
} catch (err) {
  console.warn("Aviso al sincronizar SQLite con Prisma:", err.message);
}

const servidor = app.listen(puerto, host, async () => {
  console.log(`Backend ejecutándose en http://${host}:${puerto}`);
  await iniciarPlanificador();
});

async function cerrarServidor() {
  detenerPlanificador();
  await new Promise((resolver) => servidor.close(resolver));
  await cerrarBaseDatos();
}

process.once("SIGINT", () => cerrarServidor().finally(() => process.exit(0)));
process.once("SIGTERM", () => cerrarServidor().finally(() => process.exit(0)));
