import { z } from "zod";
import { middlewareAutenticacion } from "../middlewares/middlewareAutenticacion.js";
import {
  actualizarProducto,
  crearProducto,
  eliminarProducto,
  listarProductos,
  obtenerProducto,
  obtenerResumenProductos,
} from "../repositorios/repositorioProductos.js";
import { extraerProducto } from "../servicios/servicioExtraccion.js";
import prisma from "../config/baseDatos.js";

const camposProducto = {
  urlOriginal: z.string().url(),
  urlCanonica: z.string().url(),
  dominio: z.string().min(1),
  nombre: z.string().nullable().optional(),
  descripcion: z.string().nullable().optional(),
  imagenUrl: z.string().url().nullable().optional(),
  precioActual: z.number().finite().nonnegative().nullable().optional(),
  precioOriginal: z.number().finite().nonnegative().nullable().optional(),
  precioAnterior: z.number().finite().nonnegative().nullable().optional(),
  ahorro: z.number().finite().nonnegative().nullable().optional(),
  porcentajeDescuento: z.number().finite().nonnegative().nullable().optional(),
  tieneDescuento: z.boolean().optional(),
  etiquetaPromocion: z.string().nullable().optional(),
  vigenciaPromocion: z.string().nullable().optional(),
  moneda: z.string().max(10).nullable().optional(),
  disponibilidad: z.string().nullable().optional(),
  valoracion: z.number().finite().nonnegative().nullable().optional(),
  cantidadValoraciones: z
    .preprocess((val) => {
      if (val === "" || val === null || val === undefined) return null;
      const num = Number(val);
      return Number.isFinite(num) ? Math.round(num) : val;
    }, z.number().int().nonnegative().nullable().optional()),
  fuenteCampos: z.record(z.string(), z.string()).optional(),
  confianzaCampos: z.record(z.string(), z.number()).optional(),
};

const productoNuevo = z.object(camposProducto);
const productoEdicion = productoNuevo.partial().omit({ urlOriginal: true, urlCanonica: true, dominio: true });

function validarNumero(valor, predeterminado) {
  const numero = Number.parseInt(valor, 10);
  return Number.isInteger(numero) && numero > 0 ? numero : predeterminado;
}

