'use client'

import { clinicalSectionsFor, clinicalTemplateFor, normalizeDiscipline, DISCIPLINE_LABELS, type Discipline } from '@/lib/capabilities'
import { VitalsDisplay, type Vitals } from '@/components/VitalsInput'
import { FieldsReadout } from './ClinicalFields'

type ActiveDetail = { active?: boolean; detail?: string }

// Los snapshots anteriores a VitalOS no tienen discipline ni sections.
export interface ClinicalHistorySnapshot {
  discipline?: Discipline
  summary?: string | null
  risk_level?: string | null
  sections?: Record<string, Record<string, unknown>>
  vitals?: Vitals
  alerts?: Record<string, unknown> & {
    diabetes?: { active?: boolean; controlled?: boolean }
    infectious_disease?: ActiveDetail
  }
  medical_history?: Record<string, unknown> & {
    current_disease?: ActiveDetail
    current_treatment?: ActiveDetail
    surgeries?: string
  }
  family_history?: { cardiac?: boolean; diabetes?: boolean; other?: string }
  habits?: { smoker?: boolean; alcohol?: boolean; oral_hygiene?: string }
}

// El formato firmado determina la lectura, independientemente de quién lo consulta.
// `hideAlerts` omite la sección de alertas (p. ej. cuando ya se muestran como banner aparte).
export function ClinicalHistoryReadout({ snap, hideAlerts = false }: { snap: ClinicalHistorySnapshot; hideAlerts?: boolean }) {
  const discipline = normalizeDiscipline(snap.discipline)
  return (
    <div className="space-y-4">
      <div className="text-xs font-semibold text-app3">{DISCIPLINE_LABELS[discipline]}</div>
      {discipline === 'dentistry'
        ? <DentalHistoryReadout snap={snap} hideAlerts={hideAlerts} />
        : <GenericHistoryReadout snap={snap} />}
    </div>
  )
}

