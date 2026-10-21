// capabilities.ts — Matriz de capacidades por especialidad (VitalOS)
//
// FUENTE DE VERDAD DUPLICADA: este archivo existe idéntico en
//   - web/lib/capabilities.ts          (frontend)
//   - dentalos-api/src/lib/capabilities.ts  (backend)
// La región entre los marcadores <SYNC:capabilities> debe ser IDÉNTICA en ambos.
// El test dentalos-api/src/lib/__tests__/capabilities.test.ts falla si divergen.
// Al editar la matriz, copiá el cambio al otro repo.
//
// Separá SIEMPRE 3 ejes (ver docs/VITALOS_MULTI_SPECIALTY_PLAN.md §5):
//   capacidad (esta matriz) ∧ autorización (role) ∧ plan comercial.
// Esta matriz NO autoriza accesos a datos: el aislamiento por clínica (RLS) y el
// rol siguen gobernando. Cambiar de disciplina nunca da acceso a datos ajenos.

// <SYNC:capabilities> START — mantener idéntico entre web/ y dentalos-api/
export const DISCIPLINES = [
  'dentistry',
  'psychology',
  'kinesiology',
  'general_medicine',
  'nutrition',
  'obstetrics',
] as const

export type Discipline = (typeof DISCIPLINES)[number]

// Regla de compatibilidad DentalOS: ausencia/valor desconocido ⇒ odontología.
export const DEFAULT_DISCIPLINE: Discipline = 'dentistry'

export const DISCIPLINE_LABELS: Record<Discipline, string> = {
  dentistry: 'Odontología',
  psychology: 'Psicología',
  kinesiology: 'Kinesiología',
  general_medicine: 'Medicina general',
  nutrition: 'Nutrición',
  obstetrics: 'Obstetricia',
}

export const FEATURES = [
  'appointments',
  'patients',
  'clinical_records',
  'clinical_files',
  'odontogram',
  'treatments',
  'budgets',
  'payments',
  'finances',
  'analytics_financial',
  'analytics_clinical',
  'consents',
  'invoicing_afip',
] as const

export type Feature = (typeof FEATURES)[number]

// MVP "matriz casi plana": todas las disciplinas tienen todo EXCEPTO las features
// exclusivas de odontología. Al sumar reglas por especialidad, editá este set
// (y, si hace falta, pasá a un Record explícito por disciplina).
const DENTAL_ONLY: ReadonlySet<Feature> = new Set<Feature>(['odontogram'])

function buildCapabilities(): Record<Discipline, ReadonlySet<Feature>> {
  const out = {} as Record<Discipline, Set<Feature>>
  for (const d of DISCIPLINES) {
    out[d] = new Set<Feature>(
      d === 'dentistry' ? FEATURES : FEATURES.filter((f) => !DENTAL_ONLY.has(f)),
    )
  }
  return out
}

export const CAPABILITIES: Record<Discipline, ReadonlySet<Feature>> = buildCapabilities()

export function normalizeDiscipline(value: unknown): Discipline {
  return (DISCIPLINES as readonly string[]).includes(value as string)
    ? (value as Discipline)
    : DEFAULT_DISCIPLINE
}

// Acepta una o varias disciplinas desde ya (prepara multi-especialidad sin
// rehacer la API). null/undefined/[] ⇒ se evalúa como odontología (compat).
export function hasCapability(
  disciplines: Discipline | Discipline[] | null | undefined,
  feature: Feature,
): boolean {
  const list = Array.isArray(disciplines) ? disciplines : [disciplines]
  const normalized = list.length ? list.map(normalizeDiscipline) : [DEFAULT_DISCIPLINE]
  return normalized.some((d) => CAPABILITIES[d]?.has(feature))
}

export function featuresFor(
  disciplines: Discipline | Discipline[] | null | undefined,
): Feature[] {
  return FEATURES.filter((f) => hasCapability(disciplines, f))
}

// ── Historias clínicas por especialidad ────────────────────────────────────
// Ver docs/VITALOS_CLINICAL_HISTORIES_PLAN.md. Mismo principio que la matriz de
// features: UNA fuente declarativa, espejada front/back. Agregar una especialidad
// = agregar una entrada, sin tocar componentes uno por uno.
//   - Frontend: renderiza secciones + bloque de vitales desde estas tablas.
//   - Backend: deriva de acá qué puede contener discipline_sections (defensa en
//     profundidad: no confía en el cliente).
// Regla de compat: 'dentistry' usa el formulario fijo odontológico (byte-equivalente
// a DentalOS); su baseSections es [] a propósito.

