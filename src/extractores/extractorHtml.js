import { agregarCampo } from "./extractorBase.js";
import { limpiarTexto, normalizarPrecio } from "../utilidades/normalizarPrecio.js";

export function extraerHtml($, resultado, urlBase) {
  // Limpieza dinámica de Nombre: despojar scripts, estilos y obtener texto limpio
  const h1Elemento = $('[itemprop="name"], [data-testid*="product-title"], [data-testid*="title"], h1').first().clone();
  h1Elemento.find("script, style, noscript, svg").remove();
  const nombre = limpiarTexto(h1Elemento.text());

  // Descripción dinámica
  const descElemento = $('[itemprop="description"], [data-testid*="description"], #productDescription, .description, [class*="description"]').first().clone();
  descElemento.find("script, style, noscript").remove();
  const descripcion = limpiarTexto(descElemento.text());

  // Imagen dinámica: comprobar src, data-src, data-zoom-image, srcset
  const imgElemento = $('[itemprop="image"], [data-testid*="product-image"], main img, article img, [class*="gallery"] img, img').first();
  const imagenRaw = imgElemento.attr("content") ??
    imgElemento.attr("data-zoom-image") ??
    imgElemento.attr("data-src") ??
    imgElemento.attr("data-lazy-src") ??
    imgElemento.attr("src") ??
    imgElemento.attr("srcset")?.split(",")?.[0]?.trim()?.split(" ")?.[0];

  let imagenUrl = null;
  if (imagenRaw) {
    try {
      imagenUrl = new URL(imagenRaw, urlBase).href;
    } catch {
      imagenUrl = null;
    }
  }

  // Ranking / Valoración y cantidad de reseñas
  const rankingElemento = $('[itemprop="ratingValue"], [data-testid*="rating"], [class*="rating-score"], [class*="stars"]').first();
  const valoracion = normalizarPrecio(rankingElemento.attr("content") ?? rankingElemento.text());

  const reviewsElemento = $('[itemprop="reviewCount"], [itemprop="ratingCount"], [data-testid*="reviews-count"], [class*="reviews-count"]').first();
  const cantidadValoraciones = normalizarPrecio(reviewsElemento.attr("content") ?? reviewsElemento.text());
  
  // Precio actual o final (con descuento si aplica)
  const selectorPrecioActual = [
    '[data-testid="discounted"]',
    '[data-testid="pdp_discounted_price"]',
    '#price-pdp-idc',
    '[id="price-pdp-idc"]',
    '[data-testid="pdp_price_details"]',
    '[data-testid="pdp_cash_price_label"]',
    '[itemprop="price"]',
    '[data-seo-id="price"]',
    '[data-fs-element="price"]',
    '[class*="price"]',
    '[id*="price"]',
  ].join(", ");

  const elementoPrecio = $(selectorPrecioActual).first();
  const precio = elementoPrecio.attr("content") ?? elementoPrecio.text();
  
  // Precio original o anterior (de lista / regular)
  const selectorPrecioTachado = [
    '[data-testid="pdp_price"]',
    '[data-testid="original"]',
    '.line-through',
    '[class*="line-through"]',
    '[data-seo-id="strike-through-price"]',
    '[data-fs-element="strike-through-price"]',
    'del',
    's',
    '[class*="original-price"]',
    '[class*="strikethrough"]',
    '[class*="old-price"]',
    '[class*="previous-price"]',
    '[class*="list-price"]',
    '[style*="line-through"]',
  ].join(", ");
  
  const elementoTachado = $(selectorPrecioTachado).first();
  const precioTachado = elementoTachado.attr("content") ?? elementoTachado.text();

  // Si no hay selector de precio con descuento pero sí está pdp_price, pdp_price funge como precio actual
  const precioFinalCalculado = precio || (elementoTachado.is('[data-testid="pdp_price"]') && !$(selectorPrecioActual).length ? precioTachado : precio);

  // Porcentaje de ahorro o descuento explícito
  const porcentajeTexto = $('[data-testid="pdp_savings_percentage"]').first().text();
  const porcentajeAhorro = normalizarPrecio(porcentajeTexto);

  // Moneda
  const moneda = $('[itemprop="priceCurrency"], [data-fs-element="priceCurrency"]').first().attr("content") ??
    $('[itemprop="priceCurrency"], [data-fs-element="priceCurrency"], [class*="currency"], [data-currency]').first().text();

  // Disponibilidad o detalles de envío
  const disponibilidad = $('[itemprop="availability"]').first().attr("content") ??
    $('[data-testid="pdp_shipping_details"], [class*="stock"], [id*="stock"], [class*="availability"]').first().text();

  // Etiquetas de oferta o promoción anunciada explícitamente
  const selectoresPromo = [
    '[data-testid="pdp_savings_percentage"]',
    '[data-testid="pdp_credit_details"]',
    '[data-testid="pdp_coppel_credit_label"]',
    '[data-testid*="discount"]',
    '[data-testid*="promo"]',
    '[class*="badge-discount"]',
    '[class*="tag-offer"]',
    '[class*="discount-tag"]',
    '[class*="promo-badge"]',
    '[data-fs-element="discount"]',
  ].join(", ");

  let etiquetaPromo = "";
  const elementoPromo = $(selectoresPromo).first();
  if (elementoPromo.length) {
    const clon = elementoPromo.clone();
    clon.find("style, script, noscript, svg").remove();
    etiquetaPromo = clon.text();
  }

  const valorActual = normalizarPrecio(precioFinalCalculado);
  const valorOriginal = normalizarPrecio(precioTachado);

  agregarCampo(resultado, "nombre", nombre, "html-semántico", 0.7);
  agregarCampo(resultado, "descripcion", descripcion, "html-semántico", 0.55);
  agregarCampo(resultado, "imagenUrl", imagenUrl, "html-semántico", 0.65);
  agregarCampo(resultado, "precioActual", valorActual, "html-semántico", 0.65);
  if (valoracion) agregarCampo(resultado, "valoracion", valoracion, "html-semántico", 0.65);
  if (cantidadValoraciones) agregarCampo(resultado, "cantidadValoraciones", cantidadValoraciones, "html-semántico", 0.65);
  
  if (valorOriginal && (!valorActual || valorActual < valorOriginal || $('[data-testid="pdp_discounted_price"]').length > 0)) {
    agregarCampo(resultado, "precioOriginal", valorOriginal, "html-semántico", 0.7);
    agregarCampo(resultado, "precioAnterior", valorOriginal, "html-semántico", 0.7);
  }

  if (porcentajeAhorro && porcentajeAhorro > 0) {
    agregarCampo(resultado, "porcentajeDescuento", porcentajeAhorro, "html-semántico", 0.75);
  }

  agregarCampo(resultado, "moneda", limpiarTexto(moneda), "html-semántico", 0.6);
  agregarCampo(resultado, "disponibilidad", limpiarTexto(disponibilidad), "html-semántico", 0.6);
  if (limpiarTexto(etiquetaPromo)) {
    const textoLimpio = limpiarTexto(etiquetaPromo);
    // Si la etiqueta de promo era en realidad el precio con descuento (ej: "$119.70")
    const precioDesdePromo = normalizarPrecio(textoLimpio);
    if (precioDesdePromo && valorOriginal && precioDesdePromo < valorOriginal && !valorActual) {
      agregarCampo(resultado, "precioActual", precioDesdePromo, "html-semántico", 0.75);
    } else if (!/^[$€£¥]\s*\d+([.,]\d+)?$/.test(textoLimpio)) {
      // Solo guardar en etiquetaPromocion si es una frase o anuncio descriptivo, no solo un precio
      agregarCampo(resultado, "etiquetaPromocion", textoLimpio, "html-semántico", 0.7);
    }
  }
}
