import dns from "node:dns/promises";
import net from "node:net";

const HOSTS_BLOQUEADOS = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata.google.internal",
  "instance-data.ec2.internal",
]);

function esIpNoPublica(direccion) {
  const tipo = net.isIP(direccion);
  if (tipo === 4) {
    const [a, b] = direccion.split(".").map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
  }
  if (tipo === 6) {
    const normalizada = direccion.toLowerCase();
    return normalizada === "::1" || normalizada === "::" ||
      normalizada.startsWith("fc") || normalizada.startsWith("fd") ||
      normalizada.startsWith("fe80:");
  }
  return false;
}

export function normalizarUrl(valor) {
  if (typeof valor !== "string" || valor.trim() === "") {
    throw new Error("La URL es obligatoria.");
  }

  let url;
  try {
    url = new URL(valor.trim());
  } catch {
    throw new Error("La URL no tiene un formato válido.");
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Solo se permiten URLs HTTP y HTTPS.");
  }
  if (url.username || url.password) {
    throw new Error("No se permiten credenciales dentro de la URL.");
  }
  return url;
}

export async function validarDestino(url) {
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (HOSTS_BLOQUEADOS.has(host) || esIpNoPublica(host)) {
    throw new Error("El destino está bloqueado por seguridad.");
  }

  const resultados = await dns.lookup(host, { all: true, verbatim: true });
  if (resultados.length === 0 || resultados.some(({ address }) => esIpNoPublica(address))) {
    throw new Error("El destino resuelve a una dirección no pública.");
  }
}
