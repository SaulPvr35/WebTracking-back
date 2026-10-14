# WebTracking - Backend API

API REST y motor de extracción/monitoreo de precios y productos en comercio electrónico (MercadoLibre, Amazon, Bodega Aurrera, Walmart, tiendas genéricas e inspección DOM vía Playwright).

## Características principales
- **Extracción de datos:** Adaptadores dedicados por tienda, extracción de metadatos OpenGraph, JSON-LD estructurado y selectores CSS/XPath.
- **Inspector Visual tipo F12:** Renderizado seguro de DOM y proxy de estilos con bypass anti-bot para selección visual de campos interactivos.
- **Monitoreo automatizado:** Cron job / planificador de intervalos para chequeo periódico de precios.
- **Consultas en demanda:** Re-extracción en vivo por API para verificar variaciones de precios y promociones al instante.
- **Historial cronológico:** Registro de evoluciones de precios y eventos de consulta en SQLite mediante Prisma ORM.

## Tecnologías
- **Node.js** (ES Modules)
- **Express**
- **Playwright** (Chromium headless + stealth)
- **Cheerio**
- **Prisma ORM** (SQLite)
- **Node-Cron**
- **Zod** (Validación de esquemas)

## Configuración y ejecución
1. Instalar dependencias:
   ```bash
   npm install
   ```
2. Configurar variables de entorno:
   Copiar `.env.example` a `.env`
3. Ejecutar migraciones de Prisma:
   ```bash
   npx prisma migrate dev
   ```
4. Iniciar servidor en desarrollo:
   ```bash
   npm run dev
   ```