function DentalHistoryReadout({ snap, hideAlerts = false }: { snap: ClinicalHistorySnapshot; hideAlerts?: boolean }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 text-sm">

      {!hideAlerts && (
      <section>
        <div className="text-xs font-semibold text-red-400 mb-1.5">Alertas clínicas</div>
        <div className="space-y-1">
          {[
            { key: 'aspirin',        label: 'Toma aspirina' },
            { key: 'anticoagulants', label: 'Anticoagulantes' },
            { key: 'pregnancy',      label: 'Embarazo' },
            { key: 'cardiac',        label: 'Cardíaco' },
            { key: 'hypertension',   label: 'Presión alta' },
            { key: 'seizures',       label: 'Convulsiones / Epilepsia' },
          ].filter(f => snap.alerts?.[f.key]).map(f => (
            <div key={f.key} className="flex items-center gap-2 text-app"><span className="text-red-400 text-xs">●</span>{f.label}</div>
          ))}
          {snap.alerts?.diabetes?.active && (
            <div className="flex items-center gap-2 text-app"><span className="text-red-400 text-xs">●</span>Diabetes{snap.alerts.diabetes.controlled ? ' (controlada)' : ''}</div>
          )}
          {snap.alerts?.infectious_disease?.active && (
            <div className="flex items-center gap-2 text-app"><span className="text-red-400 text-xs">●</span>Enf. infectocontagiosa{snap.alerts.infectious_disease.detail ? `: ${snap.alerts.infectious_disease.detail}` : ''}</div>
          )}
          {!['aspirin','anticoagulants','pregnancy','cardiac','hypertension','seizures'].some((k: string) => snap.alerts?.[k]) && !snap.alerts?.diabetes?.active && !snap.alerts?.infectious_disease?.active && (
            <div className="text-app3 text-xs">Sin alertas</div>
          )}
        </div>
      </section>
      )}

      <section>
        <div className="text-xs font-semibold text-app3 mb-1.5">Antecedentes personales</div>
        <div className="space-y-1">
          {[
            { key: 'renal', label: 'Renal' },
            { key: 'hepatic', label: 'Hepático' },
            { key: 'respiratory', label: 'Respiratorio' },
            { key: 'neurological', label: 'Neurológico' },
            { key: 'transfusions', label: 'Transfusiones' },
            { key: 'sexually_transmitted', label: 'Sífilis / Gonorrea' },
          ].filter(f => snap.medical_history?.[f.key]).map(f => (
            <div key={f.key} className="flex items-center gap-2 text-app"><span className="text-[#00C4BC] text-xs">●</span>{f.label}</div>
          ))}
          {snap.medical_history?.current_disease?.active && (
            <div className="flex items-center gap-2 text-app"><span className="text-[#00C4BC] text-xs">●</span>Enfermedad actual{snap.medical_history.current_disease.detail ? `: ${snap.medical_history.current_disease.detail}` : ''}</div>
          )}
          {snap.medical_history?.current_treatment?.active && (
            <div className="flex items-center gap-2 text-app"><span className="text-[#00C4BC] text-xs">●</span>Medicación actual{snap.medical_history.current_treatment.detail ? `: ${snap.medical_history.current_treatment.detail}` : ''}</div>
          )}
          {snap.medical_history?.surgeries && (
            <div className="flex items-center gap-2 text-app"><span className="text-[#00C4BC] text-xs">●</span>Cirugías: {snap.medical_history.surgeries}</div>
          )}
          {!['renal','hepatic','respiratory','neurological','transfusions','sexually_transmitted'].some((k: string) => snap.medical_history?.[k]) && !snap.medical_history?.current_disease?.active && !snap.medical_history?.current_treatment?.active && !snap.medical_history?.surgeries && (
            <div className="text-app3 text-xs">Sin antecedentes</div>
          )}
        </div>
      </section>

      <section>
        <div className="text-xs font-semibold text-app3 mb-1.5">Hábitos</div>
        <div className="space-y-1">
          {snap.habits?.smoker && <div className="flex items-center gap-2 text-app"><span className="text-amber-400 text-xs">●</span>Fumador</div>}
          {snap.habits?.alcohol && <div className="flex items-center gap-2 text-app"><span className="text-amber-400 text-xs">●</span>Consume alcohol</div>}
          {snap.habits?.oral_hygiene && <div className="flex items-center gap-2 text-app"><span className="text-amber-400 text-xs">●</span>Higiene oral: {snap.habits.oral_hygiene}</div>}
          {!snap.habits?.smoker && !snap.habits?.alcohol && !snap.habits?.oral_hygiene && (
            <div className="text-app3 text-xs">Sin datos</div>
          )}
        </div>
      </section>

      <section>
        <div className="text-xs font-semibold text-app3 mb-1.5">Antecedentes familiares</div>
        <div className="space-y-1">
          {snap.family_history?.cardiac && <div className="flex items-center gap-2 text-app"><span className="text-purple-400 text-xs">●</span>Cardíaco</div>}
          {snap.family_history?.diabetes && <div className="flex items-center gap-2 text-app"><span className="text-purple-400 text-xs">●</span>Diabetes</div>}
          {snap.family_history?.other && <div className="flex items-center gap-2 text-app"><span className="text-purple-400 text-xs">●</span>{snap.family_history.other}</div>}
          {!snap.family_history?.cardiac && !snap.family_history?.diabetes && !snap.family_history?.other && (
            <div className="text-app3 text-xs">Sin antecedentes familiares</div>
          )}
        </div>
      </section>

      {snap.summary && (
        <section className="md:col-span-2">
          <div className="text-xs font-semibold text-app3 mb-1.5">Resumen clínico</div>
          <p className="text-app">{snap.summary}</p>
        </section>
      )}
    </div>
  )
}

function GenericHistoryReadout({ snap }: { snap: ClinicalHistorySnapshot }) {
  const disc = normalizeDiscipline(snap.discipline)
  const defs = clinicalSectionsFor(disc)
  const tmpl = clinicalTemplateFor(disc)
  const snapSections = snap.sections ?? {}
  const visible = defs.filter((s) =>
    s.fields.some((f) => {
      const v = snapSections[s.id]?.[f.key]
      return v !== undefined && v !== null && v !== '' && v !== false
    })
  )
  return (
    <div className="space-y-4 text-sm">
      {tmpl.vitals.length > 0 && (
        <section>
          <div className="text-xs font-bold uppercase tracking-wider text-app3 mb-1.5">Signos vitales</div>
          <VitalsDisplay fields={tmpl.vitals} value={snap.vitals ?? {}} />
        </section>
      )}
      {visible.map((s) => (
        <section key={s.id}>
          <div className="text-xs font-bold uppercase tracking-wider text-app3 mb-1.5">{s.label}</div>
          <FieldsReadout fields={s.fields} values={snapSections[s.id] ?? {}} />
        </section>
      ))}
      {snap.summary && (
        <section>
          <div className="text-xs font-bold uppercase tracking-wider text-app3 mb-1.5">Resumen clínico</div>
          <p className="text-app">{snap.summary}</p>
        </section>
      )}
      {!visible.length && !snap.summary && tmpl.vitals.length === 0 && (
        <div className="text-app3 text-xs">Sin datos registrados</div>
      )}
    </div>
  )
}
