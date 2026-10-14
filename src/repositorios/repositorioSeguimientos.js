import prisma from "../config/baseDatos.js";

export async function crearSeguimiento({ productoId, intervaloMinutos }) {
  const ahora = new Date();
  return prisma.seguimiento.create({
    data: {
      productoId,
      intervaloMinutos,
      proximaConsulta: new Date(ahora.getTime() + intervaloMinutos * 60_000),
    },
    include: { producto: true },
  });
}

export async function listarSeguimientos(usuarioId = null) {
  const where = usuarioId ? { producto: { usuarioId } } : undefined;
  return prisma.seguimiento.findMany({
    where,
    orderBy: { fechaActualizacion: "desc" },
    include: { producto: true },
  });
}

export async function obtenerSeguimiento(id) {
  return prisma.seguimiento.findUnique({
    where: { id },
    include: {
      producto: true,
      historialPrecios: { orderBy: { fechaRegistro: "desc" } },
      registrosConsultas: { orderBy: { fechaInicio: "desc" } },
    },
  });
}

export async function actualizarEstadoSeguimiento(id, activo) {
  const existente = await prisma.seguimiento.findUniqueOrThrow({ where: { id } });
  return prisma.seguimiento.update({
    where: { id },
    data: {
      activo,
      ultimoEstado: activo ? "pendiente" : "pausado",
      proximaConsulta: activo
        ? new Date(Date.now() + existente.intervaloMinutos * 60_000)
        : null,
    },
    include: { producto: true },
  });
}

export async function actualizarSeguimiento(id, datos) {
  return prisma.seguimiento.update({
    where: { id },
    data: {
      ...(datos.activo === undefined ? {} : {
        activo: datos.activo,
        ultimoEstado: datos.activo ? "pendiente" : "pausado",
      }),
      ...(datos.intervaloMinutos === undefined ? {} : {
        intervaloMinutos: datos.intervaloMinutos,
        proximaConsulta: new Date(Date.now() + datos.intervaloMinutos * 60_000),
      }),
    },
    include: { producto: true },
  });
}

export async function obtenerSeguimientosProgramados() {
  return prisma.seguimiento.findMany({
    where: { activo: true },
    include: { producto: true },
  });
}

export async function registrarConsultaExitosa(id, datos, inicio, fin) {
  const duracionMs = Math.round(fin.getTime() - inicio.getTime());
  return prisma.$transaction(async (transaccion) => {
    const seguimiento = await transaccion.seguimiento.findUniqueOrThrow({
      where: { id },
      include: { producto: true },
    });
    const siguiente = new Date(fin.getTime() + seguimiento.intervaloMinutos * 60_000);
    const precioCambio = seguimiento.productoId;
    await transaccion.producto.update({
      where: { id: precioCambio },
      data: {
        nombre: datos.nombre ?? undefined,
        descripcion: datos.descripcion ?? undefined,
        imagenUrl: datos.imagenUrl ?? undefined,
        precioAnterior: seguimiento.producto.precioActual ?? undefined,
        precioActual: datos.precioActual ?? undefined,
        precioOriginal: datos.precioOriginal ?? undefined,
        ahorro: datos.ahorro ?? undefined,
        porcentajeDescuento: datos.porcentajeDescuento ?? undefined,
        tieneDescuento: datos.tieneDescuento ?? false,
        etiquetaPromocion: datos.etiquetaPromocion ?? undefined,
        vigenciaPromocion: datos.vigenciaPromocion ?? undefined,
        moneda: datos.moneda ?? undefined,
        disponibilidad: datos.disponibilidad ?? undefined,
        valoracion: datos.valoracion ?? undefined,
        cantidadValoraciones: datos.cantidadValoraciones ?? undefined,
      },
    });
    await transaccion.historialPrecio.create({
      data: {
        productoId: seguimiento.productoId,
        seguimientoId: id,
        precio: datos.precioActual ?? null,
        precioOriginal: datos.precioOriginal ?? null,
        ahorro: datos.ahorro ?? null,
        porcentajeDescuento: datos.porcentajeDescuento ?? null,
        tieneDescuento: Boolean(datos.tieneDescuento),
        etiquetaPromocion: datos.etiquetaPromocion ?? null,
        moneda: datos.moneda ?? null,
        disponibilidad: datos.disponibilidad ?? null,
      },
    });
    await transaccion.registroConsulta.create({
      data: {
        seguimientoId: id,
        fechaInicio: inicio,
        fechaFin: fin,
        duracionMs,
        resultado: "exito",
        camposEncontrados: JSON.stringify(Object.keys(datos).filter((campo) => datos[campo] !== null && datos[campo] !== undefined)),
      },
    });
    return transaccion.seguimiento.update({
      where: { id },
      data: {
        ultimaConsulta: fin,
        proximaConsulta: siguiente,
        ultimoEstado: "exito",
        intentosTotales: { increment: 1 },
        consultasExitosas: { increment: 1 },
        tiempoUltimaConsultaMs: duracionMs,
      },
      include: { producto: true },
    });
  });
}

export async function registrarConsultaFallida(id, error, inicio, fin) {
  const duracionMs = Math.round(fin.getTime() - inicio.getTime());
  return prisma.$transaction(async (transaccion) => {
    const seguimiento = await transaccion.seguimiento.findUniqueOrThrow({ where: { id } });
    await transaccion.registroConsulta.create({
      data: {
        seguimientoId: id,
        fechaInicio: inicio,
        fechaFin: fin,
        duracionMs,
        resultado: "fallo",
        mensajeError: error.message,
        codigoError: error.code ?? "EXTRACCION",
      },
    });
    return transaccion.seguimiento.update({
      where: { id },
      data: {
        ultimaConsulta: fin,
        proximaConsulta: new Date(fin.getTime() + seguimiento.intervaloMinutos * 60_000),
        ultimoEstado: "fallo",
        intentosTotales: { increment: 1 },
        consultasFallidas: { increment: 1 },
        tiempoUltimaConsultaMs: duracionMs,
      },
      include: { producto: true },
    });
  });
}

export async function obtenerHistorialSeguimiento(id) {
  const seguimiento = await obtenerSeguimiento(id);
  if (!seguimiento) return null;
  return {
    historialPrecios: seguimiento.historialPrecios,
    registrosConsultas: seguimiento.registrosConsultas,
  };
}
