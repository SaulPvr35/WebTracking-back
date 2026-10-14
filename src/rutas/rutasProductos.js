import { z } from "zod";
import { extraerProducto, descargarHtml } from "../servicios/servicioExtraccion.js";
import { renderizarConPlaywright, inyectarInspectorEnHtml } from "../servicios/servicioPlaywrightInspector.js";

const solicitudPrevisualizacion = z.object({
  url: z.string().trim().min(1, "La URL es obligatoria."),
  selectores: z.record(z.string(), z.string()).optional(),
});

const solicitudAnalizarHtml = z.object({
  url: z.string().trim().min(1, "La URL es obligatoria."),
  modo: z.enum(["texto", "ejecutado"]).default("texto"),
});

export function registrarRutasProductos(app) {
  app.post("/api/productos/previsualizar", async (solicitud, respuesta, siguiente) => {
    const validacion = solicitudPrevisualizacion.safeParse(solicitud.body);
    if (!validacion.success) {
      return respuesta.status(400).json({
        error: "Solicitud inválida.",
        detalles: validacion.error.issues.map((problema) => problema.message),
      });
    }
    try {
      return respuesta.json(await extraerProducto(validacion.data.url, validacion.data.selectores));
    } catch (error) {
      return siguiente(error);
    }
  });

  /**
   * Endpoint de análisis profundo de tienda (modo texto y modo ejecutado con Playwright)
   */
  app.post("/api/productos/analizar-html-tienda", async (solicitud, respuesta, siguiente) => {
    const validacion = solicitudAnalizarHtml.safeParse(solicitud.body);
    if (!validacion.success) {
      return respuesta.status(400).json({
        error: "Parámetros inválidos.",
        detalles: validacion.error.issues.map((problema) => problema.message),
      });
    }

    const { url, modo } = validacion.data;

    try {
      if (modo === "texto") {
        const descargado = await descargarHtml(url);
        const htmlPintable = inyectarInspectorEnHtml(descargado.html, url);
        return respuesta.json({
          modo: "texto",
          urlOriginal: url,
          urlFinal: descargado.urlFinal.href,
          html: htmlPintable,
          tamanoBytes: Buffer.byteLength(htmlPintable, "utf8"),
          lineas: htmlPintable.split("\n").length,
        });
      }

      if (modo === "ejecutado") {
        let resultadoPlaywright = null;
        let esBloqueado = false;

        try {
          resultadoPlaywright = await renderizarConPlaywright(url);
          if (
            !resultadoPlaywright ||
            !resultadoPlaywright.urlFinal ||
            resultadoPlaywright.urlFinal.includes("/blocked") ||
            resultadoPlaywright.urlFinal.includes("/challenge") ||
            (resultadoPlaywright.titulo && /verifi|robot|captcha|blocked/i.test(resultadoPlaywright.titulo))
          ) {
            esBloqueado = true;
          }
        } catch {
          esBloqueado = true;
        }

        // Si Playwright fue interceptado por un WAF o captcha (como en Bodega Aurrera / Walmart),
        // descargamos el HTML directo sin scripts bot y pintamos el DOM con los estilos reales
        if (esBloqueado || !resultadoPlaywright?.htmlRenderizado) {
          const descargado = await descargarHtml(url);
          const htmlPintable = inyectarInspectorEnHtml(descargado.html, descargado.urlFinal.href);
          return respuesta.json({
            modo: "ejecutado",
            urlOriginal: url,
            urlFinal: descargado.urlFinal.href,
            titulo: "Vista Renderizada",
            html: htmlPintable,
            tamanoBytes: Buffer.byteLength(htmlPintable, "utf8"),
            lineas: htmlPintable.split("\n").length,
          });
        }

        const htmlPintable = inyectarInspectorEnHtml(resultadoPlaywright.htmlRenderizado, resultadoPlaywright.urlFinal);
        return respuesta.json({
          modo: "ejecutado",
          urlOriginal: url,
          urlFinal: resultadoPlaywright.urlFinal,
          titulo: resultadoPlaywright.titulo,
          html: htmlPintable,
          tamanoBytes: Buffer.byteLength(htmlPintable, "utf8"),
          lineas: htmlPintable.split("\n").length,
        });
      }
    } catch (error) {
      return siguiente(error);
    }
  });

  /**
   * Endpoint proxy para renderizar el HTML en el iframe con script de selección interactiva
   */
  app.post("/api/productos/proxy-inspector", async (solicitud, respuesta, siguiente) => {
    const schema = z.object({
      url: z.string().trim().min(1),
      html: z.string().optional(),
    });

    const validacion = schema.safeParse(solicitud.body);
    if (!validacion.success) {
      return respuesta.status(400).send("Parámetros inválidos");
    }

    try {
      let html = validacion.data.html;
      if (!html) {
        const descargado = await descargarHtml(validacion.data.url);
        html = descargado.html;
      }

      const htmlConInspector = inyectarInspectorEnHtml(html, validacion.data.url);
      respuesta.setHeader("Content-Type", "text/html; charset=utf-8");
      // Desactivar restricciones restrictivas de frame para permitir carga en el iframe de localhost
      respuesta.removeHeader("X-Frame-Options");
      respuesta.setHeader("Content-Security-Policy", "frame-ancestors *");
      return respuesta.send(htmlConInspector);
    } catch (error) {
      return siguiente(error);
    }
  });
}

