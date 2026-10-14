import crypto from "node:crypto";

const ITERACIONES = 10000;
const LONGITUD_CLAVE = 64;
const DIGEST = "sha512";
const SECRETO_JWT = process.env.SECRETO_AUTH ?? "hacerweb-clave-secreta-local-2026";

/**
 * Genera un hash seguro para la contraseña con salt aleatorio
 */
export function hashearPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, LONGITUD_CLAVE).toString("hex");
  return `${salt}:${hash}`;
}

/**
 * Verifica si la contraseña coincide con el hash guardado
 */
export function verificarPassword(password, hashAlmacenado) {
  if (!hashAlmacenado || !hashAlmacenado.includes(":")) return false;
  const [salt, hashOriginal] = hashAlmacenado.split(":");
  const hashCalculado = crypto.scryptSync(password, salt, LONGITUD_CLAVE).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(hashCalculado, "hex"), Buffer.from(hashOriginal, "hex"));
}

/**
 * Genera un token HMAC firmado (sin necesidad de librerías externas)
 */
export function firmarToken(payload) {
  const encabezado = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const cuerpo = Buffer.from(JSON.stringify({
    ...payload,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 7, // 7 días de validez
  })).toString("base64url");

  const firma = crypto.createHmac("sha256", SECRETO_JWT)
    .update(`${encabezado}.${cuerpo}`)
    .digest("base64url");

  return `${encabezado}.${cuerpo}.${firma}`;
}

/**
 * Verifica y descifra el token
 */
export function verificarToken(token) {
  if (!token || typeof token !== "string") return null;
  const partes = token.split(".");
  if (partes.length !== 3) return null;

  const [encabezado, cuerpo, firma] = partes;
  const firmaEsperada = crypto.createHmac("sha256", SECRETO_JWT)
    .update(`${encabezado}.${cuerpo}`)
    .digest("base64url");

  if (!crypto.timingSafeEqual(Buffer.from(firma), Buffer.from(firmaEsperada))) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(cuerpo, "base64url").toString("utf8"));
    if (payload.exp && Date.now() > payload.exp) return null; // Expirado
    return payload;
  } catch {
    return null;
  }
}
