import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const directorioActual = path.dirname(fileURLToPath(import.meta.url));
const rutaBaseDatos = path.resolve(directorioActual, "../../prisma/dev.db");

export async function crearRespaldo(rutaDestino) {
  if (!rutaDestino || typeof rutaDestino !== "string") {
    throw new Error("Debes indicar la ruta del archivo de respaldo.");
  }
  const destino = path.resolve(rutaDestino);
  await fs.copyFile(rutaBaseDatos, destino);
  return destino;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  crearRespaldo(process.argv[2])
    .then((destino) => console.log(`Respaldo creado en ${destino}`))
    .catch((error) => {
      console.error(`No se pudo crear el respaldo: ${error.message}`);
      process.exitCode = 1;
    });
}
