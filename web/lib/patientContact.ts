// Contacto / responsable del paciente (API: migración 078, columnas contact_* en patients).
// Un solo contacto por paciente. Para menores es su tutor; para adultos, contacto de
// emergencia o acompañante. Reglas espejo de dentalos-api/src/lib/patientContact.ts.

export const CONTACT_RELATIONSHIPS = [
  { value: 'madre',       label: 'Madre' },
  { value: 'padre',       label: 'Padre' },
  { value: 'tutor_legal', label: 'Tutor/a legal' },
  { value: 'abuelo',      label: 'Abuelo/a' },
  { value: 'hermano',     label: 'Hermano/a' },
  { value: 'pareja',      label: 'Pareja' },
  { value: 'hijo',        label: 'Hijo/a' },
  // 080: adultos que no pueden decidir solos (CCyC arts. 32 y 59).
  { value: 'conyuge',     label: 'Cónyuge' },
  { value: 'conviviente', label: 'Conviviente' },
  { value: 'curador',     label: 'Curador/a' },
  { value: 'apoyo',       label: 'Apoyo (judicial)' },
  { value: 'otro',        label: 'Otro' },
] as const

// Con qué se acreditó el vínculo del representante al firmar (080).
export const BOND_EVIDENCE_OPTIONS = [
  { value: 'partida_nacimiento', label: 'Partida de nacimiento' },
  { value: 'libreta_familia',    label: 'Libreta de familia' },
  { value: 'sentencia',          label: 'Sentencia judicial' },
  { value: 'instrumento',        label: 'Instrumento indicado' },
  { value: 'declaracion',        label: 'Declarado, sin documento' },
] as const

export type ContactRelationship = typeof CONTACT_RELATIONSHIPS[number]['value']

export function relationshipLabel(v: string | null | undefined): string {
  return CONTACT_RELATIONSHIPS.find(r => r.value === v)?.label ?? ''
}

// Vínculos que por defecto implican representación legal de un menor: progenitores
// (art. 638 CCyC) y tutor designado (art. 104). Otro vínculo necesita instrumento.
export const GUARDIAN_RELATIONSHIPS: string[] = ['madre', 'padre', 'tutor_legal']

export type ContactForm = {
  contact_name: string
  contact_relationship: string
  contact_phone: string
  contact_email: string
  contact_document_type: string
  contact_document_number: string
  contact_is_legal_guardian: boolean
  contact_receives_reminders: boolean
  contact_notes: string
  // El paciente autorizó que los avisos vayan a este contacto (exigido desde los 16, migración 079).
  contact_reminders_authorized: boolean
}

export const EMPTY_CONTACT: ContactForm = {
  contact_name: '',
  contact_relationship: '',
  contact_phone: '',
  contact_email: '',
  contact_document_type: 'DNI',
  contact_document_number: '',
  contact_is_legal_guardian: false,
  contact_receives_reminders: false,
  contact_notes: '',
  contact_reminders_authorized: false,
}

export type PatientContactFields = {
  contact_name?: string | null
  contact_relationship?: string | null
  contact_phone?: string | null
  contact_email?: string | null
  contact_document_type?: string | null
  contact_document_number?: string | null
  contact_is_legal_guardian?: boolean | null
  contact_receives_reminders?: boolean | null
  contact_notes?: string | null
  contact_reminders_authorized_at?: string | null
  contact_reminders_authorized_by?: string | null
}

export function contactFormFrom(p: PatientContactFields | null | undefined): ContactForm {
  if (!p) return { ...EMPTY_CONTACT }
  return {
    contact_name: p.contact_name ?? '',
    contact_relationship: p.contact_relationship ?? '',
    contact_phone: p.contact_phone ?? '',
    contact_email: p.contact_email ?? '',
    contact_document_type: p.contact_document_type ?? 'DNI',
    contact_document_number: p.contact_document_number ?? '',
    contact_is_legal_guardian: Boolean(p.contact_is_legal_guardian),
    contact_receives_reminders: Boolean(p.contact_receives_reminders),
    contact_notes: p.contact_notes ?? '',
    contact_reminders_authorized: Boolean(p.contact_reminders_authorized_at),
  }
}

