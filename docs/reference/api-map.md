# API Map — catálogo de endpoints

Backend: `../dentalos-api/src/modules/<módulo>/routes.ts`, registrados con prefijo en `src/server.ts`.
Todas las rutas requieren JWT salvo las marcadas **(público)**. Respuesta estándar `{ data, meta? }`.

## auth — `/auth` · `auth/routes.ts`
`POST /login` · `POST /register` · `POST /refresh` · `POST /forgot-password` · `POST /resend-confirmation` · `GET /me` · `GET /startup`
Login/refresh proxean contra Supabase Auth; el cliente recibe el JWT de Supabase.

## patients — `/patients` · `patients/routes.ts`
`GET /` (lista + búsqueda `?q=&limit=&offset=`) · `POST /` · `GET /:id` · `PATCH /:id` · `DELETE /:id` (soft-delete)
`GET /:id/balance` · `GET /:id/account-summary` · `GET /:id/appointments`
`GET /:id/contact` — identidad + contacto/responsable (`contact_*`), `age`, `is_minor`, `reminders_to_contact`; sin PHI clínico (regla `any`). POST/PATCH aceptan los campos `contact_*` (078) y `contact_reminders_authorized` (boolean → constancia `_at/_by`, 079).
Historia clínica: `GET|PUT /:id/clinical-history`; firmas: `GET|POST /:id/clinical-history/signatures`, `GET /:id/clinical-history/signatures/:sigId`
Archivos: `GET|POST /:id/files`, `GET /:id/files/download`, `DELETE /:id/files` (bucket `patient-files`)
`GET /alerts/inactive` (pacientes inactivos) · `GET /sync` (delta para IndexedDB)

## appointments — `/appointments` · `appointments/routes.ts`
`GET /` · `POST /` (vía RPC `book_appointment`) · `GET /:id` · `PATCH /:id` (estado) · `POST /:id/complete`
`GET /calendar?from=&to=` · `GET /dashboard` · `GET /today`
Stats: `GET /stats/today` · `GET /stats/period?from=&to=` · `GET /stats/clinical?from=&to=`

## payments — `/payments` · `payments/routes.ts`
`GET /?patient_id=&limit=&offset=` · `POST /` · `PATCH /:id` · `DELETE /:id` (soft-delete)
`GET /summary` · `GET /cash-summary`
Presupuestos (legacy aquí): `POST /quotes` · `PATCH /quotes/:id/status`

## quotes — `/quotes` · `quotes/routes.ts`
`GET /?patient_id=` · `POST /` · `GET /:id` · `PATCH /:id` · `DELETE /:id`
(Módulo nuevo de presupuestos; convive con los `/payments/quotes` legacy — ver deuda D4.)

## treatments — `/treatments` · `treatments/routes.ts`
`GET /` · `POST /` · `GET /:id` · `PATCH /:id` · `POST /:id/sessions`
Odontograma: `GET /odontogram/:patient_id` · `PUT /odontogram/:patient_id` · `PUT /odontogram/:patient_id/bulk`
Diagnósticos por diente: `GET /tooth-diagnostics/:patient_id` · `POST /tooth-diagnostics` · `DELETE /tooth-diagnostics/:id`

## invoices — `/invoices` · `invoices/routes.ts` (AFIP)
`GET /?payment_ids=` · `POST /` (emite CAE vía WSFEv1; acepta `receptor_doc_type` DNI/CUIT/Pasaporte) · `GET /:id` · `GET /:id/pdf` (PDF con QR)

## finance — `/finance` · `finance/routes.ts`
`GET /kpis` · `GET /analytics` · `GET /movements?from=&to=&type=&limit=&offset=`
Lee vía RPC `finance_*` (SECURITY DEFINER).

## expenses — `/expenses` · `expenses/routes.ts`
`GET /` · `POST /` · `DELETE /:id` · `GET /summary`

## professionals — `/professionals` · `professionals/routes.ts`
`GET /` · `POST /` · `PATCH /:id` · `DELETE /:id`
Invitaciones: `POST /invite` · `GET /invite/:token`
Config WhatsApp de la clínica: `GET|PATCH /clinic-settings/whatsapp`
Config AFIP propia: `GET|PUT /me/afip-config` (el GET solo devuelve flags `has_cert/has_key`)
Permisos (rol Administrativo): `GET /me/permissions` (rol + permisos efectivos) · `PATCH /:id/permissions` (owner/admin; solo roles configurables; auditado en `audit_log`)
`GET /` incluye `permissions`, `iva_condition` y `afip_ready` (flag; nunca CUIT/cert). `/auth/me` y `/auth/startup` agregan `role`, `clinical_access`, `effective_permissions`.

