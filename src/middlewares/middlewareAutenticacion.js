import { verificarToken } from "../utilidades/seguridadAuth.js";

/**
 * Middleware para autenticar usuarios mediante Bearer token
 */
export function middlewareAutenticacion(solicitud, respuesta, siguiente) {
  const encabezadoAuth = solicitud.headers.authorization;
  if (!encabezadoAuth || !encabezadoAuth.startsWith("Bearer ")) {
    return respuesta.status(401).json({ error: "No autorizado. Inicia sesión para continuar." });
  }

  const token = encabezadoAuth.slice(7).trim();
  const usuario = verificarToken(token);

  if (!usuario) {
    return respuesta.status(401).json({ error: "Sesión inválida o expirada. Inicia sesión nuevamente." });
  }

  solicitud.usuario = usuario;
  siguiente();
}
