import { chromium } from "playwright";
import { normalizarUrl, validarDestino } from "../utilidades/normalizarUrl.js";

let navegadorSingleton = null;

async function obtenerNavegador() {
  if (!navegadorSingleton || !navegadorSingleton.isConnected()) {
    navegadorSingleton = await chromium.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--disable-gpu",
      ],
    });
  }
  return navegadorSingleton;
}

/**
 * Script inyectado en el HTML para permitir selección interactiva F12 visual.
 * Al hacer click o mover el mouse en el iframe, envía mensajes al padre con datos del elemento y selector CSS.
 */
function generarScriptInspector(urlOriginal) {
  return `
<script id="__inspector_tienda_script__">
(function() {
  if (window.__INSPECTOR_INICIALIZADO__) return;
  window.__INSPECTOR_INICIALIZADO__ = true;

  var elementoActivo = null;
  var estiloResaltado = document.createElement("style");
  estiloResaltado.innerHTML = \`
    .__inspector_hover__ {
      outline: 2px dashed #3b82f6 !important;
      outline-offset: -1px !important;
      background-color: rgba(59, 130, 246, 0.12) !important;
      cursor: crosshair !important;
    }
    .__inspector_seleccionado__ {
      outline: 2px solid #10b981 !important;
      outline-offset: -1px !important;
      background-color: rgba(16, 185, 129, 0.2) !important;
    }
    /* Evitar que modales de cookies tapen o bloqueen la selección */
    [class*="cookie" i], [id*="cookie" i] {
      opacity: 0.15 !important;
      pointer-events: none !important;
    }
  \`;
  document.head.appendChild(estiloResaltado);

  function generarSelectorCSS(el) {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) return "";
    if (el.id) {
      return "#" + CSS.escape(el.id);
    }
    
    // Probar atributos de prueba o data-testid comunes
    var atributosTest = ["data-testid", "data-qa", "itemprop", "data-fs-element", "data-component"];
    for (var i = 0; i < atributosTest.length; i++) {
      var attr = atributosTest[i];
      var val = el.getAttribute(attr);
      if (val) {
        return el.tagName.toLowerCase() + "[" + attr + '="' + CSS.escape(val) + '"]';
      }
    }

    // Probar clases identificadoras
    if (el.classList && el.classList.length > 0) {
      var clasesUtiles = Array.from(el.classList).filter(function(c) {
        return !c.startsWith("__inspector_") && !c.includes("hover") && !c.includes("active");
      });
      if (clasesUtiles.length > 0) {
        var selectorClase = el.tagName.toLowerCase() + "." + clasesUtiles.map(function(c) { return CSS.escape(c); }).join(".");
        if (document.querySelectorAll(selectorClase).length <= 3) {
          return selectorClase;
        }
      }
    }

    // Ruta jerárquica con nth-of-type
    var camino = [];
    var actual = el;
    while (actual && actual.nodeType === Node.ELEMENT_NODE && actual !== document.body && actual !== document.documentElement) {
      var tag = actual.tagName.toLowerCase();
      var id = actual.id ? "#" + CSS.escape(actual.id) : "";
      if (id) {
        camino.unshift(tag + id);
        break; // Detener en ID
      } else {
        var hermanosMismoTag = Array.from(actual.parentNode ? actual.parentNode.children : []).filter(function(h) {
          return h.tagName.toLowerCase() === tag;
        });
        if (hermanosMismoTag.length > 1) {
          var indice = hermanosMismoTag.indexOf(actual) + 1;
          camino.unshift(tag + ":nth-of-type(" + indice + ")");
        } else {
          camino.unshift(tag);
        }
      }
      actual = actual.parentNode;
    }
    return camino.join(" > ");
  }

  function serializarElemento(el) {
    if (!el) return null;
    var rect = el.getBoundingClientRect();
    var atributos = {};
    for (var i = 0; i < el.attributes.length; i++) {
      var a = el.attributes[i];
      atributos[a.name] = a.value;
    }
    return {
      tag: el.tagName.toLowerCase(),
      selector: generarSelectorCSS(el),
      texto: (el.innerText || el.textContent || "").trim().slice(0, 300),
      valorAttrSrc: el.getAttribute("src") || el.getAttribute("data-src") || el.getAttribute("data-zoom-image") || null,
      atributos: atributos,
      dimensiones: {
        ancho: Math.round(rect.width),
        alto: Math.round(rect.height),
      }
    };
  }

  document.addEventListener("mouseover", function(e) {
    if (e.target.id === "__inspector_tienda_script__") return;
    if (elementoActivo && elementoActivo !== e.target) {
      elementoActivo.classList.remove("__inspector_hover__");
    }
    elementoActivo = e.target;
    elementoActivo.classList.add("__inspector_hover__");

    window.parent.postMessage({
      tipo: "INSPECTOR_HOVER",
      elemento: serializarElemento(elementoActivo)
    }, "*");
  }, true);

  document.addEventListener("mouseout", function(e) {
    if (e.target) {
      e.target.classList.remove("__inspector_hover__");
    }
  }, true);

  function procesarSeleccion(e) {
    e.preventDefault();
    e.stopPropagation();

    var prevSeleccionado = document.querySelector(".__inspector_seleccionado__");
    if (prevSeleccionado) {
      prevSeleccionado.classList.remove("__inspector_seleccionado__");
    }
    if (e.target) {
      e.target.classList.add("__inspector_seleccionado__");
    }

    var datosElemento = serializarElemento(e.target);
    window.parent.postMessage({
      tipo: "INSPECTOR_SELECCION",
      elemento: datosElemento
    }, "*");
  }

  document.addEventListener("click", procesarSeleccion, true);
  document.addEventListener("mousedown", function(e) {
    // Si es click izquierdo, capturar de inmediato
    if (e.button === 0) {
      procesarSeleccion(e);
    }
  }, true);

  // Informar que el inspector cargó
  window.parent.postMessage({
    tipo: "INSPECTOR_LISTO",
    url: "${urlOriginal}"
  }, "*");
})();
</script>
  `;
}

