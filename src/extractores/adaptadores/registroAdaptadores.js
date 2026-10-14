import * as adaptadorTiendaEjemplo from "./tiendas/adaptadorTiendaEjemplo.js";
import * as adaptadorCoppel from "./tiendas/adaptadorCoppel.js";
import * as adaptadorLiverpool from "./tiendas/adaptadorLiverpool.js";
import * as adaptadorMercadoLibre from "./tiendas/adaptadorMercadoLibre.js";

const adaptadores = [adaptadorMercadoLibre, adaptadorCoppel, adaptadorLiverpool, adaptadorTiendaEjemplo];

export function obtenerAdaptador(hostname) {
  return adaptadores.find((adaptador) => adaptador.puedeManejar(hostname)) ?? {
    puedeManejar: () => true,
    nombre: "genérico",
    esGenerico: true,
  };
}
