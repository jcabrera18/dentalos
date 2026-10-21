# VitalOS — Consentimientos informados con validez legal (plan)

> Documento de ingeniería + cumplimiento. **Diagnóstico del circuito actual + marco legal AR + roadmap por fases.**
> No contiene código aplicado: nada se implementa hasta aprobación explícita. Nada se "vende" como respaldo legal hasta revisión de abogado sanitario.
> Fecha: 2026-10-21 · Rama: `rebrand/vitalos` · Autor: auditoría técnica Claude Code.
> Depende de: migración `006` (tablas `consents`/`consent_templates`), `062` (eje `discipline`), `052_tenant_keys` (DEK por clínica, patrón de cifrado PHI ya desplegado), `docs/security/encryption-audit-and-plan.md`.
> Relacionado: `docs/VITALOS_MULTI_SPECIALTY_PLAN.md`, páginas legales `/terms` `/privacy` `/dpa`.
> **Disclaimer:** evaluación funcional y jurídica orientativa para guiar el producto, **no** es asesoramiento legal ni auditoría formal. Las plantillas y el circuito deben validarse con un abogado especializado en derecho sanitario argentino antes de presentarse como "válidos legalmente".

---

## 1. Executive summary

El consentimiento informado de VitalOS hoy **captura una firma dibujada y congela el HTML de la plantilla**, pero **no demuestra por sí solo** tres cosas que la normativa argentina espera: (a) que el paciente recibió información suficiente, (b) que la firma está vinculada de forma verificable al contenido aceptado, y (c) que intervino el **profesional tratante** (su firma es exigible por el Decreto 1089/2012 y hoy no se registra).

**La preocupación principal no es la firma dibujada** (es firma electrónica, tiene reconocimiento jurídico). Es la **falta de trazabilidad verificable**: sin hash del documento final, sin bitácora de auditoría inmutable y sin firma del profesional, ante una controversia el consentimiento es difícil de defender.

**Hallazgo técnico que cambia el diagnóstico (verificado en código):**
- La tabla `consents` **ya tiene las columnas `signer_ip` y `signer_ua`**, pero el handler `POST /consents` **no las rellena** (`dentalos-api/src/modules/consents/routes.ts:127-151`). Hoy se guarda la **imagen de la firma dentro del `content_html` congelado** y nada más: ni IP, ni user-agent, ni hash, ni evento de auditoría, ni firma del profesional.
- La inmutabilidad del `content_html` es **por convención** (el comentario de la migración dice "immutable"), no por un mecanismo que lo impida: un `UPDATE` lo sobrescribiría sin dejar rastro.

**Recomendación central:** no eliminar el mecanismo de firma; **evolucionarlo a un consentimiento con trazabilidad verificable**, por fases (P0 → P2), reutilizando el cifrado PHI por tenant ya desplegado y vinculando cada consentimiento firmado a la historia clínica. Separar en producto dos categorías de plantilla: **"sugeridas" (borrador, a revisar por el profesional)** vs **"validadas jurídicamente"** — y **no ofrecer la segunda** hasta que efectivamente pase revisión legal.

**Próximo paso (decidido):** integración de un **certificador / proveedor de firma digital** (P2.1) para obtener presunción de autoría e integridad (Ley 25.506). Es lo que se evalúa/implementa a continuación.

**Fuera de alcance:** integración con terceros de identidad (RENAPER/biometría); garantías de exención de responsabilidad por mala praxis (ningún consentimiento la otorga).

---

## 2. Diagnóstico del circuito actual (verificado en código)

Fuentes: `dentalos-api/src/modules/consents/routes.ts`, migraciones `006_notifications_consents_audit.sql` y `062_consent_templates_discipline.sql`, `web/app/(app)/patients/[id]/consents/page.tsx`.

### 2.1 Modelo de datos
```
consent_templates(id, clinic_id, name, content_html, discipline, is_active, …)
global_consent_templates(name, content_html, discipline, specialty)   ← catálogo semilla
consents(
  id, clinic_id, patient_id, appointment_id, template_id,
  content_html   TEXT NOT NULL,   -- snapshot "inmutable" (por convención, no forzado)
  status         consent_status('pending'|'signed'|'declined'),
  signature_data TEXT,            -- data URL base64 (PNG/SVG de la firma dibujada)
  signed_at, signer_ip, signer_ua,   -- ⚠ signer_ip / signer_ua EXISTEN pero NO se escriben
  declined_at, decline_reason,
  created_by     UUID → professionals(id),
  created_at
)
```
- RLS por clínica activa (`consents_isolation`, `consent_tmpl_isolation` vía `current_clinic_id()`). Aislamiento de tenant correcto.
- `content_html` y `signature_data` **no están cifrados** (a diferencia de `patient_clinical_histories`, migración 056). Contienen PHI → ver §6.

