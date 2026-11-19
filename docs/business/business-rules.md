# Negocio — Reglas

Reglas verificadas en código. Fuentes entre paréntesis. Actualizá este archivo si cambia una regla.

## Planes y suscripción (`../dentalos-api/src/modules/subscription/plans.ts`)

Enum DB `plan_type`; `displayName` es el nombre comercial:

| plan (DB) | Comercial | WhatsApp | Cuota WA/mes | Máx pacientes | Máx profesionales |
|-----------|-----------|----------|-------------|---------------|-------------------|
| `free` | Free | ❌ | 0 | 50 | 1 |
| `basic` | Starter | ❌ | 0 | 100 | 1 |
| `pro` | Growth | ✅ | 500 | ∞ | 3 |
| `clinic` | Scale | ✅ | 1000 | ∞ | 10 |
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

## Contacto / responsable del paciente (migración 078)
- **Un solo contacto por paciente**, en columnas `contact_*` de `patients`. Opcional, también para menores. Sirve para tutores y para adultos (emergencia, acompañante). Hermanos con el mismo tutor: se carga en cada uno.
- **Menor** = edad < 18, derivada de `date_of_birth` (zona AR); no se persiste. Lógica en `lib/patientContact.ts` (web y API, espejadas).
- **Recordatorios WhatsApp**: si `contact_receives_reminders` y hay `contact_phone`, van **solo** al contacto, redactados en tercera persona ("el turno de Juan"), **siempre que** el paciente sea menor de 16 **o** haya autorización registrada (`contact_reminders_authorized_at/_by`, 079; Ley 26.529 art. 4). Sin fecha de nacimiento también se exige autorización. Si falta, van al paciente y la ficha lo avisa. La autorización se borra si cambia el teléfono del contacto. El envío manual (`/notifications/send`) sigue la misma regla.
- **Plantillas Twilio al contacto**: variante opcional por tipo (`content_templates.<tipo>_contact` en la clínica o env `TWILIO_CONTENT_SID_<TIPO>_CONTACT`) con `{{6}}` = nombre del paciente. Sin variante se usa la estándar ("tu turno").
- **Respuestas WhatsApp (inbound)**: se aceptan desde el teléfono del paciente o del contacto. Botón o respuesta citada identifican el turno; el fallback por teléfono solo actúa si hay **un único** turno próximo posible (un tutor con varios hijos, o turnos en varias clínicas → se le pide usar el botón).
- **Booking público**: opción "es para un menor a mi cargo" (fecha de nacimiento obligatoria y < 18; el adulto declara ser madre/padre/tutor o estar autorizado, `guardian_declaration`) → el adulto queda como contacto que recibe recordatorios, **sin** marcarlo como representante legal (vínculo autodeclarado; queda nota "declarado en la reserva online, sin verificar"). El formulario muestra aviso de privacidad (Ley 25.326 art. 6). Matcheo del menor por teléfono + nombre; el matcheo de adultos ignora fichas donde ese teléfono es el del tutor.
- **Facturación**: el profesional elige en `InvoiceModal` si factura al paciente o al responsable (precarga nombre/DNI). No hay regla automática.
- Mayor de edad con el contacto marcado como representante legal → la ficha avisa que lo revisen.

## Pagos, cuenta corriente y caja
- `payments` es **libro contable**: **soft-delete** (`deleted_at`), nunca borrado físico (migración 030).
- Cuenta corriente del paciente: `v_patient_account_summary` / `/patients/:id/account-summary`. Se permiten **sobrepagos** (saldo a favor, 023) y **saldo negativo/deuda** (024). Entradas de deuda pueden tener monto cero (012).
- Número de recibo generado por **secuencia de DB** (033), no en el cliente.
- Caja diaria: `v_daily_cash` / `/payments/cash-summary`. Egresos en `expenses`.

## Facturación AFIP
- Se factura desde un pago: `POST /invoices` solicita CAE a AFIP (WSFEv1) usando el cert/key del **profesional**. Genera PDF con QR.
- Credenciales AFIP son sensibles: el GET de config solo expone `has_cert/has_key`.
- Documento del receptor: el modal envía `receptor_doc_type` (DNI/CUIT/Pasaporte) → DocTipo 96/80/94 (`lib/afipReceptorDoc.ts`). DNI de 7 u 8 dígitos; pasaporte con letras → 99 (sin identificar). Al elegir receptor RI se fuerza CUIT.

