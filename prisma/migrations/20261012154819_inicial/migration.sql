-- CreateTable
CREATE TABLE "Producto" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "urlOriginal" TEXT NOT NULL,
    "urlCanonica" TEXT NOT NULL,
    "dominio" TEXT NOT NULL,
    "nombre" TEXT,
    "descripcion" TEXT,
    "imagenUrl" TEXT,
    "precioActual" REAL,
    "moneda" TEXT,
    "precioAnterior" REAL,
    "disponibilidad" TEXT,
    "valoracion" REAL,
    "cantidadValoraciones" INTEGER,
    "fuenteCampos" TEXT NOT NULL,
    "confianzaCampos" TEXT NOT NULL,
    "fechaCreacion" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaActualizacion" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Seguimiento" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productoId" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "intervaloMinutos" INTEGER NOT NULL DEFAULT 1440,
    "ultimaConsulta" DATETIME,
    "proximaConsulta" DATETIME,
    "ultimoEstado" TEXT NOT NULL DEFAULT 'pendiente',
    "intentosTotales" INTEGER NOT NULL DEFAULT 0,
    "consultasExitosas" INTEGER NOT NULL DEFAULT 0,
    "consultasFallidas" INTEGER NOT NULL DEFAULT 0,
    "tiempoUltimaConsultaMs" INTEGER,
    "fechaCreacion" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaActualizacion" DATETIME NOT NULL,
    CONSTRAINT "Seguimiento_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HistorialPrecio" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productoId" TEXT NOT NULL,
    "seguimientoId" TEXT,
    "precio" REAL,
    "moneda" TEXT,
    "disponibilidad" TEXT,
    "fechaRegistro" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HistorialPrecio_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "HistorialPrecio_seguimientoId_fkey" FOREIGN KEY ("seguimientoId") REFERENCES "Seguimiento" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RegistroConsulta" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "seguimientoId" TEXT NOT NULL,
    "fechaInicio" DATETIME NOT NULL,
    "fechaFin" DATETIME,
    "duracionMs" INTEGER,
    "resultado" TEXT NOT NULL,
    "camposEncontrados" TEXT,
    "mensajeError" TEXT,
    "codigoError" TEXT,
    CONSTRAINT "RegistroConsulta_seguimientoId_fkey" FOREIGN KEY ("seguimientoId") REFERENCES "Seguimiento" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Seguimiento_productoId_idx" ON "Seguimiento"("productoId");

-- CreateIndex
CREATE INDEX "Seguimiento_activo_proximaConsulta_idx" ON "Seguimiento"("activo", "proximaConsulta");

-- CreateIndex
CREATE INDEX "HistorialPrecio_productoId_fechaRegistro_idx" ON "HistorialPrecio"("productoId", "fechaRegistro");

-- CreateIndex
CREATE INDEX "RegistroConsulta_seguimientoId_fechaInicio_idx" ON "RegistroConsulta"("seguimientoId", "fechaInicio");
