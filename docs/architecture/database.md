# Arquitectura — Base de datos (Supabase/Postgres)

Fuente de verdad: `../dentalos-api/src/supabase/migrations/*.sql` (numeradas 001→050, aplicadas con `npm run migrate`). Las migraciones en `dentalos/{supabase/` son histórico espejo — **no** son las vivas.

## Tablas (todas con `clinic_id` salvo las globales)

| Tabla | Rol |
|-------|-----|
| `clinics` | Tenant raíz. `settings` JSONB incluye config WhatsApp. |
| `professionals` | Usuarios/profesionales de la clínica. Guarda `afip_cert`/`afip_key` (**sensible**). |
| `professional_invites` | Invitaciones por token para sumar profesionales. |
| `patients` | Pacientes. Historia clínica como JSONB (alerts + notas). Soft-delete `deleted_at`. |
| `appointments` | Turnos. Estados vía enum `appointment_status`. |
| `schedule_blocks` | Bloqueos de agenda (no disponible). |
| `treatments`, `treatment_sessions` | Tratamientos y sus sesiones. |
| `odontogram`, `tooth_diagnostics` | Odontograma por diente y diagnósticos (`tooth_diagnostics` creada fuera de migraciones; RLS asegurada en 027). |
| `payments` | Libro contable. **Soft-delete** (30) — nunca se borra físico. |
| `quotes` | Presupuestos (módulo 026). Numeración vía `generate_quote_number`. |
| `invoices` + items | Facturas AFIP con CAE (034/038). |
| `expenses` | Egresos. |
| `consents`, `consent_templates`, `global_consent_templates` | Consentimientos informados y plantillas (globales + por clínica). |
| `clinical_history_signatures` | Firmas de historia clínica (036). |
| `notifications` | Historial de notificaciones enviadas. |
| `app_notifications` | Inbox in-app (campana del staff, 048–050, con realtime). |
| `mp_payments`, `nave_payments` | Idempotencia de webhooks de cobro de suscripción. |
| `audit_log` | Auditoría vía `audit_trigger_fn`. |

### Enums
`appointment_status`, `payment_method`, `payment_status`, `treatment_status`, `tooth_condition`, `quote_status`, `consent_status`, `notification_channel`, `plan_type` (free/basic/pro/clinic/enterprise), `subscription_status` (trialing/active/past_due/canceled/paused), `user_role` (owner/admin/professional/receptionist).

### Relaciones clave
`clinics 1─N professionals / patients / appointments / …`. `patients 1─N appointments / treatments / payments / consents / odontogram`. `treatments 1─N treatment_sessions`. FKs con `ON DELETE CASCADE` desde `clinics`/`patients`.

## Vistas (todas `security_invoker = true`)

`v_daily_agenda`, `v_daily_cash`, `v_patient_balance`, `v_patient_account_summary`.
⚠ **`CREATE OR REPLACE VIEW` resetea `security_invoker`** → hay que re-aplicarlo (migración 042). Si tocás una vista, verificá que quede en `true` o filtrará sin RLS.

## Funciones RPC

- `book_appointment` (029) — alta de turno atómica (ver backend.md).
- `search_patients` (022) — búsqueda con prefix matching.
- `finance_kpis`/`finance_analytics`/`finance_movements` (032) · `payments_summary_period` (015) · `clinical_stats`/`clinical_period_kpis` (046) · `get_dashboard_summary` (044).
- `current_clinic_id()` / `current_user_role()` — leen el claim del JWT (con fallbacks a `user_metadata`/`app_metadata`, migración 027). Base de todas las policies RLS.
- `assert_clinic_access`, `onboard_clinic`, triggers `set_updated_at`/`audit_trigger_fn`/`update_patient_last_appointment`/`update_treatment_*`.

⚠ Las funciones **`SECURITY DEFINER` bypassan RLS**: deben validar `p_clinic_id` internamente, no confiar en el parámetro del cliente. Aplica a `search_patients`, `finance_*`, `payments_summary_period`, `book_appointment`. Ver endurecimiento en 043.

## RLS

Activo en todas las tablas de tenant. Policies filtran por `current_clinic_id()`. Migraciones de seguridad relevantes: **016** (fixes iniciales), **027** (hardening + fallbacks del claim), **042** (security_invoker en vistas), **043** (secure definer). Índices de performance: **031**.

## Storage

Bucket privado **`patient-files`** (045) para archivos clínicos (radiografías, PDFs). **Sin políticas RLS públicas** → solo `service_role` (la API) opera el bucket y sirve URLs firmadas. Nunca exponer al cliente.

## Al cambiar el esquema

1. Nueva migración numerada en `../dentalos-api/src/supabase/migrations/`. 2. `npm run migrate`. 3. Si creás/reemplazás una vista, re-aplicá `security_invoker=true`. 4. Si es `SECURITY DEFINER`, validá `p_clinic_id` dentro. 5. Actualizá este archivo.
