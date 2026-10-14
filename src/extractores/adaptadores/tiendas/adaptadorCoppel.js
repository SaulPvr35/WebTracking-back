import { agregarCampo } from "../../extractorBase.js";
import { limpiarTexto, normalizarPrecio } from "../../../utilidades/normalizarPrecio.js";

const DOMINIO = "coppel.com";

export function puedeManejar(hostname) {
  return hostname === DOMINIO || hostname.endsWith(`.${DOMINIO}`);
}

export function aplicar($, resultado, urlBase) {
  const fuente = `adaptador:${DOMINIO}`;

  // Precio final (con descuento si aplica) y precio regular / de lista
  const precioFinalTexto = $('[data-testid="pdp_discounted_price"]').first().text();
  const precioRegularTexto = $('[data-testid="pdp_price"]').first().text();

  const precioFinal = normalizarPrecio(precioFinalTexto);
  const precioRegular = normalizarPrecio(precioRegularTexto);

  if (precioFinal) {
    agregarCampo(resultado, "precioActual", precioFinal, fuente, 0.99);
    if (precioRegular && precioRegular > precioFinal) {
      agregarCampo(resultado, "precioOriginal", precioRegular, fuente, 0.99);
      agregarCampo(resultado, "precioAnterior", precioRegular, fuente, 0.99);
    }
  } else if (precioRegular) {
    // Si no tiene oferta activa, el precio regular es el precio actual
    agregarCampo(resultado, "precioActual", precioRegular, fuente, 0.99);
  }

  // Porcentaje explícito de descuento (ej. "20% de descuento")
  const porcentajeTexto = $('[data-testid="pdp_savings_percentage"]').first().text();
  const porcentaje = normalizarPrecio(porcentajeTexto);
  if (porcentaje && porcentaje > 0) {
    agregarCampo(resultado, "porcentajeDescuento", porcentaje, fuente, 0.99);
  }

  // Etiqueta limpia de crédito o promoción sin estilos CSS incrustados
  const promoCredito = $('[data-testid="pdp_coppel_credit_label"], [data-testid="pdp_credit_details"]').first();
  if (promoCredito.length) {
    const clon = promoCredito.clone();
    clon.find("style, script, noscript, svg").remove();
    const textoCredito = limpiarTexto(clon.text());
    if (textoCredito && !textoCredito.includes("@layer") && !textoCredito.includes("var(--")) {
      agregarCampo(resultado, "etiquetaPromocion", textoCredito, fuente, 0.95);
    }
  }

  // Detalles de envío
  const envio = $('[data-testid="pdp_shipping_details"]').first();
  if (envio.length) {
    const clon = envio.clone();
    clon.find("style, script, noscript, svg").remove();
    const textoEnvio = limpiarTexto(clon.text());
    if (textoEnvio && !textoEnvio.includes("@layer")) {
      agregarCampo(resultado, "disponibilidad", textoEnvio, fuente, 0.9);
    }
  }
}
