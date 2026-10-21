'use client'

// ClinicalSummaryCard — pantallazo read-only de la historia clínica en la ficha
// del paciente: alertas + última evolución + antecedentes/hábitos (colapsable).
// Evita tener que navegar a /clinical-history para lo que el profesional siempre
// quiere ver antes de atender. No escribe nada; linkea a la HC completa.

import { useEffect, useState } from 'react'
import { ChevronDown, ChevronRight, AlertTriangle, Stethoscope } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { DISCIPLINE_LABELS, clinicalTemplateFor, clinicalSectionsFor, type Discipline } from '@/lib/capabilities'
import type { ClinicalEncounter } from '@/lib/clinicalEncounters'
import { computeBmi, type Vitals } from '@/components/VitalsInput'
import { ClinicalHistoryReadout, type ClinicalHistorySnapshot } from './ClinicalHistoryReadout'

// Forma cruda del endpoint /clinical-history: odontología (campos al nivel raíz) o
// el resto de disciplinas ({ discipline_sections }).
type RawHistory = Pick<ClinicalHistorySnapshot, 'summary' | 'alerts' | 'medical_history' | 'habits' | 'family_history'> & {
  discipline_sections?: Record<string, Record<string, unknown>> & { vitals?: Vitals }
}

const fmtDate = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })

// Normalizamos ambas formas a un único snapshot.
function toSnapshot(raw: RawHistory | null | undefined, discipline: Discipline): ClinicalHistorySnapshot | null {
  if (!raw) return null
  if (raw.discipline_sections) {
    const { vitals, ...sections } = raw.discipline_sections
    return { discipline, summary: raw.summary ?? null, sections, vitals }
  }
  return { discipline: 'dentistry', ...raw }
}

function alertLabels(snap: ClinicalHistorySnapshot): string[] {
  const a = snap.alerts
  if (!a) return []
  return [
    a.aspirin && 'Aspirina',
    a.anticoagulants && 'Anticoagulantes',
    a.pregnancy && 'Embarazo',
    a.cardiac && 'Cardíaco',
    a.hypertension && 'Presión alta',
    a.seizures && 'Epilepsia',
    a.diabetes?.active && `Diabetes${!a.diabetes.controlled ? ' (no controlada)' : ''}`,
    a.infectious_disease?.active && (a.infectious_disease.detail || 'Enf. infectocontagiosa'),
  ].filter((x): x is string => typeof x === 'string')
}

// ── Highlights para disciplinas declarativas (medicina general, etc.) ──
// La franja de alertas de odontología usa snapshot.alerts; las demás disciplinas
// guardan todo en `sections`. Derivamos lo clínicamente prioritario desde ahí:
// alergias/infecto (alerta roja), antecedentes activos, medicación y hábitos.
const DANGER_KEYS = new Set(['hiv', 'tbc', 'chagas', 'ets', 'hepatitis_b', 'hepatitis_c'])
const HABIT_SECTION = 'consumo_sustancias'
const MED_KEYS = new Set(['medicacion', 'psicofarmacos'])
const ALLERGY_SKIP = new Set(['alergia', 'alergia_medicamentos']) // tratadas aparte

type Highlights = { alerts: string[]; conditions: string[]; medication: string | null; habits: string[] }

function deriveHighlights(snap: ClinicalHistorySnapshot, discipline: Discipline): Highlights {
  const defs = clinicalSectionsFor(discipline)
  const sec = snap.sections ?? {}
  const alerts: string[] = []
  const conditions: string[] = []
  const habits: string[] = []
  let medication: string | null = null

  // Alergias primero (seguridad): mostramos el detalle a medicamentos si existe.
  const alergiaMed = sec['quirurgicos_internaciones']?.['alergia_medicamentos']
  const alergiaBool = sec['antecedentes_patologicos']?.['alergia'] === true
  if (typeof alergiaMed === 'string' && alergiaMed.trim()) alerts.push(`Alergias: ${alergiaMed.trim()}`)
  else if (alergiaBool) alerts.push('Alergias')

  for (const s of defs) {
    for (const f of s.fields) {
      if (ALLERGY_SKIP.has(f.key)) continue
      const v = sec[s.id]?.[f.key]
      if (MED_KEYS.has(f.key)) {
        if (typeof v === 'string' && v.trim()) medication = v.trim()
        continue
      }
      if (f.type !== 'bool' || v !== true) continue
      if (DANGER_KEYS.has(f.key)) alerts.push(f.label)
      else if (s.id === HABIT_SECTION) habits.push(f.label)
      else conditions.push(f.label)
    }
  }

  // Detalle de tabaquismo (cigarrillos/día) y drogas.
  const cig = sec[HABIT_SECTION]?.['tabaco_cant_dia']
  const tabIdx = habits.indexOf('Tabaquismo')
  if (tabIdx >= 0 && typeof cig === 'number' && cig > 0) habits[tabIdx] = `Tabaquismo (${cig}/día)`
  const drogas = sec[HABIT_SECTION]?.['drogas']
  if (typeof drogas === 'string' && drogas.trim()) habits.push(`Drogas: ${drogas.trim()}`)

  return { alerts, conditions, medication, habits }
}

