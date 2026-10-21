'use client'

// GenericClinicalHistory — historia clínica declarativa para disciplinas no
// odontológicas (VitalOS §7.1). Renderiza las secciones de CLINICAL_SECTIONS +
// el bloque de vitales desde CLINICAL_TEMPLATES. Odontología NO usa este
// componente: conserva su formulario fijo (byte-equivalente a DentalOS).
//
// Fase A: anamnesis base por secciones + vitales + resumen + guardar.
// Firma del paciente sobre la anamnesis base (snapshot + canvas), con el mismo
// backend /clinical-history/signatures que usa odontología. La evolución
// longitudinal se firma por encounter en EncountersSection.

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { apiFetch } from '@/lib/api'
import type { ClinicalEncounter } from '@/lib/clinicalEncounters'
import { ArrowLeft, FileDown } from 'lucide-react'
import {
  clinicalSectionsFor,
  clinicalTemplateFor,
  DISCIPLINE_LABELS,
  type Discipline,
} from '@/lib/capabilities'
import { VitalsInput, type Vitals } from '@/components/VitalsInput'
import { SectionCard, inputCls } from '@/components/clinical/ClinicalFields'
import { ClinicalHistoryReadout, type ClinicalHistorySnapshot } from '@/components/clinical/ClinicalHistoryReadout'
import EncountersSection from '@/components/clinical/EncountersSection'
import { computeFpp, computeEg, formatEg, formatDateAR } from '@/lib/obstetrics'

type Sections = Record<string, Record<string, unknown>>
type Mode = 'form' | 'sign' | 'signatures' | 'sig-detail'

