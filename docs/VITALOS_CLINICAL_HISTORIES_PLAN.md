# VitalOS — Historias clínicas por especialidad

> Documento de ingeniería. **Diagnóstico + arquitectura + plantillas por especialidad + roadmap.**
> No contiene código aplicado: nada se implementa hasta aprobación explícita.
> Fecha: 2026-10-20 · Rama: `rebrand/vitalos` · Autor: auditoría técnica Claude Code.
> Depende de: `docs/VITALOS_MULTI_SPECIALTY_PLAN.md` (columna `professionals.discipline`, matriz `capabilities.ts`).
> Alcance: diseñar la historia clínica (HC) de cada disciplina de salud **sin romper a los odontólogos en producción** y **respetando el cifrado PHI ya desplegado**.

---

## 1. Executive summary

La HC actual de DentalOS es **un único registro estático por paciente**, con forma odontológica, ya cifrado por tenant key. Los dos ejemplos aportados por negocio revelan que eso no alcanza para multi-especialidad, porque **las HC de salud tienen dos naturalezas distintas**:

1. **Anamnesis / base** (estática, 1 por paciente) — antecedentes, hábitos, medicación. Es lo que ya existe; hay que **ampliarla y seccionarla por disciplina**.
2. **Evolución / controles** (longitudinal, N por paciente, con signos vitales estructurados) — **hoy no existe**. Es el corazón de la HC obstétrica, kinésica, nutricional y, en menor medida, de medicina general y psicología.

**Evidencia directa de los ejemplos:**
- *Medicina general* (PDF "Historia Clínica del Adulto Ambulatoria"): anamnesis muy rica + **signos vitales (TA, Peso, Talla, IMC)**. Patrón "base ampliada + vitales".
- *Obstetricia* (docx control de embarazo real, ~18 consultas): una **hoja de control longitudinal**; cada visita registra EG, PA, Peso, AU, LCF, MF, estudios y conductas. Patrón "base chica + N controles". La HC **es** la serie de controles.

**Recomendación central (aprobada):**
- **Ampliar** `patient_clinical_histories` con secciones específicas por disciplina (nueva columna cifrada `discipline_sections_enc`), manteniendo intactas las columnas actuales (odontología no cambia).
- **Crear** una entidad longitudinal nueva **`clinical_encounters`** (1 fila por control/sesión), con `vitals` estructurados + datos por disciplina, cifrada con el mismo patrón de tenant key, firmable y con RLS por clínica.
- **Declarar** la composición de cada HC en `capabilities.ts` como un **nuevo eje `CLINICAL_TEMPLATES`** (qué secciones de base, qué vitales, qué esquema de encounter), espejado front/back igual que la matriz de features.
- **Regla de compatibilidad absoluta:** `discipline` ausente o `dentistry` ⇒ se renderiza y persiste exactamente la HC odontológica actual. Byte-equivalente.

**No incluido (fuera de alcance):** cifrado de columnas nuevas más allá del patrón ya existente (se reutiliza), requisitos legales de confidencialidad reforzada de salud mental/obstetricia (marcados como pendiente legal, §11), e integraciones externas (carné perinatal SIP/CLAP, HL7/FHIR).

---

## 2. Diagnóstico de la HC actual (verificado en código)

Fuentes: `dentalos-api/src/modules/patients/routes.ts:524-660`, migraciones `036`, `056`, `057`, `058`, `059`; `web/app/(app)/patients/[id]/clinical-history/page.tsx`.

### 2.1 Almacenamiento real
- **Tabla dedicada `patient_clinical_histories`** (no es `patients.clinical_history` JSONB, como sugería el plan anterior; corregirlo allí). Una fila por paciente (`onConflict: 'patient_id'`).
- **Columnas base** (inferidas del upsert): `alerts`, `medical_history`, `family_history`, `habits`, `summary` (JSONB/TEXT) + `risk_level` (derivado, en claro) + `updated_by`.
- **Cifrado PHI ya desplegado** (migración 056, patrón expand→migrate→contract): columnas espejo `alerts_enc`, `medical_history_enc`, `family_history_enc`, `habits_enc`, `summary_enc` (TEXT). Se escriben vía `buildHistoryEncPatch(clinicId, patientId, …)` y se leen vía `decryptHistoryPhi(…)`, usando la **DEK por tenant** (`052_tenant_keys`). `risk_level` queda en claro (categoría de bajo valor identificatorio).
- **Firmas**: tabla `patient_clinical_histories_signatures` (migración 036), también cifrada (057). Firma dibujada en canvas, PDF exportable.
- **Cache**: Redis `pHistoryKey(clinicId, patientId)` con TTL; se invalida en cada `PUT`.

