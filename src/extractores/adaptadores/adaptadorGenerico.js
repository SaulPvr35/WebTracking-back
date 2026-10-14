export function necesitaAdaptador(resultado) {
  return !resultado.campos.nombre || resultado.campos.precioActual === undefined;
}
