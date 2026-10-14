import cors from "cors";
import express from "express";
import { registrarRutasProductos } from "./rutas/rutasProductos.js";
import { registrarRutasPersistenciaProductos } from "./rutas/rutasPersistenciaProductos.js";
import { registrarRutasSeguimientos } from "./rutas/rutasSeguimientos.js";
import { registrarRutasAuth } from "./rutas/rutasAuth.js";

const app = express();

const origenesPermitidos = (process.env.ORIGEN_FRONTEND ?? "http://localhost:5173")
  .split(",")
  .map((o) => o.trim());

app.use(cors({
  origin: (origin, callback) => {
    // Permitir solicitudes sin origen (como clientes de API, curl o apps móviles)
    if (!origin) return callback(null, true);
    // Permitir orígenes configurados o cualquier puerto local en desarrollo
    if (
      origenesPermitidos.includes(origin) ||
      /^http:\/\/localhost:\d+$/.test(origin) ||
      /^http:\/\/127\.0\.0\.1:\d+$/.test(origin)
    ) {
      return callback(null, true);
    }
    return callback(new Error("No permitido por CORS"));
  },
  credentials: true,
}));
app.use(express.json({ limit: "10mb" }));
registrarRutasAuth(app);
registrarRutasProductos(app);
registrarRutasPersistenciaProductos(app);
registrarRutasSeguimientos(app);

app.get("/api/salud", (_solicitud, respuesta) => {
  respuesta.json({
    estado: "ok",
    servicio: "backend",
    fecha: new Date().toISOString(),
  });
});

app.use((_solicitud, respuesta) => {
  respuesta.status(404).json({
    error: "Ruta no encontrada",
  });
});

app.use((error, _solicitud, respuesta, _siguiente) => {
  console.error(error.message);
  if (error.type === "entity.parse.failed") {
    return respuesta.status(400).json({ error: "El cuerpo JSON no tiene un formato válido." });
  }
  return respuesta.status(422).json({ error: error.message });
});

export default app;
