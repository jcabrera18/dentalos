# Negocio — Módulos y estado

Lista de módulos **que existen en el código** (verificado contra rutas de la API y páginas del frontend). No documentar nada que no esté acá como implementado.

| Módulo | Estado | Frontend | API | Notas |
|--------|--------|----------|-----|-------|
| **Pacientes** | ✅ | `patients/`, `patients/[id]` | `/patients` | CRUD, búsqueda (full-text + prefix), balance, cuenta corriente, soft-delete, cache local IndexedDB |
| **Agenda / Turnos** | ✅ | `agenda/`, `patients/[id]/appointment` | `/appointments`, `/schedule-blocks`, `/public/booking` | Calendario, estados, bloqueos, booking público, alta atómica anti doble-booking |
| **Historia clínica** | ✅ | `patients/[id]/clinical-history` | `/patients/:id/clinical-history` | JSONB en `patients` + firmas (`clinical_history_signatures`), PDF |
| **Odontograma** | ✅ | dentro de `PatientDetailClient` | `/treatments/odontogram`, `/treatments/tooth-diagnostics` | Por diente, carga individual y bulk, diagnósticos |
| **Archivos clínicos** | ✅ | `components/PatientFilesSection` | `/patients/:id/files` | Bucket privado `patient-files`, URLs firmadas; fuera del cache |
| **Tratamientos** | ✅ | PatientDetail | `/treatments` | Tratamientos + sesiones + estado de pago |
| **Presupuestos (Quotes)** | ✅ | `patients/[id]/quotes` | `/quotes` (+ `/payments/quotes` legacy) | Módulo nuevo convive con legacy (deuda D4) |
| **Pagos / Caja** | ✅ | `dashboard`, `PaymentModal`, stats | `/payments` | Libro contable soft-delete, cuenta corriente, cash-summary |
| **Finanzas / Stats** | ✅ | `stats/financial`, `stats/clinical` | `/finance`, `/appointments/stats/*`, `/expenses` | KPIs, analytics, movimientos, egresos (vía RPC) |
| **Facturación AFIP** | ✅ | `InvoiceModal`, stats | `/invoices` | CAE electrónico, PDF+QR, cert/key por profesional |
| **Recordatorios WhatsApp** | ✅ | config en `settings` | `/notifications` + worker | BullMQ/Twilio, cuota por plan, confirmación por respuesta |
| **Notificaciones in-app** | ✅ | `NotificationBell` | `/notifications/inbox` | Campana del staff, realtime (`app_notifications`) |
| **Consentimientos** | ✅ | `patients/[id]/consents` | `/consents` | Plantillas globales + por clínica, firma/estado |
| **Profesionales / Consultorios** | ✅ | `settings/` | `/professionals`, `/auth` | Invites por token, roles, config WhatsApp/AFIP, onboarding de clínica |
| **Suscripciones / Planes** | ✅ | `layout` (modal planes) | `/subscription`, `/nave`, `/mercadopago` | Trial 14d, planes free/basic/pro/clinic/enterprise, cobro Nave/MP |

## No implementado / fuera de alcance
- Zapier: existe endpoint pero **fuera de alcance comercial** (no multi-tenant real).
- Timezone configurable por clínica: **no** existe (hardcodeada AR).
- Tests automatizados: **no** hay (vitest configurado, sin specs).

Reglas de cada módulo → `business-rules.md`. Endpoints → `../reference/api-map.md`.