### 2.2 Circuito de firma (web)
- `web/app/(app)/patients/[id]/consents/page.tsx` (~983 líneas): el paciente firma en un `<canvas>`; la firma se serializa a data URL y se manda en `signature_data`. El `content_html` de la plantilla se congela en el momento.
- Export: se **dibuja a mano un PNG con canvas** (mismo enfoque que el comprobante de cobro) — **no hay PDF** y no hay hash del artefacto final.
- La UI carga el **nombre del profesional** para mostrarlo, pero **no captura ni almacena la firma del profesional** ni su matrícula.

### 2.3 Brechas frente a la normativa (resumen)
| Elemento | Estado actual | Gap |
|---|---|---|
| Identificación del paciente | Nombre + DNI en plantilla | OK (depende de la plantilla) |
| Identificación del profesional | Solo nombre mostrado en UI | **Falta matrícula + firma del profesional** |
| Información suficiente (objetivos, riesgos, alternativas, consecuencias de no tratarse) | Depende del texto de cada plantilla | **Insuficiente / no estandarizado** |
| Firma del paciente | Firma electrónica (dibujada) | Válida pero **sin evidencia de vínculo** |
| Integridad del documento | `content_html` congelado por convención | **No verificable (sin hash)** |
| Trazabilidad / auditoría | Solo `created_at` | **Sin bitácora de eventos** |
| Identidad del firmante | No verificable | IP/UA ni siquiera se guardan |
| Conservación en HC | Consentimiento aparte | **No vinculado a la historia clínica** |

---

## 3. Marco legal argentino (referencia, no asesoramiento)

1. **Ley 26.529 (Derechos del Paciente) + Decreto 1089/2012** — El consentimiento debe ser **informado, libre y previo**, cubriendo objetivos, beneficios, **riesgos, alternativas y consecuencias de no realizar** el procedimiento. Las **intervenciones quirúrgicas y procedimientos invasivos** (entre otros supuestos) exigen **consentimiento escrito**, con **suscripción del profesional tratante** e **incorporación a la historia clínica**.
2. **Ley 25.506 (Firma Digital)** — Distingue:
   - *Firma electrónica* (la dibujada con dedo/mouse): tiene reconocimiento jurídico, pero **si se desconoce, quien la invoca debe probar su validez**.
   - *Firma digital* (requisitos criptográficos + certificador licenciado): goza de **presunción de autoría e integridad**.
   - ⚠ **Agregar un hash SHA-256 NO convierte una firma electrónica en firma digital.** El hash prueba **integridad del documento**, no **autoría legalmente presumida**. Son cosas distintas y complementarias.
3. **Ley 25.326 (Protección de Datos Personales)** — Los consentimientos contienen **datos sensibles de salud**; VitalOS debe protegerlos contra acceso indebido, modificación y pérdida (se conecta con el cifrado PHI y las páginas `/privacy` `/dpa`).

**Reparto de responsabilidad (para producto y ToS):**
- **El profesional** es responsable de informar, evaluar la capacidad de consentir y elegir el consentimiento adecuado a la práctica.
- **VitalOS** (proveedor tecnológico) puede responder por **defectos del software, fallas de seguridad, pérdida de documentos o funciones presentadas como "legalmente válidas" sin cumplir los requisitos**. Un disclaimer de "no me responsabilizo" **no elimina** automáticamente esa responsabilidad → de ahí la distinción "plantilla sugerida" vs "validada" (§5).

---

## 4. Roadmap por prioridad

> Cada ítem mapea a cambios concretos en el stack. Las migraciones son **aditivas** y siguen la política del repo (idempotentes, sin tocar PHI existente, rollback manual fuera de la carpeta del runner). Nada se aplica a prod sin aprobación.

### P0 — Cumplimiento mínimo defendible

