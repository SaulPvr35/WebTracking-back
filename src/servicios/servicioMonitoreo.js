import { extraerProducto } from "./servicioExtraccion.js";
import {
  registrarConsultaExitosa,
  registrarConsultaFallida,
} from "../repositorios/repositorioSeguimientos.js";

const ejecucionesActivas = new Set();

export async function ejecutarMonitoreo(id, url) {
  if (ejecucionesActivas.has(id)) {
    return { omitida: true, motivo: "Ya existe una consulta en curso." };
  }
  ejecucionesActivas.add(id);
  const inicio = new Date();
  try {
    const datos = await extraerProducto(url);
    const fin = new Date();
    return await registrarConsultaExitosa(id, datos, inicio, fin);
  } catch (error) {
    const fin = new Date();
    await registrarConsultaFallida(id, error, inicio, fin);
    throw error;
  } finally {
    ejecucionesActivas.delete(id);
  }
}

export function consultaEnCurso(id) {
  return ejecucionesActivas.has(id);
}
