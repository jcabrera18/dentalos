# Arquitectura — Frontend (`web/`)

Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4. Puerto dev `3001`.

## Estructura de rutas (`web/app/`)

Grupos de App Router:
- `(public)/` — sin sesión: `login`, `register`, `auth/{confirm,forgot-password,reset-password}`, `booking/[professionalId]`, landing `page.tsx`.
- `(app)/` — privado, protegido por `layout.tsx`: `dashboard`, `agenda`, `patients` (+ `[id]` detalle, `appointment`, `clinical-history`, `consents`, `quotes`), `settings`, `stats/{financial,clinical}`.
- `providers.tsx` — tema, `PlansModalProvider`. `providers/{posthog,pageview}.tsx` — analytics.
- `layout.tsx` (raíz) — fuentes, providers globales, `QueryProvider`.

El `(app)/layout.tsx` es el **shell** autenticado: navegación, guard de sesión, banners de trial/plan, modal de planes y flujo de pago de suscripción (Nave/MercadoPago). Es un archivo grande (>1k líneas) — leé por rangos.

## Autenticación (cliente)

- `lib/supabase.ts` — `createClient()` (browser singleton) y `getToken()` (devuelve access token fresco, refresca si faltan <60s para expirar). **Preferí `getToken()`** sobre leer `session.access_token`.
- `lib/supabase-server.ts` — `createServerSupabaseClient()` para Server Components (lee cookies).
- El guard de ruta vive en `(app)/layout.tsx` vía `onAuthStateChange`; redirige a `/login` sin sesión.
- No hay roles aplicados en el frontend más allá de lo que la API permite; la autorización real es server-side.

## Comunicación con la API

- `lib/api.ts` → `apiFetch(path, { token?, ...opts })`. Agrega `Authorization`, `cache: 'no-store'`, parsea `{ data }`, mapea errores a mensajes amigables en español (`getFriendlyApiError`), y **reintenta una vez** refrescando el token ante un 401.
- `lib/queries.ts` → `authedApiFetch(path, opts)` resuelve el token con `getToken()` y delega en `apiFetch`. Base de todos los hooks de React Query.
- Nunca hagas `fetch()` directo a la API: perdés refresh de token, manejo de errores y tipos.

## State management / data fetching

- **React Query** (`@tanstack/react-query`) es el store de datos de servidor. Config en `lib/queryClient.tsx`:
  - `staleTime` 30s, `networkMode: 'offlineFirst'`, refetch on focus/reconnect, retry 2.
  - **Persistencia en IndexedDB** (`idb-keyval`, store `dentalos-cache`) vía `PersistQueryClientProvider`. `maxAge` 24h, `buster: CACHE_BUSTER` (subilo si cambia la forma de los datos cacheados). Solo persiste queries en estado `success`.
  - Al `SIGNED_OUT` limpia el cache (no filtrar datos entre usuarios).
- **Claves de cache** centralizadas en `queryKeys` (`lib/queries.ts`). La lista de pacientes (`['patients','list',q]`) y el detalle (`['patient',id,...]`) son prefijos **disjuntos** a propósito: invalidar la lista no toca el detalle.
- **Mutaciones optimistas**: `useUpdateAppointmentStatus`, `useMarkNotificationRead`, `useMarkAllNotificationsRead` pintan al instante y revierten en `onError`.
- **Caches fuera de React Query** (singletons con TTL): `useSubscription` (1h), `fetchProfile` (`profileCache.ts`, 5min). Invalidalos con `invalidateSubscriptionCache()` / `invalidateProfileCache()` tras mutar.

## Offline / cache local de pacientes

- `lib/patientsLocalDb.ts` + `lib/useLocalPatients.ts` espejan la cartera de pacientes en IndexedDB y permiten **búsqueda local** (full la 1ª vez, delta vía `GET /patients/sync` después). Pinta lo persistido al instante y sincroniza en background.
- **Archivos/radiografías NO se cachean** (binarios grandes): los maneja `components/PatientFilesSection.tsx` aparte.

## Formularios y validación

No hay librería de formularios. Estado con `useState`, validación manual en el submit. La validación fuerte es server-side (zod en la API). Al agregar un form, seguí ese patrón.

## UI y convenciones

- Tailwind CSS 4 (`@tailwindcss/postcss`), `globals.css`. Tema claro/oscuro via `useAppTheme` (`providers.tsx`).
- Iconos `lucide-react`; gráficos `recharts` (stats); PDFs con `@react-pdf/renderer` (`ClinicalHistoryPDF.tsx`) y canvas (`generateReceipt.ts`); QR con `qrcode`.
- `NavigationProgress` da feedback de navegación. Textos de UI en español.

## Variables de entorno (solo nombres)

`NEXT_PUBLIC_API_URL` (base de la API) · `NEXT_PUBLIC_SUPABASE_URL` · `NEXT_PUBLIC_SUPABASE_ANON_KEY` · `NEXT_PUBLIC_POSTHOG_KEY` · `NEXT_PUBLIC_POSTHOG_HOST`.
