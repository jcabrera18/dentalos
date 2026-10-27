# Estado del rollout de cifrado PHI — VitalOS

> **Fuente de verdad del estado del despliegue.** Última actualización: **2026-10-27**.
> Complementa `rollout-runbook.md` (procedimiento) y `encryption-audit-and-plan.md` (diseño).
> Auditoría adversarial y hallazgos en `../dentalos-api/SECURITY_AUDIT_VITALOS.md` (hallazgos F-01…F-10).

## 1. Resumen ejecutivo

El cifrado de PHI (envelope encryption con AWS KMS + DEK por clínica, AES-256-GCM) está **desplegado
y activo en producción**, ahora en modelo **enc-only** (el valor vive solo en `*_enc`, sin columna en
claro una vez hecho el contract).

Cambios desde la versión anterior de este doc (2026-10-19):

- **El gate `CRYPTO_ENABLED` fue ELIMINADO (hallazgo F-01).** El cifrado está **siempre activo** vía
  el provider de KMS (AWS en prod, local en dev/test). `getKmsProvider()` **lanza** si
  `KMS_PROVIDER!=='aws'` en producción y `server.ts` lo valida en el arranque (fail-fast). Ya **no hay
  fallback silencioso a texto plano**: si no se puede cifrar/descifrar, la operación falla (fail-closed).
- **F2 contract COMPLETO**: las columnas en claro de `patients` (allergies/current_medications/
  medical_notes/notes), anamnesis (`patient_clinical_histories`), firmas y secretos AFIP ya fueron
  **dropeadas** (migraciones 065/067). Ese PHI ya **no está en el dump**.
- **Nuevos carriles cifrados** (post-auditoría): `consents`, `patient_clinical_histories.risk_level`,
  `invoices.receptor_*`, `quotes.items/notes`. Expand + backend + backfill **hechos**; falta el
  **contract** (DROP) de cada uno — ver §3 y §5.

**Lo que TODAVÍA queda en claro en un dump hoy** (riesgo principal): la **identidad del paciente**
(`patients.first_name/last_name/document_number/phone/email/date_of_birth/address/insurance_*`) — es el
hallazgo **F-02**, aún no implementado. Ver §8.

## 2. Cómo funciona HOY (enc-only)

- **Escritura**: cada write cifra el valor (AES-256-GCM, DEK por clínica envuelta por la KEK de AWS
  KMS, AAD = `clinic_id|tabla|columna|row_id`) y guarda **solo** `*_enc`. No se escribe texto plano.
- **Lectura**: la API descifra `*_enc` y lo devuelve. **Sin fallback al plano** (el backfill está al
  100%); un descifrado inválido **propaga** como error (no se sirve ciphertext ni se traga).
- **Frontend**: no lee Supabase directo; todo pasa por la API (Fastify), que descifra. El SSR de la
  ficha (`patients/[id]/page.tsx`) también va por la API.
- **Caché Redis**: la ficha y la historia se cachean **sin PHI en claro** (solo ciphertext).
- **audit_log**: el trigger guarda **diffs sin PHI** (denylist por tabla + `changed_fields`); el
  histórico fue limpiado (scrub). Triggers solo en `patients`, `payments`, `appointments`,
  `clinical_encounters` (consents/invoices/quotes **no** tienen trigger → no viajan al log).

## 3. Qué está cifrado (tablas y columnas)

Estado por fase: **expand** (columnas `*_enc` creadas) · **backend** (enc-only desplegado) ·
**backfill** (filas viejas cifradas + verificadas) · **contract** (columnas en claro dropeadas).

