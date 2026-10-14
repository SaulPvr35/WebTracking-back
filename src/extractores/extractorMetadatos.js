import { agregarCampo } from "./extractorBase.js";
import { limpiarTexto, normalizarPrecio } from "../utilidades/normalizarPrecio.js";

function meta($, nombre) {
  return limpiarTexto($(`meta[property="${nombre}"], meta[name="${nombre}"]`).first().attr("content"));
}

export function extraerMetadatos($, resultado, urlBase) {
  agregarCampo(resultado, "nombre", meta($, "og:title") ?? meta($, "twitter:title"), "metadatos", 0.8);
  agregarCampo(resultado, "descripcion", meta($, "og:description") ?? meta($, "description"), "metadatos", 0.75);
  const imagen = meta($, "og:image") ?? meta($, "twitter:image");
  agregarCampo(resultado, "imagenUrl", imagen ? new URL(imagen, urlBase).href : null, "metadatos", 0.8);
  agregarCampo(resultado, "precioActual", normalizarPrecio(
    meta($, "product:price:amount") ?? meta($, "og:price:amount"),
  ), "metadatos", 0.85);
  agregarCampo(resultado, "moneda", meta($, "product:price:currency") ?? meta($, "og:price:currency"), "metadatos", 0.85);
  agregarCampo(resultado, "disponibilidad", meta($, "product:availability"), "metadatos", 0.75);
}
