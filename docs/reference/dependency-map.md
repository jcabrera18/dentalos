# Dependency Map — página ↔ endpoint ↔ tabla

Mapa compacto para saber, antes de tocar algo, qué se ve afectado. Verificado contra el código
(grep de `apiFetch`/`authedApiFetch` en `web/app` y `web/components`).

Convención: **archivo frontend** → `endpoints API` → *tablas/vistas principales*.

## Páginas privadas — `web/app/(app)/`

| Página | Endpoints | Tablas/vistas |
|--------|-----------|---------------|
| `layout.tsx` (shell, planes, pagos) | `/subscription/status`, `/nave/preference`, `/nave/payment-status`, `/mercadopago/preference`, `/professionals/invite` | `clinics`, `nave_payments`, `mp_payments`, `professional_invites` |
| `dashboard/page.tsx` | `/appointments/dashboard`, `/appointments/:id/complete`, `/payments` | `appointments`, `v_daily_agenda`, `payments`, `treatments` |
| `agenda/page.tsx` | `/appointments` (CRUD + `/calendar`), `/patients`, `/schedule-blocks` | `appointments`, `schedule_blocks`, `patients` |
| `patients/page.tsx` | `/patients` | `patients` (+ `search_patients`) |
| `patients/[id]/PatientDetailClient.tsx` | `/patients/:id`(+`/account-summary`), `/payments`, `/invoices`, `/consents`(+`/templates`), `/treatments/odontogram`, `/treatments/tooth-diagnostics` | `patients`, `payments`, `invoices`, `consents`, `odontogram`, `tooth_diagnostics`, `v_patient_account_summary` |
| `patients/[id]/appointment/page.tsx` | `/appointments`, `/professionals`, `/patients/:id`, `/auth/me` | `appointments`, `professionals` |
| `patients/[id]/clinical-history/page.tsx` | `/patients/:id/clinical-history`(+`/signatures`), `/patients/:id`, `/auth/me` | `patients` (JSONB historia), `clinical_history_signatures` |
| `patients/[id]/consents/page.tsx` | `/consents`(+`/templates`), `/patients/:id`, `/auth/me` | `consents`, `consent_templates`, `global_consent_templates` |
| `patients/[id]/quotes/page.tsx` | `/quotes`, `/professionals`, `/patients/:id` | `quotes`, `professionals` |
| `settings/page.tsx` | `/auth/me`, `/professionals`(+`/:id`,`/invite`), `/professionals/me/afip-config` | `professionals`, `clinics`, `professional_invites` |
| `stats/clinical/page.tsx` | `/appointments/stats/clinical`, `/appointments/stats/period`, `/patients?limit=1` | `appointments`, `clinical_stats` RPC |
| `stats/financial/page.tsx` | `/finance/kpis`, `/finance/movements`, `/expenses`, `/invoices`, `/payments`, `/professionals`, `/professionals/me/afip-config` | `payments`, `expenses`, `invoices`, `finance_*` RPC, `v_daily_cash` |

## Componentes compartidos — `web/components/`

| Componente | Endpoints | Nota |
|------------|-----------|------|
| `PaymentModal.tsx` | `/patients`(+`/account-summary`), `/patients?q=` | Alta de pago + saldo cta. corriente |
| `InvoiceModal.tsx` | `/invoices` | Emisión AFIP |
| `PatientFilesSection.tsx` | `/patients/:id/files` | Binarios — **fuera** del cache persistido |
| `PatientAppointmentsSection.tsx` | `/appointments/:id` | — |
| `PatientNotesSection.tsx` | `/patients/:id` | — |
| `NotificationBell.tsx` | `/notifications/inbox*` (vía `lib/queries.ts`) | Poll 30s del unread-count |

## Páginas públicas — `web/app/(public)/`

| Página | Endpoints |
|--------|-----------|
| `login`, `register`, `auth/*` | `/auth/register`, `/auth/forgot-password`, `/professionals/invite/:token` (+ Supabase Auth directo) |
| `booking/[professionalId]` | `/public/booking/:professionalId`(+`/slots`, `POST`) |

## Hooks de datos — `web/lib/queries.ts`

`useMe` → `/auth/me` · `useDashboard` → `/appointments/dashboard` · `useProfessionals` → `/professionals` · `useCalendar` → `/appointments/calendar` · `usePatients` → `/patients` · `usePatientOdontogram`/`usePatientDiagnostics` → `/treatments/*` · `useAfipConfig` → `/professionals/me/afip-config` · `useUnreadNotificationsCount`/`useNotificationsInbox` → `/notifications/inbox*` · `useUpdateAppointmentStatus` → `PATCH /appointments/:id`.
Cache fuera de React Query: `useSubscription` (TTL 1h, módulo), `fetchProfile` (`profileCache.ts`, TTL 5min), `useLocalPatients` (IndexedDB vía `patientsLocalDb.ts`).

## Reglas de impacto (qué revisar al cambiar X)

- **Un endpoint** → buscá su ruta en la tabla de arriba para ver qué páginas/hook rompe; mirá también `queryKeys` en `lib/queries.ts` (invalidación de cache).
- **Una tabla / RLS / RPC** → ver `architecture/database.md`; impacta a todos los endpoints que la leen.
- **Forma de un dato cacheado** → subí `CACHE_BUSTER` en `lib/queryClient.tsx` (invalida IndexedDB).
