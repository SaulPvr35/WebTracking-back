import { agregarCampo } from "../../extractorBase.js";
import { limpiarTexto, normalizarPrecio } from "../../../utilidades/normalizarPrecio.js";

/**
 * Adaptador especializado para Mercado Libre (mercadolibre.com.*, mercadolivre.com.*)
 * 
 * Mercado Libre estructura sus precios en componentes de Andes UI:
 * - Contenedor principal PDP: .ui-pdp-price
 * - Precio anterior / de lista: s.andes-money-amount--previous, .ui-pdp-price__original-value
 * - Precio actual de venta: .ui-pdp-price__second-line .andes-money-amount, [itemprop="offers"] .andes-money-amount
 * - Fracciones y centavos: [data-andes-money-amount-fraction="true"], .andes-money-amount__fraction, .andes-money-amount__cents
 * - Descuento: .andes-money-amount__discount, .ui-pdp-price__second-line__label
 */

export function puedeManejar(hostname) {
  return /mercadolibre\.[a-z.]+|mercadolivre\.[a-z.]+/i.test(hostname);
}

/**
 * Función auxiliar para parsear un elemento de monto Andes UI (.andes-money-amount)
 */
function parsearMontoAndes($, elemento) {
  if (!elemento || !elemento.length) return null;

  // Si tiene un meta itemprop="price" directo
  const metaPrecio = elemento.find('meta[itemprop="price"]').attr("content");
  if (metaPrecio) {
    const val = normalizarPrecio(metaPrecio);
    if (val) return val;
  }

  // Fracción principal (pesos/moneda entera)
  const fraccionTexto = elemento.find('[data-andes-money-amount-fraction="true"], .andes-money-amount__fraction').first().text();
  if (!fraccionTexto) return null;

  // Centavos si existen
  const centavosTexto = elemento.find('[data-andes-money-amount-cents="true"], .andes-money-amount__cents').first().text();
  const textoCompleto = centavosTexto ? `${fraccionTexto}.${centavosTexto}` : fraccionTexto;

  return normalizarPrecio(textoCompleto);
}