export function registrarRutasPersistenciaProductos(app) {
  app.get("/api/panel/resumen", middlewareAutenticacion, async (solicitud, respuesta, siguiente) => {
    try {
      return respuesta.json(await obtenerResumenProductos(solicitud.usuario.id));
    }
    catch (error) { return siguiente(error); }
  });

  app.post("/api/productos", middlewareAutenticacion, async (solicitud, respuesta, siguiente) => {
    const validacion = productoNuevo.safeParse(solicitud.body);
    if (!validacion.success) return respuesta.status(400).json({ error: "Los datos del producto no son válidos.", detalles: validacion.error.issues });
    try {
      return respuesta.status(201).json(await crearProducto(validacion.data, solicitud.usuario.id));
    } catch (error) { return siguiente(error); }
  });

  app.get("/api/productos", middlewareAutenticacion, async (solicitud, respuesta, siguiente) => {
    try {
      return respuesta.json(await listarProductos({
        pagina: validarNumero(solicitud.query.pagina, 1),
        limite: Math.min(validarNumero(solicitud.query.limite, 20), 100),
        busqueda: typeof solicitud.query.busqueda === "string" ? solicitud.query.busqueda.trim() : "",
        orden: solicitud.query.orden,
        direccion: solicitud.query.direccion,
        usuarioId: solicitud.usuario.id,
      }));
    } catch (error) { return siguiente(error); }
  });

  app.get("/api/productos/:id", middlewareAutenticacion, async (solicitud, respuesta, siguiente) => {
    try {
      const producto = await obtenerProducto(solicitud.params.id);
      if (!producto || producto.usuarioId !== solicitud.usuario.id) {
        return respuesta.status(404).json({ error: "Producto no encontrado." });
      }
      return respuesta.json(producto);
    } catch (error) { return siguiente(error); }
  });

  app.patch("/api/productos/:id", middlewareAutenticacion, async (solicitud, respuesta, siguiente) => {
    const validacion = productoEdicion.safeParse(solicitud.body);
    if (!validacion.success) return respuesta.status(400).json({ error: "Los campos editados no son válidos.", detalles: validacion.error.issues });
    try {
      const producto = await obtenerProducto(solicitud.params.id);
      if (!producto || producto.usuarioId !== solicitud.usuario.id) {
        return respuesta.status(404).json({ error: "Producto no encontrado." });
      }
      return respuesta.json(await actualizarProducto(solicitud.params.id, validacion.data));
    }
    catch (error) { return siguiente(error); }
  });

  app.post("/api/productos/:id/consultar", middlewareAutenticacion, async (solicitud, respuesta, siguiente) => {
    try {
      const producto = await obtenerProducto(solicitud.params.id);
      if (!producto || producto.usuarioId !== solicitud.usuario.id) {
        return respuesta.status(404).json({ error: "Producto no encontrado." });
      }

      // 1. Extraer los datos más recientes en vivo desde la tienda
      const url = producto.urlOriginal || producto.urlCanonica;
      const datosNuevos = await extraerProducto(url);

      // 2. Guardar nuevo registro en HistorialPrecio si hay precio
      const precioNuevo = datosNuevos.precioActual ?? null;
      const precioOriginalNuevo = datosNuevos.precioOriginal ?? null;

      await prisma.$transaction(async (tx) => {
        await tx.producto.update({
          where: { id: producto.id },
          data: {
            nombre: datosNuevos.nombre ?? undefined,
            descripcion: datosNuevos.descripcion ?? undefined,
            imagenUrl: datosNuevos.imagenUrl ?? undefined,
            precioAnterior: producto.precioActual ?? undefined,
            precioActual: precioNuevo ?? undefined,
            precioOriginal: precioOriginalNuevo ?? undefined,
            ahorro: datosNuevos.ahorro ?? undefined,
            porcentajeDescuento: datosNuevos.porcentajeDescuento ?? undefined,
            tieneDescuento: Boolean(datosNuevos.tieneDescuento),
            etiquetaPromocion: datosNuevos.etiquetaPromocion ?? undefined,
            vigenciaPromocion: datosNuevos.vigenciaPromocion ?? undefined,
            moneda: datosNuevos.moneda ?? undefined,
            disponibilidad: datosNuevos.disponibilidad ?? undefined,
            valoracion: datosNuevos.valoracion ?? undefined,
            cantidadValoraciones: datosNuevos.cantidadValoraciones ?? undefined,
          },
        });

        if (precioNuevo !== null && precioNuevo !== undefined) {
          await tx.historialPrecio.create({
            data: {
              productoId: producto.id,
              precio: precioNuevo,
              precioOriginal: precioOriginalNuevo,
              ahorro: datosNuevos.ahorro ?? null,
              porcentajeDescuento: datosNuevos.porcentajeDescuento ?? null,
              tieneDescuento: Boolean(datosNuevos.tieneDescuento),
              etiquetaPromocion: datosNuevos.etiquetaPromocion ?? null,
              moneda: datosNuevos.moneda ?? producto.moneda,
              disponibilidad: datosNuevos.disponibilidad ?? producto.disponibilidad,
            },
          });
        }
      });

      // Retornar el producto refrescado con su historial completo
      const productoActualizado = await obtenerProducto(producto.id);
      return respuesta.json({
        mensaje: "Producto consultado y actualizado exitosamente.",
        producto: productoActualizado,
        datosNuevos,
      });
    } catch (error) {
      return siguiente(error);
    }
  });

  app.delete("/api/productos/:id", middlewareAutenticacion, async (solicitud, respuesta, siguiente) => {
    try {
      const producto = await obtenerProducto(solicitud.params.id);
      if (!producto || producto.usuarioId !== solicitud.usuario.id) {
        return respuesta.status(404).json({ error: "Producto no encontrado." });
      }
      await eliminarProducto(solicitud.params.id);
      return respuesta.status(204).send();
    }
    catch (error) { return siguiente(error); }
  });
}