// ── Flags de vitales anormales (para resaltar en las filas de evolución) ──
const SEV_CLS: Record<'red' | 'amber', string> = {
  red: 'text-red-600 dark:text-red-400 font-semibold',
  amber: 'text-amber-600 dark:text-amber-400 font-semibold',
}

function bpSeverity(s?: number | null, d?: number | null): 'red' | 'amber' | null {
  if (s == null && d == null) return null
  if ((s ?? 0) >= 140 || (d ?? 0) >= 90) return 'red'
  if ((s ?? 0) >= 130 || (d ?? 0) >= 85) return 'amber'
  return null
}

function bmiSeverity(b?: number | null): 'red' | 'amber' | null {
  if (b == null) return null
  if (b >= 35 || b < 16) return 'red'
  if (b >= 25 || b < 18.5) return 'amber'
  return null
}

// Vitales de un encounter con los valores fuera de rango resaltados. Espeja el
// formato de VitalsDisplay pero colorea TA e IMC según severidad.
function EncounterVitalsFlagged({ encounter }: { encounter: ClinicalEncounter }) {
  const config = clinicalTemplateFor(encounter.discipline).encounters
  if (!config.enabled || !config.vitalsPerEncounter.length) return null
  const v = encounter.vitals ?? {}
  const items: { label: string; text: string; sev: 'red' | 'amber' | null }[] = []
  for (const f of config.vitalsPerEncounter) {
    if (f === 'bp') {
      if (v.systolic_bp != null || v.diastolic_bp != null)
        items.push({ label: 'TA', text: `${v.systolic_bp ?? '—'}/${v.diastolic_bp ?? '—'} mmHg`, sev: bpSeverity(v.systolic_bp, v.diastolic_bp) })
    } else if (f === 'bmi') {
      const bmi = v.bmi ?? computeBmi(v.weight_kg, v.height_cm)
      if (bmi != null) items.push({ label: 'IMC', text: `${bmi} kg/m²`, sev: bmiSeverity(bmi) })
    } else if (f === 'weight' && v.weight_kg != null) {
      items.push({ label: 'Peso', text: `${v.weight_kg} kg`, sev: null })
    } else if (f === 'height' && v.height_cm != null) {
      items.push({ label: 'Talla', text: `${v.height_cm} cm`, sev: null })
    }
  }
  if (!items.length) return <span className="text-app3">Sin signos vitales</span>
  return (
    <span className="inline-flex flex-wrap gap-x-3 gap-y-0.5">
      {items.map((it) => (
        <span key={it.label}>
          <span className="text-app3">{it.label}:</span>{' '}
          <span className={it.sev ? SEV_CLS[it.sev] : ''}>{it.text}</span>
        </span>
      ))}
    </span>
  )
}

