import { agregarCampo } from "./extractorBase.js";
import { limpiarTexto, normalizarPrecio } from "../utilidades/normalizarPrecio.js";

function recorrer(valor, encontrados = []) {
  if (Array.isArray(valor)) {
    valor.forEach((elemento) => recorrer(elemento, encontrados));
  } else if (valor && typeof valor === "object") {
    const tipo = Array.isArray(valor["@type"]) ? valor["@type"] : [valor["@type"]];
    if (tipo.some((item) => ["Product", "ProductGroup"].includes(item))) encontrados.push(valor);
    Object.values(valor).forEach((elemento) => recorrer(elemento, encontrados));
  }
  return encontrados;
}

export function extraerDatosEstructurados($, resultado, urlBase) {
  $('script[type="application/ld+json"]').each((_indice, elemento) => {
    try {
      const datos = JSON.parse($(elemento).text());
      recorrer(datos).forEach((producto) => {
        agregarCampo(resultado, "nombre", limpiarTexto(producto.name), "json-ld", 0.98);
        agregarCampo(resultado, "descripcion", limpiarTexto(producto.description), "json-ld", 0.9);
        const imagen = Array.isArray(producto.image) ? producto.image[0] : producto.image;
        agregarCampo(resultado, "imagenUrl", imagen ? new URL(imagen, urlBase).href : null, "json-ld", 0.95);
        const oferta = Array.isArray(producto.offers) ? producto.offers[0] : producto.offers;
        if (oferta) {
          agregarCampo(resultado, "precioActual", normalizarPrecio(oferta.price), "json-ld", 0.99);
          // Precio original / de lista (listPrice o highPrice en AggregateOffer)
          const precioOrig = normalizarPrecio(oferta.listPrice ?? oferta.highPrice);
          if (precioOrig) {
            agregarCampo(resultado, "precioOriginal", precioOrig, "json-ld", 0.95);
          }
          agregarCampo(resultado, "moneda", limpiarTexto(oferta.priceCurrency), "json-ld", 0.99);
          agregarCampo(resultado, "disponibilidad", limpiarTexto(oferta.availability)?.split("/").pop(), "json-ld", 0.9);
          // Vigencia de la oferta si está declarada en el estándar Schema.org
          const vigencia = oferta.priceValidUntil;
          if (vigencia && typeof vigencia === "string") {
            agregarCampo(resultado, "vigenciaPromocion", limpiarTexto(vigencia), "json-ld", 0.95);
          }
        }
        const valoracion = producto.aggregateRating;
        if (valoracion) {
          agregarCampo(resultado, "valoracion", normalizarPrecio(valoracion.ratingValue), "json-ld", 0.9);
          agregarCampo(resultado, "cantidadValoraciones", normalizarPrecio(valoracion.reviewCount ?? valoracion.ratingCount), "json-ld", 0.9);
        }
      });
    } catch {
      resultado.diagnostico.push("Se ignoró un bloque JSON-LD con formato inválido.");
    }
  });
}
