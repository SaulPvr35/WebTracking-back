import { agregarCampo } from "../../extractorBase.js";
import { limpiarTexto, normalizarPrecio } from "../../../utilidades/normalizarPrecio.js";

const DOMINIO = "tienda-ejemplo.local";

export function puedeManejar(hostname) {
  return hostname === DOMINIO || hostname.endsWith(`.${DOMINIO}`);
}

export function aplicar($, resultado, urlBase) {
  const fuente = `adaptador:${DOMINIO}`;
  agregarCampo(resultado, "nombre", limpiarTexto($("[data-product-name]").first().text()), fuente, 0.92);
  agregarCampo(resultado, "descripcion", limpiarTexto($("[data-product-description]").first().text()), fuente, 0.8);
  const imagen = $("[data-product-image]").first().attr("src");
  agregarCampo(resultado, "imagenUrl", imagen ? new URL(imagen, urlBase).href : null, fuente, 0.9);
  agregarCampo(
    resultado,
    "precioActual",
    normalizarPrecio($("[data-product-price]").first().attr("content") ?? $("[data-product-price]").first().text()),
    fuente,
    0.94,
  );
  agregarCampo(resultado, "moneda", limpiarTexto($("[data-product-currency]").first().attr("content") ?? $("[data-product-currency]").first().text()), fuente, 0.9);
  agregarCampo(resultado, "disponibilidad", limpiarTexto($("[data-product-availability]").first().text()), fuente, 0.8);
}
