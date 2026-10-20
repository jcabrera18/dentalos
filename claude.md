# DentalOS — Guía para Claude Code

SaaS multi-tenant de gestión para clínicas de salud (odontología primero), Argentina.
Maneja datos clínicos sensibles de usuarios reales en producción. **Tratá seguridad y aislamiento entre clínicas como requisito, no como opción.**

## Dos repos hermanos (mismo nivel de carpeta)

| Repo | Qué es | Corre en |
|------|--------|----------|
| `dentalos/web` | Frontend Next.js 16 (App Router) + React 19 | `localhost:3001` |
| `dentalos-api` | Backend Fastify 4 (TS, ESM) | `localhost:3000` |

Este repo (`dentalos/`) contiene el **frontend** (`web/`) y esta documentación. El backend vive en `../dentalos-api` y **tiene su propio `CLAUDE.md` que es la fuente de verdad del backend** — leelo antes de tocar la API.
Infra: Supabase (PostgreSQL + Auth + Storage), Upstash Redis (colas/cache), Vercel (web), Railway (API + worker).

## Arquitectura en una pantalla

```
Browser ──JWT Supabase──> Fastify API ──RLS──> Supabase/Postgres
   │  (web, React Query)        │                     │
   └── Supabase Auth directo    ├── Redis (cache/BullMQ)
       (login/sesión)           ├── Worker (notifs WhatsApp/Twilio)
                                 └── AFIP · MercadoPago · Nave (webhooks)
```

- El browser habla con Supabase Auth **directo** para la sesión, y con la API REST para **todo el dominio** (nunca escribe tablas de negocio vía Supabase client).
- La API verifica el JWT (jose + JWKS), extrae `clinic_id`/`professional_id`/`role` del token y filtra por tenant. RLS en Postgres es la segunda barrera.
- Mutaciones → React Query con updates optimistas; cache persistida en IndexedDB.

## Convenciones obligatorias

**Frontend (`web/`)**
- Toda llamada a la API pasa por `lib/api.ts` (`apiFetch`) o los hooks de `lib/queries.ts` (`authedApiFetch`). Nunca `fetch()` crudo a la API.
- Server Components para auth/guard; `'use client'` para interacción. Rutas en grupos `(app)` (privado) y `(public)`.
- Data de servidor cacheable → hook en `lib/queries.ts` con clave en `queryKeys`. No metas binarios grandes (archivos/radiografías) en el cache persistido.
- UI: Tailwind CSS 4, iconos `lucide-react`, gráficos `recharts`. Sin librería de formularios: estado con `useState` + validación manual.
- Textos de UI en **español**; nombres de código en inglés.

**Backend (`../dentalos-api/`)** — detalle en su `CLAUDE.md`
- Validación con **zod** en cada handler. Respuestas `{ data, meta? }`; errores `reply.code(n).send({ error })`.
- Imports relativos con extensión `.js` (ESM). Soft-delete con `deleted_at`.
- Elegí el cliente Supabase correcto: `supabaseForUser` (RLS activo, default) vs `supabaseAdmin` (bypassa RLS, solo interno + `.eq('clinic_id', …)` manual).

## Reglas críticas de seguridad (datos clínicos)

1. **Aislamiento por clínica**: el `clinic_id` sale **siempre del JWT**, nunca del body/query del cliente. Toda query de tenant filtra por él.
2. **RLS activo** en Postgres vía `current_clinic_id()`. Funciones `SECURITY DEFINER` y vistas requieren cuidado (ver `docs/architecture/database.md`).
3. **Secretos**: nunca en el repo ni en estos `.md`. AFIP cert/key viven en `professionals` y solo se exponen como flags `has_cert/has_key`.
4. **Archivos médicos**: bucket privado `patient-files`, sin RLS pública → solo `service_role` (la API) sirve URLs firmadas. No exponer el bucket al cliente.
5. **Webhooks** (MP/Nave/Twilio/Zapier) verifican firma/API-key y son idempotentes. No debilitar esas comprobaciones.
6. Al cerrar sesión, el cache de IndexedDB se limpia para no filtrar datos entre usuarios (`lib/queryClient.tsx`).