// P3 — signos vitales / antropometría. Cada disciplina declara qué subconjunto usa.
export const VITAL_FIELDS = [
  'bp', 'weight', 'height', 'bmi', 'heart_rate', 'resp_rate',
  'temperature', 'spo2', 'waist', 'hip', 'body_fat', 'muscle_mass',
] as const
export type VitalField = (typeof VITAL_FIELDS)[number]

// IMC siempre derivado (nunca campo libre): bmi se calcula de weight+height.
export const DERIVED_VITALS: ReadonlySet<VitalField> = new Set<VitalField>(['bmi'])

// P1 — campo declarativo de una sección de anamnesis.
export type ClinicalFieldType = 'bool' | 'text' | 'textarea' | 'number' | 'select' | 'date'
export interface ClinicalField {
  key: string
  label: string
  type: ClinicalFieldType
  options?: readonly { value: string; label: string }[] // solo para 'select'
  placeholder?: string
  max?: number // longitud máx (text/textarea) o valor máx (number)
}
export interface ClinicalSection {
  id: string
  label: string
  collapsible?: boolean // arranca colapsada (ej. determinantes sociales)
  fields: readonly ClinicalField[]
}

// P2 — evolución longitudinal (clinical_encounters, Fase B). Acá solo se declara
// la forma; los endpoints/UI llegan en Fase B.
export type EncounterType =
  | 'soap' | 'prenatal_control' | 'session' | 'nutrition_control' | 'kinesio_session'
export type EncounterConfig =
  | { enabled: false }
  | {
      enabled: true
      type: EncounterType
      label: string // "Controles" | "Sesiones" | "Consultas"
      singular: string // "Control" | "Sesión" | "Consulta"
      vitalsPerEncounter: readonly VitalField[]
      contentFields: readonly ClinicalField[] // campos de la nota (además de vitals)
    }

export interface ClinicalTemplate {
  baseSections: readonly string[] // ids en CLINICAL_SECTIONS; [] = form fijo odontológico
  vitals: readonly VitalField[]   // P3 en la base; [] = sin bloque de vitales
  encounters: EncounterConfig     // P2
  confidential?: boolean          // confidencialidad reforzada (pendiente legal, §9.1)
}