export function ClinicalSummaryCard({
  patientId,
  token,
  discipline,
  snapshot,
  onOpenFull,
  onOpenEncounter,
}: {
  patientId: string
  token: string
  discipline: Discipline
  snapshot: RawHistory | null
  onOpenFull: () => void
  onOpenEncounter?: (encounterId: string) => void
}) {
  const snap = toSnapshot(snapshot, discipline)
  const isDental = discipline === 'dentistry'
  // Odontología: alertas desde snapshot.alerts. Resto: derivadas de las secciones.
  const highlights = snap && !isDental ? deriveHighlights(snap, discipline) : null
  const alerts = snap ? (isDental ? alertLabels(snap) : highlights!.alerts) : []
  // Odontología no usa evoluciones longitudinales (usa odontograma) → no mostramos la sección.
  const encountersEnabled = clinicalTemplateFor(discipline).encounters.enabled
  const [encounters, setEncounters] = useState<ClinicalEncounter[] | null>(null)
  const [showHistory, setShowHistory] = useState(false)

  useEffect(() => {
    if (!encountersEnabled) return
    let cancelled = false
    apiFetch(`/patients/${patientId}/encounters`, { token })
      .then((res) => { if (!cancelled) setEncounters(res.data ?? []) })
      .catch(() => { if (!cancelled) setEncounters([]) })
    return () => { cancelled = true }
  }, [patientId, token, encountersEnabled])

  const recent = (encounters ?? []).slice(0, 3)
  const hasBaseHistory = !!snap && (
    alerts.length > 0 ||
    !!snap.summary ||
    (snap.sections && Object.keys(snap.sections).length > 0) ||
    !!snap.medical_history || !!snap.habits || !!snap.family_history
  )

  return (
    <div className="bg-surface border border-app rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-app flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">
          <Stethoscope size={16} className="text-[#00C4BC]" /> Resumen clínico
        </h3>
        <button
          onClick={onOpenFull}
          className="text-xs font-semibold text-[#00C4BC] hover:underline cursor-pointer"
        >
          Ver completa ›
        </button>
      </div>

      <div className="p-5 space-y-4">
        {/* Alertas — siempre visibles, seguridad del paciente */}
        {alerts.length > 0 && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
            <div className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <AlertTriangle size={13} /> Alertas clínicas
            </div>
            <div className="flex flex-wrap gap-1.5">
              {alerts.map((label) => (
                <span key={label} className="text-xs font-semibold text-red-700 dark:text-red-300 bg-red-500/15 border border-red-500/20 px-2 py-0.5 rounded-md">
                  {label}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Antecedentes activos — chips (disciplinas declarativas) */}
        {highlights && highlights.conditions.length > 0 && (
          <section>
            <div className="text-xs font-bold uppercase tracking-wider text-app3 mb-2">Antecedentes</div>
            <div className="flex flex-wrap gap-1.5">
              {highlights.conditions.map((c) => (
                <span key={c} className="text-xs font-medium text-app2 bg-surface2 border border-app px-2 py-0.5 rounded-md">
                  {c}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Medicación actual */}
        {highlights?.medication && (
          <section>
            <div className="text-xs font-bold uppercase tracking-wider text-app3 mb-1.5">Medicación actual</div>
            <p className="text-sm text-app whitespace-pre-line">{highlights.medication}</p>
          </section>
        )}

        {/* Hábitos de riesgo */}
        {highlights && highlights.habits.length > 0 && (
          <section>
            <div className="text-xs font-bold uppercase tracking-wider text-app3 mb-2">Hábitos</div>
            <div className="flex flex-wrap gap-1.5">
              {highlights.habits.map((h) => (
                <span key={h} className="text-xs font-medium text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md">
                  {h}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Última evolución (disciplinas con evoluciones longitudinales) */}
        {encountersEnabled && (
        <section>
          <div className="text-xs font-bold uppercase tracking-wider text-app3 mb-2">Última evolución</div>
          {encounters === null ? (
            <div className="space-y-2 animate-pulse">
              <div className="h-3 bg-surface2 rounded w-2/3" />
              <div className="h-3 bg-surface2 rounded w-1/2" />
            </div>
          ) : recent.length === 0 ? (
            <div className="text-sm text-app3">Sin evoluciones registradas.</div>
          ) : (
            <div className="space-y-2">
              {recent.map((e) => (
                <button
                  key={e.id}
                  onClick={() => (onOpenEncounter ? onOpenEncounter(e.id) : onOpenFull())}
                  className="w-full text-left bg-surface2 hover:bg-surface3 border border-app rounded-xl px-3 py-2.5 transition-colors cursor-pointer"
                >
                  <div className="text-sm font-semibold text-app flex items-center gap-2">
                    {fmtDate(e.encounter_date)} · {DISCIPLINE_LABELS[e.discipline]}
                    {e.risk_flag && <AlertTriangle size={13} className="text-amber-400 shrink-0" />}
                  </div>
                  <div className="text-xs text-app3 mt-0.5 truncate">
                    <EncounterVitalsFlagged encounter={e} />
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
        )}

        {/* Antecedentes y hábitos — colapsable */}
        {hasBaseHistory && snap && (
          <section className="border-t border-app pt-3">
            <button
              onClick={() => setShowHistory((s) => !s)}
              className="w-full flex items-center justify-between text-xs font-bold uppercase tracking-wider text-app3 hover:text-app transition-colors cursor-pointer"
            >
              Antecedentes y hábitos
              {showHistory ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
            </button>
            {showHistory && (
              <div className="mt-3">
                <ClinicalHistoryReadout snap={snap} hideAlerts />
              </div>
            )}
          </section>
        )}

        {/* Sin HC cargada */}
        {!hasBaseHistory && (!encountersEnabled || (encounters !== null && recent.length === 0)) && (
          <button
            onClick={onOpenFull}
            className="w-full text-center text-sm text-[#00C4BC] font-semibold py-2 hover:underline cursor-pointer"
          >
            Iniciar historia clínica →
          </button>
        )}
      </div>
    </div>
  )
}
