import { obtenerSeguimientosProgramados } from "../repositorios/repositorioSeguimientos.js";
import { ejecutarMonitoreo } from "../servicios/servicioMonitoreo.js";

const temporizadores = new Map();

function programar(seguimiento) {
  if (temporizadores.has(seguimiento.id)) clearTimeout(temporizadores.get(seguimiento.id));
  const espera = Math.max(1_000, (seguimiento.proximaConsulta?.getTime() ?? Date.now()) - Date.now());
  const temporizador = setTimeout(async () => {
    try {
      await ejecutarMonitoreo(seguimiento.id, seguimiento.producto.urlCanonica);
    } catch (error) {
      console.error(`Consulta automática fallida (${seguimiento.id}): ${error.message}`);
    } finally {
      temporizadores.delete(seguimiento.id);
      const actualizados = await obtenerSeguimientosProgramados();
      const siguiente = actualizados.find((item) => item.id === seguimiento.id);
      if (siguiente?.activo) programar(siguiente);
    }
  }, espera);
  temporizadores.set(seguimiento.id, temporizador);
}

export async function iniciarPlanificador() {
  const seguimientos = await obtenerSeguimientosProgramados();
  seguimientos.forEach(programar);
  console.log(`Planificador iniciado: ${seguimientos.length} seguimiento(s) activo(s).`);
}

export function detenerPlanificador() {
  temporizadores.forEach(clearTimeout);
  temporizadores.clear();
}