export function hasContact(p: PatientContactFields | null | undefined): boolean {
  return Boolean(p?.contact_name?.trim() || p?.contact_phone?.trim())
}

// Payload para POST/PATCH /patients. Vacíos → null (así se puede borrar el contacto).
// Si no queda ni nombre ni teléfono, se limpia todo el contacto.
// `contact_reminders_authorized` no es columna: la API lo traduce a la constancia
// contact_reminders_authorized_at/_by (y la borra si cambia el teléfono).
export function buildContactPayload(form: ContactForm): Record<string, string | boolean | null> {
  const t = (v: string) => (v.trim() === '' ? null : v.trim())
  const name = t(form.contact_name)
  const phone = t(form.contact_phone)
  if (!name && !phone) {
    return {
      contact_name: null, contact_relationship: null, contact_phone: null, contact_email: null,
      contact_document_type: null, contact_document_number: null,
      contact_is_legal_guardian: false, contact_receives_reminders: false, contact_notes: null,
      contact_reminders_authorized: false,
    }
  }
  const docNumber = t(form.contact_document_number)
  return {
    contact_name: name,
    contact_relationship: t(form.contact_relationship),
    contact_phone: phone,
    contact_email: t(form.contact_email),
    contact_document_type: docNumber ? (t(form.contact_document_type) ?? 'DNI') : null,
    contact_document_number: docNumber,
    contact_is_legal_guardian: form.contact_is_legal_guardian,
    contact_receives_reminders: Boolean(phone) && form.contact_receives_reminders,
    contact_notes: t(form.contact_notes),
    contact_reminders_authorized: Boolean(phone) && form.contact_reminders_authorized,
  }
}

// Edad en años cumplidos (fecha de Argentina). null si no hay fecha válida.
export function ageFromDob(dob: string | null | undefined, now: Date = new Date()): number | null {
  if (!dob || !/^\d{4}-\d{2}-\d{2}/.test(dob)) return null
  const [y, m, d] = dob.slice(0, 10).split('-').map(Number)
  const today = now.toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
  const [ty, tm, td] = today.split('-').map(Number)
  let age = ty - y
  if (tm < m || (tm === m && td < d)) age--
  return age >= 0 ? age : null
}

export function isMinorAge(age: number | null): boolean {
  return age !== null && age < 18
}

// ── Avisos al contacto (Ley 26.529 art. 4) ───────────────────
// Menores de 16: los avisos pueden ir a su representante. Desde los 16 (o sin
// fecha de nacimiento) solo con autorización registrada del paciente.
export const REMINDER_AUTONOMY_AGE = 16

export function contactRemindersNeedAuthorization(age: number | null): boolean {
  return age === null || age >= REMINDER_AUTONOMY_AGE
}

// ── Consentimientos (CCyC art. 26) ───────────────────────────
// Espejo de validateConsentSigner en la API (que es la que decide).
export type ConsentSignerRule = 'guardian_required' | 'guardian_if_invasive' | 'patient' | 'dob_required'
export type ConsentSignerType = 'patient' | 'guardian' | 'patient_and_guardian'

export function consentSignerRule(age: number | null): ConsentSignerRule {
  if (age === null) return 'dob_required'
  if (age < 13) return 'guardian_required'
  if (age < 16) return 'guardian_if_invasive'
  return 'patient'
}

// Quién firma según la regla (y, entre 13 y 15, si el tratamiento es invasivo).
export function requiredSignerType(rule: ConsentSignerRule, invasive: boolean | null): ConsentSignerType | null {
  if (rule === 'guardian_required') return 'guardian'
  if (rule === 'guardian_if_invasive') {
    if (invasive === null) return null
    return invasive ? 'patient_and_guardian' : 'patient'
  }
  return 'patient'
}

export const CONSENT_RULE_HINT: Record<ConsentSignerRule, string> = {
  dob_required:
    'Cargá la fecha de nacimiento del paciente: define quién tiene que firmar (CCyC art. 26).',
  guardian_required:
    'Paciente menor de 13 años: firma su representante legal (madre, padre o tutor). Explicale el tratamiento al paciente según su grado de madurez (CCyC art. 26).',
  guardian_if_invasive:
    'Paciente de 13 a 15 años: consiente por sí mismo los tratamientos no invasivos. Si el tratamiento es invasivo o compromete su salud, firma con la asistencia de su representante: firman los dos (CCyC art. 26).',
  patient:
    'Paciente de 16 años o más: decide por sí mismo sobre el cuidado de su propio cuerpo (CCyC art. 26).',
}