## Historia clínica y consentimientos
- Historia clínica: JSONB en `patients` (alertas médicas + notas) + firmas digitales (`clinical_history_signatures`). Exportable a PDF.
- Consentimientos: plantillas **globales** (`global_consent_templates`) + por clínica (`consent_templates`); cada consentimiento tiene estado `pending/signed/declined`.
- **Firmante (CCyC art. 26)** — lo valida la API (`validateConsentSigner`, 078/079/080):
  - Sin fecha de nacimiento no se firma (`PATIENT_DOB_REQUIRED`); el modal permite cargarla.
  - `< 13`: firma el representante (`guardian`).
  - `13–15`: el profesional califica el tratamiento (`treatment_invasive`, obligatorio). No invasivo → firma el adolescente (puede sumar al representante). Invasivo → **firman los dos** (`patient_and_guardian`, asistencia): `signature_data` = paciente, `guardian_signature_data` = representante. El representante nunca firma solo.
  - `≥ 16`: firma el paciente; que firme **solo** un representante exige instrumento (`signer_authority`: curatela/apoyo).
  - Representante: nombre, DNI y vínculo obligatorios. Si su firma es la que vale (< 13 o asistencia) y no es madre/padre/tutor, exige instrumento (delegación art. 643, guarda art. 657). Vínculos para adultos que no deciden solos: cónyuge, conviviente, curador, apoyo (arts. 32 y 59).
  - Verificación (080): el profesional confirma que vio el DNI del representante (`signer_identity_verified`) e indica cómo se acreditó el vínculo (`signer_bond_evidence`: partida, libreta, sentencia, instrumento o `declaracion` sin documento). Es la prueba de la firma electrónica (Ley 25.506 art. 5).
  - `< 13`: constancia de que el niño fue informado y oído según su madurez (`patient_heard`, arts. 26 y 707).
  - Se guarda `signer_type`, vínculo, nombre/DNI/instrumento del firmante y firma del representante (cifrados), `treatment_invasive`, `patient_heard`, `signer_identity_verified`, `signer_bond_evidence` y `patient_age_at_signing`. Las constancias (carácter del tratamiento, representación/asistencia, verificación, derecho a ser oído) las **genera la API** (`buildSignerStatementsHtml`) y las anexa al `content_html` antes de cifrarlo; el navegador solo las muestra como vista previa. Placeholders nuevos: `{{signer_name}}`, `{{signer_document}}`, `{{signer_relationship}}`.

## Roles (`user_role`)
`owner`, `admin`, `professional`, `receptionist` (UI: **Administrativo/a**). La autorización efectiva es server-side (API + RLS); el frontend solo oculta UI.

### Rol Administrativo (`receptionist`)
- Gestiona la clínica **sin acceso a información clínica**: historia clínica, evoluciones, odontograma/tratamientos, archivos médicos, consentimientos, alergias/medicación/notas del paciente y notas clínicas del turno. Ese bloqueo **no es configurable**.
- Permisos por usuario (`professionals.permissions`, catálogo en `lib/permissions.ts`, editable por owner/admin en Configuración → Equipo). Defaults: agenda de **todos** los profesionales, datos de contacto de pacientes, cobros, presupuestos, facturación AFIP y recordatorios = **sí**; estadísticas/finanzas y gastos = **no**.
- Ocupa un lugar del plan como cualquier usuario (`checkProfessionalLimit` cuenta todas las filas activas).
- Se invita con el mismo link de "Invitar al equipo" eligiendo el rol; al registrarse no elige especialidad ni matrícula.
- No atiende: no aparece como columna de agenda ni como opción de profesional; cobros y presupuestos que carga deben imputarse a un profesional explícito; las facturas salen a nombre del **profesional del cobro** (con su CUIT/certificado).
- Su dashboard es de toda la clínica (`get_dashboard_summary` con `p_professional_id = NULL`, migración 077).
- Un cambio de rol/permisos rige en ≤60 s (la API lee rol y permisos de la base, cache Redis `access:*`).
