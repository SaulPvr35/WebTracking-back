import { z } from "zod";
import { middlewareAutenticacion } from "../middlewares/middlewareAutenticacion.js";
import {
  actualizarEstadoSeguimiento,
  actualizarSeguimiento,
  crearSeguimiento,
  listarSeguimientos,
  obtenerHistorialSeguimiento,
  obtenerSeguimiento,
} from "../repositorios/repositorioSeguimientos.js";
import { obtenerProducto } from "../repositorios/repositorioProductos.js";
import { ejecutarMonitoreo } from "../servicios/servicioMonitoreo.js";

const solicitudCrear = z.object({
  productoId: z.string().min(1),
  intervaloMinutos: z.number().int().min(15).max(43_200).default(1_440),
});

export function registrarRutasSeguimientos(app) {
  app.post("/api/seguimientos", middlewareAutenticacion, async (solicitud, respuesta, siguiente) => {
    const validacion = solicitudCrear.safeParse(solicitud.body);
    if (!validacion.success) return respuesta.status(400).json({ error: "La configuración del seguimiento no es válida.", detalles: validacion.error.issues });
    try {
      const producto = await obtenerProducto(validacion.data.productoId);
      if (!producto || producto.usuarioId !== solicitud.usuario.id) {
        return respuesta.status(404).json({ error: "Producto no encontrado o no pertenece a tu cuenta." });
      }
      return respuesta.status(201).json(await crearSeguimiento(validacion.data));
    }
    catch (error) { return siguiente(error); }
  });

  app.get("/api/seguimientos", middlewareAutenticacion, async (solicitud, respuesta, siguiente) => {
    try { return respuesta.json(await listarSeguimientos(solicitud.usuario.id)); }
    catch (error) { return siguiente(error); }
  });

  app.get("/api/seguimientos/:id", middlewareAutenticacion, async (solicitud, respuesta, siguiente) => {
    try {
      const seguimiento = await obtenerSeguimiento(solicitud.params.id);
      if (!seguimiento || seguimiento.producto?.usuarioId !== solicitud.usuario.id) {
        return respuesta.status(404).json({ error: "Seguimiento no encontrado." });
      }
      return respuesta.json(seguimiento);
    } catch (error) { return siguiente(error); }
  });

  app.patch("/api/seguimientos/:id", middlewareAutenticacion, async (solicitud, respuesta, siguiente) => {
    const validacion = z.object({
      activo: z.boolean().optional(),
      intervaloMinutos: z.number().int().min(15).max(43_200).optional(),
    }).refine((datos) => datos.activo !== undefined || datos.intervaloMinutos !== undefined).safeParse(solicitud.body);
    if (!validacion.success) return respuesta.status(400).json({ error: "El estado debe ser booleano." });
    try {
      const seguimiento = await obtenerSeguimiento(solicitud.params.id);
      if (!seguimiento || seguimiento.producto?.usuarioId !== solicitud.usuario.id) {
        return respuesta.status(404).json({ error: "Seguimiento no encontrado." });
      }
      return respuesta.json(await actualizarSeguimiento(solicitud.params.id, validacion.data));
    }
    catch (error) { return siguiente(error); }
  });

  app.post("/api/seguimientos/:id/pausar", middlewareAutenticacion, async (solicitud, respuesta, siguiente) => {
    try {
      const seguimiento = await obtenerSeguimiento(solicitud.params.id);
      if (!seguimiento || seguimiento.producto?.usuarioId !== solicitud.usuario.id) {
        return respuesta.status(404).json({ error: "Seguimiento no encontrado." });
      }
      return respuesta.json(await actualizarEstadoSeguimiento(solicitud.params.id, false));
    }
    catch (error) { return siguiente(error); }
  });

  app.post("/api/seguimientos/:id/reanudar", middlewareAutenticacion, async (solicitud, respuesta, siguiente) => {
    try {
      const seguimiento = await obtenerSeguimiento(solicitud.params.id);
      if (!seguimiento || seguimiento.producto?.usuarioId !== solicitud.usuario.id) {
        return respuesta.status(404).json({ error: "Seguimiento no encontrado." });
      }
      return respuesta.json(await actualizarEstadoSeguimiento(solicitud.params.id, true));
    }
    catch (error) { return siguiente(error); }
  });

  app.post("/api/seguimientos/:id/consultar", middlewareAutenticacion, async (solicitud, respuesta, siguiente) => {
    try {
      const seguimiento = await obtenerSeguimiento(solicitud.params.id);
      if (!seguimiento || seguimiento.producto?.usuarioId !== solicitud.usuario.id) {
        return respuesta.status(404).json({ error: "Seguimiento no encontrado." });
      }
      const resultado = await ejecutarMonitoreo(seguimiento.id, seguimiento.producto.urlCanonica);
      return respuesta.json(resultado);
    } catch (error) { return siguiente(error); }
  });

  app.get("/api/seguimientos/:id/historial", middlewareAutenticacion, async (solicitud, respuesta, siguiente) => {
    try {
      const seguimiento = await obtenerSeguimiento(solicitud.params.id);
      if (!seguimiento || seguimiento.producto?.usuarioId !== solicitud.usuario.id) {
        return respuesta.status(404).json({ error: "Seguimiento no encontrado." });
      }
      const historial = await obtenerHistorialSeguimiento(solicitud.params.id);
      return respuesta.json(historial);
    } catch (error) { return siguiente(error); }
  });
}