| Tabla | Columnas cifradas (`*_enc`) | Migr. | Backfill | Contract |
|---|---|---|---|---|
| `patients` | allergies, current_medications, medical_notes, notes | 054/064/065/066/067 | ✅ | ✅ **dropeadas** |
| `patient_clinical_histories` | alerts, medical_history, family_history, habits, summary, discipline_sections | 056/064/065 | ✅ | ✅ **dropeadas** |
| `patient_clinical_histories` | **risk_level** | 070/071 | ✅ 92/92 | ⏳ **071 pendiente** |
| `clinical_history_signatures` | history_snapshot, signature_data, signer_ip, signer_ua | 057/064/065 | ✅ | ✅ **dropeadas** |
| `clinical_encounters` + firmas | vitals, content, signature | 061 | ✅ (nacieron enc) | n/a |
| `professionals` | afip_cert, afip_key | 053/064/065 | ✅ | ✅ **dropeadas** |
| `consents` | content_html, signature_data, signer_ip, signer_ua | 068/069 | ✅ 49/49 | ⏳ **069 pendiente** |
| `invoices` | receptor_name, receptor_cuit, receptor_address | 072/073 | ✅ 247/247 | ⏳ **073 pendiente** |
| `quotes` | items, notes | 074/075 | ✅ 94/94 | ⏳ **075 pendiente** |

**En claro a propósito** (decisión de diseño): importes financieros (`payments`/`invoices`/`quotes`
totales — se suman en SQL), enums clínicos/estado, FKs y timestamps. Ver `data-copies-matrix.md`.

**En claro PENDIENTE de cifrar** (no es decisión de diseño, es trabajo por hacer): **identidad de
`patients`** (F-02), **contenido de `appointments`** (chief_complaint/clinical_notes/internal_notes),
archivos de Storage, payloads de notificaciones. Ver §8.

## 4. Backfills corridos y verificados

Todos con `KMS_PROVIDER=aws` contra prod, dry-run → `--apply` → `verify-encryption.ts`
(decrypt == plano, 0 errores; en enc-only la comparación aplica a filas no tocadas post-cutover):

- F2 (histórico): patients 317, AFIP 5, historias 81, firmas 49 — **1159/1159** OK.
- `consents`: 49/49, 0 errores, cobertura 0.
- `risk_level`: 92/92, 0 errores, cobertura 0.
- `invoices`: 247/247, 0 errores, cobertura 0.
- `quotes`: 94/94, 0 errores, cobertura 0.

## 5. Lo que FALTA — contracts pendientes (irreversible)

Quedan 4 `DROP COLUMN` de columnas en claro ya cifradas y backfilleadas:
`069_consents`, `071_risk_level`, `073_invoices_receptor`, `075_quotes_content`.

**Precondición de código (ya resuelta):** el build enc-only seguía **seleccionando** las columnas
planas para el fallback legacy → un DROP rompería esos `select`. El commit `d891e82` (dentalos-api)
**removió esos reads/fallback** (el backfill al 100% los volvió código muerto). → **Deployar `d891e82`
antes de aplicar 069/073/075.** (`071` tolera el DROP incluso sin ese deploy: usa `select('*')`.)

Secuencia para cerrar:
1. Deploy de `d891e82` (enc-only sin reads al plano).
2. **Smoke-test** (sustituye la observación de 1 día, dado el backfill verificado del set completo):
   `GET /consents/:id`, `GET /invoices` (listado), `GET /quotes` + `PATCH /quotes/:id`, abrir una
   historia clínica (risk_level). Todo debe devolver los valores descifrados, sin error.
3. **Snapshot** de la DB (los DROP son irreversibles; backups previos conservan PHI hasta rotar).
4. Aplicar 069/071/073/075 y registrarlos en `_migrations`.
5. Verificar con marcador sintético que el dump ya no contiene ese PHI.

## 6. Variables de entorno (Railway, backend)

| Var | Valor | Nota |
|---|---|---|
| `KMS_PROVIDER` | `aws` | **requerido**; el server no arranca sin esto en prod (F-01) |
| `AWS_KMS_KEY_ID` | arn de la KEK | |
| `AWS_REGION` | `us-east-1` | |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | IAM con `kms:GenerateDataKey`+`Decrypt` | separar del service_role; hardening pendiente (F-10) |
| ~~`CRYPTO_ENABLED`~~ | — | **ELIMINADA (F-01)**. El código ya la ignora; borrar de Railway. |
| `AUTH_ALLOW_USER_METADATA` | `false` | F0.0 cerrado (sin fallback a user_metadata) |