export default function GenericClinicalHistory({ discipline }: { discipline: Discipline }) {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const patientId = params.id as string
  const supabase = createClient()

  // Deep-link a una evolución puntual (desde el resumen clínico de la ficha):
  // ?encounter=<id> abre la pestaña de evolución directamente en ese registro.
  const initialEncounterId = searchParams.get('encounter')

  const template = clinicalTemplateFor(discipline)
  const sectionDefs = clinicalSectionsFor(discipline)

  const [patient, setPatient] = useState<{ first_name: string; last_name: string; document_number?: string | null; date_of_birth?: string | null } | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [exportingPDF, setExportingPDF] = useState(false)

  const [sections, setSections] = useState<Sections>({})
  const [vitals, setVitals] = useState<Vitals>({})
  const [summary, setSummary] = useState('')
  const [riskLevel, setRiskLevel] = useState<string | null>(null)

  const encountersEnabled = template.encounters.enabled
  const [tab, setTab] = useState<'anamnesis' | 'encounters'>(
    encountersEnabled && initialEncounterId ? 'encounters' : 'anamnesis',
  )

  // Firma del paciente
  const [mode, setMode] = useState<Mode>('form')
  const [signatures, setSignatures] = useState<{ id: string; signed_at: string }[]>([])
  const [sigSelected, setSigSelected] = useState<{ signed_at: string; signature_data: string; history_snapshot: ClinicalHistorySnapshot } | null>(null)
  const [sigLoading, setSigLoading] = useState(false)
  const [sigHasSignature, setSigHasSignature] = useState(false)
  const [savingSig, setSavingSig] = useState(false)
  const [sigSaved, setSigSaved] = useState(false)
  const [isDrawing, setIsDrawing] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/'); return }
      const token = session.access_token
      const [patientRes, historyRes, sigsRes] = await Promise.all([
        apiFetch(`/patients/${patientId}`, { token }),
        apiFetch(`/patients/${patientId}/clinical-history`, { token }),
        apiFetch(`/patients/${patientId}/clinical-history/signatures`, { token }),
      ])
      setPatient(patientRes.data)
      const ds = historyRes.data?.discipline_sections ?? {}
      const { vitals: v, ...rest } = ds
      setSections(rest ?? {})
      setVitals(v ?? {})
      setSummary(historyRes.data?.summary ?? '')
      setRiskLevel(historyRes.data?.risk_level ?? null)
      setSignatures(sigsRes.data ?? [])
      setLoaded(true)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId])

  // Init canvas al entrar en modo firma
  useEffect(() => {
    if (mode !== 'sign') return
    requestAnimationFrame(() => {
      const canvas = canvasRef.current
      if (!canvas) return
      canvas.width = canvas.offsetWidth || 400
      canvas.height = 160
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.strokeStyle = '#1a1a1a'
        ctx.lineWidth = 2.5
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
      }
      setSigHasSignature(false)
    })
  }, [mode])

  function setField(sectionId: string, key: string, value: unknown) {
    setSections((s) => ({ ...s, [sectionId]: { ...s[sectionId], [key]: value } }))
  }

  async function persist(): Promise<string | null> {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return null
    const discipline_sections = { ...sections, ...(template.vitals.length ? { vitals } : {}) }
    const res = await apiFetch(`/patients/${patientId}/clinical-history`, {
      method: 'PUT',
      token: session.access_token,
      body: JSON.stringify({ summary, discipline_sections }),
    })
    setRiskLevel(res.data?.risk_level ?? null)
    return session.access_token
  }

  async function handleSave() {
    setSaving(true)
    try {
      if (await persist()) {
        setSaved(true)
        setTimeout(() => setSaved(false), 1800)
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveAndSign() {
    setSaving(true)
    try {
      const token = await persist()
      if (!token) return
      const sigsRes = await apiFetch(`/patients/${patientId}/clinical-history/signatures`, { token })
      setSignatures(sigsRes.data ?? [])
      setSigHasSignature(false)
      setMode('sign')
    } finally {
      setSaving(false)
    }
  }

  async function handleConfirmSignature() {
    if (!sigHasSignature || !canvasRef.current) return
    setSavingSig(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const snapshot: ClinicalHistorySnapshot = { discipline, summary, risk_level: riskLevel, sections, vitals }
      await apiFetch(`/patients/${patientId}/clinical-history/signatures`, {
        method: 'POST',
        token: session.access_token,
        body: JSON.stringify({
          history_snapshot: snapshot,
          signature_data: canvasRef.current.toDataURL('image/png'),
        }),
      })
      const sigsRes = await apiFetch(`/patients/${patientId}/clinical-history/signatures`, { token: session.access_token })
      setSignatures(sigsRes.data ?? [])
      setSigSaved(true)
      setTimeout(() => {
        setSigSaved(false)
        setMode('form')
        setSigHasSignature(false)
      }, 1800)
    } finally {
      setSavingSig(false)
    }
  }

  async function openSignatureDetail(sigId: string) {
    setSigSelected(null)
    setSigLoading(true)
    setMode('sig-detail')
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    try {
      const res = await apiFetch(`/patients/${patientId}/clinical-history/signatures/${sigId}`, { token: session.access_token })
      setSigSelected(res.data)
    } finally {
      setSigLoading(false)
    }
  }

  // ── Canvas handlers ──
  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.setPointerCapture(e.pointerId)
    const rect = canvas.getBoundingClientRect()
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.beginPath()
    ctx.moveTo((e.clientX - rect.left) * (canvas.width / rect.width), (e.clientY - rect.top) * (canvas.height / rect.height))
    setIsDrawing(true)
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!isDrawing) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const rect = canvas.getBoundingClientRect()
    ctx.lineTo((e.clientX - rect.left) * (canvas.width / rect.width), (e.clientY - rect.top) * (canvas.height / rect.height))
    ctx.stroke()
    setSigHasSignature(true)
  }

  function onPointerUp() {
    setIsDrawing(false)
  }

  function clearSignature() {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height)
    setSigHasSignature(false)
  }

  async function handleExportPDF() {
    if (!patient) return
    setExportingPDF(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      let encounters: ClinicalEncounter[] = []
      if (encountersEnabled) {
        const r = await apiFetch(`/patients/${patientId}/encounters`, { token: session.access_token })
        encounters = r.data ?? []
      }
      const { pdf } = await import('@react-pdf/renderer')
      const { GenericClinicalHistoryPDF } = await import('@/components/GenericClinicalHistoryPDF')
      const { createElement } = await import('react')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const element: any = createElement(GenericClinicalHistoryPDF, {
        patient, discipline, sections, summary, riskLevel,
        vitals,
        encounters,
        generatedAt: new Date().toISOString(),
      })
      const blob = await pdf(element).toBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `historia-clinica-${patient.first_name}-${patient.last_name}.pdf`.toLowerCase().replace(/\s+/g, '-')
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExportingPDF(false)
    }
  }

  if (!patient || !loaded) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-[#00C4BC] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const patientName = `${patient.first_name} ${patient.last_name}`
  const title = mode === 'form' ? 'Historia clínica' : mode === 'sign' ? 'Firma del paciente' : mode === 'signatures' ? 'Firmas anteriores' : 'Detalle de firma'

  return (
    <div className="min-h-screen bg-app">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-surface border-b border-app px-4 md:px-8 py-4 flex items-center gap-3">
        <button
          onClick={() => {
            if (mode === 'sig-detail') { setMode('signatures'); setSigSelected(null); return }
            if (mode !== 'form') { setMode('form'); setSigSelected(null); return }
            router.push(`/patients/${patientId}`)
          }}
          className="flex items-center gap-2 text-app2 hover:text-app transition-colors text-sm font-medium"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-base font-bold text-app leading-tight">{title}</h1>
            {mode === 'form' && riskLevel === 'high' && (
              <span className="text-xs font-bold text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-lg">Alto riesgo</span>
            )}
            {mode === 'form' && riskLevel === 'medium' && (
              <span className="text-xs font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-lg">Riesgo medio</span>
            )}
          </div>
          <p className="text-xs text-app3">{patientName} · {DISCIPLINE_LABELS[discipline]}</p>
        </div>
        {mode === 'form' && (
          <div className="flex items-center gap-2 shrink-0">
            {signatures.length > 0 && (
              <button
                onClick={() => setMode('signatures')}
                className="text-xs text-app3 hover:text-app border border-app rounded-lg px-2.5 py-1.5 transition-colors"
              >
                {signatures.length} firma{signatures.length !== 1 ? 's' : ''}
              </button>
            )}
            <button
              onClick={handleExportPDF}
              disabled={exportingPDF}
              title="Exportar en PDF"
              className="flex items-center gap-1.5 text-xs text-app3 hover:text-app border border-app rounded-lg px-2.5 py-1.5 transition-colors disabled:opacity-40"
            >
              <FileDown size={13} />
              {exportingPDF ? 'Generando...' : 'PDF'}
            </button>
          </div>
        )}
      </div>

      {/* Tabs (solo si la disciplina tiene evolución longitudinal) */}
      {mode === 'form' && encountersEnabled && template.encounters.enabled && (
        <div className="max-w-3xl mx-auto px-4 md:px-8 pt-4 flex gap-2">
          <button
            onClick={() => setTab('anamnesis')}
            className={`text-sm font-semibold px-4 py-2 rounded-lg transition-colors cursor-pointer ${tab === 'anamnesis' ? 'bg-[#00C4BC] text-white' : 'bg-surface2 text-app3 hover:text-app'}`}
          >
            Anamnesis
          </button>
          <button
            onClick={() => setTab('encounters')}
            className={`text-sm font-semibold px-4 py-2 rounded-lg transition-colors cursor-pointer ${tab === 'encounters' ? 'bg-[#00C4BC] text-white' : 'bg-surface2 text-app3 hover:text-app'}`}
          >
            {template.encounters.label}
          </button>
        </div>
      )}

      {/* Evolución */}
      {mode === 'form' && encountersEnabled && tab === 'encounters' && (
        <EncountersSection
          discipline={discipline}
          patientId={patientId}
          fum={(sections['gineco_obstetricos_obs']?.fum as string) ?? null}
          initialEncounterId={initialEncounterId}
        />
      )}

      {/* Content — anamnesis */}
      {mode === 'form' && (
        <div className={`max-w-3xl mx-auto px-4 md:px-8 py-6 space-y-6 ${encountersEnabled && tab !== 'anamnesis' ? 'hidden' : ''}`}>
          {discipline === 'obstetrics' && (sections['gineco_obstetricos_obs']?.fum as string) && (
            <section className="bg-[#E6F8F1] dark:bg-[#00C4BC]/10 border border-[#00C4BC]/30 rounded-2xl p-4 flex flex-wrap gap-x-8 gap-y-2 text-sm">
              <div><span className="text-app3">EG actual:</span> <b className="text-app">{formatEg(computeEg(sections['gineco_obstetricos_obs']?.fum as string))}</b></div>
              <div><span className="text-app3">FPP:</span> <b className="text-app">{formatDateAR(computeFpp(sections['gineco_obstetricos_obs']?.fum as string))}</b></div>
            </section>
          )}
          {template.vitals.length > 0 && (
            <VitalsInput fields={template.vitals} value={vitals} onChange={setVitals} />
          )}

          {sectionDefs.map((section) => (
            <SectionCard
              key={section.id}
              section={section}
              values={sections[section.id] ?? {}}
              onField={(key, v) => setField(section.id, key, v)}
            />
          ))}

          {/* Resumen clínico */}
          <section className="bg-surface border border-app rounded-2xl p-5">
            <div className="text-xs font-bold uppercase tracking-wider text-app3 mb-3">Resumen clínico</div>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={4}
              maxLength={2000}
              placeholder="Observaciones generales, notas relevantes..."
              className={`${inputCls} rounded-xl resize-none`}
            />
          </section>

          <div className="flex gap-3 pb-8">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 bg-surface2 hover:bg-surface3 text-app font-semibold py-3 rounded-xl transition-all disabled:opacity-60 cursor-pointer"
            >
              {saved ? '✓ Guardado' : saving ? 'Guardando...' : 'Guardar'}
            </button>
            <button
              onClick={handleSaveAndSign}
              disabled={saving}
              className="flex-[2] bg-[#00C4BC] hover:bg-[#00aaa3] active:scale-95 text-white font-bold py-3 rounded-xl transition-all disabled:opacity-60 shadow-sm shadow-[#00C4BC]/20 cursor-pointer"
            >
              {saving ? 'Guardando...' : 'Guardar y firmar'}
            </button>
          </div>
        </div>
      )}

      {/* ════ SIGN ════ */}
      {mode === 'sign' && (
        <div className="max-w-3xl mx-auto px-4 md:px-8 py-6 space-y-5 pb-8">
          <div className="bg-surface2 border-l-4 border-[#00C4BC] rounded-r-xl px-4 py-3 text-sm text-app leading-relaxed">
            El paciente confirma con su firma que los datos registrados son correctos y que fue informado sobre su estado de salud por el profesional.
          </div>

          <div className="bg-surface border border-app rounded-2xl p-5">
            <ClinicalHistoryReadout snap={{ discipline, summary, sections, vitals }} />
          </div>

          {/* Canvas */}
          <div className="bg-surface border border-app rounded-2xl p-5">
            <div className="text-xs font-bold uppercase tracking-wider text-app3 mb-3">Firma del paciente</div>
            <div className="relative bg-surface2 border-2 border-dashed border-app rounded-xl overflow-hidden">
              <canvas
                ref={canvasRef}
                className="w-full block"
                style={{ height: 160, touchAction: 'none', cursor: 'crosshair' }}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerLeave={onPointerUp}
              />
              {!sigHasSignature && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <span className="text-app3 text-sm">Firmar aquí</span>
                </div>
              )}
            </div>
            {sigHasSignature && (
              <button onClick={clearSignature} className="mt-2 text-xs text-app3 hover:text-app underline">
                Borrar y volver a firmar
              </button>
            )}
          </div>

          <div className="flex gap-3 pb-8">
            <button onClick={() => setMode('form')} disabled={savingSig}
              className="flex-1 bg-surface2 hover:bg-surface3 text-app font-semibold py-3 rounded-xl transition-colors disabled:opacity-60">
              Volver
            </button>
            <button onClick={handleConfirmSignature}
              disabled={!sigHasSignature || savingSig}
              className="flex-[2] bg-[#00C4BC] hover:bg-[#00aaa3] active:scale-95 text-white font-bold py-3 rounded-xl transition-all disabled:opacity-60 shadow-sm shadow-[#00C4BC]/20">
              {sigSaved ? '✓ Historia firmada' : savingSig ? 'Guardando...' : 'Confirmar firma'}
            </button>
          </div>
        </div>
      )}

      {/* ════ SIGNATURES LIST ════ */}
      {mode === 'signatures' && (
        <div className="max-w-3xl mx-auto px-4 md:px-8 py-6 space-y-3 pb-8">
          {signatures.length === 0 ? (
            <div className="text-center py-20 text-app3 text-sm">No hay firmas anteriores registradas</div>
          ) : (
            signatures.map((sig) => (
              <button key={sig.id} onClick={() => openSignatureDetail(sig.id)}
                className="w-full text-left bg-surface border border-app hover:bg-surface2 rounded-2xl px-5 py-4 transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-app">Historia firmada</div>
                    <div className="text-xs text-app3 mt-0.5">
                      {new Date(sig.signed_at).toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })}{' — '}
                      {new Date(sig.signed_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-app3"><polyline points="9 18 15 12 9 6"/></svg>
                </div>
              </button>
            ))
          )}
          <div className="flex gap-3 pt-2">
            <button onClick={() => setMode('form')}
              className="flex-1 bg-surface2 hover:bg-surface3 text-app font-semibold py-3 rounded-xl transition-colors">
              Volver a la historia
            </button>
            <button onClick={handleSaveAndSign} disabled={saving}
              className="flex-1 bg-[#00C4BC] hover:bg-[#00aaa3] active:scale-95 text-white font-bold py-3 rounded-xl transition-all disabled:opacity-60 shadow-sm shadow-[#00C4BC]/20">
              Nueva firma
            </button>
          </div>
        </div>
      )}

      {/* ════ SIGNATURE DETAIL ════ */}
      {mode === 'sig-detail' && (
        <div className="max-w-3xl mx-auto px-4 md:px-8 py-6 space-y-6 pb-8">
          {sigLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-2 border-[#00C4BC] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : sigSelected ? (
            <>
              <div className="bg-surface border border-app rounded-2xl p-5">
                <div className="text-xs font-bold uppercase tracking-wider text-app3 mb-3">Firma del paciente</div>
                <div className="bg-white rounded-xl p-4 flex items-center justify-center border border-app" style={{ minHeight: 140 }}>
                  <img
                    src={sigSelected.signature_data}
                    alt="Firma del paciente"
                    className="max-h-28 object-contain"
                    style={{ imageRendering: 'pixelated' }}
                  />
                </div>
                <div className="text-xs text-app3 mt-3">
                  Firmado el{' '}
                  {new Date(sigSelected.signed_at).toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })}
                  {' a las '}
                  {new Date(sigSelected.signed_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>

              {sigSelected.history_snapshot && (
                <div className="bg-surface border border-app rounded-2xl p-5">
                  <div className="text-xs font-bold uppercase tracking-wider text-app3 mb-4">Contenido firmado</div>
                  <ClinicalHistoryReadout snap={sigSelected.history_snapshot} />
                </div>
              )}

              <div className="pb-8">
                <button onClick={() => { setMode('signatures'); setSigSelected(null) }}
                  className="w-full bg-surface2 hover:bg-surface3 text-app font-semibold py-3 rounded-xl transition-colors">
                  Ver todas las firmas
                </button>
              </div>
            </>
          ) : null}
        </div>
      )}
    </div>
  )
}
