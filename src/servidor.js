import "dotenv/config";
import app from "./app.js";
import { cerrarBaseDatos } from "./config/baseDatos.js";
import { detenerPlanificador, iniciarPlanificador } from "./trabajos/planificador.js";

const puerto = Number(process.env.PUERTO_BACKEND ?? 3001);
const host = process.env.HOST_BACKEND ?? "127.0.0.1";

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
