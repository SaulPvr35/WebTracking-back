import { agregarCampo } from "./extractorBase.js";
import { limpiarTexto, normalizarPrecio } from "../utilidades/normalizarPrecio.js";

/**
 * Aplica selectores CSS personalizados configurados por el usuario (Estilo Maxun).
 * Permite capturar elementos específicos si la web tiene clases o IDs concretos.
 *
 * @param {import("cheerio").CheerioAPI} $ Instancia de Cheerio
 * @param {object} resultado Objeto acumulador de resultados
 * @param {URL} urlBase URL del producto
 * @param {Record<string, string>} [selectoresPersonalizados] Mapa de campo -> selector CSS
 */
export function extraerConSelectoresUsuario($, resultado, urlBase, selectoresPersonalizados = {}) {
  if (!selectoresPersonalizados || typeof selectoresPersonalizados !== "object") return;

  const fuente = "selector-usuario";
  const confianza = 1.0; // Máxima prioridad (definido explícitamente por el usuario)

  for (const [campo, selector] of Object.entries(selectoresPersonalizados)) {
    if (!selector || typeof selector !== "string") continue;
    const elemento = $(selector.trim()).first();
    if (!elemento.length) continue;

    let valor = null;

    if (campo === "imagenUrl") {
      const src = elemento.attr("src") ?? elemento.attr("data-src") ?? elemento.attr("content");
      if (src) {
        valor = new URL(src, urlBase).href;
      }
    } else if (campo === "precioActual" || campo === "precioOriginal" || campo === "precioAnterior" || campo === "porcentajeDescuento") {
      const contenido = elemento.attr("content") ?? elemento.text();
      valor = normalizarPrecio(contenido);
    } else if (campo === "valoracion" || campo === "cantidadValoraciones") {
      const contenido = elemento.attr("content") ?? elemento.text();
      valor = normalizarPrecio(contenido);
    } else {
      valor = limpiarTexto(elemento.attr("content") ?? elemento.text());
    }

    if (valor !== null && valor !== undefined && valor !== "") {
      agregarCampo(resultado, campo, valor, fuente, confianza);
      resultado.diagnostico.push(`Campo '${campo}' extraído con selector de usuario: "${selector}".`);
    }
  }
}
