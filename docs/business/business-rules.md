# Negocio — Reglas

Reglas verificadas en código. Fuentes entre paréntesis. Actualizá este archivo si cambia una regla.

## Planes y suscripción (`../dentalos-api/src/modules/subscription/plans.ts`)

Enum DB `plan_type`; `displayName` es el nombre comercial:

| plan (DB) | Comercial | WhatsApp | Cuota WA/mes | Máx pacientes | Máx profesionales |
|-----------|-----------|----------|-------------|---------------|-------------------|
| `free` | Free | ❌ | 0 | 50 | 1 |
| `basic` | Starter | ❌ | 0 | 100 | 1 |
| `pro` | Growth | ✅ | 500 | ∞ | 3 |
| `clinic` | Scale | ✅ | 2000 | ∞ | 10 |
| `enterprise` | Enterprise | ✅ | ∞ | ∞ | ∞ |

- **Trial**: 14 días (migración 019; clínicas previas grandfathered en 020).
- **Upgrade vs downgrade** (`PLAN_RANK` free0<basic1<pro2<clinic3<enterprise4): el **upgrade aplica al instante**; el **downgrade se bloquea** mientras quede tiempo pagado del plan superior (para no perder días abonados). El backend responde `409 downgrade_not_allowed`; el frontend lo muestra con mensaje amigable (`lib/api.ts`, `(app)/layout.tsx`).
- `GET /subscription/status` devuelve `plan`, `trial`, `subscription`, `features`, `usage` y `alerts` (accessBlocked, banners de trial/renovación, cuota WA excedida/warning, límites de pacientes/profesionales). Cache Redis `sub:<clinic>` 24h y en el cliente `useSubscription` 1h.
- Cobro: **Nave** es el método activo; MercadoPago fallback. Al confirmarse el webhook, se extiende la suscripción.

## Cuota de WhatsApp (`notifications/quota.ts`)
- Contador atómico en Redis por clínica/mes. Al llegar al límite del plan, se frena el envío de recordatorios. Se cuentan los mensajes efectivamente enviados (sent/delivered).

## Agenda y turnos
- Alta **siempre** vía RPC `book_appointment` (transacción con `FOR UPDATE`): impide doble-booking. Slot ocupado → `409` ("ese profesional ya tiene un turno en ese horario", `lib/api.ts`).
- Notificaciones se (re)programan al crear/reprogramar y se cancelan al cancelar (`jobId` determinístico). El paciente puede confirmar/cancelar respondiendo el WhatsApp (webhook inbound).
- Al cancelar un turno, se notifica a la clínica vía campana in-app (`app_notifications`).
- Zona horaria de negocio: **America/Argentina/Buenos_Aires** (UTC-3). Los rangos de día se arman sobre esa TZ.

## Pagos, cuenta corriente y caja
- `payments` es **libro contable**: **soft-delete** (`deleted_at`), nunca borrado físico (migración 030).
- Cuenta corriente del paciente: `v_patient_account_summary` / `/patients/:id/account-summary`. Se permiten **sobrepagos** (saldo a favor, 023) y **saldo negativo/deuda** (024). Entradas de deuda pueden tener monto cero (012).
- Número de recibo generado por **secuencia de DB** (033), no en el cliente.
- Caja diaria: `v_daily_cash` / `/payments/cash-summary`. Egresos en `expenses`.

## Facturación AFIP
- Se factura desde un pago: `POST /invoices` solicita CAE a AFIP (WSFEv1) usando el cert/key del **profesional**. Genera PDF con QR.
- Credenciales AFIP son sensibles: el GET de config solo expone `has_cert/has_key`.

## Historia clínica y consentimientos
- Historia clínica: JSONB en `patients` (alertas médicas + notas) + firmas digitales (`clinical_history_signatures`). Exportable a PDF.
- Consentimientos: plantillas **globales** (`global_consent_templates`) + por clínica (`consent_templates`); cada consentimiento tiene estado `pending/signed/declined`.

## Roles (`user_role`)
`owner`, `admin`, `professional`, `receptionist`. La autorización efectiva es server-side (API + RLS); el frontend no restringe por rol más allá de lo que la API permite.