export function aplicar($, resultado, urlBase) {
  const fuente = "adaptador:mercadolibre";

  // 1. TÍTULO DEL PRODUCTO
  // En Mercado Libre el título principal está en h1.ui-pdp-title
  const tituloPdp = $("h1.ui-pdp-title").first();
  if (tituloPdp.length) {
    const tituloLimpio = limpiarTexto(tituloPdp.text());
    if (tituloLimpio) {
      agregarCampo(resultado, "nombre", tituloLimpio, fuente, 0.99);
    }
  }

  // 2. PRECIOS (Andes UI)
  const contenedorPrecioPrincipal = $(".ui-pdp-price, .ui-pdp-price__main-container").first();

  if (contenedorPrecioPrincipal.length) {
    // A) Precio Actual / Oferta
    // Suele estar en .ui-pdp-price__second-line .andes-money-amount o en el bloque de ofertas
    const elemPrecioActual = contenedorPrecioPrincipal
      .find('.ui-pdp-price__second-line .andes-money-amount, [itemprop="offers"].andes-money-amount, .ui-pdp-price__second-line')
      .first();

    const precioActual = parsearMontoAndes($, elemPrecioActual.is(".andes-money-amount") ? elemPrecioActual : elemPrecioActual.find(".andes-money-amount").first());

    // B) Precio Original / Anterior (tachado)
    // Suele estar en s.andes-money-amount--previous, .ui-pdp-price__original-value
    const elemPrecioOriginal = contenedorPrecioPrincipal
      .find('s.andes-money-amount--previous, .ui-pdp-price__original-value, s .andes-money-amount, .andes-money-amount--previous')
      .first();

    const precioOriginal = parsearMontoAndes($, elemPrecioOriginal);

    // C) Símbolo de moneda
    const simboloMoneda = contenedorPrecioPrincipal.find(".andes-money-amount__currency-symbol").first().text().trim();
    if (simboloMoneda) {
      agregarCampo(resultado, "moneda", simboloMoneda === "$" ? "MXN" : simboloMoneda, fuente, 0.95);
    }

    if (precioActual) {
      agregarCampo(resultado, "precioActual", precioActual, fuente, 0.99);
      if (precioOriginal && precioOriginal > precioActual) {
        agregarCampo(resultado, "precioOriginal", precioOriginal, fuente, 0.99);
        agregarCampo(resultado, "precioAnterior", precioOriginal, fuente, 0.99);
      }
    } else if (precioOriginal) {
      // Si solo hay un precio sin oferta
      agregarCampo(resultado, "precioActual", precioOriginal, fuente, 0.99);
    }
  } else {
    // Si por alguna razón no está el contenedor .ui-pdp-price, buscar cualquier .andes-money-amount principal
    const primerMonto = $(".andes-money-amount").first();
    const precio = parsearMontoAndes($, primerMonto);
    if (precio) {
      agregarCampo(resultado, "precioActual", precio, fuente, 0.9);
    }
  }

  // 3. DESCUENTO Y PROMOCIÓN
  // Mercado Libre muestra descuentos en .ui-pdp-price__second-line__label o .andes-money-amount__discount
  const etiquetaDescuento = $(".ui-pdp-price__second-line .andes-money-amount__discount, .ui-pdp-price__second-line__label").first().text().trim();
  if (etiquetaDescuento) {
    const numDescuento = normalizarPrecio(etiquetaDescuento);
    if (numDescuento && numDescuento > 0 && numDescuento <= 100) {
      agregarCampo(resultado, "porcentajeDescuento", numDescuento, fuente, 0.99);
    }
    agregarCampo(resultado, "etiquetaPromocion", etiquetaDescuento, fuente, 0.95);
  }

  // Subtítulo de promoción (ej. "15 meses sin intereses")
  const subtituloPromo = $("#pricing_price_subtitle, .ui-pdp-price__subtitles").first().text().replace(/\s+/g, " ").trim();
  if (subtituloPromo && !resultado.campos.etiquetaPromocion) {
    agregarCampo(resultado, "etiquetaPromocion", subtituloPromo, fuente, 0.9);
  }

  // 4. IMÁGENES
  // Galería principal de Mercado Libre
  const imagenGaleria = $(".ui-pdp-gallery__figure img, img.ui-pdp-image").first();
  const imgUrlRaw = imagenGaleria.attr("src") || imagenGaleria.attr("data-src") || imagenGaleria.attr("data-zoom");
  if (imgUrlRaw) {
    try {
      const urlCompleta = new URL(imgUrlRaw, urlBase).href;
      agregarCampo(resultado, "imagen", urlCompleta, fuente, 0.98);
    } catch {
      // url inválida
    }
  }

  // 5. VALORACIÓN Y OPINIONES
  const ratingTexto = $(".ui-pdp-review__rating").first().text().trim();
  if (ratingTexto) {
    const calificacion = normalizarPrecio(ratingTexto);
    if (calificacion) {
      agregarCampo(resultado, "calificacion", calificacion, fuente, 0.95);
    }
  }

  const reviewsTexto = $(".ui-pdp-review__amount").first().text().trim();
  if (reviewsTexto) {
    const totalReviews = normalizarPrecio(reviewsTexto);
    if (totalReviews) {
      agregarCampo(resultado, "totalResenas", totalReviews, fuente, 0.95);
    }
  }

  // 6. DISPONIBILIDAD / STOCK
  const stockTexto = $(".ui-pdp-buybox__quantity__available, .ui-pdp-stock-information").first().text().replace(/\s+/g, " ").trim();
  if (stockTexto) {
    agregarCampo(resultado, "disponibilidad", stockTexto, fuente, 0.9);
  }
}
