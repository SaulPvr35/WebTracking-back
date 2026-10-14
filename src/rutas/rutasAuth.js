import { z } from "zod";
import prisma from "../config/baseDatos.js";
import { firmarToken, hashearPassword, verificarPassword } from "../utilidades/seguridadAuth.js";
import { middlewareAutenticacion } from "../middlewares/middlewareAutenticacion.js";

const esquemaRegistro = z.object({
  nombre: z.string().trim().min(2, "El nombre debe tener al menos 2 caracteres."),
  email: z.string().trim().email("El correo electrónico no es válido.").toLowerCase(),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres."),
});

const esquemaLogin = z.object({
  email: z.string().trim().email("El correo electrónico no es válido.").toLowerCase(),
  password: z.string().min(1, "La contraseña es requerida."),
});

export function registrarRutasAuth(app) {
  // POST /api/auth/registro
  app.post("/api/auth/registro", async (solicitud, respuesta, siguiente) => {
    const validacion = esquemaRegistro.safeParse(solicitud.body);
    if (!validacion.success) {
      return respuesta.status(400).json({
        error: "Datos de registro inválidos.",
        detalles: validacion.error.issues.map((i) => i.message),
      });
    }

    const { nombre, email, password } = validacion.data;

    try {
      const existente = await prisma.usuario.findUnique({ where: { email } });
      if (existente) {
        return respuesta.status(409).json({ error: "Ya existe una cuenta con este correo electrónico." });
      }

      const passwordHash = hashearPassword(password);
      const usuario = await prisma.usuario.create({
        data: {
          nombre,
          email,
          passwordHash,
        },
        select: {
          id: true,
          nombre: true,
          email: true,
          fechaCreacion: true,
        },
      });

      const token = firmarToken({ id: usuario.id, email: usuario.email, nombre: usuario.nombre });

      return respuesta.status(201).json({
        mensaje: "Registro exitoso",
        usuario,
        token,
      });
    } catch (error) {
      return siguiente(error);
    }
  });

  // POST /api/auth/login
  app.post("/api/auth/login", async (solicitud, respuesta, siguiente) => {
    const validacion = esquemaLogin.safeParse(solicitud.body);
    if (!validacion.success) {
      return respuesta.status(400).json({
        error: "Datos de inicio de sesión inválidos.",
        detalles: validacion.error.issues.map((i) => i.message),
      });
    }

    const { email, password } = validacion.data;

    try {
      const usuario = await prisma.usuario.findUnique({ where: { email } });
      if (!usuario || !verificarPassword(password, usuario.passwordHash)) {
        return respuesta.status(401).json({ error: "Correo o contraseña incorrectos." });
      }

      const token = firmarToken({ id: usuario.id, email: usuario.email, nombre: usuario.nombre });

      return respuesta.json({
        mensaje: "Inicio de sesión correcto",
        usuario: {
          id: usuario.id,
          nombre: usuario.nombre,
          email: usuario.email,
        },
        token,
      });
    } catch (error) {
      return siguiente(error);
    }
  });

  // GET /api/auth/perfil
  app.get("/api/auth/perfil", middlewareAutenticacion, async (solicitud, respuesta) => {
    return respuesta.json({
      usuario: solicitud.usuario,
    });
  });
}
