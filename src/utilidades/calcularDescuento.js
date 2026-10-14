/**
 * Calcula las métricas de descuento y ahorro de forma rigurosa y verificable.
 *
 * @param {number|null} precioActual Precio final de compra
 * @param {number|null} precioOriginal Precio tachado o de lista anterior
 * @param {object} opciones Indicadores adicionales (etiquetaPromo, vigencia, origen)
 * @returns {object} Métricas y estado de descuento
 */
export function calcularMetricasDescuento(precioActual, precioOriginal, opciones = {}) {
  const { etiquetaPromo = null, vigencia = null, esDudoso = false } = opciones;

  // Si falta alguno de los precios o no son números positivos válidos
  if (
    typeof precioActual !== "number" ||
    typeof precioOriginal !== "number" ||
    precioActual <= 0 ||
    precioOriginal <= 0 ||
    esDudoso
  ) {
    return {
      precioActual: typeof precioActual === "number" ? precioActual : null,
      precioOriginal: typeof precioOriginal === "number" ? precioOriginal : null,
      ahorro: null,
      porcentajeDescuento: null,
      tieneDescuento: false,
      etiquetaPromocion: etiquetaPromo,
      vigenciaPromocion: vigencia,
      esDudoso: Boolean(esDudoso),
      motivoDescuento: esDudoso ? "Datos de precio contradictorios o dudosos" : "Sin precio anterior verificable",
    };
  }

  // Redondear a 2 decimales para evitar desbordes de coma flotante
  const actual = Math.round(precioActual * 100) / 100;
  const original = Math.round(precioOriginal * 100) / 100;

  // Regla 1: Si son iguales, no declarar descuento
  if (actual >= original) {
    return {
      precioActual: actual,
      precioOriginal: original,
      ahorro: 0,
      porcentajeDescuento: 0,
      tieneDescuento: false,
      etiquetaPromocion: etiquetaPromo,
      vigenciaPromocion: vigencia,
      esDudoso: false,
      motivoDescuento: actual === original ? "Precio actual es igual al precio original (0% descuento)" : "Precio actual es mayor al original",
    };
  }

  // Regla 2: Descuento verificable
  const ahorro = Math.round((original - actual) * 100) / 100;
  const porcentaje = Math.round(((ahorro / original) * 100) * 100) / 100; // ej: 21.05 %

  return {
    precioActual: actual,
    precioOriginal: original,
    ahorro,
    porcentajeDescuento: porcentaje,
    tieneDescuento: true,
    etiquetaPromocion: etiquetaPromo,
    vigenciaPromocion: vigencia,
    esDudoso: false,
    motivoDescuento: "Descuento verificado sobre precio original",
  };
}
