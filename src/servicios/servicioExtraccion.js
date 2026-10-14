import * as cheerio from "cheerio";
import { performance } from "node:perf_hooks";
import { extraerDatosEstructurados } from "../extractores/extractorDatosEstructurados.js";
import { crearResultado } from "../extractores/extractorBase.js";
import { extraerHtml } from "../extractores/extractorHtml.js";
import { extraerMetadatos } from "../extractores/extractorMetadatos.js";
import { extraerConSelectoresUsuario } from "../extractores/extractorSelectoresUsuario.js";
import { necesitaAdaptador } from "../extractores/adaptadores/adaptadorGenerico.js";
import { obtenerAdaptador } from "../extractores/adaptadores/registroAdaptadores.js";
import { normalizarUrl, validarDestino } from "../utilidades/normalizarUrl.js";
import { calcularMetricasDescuento } from "../utilidades/calcularDescuento.js";

const MAX_BYTES = 15 * 1024 * 1024;
const TIEMPO_LIMITE_MS = 10000;
const MAX_REDIRECCIONES = 5;

export async function descargarHtml(urlInicial) {
  let url = normalizarUrl(urlInicial);
  for (let intento = 0; intento <= MAX_REDIRECCIONES; intento += 1) {
    await validarDestino(url);
    const controlador = new AbortController();
    const temporizador = setTimeout(() => controlador.abort(), TIEMPO_LIMITE_MS);
    let respuesta;
    const esBodegaOWalmart = /bodegaaurrera|walmart/i.test(url.hostname);
    const esCoppel = /coppel/i.test(url.hostname);
    const cabeceras = esBodegaOWalmart
      ? {
          "user-agent": "Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36",
          "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "accept-language": "es-MX,es;q=0.9",
        }
      : {
          "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
          "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
          "accept-language": "es-MX,es;q=0.9,en-US;q=0.8,en;q=0.7",
          "sec-ch-ua": '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
          "sec-ch-ua-mobile": "?0",
          "sec-ch-ua-platform": '"Windows"',
          "sec-fetch-dest": "document",
          "sec-fetch-mode": "navigate",
          "sec-fetch-site": "none",
          "sec-fetch-user": "?1",
          "upgrade-insecure-requests": "1",
        };

    try {
      respuesta = await fetch(url, {
        redirect: "manual",
        signal: controlador.signal,
        headers: cabeceras,
      });
    } catch (error) {
      if (error.name === "AbortError") throw new Error("La página tardó demasiado en responder.");
      throw new Error(`No se pudo descargar la página: ${error.message}`);
    } finally {
      clearTimeout(temporizador);
    }

    if ([301, 302, 303, 307, 308].includes(respuesta.status)) {
      if (intento === MAX_REDIRECCIONES) throw new Error("Se superó el límite de redirecciones.");
      const destino = respuesta.headers.get("location");
      if (!destino) throw new Error("La redirección no tiene destino.");
      url = new URL(destino, url);
      continue;
    }
    if (!respuesta.ok) {
      if (respuesta.status === 404) {
        throw new Error("No se encontró el producto en la tienda. El enlace podría estar roto o el artículo fue retirado.");
      }
      if (respuesta.status === 403 || respuesta.status === 401) {
        throw new Error("La tienda tiene una protección temporal contra consultas automáticas en este enlace.");
      }
      if (respuesta.status >= 500) {
        throw new Error("El servidor de la tienda tiene problemas en este momento. Intenta de nuevo más tarde.");
      }
      throw new Error(`La tienda respondió con un problema temporal al intentar abrir el producto.`);
    }
    const tipo = respuesta.headers.get("content-type") ?? "";
    if (!tipo.includes("text/html") && !tipo.includes("application/xhtml+xml")) {
      throw new Error("El enlace proporcionado no parece ser una página web de tienda válida.");
    }
    const longitud = Number(respuesta.headers.get("content-length"));
    if (longitud > MAX_BYTES) throw new Error("La página supera el tamaño máximo permitido de 15MB.");

    const lector = respuesta.body?.getReader();
    if (!lector) throw new Error("La respuesta no contiene un cuerpo legible.");
    const partes = [];
    let total = 0;
    while (true) {
      const { done, value } = await lector.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BYTES) throw new Error("La página supera el tamaño máximo permitido de 15MB.");
      partes.push(value);
    }
    const html = Buffer.concat(partes).toString("utf8");
    return { html, urlFinal: url, codigoHttp: respuesta.status };
  }
  throw new Error("No se pudo resolver la URL.");
}