> **Política de acceso por ruta:** toda ruta autenticada tiene una regla en `../dentalos-api/src/lib/accessPolicy.ts` (`ROUTE_RULES`): `any`, `clinical`, `staff` o un permiso. Para el rol `receptionist` lo no listado se **deniega**. El test `accessPolicy.test.ts` falla si una ruta nueva no tiene regla.

## subscription — `/subscription` · `subscription/routes.ts`
`GET /status` (plan, trial, uso, límites, alerts). Planes en `subscription/plans.ts`.

## notifications — `/notifications` · `notifications/routes.ts`
`POST /send` · `POST /reminders/bulk` · `GET /`
Inbox in-app (campana): `GET /inbox` · `GET /inbox/unread-count` · `POST /inbox/:id/read` · `POST /inbox/read-all`
Webhooks Twilio: `POST /inbound` (paciente confirma/cancela) · `POST /status`

## consents — `/consents` · `consents/routes.ts`
`GET /` · `POST /` · `GET /:id` · `GET /templates`
`POST /` acepta `signer_type` (`patient`|`guardian`|`patient_and_guardian`), `signer_name`, `signer_document`, `signer_relationship`, `signer_authority`, `guardian_signature_data`, `treatment_invasive`, `patient_heard`, `signer_identity_verified`, `signer_bond_evidence`; las constancias legales las agrega el servidor al `content_html`. Reglas CCyC art. 26 → `400` con `code` (`PATIENT_HEARD_REQUIRED`, `SIGNER_IDENTITY_NOT_VERIFIED`, `SIGNER_BOND_EVIDENCE_REQUIRED`, `PATIENT_DOB_REQUIRED`, `GUARDIAN_SIGNATURE_REQUIRED`, `TREATMENT_INVASIVE_REQUIRED`, `ADOLESCENT_SIGNATURE_REQUIRED`, `ASSISTED_SIGNATURE_REQUIRED`, `GUARDIAN_IDENTITY_REQUIRED`, `GUARDIAN_RELATIONSHIP_REQUIRED`, `GUARDIAN_SIGNATURE_MISSING`, `SIGNER_AUTHORITY_REQUIRED`) (078/079).

## indications — `/indications` · `indications/routes.ts`
Plantillas: `GET /templates` (`?discipline=`, `?include_inactive=true`; copia perezosa de las base de `indications/defaults.ts`) · `POST /templates` · `PATCH /templates/:id` · `DELETE /templates/:id` (soft).
Envíos: `GET /?patient_id=` (historial, contenido descifrado) · `POST /` (registra un envío: `patient_id`, `appointment_id?`, `template_id?`, `professional_id?`, `title`, `items[]`, `footer_note?`).
Acceso: leer plantillas + enviar + historial = permiso `indications.send`; escribir plantillas = `clinical` (081).

## schedule-blocks — `/schedule-blocks` · `schedule-blocks/routes.ts`
`GET /` · `POST /` · `DELETE /:id` (bloqueos de agenda)

## booking — `/public/booking` · `booking/routes.ts` **(público, sin auth)**
`GET /:professionalId` · `GET /:professionalId/slots` · `POST /:professionalId` (reserva vía `book_appointment`; `is_minor` + `guardian_name/relationship` + `date_of_birth` (obligatoria, < 18) + `guardian_declaration: true` para turnos de menores → se guarda el adulto como contacto, no como representante legal)

## integrations — `/integrations` · `integrations/routes.ts`
`POST /appointments` **(header `x-api-key`)** — Zapier. `clinic_id` fijo de `ZAPIER_CLINIC_ID`. Fuera de alcance comercial (ver auditoría).

## mercadopago — `/mercadopago` · `mercadopago/routes.ts`
`POST /preference` · `POST /webhook` (firma HMAC fail-closed, idempotente vía `mp_payments`)

## nave — `/nave` · `nave/routes.ts` (Naranja X / Ranty)
`POST /preference` · `POST /payment-status` · `POST /webhook/sandbox` · `POST /webhook/prod` (idempotente vía `nave_payments`)

---
**Al cambiar un endpoint**: actualizá este archivo y, si una página lo consume, `dependency-map.md`.
