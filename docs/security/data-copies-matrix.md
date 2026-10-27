# F0.7 — Matriz dato → copias → consumidores → tratamiento → fase

> Entregable de la tarea **F0.7** del roadmap (`encryption-audit-and-plan.md` §11).
> Fecha: 2026-10-19. Método: contrastado contra las migraciones de `../dentalos-api`
> (`src/supabase/migrations/`) y los consumidores en `src/modules/` y `web/`.
>
> **Objetivo (criterio de aceptación F0.7)**: cada dato sensible **y cada copia** tiene
> un tratamiento explícito y una fase. Las exclusiones en claro llevan motivo + riesgo
> residual. Ninguna tabla queda cubierta "solo por aparecer en §3" del plan.

Convención: **[H]** verificado en esquema/código · **[I]** inferencia · **[?]** a verificar
contra la base desplegada.

> **⚠️ ESTADO 2026-10-27 — muchas filas marcadas "F3" ya están HECHAS.** Esta matriz es el plan
> original (2026-10-19). El estado real de ejecución vive en `rollout-status.md`. Resumen de lo
> ya cifrado (enc-only, AEAD): **F2 completo con contract** (patients allergies/current_medications/
> medical_notes/notes, anamnesis, firmas, secretos AFIP — columnas planas **dropeadas**); y
> post-auditoría: **`consents.*`**, **`patient_clinical_histories.risk_level`**, **`invoices.receptor_*`**,
> **`quotes.items/notes`** (cifrados + backfilleados + **contract aplicado 2026-10-27**: columnas planas
> dropeadas). Varias filas
> `[?]` de §4 quedaron resueltas: `patient_clinical_histories` → AEAD hecho; `consents`/`invoices`
> **no** tienen trigger de auditoría (confirmado). **Sigue PENDIENTE y en claro**: identidad de
> `patients` (nombre/DNI/teléfono/email/DOB/domicilio, hallazgo **F-02**), contenido de
> `appointments`, Storage, notificaciones.

## Leyenda de tratamientos

| Código | Significado |
|---|---|
| **AEAD** | Cifrado app-layer AES-256-GCM (envelope, DEK por clínica). No buscable. |
| **BIDX** | Blind index HMAC-SHA256 (igualdad exacta sobre valor normalizado). Acompaña a AEAD. |
| **PLANO** | Texto plano + RLS/control de acceso (exclusión justificada). |
| **MIN** | Minimizar / retención definida / evitar copiar plaintext a colas. |
| **VERIF** | Requiere verificar esquema desplegado antes de decidir (tabla no versionada). |

Fases: **F0** (pre-cifrado), **F2** (piloto), **F3** (migración progresiva), **F4** (hardening).

---

## 1. Matriz principal — columnas de origen

Fuente de columnas: migración indicada. "Copias" = dónde se propaga el mismo dato (ver §2).

