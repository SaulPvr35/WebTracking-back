import { agregarCampo } from "../../extractorBase.js";
import { limpiarTexto, normalizarPrecio } from "../../../utilidades/normalizarPrecio.js";

const DOMINIO = "liverpool.com.mx";

export function puedeManejar(hostname) {
  return hostname === DOMINIO || hostname.endsWith(`.${DOMINIO}`);
}

export function aplicar($, resultado, urlBase) {
  const fuente = `adaptador:${DOMINIO}`;

  // Selectores específicos de Liverpool indicados por el usuario
  // Precio con descuento: [data-testid="discounted"]
  const elementoConDescuento = $('[data-testid="discounted"]').first();
  const precioDescuentoTexto = elementoConDescuento.attr("content") ?? elementoConDescuento.text();

  // Precio original o regular: [data-testid="original"], .line-through
  const elementoOriginal = $('[data-testid="original"], .line-through, [class*="line-through"]').first();
  const precioOriginalTexto = elementoOriginal.attr("content") ?? elementoOriginal.text();

  const precioDescuento = normalizarPrecio(precioDescuentoTexto);
  const precioOriginal = normalizarPrecio(precioOriginalTexto);

  // Si Liverpool tiene precio con descuento explícito
  if (precioDescuento) {
    agregarCampo(resultado, "precioActual", precioDescuento, fuente, 0.99);
    if (precioOriginal && precioOriginal > precioDescuento) {
      agregarCampo(resultado, "precioOriginal", precioOriginal, fuente, 0.99);
      agregarCampo(resultado, "precioAnterior", precioOriginal, fuente, 0.99);
    }
  } else if (precioOriginal) {
    // Si no hay descuento activo, el precio regular/original es el precio actual de compra
    agregarCampo(resultado, "precioActual", precioOriginal, fuente, 0.99);
  }

  // Si se capturó un número en etiquetaPromocion que en realidad era el precio con descuento
  // (por ejemplo "$119.70"), y no teníamos precioDescuento:
  if (!precioDescuento && resultado.campos.etiquetaPromocion) {
    const posiblePrecio = normalizarPrecio(resultado.campos.etiquetaPromocion);
    if (posiblePrecio && precioOriginal && posiblePrecio < precioOriginal) {
      agregarCampo(resultado, "precioActual", posiblePrecio, fuente, 0.99);
      agregarCampo(resultado, "precioOriginal", precioOriginal, fuente, 0.99);
      agregarCampo(resultado, "precioAnterior", precioOriginal, fuente, 0.99);
      // Limpiar la etiqueta de promoción para que no quede duplicada con el precio
      resultado.campos.etiquetaPromocion = null;
    }
  }

  // Porcentaje de descuento explícito si existe en el DOM
  const porcentajeElem = $('[data-testid*="discount"], [class*="discount"]').first();
  if (porcentajeElem.length) {
    const pct = normalizarPrecio(porcentajeElem.text());
    if (pct && pct > 0 && pct < 100) {
      agregarCampo(resultado, "porcentajeDescuento", pct, fuente, 0.95);
    }
  }
}
