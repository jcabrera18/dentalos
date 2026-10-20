# Arquitectura — Overview

## Topología

DentalOS son **dos repos independientes** al mismo nivel de carpeta:

- `dentalos/` → frontend (`web/`) + esta documentación + migraciones espejo (histórico; las vivas están en la API).
- `dentalos-api/` → backend REST + worker + migraciones SQL **fuente de verdad** (`src/supabase/migrations/`).

Servicios externos: **Supabase** (Postgres + Auth + Storage), **Upstash Redis** (cache + colas BullMQ), **Twilio** (WhatsApp), **AFIP** (facturación electrónica), **MercadoPago** y **Nave** (cobro de suscripciones), **PostHog** (analytics). Deploy: **Vercel** (web), **Railway** (API + worker, dos servicios separados).

## Flujo de datos

1. **Sesión**: el browser autentica **directo** contra Supabase Auth (`@supabase/ssr`). Obtiene un JWT de Supabase con `user_metadata` (`clinic_id`, `professional_id`, `role`).
2. **Dominio**: todo lo demás va a la **API REST** con `Authorization: Bearer <jwt>`. El frontend **no** escribe tablas de negocio vía Supabase client.
3. **API**: `authenticate` (en `server.ts`) verifica el JWT con **jose + JWKS**, extrae el tenant del token y lo expone en `request.clinicId/professionalId/userRole`.
4. **DB**: la API usa `supabaseForUser` (RLS activo) por defecto. RLS en Postgres filtra por `current_clinic_id()`. `supabaseAdmin` (service_role) solo para webhooks/worker/onboarding, siempre con filtro `clinic_id` manual.
5. **Async**: al crear/reprogramar turnos, la API encola notificaciones en Redis/BullMQ; el **worker** (proceso aparte) las renderiza y envía por Twilio.
6. **Webhooks entrantes**: MercadoPago, Nave y Twilio pegan a la API (firma verificada + idempotencia).

```
┌─────────┐   Supabase Auth (JWT)        ┌──────────────┐
│ Browser │ ───────────────────────────▶ │ Supabase     │
│ (Next)  │                              │ Auth+DB+Store│
│         │   REST + Bearer JWT          └──────┬───────┘
│ React   │ ──────────────┐                     │ RLS
│ Query   │               ▼                     │
│ IndexedDB│        ┌─────────────┐  RLS  ┌─────▼──────┐
└─────────┘        │ Fastify API │──────▶│ Postgres   │
                   │  (Railway)  │       └────────────┘
                   └──┬───┬───┬──┘
          Redis/BullMQ│   │   │ webhooks (MP/Nave/Twilio)
                  ┌───▼─┐ │ ┌─▼────────────┐
                  │Worker│ │ │ AFIP/MP/Nave │
                  └──────┘ │ └──────────────┘
                     Twilio WhatsApp
```

## Multi-tenancy

Cada fila de negocio tiene `clinic_id`. El aislamiento se garantiza en **dos capas**: (1) la API filtra por el `clinic_id` del JWT; (2) RLS en Postgres. Nunca se confía en un `clinic_id` del body/query. Detalle en `database.md` y en `../dentalos-api/CLAUDE.md`.

## Dónde profundizar

- Frontend: `frontend.md` · Backend: `backend.md` (+ `../dentalos-api/CLAUDE.md`)
- Datos/RLS: `database.md` · Integraciones: `integrations.md`
- Qué hace cada módulo de negocio: `../business/modules.md`
