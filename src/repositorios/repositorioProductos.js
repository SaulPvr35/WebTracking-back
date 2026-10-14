import prisma from "../config/baseDatos.js";

function serializarJson(valor) {
  return JSON.stringify(valor ?? {});
}

function prepararProducto(datos, usuarioId = null) {
  return {
    usuarioId: usuarioId ?? datos.usuarioId ?? null,
    urlOriginal: datos.urlOriginal,
    urlCanonica: datos.urlCanonica,
    dominio: datos.dominio,
    nombre: datos.nombre || null,
    descripcion: datos.descripcion || null,
    imagenUrl: datos.imagenUrl || null,
    precioActual: datos.precioActual === "" ? null : datos.precioActual ?? null,
    precioOriginal: datos.precioOriginal === "" ? null : datos.precioOriginal ?? null,
    precioAnterior: datos.precioAnterior === "" ? null : datos.precioAnterior ?? null,
    ahorro: datos.ahorro === "" ? null : datos.ahorro ?? null,
    porcentajeDescuento: datos.porcentajeDescuento === "" ? null : datos.porcentajeDescuento ?? null,
    tieneDescuento: Boolean(datos.tieneDescuento),
    etiquetaPromocion: datos.etiquetaPromocion || null,
    vigenciaPromocion: datos.vigenciaPromocion || null,
    moneda: datos.moneda || null,
    disponibilidad: datos.disponibilidad || null,
    valoracion: datos.valoracion === "" ? null : datos.valoracion ?? null,
    cantidadValoraciones: datos.cantidadValoraciones === "" ? null : datos.cantidadValoraciones ?? null,
    fuenteCampos: serializarJson(datos.fuenteCampos),
    confianzaCampos: serializarJson(datos.confianzaCampos),
  };
}

export async function crearProducto(datos, usuarioId = null) {
  const productoCreado = await prisma.producto.create({ data: prepararProducto(datos, usuarioId) });
  // Crear registro inicial en el historial para la línea de tiempo
  if (productoCreado.precioActual !== null && productoCreado.precioActual !== undefined) {
    await prisma.historialPrecio.create({
      data: {
        productoId: productoCreado.id,
        precio: productoCreado.precioActual,
        precioOriginal: productoCreado.precioOriginal,
        ahorro: productoCreado.ahorro,
        porcentajeDescuento: productoCreado.porcentajeDescuento,
        tieneDescuento: Boolean(productoCreado.tieneDescuento),
        etiquetaPromocion: productoCreado.etiquetaPromocion,
        moneda: productoCreado.moneda,
        disponibilidad: productoCreado.disponibilidad,
      },
    }).catch(() => {});
  }
  return productoCreado;
}

export async function listarProductos({ pagina = 1, limite = 20, busqueda = "", orden = "fechaActualizacion", direccion = "desc", usuarioId = null } = {}) {
  const skip = (pagina - 1) * limite;
  const camposOrdenables = ["fechaActualizacion", "fechaCreacion", "nombre", "precioActual", "dominio"];
  const campoOrden = camposOrdenables.includes(orden) ? orden : "fechaActualizacion";
  const direccionOrden = direccion === "asc" ? "asc" : "desc";
  
  const condiciones = [];
  if (usuarioId) {
    condiciones.push({ usuarioId });
  }
  if (busqueda) {
    condiciones.push({ OR: [{ nombre: { contains: busqueda } }, { dominio: { contains: busqueda } }] });
  }

  const where = condiciones.length > 0 ? { AND: condiciones } : undefined;

  const [productos, total] = await prisma.$transaction([
    prisma.producto.findMany({
      skip, take: limite, where, orderBy: { [campoOrden]: direccionOrden },
      include: { _count: { select: { seguimientos: true, historialPrecios: true } } },
    }),
    prisma.producto.count({ where }),
  ]);
  return { productos, pagina, limite, total };
}

export async function obtenerResumenProductos(usuarioId = null) {
  const filtroProducto = usuarioId ? { usuarioId } : undefined;
  const filtroSeguimiento = usuarioId ? { producto: { usuarioId } } : undefined;
  const filtroActivo = usuarioId ? { activo: true, producto: { usuarioId } } : { activo: true };
  const filtroConsulta = usuarioId ? { seguimiento: { producto: { usuarioId } } } : undefined;

  const [productos, seguimientos, seguimientosActivos, consultas] = await prisma.$transaction([
    prisma.producto.count({ where: filtroProducto }),
    prisma.seguimiento.count({ where: filtroSeguimiento }),
    prisma.seguimiento.count({ where: filtroActivo }),
    prisma.registroConsulta.count({ where: filtroConsulta }),
  ]);
  return { productos, seguimientos, seguimientosActivos, consultas };
}

export async function obtenerProducto(id) {
  return prisma.producto.findUnique({
    where: { id },
    include: {
      seguimientos: {
        include: {
          registrosConsultas: {
            orderBy: { fechaInicio: "desc" },
            take: 30,
          },
        },
      },
      historialPrecios: {
        orderBy: { fechaRegistro: "desc" },
        take: 100,
      },
    },
  });
}

export async function actualizarProducto(id, datos) {
  const permitidos = [
    "nombre", "descripcion", "imagenUrl", "precioActual", "moneda",
    "precioAnterior", "disponibilidad", "valoracion", "cantidadValoraciones",
  ];
  const cambios = Object.fromEntries(
    permitidos
      .filter((campo) => Object.hasOwn(datos, campo))
      .map((campo) => [campo, datos[campo] === "" ? null : datos[campo]]),
  );
  return prisma.producto.update({ where: { id }, data: cambios });
}

export async function eliminarProducto(id) {
  return prisma.producto.delete({ where: { id } });
}