// Registro de secciones de anamnesis reutilizables (P1). Para Fase A solo se
// definen las de medicina general; las demás disciplinas llegan en su fase y
// mientras tanto usan baseSections: [].
export const CLINICAL_SECTIONS: Record<string, ClinicalSection> = {
  antecedentes_patologicos: {
    id: 'antecedentes_patologicos',
    label: 'Antecedentes patológicos',
    fields: [
      { key: 'hta',            label: 'Hipertensión arterial', type: 'bool' },
      { key: 'dbt',            label: 'Diabetes',               type: 'bool' },
      { key: 'coronariopatia', label: 'Coronariopatía / IAM',   type: 'bool' },
      { key: 'acv',            label: 'ACV',                    type: 'bool' },
      { key: 'epoc_asma',      label: 'EPOC / Asma',            type: 'bool' },
      { key: 'alergia',        label: 'Alergias',               type: 'bool' },
      { key: 'reumatica',      label: 'Enf. reumática',         type: 'bool' },
      { key: 'oncologico',     label: 'Oncológico',             type: 'bool' },
      { key: 'tbc',            label: 'TBC',                    type: 'bool' },
      { key: 'hiv',            label: 'HIV',                    type: 'bool' },
      { key: 'chagas',         label: 'Chagas',                 type: 'bool' },
      { key: 'ets',            label: 'ETS',                    type: 'bool' },
      { key: 'psicopatologicos', label: 'Psicopatológicos',     type: 'bool' },
      { key: 'neurologicos',   label: 'Neurológicos',           type: 'bool' },
      { key: 'otros',          label: 'Otros antecedentes',     type: 'textarea', max: 500 },
    ],
  },
  gineco_obstetricos: {
    id: 'gineco_obstetricos',
    label: 'Antecedentes gineco-obstétricos',
    collapsible: true,
    fields: [
      { key: 'menarca',         label: 'Menarca (edad)',         type: 'number', max: 25 },
      { key: 'irs',             label: 'IRS (edad)',             type: 'number', max: 99 },
      { key: 'gestas',          label: 'Gestas (G)',             type: 'number', max: 30 },
      { key: 'partos',          label: 'Partos (P)',             type: 'number', max: 30 },
      { key: 'abortos',         label: 'Abortos (A)',            type: 'number', max: 30 },
      { key: 'cesareas',        label: 'Cesáreas (C)',           type: 'number', max: 30 },
      { key: 'ritmo_menstrual', label: 'Ritmo menstrual',        type: 'text', max: 50 },
      { key: 'fum',             label: 'FUM',                    type: 'date' },
      { key: 'ultimo_pap',      label: 'Último PAP',             type: 'date' },
      { key: 'mac',             label: 'Método anticonceptivo',  type: 'text', max: 100 },
      { key: 'disfunciones',    label: 'Disfunciones',           type: 'text', max: 200 },
    ],
  },
  quirurgicos_internaciones: {
    id: 'quirurgicos_internaciones',
    label: 'Quirúrgicos e internaciones',
    fields: [
      { key: 'cirugias',       label: 'Cirugías / internaciones / accidentes', type: 'textarea', max: 500 },
      { key: 'alergia_medicamentos', label: 'Alergia a medicamentos',          type: 'textarea', max: 300 },
    ],
  },
  consumo_sustancias: {
    id: 'consumo_sustancias',
    label: 'Consumo de sustancias y actividad',
    fields: [
      { key: 'tabaquismo',       label: 'Tabaquismo',             type: 'bool' },
      { key: 'tabaco_edad_inicio', label: 'Edad de inicio tabaco', type: 'number', max: 99 },
      { key: 'tabaco_cant_dia',  label: 'Cigarrillos/día',        type: 'number', max: 100 },
      { key: 'ex_fumador',       label: 'Ex-fumador/a',           type: 'bool' },
      { key: 'alcohol',          label: 'Consumo de alcohol',     type: 'bool' },
      { key: 'drogas',           label: 'Otras drogas',           type: 'text', max: 200 },
      { key: 'actividad_fisica', label: 'Actividad física',       type: 'text', max: 200 },
    ],
  },
  determinantes_sociales: {
    id: 'determinantes_sociales',
    label: 'Determinantes sociales',
    collapsible: true,
    fields: [
      { key: 'educacion',     label: 'Nivel educativo',          type: 'text', max: 100 },
      { key: 'vivienda',      label: 'Condiciones de vivienda',  type: 'text', max: 200 },
      { key: 'vulnerabilidad', label: 'Situación de vulnerabilidad', type: 'textarea', max: 300 },
    ],
  },
  medicacion_actual: {
    id: 'medicacion_actual',
    label: 'Medicación actual',
    fields: [
      { key: 'medicacion', label: 'Principio activo · presentación · dosificación', type: 'textarea', max: 1000 },
    ],
  },

  // ── Obstetricia (§6.3) ──
  gineco_obstetricos_obs: {
    id: 'gineco_obstetricos_obs',
    label: 'Antecedentes gineco-obstétricos',
    fields: [
      { key: 'fum',             label: 'FUM (última menstruación)', type: 'date' }, // → FPP/EG auto
      { key: 'gestas',          label: 'Gestas (G)',   type: 'number', max: 30 },
      { key: 'partos',          label: 'Partos (P)',   type: 'number', max: 30 },
      { key: 'cesareas',        label: 'Cesáreas (C)', type: 'number', max: 30 },
      { key: 'abortos',         label: 'Abortos (A)',  type: 'number', max: 30 },
      { key: 'ultimo_pap',      label: 'Último PAP',   type: 'date' },
      { key: 'mac',             label: 'Método anticonceptivo previo', type: 'text', max: 100 },
      { key: 'grupo_sanguineo', label: 'Grupo sanguíneo', type: 'select', options: [{ value: 'A', label: 'A' }, { value: 'B', label: 'B' }, { value: 'AB', label: 'AB' }, { value: '0', label: '0' }] },
      { key: 'factor_rh',       label: 'Factor Rh', type: 'select', options: [{ value: 'pos', label: 'Positivo' }, { value: 'neg', label: 'Negativo' }] },
      { key: 'patologias_previas', label: 'Patologías previas (ej. toxoplasmosis)', type: 'textarea', max: 300 },
    ],
  },
  antecedentes_relevantes_embarazo: {
    id: 'antecedentes_relevantes_embarazo',
    label: 'Antecedentes relevantes del embarazo',
    fields: [
      { key: 'hta_personal', label: 'HTA / preeclampsia (personal)', type: 'bool' },
      { key: 'dbt_personal', label: 'Diabetes (personal)',           type: 'bool' },
      { key: 'hta_familiar', label: 'HTA (familiar)',                type: 'bool' },
      { key: 'dbt_familiar', label: 'Diabetes (familiar)',           type: 'bool' },
    ],
  },
  serologias_labs: {
    id: 'serologias_labs',
    label: 'Serologías y laboratorio',
    collapsible: true,
    fields: [
      { key: 'toxo_igg',     label: 'Toxoplasmosis IgG', type: 'bool' },
      { key: 'toxo_igm',     label: 'Toxoplasmosis IgM', type: 'bool' },
      { key: 'vdrl',         label: 'VDRL',              type: 'bool' },
      { key: 'hiv',          label: 'HIV',               type: 'bool' },
      { key: 'chagas',       label: 'Chagas',            type: 'bool' },
      { key: 'hepatitis_b',  label: 'Hepatitis B',       type: 'bool' },
      { key: 'hepatitis_c',  label: 'Hepatitis C',       type: 'bool' },
      { key: 'tsh',          label: 'TSH',               type: 'bool' },
      { key: 'glucemia_ptog', label: 'Glucemia / PTOG',  type: 'bool' },
      { key: 'cultivo_sgb',  label: 'Cultivo SGB',       type: 'bool' },
    ],
  },
  vacunas_embarazo: {
    id: 'vacunas_embarazo',
    label: 'Vacunas',
    fields: [
      { key: 'dtpa',      label: 'dTpa',      type: 'bool' },
      { key: 'antigripal', label: 'Antigripal', type: 'bool' },
      { key: 'vsr',       label: 'VSR',       type: 'bool' },
    ],
  },

  // ── Psicología (§6.4) ──
  motivo_consulta: {
    id: 'motivo_consulta',
    label: 'Motivo de consulta',
    fields: [
      { key: 'motivo',     label: 'Motivo de consulta', type: 'textarea', max: 1000 },
      { key: 'derivacion', label: 'Derivación',         type: 'text', max: 200 },
    ],
  },
  historia_vital: {
    id: 'historia_vital',
    label: 'Historia vital',
    collapsible: true,
    fields: [
      { key: 'grupo_familiar',     label: 'Grupo familiar',               type: 'textarea', max: 500 },
      { key: 'historia_evolutiva', label: 'Historia evolutiva',           type: 'textarea', max: 500 },
      { key: 'educativa_laboral',  label: 'Historia educativa / laboral', type: 'textarea', max: 500 },
      { key: 'vincular',           label: 'Historia vincular',            type: 'textarea', max: 500 },
    ],
  },
  antecedentes_psi: {
    id: 'antecedentes_psi',
    label: 'Antecedentes psiquiátricos',
    fields: [
      { key: 'psiquiatricos_personales', label: 'Psiquiátricos (personales)', type: 'bool' },
      { key: 'psiquiatricos_familiares', label: 'Psiquiátricos (familiares)', type: 'bool' },
      { key: 'psicofarmacos',            label: 'Psicofármacos',              type: 'text', max: 300 },
      { key: 'internaciones',            label: 'Internaciones',              type: 'bool' },
      { key: 'ideacion_intentos',        label: 'Ideación / intentos',        type: 'textarea', max: 500 },
    ],
  },
  examen_psiquico: {
    id: 'examen_psiquico',
    label: 'Examen psíquico',
    fields: [
      { key: 'lucidez',       label: 'Lúcido/a',    type: 'bool' },
      { key: 'orientacion',   label: 'Orientado/a', type: 'bool' },
      { key: 'afecto',        label: 'Afecto',      type: 'text', max: 200 },
      { key: 'pensamiento',   label: 'Pensamiento', type: 'text', max: 200 },
      { key: 'riesgo_suicida', label: 'Riesgo suicida', type: 'select', options: [{ value: 'bajo', label: 'Bajo' }, { value: 'medio', label: 'Medio' }, { value: 'alto', label: 'Alto' }] },
    ],
  },
  diagnostico_encuadre: {
    id: 'diagnostico_encuadre',
    label: 'Diagnóstico y encuadre',
    fields: [
      { key: 'diagnostico_presuntivo', label: 'Diagnóstico presuntivo (DSM-5 / CIE-10)', type: 'text', max: 300 },
      { key: 'encuadre',               label: 'Encuadre',                type: 'textarea', max: 500 },
      { key: 'objetivos',              label: 'Objetivos terapéuticos',  type: 'textarea', max: 500 },
    ],
  },
}