### 2.2 Forma del registro (odontológica)
```
alerts:          aspirin, anticoagulants, pregnancy, cardiac, hypertension,
                 seizures, infectious_disease{active,detail}, diabetes{active,controlled}
medical_history: renal, hepatic, respiratory, neurological, transfusions, surgeries,
                 sexually_transmitted, current_disease{…}, current_treatment{…}
family_history:  cardiac, diabetes, other
habits:          smoker, alcohol, oral_hygiene('mala'|'regular'|'buena')  ← dental
summary:         texto libre
```
- `habits.oral_hygiene` es el único campo intrínsecamente dental. El resto es anamnesis médica general reutilizable.
- **No hay** evolución por visita ni signos vitales. La "evolución" odontológica vive en odontograma + tratamientos, no acá.

### 2.3 Endpoints actuales (`patients/routes.ts`)
| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/patients/:id/clinical-history` | Lee + descifra la fila base |
| PUT | `/patients/:id/clinical-history` | Upsert base + cifra + invalida cache |
| GET | `/patients/:id/clinical-history/signatures` | Lista firmas |
| GET | `/patients/:id/clinical-history/signatures/:sigId` | Detalle firma |
| POST | `/patients/:id/clinical-history/signatures` | Crea firma |

---

## 3. Las dos piezas + la primitiva transversal

El trabajo real no son "6 formularios": son **3 primitivas** que, combinadas declarativamente por disciplina, cubren todo.

| Primitiva | Qué es | Dónde vive | Estado |
|---|---|---|---|
| **P1 · Anamnesis base por secciones** | Antecedentes/hábitos/resumen, con secciones específicas por disciplina | `patient_clinical_histories` (+ columna nueva) | Ampliar |
| **P2 · Evolución longitudinal** | 1 fila por control/sesión, con vitals + datos de disciplina, firmable | `clinical_encounters` (tabla nueva) | **Crear** |
| **P3 · Signos vitales / antropometría** | Bloque estructurado (TA, Peso, Talla, IMC auto, FC, FR, Tº, SatO₂, perímetros…) | JSONB dentro de P1 y/o P2 | **Crear** (esquema) |

**Peso de cada primitiva por disciplina:**

| Disciplina | P1 base | P3 vitales | P2 evolución |
|---|:--:|:--:|:--:|
| Odontología | ✅ (actual) | — | baja (odontograma) |
| Medicina general | ✅✅ (anamnesis rica) | ✅ TA/Peso/Talla/IMC | media (SOAP) |
| Obstetricia | ✅ gineco-obst. | ✅ PA/Peso | **alta** (control prenatal) |
| Psicología | ✅ (anamnesis vital) | — | **alta** (sesiones) |
| Kinesiología | ✅ | opc. | **alta** (sesiones) |
| Nutrición | ✅ | ✅ antropometría | **alta** (controles) |

---

## 4. Modelo de datos propuesto (aditivo, respeta cifrado)

### 4.1 P1 — Ampliar `patient_clinical_histories` (migración `060`, propuesta)

No se tocan las columnas existentes. Se agrega **una** columna cifrada que contiene las secciones específicas de la disciplina (schema libre validado por zod según `CLINICAL_TEMPLATES`):

```sql
-- 060_clinical_history_discipline_sections.sql (propuesta, NO aplicar aún)
ALTER TABLE patient_clinical_histories
  ADD COLUMN IF NOT EXISTS discipline_sections_enc TEXT;   -- JSON cifrado (tenant DEK)
