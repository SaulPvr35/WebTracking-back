import assert from "node:assert/strict";
import { createServer } from "node:http";
import { after, before, test } from "node:test";
import * as cheerio from "cheerio";
import { crearResultado } from "../src/extractores/extractorBase.js";
import { extraerDatosEstructurados } from "../src/extractores/extractorDatosEstructurados.js";
import { extraerHtml } from "../src/extractores/extractorHtml.js";
import { extraerMetadatos } from "../src/extractores/extractorMetadatos.js";
import { obtenerAdaptador } from "../src/extractores/adaptadores/registroAdaptadores.js";
import { extraerProducto } from "../src/servicios/servicioExtraccion.js";

let servidor;
let url;

before(async () => {
  servidor = createServer((_solicitud, respuesta) => {
    respuesta.setHeader("content-type", "text/html; charset=utf-8");
    respuesta.end(`<!doctype html><html><head>
      <meta property="og:title" content="Producto de prueba">
      <meta property="og:image" content="/imagen.jpg">
      <script type="application/ld+json">{"@type":"Product","name":"Producto JSON-LD","description":"Descripción","image":"/producto.jpg","offers":{"price":"1.299,99","priceCurrency":"EUR","availability":"https://schema.org/InStock"}}</script>
    </head><body><h1>Producto visible</h1><span class="price">999,50 €</span></body></html>`);
  });
  await new Promise((resolve) => servidor.listen(0, "127.0.0.1", resolve));
  url = `http://127.0.0.1:${servidor.address().port}`;
});

after(() => servidor.close());

test("rechaza destinos locales antes de descargarlos", async () => {
  await assert.rejects(() => extraerProducto(url), /bloqueado|no pública/);
});

test("combina estrategias y conserva la fuente de cada campo", () => {
  const $ = cheerio.load(`<!doctype html><html><head>
    <meta property="og:title" content="Título Open Graph">
    <script type="application/ld+json">{"@type":"Product","name":"Producto JSON-LD","offers":{"price":"1.299,99","priceCurrency":"EUR"}}</script>
  </head><body><h1>Título visible</h1></body></html>`);
  const resultado = crearResultado();

  extraerDatosEstructurados($, resultado, "https://tienda.example/producto");
  extraerMetadatos($, resultado, "https://tienda.example/producto");
  extraerHtml($, resultado, "https://tienda.example/producto");

  assert.equal(resultado.campos.nombre, "Producto JSON-LD");
  assert.equal(resultado.campos.precioActual, 1299.99);
  assert.equal(resultado.campos.moneda, "EUR");
  assert.equal(resultado.fuentes.nombre, "json-ld");
  assert.equal(resultado.confianzas.precioActual, 0.99);
});

test("selecciona adaptador de tienda solo cuando el dominio está registrado", () => {
  const adaptador = obtenerAdaptador("catalogo.tienda-ejemplo.local");
  const generico = obtenerAdaptador("otra-tienda.example");
  const $ = cheerio.load(`<article>
    <span data-product-name>Producto adaptado</span>
    <span data-product-price content="45,90"></span>
    <span data-product-currency content="EUR"></span>
  </article>`);
  const resultado = crearResultado();

  adaptador.aplicar($, resultado, "https://catalogo.tienda-ejemplo.local/p");

  assert.equal(resultado.campos.nombre, "Producto adaptado");
  assert.equal(resultado.campos.precioActual, 45.9);
  assert.equal(resultado.fuentes.nombre, "adaptador:tienda-ejemplo.local");
  assert.notEqual(generico.aplicar, adaptador.aplicar);
});