| Tabla.columna (origen) | Clasif. | Tratamiento | Fase | Copias donde viaja | Consumidores (lectura/escritura) | Responsable |
|---|---|---|---|---|---|---|
| `patients.first_name`, `last_name` | Personal | AEAD + búsqueda local | F3 | audit_log, Redis `patient:*`, IndexedDB cartera, consents.content_html, notif template_vars/rendered_body, app_notifications.body, invoices.receptor_name, signatures snapshot | patients/routes.ts, Next `patients/[id]/page.tsx` (lee directo — migrar F2), agenda | _[asignar]_ |
| `patients.document_number` (DNI/CUIT) | Personal fuerte | AEAD + **BIDX** (normalizado) | F3 | audit_log, IndexedDB cartera, consents.content_html, invoices.receptor_cuit (copia manual) | patients/routes.ts (search ILIKE → reemplazar por BIDX), Next page | _[asignar]_ |
| `patients.phone`, `phone_alt` | Personal | AEAD + **BIDX** (E.164) | F3 | audit_log, Redis `patient:*`, IndexedDB cartera, notif `to_phone`, `search_patients` (ILIKE) | patients/routes.ts, worker notif (descifrar en consumidor), agenda | _[asignar]_ |
| `patients.email` | Personal | AEAD + BIDX (opc.) | F3 | audit_log, notif `to_email` | patients/routes.ts | _[asignar]_ |
| `patients.date_of_birth`, `gender`, `blood_type` | Personal/clínico | AEAD | F3 | audit_log | patients/routes.ts, ficha | _[asignar]_ |
| `patients.address`, `city` | Personal | AEAD | F3 | audit_log | patients/routes.ts | _[asignar]_ |
| `patients.insurance_name/plan/number` | Personal | AEAD **[?]** | F3 | audit_log, `search_patients` retorna `insurance_name` | patients/routes.ts | _[asignar]_ |
| `patients.allergies`, `current_medications`, `medical_notes` | **Crítica (PHI)** | AEAD | **F2 (piloto)** | audit_log | patients/routes.ts, ficha (Next page) | _[asignar]_ |
| `patients.referral_source` | Operacional | PLANO **[?]** | — | audit_log | patients/routes.ts | _[asignar]_ |
| `patients` historia JSONB (`ClinicalHistorySchema`) | **Crítica (PHI)** | AEAD | F3 | audit_log, Redis `patient:history:*`, signatures `history_snapshot` | patients/routes.ts (`/:id/history`) | _[asignar]_ |
| `appointments.chief_complaint`, `clinical_notes`, `internal_notes` | **Crítica** | AEAD | F3 | audit_log (trigger appointments) | appointments/routes.ts, agenda, ficha | _[asignar]_ |
| `appointments.cancelled_reason` | Clínica media | AEAD **[?]** | F3 | audit_log | appointments/routes.ts | _[asignar]_ |
| `treatments.name`, `description`, `abandon_reason` | **Crítica** | AEAD | F3 | — (sin audit trigger sobre treatments) | treatments/routes.ts, ficha | _[asignar]_ |
| `treatments.tooth_numbers`, `tooth_surfaces` | Clínica media | PLANO (GIN) | — | — | treatments (odontograma) | _[asignar]_ |
| `treatment_sessions.notes`, `next_steps` | **Crítica** | AEAD | F3 | — | treatments/routes.ts | _[asignar]_ |
| `odontogram.notes` | **Crítica** | AEAD | F3 | Redis `odonto:*` | treatments/routes.ts | _[asignar]_ |
| `odontogram.condition`, `surfaces` | Clínica media | PLANO (dibujo/filtros) | — | Redis `odonto:*` | treatments/routes.ts | _[asignar]_ |
| `tooth_diagnostics.*notes/condition/surfaces` | **Crítica** | **VERIF** → AEAD/PLANO | F3 | **[?]** | treatments/routes.ts | _[asignar]_ |
| `patient_clinical_histories.*` | **Crítica (PHI)** | **VERIF** → AEAD | F3 | **[?]** audit, signatures | patients/routes.ts | _[asignar]_ |
| `consents.content_html` (snapshot con nombre+DNI) | **Personal/clínica** | AEAD | F3 | — (snapshot ES la copia) | consents/routes.ts, PDF, consents page | _[asignar]_ |
| `consents.signature_data`, `signer_ip`, `signer_ua` | **Crítica (prueba legal)** | AEAD | F3 | — | consents/routes.ts, PDF | _[asignar]_ |
| `consents.decline_reason` | Personal | AEAD **[?]** | F3 | — | consents/routes.ts | _[asignar]_ |
| `clinical_history_signatures.history_snapshot` | **Crítica (PHI)** | AEAD (preservar snapshot) | F3 | — | patients/routes.ts | _[asignar]_ |
| `clinical_history_signatures.signature_data`, `signer_ip`, `signer_ua` | **Crítica** | AEAD | F3 | — | patients/routes.ts | _[asignar]_ |
| `invoices.receptor_name/receptor_cuit/receptor_address` | Personal | AEAD | F3 | audit_log **[?]** (no hay trigger sobre invoices — confirmar) | invoices/routes.ts (emisión, consulta, PDF) | _[asignar]_ |
| `invoices.net/iva/total_amount`, `afip_cae`, `numero` | Financiera/operacional | PLANO | — | — | invoices/routes.ts, finance | _[asignar]_ |
| `professionals.afip_cert`, `afip_key` (**clave privada PEM**) | **Secreto crítico** | AEAD o KMS dedicado | **F0.4** | — | invoices/routes.ts (firma AFIP), professionals/routes.ts (config; GET expone solo `has_cert/has_key`), server.ts **[?]** | _[asignar]_ |
| `professionals.email`, `phone`, `license_number`, `cuit` | Personal | AEAD **[?]** / PLANO | F3 **[?]** | Redis `prof:list:*`, `me:*` | professionals/routes.ts, auth | _[asignar]_ |
| `payments.amount`, importes | Financiera | PLANO (RPC `finance_*` suman en SQL) | — | audit_log (trigger payments) | payments, finance | _[asignar]_ |
| `clinics.*`, enums, FKs, timestamps | Operacional | PLANO | — | varias | — | _[asignar]_ |