**P0.1 · Firma del profesional tratante**
- *Por qué:* exigido por Decreto 1089/2012 cuando hay consentimiento escrito.
- *Dato previo ✅ hecho:* la **matrícula** ahora se captura en Configuración (`professionals.license_number`, sección "Mi matrícula profesional" en `web/app/(app)/settings/page.tsx`; el backend ya la soportaba en schema + PATCH). Es el insumo para el snapshot al firmar.
- *Datos:* nuevas columnas en `consents`: `professional_signature_data TEXT`, `professional_signed_at TIMESTAMPTZ`, `professional_license TEXT` (matrícula, snapshot al firmar desde `professionals.license_number`), `professional_name TEXT` (snapshot). Migración aditiva nueva (p. ej. `063`).
- *API:* `POST /consents` pasa a exigir (según tipo de plantilla) la firma del profesional; o un endpoint de co-firma `POST /consents/:id/professional-signature`. La matrícula se toma de `professionals` (snapshot), no del body del cliente.
- *Web:* segundo canvas de firma en el modal (paciente → profesional) antes de confirmar.

**P0.2 · Captura de evidencia de contexto (rellenar lo que ya existe) — valor limitado, baja prioridad**
- *Realidad del uso:* en la práctica el paciente firma **desde el device del profesional, en el consultorio**. Entonces `signer_ip`/`signer_ua` describen el dispositivo de la clínica, **no** identifican ni ubican al paciente. Como prueba de identidad del firmante, el valor es **marginal**.
- *Qué sí aporta:* dejan constancia del contexto del acto (desde qué equipo/sesión se firmó), útil solo como dato accesorio en la bitácora (P0.5).
- *API (si se hace):* en `POST /consents`, poblar `signer_ip` y `signer_ua` ya que las columnas existen — pero **no presentarlo como evidencia de identidad**. La identidad real se resuelve con el OTP (P1.1), no con la IP.

**P0.3 · Hash de integridad (SHA-256) del documento final**
- *Por qué:* detectar modificación posterior del consentimiento aceptado.
- *Datos:* columnas `content_hash TEXT`, `hash_algo TEXT DEFAULT 'sha-256'`, `hashed_at TIMESTAMPTZ`.
- *API:* al firmar, calcular hash determinístico sobre el **payload canónico** (content_html + firma paciente + firma profesional + metadatos de identificación + versión de plantilla). Guardar el hash; recalcular y comparar al leer/verificar.
- *Nota legal:* el hash prueba **integridad**, no sustituye la firma digital (ver §3.2).

**P0.4 · Inmutabilidad real del consentimiento firmado**
- *Por qué:* hoy un `UPDATE` sobrescribe el snapshot sin rastro.
- *DB:* trigger/política que impida `UPDATE`/`DELETE` de un `consents` en estado `signed` (salvo transición a `revoked`, que es un **evento nuevo**, no una edición — ver P1.3). Soft-delete prohibido sobre firmados.

**P0.5 · Bitácora de auditoría inmutable**
- *Por qué:* reconstruir la aceptación ante controversia.
- *Datos:* tabla nueva `consent_events(id, consent_id, clinic_id, event_type, actor_type, actor_id, ip, ua, payload_hash, created_at)` con `event_type ∈ {created, viewed_by_patient, patient_signed, professional_signed, sealed, revoked, exported}`. Append-only (sin `UPDATE`/`DELETE` vía trigger). RLS por clínica.

**P0.6 · Plantillas revisadas (contenido clínico suficiente)**
- *Por qué:* la información insuficiente es el gap de fondo; el soporte técnico no suple un texto pobre.
- *Acción:* revisar `global_consent_templates` por disciplina para que cada una cubra objetivos, beneficios, **riesgos, alternativas y consecuencias de no tratarse**. Marca de estado `review_status ∈ {draft, professional_reviewed, legal_reviewed}` (ver §5). Coordinar con profesional de cada disciplina.

### P1 — Robustez y buenas prácticas

**P1.1 · Validación de identidad por OTP** — enviar código (WhatsApp/SMS/email, infra de notificaciones ya existe) al paciente antes de firmar; registrar `otp_verified_at` + canal en la bitácora. Evidencia de identidad más fuerte que IP/UA.

**P1.2 · Copia al paciente + archivo en HC** — generar **PDF inmutable** (reemplazar/complementar el PNG por canvas) con el hash impreso y QR de verificación; adjuntarlo a la historia clínica del paciente (vincular `consents` ↔ `patient_clinical_histories` / `clinical_encounters`) y ofrecer copia descargable/enviable al paciente.

**P1.3 · Versionado y revocación** — `consent_templates` versionadas (`version`, `template_version_id` snapshot en cada `consents`); la **revocación** es un evento nuevo (`status='revoked'` + `revoked_at` + motivo + evento en bitácora), nunca una edición del documento firmado.

### P2 — Respaldo probatorio máximo