-- Sin columna en claro espejo: nace directamente cifrada (no hay datos legacy que migrar).
```
- **Compat odontología:** `discipline_sections_enc` queda `NULL` para dentistas → la UI usa solo las columnas base actuales. Cero efecto.
- **Cifrado:** reutiliza `buildHistoryEncPatch`/`decryptHistoryPhi` agregando la clave `discipline_sections` al objeto cifrado. Mismo tenant key, mismo patrón. **No** se agrega columna en claro (evita PHI sin cifrar; el sistema ya está post-contract para lo base).
- **`risk_level`** sigue derivándose de `alerts` base; cada disciplina puede sumar reglas de riesgo en fase 2.

> **Alternativa descartada:** columnas nuevas por disciplina (una por sección). Rechazada: explota el ancho de la tabla y acopla el schema a la DB; el JSONB cifrado único es extensible sin migración por cada campo nuevo.

### 4.2 P2 — Nueva tabla `clinical_encounters` (migración `061`, propuesta)

```sql
-- 061_clinical_encounters.sql (propuesta, NO aplicar aún)
CREATE TABLE IF NOT EXISTS clinical_encounters (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id),
  patient_id      UUID NOT NULL REFERENCES patients(id),
  professional_id UUID REFERENCES professionals(id),
  appointment_id  UUID REFERENCES appointments(id),   -- opcional: ligar al turno
  discipline      TEXT NOT NULL REFERENCES disciplines(code),  -- del profesional al crear
  encounter_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  encounter_type  TEXT,                                -- 'control'|'session'|'first_visit'|…
  -- PHI cifrado (tenant DEK, patrón idéntico a patient_clinical_histories):
  vitals_enc      TEXT,                                -- P3 (TA, peso, talla, IMC, …)
  content_enc     TEXT,                                -- datos de disciplina (SOAP, control, sesión)
  -- Metadatos en claro (bajo valor identificatorio, útiles para orden/listado):
  risk_flag       BOOLEAN NOT NULL DEFAULT false,      -- ej. signo de alarma obstétrico
  created_by      UUID,                                -- auth.users
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ                          -- soft-delete (convención backend)
);

CREATE INDEX IF NOT EXISTS idx_clinical_encounters_patient
  ON clinical_encounters(clinic_id, patient_id, encounter_date DESC)
  WHERE deleted_at IS NULL;

-- RLS: idéntica política que el resto de tablas de tenant (current_clinic_id()).
ALTER TABLE clinical_encounters ENABLE ROW LEVEL SECURITY;
-- (políticas select/insert/update/delete filtrando clinic_id = current_clinic_id())