---

## 2. Inventario de COPIAS (cada una con tratamiento propio)

El cifrado de las tablas de origen **no sirve** si estas copias quedan en claro.

| Copia | Qué contiene | Tratamiento | Fase | Nota |
|---|---|---|---|---|
| **`audit_log.old_data/new_data`** (JSONB) | **fila completa** de `patients`, `payments`, `appointments` en claro, append-only, sin DELETE (reglas `no_update/no_delete_audit`, trigger `audit_trigger_fn`) | Decisión **F0.3**: cifrar `old_data/new_data` **o** rediseñar a diffs sin PHI. Tratar escrituras nuevas + planificar histórico. No enviar DEK en claro a Postgres (el trigger es `SECURITY DEFINER` en SQL). | F0.3 + por conjunto en F3 | El backfill podría recopiar `OLD` al log → contemplar en triggers |
| **Redis `patient:<c>:<p>`** (10min) | ficha demográfica | descifrar en API; **no** guardar plaintext PHI en Redis, o cifrar/acortar TTL | F3 | fail-soft (CLAUDE.md API) |
| **Redis `patient:appts:<c>:<p>:*`** (2min) | historial de turnos (incluye notas) | idem | F3 | |
| **Redis `patient:history:<c>:<p>`** (30min) | historia clínica JSONB | **no cachear PHI en claro**; revisar TTL | F3 | mayor TTL = mayor exposición |
| **Redis `odonto:<c>:<p>`** | odontograma (incl. `notes`) | idem (condition/surfaces pueden quedar, notes no) | F3 | |
| **Redis `me:*`, `prof:list:*`, `wa:*`, `sub:*`, `dash:*`** | datos de profesional/clínica/dashboard | revisar PII de profesional; importes del dash = PLANO | F3/F4 | |
| **IndexedDB `dentalos-cache` / react-query** | **toda** query exitosa (sin lista de exclusión) | aislada por sesión (F0.6 ✅); definir qué campos se permiten persistir | F0.6 ✅ + revisión F3 | residual: paint-race del restore (ver F0.6) |
| **IndexedDB `dentalos-patients` (cartera)** | `id, first_name, last_name, phone, document_number, is_active, updated_at, deleted_at` | namespaced por uid + clear en logout (F0.6 ✅). Búsqueda local reemplaza GIN de nombres | F0.6 ✅ | `/patients/sync` descifra en API y envía sobre TLS |
| **Storage bucket `patient-files`** (privado, `045`) | radiografías, PDFs clínicos; path `{patientId}/{filename}` | contenido **no cifrado por la app** hoy; cifrar antes de subir (envelope) + descifrado autorizado. URL firmada del ciphertext ≠ flujo | F3 | acceso cross-tenant cerrado en F0.1 ✅ |
| **`notifications.to_phone/to_email`** | destinatario | AEAD o MIN + retención | F3 | adaptar worker/reintentos; evitar plaintext en cola BullMQ |
| **`notifications.template_vars` (JSONB), `rendered_body`** | nombre del paciente + turno (mensaje final, `notifications/service.ts`) | AEAD o MIN + retención | F3 | encolar referencias, no mensajes renderizados |
| **`app_notifications.body`** | free-text con nombre completo del paciente (`inbox.ts:109`) | AEAD o MIN | F3 | staff lee feed; service_role inserta |
| **`app_notifications.metadata` (JSONB)** | contexto deep-link | revisar contenido **[?]** | F3 | |
| **Backups / PITR de Supabase** | lo que hubiera en claro al momento del backup | documentar retención; backups previos a la migración conservan plaintext | F4 | no inspeccionado (fuera de alcance de infra) |

