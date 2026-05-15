'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { apiFetch } from '@/lib/api'
import { ArrowLeft, FileDown } from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────

const EMPTY_CLINICAL_HISTORY = {
  alerts: {
    aspirin: false,
    anticoagulants: false,
    pregnancy: false,
    cardiac: false,
    hypertension: false,
    seizures: false,
    infectious_disease: { active: false, detail: '' },
    diabetes: { active: false, controlled: false },
  },
  medical_history: {
    renal: false,
    hepatic: false,
    respiratory: false,
    neurological: false,
    transfusions: false,
    surgeries: '',
    sexually_transmitted: false,
    current_disease: { active: false, detail: '' },
    current_treatment: { active: false, detail: '' },
  },
  family_history: {
    cardiac: false,
    diabetes: false,
    other: '',
  },
  habits: {
    smoker: false,
    alcohol: false,
    oral_hygiene: 'buena' as 'mala' | 'regular' | 'buena',
  },
  summary: '',
}

type Mode = 'form' | 'sign' | 'signatures' | 'sig-detail'

// ── Main component ─────────────────────────────────────────────

export default function ClinicalHistoryPage() {
  const params = useParams()
  const router = useRouter()
  const patientId = params.id as string
  const supabase = createClient()

  // Patient
  const [patient, setPatient] = useState<any>(null)
  const [professionalName, setProfessionalName] = useState('')

  // History
  const [clinicalHistory, setClinicalHistory] = useState<any>(null)
  const [form, setForm] = useState<any>(EMPTY_CLINICAL_HISTORY)
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)

  // Signatures
  const [signatures, setSignatures] = useState<any[]>([])
  const [mode, setMode] = useState<Mode>('form')
  const [sigSelected, setSigSelected] = useState<any>(null)
  const [sigLoading, setSigLoading] = useState(false)
  const [sigHasSignature, setSigHasSignature] = useState(false)
  const [savingSig, setSavingSig] = useState(false)
  const [sigSaved, setSigSaved] = useState(false)
  const [isDrawing, setIsDrawing] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // PDF
  const [exportingPDF, setExportingPDF] = useState(false)

  // ── Load ───────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/'); return }
      const token = session.access_token

      const [patientRes, historyRes, sigsRes, meRes] = await Promise.all([
        apiFetch(`/patients/${patientId}`, { token }),
        apiFetch(`/patients/${patientId}/clinical-history`, { token }),
        apiFetch(`/patients/${patientId}/clinical-history/signatures`, { token }),
        apiFetch('/auth/me', { token }),
      ])

      setPatient(patientRes.data)
      const existing = historyRes.data ?? null
      setClinicalHistory(existing)
      setForm(existing ?? EMPTY_CLINICAL_HISTORY)
      setSignatures(sigsRes.data ?? [])
      if (meRes.data) setProfessionalName(`${meRes.data.first_name} ${meRes.data.last_name}`)
      setLoaded(true)
    }
    load()
  }, [patientId])

  // Init canvas when entering sign mode
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

  // ── Form helpers ───────────────────────────────────────────

  function setCH(section: string, key: string, value: unknown) {
    setForm((f: any) => ({ ...f, [section]: { ...f[section], [key]: value } }))
  }

  function setCHNested(section: string, key: string, subkey: string, value: unknown) {
    setForm((f: any) => ({
      ...f,
      [section]: { ...f[section], [key]: { ...f[section][key], [subkey]: value } },
    }))
  }

  // ── Actions ────────────────────────────────────────────────

  async function handleSave() {
    setSaving(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    try {
      const res = await apiFetch(`/patients/${patientId}/clinical-history`, {
        method: 'PUT',
        token: session.access_token,
        body: JSON.stringify(form),
      })
      setClinicalHistory(res.data)
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveAndSign() {
    setSaving(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    try {
      const res = await apiFetch(`/patients/${patientId}/clinical-history`, {
        method: 'PUT',
        token: session.access_token,
        body: JSON.stringify(form),
      })
      setClinicalHistory(res.data)
      const sigsRes = await apiFetch(`/patients/${patientId}/clinical-history/signatures`, { token: session.access_token })
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
      const signatureData = canvasRef.current.toDataURL('image/png')
      await apiFetch(`/patients/${patientId}/clinical-history/signatures`, {
        method: 'POST',
        token: session.access_token,
        body: JSON.stringify({
          history_snapshot: clinicalHistory,
          signature_data: signatureData,
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

  async function handleExportPDF() {
    if (!patient) return
    setExportingPDF(true)
    try {
      const { pdf } = await import('@react-pdf/renderer')
      const { ClinicalHistoryPDF } = await import('@/components/ClinicalHistoryPDF')
      const { createElement } = await import('react')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const blob = await pdf(
        createElement(ClinicalHistoryPDF, {
          patient,
          history: clinicalHistory,
          signatures,
          professionalName: professionalName || undefined,
          generatedAt: new Date().toISOString(),
        }) as any
      ).toBlob()
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

  // ── Canvas handlers ────────────────────────────────────────

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.setPointerCapture(e.pointerId)
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.beginPath()
    ctx.moveTo((e.clientX - rect.left) * scaleX, (e.clientY - rect.top) * scaleY)
    setIsDrawing(true)
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!isDrawing) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    ctx.lineTo((e.clientX - rect.left) * scaleX, (e.clientY - rect.top) * scaleY)
    ctx.stroke()
    setSigHasSignature(true)
  }

  function onPointerUp() {
    setIsDrawing(false)
  }

  function clearSignature() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setSigHasSignature(false)
  }

  // ── Toggle ─────────────────────────────────────────────────

  function Toggle({ value, onChange, color = '#00C4BC' }: { value: boolean; onChange: () => void; color?: string }) {
    return (
      <div
        onClick={onChange}
        className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer shrink-0`}
        style={{ backgroundColor: value ? color : undefined }}
        data-active={value}
      >
        <div
          className="absolute inset-0 rounded-full transition-colors"
          style={{ backgroundColor: value ? color : undefined }}
        />
        <div
          className={`absolute inset-0 rounded-full border border-app2 bg-surface3 transition-opacity ${value ? 'opacity-0' : 'opacity-100'}`}
        />
        <div
          className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white shadow transition-all ${value ? 'left-[22px]' : 'left-[2px]'}`}
        />
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────

  if (!patient || !loaded) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-[#00C4BC] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const patientName = `${patient.first_name} ${patient.last_name}`
  const riskLevel = clinicalHistory?.risk_level

  return (
    <div className="min-h-screen bg-app">

      {/* ── Header ── */}
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
            <h1 className="text-base font-bold text-app leading-tight">
              {mode === 'form' ? 'Historia clínica' : mode === 'sign' ? 'Firma del paciente' : mode === 'signatures' ? 'Firmas anteriores' : 'Detalle de firma'}
            </h1>
            {mode === 'form' && riskLevel === 'high' && (
              <span className="text-xs font-bold text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-lg">Alto riesgo</span>
            )}
            {mode === 'form' && riskLevel === 'medium' && (
              <span className="text-xs font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-lg">Riesgo medio</span>
            )}
          </div>
          <p className="text-xs text-app3">{patientName}</p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {mode === 'form' && signatures.length > 0 && (
            <button
              onClick={() => setMode('signatures')}
              className="text-xs text-app3 hover:text-app border border-app rounded-lg px-2.5 py-1.5 transition-colors"
            >
              {signatures.length} firma{signatures.length !== 1 ? 's' : ''}
            </button>
          )}
          {mode === 'form' && (
            <button
              onClick={handleExportPDF}
              disabled={exportingPDF}
              title="Exportar en PDF"
              className="flex items-center gap-1.5 text-xs text-app3 hover:text-app border border-app rounded-lg px-2.5 py-1.5 transition-colors disabled:opacity-40"
            >
              {exportingPDF
                ? <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                : <FileDown size={13} />}
              PDF
            </button>
          )}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="max-w-3xl mx-auto px-4 md:px-8 py-6">

        {/* ════ FORM ════ */}
        {mode === 'form' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">

              {/* Col izq: Alertas clínicas */}
              <section className="bg-surface border border-app rounded-2xl p-5">
                <div className="text-xs font-bold uppercase tracking-wider text-red-500 dark:text-red-400 mb-4">⚠️ Alertas clínicas</div>
                <div className="space-y-2">
                  <div className="text-xs text-app3 font-semibold pb-1">Coagulación</div>
                  {([
                    { key: 'aspirin',        label: 'Toma aspirina' },
                    { key: 'anticoagulants', label: 'Anticoagulantes' },
                  ] as const).map(({ key, label }) => (
                    <label key={key} className="flex items-center justify-between py-1 cursor-pointer select-none">
                      <span className="text-sm text-app">{label}</span>
                      <Toggle value={form.alerts[key]} onChange={() => setCH('alerts', key, !form.alerts[key])} color="#ef4444" />
                    </label>
                  ))}
                  <div className="text-xs text-app3 font-semibold pt-2 pb-1">Otros</div>
                  {([
                    { key: 'pregnancy',    label: 'Embarazo' },
                    { key: 'cardiac',      label: 'Cardíaco' },
                    { key: 'hypertension', label: 'Presión alta' },
                    { key: 'seizures',     label: 'Convulsiones / Epilepsia' },
                  ] as const).map(({ key, label }) => (
                    <label key={key} className="flex items-center justify-between py-1 cursor-pointer select-none">
                      <span className="text-sm text-app">{label}</span>
                      <Toggle value={form.alerts[key]} onChange={() => setCH('alerts', key, !form.alerts[key])} color="#ef4444" />
                    </label>
                  ))}
                  {/* Diabetes */}
                  <div>
                    <label className="flex items-center justify-between py-1 cursor-pointer select-none">
                      <span className="text-sm text-app">Diabetes</span>
                      <Toggle value={form.alerts.diabetes.active} onChange={() => setCHNested('alerts', 'diabetes', 'active', !form.alerts.diabetes.active)} color="#ef4444" />
                    </label>
                    {form.alerts.diabetes.active && (
                      <div className="ml-4 pl-3 border-l-2 border-surface3 mt-1">
                        <label className="flex items-center justify-between py-1 cursor-pointer select-none">
                          <span className="text-sm text-app2">Controlada</span>
                          <Toggle value={form.alerts.diabetes.controlled} onChange={() => setCHNested('alerts', 'diabetes', 'controlled', !form.alerts.diabetes.controlled)} />
                        </label>
                      </div>
                    )}
                  </div>
                  {/* Enf. infectocontagiosa */}
                  <div>
                    <label className="flex items-center justify-between py-1 cursor-pointer select-none">
                      <span className="text-sm text-app">Enf. infectocontagiosa</span>
                      <Toggle value={form.alerts.infectious_disease.active} onChange={() => setCHNested('alerts', 'infectious_disease', 'active', !form.alerts.infectious_disease.active)} color="#ef4444" />
                    </label>
                    {form.alerts.infectious_disease.active && (
                      <input
                        value={form.alerts.infectious_disease.detail}
                        onChange={e => setCHNested('alerts', 'infectious_disease', 'detail', e.target.value)}
                        placeholder="Especificar..."
                        className="mt-1.5 w-full bg-surface2 border border-app rounded-lg px-3 py-2 text-sm text-app focus:outline-none focus:border-[#00C4BC]"
                      />
                    )}
                  </div>
                </div>
              </section>

              {/* Col der: Antecedentes personales */}
              <section className="bg-surface border border-app rounded-2xl p-5">
                <div className="text-xs font-bold uppercase tracking-wider text-app3 mb-4">Antecedentes personales</div>
                <div className="space-y-2">
                  {([
                    { key: 'renal',                label: 'Renal' },
                    { key: 'hepatic',              label: 'Hepático' },
                    { key: 'respiratory',          label: 'Respiratorio' },
                    { key: 'neurological',         label: 'Neurológico' },
                    { key: 'transfusions',         label: 'Transfusiones' },
                    { key: 'sexually_transmitted', label: 'Sífilis / Gonorrea' },
                  ] as const).map(({ key, label }) => (
                    <label key={key} className="flex items-center justify-between py-1 cursor-pointer select-none">
                      <span className="text-sm text-app">{label}</span>
                      <Toggle value={form.medical_history[key]} onChange={() => setCH('medical_history', key, !form.medical_history[key])} />
                    </label>
                  ))}
                  {/* Enfermedad actual */}
                  <div>
                    <label className="flex items-center justify-between py-1 cursor-pointer select-none">
                      <span className="text-sm text-app">Enfermedad actual</span>
                      <Toggle value={form.medical_history.current_disease?.active} onChange={() => setCHNested('medical_history', 'current_disease', 'active', !form.medical_history.current_disease?.active)} />
                    </label>
                    {form.medical_history.current_disease?.active && (
                      <input
                        value={form.medical_history.current_disease.detail}
                        onChange={e => setCHNested('medical_history', 'current_disease', 'detail', e.target.value)}
                        placeholder="¿Cuál?"
                        className="mt-1.5 w-full bg-surface2 border border-app rounded-lg px-3 py-2 text-sm text-app focus:outline-none focus:border-[#00C4BC]"
                      />
                    )}
                  </div>
                  {/* Tratamiento médico actual */}
                  <div>
                    <label className="flex items-center justify-between py-1 cursor-pointer select-none">
                      <span className="text-sm text-app">Tratamiento médico actual</span>
                      <Toggle value={form.medical_history.current_treatment?.active} onChange={() => setCHNested('medical_history', 'current_treatment', 'active', !form.medical_history.current_treatment?.active)} />
                    </label>
                    {form.medical_history.current_treatment?.active && (
                      <input
                        value={form.medical_history.current_treatment.detail}
                        onChange={e => setCHNested('medical_history', 'current_treatment', 'detail', e.target.value)}
                        placeholder="¿Cuál?"
                        className="mt-1.5 w-full bg-surface2 border border-app rounded-lg px-3 py-2 text-sm text-app focus:outline-none focus:border-[#00C4BC]"
                      />
                    )}
                  </div>
                  <div className="pt-1">
                    <label className="block text-xs text-app3 mb-1.5">Cirugías previas</label>
                    <input
                      value={form.medical_history.surgeries}
                      onChange={e => setCH('medical_history', 'surgeries', e.target.value)}
                      placeholder="Describir intervenciones..."
                      className="w-full bg-surface2 border border-app rounded-lg px-3 py-2 text-sm text-app focus:outline-none focus:border-[#00C4BC]"
                    />
                  </div>
                </div>
              </section>

              {/* Col izq: Hábitos */}
              <section className="bg-surface border border-app rounded-2xl p-5">
                <div className="text-xs font-bold uppercase tracking-wider text-app3 mb-4">Hábitos</div>
                <div className="space-y-2">
                  {([
                    { key: 'smoker',  label: 'Fumador/a' },
                    { key: 'alcohol', label: 'Consumo de alcohol' },
                  ] as const).map(({ key, label }) => (
                    <label key={key} className="flex items-center justify-between py-1 cursor-pointer select-none">
                      <span className="text-sm text-app">{label}</span>
                      <Toggle value={form.habits[key]} onChange={() => setCH('habits', key, !form.habits[key])} />
                    </label>
                  ))}
                  <div className="pt-2">
                    <label className="block text-xs text-app3 mb-2">Higiene oral</label>
                    <div className="flex gap-2">
                      {(['mala', 'regular', 'buena'] as const).map(opt => (
                        <button key={opt} type="button"
                          onClick={() => setCH('habits', 'oral_hygiene', opt)}
                          className={`flex-1 py-2 rounded-lg text-xs font-bold border capitalize transition-all active:scale-95 cursor-pointer ${
                            form.habits.oral_hygiene === opt
                              ? opt === 'mala'    ? 'bg-red-500/15 border-red-400 text-red-400'
                              : opt === 'regular' ? 'bg-amber-500/15 border-amber-400 text-amber-400'
                              :                    'bg-[#E6F8F1] dark:bg-[#00C4BC]/15 border-[#00C4BC]/40 text-[#00C4BC]'
                              : 'bg-surface2 border-app text-app3 hover:border-app2'
                          }`}
                        >
                          {opt.charAt(0).toUpperCase() + opt.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </section>

              {/* Col der: Antecedentes familiares */}
              <section className="bg-surface border border-app rounded-2xl p-5">
                <div className="text-xs font-bold uppercase tracking-wider text-app3 mb-4">Antecedentes familiares</div>
                <div className="space-y-2">
                  {([
                    { key: 'cardiac',  label: 'Cardíaco' },
                    { key: 'diabetes', label: 'Diabetes' },
                  ] as const).map(({ key, label }) => (
                    <label key={key} className="flex items-center justify-between py-1 cursor-pointer select-none">
                      <span className="text-sm text-app">{label}</span>
                      <Toggle value={form.family_history[key]} onChange={() => setCH('family_history', key, !form.family_history[key])} />
                    </label>
                  ))}
                  <div className="pt-1">
                    <label className="block text-xs text-app3 mb-1.5">Otros antecedentes</label>
                    <input
                      value={form.family_history.other}
                      onChange={e => setCH('family_history', 'other', e.target.value)}
                      placeholder="Otros antecedentes relevantes..."
                      className="w-full bg-surface2 border border-app rounded-lg px-3 py-2 text-sm text-app focus:outline-none focus:border-[#00C4BC]"
                    />
                  </div>
                </div>
              </section>

            </div>

            {/* Resumen clínico — ancho completo */}
            <section className="bg-surface border border-app rounded-2xl p-5">
              <div className="text-xs font-bold uppercase tracking-wider text-app3 mb-3">Resumen clínico</div>
              <textarea
                value={form.summary ?? ''}
                onChange={e => setForm((f: any) => ({ ...f, summary: e.target.value }))}
                rows={4}
                placeholder="Observaciones generales, notas relevantes para el tratamiento..."
                className="w-full bg-surface2 border border-app rounded-xl px-3 py-2.5 text-app text-sm focus:outline-none focus:border-[#00C4BC] resize-none"
              />
            </section>

            {/* Action buttons */}
            <div className="flex gap-3 pb-8">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 bg-surface2 hover:bg-surface3 text-app font-semibold py-3 rounded-xl transition-all disabled:opacity-60 cursor-pointer"
              >
                {saving ? 'Guardando...' : 'Guardar'}
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
          <div className="space-y-5 pb-8">
            <div className="bg-surface2 border-l-4 border-[#00C4BC] rounded-r-xl px-4 py-3 text-sm text-app leading-relaxed">
              El paciente confirma con su firma que los datos registrados son correctos y que fue informado sobre su estado de salud por el profesional.
            </div>

            {clinicalHistory && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 text-sm bg-surface border border-app rounded-2xl p-5">
                {/* Alertas */}
                <section>
                  <div className="text-xs font-bold uppercase tracking-wider text-red-400 mb-2">Alertas clínicas</div>
                  <div className="space-y-1">
                    {[
                      { key: 'aspirin',        label: 'Toma aspirina' },
                      { key: 'anticoagulants', label: 'Anticoagulantes' },
                      { key: 'pregnancy',      label: 'Embarazo' },
                      { key: 'cardiac',        label: 'Cardíaco' },
                      { key: 'hypertension',   label: 'Presión alta' },
                      { key: 'seizures',       label: 'Convulsiones / Epilepsia' },
                    ].filter(f => (clinicalHistory.alerts as any)[f.key]).map(f => (
                      <div key={f.key} className="flex items-center gap-2 text-app"><span className="text-red-400 text-xs">●</span>{f.label}</div>
                    ))}
                    {clinicalHistory.alerts?.diabetes?.active && (
                      <div className="flex items-center gap-2 text-app"><span className="text-red-400 text-xs">●</span>Diabetes{clinicalHistory.alerts.diabetes.controlled ? ' (controlada)' : ''}</div>
                    )}
                    {clinicalHistory.alerts?.infectious_disease?.active && (
                      <div className="flex items-center gap-2 text-app"><span className="text-red-400 text-xs">●</span>Enf. infectocontagiosa{clinicalHistory.alerts.infectious_disease.detail ? `: ${clinicalHistory.alerts.infectious_disease.detail}` : ''}</div>
                    )}
                    {!['aspirin','anticoagulants','pregnancy','cardiac','hypertension','seizures'].some(k => (clinicalHistory.alerts as any)[k]) && !clinicalHistory.alerts?.diabetes?.active && !clinicalHistory.alerts?.infectious_disease?.active && (
                      <div className="text-app3 text-xs">Sin alertas</div>
                    )}
                  </div>
                </section>

                {/* Antecedentes personales */}
                <section>
                  <div className="text-xs font-bold uppercase tracking-wider text-app3 mb-2">Antecedentes personales</div>
                  <div className="space-y-1">
                    {[
                      { key: 'renal', label: 'Renal' },
                      { key: 'hepatic', label: 'Hepático' },
                      { key: 'respiratory', label: 'Respiratorio' },
                      { key: 'neurological', label: 'Neurológico' },
                      { key: 'transfusions', label: 'Transfusiones' },
                      { key: 'sexually_transmitted', label: 'Sífilis / Gonorrea' },
                    ].filter(f => (clinicalHistory.medical_history as any)[f.key]).map(f => (
                      <div key={f.key} className="flex items-center gap-2 text-app"><span className="text-[#00C4BC] text-xs">●</span>{f.label}</div>
                    ))}
                    {clinicalHistory.medical_history?.current_disease?.active && (
                      <div className="flex items-center gap-2 text-app"><span className="text-[#00C4BC] text-xs">●</span>Enfermedad actual{clinicalHistory.medical_history.current_disease.detail ? `: ${clinicalHistory.medical_history.current_disease.detail}` : ''}</div>
                    )}
                    {clinicalHistory.medical_history?.current_treatment?.active && (
                      <div className="flex items-center gap-2 text-app"><span className="text-[#00C4BC] text-xs">●</span>Medicación actual{clinicalHistory.medical_history.current_treatment.detail ? `: ${clinicalHistory.medical_history.current_treatment.detail}` : ''}</div>
                    )}
                    {clinicalHistory.medical_history?.surgeries && (
                      <div className="flex items-center gap-2 text-app"><span className="text-[#00C4BC] text-xs">●</span>Cirugías: {clinicalHistory.medical_history.surgeries}</div>
                    )}
                    {!['renal','hepatic','respiratory','neurological','transfusions','sexually_transmitted'].some(k => (clinicalHistory.medical_history as any)[k]) && !clinicalHistory.medical_history?.current_disease?.active && !clinicalHistory.medical_history?.current_treatment?.active && !clinicalHistory.medical_history?.surgeries && (
                      <div className="text-app3 text-xs">Sin antecedentes</div>
                    )}
                  </div>
                </section>

                {/* Hábitos */}
                <section>
                  <div className="text-xs font-bold uppercase tracking-wider text-app3 mb-2">Hábitos</div>
                  <div className="space-y-1">
                    {clinicalHistory.habits?.smoker && <div className="flex items-center gap-2 text-app"><span className="text-amber-400 text-xs">●</span>Fumador</div>}
                    {clinicalHistory.habits?.alcohol && <div className="flex items-center gap-2 text-app"><span className="text-amber-400 text-xs">●</span>Consume alcohol</div>}
                    {clinicalHistory.habits?.oral_hygiene && <div className="flex items-center gap-2 text-app"><span className="text-amber-400 text-xs">●</span>Higiene oral: {clinicalHistory.habits.oral_hygiene}</div>}
                    {!clinicalHistory.habits?.smoker && !clinicalHistory.habits?.alcohol && !clinicalHistory.habits?.oral_hygiene && (
                      <div className="text-app3 text-xs">Sin datos</div>
                    )}
                  </div>
                </section>

                {/* Antecedentes familiares */}
                <section>
                  <div className="text-xs font-bold uppercase tracking-wider text-app3 mb-2">Antecedentes familiares</div>
                  <div className="space-y-1">
                    {clinicalHistory.family_history?.cardiac && <div className="flex items-center gap-2 text-app"><span className="text-purple-400 text-xs">●</span>Cardíaco</div>}
                    {clinicalHistory.family_history?.diabetes && <div className="flex items-center gap-2 text-app"><span className="text-purple-400 text-xs">●</span>Diabetes</div>}
                    {clinicalHistory.family_history?.other && <div className="flex items-center gap-2 text-app"><span className="text-purple-400 text-xs">●</span>{clinicalHistory.family_history.other}</div>}
                    {!clinicalHistory.family_history?.cardiac && !clinicalHistory.family_history?.diabetes && !clinicalHistory.family_history?.other && (
                      <div className="text-app3 text-xs">Sin antecedentes familiares</div>
                    )}
                  </div>
                </section>

                {clinicalHistory.summary && (
                  <section className="md:col-span-2">
                    <div className="text-xs font-bold uppercase tracking-wider text-app3 mb-2">Resumen clínico</div>
                    <p className="text-app">{clinicalHistory.summary}</p>
                  </section>
                )}
              </div>
            )}

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
          <div className="space-y-3 pb-8">
            {signatures.length === 0 ? (
              <div className="text-center py-20 text-app3 text-sm">No hay firmas anteriores registradas</div>
            ) : (
              signatures.map((sig: any) => (
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
          <div className="space-y-6 pb-8">
            {sigLoading ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-8 h-8 border-2 border-[#00C4BC] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : sigSelected ? (
              <>
                {/* Firma imagen */}
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

                {/* Snapshot */}
                {sigSelected.history_snapshot && (
                  <div className="bg-surface border border-app rounded-2xl p-5">
                    <div className="text-xs font-bold uppercase tracking-wider text-app3 mb-4">Contenido firmado</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 text-sm">

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
                          ].filter(f => sigSelected.history_snapshot.alerts?.[f.key]).map(f => (
                            <div key={f.key} className="flex items-center gap-2 text-app"><span className="text-red-400 text-xs">●</span>{f.label}</div>
                          ))}
                          {sigSelected.history_snapshot.alerts?.diabetes?.active && (
                            <div className="flex items-center gap-2 text-app"><span className="text-red-400 text-xs">●</span>Diabetes{sigSelected.history_snapshot.alerts.diabetes.controlled ? ' (controlada)' : ''}</div>
                          )}
                          {sigSelected.history_snapshot.alerts?.infectious_disease?.active && (
                            <div className="flex items-center gap-2 text-app"><span className="text-red-400 text-xs">●</span>Enf. infectocontagiosa{sigSelected.history_snapshot.alerts.infectious_disease.detail ? `: ${sigSelected.history_snapshot.alerts.infectious_disease.detail}` : ''}</div>
                          )}
                          {!['aspirin','anticoagulants','pregnancy','cardiac','hypertension','seizures'].some((k: string) => sigSelected.history_snapshot.alerts?.[k]) && !sigSelected.history_snapshot.alerts?.diabetes?.active && !sigSelected.history_snapshot.alerts?.infectious_disease?.active && (
                            <div className="text-app3 text-xs">Sin alertas</div>
                          )}
                        </div>
                      </section>

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
                          ].filter(f => sigSelected.history_snapshot.medical_history?.[f.key]).map(f => (
                            <div key={f.key} className="flex items-center gap-2 text-app"><span className="text-[#00C4BC] text-xs">●</span>{f.label}</div>
                          ))}
                          {sigSelected.history_snapshot.medical_history?.current_disease?.active && (
                            <div className="flex items-center gap-2 text-app"><span className="text-[#00C4BC] text-xs">●</span>Enfermedad actual{sigSelected.history_snapshot.medical_history.current_disease.detail ? `: ${sigSelected.history_snapshot.medical_history.current_disease.detail}` : ''}</div>
                          )}
                          {sigSelected.history_snapshot.medical_history?.current_treatment?.active && (
                            <div className="flex items-center gap-2 text-app"><span className="text-[#00C4BC] text-xs">●</span>Medicación actual{sigSelected.history_snapshot.medical_history.current_treatment.detail ? `: ${sigSelected.history_snapshot.medical_history.current_treatment.detail}` : ''}</div>
                          )}
                          {sigSelected.history_snapshot.medical_history?.surgeries && (
                            <div className="flex items-center gap-2 text-app"><span className="text-[#00C4BC] text-xs">●</span>Cirugías: {sigSelected.history_snapshot.medical_history.surgeries}</div>
                          )}
                          {!['renal','hepatic','respiratory','neurological','transfusions','sexually_transmitted'].some((k: string) => sigSelected.history_snapshot.medical_history?.[k]) && !sigSelected.history_snapshot.medical_history?.current_disease?.active && !sigSelected.history_snapshot.medical_history?.current_treatment?.active && !sigSelected.history_snapshot.medical_history?.surgeries && (
                            <div className="text-app3 text-xs">Sin antecedentes</div>
                          )}
                        </div>
                      </section>

                      <section>
                        <div className="text-xs font-semibold text-app3 mb-1.5">Hábitos</div>
                        <div className="space-y-1">
                          {sigSelected.history_snapshot.habits?.smoker && <div className="flex items-center gap-2 text-app"><span className="text-amber-400 text-xs">●</span>Fumador</div>}
                          {sigSelected.history_snapshot.habits?.alcohol && <div className="flex items-center gap-2 text-app"><span className="text-amber-400 text-xs">●</span>Consume alcohol</div>}
                          {sigSelected.history_snapshot.habits?.oral_hygiene && <div className="flex items-center gap-2 text-app"><span className="text-amber-400 text-xs">●</span>Higiene oral: {sigSelected.history_snapshot.habits.oral_hygiene}</div>}
                          {!sigSelected.history_snapshot.habits?.smoker && !sigSelected.history_snapshot.habits?.alcohol && !sigSelected.history_snapshot.habits?.oral_hygiene && (
                            <div className="text-app3 text-xs">Sin datos</div>
                          )}
                        </div>
                      </section>

                      <section>
                        <div className="text-xs font-semibold text-app3 mb-1.5">Antecedentes familiares</div>
                        <div className="space-y-1">
                          {sigSelected.history_snapshot.family_history?.cardiac && <div className="flex items-center gap-2 text-app"><span className="text-purple-400 text-xs">●</span>Cardíaco</div>}
                          {sigSelected.history_snapshot.family_history?.diabetes && <div className="flex items-center gap-2 text-app"><span className="text-purple-400 text-xs">●</span>Diabetes</div>}
                          {sigSelected.history_snapshot.family_history?.other && <div className="flex items-center gap-2 text-app"><span className="text-purple-400 text-xs">●</span>{sigSelected.history_snapshot.family_history.other}</div>}
                          {!sigSelected.history_snapshot.family_history?.cardiac && !sigSelected.history_snapshot.family_history?.diabetes && !sigSelected.history_snapshot.family_history?.other && (
                            <div className="text-app3 text-xs">Sin antecedentes familiares</div>
                          )}
                        </div>
                      </section>

                      {sigSelected.history_snapshot.summary && (
                        <section className="md:col-span-2">
                          <div className="text-xs font-semibold text-app3 mb-1.5">Resumen clínico</div>
                          <p className="text-app">{sigSelected.history_snapshot.summary}</p>
                        </section>
                      )}
                    </div>
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
    </div>
  )
}
