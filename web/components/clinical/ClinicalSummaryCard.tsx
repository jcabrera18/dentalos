'use client'

// ClinicalSummaryCard — pantallazo read-only de la historia clínica en la ficha
// del paciente: alertas + última evolución + antecedentes/hábitos (colapsable).
// Evita tener que navegar a /clinical-history para lo que el profesional siempre
// quiere ver antes de atender. No escribe nada; linkea a la HC completa.

import { useEffect, useState } from 'react'
import { ChevronDown, ChevronRight, AlertTriangle, Stethoscope } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { DISCIPLINE_LABELS, clinicalTemplateFor, type Discipline } from '@/lib/capabilities'
import type { ClinicalEncounter } from '@/lib/clinicalEncounters'
import type { Vitals } from '@/components/VitalsInput'
import { ClinicalHistoryReadout, type ClinicalHistorySnapshot } from './ClinicalHistoryReadout'
import { EncounterVitals } from './EncounterReadout'

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

export function ClinicalSummaryCard({
  patientId,
  token,
  discipline,
  snapshot,
  onOpenFull,
}: {
  patientId: string
  token: string
  discipline: Discipline
  snapshot: RawHistory | null
  onOpenFull: () => void
}) {
  const snap = toSnapshot(snapshot, discipline)
  const alerts = snap ? alertLabels(snap) : []
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
                  onClick={onOpenFull}
                  className="w-full text-left bg-surface2 hover:bg-surface3 border border-app rounded-xl px-3 py-2.5 transition-colors cursor-pointer"
                >
                  <div className="text-sm font-semibold text-app flex items-center gap-2">
                    {fmtDate(e.encounter_date)} · {DISCIPLINE_LABELS[e.discipline]}
                    {e.risk_flag && <AlertTriangle size={13} className="text-amber-400 shrink-0" />}
                  </div>
                  <div className="text-xs text-app3 mt-0.5 truncate">
                    <EncounterVitals encounter={e} />
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
