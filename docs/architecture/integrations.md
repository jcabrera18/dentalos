# Arquitectura — Integraciones externas

Detalle de implementación en el backend (`../dentalos-api/src/modules/` y `src/lib/`). Resumen y puntos críticos acá.

## Twilio — WhatsApp (recordatorios y mensajería)
- `notifications/service.ts` (worker) renderiza y envía; `notifications/routes.ts` expone envío manual, recordatorios masivos y webhooks.
- Cola BullMQ `appointment-notifications`. Tipos: `confirmation`, `reminder_24h`, `reminder_2h`, `cancelled`. Se programan al crear/reprogramar turno (`scheduleAppointmentNotifications`, fire-and-forget); `jobId` determinístico por turno+tipo para cancelar/reemplazar.
- Usa **Content Templates** de Twilio (`TWILIO_CONTENT_SID_*`). Config de WhatsApp por clínica en `clinics.settings.whatsapp`, cacheada en Redis 5min (`wa:<clinic>`).
- **Webhooks**: `POST /notifications/inbound` (el paciente confirma/cancela su turno respondiendo) y `POST /notifications/status`. Firma `x-twilio-signature` validada (`validateTwilioWebhook`), exigida solo en producción.
- Cuota por plan: contador atómico en Redis (`notifications/quota.ts`), freno según `waMsgMonthlyQuota` del plan. Ver `business-rules.md`.
- Env: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_API_KEY_SID/SECRET`, `TWILIO_WHATSAPP_FROM`, `TWILIO_CONTENT_SID_*`, `TWILIO_WEBHOOK_BASE_URL`, `TWILIO_STATUS_CALLBACK_URL`, `WHATSAPP_SHARED_BRAND`.

## AFIP — Facturación electrónica (Argentina)
- `lib/afip-wsaa.ts` (ticket de acceso WSAA/SOAP), `afip-wsfev1.ts` (solicita CAE), `invoice-pdf.ts` (PDF con QR). Módulo `invoices`.
- **Credenciales por profesional**: `afip_cert` y `afip_key` en la tabla `professionals`. **Datos sensibles**: el `GET /professionals/me/afip-config` solo devuelve flags `has_cert/has_key`, nunca el material.
- Flujo: pago → `POST /invoices` emite CAE → PDF descargable (`GET /invoices/:id/pdf`).

## MercadoPago — Cobro de suscripción
- `POST /mercadopago/preference` crea la preferencia de pago. `POST /mercadopago/webhook`: **verifica firma HMAC** (`MP_WEBHOOK_SECRET`, **fail-closed**) + idempotencia vía tabla `mp_payments`.
- Env: `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`.

## Nave (Naranja X / Ranty) — Cobro de suscripción (método activo)
- Método de pago **activo** en el frontend; MercadoPago queda como fallback en código. `POST /nave/preference`, `POST /nave/payment-status`, webhooks `POST /nave/webhook/{sandbox,prod}`.
- Idempotencia vía `nave_payments`; verifica el pago contra la API de Nave (estado `APPROVED`).
- Env: `NAVE_CLIENT_ID`, `NAVE_CLIENT_SECRET`, `NAVE_AUDIENCE`, `NAVE_POS_ID`, `NAVE_ENV`. Nota de integración: `.claude/nave-integration.md` (raíz del repo frontend).

## Zapier — Ingesta de turnos (fuera de alcance comercial)
- `POST /integrations/appointments` con header `x-api-key` (`ZAPIER_API_KEY`, comparación constante). `clinic_id` fijo de `ZAPIER_CLINIC_ID`.
- ⚠ Confía en `clinic_id` de env, no multi-tenant real. **No exponer a clientes** sin migrar a keys por clínica (ver auditoría).

## PostHog — Analytics (frontend)
- `app/providers/posthog.tsx` + `pageview.tsx`. Env: `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`.

## Supabase — Auth + DB + Storage
- Auth: el browser mantiene la sesión; la API verifica el JWT (ver `backend.md`). Storage: bucket `patient-files` (ver `database.md`).

---
**Regla transversal de webhooks**: firma/API-key verificada + idempotencia. No debilitar ni saltear esas comprobaciones al modificar.