---

## 3. Exclusiones en claro (motivo + riesgo residual)

| Dato | Motivo de dejarlo en claro | Riesgo residual |
|---|---|---|
| `payments.amount` e importes | RPCs `finance_kpis/analytics/movements` (`032`), `payments_summary_period` suman en SQL; cifrar obliga a traer todo a la app | Un dump revela facturación/importes por clínica; mitiga RLS, no cifrado |
| `odontogram.condition/surfaces`, `treatments.tooth_numbers`, enums clínicos | Se usan en GIN/filtros y para dibujar el odontograma; bajo valor identificatorio aislado | Patrón clínico agregado sin nombre; correlacionable con FKs/fechas |
| FKs, timestamps, `clinic_id`, enums de estado | Joins/filtros/orden; romperían el modelo relacional | Permiten correlaciones (quién-cuándo) aunque el contenido esté cifrado |
| `invoices` importes, CAE, numero | Necesarios para finanzas y validez fiscal; no son PHI | Revela volumen de facturación |
| Blind index de DNI/teléfono | Necesario para búsqueda exacta | Fuga de **igualdad/frecuencia** (cuántos comparten DNI); sin búsqueda parcial |

> **Cifrar identificadores no garantiza anonimato**: fechas, FKs, diagnósticos y datos
> externos pueden recomponer identidad. Cada exclusión queda sujeta a revisión.

---

## 4. Ítems de verificación abiertos (antes de ejecutar F2/F3)

- [ ] **[?] `tooth_diagnostics`** y **`patient_clinical_histories`**: tablas creadas **fuera de
  migraciones** (`027` solo asegura RLS, líneas 77-139). Obtener el esquema real desde la base
  desplegada antes de asignar columnas/tratamiento. **VERIF** en la matriz.
- [ ] **[?]** Confirmar si hay triggers de auditoría sobre `treatments`/`treatment_sessions`/
  `consents`/`invoices` (el trigger `audit_trigger_fn` de `006` solo se adjunta a `patients`,
  `payments`, `appointments`). Si no los hay, esas tablas no viajan a `audit_log`.
- [ ] **[?]** Revisar `server.ts` por qué referencia `afip_cert/afip_key` (grep marcó una
  coincidencia): confirmar que no los loguea ni expone.
- [ ] **[?]** `app_notifications.metadata` y `notifications.template_vars`: inventariar qué
  claves PII contienen hoy.
- [ ] **[?]** Verificar que el frontend u otros clientes no escriban estas tablas vía Data API
  directa (no solo vía Fastify) — grants de Supabase.
- [ ] Asignar **responsable** por cada fila (columna `_[asignar]_`).

---

## 5. Resumen de cobertura por fase (actualizado 2026-10-27)

- **F0.4 — ✅ HECHO + contract**: `professionals.afip_cert/afip_key`.
- **F2 — ✅ HECHO + contract**: `patients.allergies/current_medications/medical_notes/notes`, anamnesis
  (`patient_clinical_histories.*`), `clinical_history_signatures.*` + copias (audit_log → diffs sin PHI,
  Redis sin PHI en claro). Columnas planas **dropeadas** (065/067).
- **Post-auditoría (F-03/F-04/F-05) — ✅ HECHO + contract (dropeadas 2026-10-27)**:
  `patient_clinical_histories.risk_level`, `consents.*` (content_html/signature_data/signer_ip/signer_ua),
  `invoices.receptor_name/cuit/address`, `quotes.items/notes`.
- **F3 PENDIENTE (en claro hoy)**: **identidad de `patients`** (nombre/DNI/teléfono/email/DOB/domicilio/
  obra social, +BIDX DNI/teléfono — hallazgo **F-02**, el riesgo dominante), `appointments`
  (chief_complaint/clinical_notes/internal_notes), tratamientos/sesiones/odontograma/diagnósticos,
  ambas tablas de notificaciones, Storage.
- **F4**: backups/retención, rotaciones, observabilidad de KMS.

Esta matriz es el insumo para los checklists de F2/F3 del plan maestro; se actualiza a medida
que se verifiquen los ítems de §4.