**P2.1 · Firma digital con proveedor especializado — 👉 PRÓXIMO PASO definido**
- *Decisión:* es el siguiente paso a evaluar/implementar. Integrar un **certificador / plataforma de firma** para obtener **presunción de autoría e integridad** (Ley 25.506) — lo único que eleva la firma de "electrónica" a "digital" en sentido legal.
- *A definir antes de implementar:* proveedor (certificador licenciado AR vs plataforma de firma avanzada tipo e-sign), si aplica al paciente, al profesional o a ambos, y si va como default o como tier premium.
- *Precondición técnica:* conviene tener antes el hash canónico (P0.3) y el PDF inmutable (P1.2), porque el certificador firma ese artefacto determinístico.

---

## 5. Producto: "sugerida" vs "validada" (anti-responsabilidad)

Para no asumir responsabilidad por funciones presentadas como "legalmente válidas" sin serlo:
- Toda plantilla nace **`draft` / "Sugerida — revisá con tu criterio profesional"**.
- Solo pasa a **`legal_reviewed` / "Validada"** tras revisión documentada de abogado sanitario + profesional de la disciplina.
- **No exponer la categoría "Validada" en la UI** hasta que exista al menos una plantilla que realmente lo esté.
- ToS/`/dpa`: VitalOS provee la **herramienta de trazabilidad**; el **contenido y la adecuación clínica** son responsabilidad del profesional. Evitar lenguaje que prometa exención de demandas o de responsabilidad por mala praxis.

---

## 6. Seguridad de datos (Ley 25.326, se engancha con el cifrado PHI ya desplegado)

- `content_html` y `signature_data` son **PHI y hoy están en claro**. Alinear con el patrón de `patient_clinical_histories` (migración 056): columnas `*_enc` cifradas con la **DEK por tenant** (`052_tenant_keys`), `buildHistoryEncPatch` / `decryptHistoryPhi` como referencia. Decisión: cifrar `content_html`, `signature_data`, `professional_signature_data`.
- El PDF/artefacto final: si se guarda en Storage, va al bucket **privado** servido solo por la API con URL firmada (regla de archivos médicos del CLAUDE.md), nunca expuesto al cliente.
- La bitácora `consent_events` guarda **hashes**, no PHI en claro, para auditar sin ampliar la superficie de datos sensibles.
- El hash de integridad **no** sustituye el cifrado: integridad ≠ confidencialidad.

---

## 7. Regla de compatibilidad y orden de aplicación

- **Odontología no se rompe:** todo lo nuevo es aditivo; los consentimientos ya firmados quedan válidos tal cual (sin hash/firma profesional retroactivos — se marcan como "legacy" en la bitácora).
- **Orden sugerido de implementación:** P0.2 (barato, ya hay columnas) → P0.4/P0.5 (inmutabilidad + auditoría, base de todo lo demás) → P0.3 (hash) → P0.1 (firma profesional) → P0.6 (plantillas) → P1 → P2.
- **Bloqueante de negocio:** antes de comunicar esto como diferencial ("consentimientos con validez legal"), **revisión de abogado sanitario AR** de plantillas + circuito de firma.

---

## 8. Checklist de implementación (para sumar como issues)

- [x] Matrícula del profesional capturada en Configuración (`professionals.license_number`) — insumo de P0.1
- [ ] P0.1 Migración columnas firma profesional + endpoint co-firma + 2º canvas en web (matrícula ya disponible como snapshot)
- [ ] P0.2 (baja prioridad) Poblar `signer_ip` / `signer_ua` — contexto, NO identidad (firman desde el device del consultorio)
- [ ] P0.3 Hash SHA-256 canónico + columnas + verificación al leer
- [ ] P0.4 Trigger de inmutabilidad para `consents` firmados
- [ ] P0.5 Tabla `consent_events` append-only + RLS + emisión de eventos
- [ ] P0.6 Revisión de `global_consent_templates` por disciplina + `review_status`
- [ ] P1.1 OTP de identidad antes de firmar (prueba de identidad real, reemplaza el valor que no da la IP)
- [ ] P1.2 PDF inmutable con hash/QR + vínculo a HC + copia al paciente
- [ ] P1.3 Versionado de plantillas + flujo de revocación
- [ ] 👉 **P2.1 Integración firma digital con certificador — PRÓXIMO PASO**
- [ ] Seguridad: cifrar PHI de consents con DEK por tenant (patrón 056)
- [ ] Legal: revisión de abogado sanitario AR (bloqueante del claim comercial)