## 7. Scripts (en `dentalos-api`)

| Script | Qué hace |
|---|---|
| `src/scripts/test-kms.ts` | Smoke test de KMS (sin tocar DB) |
| `src/scripts/backfill-patients-phi.ts` | Cifra PHI de patients existente (F2) |
| `src/scripts/backfill-afip-encryption.ts` | Cifra secretos AFIP existentes |
| `src/scripts/backfill-clinical-histories.ts` | Cifra anamnesis existente (F2; columnas planas ya dropeadas → no vuelve a correr) |
| `src/scripts/backfill-signatures.ts` | Cifra firmas de historia existentes |
| `src/scripts/backfill-risk-level.ts` | Cifra `risk_level` existente (F-03) |
| `src/scripts/backfill-consents.ts` | Cifra consentimientos existentes (F-03) |
| `src/scripts/backfill-invoices.ts` | Cifra receptor_* de facturas existentes (F-04) |
| `src/scripts/backfill-quotes.ts` | Cifra items/notes de presupuestos existentes (F-05) |
| `src/scripts/verify-encryption.ts` | Verifica descifrado == plano (pre-contract); cubre todos los carriles |
| `scripts/scrub-audit-history.mjs` | Limpia PHI histórico del audit (o el SQL equivalente) |

Todos los backfills: dry-run por default; `--apply` exige `KMS_PROVIDER=aws`. Se corren localmente
con el `.env` apuntando a prod (REST API).

## 8. Pendientes (ordenados por riesgo)

- [ ] **Contracts 069/071/073/075** — tras deploy de `d891e82` + smoke-test (ver §5). *Cierra el dump
  para consents, risk_level, invoices, quotes.*
- [ ] **F-02 — identidad de `patients` (RIESGO ALTO DOMINANTE).** `first_name/last_name/
  document_number/phone/email/date_of_birth/address/insurance_*` siguen en claro. Plan por tiers
  (A: display; B: DNI/tel/email con **blind index**; C: nombres con búsqueda/orden en el cliente) en
  `../dentalos-api/docs/plan-f3-cifrado-identificadores.md`. **Tier C requiere trabajo de frontend**
  (búsqueda local vía `/patients/sync` + orden alfabético en el cliente) → es el gate de esta fase.
- [ ] **F-05 (appointments)** — `chief_complaint/clinical_notes/internal_notes`. Costo alto: toca el
  RPC `book_appointment` (el `id` del turno nace dentro del RPC) y la vista `v_daily_agenda` (expone
  `chief_complaint`) + descifrado por fila en agenda/historial.
- [ ] **F-07 (Storage)** — archivos de `patient-files` (radiografías/PDF) **no cifrados por la app**.
- [ ] **F-08 (logs/Redis)** — identificadores de paciente en Redis/logs; se resuelve mayormente con F-02.
- [ ] **F-09 (audit_log)** — pasar la denylist a allowlist (robustez ante columnas nuevas).
- [ ] **F-10 (KMS/IAM)** — least-privilege sobre la KEK + CloudTrail/alertas de volumen de `kms:Decrypt`.
- [ ] Notificaciones (`notifications.to_phone/template_vars/rendered_body`, `app_notifications.body`):
  contienen nombre/teléfono del paciente → AEAD o minimización (depende de F-02).
- [ ] Fase 4 (hardening): rewrap/rotación de DEK, revocación, restore, observabilidad de KMS.

## 9. Rollback

- **Pre-contract (hoy):** redeploy del build anterior. El build con fallback legacy (previo a
  `d891e82`) lee tanto `*_enc` como el plano; sirve de red mientras las columnas planas existan. Ya
  **no** hay rollback vía `CRYPTO_ENABLED` (fue eliminada): el cifrado es incondicional.
- **Después de cada contract:** no hay rollback por columna (el plano se borró) → recuperación =
  restore de backup. Por eso van el backfill verificado (set completo, 0 errores) + snapshot antes.
- **F0.0:** quitar `AUTH_ALLOW_USER_METADATA` (vuelve el fallback a `user_metadata`).
