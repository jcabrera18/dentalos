# Desarrollo — Convenciones

## Idioma
- Textos de UI y comentarios de negocio en **español**. Nombres de código (variables, funciones, tipos) en **inglés**.

## Frontend (`web/`)
- **Nunca** `fetch()` crudo a la API: usá `apiFetch` (`lib/api.ts`) o un hook de `lib/queries.ts` (`authedApiFetch`).
- Token: usá `getToken()` (`lib/supabase.ts`), no leas `session.access_token` directo.
- Data de servidor cacheable → nuevo hook en `lib/queries.ts` con su clave en `queryKeys`. Mutaciones que cambian data visible → update optimista + `invalidateQueries` en `onSettled`.
- Mantené disjuntas las claves de lista vs detalle (`['patients','list']` vs `['patient',id]`).
- Si cambia la forma de un dato cacheado en IndexedDB, subí `CACHE_BUSTER` en `lib/queryClient.tsx`.
- `POST` sin cuerpo real igual necesita `body: '{}'` (Fastify rechaza JSON vacío con `FST_ERR_CTP_EMPTY_JSON_BODY`) — ver ejemplos en `lib/queries.ts`.
- Binarios grandes (archivos de pacientes) fuera del cache persistido.
- Server Components para guard/SSR; `'use client'` solo donde hay interacción/estado.
- UI: Tailwind CSS 4, `lucide-react`, `recharts`. Formularios con `useState` + validación manual (no hay lib de forms).

## Backend (`../dentalos-api/`) — resumen (detalle en su CLAUDE.md)
- ESM: imports relativos con extensión `.js`.
- zod para validar `request.body/query` en cada handler. Respuestas `{ data, meta? }`; errores `reply.code(n).send({ error })`.
- Cliente Supabase correcto: `supabaseForUser` por defecto (RLS); `supabaseAdmin` solo interno + filtro `clinic_id` manual.
- `clinic_id` **siempre del JWT**. Soft-delete con `deleted_at`. Paginación `limit`/`offset` + columnas explícitas.
- Invalidar la clave Redis correspondiente al mutar.

## Git / PRs
- Branch por defecto: `main`. Commits concisos; el repo mezcla español e inglés en mensajes (ver historial).
- No commitear `.env` ni secretos. No incluir datos clínicos reales en código, fixtures ni docs.

## Seguridad (recordatorio permanente)
- No romper el aislamiento multi-tenant ni debilitar validaciones de webhooks.
- No exponer `supabaseAdmin`, service_role, cert/key AFIP ni el bucket `patient-files` al cliente.
- Ver `architecture/database.md` para RLS, `security_invoker` en vistas y `SECURITY DEFINER`.
