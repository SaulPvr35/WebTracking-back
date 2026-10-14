export function normalizarPrecio(valor) {
  if (valor === null || valor === undefined) return null;
  const texto = String(valor).replace(/\s/g, "").replace(/[^\d,.-]/g, "");
  if (!texto) return null;

  const ultimoPunto = texto.lastIndexOf(".");
  const ultimaComa = texto.lastIndexOf(",");

  let normalizado = texto;

  // Si tiene ambos (. y ,), el que esté más a la derecha es el separador decimal
  if (ultimoPunto !== -1 && ultimaComa !== -1) {
    if (ultimaComa > ultimoPunto) {
      // Formato europeo: 21.874,50 -> 21874.50
      normalizado = texto.replace(/\./g, "").replace(",", ".");
    } else {
      // Formato americano/mexicano: 21,874.50 -> 21874.50
      normalizado = texto.replace(/,/g, "");
    }
  } else if (ultimaComa !== -1) {
    // Solo tiene coma: ej. '21,874' o '21,50'
    const parteTrasComa = texto.slice(ultimaComa + 1);
    if (parteTrasComa.length === 3 && (texto.match(/,/g) || []).length === 1 && !parteTrasComa.includes(".")) {
      // Es separador de miles (ej. México / USA / Coppel: 21,874 -> 21874)
      normalizado = texto.replace(/,/g, "");
    } else if (parteTrasComa.length === 2 || parteTrasComa.length === 1) {
      // Es decimal (ej. España/Sudamérica: 21,50 -> 21.50)
      normalizado = texto.replace(",", ".");
    } else {
      normalizado = texto.replace(/,/g, "");
    }
  } else if (ultimoPunto !== -1) {
    // Solo tiene punto
    const parteTrasPunto = texto.slice(ultimoPunto + 1);
    if (parteTrasPunto.length === 3 && (texto.match(/\./g) || []).length > 1) {
      // Múltiples puntos de miles: 1.234.567 -> 1234567
      normalizado = texto.replace(/\./g, "");
    } else {
      normalizado = texto;
    }
  }

  const precio = Number(normalizado);
  return Number.isFinite(precio) && precio >= 0 ? precio : null;
}

export function limpiarTexto(valor) {
  if (typeof valor !== "string") return null;
  // Eliminar bloques <style>...</style>, <script>...</script> y bloques CSS inyectados (@layer, {css:...})
  let texto = valor
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/@layer[^{]*\{[\s\S]*?\}\s*\}/gi, " ")
    .replace(/@media[^{]*\{[\s\S]*?\}\s*\}/gi, " ")
    .replace(/\.css-[^{]+\{[^}]+\}/gi, " ");

  // Eliminar cualquier etiqueta HTML remanente (ej. <span>, <br>, <strong>, etc.)
  const sinHtml = texto.replace(/<[^>]*>/g, " ");

  // Decodificar entidades comunes y normalizar espacios
  const limpio = sinHtml
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();

  // Si después de limpiar aún contiene reglas CSS como var(--, no es texto humano
  if (limpio && (limpio.includes("var(--") || limpio.includes("@layer") || limpio.includes("-webkit-"))) {
    // Si contiene texto legítimo junto a CSS, extraer la parte legible
    const partesLegibles = limpio
      .split(/[{};]/)
      .map((p) => p.trim())
      .filter((p) => p && !p.includes(":") && !p.includes("var(--") && !p.includes("@") && !p.startsWith("."));
    return partesLegibles.join(" ").trim() || null;
  }

  return limpio || null;
}
