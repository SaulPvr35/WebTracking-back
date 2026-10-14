export function crearResultado() {
  return {
    campos: {},
    fuentes: {},
    confianzas: {},
    diagnostico: [],
  };
}

export function agregarCampo(resultado, campo, valor, fuente, confianza) {
  if (valor === null || valor === undefined || valor === "") return;
  const confianzaActual = resultado.confianzas[campo] ?? -1;
  if (confianza < confianzaActual) return;
  resultado.campos[campo] = valor;
  resultado.fuentes[campo] = fuente;
  resultado.confianzas[campo] = confianza;
}