/**
 * Prepara el HTML renderizado para ser cargado en un iframe interactivo:
 * - Inyecta etiqueta <base href="..."> para que imágenes y estilos relativos carguen
 * - Inyecta el script interactivo F12 para selección y selectores
 */
/**
 * Prepara el HTML renderizado para ser pintado fielmente en el iframe interactivo:
 * - Despoja todos los scripts ejecutables de la tienda (WAF, captchas, métricas, redirecciones)
 * - Conserva 100% de los estilos CSS (<style>, <link rel="stylesheet">), imágenes, fuentes y diseño visual
 * - Inyecta etiqueta <base href="..."> para que todas las hojas de estilo y recursos carguen desde el origen
 * - Inyecta únicamente el script del inspector interactivo (crosshair, selectores CSS, postMessage)
 */
export function inyectarInspectorEnHtml(htmlOriginal, urlOriginal) {
  let html = htmlOriginal || "";

  // 1. Eliminar absolutamente TODOS los scripts de la tienda (<script>...</script> y <script src="...">)
  // De esta manera, el navegador NO ejecutará retos de AWS WAF, recaptcha, cloudflare ni tracking,
  // pero el HTML se "pinta" idéntico a la tienda porque todo el CSS, layouts, imágenes y fuentes quedan intactos.
  html = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");

  // 2. Eliminar etiquetas Content-Security-Policy que la tienda (como Walmart) incluye en el <meta>,
  // las cuales bloquean la ejecución de nuestro script de inspección interactivo (__inspector_tienda_script__)
  html = html.replace(/<meta[^>]*http-equiv=["']?content-security-policy["']?[^>]*>/gi, "");

  // 3. Inyectar política permisiva y <base href="..."> en el <head>
  const tagBase = `<base href="${urlOriginal}">`;
  const tagCspPermisivo = `<meta http-equiv="Content-Security-Policy" content="default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; font-src * data: blob:; style-src * 'unsafe-inline'; script-src * 'unsafe-inline' 'unsafe-eval'; connect-src *;">`;
  
  if (/<head[^>]*>/i.test(html)) {
    html = html.replace(/<head[^>]*>/i, (coincidencia) => `${coincidencia}\n${tagCspPermisivo}\n${tagBase}\n`);
  } else {
    html = `${tagCspPermisivo}\n${tagBase}\n${html}`;
  }

  // 3. Inyectar únicamente nuestro script de inspector interactivo
  const scriptInspector = generarScriptInspector(urlOriginal);
  if (/<\/body>/i.test(html)) {
    html = html.replace(/<\/body>/i, `\n${scriptInspector}\n</body>`);
  } else {
    html += `\n${scriptInspector}`;
  }

  return html;
}

/**
 * Ejecuta la URL en un navegador Chromium headless (Playwright) para obtener el DOM totalmente renderizado.
 */
export async function renderizarConPlaywright(urlObjetivo, { timeoutMs = 25000 } = {}) {
  const urlValida = normalizarUrl(urlObjetivo);
  await validarDestino(urlValida);

  const navegador = await obtenerNavegador();
  const esEneba = /eneba/i.test(urlValida.hostname);
  const contexto = await navegador.newContext({
    userAgent: esEneba
      ? "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
      : "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
    viewport: { width: 1366, height: 768 },
    deviceScaleFactor: 1,
    locale: "es-MX",
    timezoneId: "America/Mexico_City",
    permissions: ["geolocation"],
    extraHTTPHeaders: {
      "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
      "accept-language": "es-MX,es;q=0.9,en-US;q=0.8,en;q=0.7",
      "sec-ch-ua": '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"Windows"',
      "upgrade-insecure-requests": "1",
    },
  });

  const pagina = await contexto.newPage();

  // Stealth script para eliminar huellas de automatización que Amazon detecta
  await pagina.addInitScript(() => {
    // 1. Ocultar navigator.webdriver
    Object.defineProperty(navigator, "webdriver", {
      get: () => undefined,
    });
    // 2. Simular window.chrome
    window.chrome = {
      runtime: {},
      loadTimes: function() {},
      csi: function() {},
      app: {},
    };
    // 3. Simular plugins y languages reales
    Object.defineProperty(navigator, "languages", {
      get: () => ["es-MX", "es", "en-US", "en"],
    });
    Object.defineProperty(navigator, "plugins", {
      get: () => [1, 2, 3, 4, 5],
    });
  });

  try {
    await pagina.goto(urlValida.href, {
      waitUntil: "domcontentloaded",
      timeout: timeoutMs,
    });

    // Esperar un momento breve para verificar si Amazon o la tienda mostraron la pantalla de "Continuar a compras"
    await pagina.waitForTimeout(1500);

    // Si Amazon muestra el botón "Continuar a compras" (botón de verificación simple)
    const botonContinuarAmazon = pagina.locator(
      'button:has-text("Continuar a Compras"), button:has-text("Continuar"), a:has-text("Continuar a Compras"), .a-button-text:has-text("Continuar")'
    ).first();

    if (await botonContinuarAmazon.count() > 0 && await botonContinuarAmazon.isVisible()) {
      await botonContinuarAmazon.click().catch(() => {});
      // Esperar navegación al producto real tras el clic
      await pagina.waitForLoadState("domcontentloaded").catch(() => {});
      await pagina.waitForTimeout(2000);
    }

    // En tiendas SPA como Eneba o Liverpool, esperar a que carguen los precios e hidraten
    if (/eneba|liverpool/i.test(urlValida.hostname)) {
      // 1. Aceptar cookies con selectores específicos de Eneba
      const botonCookies = pagina.locator(
        'button.pr0yIU, button:has-text("Aceptar todo"), button:has-text("Accept all"), button:has-text("Aceptar")'
      ).first();
      
      const hayBoton = await botonCookies.count().catch(() => 0);
      if (hayBoton > 0) {
        await botonCookies.click({ force: true }).catch(() => {});
      }

      // 2. Esperar activamente a que aparezca el contenedor de oferta/precio (.NVw2f6 o .f1U598 o texto con precio)
      // o a que la respuesta de GraphQL termine
      await Promise.race([
        pagina.waitForSelector('.NVw2f6, .f1U598, [class*="_PwLpD"], [class*="price-"]', { timeout: 10000 }).catch(() => null),
        pagina.waitForResponse((res) => res.url().includes("graphql") && res.status() === 200, { timeout: 9000 }).catch(() => null),
      ]);

      // 3. Dar 1.5 segundos para que React termine de actualizar el DOM con el precio y botón
      await pagina.waitForTimeout(1500);

      // 4. Eliminar el banner de cookies y cualquier backdrop oscuro directamente del DOM
      await pagina.evaluate(() => {
        const banners = document.querySelectorAll(
          '.rWKsnW, [class*="cookie" i], [id*="cookie" i], [aria-label*="cookie" i]'
        );
        banners.forEach((b) => b.remove());
      }).catch(() => {});
    }

    // Esperar a que los elementos del producto (precio, imagen, título) estén hidratados
    await pagina.waitForSelector(
      '#productTitle, [id*="price"], .ui-pdp-title, h1, [data-testid*="price"], [class*="price-"]',
      { timeout: 4000 }
    ).catch(() => {});

    // Una última pausa de 500ms para asegurar que cualquier animación de render termine
    await pagina.waitForTimeout(500);

    const titulo = await pagina.title();
    const htmlRenderizado = await pagina.content();

    return {
      urlFinal: pagina.url(),
      titulo,
      htmlRenderizado,
    };
  } finally {
    await contexto.close().catch(() => {});
  }
}