export const CLINICAL_TEMPLATES: Record<Discipline, ClinicalTemplate> = {
  // Odontología: formulario fijo odontológico (DentalOS). baseSections: [] a
  // propósito ⇒ la UI usa el render legacy. Byte-equivalente.
  dentistry: {
    baseSections: [],
    vitals: [],
    encounters: { enabled: false },
  },
  general_medicine: {
    baseSections: [
      'antecedentes_patologicos',
      'gineco_obstetricos',
      'quirurgicos_internaciones',
      'consumo_sustancias',
      'medicacion_actual',
      'determinantes_sociales',
    ],
    vitals: ['bp', 'weight', 'height', 'bmi', 'heart_rate', 'resp_rate', 'temperature', 'spo2'],
    encounters: {
      enabled: true, type: 'soap', label: 'Consultas', singular: 'Consulta',
      vitalsPerEncounter: ['bp', 'weight', 'height', 'bmi'],
      contentFields: [
        { key: 'motivo',        label: 'Motivo de consulta', type: 'textarea', max: 500 },
        { key: 'examen_fisico', label: 'Examen físico',       type: 'textarea', max: 1000 },
        { key: 'diagnostico',   label: 'Diagnóstico',         type: 'text', max: 300 },
        { key: 'cie10',         label: 'CIE-10 (opcional)',   type: 'text', max: 20 },
        { key: 'plan',          label: 'Plan / indicaciones', type: 'textarea', max: 1000 },
      ],
    },
  },
  // Obstetricia: acceso normal de HC (confidential:false, decisión de producto).
  obstetrics: {
    baseSections: ['gineco_obstetricos_obs', 'antecedentes_relevantes_embarazo', 'serologias_labs', 'vacunas_embarazo'],
    vitals: ['bp', 'weight'],
    encounters: {
      enabled: true, type: 'prenatal_control', label: 'Controles', singular: 'Control',
      vitalsPerEncounter: ['bp', 'weight'],
      contentFields: [
        { key: 'eg_semanas',     label: 'Edad gestacional (sem)', type: 'number', max: 45 },
        { key: 'altura_uterina', label: 'Altura uterina (cm)',    type: 'number', max: 50 },
        { key: 'lcf',            label: 'LCF (lpm)',              type: 'number', max: 220 },
        { key: 'mov_fetales',    label: 'Movimientos fetales',    type: 'select', options: [{ value: 'pos', label: 'Presentes' }, { value: 'neg', label: 'Ausentes' }] },
        { key: 'presentacion',   label: 'Presentación',           type: 'text', max: 60 },
        { key: 'ecografia',      label: 'Ecografía',              type: 'textarea', max: 500 },
        { key: 'conductas',      label: 'Conductas / indicaciones', type: 'textarea', max: 500 },
      ],
    },
  },
  // Confidencialidad reforzada: notas de sesión legibles solo por el profesional
  // tratante (professional_id) o el owner. Enforcement en el backend (no solo RLS).
  psychology: {
    baseSections: ['motivo_consulta', 'historia_vital', 'antecedentes_psi', 'examen_psiquico', 'diagnostico_encuadre'],
    vitals: [],
    encounters: {
      enabled: true, type: 'session', label: 'Sesiones', singular: 'Sesión',
      vitalsPerEncounter: [],
      contentFields: [
        { key: 'nota', label: 'Nota de sesión', type: 'textarea', max: 4000 },
      ],
    },
    confidential: true,
  },
  // Fase B.
  kinesiology: {
    baseSections: [],
    vitals: [],
    encounters: {
      enabled: true, type: 'kinesio_session', label: 'Sesiones', singular: 'Sesión',
      vitalsPerEncounter: [],
      contentFields: [
        { key: 'sesion_nro', label: 'Sesión N°',          type: 'number', max: 999 },
        { key: 'tecnicas',   label: 'Técnicas aplicadas',  type: 'textarea', max: 1000 },
        { key: 'eva',        label: 'Dolor EVA (0-10)',    type: 'number', max: 10 },
        { key: 'progreso',   label: 'Progreso',            type: 'textarea', max: 1000 },
      ],
    },
  },
  nutrition: {
    baseSections: [],
    vitals: ['weight', 'height', 'bmi', 'waist', 'hip', 'body_fat', 'muscle_mass'],
    encounters: {
      enabled: true, type: 'nutrition_control', label: 'Controles', singular: 'Control',
      vitalsPerEncounter: ['weight', 'height', 'bmi', 'waist', 'body_fat'],
      contentFields: [
        { key: 'adherencia',    label: 'Adherencia al plan', type: 'select', options: [{ value: 'buena', label: 'Buena' }, { value: 'regular', label: 'Regular' }, { value: 'mala', label: 'Mala' }] },
        { key: 'ajustes',       label: 'Ajustes del plan',   type: 'textarea', max: 1000 },
        { key: 'observaciones', label: 'Observaciones',      type: 'textarea', max: 1000 },
      ],
    },
  },
}