export async function extraerProducto(urlOriginal, selectoresPersonalizados = null) {
  const inicio = performance.now();
  let descargado;

  try {
    descargado = await descargarHtml(urlOriginal);
  } catch (errorDescarga) {
    // Si la tienda bloquea la IP del datacenter (Render/AWS) con 403/401 o reto anti-bot,
    // intentamos automáticamente con Playwright headless y perfiles de navegador reales
    if (
      errorDescarga.message.includes("protección temporal") ||
      errorDescarga.message.includes("403") ||
      errorDescarga.message.includes("401") ||
      errorDescarga.message.includes("bloqueo")
    ) {
      try {
        const { renderizarConPlaywright } = await import("./servicioPlaywrightInspector.js");
        const resPw = await renderizarConPlaywright(urlOriginal, { timeoutMs: 25000 });
        if (resPw?.htmlRenderizado) {
          descargado = {
            html: resPw.htmlRenderizado,
            urlFinal: new URL(resPw.urlFinal || urlOriginal),
            codigoHttp: 200,
          };
        } else {
          throw errorDescarga;
        }
      } catch (errorPw) {
        throw new Error("La tienda tiene una protección estricta contra consultas en servidores en la nube. Puedes usar el botón de Inspección Visual para capturar los datos manualmente.");
      }
    } else {
      throw errorDescarga;
    }
  }

  const $ = cheerio.load(descargado.html);
  const resultado = crearResultado();


  extraerDatosEstructurados($, resultado, descargado.urlFinal);
  extraerMetadatos($, resultado, descargado.urlFinal);
  extraerHtml($, resultado, descargado.urlFinal);
  const adaptador = obtenerAdaptador(descargado.urlFinal.hostname);
  if (!adaptador.esGenerico) {
    adaptador.aplicar($, resultado, descargado.urlFinal);
    resultado.diagnostico.push(`Se aplicó el adaptador especializado para ${descargado.urlFinal.hostname}.`);
  } else if (necesitaAdaptador(resultado)) {
    resultado.diagnostico.push("No hay adaptador registrado para este dominio; se conservaron los campos disponibles.");
  } else {
    resultado.diagnostico.push("Las estrategias genéricas fueron suficientes; no se aplicó adaptador.");
  }

  // Estilo Maxun: Sobrescritura o captura dirigida con selectores provistos por el usuario
  if (selectoresPersonalizados) {
    extraerConSelectoresUsuario($, resultado, descargado.urlFinal, selectoresPersonalizados);
  }

  // Análisis y cálculo riguroso de descuentos y promociones
  const precioActual = resultado.campos.precioActual ?? null;
  const precioOriginal = resultado.campos.precioOriginal ?? resultado.campos.precioAnterior ?? null;
  const etiquetaPromo = resultado.campos.etiquetaPromocion ?? null;
  const vigencia = resultado.campos.vigenciaPromocion ?? null;

  const metricasPromo = calcularMetricasDescuento(precioActual, precioOriginal, {
    etiquetaPromo,
    vigencia,
  });

  // Guardar diagnóstico del análisis de descuento
  resultado.diagnostico.push(metricasPromo.motivoDescuento);

  return {
    urlOriginal,
    urlCanonica: descargado.urlFinal.href,
    dominio: descargado.urlFinal.hostname,
    ...resultado.campos,
    // Campos calculados y verificados de descuento
    precioOriginal: metricasPromo.precioOriginal,
    ahorro: metricasPromo.ahorro,
    porcentajeDescuento: metricasPromo.porcentajeDescuento,
    tieneDescuento: metricasPromo.tieneDescuento,
    etiquetaPromocion: metricasPromo.etiquetaPromocion,
    vigenciaPromocion: metricasPromo.vigenciaPromocion,
    fuenteCampos: resultado.fuentes,
    confianzaCampos: resultado.confianzas,
    diagnostico: resultado.diagnostico,
    metadatosConsulta: {
      codigoHttp: descargado.codigoHttp,
      duracionMs: Math.round(performance.now() - inicio),
      fechaExtraccion: new Date().toISOString(),
    },
  };
}
