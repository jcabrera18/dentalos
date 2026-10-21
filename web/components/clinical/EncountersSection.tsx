'use client'

// EncountersSection — evolución longitudinal por especialidad (P2, VitalOS §7.2).
// Lista cronológica de controles/sesiones + alta/edición/firma + gráfico de peso
// para nutrición. Manejado por CLINICAL_TEMPLATES[discipline].encounters.

import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase'
import { apiFetch } from '@/lib/api'
import { Plus, AlertTriangle, Lock, Trash2 } from 'lucide-react'

// recharts es pesado y el chart solo aparece para disciplinas con peso (nutrición).
// Lo cargamos dinámico para no inflar el bundle del detalle clínico general.
const WeightChart = dynamic(() => import('./WeightChart'), { ssr: false })
import { clinicalTemplateFor, DISCIPLINE_LABELS, type Discipline } from '@/lib/capabilities'
import { VitalsInput, computeBmi, type Vitals } from '@/components/VitalsInput'
import { FieldInput, Toggle } from '@/components/clinical/ClinicalFields'
import { computeEg, formatEg } from '@/lib/obstetrics'

import type { ClinicalEncounter as Encounter } from '@/lib/clinicalEncounters'
import { todayArgDate } from '@/lib/dates'
import { EncounterReadout, EncounterVitals } from './EncounterReadout'

type Mode = 'list' | 'form' | 'detail'

const fmtDate = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })

export default function EncountersSection({ discipline, patientId, fum, initialEncounterId }: { discipline: Discipline; patientId: string; fum?: string | null; initialEncounterId?: string | null }) {
  const supabase = createClient()
  const template = clinicalTemplateFor(discipline)
  const enc = template.encounters
  const perVitals = enc.enabled ? enc.vitalsPerEncounter : []
  const singular = enc.enabled ? enc.singular : 'Registro'
  const showWeightChart = perVitals.includes('weight')
  const isCarne = enc.enabled && enc.type === 'prenatal_control' // vista tipo carné perinatal

  const [items, setItems] = useState<Encounter[]>([])
  const [loaded, setLoaded] = useState(false)
  const [mode, setMode] = useState<Mode>('list')
  const [selected, setSelected] = useState<Encounter | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [formDiscipline, setFormDiscipline] = useState<Discipline>(discipline)
  const [view, setView] = useState<'all' | 'prenatal'>('all')
  const formTemplate = clinicalTemplateFor(formDiscipline).encounters
  const contentFields = formTemplate.enabled ? formTemplate.contentFields : []
  const formVitals = formTemplate.enabled ? formTemplate.vitalsPerEncounter : []
  const formSingular = formTemplate.enabled ? formTemplate.singular : 'Registro'
  const prenatalItems = items.filter(e => e.discipline === 'obstetrics' && e.encounter_type === 'prenatal_control')

  // Form state
  const [date, setDate] = useState('')
  const [riskFlag, setRiskFlag] = useState(false)
  const [vitals, setVitals] = useState<Vitals>({})
  const [content, setContent] = useState<Record<string, unknown>>({})

  async function token() {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token
  }

  async function reload() {
    const t = await token()
    if (!t) return
    const res = await apiFetch(`/patients/${patientId}/encounters`, { token: t })
    setItems(res.data ?? [])
    setLoaded(true)
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId])

  // Deep-link: abrir directamente el encounter indicado (una sola vez, para no
  // reabrirlo al volver a la lista).
  const openedInitial = useRef(false)
  useEffect(() => {
    if (openedInitial.current || !loaded || !initialEncounterId) return
    openedInitial.current = true
    const target = items.find((e) => e.id === initialEncounterId)
    if (target) {
      setSelected(target)
      setMode('detail')
    }
  }, [loaded, items, initialEncounterId])

  function openNew() {
    setEditingId(null)
    setFormDiscipline(discipline)
    setDate(todayArgDate())
    setRiskFlag(false)
    setVitals({})
    setContent({})
    setMode('form')
  }

  function openEdit(e: Encounter) {
    setEditingId(e.id)
    setFormDiscipline(e.discipline)
    setDate(e.encounter_date)
    setRiskFlag(e.risk_flag)
    setVitals(e.vitals ?? {})
    setContent(e.content ?? {})
    setMode('form')
  }

  async function handleSave() {
    setSaving(true)
    try {
      const t = await token()
      if (!t) return
      const body = JSON.stringify({ encounter_date: date, risk_flag: riskFlag, vitals, content })
      if (editingId) {
        await apiFetch(`/patients/${patientId}/encounters/${editingId}`, { method: 'PATCH', token: t, body })
      } else {
        await apiFetch(`/patients/${patientId}/encounters`, { method: 'POST', token: t, body })
      }
      await reload()
      setMode('list')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este registro de evolución?')) return
    const t = await token()
    if (!t) return
    await apiFetch(`/patients/${patientId}/encounters/${id}`, { method: 'DELETE', token: t })
    await reload()
    setMode('list')
  }

  // ── Chart data (peso / IMC en el tiempo) ──
  const chartData = showWeightChart
    ? [...items]
        .filter((e) => e.discipline === discipline && e.vitals?.weight_kg != null)
        .sort((a, b) => a.encounter_date.localeCompare(b.encounter_date))
        .map((e) => ({
          date: fmtDate(e.encounter_date),
          peso: e.vitals?.weight_kg ?? null,
          imc: e.vitals?.bmi ?? computeBmi(e.vitals?.weight_kg, e.vitals?.height_cm),
        }))
    : []

  if (!loaded) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-7 h-7 border-2 border-[#00C4BC] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // ── FORM ──
  if (mode === 'form') {
    return (
      <div className="max-w-3xl mx-auto px-4 md:px-8 py-6 space-y-6">
        <div className="bg-surface border border-app rounded-2xl p-5 space-y-3">
          <div className="text-xs font-bold uppercase tracking-wider text-app3">{editingId ? `Editar ${formSingular.toLowerCase()}` : `Nuevo ${formSingular.toLowerCase()}`} · {DISCIPLINE_LABELS[formDiscipline]}</div>
          <div>
            <label className="block text-xs text-app3 mb-1.5">Fecha</label>
            <input
              type="date" value={date} onChange={(e) => setDate(e.target.value)}
              className="w-full bg-surface2 border border-app rounded-lg px-3 py-2 text-sm text-app focus:outline-none focus:border-[#00C4BC]"
            />
          </div>
        </div>

        {formVitals.length > 0 && <VitalsInput fields={formVitals} value={vitals} onChange={setVitals} />}

        {contentFields.length > 0 && (
          <section className="bg-surface border border-app rounded-2xl p-5">
            <div className="text-xs font-bold uppercase tracking-wider text-app3 mb-2">Nota</div>
            <div className="space-y-2">
              {contentFields.map((f) => (
                <FieldInput key={f.key} field={f} value={content[f.key]} onChange={(v) => setContent((c) => ({ ...c, [f.key]: v }))} />
              ))}
            </div>
          </section>
        )}

        <section className="bg-surface border border-app rounded-2xl p-5">
          <label className="flex items-center justify-between cursor-pointer select-none">
            <span className="text-sm text-app flex items-center gap-2"><AlertTriangle size={15} className="text-amber-400" /> Marcar como signo de alarma</span>
            <Toggle value={riskFlag} onChange={() => setRiskFlag((r) => !r)} />
          </label>
        </section>

        <div className="flex gap-3 pb-8">
          <button onClick={() => setMode('list')} disabled={saving}
            className="flex-1 bg-surface2 hover:bg-surface3 text-app font-semibold py-3 rounded-xl transition-colors disabled:opacity-60 cursor-pointer">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-[2] bg-[#00C4BC] hover:bg-[#00aaa3] active:scale-95 text-white font-bold py-3 rounded-xl transition-all disabled:opacity-60 cursor-pointer">
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    )
  }

  // ── DETAIL ──
  if (mode === 'detail' && selected) {
    return (
      <EncounterDetail
        patientId={patientId}
        encounter={selected}
        onBack={() => setMode('list')}
        onEdit={() => openEdit(selected)}
        onDelete={() => handleDelete(selected.id)}
        onSigned={async () => { await reload(); setMode('list') }}
      />
    )
  }

  // ── LIST ──
  return (
    <div className="max-w-3xl mx-auto px-4 md:px-8 py-6 space-y-5">
      {showWeightChart && chartData.length >= 2 && (
        <section className="bg-surface border border-app rounded-2xl p-5">
          <div className="text-xs font-bold uppercase tracking-wider text-app3 mb-4">Evolución de peso / IMC</div>
          <WeightChart data={chartData} />
        </section>
      )}

      <button onClick={openNew}
        className="w-full flex items-center justify-center gap-2 bg-[#00C4BC] hover:bg-[#00aaa3] active:scale-95 text-white font-bold py-3 rounded-xl transition-all cursor-pointer">
        <Plus size={18} /> Nuevo {singular.toLowerCase()}
      </button>

      {isCarne && (
        <div className="flex gap-2">
          {(['all', 'prenatal'] as const).map(option => (
            <button key={option} onClick={() => setView(option)} aria-pressed={view === option}
              className={`px-3 py-2 rounded-lg text-sm font-semibold ${view === option ? 'bg-[#00C4BC] text-white' : 'bg-surface2 text-app3'}`}>
              {option === 'all' ? 'Todas las evoluciones' : 'Carné prenatal'}
            </button>
          ))}
        </div>
      )}

      {items.length === 0 || (isCarne && view === 'prenatal' && prenatalItems.length === 0) ? (
        <div className="text-center py-16 text-app3 text-sm">Sin registros de evolución todavía</div>
      ) : isCarne && view === 'prenatal' ? (
        <div className="bg-surface border border-app rounded-2xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-app3 border-b border-app">
                <th className="text-left font-semibold px-3 py-2.5">Fecha</th>
                <th className="text-left font-semibold px-3 py-2.5">EG</th>
                <th className="text-left font-semibold px-3 py-2.5">TA</th>
                <th className="text-left font-semibold px-3 py-2.5">Peso</th>
                <th className="text-left font-semibold px-3 py-2.5">AU</th>
                <th className="text-left font-semibold px-3 py-2.5">LCF</th>
                <th className="text-left font-semibold px-3 py-2.5">MF</th>
                <th className="px-2 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {prenatalItems.map((e) => {
                const c = (e.content ?? {}) as Record<string, unknown>
                const v = e.vitals ?? {}
                const mf = c.mov_fetales === 'pos' ? '+' : c.mov_fetales === 'neg' ? '−' : '—'
                return (
                  <tr key={e.id} onClick={() => { setSelected(e); setMode('detail') }}
                    className="border-b border-app/50 last:border-0 hover:bg-surface2 cursor-pointer">
                    <td className="px-3 py-2.5 text-app whitespace-nowrap flex items-center gap-1.5">
                      {e.risk_flag && <AlertTriangle size={13} className="text-amber-400 shrink-0" />}
                      {fmtDate(e.encounter_date)}
                    </td>
                    <td className="px-3 py-2.5 text-app">{formatEg(computeEg(fum, e.encounter_date))}</td>
                    <td className="px-3 py-2.5 text-app">{v.systolic_bp != null ? `${v.systolic_bp}/${v.diastolic_bp ?? '—'}` : '—'}</td>
                    <td className="px-3 py-2.5 text-app">{v.weight_kg != null ? `${v.weight_kg}` : '—'}</td>
                    <td className="px-3 py-2.5 text-app">{(c.altura_uterina as number) ?? '—'}</td>
                    <td className="px-3 py-2.5 text-app">{(c.lcf as number) ?? '—'}</td>
                    <td className="px-3 py-2.5 text-app">{mf}</td>
                    <td className="px-2 py-2.5 text-app3">{e.signed && <Lock size={12} />}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((e) => (
            <button key={e.id} onClick={() => { setSelected(e); setMode('detail') }}
              className="w-full text-left bg-surface border border-app hover:bg-surface2 rounded-2xl px-5 py-4 transition-colors">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-app flex items-center gap-2">
                    {fmtDate(e.encounter_date)} · {DISCIPLINE_LABELS[e.discipline]}
                    {e.risk_flag && <AlertTriangle size={14} className="text-amber-400 shrink-0" />}
                    {e.signed && <Lock size={13} className="text-app3 shrink-0" />}
                  </div>
                  <div className="text-xs text-app3 mt-0.5 truncate">
                    <EncounterVitals encounter={e} />
                  </div>
                </div>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-app3 shrink-0"><polyline points="9 18 15 12 9 6"/></svg>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Detalle + firma de un encounter ──
function EncounterDetail({
  patientId, encounter, onBack, onEdit, onDelete, onSigned,
}: {
  patientId: string
  encounter: Encounter
  onBack: () => void
  onEdit: () => void
  onDelete: () => void
  onSigned: () => void
}) {
  const supabase = createClient()
  const [signing, setSigning] = useState(false)
  const [hasInk, setHasInk] = useState(false)
  const [saving, setSaving] = useState(false)
  const [drawing, setDrawing] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!signing) return
    requestAnimationFrame(() => {
      const c = canvasRef.current
      if (!c) return
      c.width = c.offsetWidth || 400
      c.height = 160
      const ctx = c.getContext('2d')
      if (ctx) { ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round' }
      setHasInk(false)
    })
  }, [signing])

  function down(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = canvasRef.current; if (!c) return
    c.setPointerCapture(e.pointerId)
    const r = c.getBoundingClientRect(); const ctx = c.getContext('2d'); if (!ctx) return
    ctx.beginPath(); ctx.moveTo((e.clientX - r.left) * (c.width / r.width), (e.clientY - r.top) * (c.height / r.height))
    setDrawing(true)
  }
  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing) return
    const c = canvasRef.current; if (!c) return
    const r = c.getBoundingClientRect(); const ctx = c.getContext('2d'); if (!ctx) return
    ctx.lineTo((e.clientX - r.left) * (c.width / r.width), (e.clientY - r.top) * (c.height / r.height)); ctx.stroke()
    setHasInk(true)
  }

  async function confirmSign() {
    if (!hasInk || !canvasRef.current) return
    setSaving(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      await apiFetch(`/patients/${patientId}/encounters/${encounter.id}/signatures`, {
        method: 'POST',
        token: session.access_token,
        body: JSON.stringify({ signature_data: canvasRef.current.toDataURL('image/png') }),
      })
      onSigned()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-8 py-6 space-y-5">
      <button onClick={onBack} className="text-sm text-app3 hover:text-app">← Volver</button>

      <div className="bg-surface border border-app rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-app">{fmtDate(encounter.encounter_date)} · {DISCIPLINE_LABELS[encounter.discipline]}</div>
          <div className="flex items-center gap-2">
            {encounter.risk_flag && <span className="text-xs font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-lg">Signo de alarma</span>}
            {encounter.signed && <span className="text-xs text-app3 flex items-center gap-1"><Lock size={12} /> Firmado</span>}
          </div>
        </div>

        <EncounterReadout encounter={encounter} />
      </div>

      {/* Firma */}
      {!encounter.signed && !signing && (
        <div className="flex gap-3">
          <button onClick={onEdit} className="flex-1 bg-surface2 hover:bg-surface3 text-app font-semibold py-3 rounded-xl transition-colors cursor-pointer">Editar</button>
          <button onClick={() => setSigning(true)} className="flex-1 bg-surface2 hover:bg-surface3 text-app font-semibold py-3 rounded-xl transition-colors cursor-pointer">Firmar</button>
          <button onClick={onDelete} title="Eliminar" className="px-4 bg-surface2 hover:bg-red-500/10 text-app3 hover:text-red-400 rounded-xl transition-colors cursor-pointer"><Trash2 size={16} /></button>
        </div>
      )}

      {signing && (
        <div className="bg-surface border border-app rounded-2xl p-5 space-y-3">
          <div className="text-xs font-bold uppercase tracking-wider text-app3">Firma del paciente</div>
          <div className="relative bg-surface2 border-2 border-dashed border-app rounded-xl overflow-hidden">
            <canvas ref={canvasRef} className="w-full block" style={{ height: 160, touchAction: 'none', cursor: 'crosshair' }}
              onPointerDown={down} onPointerMove={move} onPointerUp={() => setDrawing(false)} onPointerLeave={() => setDrawing(false)} />
            {!hasInk && <div className="absolute inset-0 flex items-center justify-center pointer-events-none"><span className="text-app3 text-sm">Firmar aquí</span></div>}
          </div>
          <div className="flex gap-3">
            <button onClick={() => setSigning(false)} disabled={saving} className="flex-1 bg-surface2 hover:bg-surface3 text-app font-semibold py-2.5 rounded-xl transition-colors disabled:opacity-60 cursor-pointer">Cancelar</button>
            <button onClick={confirmSign} disabled={!hasInk || saving} className="flex-[2] bg-[#00C4BC] hover:bg-[#00aaa3] active:scale-95 text-white font-bold py-2.5 rounded-xl transition-all disabled:opacity-60 cursor-pointer">{saving ? 'Guardando...' : 'Confirmar firma'}</button>
          </div>
        </div>
      )}

      <div className="pb-8" />
    </div>
  )
}
