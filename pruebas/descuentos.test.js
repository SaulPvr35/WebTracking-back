import test from "node:test";
import assert from "node:assert/strict";
import { calcularMetricasDescuento } from "../src/utilidades/calcularDescuento.js";

test("calcula ahorro y porcentaje de descuento cuando precioActual es menor al original", () => {
  // Ejemplo dado por el usuario: actual 29999, original 37999 -> ahorro 8000, 21.05%
  const res = calcularMetricasDescuento(29999, 37999);
  assert.equal(res.tieneDescuento, true);
  assert.equal(res.ahorro, 8000);
  assert.equal(res.porcentajeDescuento, 21.05);
  assert.equal(res.precioActual, 29999);
  assert.equal(res.precioOriginal, 37999);
});

test("reconoce cuando los precios son iguales y NO declara descuento", () => {
  // Ejemplo dado por el usuario: actual 37999 y tachado 37999 -> sin descuento (0%)
  const res = calcularMetricasDescuento(37999, 37999);
  assert.equal(res.tieneDescuento, false);
  assert.equal(res.ahorro, 0);
  assert.equal(res.porcentajeDescuento, 0);
});

test("no inventa descuento si falta precio original o son datos dudosos", () => {
  const sinOriginal = calcularMetricasDescuento(2500, null);
  assert.equal(sinOriginal.tieneDescuento, false);
  assert.equal(sinOriginal.ahorro, null);
  assert.equal(sinOriginal.porcentajeDescuento, null);

  const dudoso = calcularMetricasDescuento(500, 1000, { esDudoso: true });
  assert.equal(dudoso.tieneDescuento, false);
  assert.equal(dudoso.esDudoso, true);
});

test("normaliza correctamente precios con separador de miles (ej. Coppel $21,874 vs $17,499)", async () => {
  const { normalizarPrecio } = await import("../src/utilidades/normalizarPrecio.js");
  assert.equal(normalizarPrecio("$21,874"), 21874);
  assert.equal(normalizarPrecio("$21,874.00"), 21874);
  assert.equal(normalizarPrecio("$17,499"), 17499);
  assert.equal(normalizarPrecio("$17,499.50"), 17499.5);
  
  // Cálculo de descuento entre Coppel 17499 y 21874
  const res = calcularMetricasDescuento(17499, 21874);
  assert.equal(res.tieneDescuento, true);
  assert.equal(res.ahorro, 4375);
  assert.equal(res.porcentajeDescuento, 20);
});

test("extrae descuento de Liverpool correctamente con data-testid='discounted' y data-testid='original'", async () => {
  const cheerio = await import("cheerio");
  const { crearResultado } = await import("../src/extractores/extractorBase.js");
  const { aplicar: aplicarLiverpool } = await import("../src/extractores/adaptadores/tiendas/adaptadorLiverpool.js");
  
  const html = `
    <div>
      <span data-testid="original" class="line-through">$399.00</span>
      <span data-testid="discounted">$119.70</span>
    </div>
  `;
  const $ = cheerio.load(html);
  const resultado = crearResultado();
  aplicarLiverpool($, resultado, new URL("https://www.liverpool.com.mx/tienda/pdp/peluche/1187100450"));

  assert.equal(resultado.campos.precioActual, 119.7);
  assert.equal(resultado.campos.precioOriginal, 399);

  const res = calcularMetricasDescuento(resultado.campos.precioActual, resultado.campos.precioOriginal);
  assert.equal(res.tieneDescuento, true);
  assert.equal(res.ahorro, 279.3);
  assert.equal(res.porcentajeDescuento, 70);
});