// Campos de contenido de un encounter según la disciplina (vacío si no aplica).
export function encounterContentFieldsFor(
  discipline: Discipline | null | undefined,
): readonly ClinicalField[] {
  const e = clinicalTemplateFor(discipline).encounters
  return e.enabled ? e.contentFields : []
}

export function clinicalTemplateFor(
  discipline: Discipline | null | undefined,
): ClinicalTemplate {
  return CLINICAL_TEMPLATES[normalizeDiscipline(discipline)]
}

// Secciones resueltas (ids → definición) de un template, salteando ids sin definir.
export function clinicalSectionsFor(
  discipline: Discipline | null | undefined,
): ClinicalSection[] {
  return clinicalTemplateFor(discipline).baseSections
    .map((id) => CLINICAL_SECTIONS[id])
    .filter((s): s is ClinicalSection => Boolean(s))
}
// <SYNC:capabilities> END

// ── Tipos de consulta por disciplina (solo UI) ─────────────────────────────
// Pueblan el dropdown "Tipo de consulta" de agenda, alta de turno, pago y
// booking público. El backend guarda appointment_type/concept como texto libre
// (max 100): esto NO es fuente de verdad ni se valida contra el server, por eso
// vive FUERA de la región <SYNC:capabilities> y no necesita espejo en la API.
// Agregar/editar una especialidad = editar su lista acá.
export const CONSULTATION_TYPES: Record<Discipline, readonly string[]> = {
  dentistry: [
    'Consulta', 'Limpieza', 'Endodoncia', 'Exodoncia', 'Ortodoncia',
    'Implante', 'Operatoria', 'Prótesis', 'Blanqueamiento', 'Urgencia',
    'Control', 'Armonización facial', 'Otro',
  ],
  psychology: [
    'Consulta', 'Primera entrevista', 'Sesión', 'Evaluación',
    'Control', 'Urgencia', 'Otro',
  ],
  kinesiology: [
    'Consulta', 'Evaluación', 'Sesión', 'Rehabilitación',
    'Control', 'Urgencia', 'Otro',
  ],
  general_medicine: [
    'Consulta', 'Control', 'Chequeo', 'Certificado',
    'Seguimiento', 'Urgencia', 'Otro',
  ],
  nutrition: [
    'Consulta', 'Primera consulta', 'Control', 'Plan alimentario',
    'Seguimiento', 'Otro',
  ],
  obstetrics: [
    'Consulta', 'Control prenatal', 'Primera consulta', 'Ecografía',
    'Puerperio', 'Urgencia', 'Otro',
  ],
}

export function consultationTypesFor(
  discipline: Discipline | null | undefined,
): readonly string[] {
  return CONSULTATION_TYPES[normalizeDiscipline(discipline)]
}
