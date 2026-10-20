# Desarrollo — Workflows

## Correr en local
```bash
# Frontend (web/)
npm install && npm run dev     # → http://localhost:3001

# Backend (../dentalos-api/)
npm install
npm run dev                    # API → http://localhost:3000  (Swagger en /docs fuera de prod)
npm run dev:worker             # worker de notificaciones (proceso aparte)
npm run migrate                # aplica migraciones SQL (--reset para reiniciar)
```
El frontend necesita `NEXT_PUBLIC_API_URL` apuntando a la API. Variables en `architecture/frontend.md` y `backend.md`.

## Agregar una feature (flujo recomendado, mínimos tokens)
1. Identificá el módulo afectado (`business/modules.md`).
2. Mirá qué páginas/endpoints/tablas toca (`reference/dependency-map.md`, `reference/api-map.md`).
3. Abrí solo esos archivos (por rangos si son grandes).
4. Backend primero si hace falta endpoint/validación/migración; después frontend.
5. Frontend: endpoint nuevo → hook en `lib/queries.ts` (+ `queryKeys`); UI con el patrón existente.
6. Validá (`development/testing.md`): `npm run lint` en ambos, `npm run build`, prueba manual.
7. Actualizá el doc afectado (ver reglas de mantenimiento en `CLAUDE.md`).

## Cambiar el esquema de datos
Nueva migración numerada en `../dentalos-api/src/supabase/migrations/` → `npm run migrate`. Si tocás una vista, re-aplicá `security_invoker=true` (ver `database.md`). Actualizá `database.md`.

## Deploy
- **Frontend** → Vercel (push a `main`). Build `next build`.
- **Backend** → Railway (Nixpacks), **dos servicios**: HTTP (`npm start` → `dist/server.js`) y worker (`npm run start:worker` → `dist/worker.js`). Requiere `npm run build` (tsc) previo.
- **DB** → Supabase (migraciones vía `npm run migrate`).

## Debug útil
- Swagger de la API en `/docs` (solo fuera de producción).
- Logs estructurados con Pino (`request.log`, correlation IDs).
- Redis fail-soft: si Redis no está, la API sigue andando contra la DB (más lento).