## Comandos

```bash
# Frontend (web/)
npm run dev        # Next dev en :3001
npm run build      # build prod
npm run lint       # eslint

# Backend (../dentalos-api/)
npm run dev        # API (tsx watch)
npm run dev:worker # worker BullMQ (notificaciones)
npm run build      # tsc → dist/
npm run migrate    # aplica migraciones SQL (--reset para reiniciar)
npm test           # vitest  (⚠ hoy no hay tests escritos)
npm run lint
```

No hay tests automatizados todavía (ver `docs/development/testing.md`).

## Cómo ubicar archivos relacionados ante una tarea

1. **Página/feature del frontend** → `web/app/(app)/<área>/…`. Componentes compartidos en `web/components/`.
2. **Qué endpoint usa una página** → `docs/reference/dependency-map.md`.
3. **Qué hace un endpoint / dónde está** → `docs/reference/api-map.md` → `../dentalos-api/src/modules/<módulo>/routes.ts`.
4. **Tablas / RLS / RPC afectadas** → `docs/architecture/database.md` → `../dentalos-api/src/supabase/migrations/`.
5. **Regla de negocio** → `docs/business/business-rules.md`.

## Índice de documentación (cargá solo lo necesario)

| Archivo | Cuándo leerlo |
|---------|---------------|
| `docs/architecture/overview.md` | Entender el sistema completo / flujo de datos |
| `docs/architecture/frontend.md` | Trabajar en `web/` (rutas, hooks, auth, cache) |
| `docs/architecture/backend.md` | Trabajar en la API (resumen; detalle en `../dentalos-api/CLAUDE.md`) |
| `docs/architecture/database.md` | Tablas, vistas, RPC, RLS, buckets |
| `docs/architecture/integrations.md` | Twilio, AFIP, MercadoPago, Nave, Zapier, PostHog |
| `docs/business/modules.md` | Qué módulos existen y su estado real |
| `docs/business/business-rules.md` | Reglas de pagos, agenda, planes, facturación |
| `docs/development/conventions.md` | Patrones de código detallados |
| `docs/development/workflows.md` | Cómo correr, deployar, agregar features |
| `docs/development/testing.md` | Estado de testing y cómo validar cambios |
| `docs/reference/api-map.md` | Catálogo completo de endpoints |
| `docs/reference/dependency-map.md` | Mapa página ↔ endpoint ↔ tabla |

## Trabajar con mínimos tokens (progressive disclosure)

- **Primero este archivo**, después solo el doc del área afectada. No leas todo `docs/`.
- Usá los mapas de `docs/reference/` para saltar directo al archivo correcto en vez de explorar.
- Buscá por símbolo/ruta/patrón (`grep`), no leas archivos enteros. Excluí `node_modules`, `.next`, `dist`.
- `web/app/(app)/agenda/page.tsx` y `patients/[id]/PatientDetailClient.tsx` son archivos grandes (>1k líneas): leé por rangos, no completos.
- No repitas en tus respuestas arquitectura ya documentada; referenciá el `.md`.
- Distinguí hechos verificados de hipótesis.

## Mantenimiento de esta documentación

Actualizá solo el doc afectado, sin reescribir el resto:
- Cambió/nació un endpoint → `reference/api-map.md` (+ `dependency-map.md` si una página lo usa).
- Cambió una regla de negocio → `business/business-rules.md`.
- Nuevo módulo → `business/modules.md`.
- Cambió la arquitectura → `architecture/*`.
- Cambió una convención global o regla de seguridad → este `CLAUDE.md`.

No modifiques código de producción, migraciones ni configs al documentar.