// ── Constancias del consentimiento (vista previa) ────────────
// El texto que vale lo agrega la API al guardar (buildSignerStatementsHtml en
// dentalos-api/src/lib/patientContact.ts). Esto es solo la vista previa: mantener igual.
const STATEMENT_RELATIONSHIP: Record<string, string> = {
  madre: 'madre', padre: 'padre', tutor_legal: 'tutor/a legal', abuelo: 'abuelo/a', hermano: 'hermano/a',
  pareja: 'pareja', hijo: 'hijo/a', conyuge: 'cónyuge', conviviente: 'conviviente',
  curador: 'curador/a', apoyo: 'apoyo designado judicialmente', otro: 'otro vínculo',
}
const BOND_EVIDENCE_TEXT: Record<string, string> = {
  partida_nacimiento: 'partida de nacimiento', libreta_familia: 'libreta de familia',
  sentencia: 'sentencia judicial', instrumento: 'el instrumento indicado', declaracion: '',
}

export function buildSignerStatementsHtml(p: {
  patient_name: string
  age: number | null
  signer_type: ConsentSignerType
  treatment_invasive?: boolean | null
  signer_name?: string | null
  signer_document?: string | null
  signer_relationship?: string | null
  signer_authority?: string | null
  patient_heard?: boolean | null
  signer_identity_verified?: boolean | null
  signer_bond_evidence?: string | null
}): string {
  const esc = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;')
  const rule = consentSignerRule(p.age)
  const ageText = p.age !== null ? ` (${p.age} años)` : ''
  const patient = esc(p.patient_name.trim())
  const out: string[] = []

  if (rule === 'guardian_if_invasive' && typeof p.treatment_invasive === 'boolean') {
    out.push(`<p><strong>Carácter del tratamiento.</strong> El profesional lo calificó como ${p.treatment_invasive
      ? 'invasivo o que compromete el estado de salud del paciente'
      : 'no invasivo y que no compromete el estado de salud del paciente'} (CCyC art. 26).</p>`)
  }

  if (p.signer_type !== 'patient' && p.signer_name?.trim()) {
    const rel = STATEMENT_RELATIONSHIP[p.signer_relationship ?? '']
    const identity = esc(p.signer_name.trim())
      + (p.signer_document?.trim() ? `, DNI ${esc(p.signer_document.trim())}` : '')
      + (rel ? `, en carácter de ${rel}` : '')
      + (p.signer_authority?.trim() ? `, habilitado/a por: ${esc(p.signer_authority.trim())}` : '')
    out.push(p.signer_type === 'guardian'
      ? `<p><strong>Firma en representación del paciente.</strong> ${identity}, presta el presente consentimiento en nombre de ${patient}${ageText}.</p>`
      : `<p><strong>Asistencia del representante.</strong> ${identity}, asiste a ${patient}${ageText} en el otorgamiento del presente consentimiento, que ambos firman (CCyC art. 26).</p>`)

    if (p.signer_identity_verified) {
      const ev = p.signer_bond_evidence ?? ''
      out.push(ev === 'declaracion'
        ? '<p><strong>Verificación.</strong> El profesional verificó la identidad del representante con su DNI. El vínculo fue declarado por el firmante bajo su responsabilidad, sin documentación respaldatoria.</p>'
        : `<p><strong>Verificación.</strong> El profesional verificó la identidad del representante con su DNI y el vínculo con ${BOND_EVIDENCE_TEXT[ev] || 'documentación'}.</p>`)
    }
  }

  if (rule === 'guardian_required' && p.patient_heard) {
    out.push('<p><strong>Derecho a ser oído.</strong> El paciente fue informado sobre el tratamiento en términos adecuados a su edad y fue escuchado según su grado de madurez (CCyC arts. 26 y 707; Ley 26.529 art. 2 inc. e).</p>')
  }

  return out.length ? `<div class="consent-signers">${out.join('')}</div>` : ''
}
