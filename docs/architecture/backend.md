# Arquitectura — Backend (`../dentalos-api/`)

> **Fuente de verdad:** `../dentalos-api/CLAUDE.md`. Este archivo es un resumen para orientarte desde el repo del frontend. Para tocar la API, leé el CLAUDE.md del backend.

Fastify 4, Node ≥20, TypeScript **ESM** (`"type":"module"` → imports relativos con extensión `.js`). `tsconfig` con `strict: false`.

## Procesos

- `src/server.ts` — HTTP. Bootstrap: helmet, CORS (`ALLOWED_ORIGINS`), rate-limit global (200/min/IP, **in-memory**, no compartido entre instancias), decorator `authenticate`, registro de routers por módulo con prefijo, error handler global (ZodError → 400), graceful shutdown, warm-up + keep-alive de Supabase. Swagger en `/docs` solo fuera de producción.
- `src/worker.ts` — proceso **separado** (Railway service aparte) que corre el worker BullMQ de notificaciones. No vive dentro del HTTP.

## Capas

No hay separación estricta controller/service/repository: cada módulo es `src/modules/<m>/routes.ts` con la lógica adentro (deuda técnica reconocida "god routes" — D1). Excepciones con lógica extraída: `notifications/{service,quota,inbox}.ts`, `subscription/plans.ts`, `lib/afip*.ts`, `lib/invoice-pdf.ts`.

- `src/lib/supabase.ts` — **dos clientes**: `supabaseForUser(authHeader)` (RLS activo, default para rutas autenticadas, cacheado por token) y `supabaseAdmin` (service_role, **bypassa RLS**; solo webhooks/worker/onboarding + `.eq('clinic_id',…)` manual).
- `src/lib/redis.ts` — `redisGet/Set/Del`, **fail-soft** (si Redis cae, devuelven null/no-op y el caller va a la DB).
- `src/lib/afip-wsaa.ts` (ticket WSAA), `afip-wsfev1.ts` (CAE), `afip.ts`, `invoice-pdf.ts` (PDF+QR).
- `src/types/database.ts` — tipos TS de las tablas.

## Auth y multi-tenancy (lo más importante)

- `authenticate` verifica el JWT de Supabase con **jose + JWKS** (no usa `@fastify/jwt` salvo placeholder) y extrae a `request`: `clinicId` ← `user_metadata.clinic_id`, `professionalId` ← `user_metadata.professional_id` (o `sub`), `userRole` ← `user_metadata.role`.
- **Toda query de tenant filtra por el `clinic_id` del JWT**, nunca por valores del cliente.
- Roles: `owner`, `admin`, `professional`, `receptionist`.

## Módulos (prefijo de ruta)

`auth`, `patients`, `appointments`, `payments` (+quotes legacy), `quotes`, `treatments` (odontograma/sesiones/diagnósticos), `invoices` (AFIP), `finance` (KPIs/analytics/movimientos vía RPC), `expenses`, `professionals` (+invites, settings WhatsApp, config AFIP), `subscription`, `notifications` (+inbox in-app +webhooks Twilio), `consents`, `schedule-blocks`, `integrations` (Zapier), `booking` (**público** `/public/booking`), `mercadopago`, `nave`. Catálogo de rutas: `../reference/api-map.md`.

## Convenciones de la API

- Validación con **zod** en cada handler (`Schema.parse(request.body/query)`).
- Respuestas `{ data, meta? }`; errores `reply.code(n).send({ error })`.
- Soft-delete con `deleted_at` (pacientes, pagos). Filtrar `.is('deleted_at', null)`.
- Paginación `limit`/`offset` con `range()`; columnas explícitas en listados (no `SELECT *`).
- Zona horaria de negocio hardcodeada **America/Argentina/Buenos_Aires** (UTC-3). Cuidado al armar rangos de día (deuda D3).

## Booking atómico / concurrencia

Crear turnos **siempre** vía RPC `book_appointment` (migración 029): `SELECT … FOR UPDATE` sobre el profesional + chequeo de disponibilidad + insert en una transacción → sin doble-booking. Error `P0001` = slot ocupado → responder 409. Lo usan `appointments`, `booking` e `integrations`.

## Caches Redis (clave → TTL)

`dash:<clinic>:<prof>:<date>` 2min · `me:<prof>:<clinic>` 5min · `sub:<clinic>` 24h · `prof:list:<clinic>` 5min · `wa:<clinic>` 5min · `patient:*` 2–30min · cuota WhatsApp (contador atómico). Al mutar, invalidar con `redisDel`.

## Variables de entorno (solo nombres)

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `REDIS_URL`, `ALLOWED_ORIGINS`, `APP_URL`/`FRONTEND_URL`, `API_BASE_URL`, `PORT`, `NODE_ENV`, `LOG_LEVEL`, `TWILIO_*`, `MP_ACCESS_TOKEN`/`MP_WEBHOOK_SECRET`, `NAVE_*`, `ZAPIER_API_KEY`/`ZAPIER_CLINIC_ID`, `WHATSAPP_SHARED_BRAND`. `.env` no trackeado.

## Deuda técnica (de la auditoría)

God routes (D1), `request as any` sin tipar (D2), timezone hardcodeada (D3), lógica duplicada quotes↔payments (D4), Zapier fuera de alcance. Detalle en `../dentalos-api/.claude/auditoria_tecnica.md`.