-- Firmas de encounter: reutilizar patrón de patient_clinical_histories_signatures
CREATE TABLE IF NOT EXISTS clinical_encounter_signatures (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id     UUID NOT NULL REFERENCES clinics(id),
  encounter_id  UUID NOT NULL REFERENCES clinical_encounters(id),
  signature_enc TEXT,                                  -- imagen firma cifrada (como 057)
  signed_by     UUID,
  signed_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE clinical_encounter_signatures ENABLE ROW LEVEL SECURITY;
```

**Propiedades:**
- **Aditiva/reversible:** tabla nueva; `DROP TABLE` en rollback no afecta HC existentes.
- **Cifrado consistente:** `vitals_enc` y `content_enc` usan la **misma DEK por tenant** y los mismos helpers (extraer `buildEncPatch`/`decryptPhi` genéricos si hoy están acoplados a history; decisión §11).
- **RLS por clínica:** aislamiento idéntico al resto. `discipline` **no** participa de la policy (igual que en el plan base, §15 D5).
- **`appointment_id` opcional:** permite que un control nazca desde el turno (flujo natural en agenda), sin obligarlo.
- **`risk_flag`/`encounter_type` en claro:** para badges y orden sin descifrar toda la lista.

### 4.3 P3 — Esquema de signos vitales (JSONB cifrado, dentro de P2/P1)

```ts
// forma de vitals_enc (validada por zod según CLINICAL_TEMPLATES)
interface Vitals {
  systolic_bp?: number        // TA sistólica (mmHg)
  diastolic_bp?: number       // TA diastólica
  weight_kg?: number          // Peso
  height_cm?: number          // Talla
  bmi?: number                // IMC — AUTO: weight / (height/100)^2, no editable
  heart_rate?: number         // FC
  resp_rate?: number          // FR
  temperature_c?: number      // Tº
  spo2?: number               // SatO₂
  // Antropometría extendida (nutrición):
  waist_cm?: number; hip_cm?: number; body_fat_pct?: number; muscle_mass_kg?: number
}
```
- **IMC siempre derivado** en cliente y validado en server (nunca campo libre).
- Cada disciplina declara en `CLINICAL_TEMPLATES` **qué subconjunto** de vitals muestra (medicina general: TA+peso+talla+IMC+FC/FR/Tº/SatO₂; obstetricia: PA+peso; nutrición: antropometría; psicología/odontología: ninguno).

---

## 5. Nuevo eje declarativo: `CLINICAL_TEMPLATES` en `capabilities.ts`

Mismo principio que la matriz de features: **una sola fuente declarativa**, espejada en `web/lib/capabilities.ts` y `dentalos-api/src/lib/capabilities.ts`, dentro de los marcadores `<SYNC:capabilities>` (ya existentes). Agregar una especialidad = agregar una entrada, sin tocar componentes uno por uno.

```ts
// <SYNC:capabilities> — forma propuesta (resumen; el detalle de secciones en §6)
export type VitalField =
  | 'bp' | 'weight' | 'height' | 'bmi' | 'heart_rate' | 'resp_rate'
  | 'temperature' | 'spo2' | 'waist' | 'hip' | 'body_fat' | 'muscle_mass'

export interface ClinicalTemplate {
  baseSections: string[]        // qué secciones de P1 se muestran (ids de §6)
  vitals: VitalField[]          // qué signos vitales (P3); [] = sin bloque de vitales
  encounters:                   // P2
    | { enabled: false }
    | { enabled: true; type: 'soap' | 'prenatal_control' | 'session' | 'nutrition_control' | 'kinesio_session';
        label: string;          // "Controles", "Sesiones", "Consultas"
        vitalsPerEncounter: VitalField[] }
  confidential?: boolean        // confidencialidad reforzada (psicología/obstetricia) — pendiente legal
}

export const CLINICAL_TEMPLATES: Record<Discipline, ClinicalTemplate> = { /* §6 */ }
```

**Consumo:**
- **Frontend** (`clinical-history/page.tsx`): el formulario deja de ser fijo; renderiza `baseSections`, el bloque de vitales y, si `encounters.enabled`, una lista de controles. Odontología ⇒ template actual exacto.
- **Backend**: el `PUT` valida `discipline_sections` con el zod derivado del template; nuevos endpoints de encounters (§9) validan `vitals`/`content` contra el template de la disciplina del profesional.

---

## 6. Plantillas por especialidad (campos exactos)

Secciones **comunes a todas** (siempre presentes, vienen de P1 actual o de `patients`): filiatorios, obra social, alergias, antecedentes personales/familiares/quirúrgicos, medicación actual, hábitos (tabaco/alcohol), resumen.

### 6.1 🦷 Odontología (`dentistry`) — SIN CAMBIOS
- `baseSections`: las actuales (alerts dentales, medical_history, family_history, `habits.oral_hygiene`, summary).
- `vitals`: `[]`. `encounters`: `{ enabled: false }`.
- La "evolución" sigue siendo odontograma + tratamientos. **Byte-equivalente a hoy.**

### 6.2 🩺 Medicina general (`general_medicine`)
- **baseSections:**
  - `antecedentes_patologicos`: HTA, DBT, coronariopatía/IAM, ACV, EPOC/asma, alergia, reumática, oncológico, TBC, HIV, Chagas, ETS, psicopatológicos, neurológicos, otros.
  - `gineco_obstetricos` (si aplica): menarca, IRS, G-P-A-C, ritmo menstrual, FUM, último PAP, MAC, disfunciones.
  - `quirurgicos_internaciones`: cirugías/internaciones/accidentes con fecha, alergia a medicamentos.
  - `consumo_sustancias`: tabaquismo (edad inicio, cant/día, ex-fumador), alcohol (screening CAGE), drogas, actividad física.
  - `determinantes_sociales` *(colapsable, opcional)*: educación, condiciones de vivienda, situación de vulnerabilidad (del PDF APS; no toda clínica lo usa).
  - `medicacion_actual`: tabla (principio activo · presentación · dosificación).
- **vitals:** `bp, weight, height, bmi, heart_rate, resp_rate, temperature, spo2`.
- **encounters:** `{ enabled: true, type: 'soap', label: 'Consultas', vitalsPerEncounter: ['bp','weight','bmi'] }` → cada consulta: motivo, examen físico, diagnóstico (CIE-10 opc.), plan/indicaciones.

### 6.3 🤰 Obstetricia (`obstetrics`)
- **baseSections:**
  - `antecedentes_gineco_obstetricos`: **FUM** (→ FPP y EG auto-calculadas), G-P-C-A, PAP, ACO/MAC, **grupo y factor Rh**, patologías previas (ej. toxoplasmosis), antecedentes obstétricos.
  - `antecedentes_relevantes_embarazo`: HTA/preeclampsia/DBT personales y familiares.
  - `serologias_labs`: checklist por trimestre (toxo IgG/IgM, VDRL, HIV, Chagas, hepatitis B/C, TSH, glucemia/PTOG, cultivo SGB).
  - `vacunas`: dTpa, antigripal, VSR.
- **vitals:** `bp, weight`.
- **encounters:** `{ enabled: true, type: 'prenatal_control', label: 'Controles', vitalsPerEncounter: ['bp','weight'] }`. Cada **control prenatal** (núcleo de la HC):
  - **EG** (edad gestacional, auto desde FUM), **AU** (altura uterina cm), **LCF** (latidos fetales), **MF** (movimientos fetales +/−), **presentación**.
  - **Ecografía** (si trae): EG eco, PFE, placenta, líquido amniótico, Doppler, TN.
  - **Conductas/indicaciones**: ácido fólico/hierro, estudios solicitados, SGB.
  - **Signos de alarma dados** (`risk_flag`), próxima consulta.
- **confidential:** evaluar (§11).
- Diseñado para mapear a **carné perinatal** (SIP/CLAP) si se exporta a futuro.

### 6.4 🧠 Psicología (`psychology`)
- **baseSections:**
  - `motivo_consulta` y derivación.
  - `historia_vital`: grupo familiar, historia evolutiva/educativa/laboral/vincular.
  - `antecedentes_psi`: psiquiátricos personales y familiares, psicofármacos, internaciones, ideación/intentos.
  - `examen_psiquico`: lucidez, orientación, afecto, pensamiento, **riesgo suicida**.
  - `diagnostico_encuadre`: diagnóstico presuntivo (DSM-5/CIE-10), encuadre, objetivos terapéuticos.
- **vitals:** `[]`.
- **encounters:** `{ enabled: true, type: 'session', label: 'Sesiones', vitalsPerEncounter: [] }` → nota por sesión.
- **confidential: true** — acceso más restringido que el resto de la HC (notas de sesión). **Pendiente legal** (§11): definir quién puede leer (¿solo el profesional tratante?, ¿owner?).

### 6.5 🦵 Kinesiología (`kinesiology`)
- **baseSections:**
  - `motivo_derivacion`: diagnóstico médico, estudios (Rx/RMN/eco).
  - `antecedentes`: traumáticos/quirúrgicos relevantes.
  - `evaluacion_inicial`: dolor **EVA 0-10**, goniometría (ROM), fuerza muscular (**Daniels 0-5**), postura, pruebas ortopédicas/funcionales, marcha/balance.
  - `diagnostico_plan`: diagnóstico kinésico funcional, objetivos corto/largo, técnicas, nº sesiones estimadas.
- **vitals:** `[]` (opc. `bp, heart_rate, spo2` para rehabilitación cardio/respiratoria).
- **encounters:** `{ enabled: true, type: 'kinesio_session', label: 'Sesiones', vitalsPerEncounter: [] }` → sesión nº, técnicas aplicadas, EVA del día, progreso. **La HC es la serie de sesiones.**

### 6.6 🥗 Nutrición (`nutrition`)
- **baseSections:**
  - `objetivo_consulta`: motivo (descenso, patología: DBT/dislipemia/HTA/celiaquía/GI).
  - `antecedentes_alimentarios`: patológicos + medicación + **alergias/intolerancias**.
  - `anamnesis_alimentaria`: recordatorio 24h, frecuencia de consumo, hidratación, actividad física, sueño.
  - `laboratorio`: glucemia, lipidograma, hepatograma, etc.
  - `diagnostico_plan`: diagnóstico nutricional, plan/VCT.
- **vitals:** antropometría: `weight, height, bmi, waist, hip, body_fat, muscle_mass`.
- **encounters:** `{ enabled: true, type: 'nutrition_control', label: 'Controles', vitalsPerEncounter: ['weight','bmi','waist','body_fat'] }` → cada control: antropometría, adherencia, ajustes. **Gráfico de evolución de peso/IMC** a partir de la serie.

### 6.7 Matriz resumen

| Sección/primitiva | dental | med. gral | obstetr. | psico | kinesio | nutri |
|---|:--:|:--:|:--:|:--:|:--:|:--:|
| Anamnesis base | ✅ | ✅✅ | ✅ | ✅ | ✅ | ✅ |
| Signos vitales | — | ✅ | PA/Peso | — | opc. | antropom. |
| Odontograma | ✅ | — | — | — | — | — |
| Evolución (P2) | — | SOAP | prenatal | sesión | sesión | control |
| Confidencial reforzada | — | — | ⚠ | ✅ | — | — |

---

## 7. Cambios en frontend

### 7.1 `clinical-history/page.tsx` — formulario declarativo
- **Estado actual:** `EMPTY_CLINICAL_HISTORY` y el render son fijos (odontológicos).
- **Cambio:** leer `discipline` de `/me` (ya cacheado), resolver `CLINICAL_TEMPLATES[discipline]` y renderizar: `baseSections` → componentes de sección; bloque de vitales si `vitals.length`; pestaña/lista "Controles/Sesiones" si `encounters.enabled`.
- **Fallback:** disciplina ausente/`dentistry` ⇒ render actual exacto (default-a-odontología).
- **Riesgo:** medio. Es un archivo de 911 líneas; aislar el schema fijo detrás del template sin romper el caso dental (regresión manual obligatoria).

### 7.2 Nueva UI de evolución (P2)
- Lista cronológica de encounters (fecha, tipo, badge de `risk_flag`), "nuevo control/sesión", detalle con vitals + content, firma por encounter.
- Obstetricia: vista tipo **carné** (fila por control, columnas EG/PA/AU/LCF/MF). Nutrición: **gráfico** de peso/IMC (usar `recharts`, ya en el stack).

### 7.3 Ficha del paciente (`PatientDetailClient.tsx`)
- El botón "Historia clínica" ya existe; sumar acceso/resumen de "último control" cuando `encounters.enabled`. Gating por capacidad, como el odontograma.

### 7.4 Signos vitales reutilizables
- Componente `VitalsInput`/`VitalsDisplay` que toma `VitalField[]` y auto-calcula IMC. Reutilizado por P1 (base) y P2 (encounter).

---

## 8. Cambios en backend

### 8.1 Ampliar base (P1)
- `ClinicalHistorySchema`: agregar `discipline_sections` (validado según template de la disciplina del profesional). `buildHistoryEncPatch` cifra también `discipline_sections`. `decryptHistoryPhi` lo descifra. `GET`/`PUT` sin cambios de ruta.

### 8.2 Endpoints de evolución (P2) — nuevos
| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/patients/:id/encounters` | Lista encounters (metadatos en claro; content descifrado on-read o lazy) |
| POST | `/patients/:id/encounters` | Crea control/sesión (valida vitals+content vs template) |
| PATCH | `/patients/:id/encounters/:eid` | Edita (mientras no esté firmado) |
| DELETE | `/patients/:id/encounters/:eid` | Soft-delete (`deleted_at`) |
| POST | `/patients/:id/encounters/:eid/signatures` | Firma el encounter |

- **Cifrado:** extraer helpers genéricos `encryptTenantJson`/`decryptTenantJson` (si hoy están acoplados a history) y reutilizarlos para `vitals_enc`/`content_enc`. Misma DEK por tenant.
- **Gating:** `requireCapability` no aplica (todas tienen evolución salvo odontología, que la tiene deshabilitada por template). Validar que `discipline` del encounter = disciplina del profesional al crear; impedir crear encounters de un tipo que el template marca `enabled:false`.
- **Cache:** invalidar al crear/editar (patrón `pHistoryKey`).

### 8.3 Validación server-side por template
- El server **no confía** en el cliente: deriva el zod de `content`/`vitals` desde `CLINICAL_TEMPLATES[professional.discipline]`. Un campo fuera del template se rechaza (defensa en profundidad, igual que `z.enum(DISCIPLINES)` en el plan base).

---

## 9. Cifrado, RLS y cumplimiento

- **Cifrado PHI:** `discipline_sections_enc`, `vitals_enc`, `content_enc`, `signature_enc` → tenant DEK, mismo patrón que `056/057`. **Nada de PHI en claro** en columnas nuevas (nacen cifradas; no hay legacy que migrar en expand→contract).
- **RLS:** `clinical_encounters` y su tabla de firmas con políticas por `current_clinic_id()`. `discipline` **no** entra en RLS (capacidad ≠ autorización, D5 del plan base).
- **Audit log:** registrar alta/edición/firma de encounter (ya existe `audit_trigger_fn`), sin volcar PHI (migración 055 `audit_log_no_phi`).
- **Soft-delete** (`deleted_at`): nunca borrado físico de evolución clínica (Ley 26.529 retención).

### 9.1 Pendiente legal (no es asesoría legal)
- **Confidencialidad reforzada** de salud mental (psicología) y datos obstétricos: la Ley 25.326 (datos sensibles) + 26.529 (historia clínica) pueden exigir control de acceso más estricto a notas de sesión. **Antes de habilitar psicología/obstetricia en producción**, validar con lo legal: ¿quién lee las notas de sesión? ¿retención específica? Marcado como bloqueante de esas dos disciplinas, **no** del MVP (medicina general/nutrición/kinesiología no agregan sensibilidad nueva material).

---

## 10. Roadmap por fases

> Depende de que la Fase 1 del plan base (`discipline` + `capabilities.ts`) esté aplicada. `059` ya existe en el repo.

### Fase A — Primitiva de vitales + base ampliada (bajo riesgo)
- A1. `CLINICAL_TEMPLATES` en `capabilities.ts` (front+back, en región SYNC).
- A2. Migración `060` (`discipline_sections_enc`) + cifrado en `PUT`.
- A3. Componente `VitalsInput` + render declarativo de `baseSections` (fallback dental).
- A4. **Medicina general** como primera disciplina con vitales (TA/Peso/Talla/IMC). Sin evolución aún.
- A5. Regresión odontología (HC byte-equivalente).

### Fase B — Evolución longitudinal (P2)
- B1. Migración `061` (`clinical_encounters` + firmas + RLS).
- B2. Helpers de cifrado genéricos + endpoints de encounters.
- B3. UI de lista/detalle/firma de encounters.
- B4. **Nutrición** (antropometría + gráfico) y **kinesiología** (sesiones) — las más longitudinales y sin bloqueo legal.

### Fase C — Disciplinas con pendiente legal
- C1. **Obstetricia**: control prenatal + EG/FPP auto + vista carné. (Resolver confidencialidad.)
- C2. **Psicología**: notas de sesión con acceso restringido. (Resolver confidencialidad.)

### Fase D — Refinamiento
- Reglas de `risk_level`/`risk_flag` por disciplina; export PDF por especialidad; gráficos; (futuro) carné perinatal / FHIR.

---

## 11. Preguntas abiertas (resolver antes de programar)

- **Q-a** Confidencialidad de notas de sesión (psicología/obstetricia): ¿quién puede leer? ¿el eje es rol, profesional tratante, o un flag nuevo? **(bloquea Fase C)**
- **Q-b** ¿`discipline_sections` como **un** JSONB cifrado (recomendado, extensible) o columnas tipadas? (doc asume JSONB).
- **Q-c** ¿El encounter se crea **desde el turno** (agenda) además de desde la ficha? (`appointment_id` ya previsto). ¿Auto-crear encounter al marcar un turno como atendido?
- **Q-d** ¿Multi-disciplina del mismo profesional (ej. médico que también hace nutrición) implica mostrar varios templates? Hoy el plan base asume **una** disciplina principal. Confirmar.
- **Q-e** ¿`determinantes_sociales` (medicina general) va por defecto o es opt-in por clínica? (es lo más "APS pública").
- **Q-f** Validar con criterio clínico/comercial los **campos exactos** de §6 por especialidad (este doc propone un set razonable, no exhaustivo).
- **Q-g** Nombre definitivo de la entidad: `clinical_encounters` vs `clinical_visits` vs `clinical_evolutions`. (doc usa `clinical_encounters`).

---

> **Siguiente paso sugerido:** validar §6 (campos por especialidad) y resolver Q-a/Q-c/Q-d; recién entonces ejecutar la Fase A. Nada se implementa hasta aprobación explícita.
