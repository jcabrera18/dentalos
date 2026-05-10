'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { apiFetch } from '@/lib/api'
import {
  ArrowLeft, Plus, FileText, ChevronDown, ChevronUp, X,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────

interface ConsentTemplate {
  id: string
  name: string
  content_html: string
}

interface Consent {
  id: string
  status: string
  signed_at: string | null
  created_at: string
  consent_templates: { name: string } | null
}

interface ConsentDetail extends Consent {
  content_html: string
  signature_data: string | null
}

// ── Helpers ───────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    timeZone: 'America/Argentina/Buenos_Aires',
  })
}

// ── Main component ────────────────────────────────────────────

export default function PatientConsentsPage() {
  const params = useParams()
  const router = useRouter()
  const patientId = params.id as string
  const supabase = createClient()

  const [patient, setPatient] = useState<{ first_name: string; last_name: string; document_number?: string | null } | null>(null)
  const [consents, setConsents] = useState<Consent[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Detail view state
  const [detailLoading, setDetailLoading] = useState(false)
  const [detail, setDetail] = useState<ConsentDetail | null>(null)

  // New consent flow
  const [showSelectModal, setShowSelectModal] = useState(false)
  const [templates, setTemplates] = useState<ConsentTemplate[]>([])
  const [templatesLoading, setTemplatesLoading] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<ConsentTemplate | null>(null)
  const [showSignModal, setShowSignModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [professionalName, setProfessionalName] = useState('')

  // Signature canvas
  const signatureCanvasRef = useRef<HTMLCanvasElement>(null)
  const [hasSignature, setHasSignature] = useState(false)
  const isDrawing = useRef(false)

  // ── Load data ───────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/'); return }

      const token = session.access_token

      const [patientRes, consentsRes, meRes] = await Promise.all([
        apiFetch(`/patients/${patientId}`, { token }),
        apiFetch(`/consents?patient_id=${patientId}`, { token }),
        apiFetch('/auth/me', { token }),
      ])

      setPatient(patientRes.data)
      setConsents(consentsRes.data ?? [])
      if (meRes.data) {
        setProfessionalName(`${meRes.data.first_name} ${meRes.data.last_name}`)
      }
      setLoading(false)
    }
    load()
  }, [patientId])

  // Init canvas when sign modal opens
  useEffect(() => {
    if (!showSignModal) return
    requestAnimationFrame(() => {
      const canvas = signatureCanvasRef.current
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
      setHasSignature(false)
    })
  }, [showSignModal])

  // ── Expand / load detail ────────────────────────────────────

  async function handleExpand(consentId: string) {
    const isExpanding = expandedId !== consentId
    setExpandedId(isExpanding ? consentId : null)
    setDetail(null)

    if (!isExpanding) return

    setDetailLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const res = await apiFetch(`/consents/${consentId}`, { token: session.access_token })
      setDetail(res.data)
    } finally {
      setDetailLoading(false)
    }
  }

  // ── Open new consent flow ───────────────────────────────────

  async function openNewConsent() {
    setShowSelectModal(true)
    setTemplatesLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const res = await apiFetch('/consents/templates', { token: session.access_token })
      setTemplates(res.data ?? [])
    } finally {
      setTemplatesLoading(false)
    }
  }

  function selectTemplate(t: ConsentTemplate) {
    setSelectedTemplate(t)
    setShowSelectModal(false)
    setSaved(false)
    setHasSignature(false)
    setShowSignModal(true)
  }

  // ── Signature handlers ──────────────────────────────────────

  function renderConsentHtml(html: string) {
    if (!patient) return html
    return html
      .replace(/\{\{patient_name\}\}/g, `${patient.first_name} ${patient.last_name}`)
      .replace(/\{\{patient_document\}\}/g, patient.document_number ?? '')
      .replace(/\{\{professional_name\}\}/g, professionalName)
  }

  function onSignPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = signatureCanvasRef.current
    if (!canvas) return
    canvas.setPointerCapture(e.pointerId)
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.beginPath()
    ctx.moveTo((e.clientX - rect.left) * scaleX, (e.clientY - rect.top) * scaleY)
    isDrawing.current = true
  }

  function onSignPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!isDrawing.current) return
    const canvas = signatureCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    ctx.lineTo((e.clientX - rect.left) * scaleX, (e.clientY - rect.top) * scaleY)
    ctx.stroke()
    setHasSignature(true)
  }

  function onSignPointerUp() {
    isDrawing.current = false
  }

  function clearSignature() {
    const canvas = signatureCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasSignature(false)
  }

  // ── Save consent ────────────────────────────────────────────

  async function handleSave() {
    if (!selectedTemplate || !hasSignature || !signatureCanvasRef.current) return
    setSaving(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const signatureData = signatureCanvasRef.current.toDataURL('image/png')
      const renderedHtml = renderConsentHtml(selectedTemplate.content_html)
      await apiFetch('/consents', {
        method: 'POST',
        token: session.access_token,
        body: JSON.stringify({
          patient_id: patientId,
          template_id: selectedTemplate.id,
          content_html: renderedHtml,
          signature_data: signatureData,
        }),
      })
      const updated = await apiFetch(`/consents?patient_id=${patientId}`, { token: session.access_token })
      setConsents(updated.data ?? [])
      setSaved(true)
      setTimeout(() => {
        setShowSignModal(false)
        setSelectedTemplate(null)
        setHasSignature(false)
        setSaved(false)
      }, 1800)
    } finally {
      setSaving(false)
    }
  }

  // ── Render ──────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-[#00C4BC] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const patientName = patient ? `${patient.first_name} ${patient.last_name}` : '—'

  return (
    <>
      <div className="min-h-screen bg-app">

        {/* ── Header ── */}
        <div className="sticky top-0 z-20 bg-surface border-b border-app px-4 md:px-8 py-4 flex items-center gap-3">
          <button
            onClick={() => router.push(`/patients/${patientId}`)}
            className="flex items-center gap-2 text-app2 hover:text-app transition-colors text-sm font-medium"
          >
            <ArrowLeft size={18} />
            <span className="hidden sm:inline"></span>
          </button>
          <div className="flex-1">
            <h1 className="text-base font-bold text-app leading-tight">Consentimientos</h1>
            <p className="text-xs text-app3">{patientName}</p>
          </div>
          <button
            onClick={openNewConsent}
            className="flex items-center gap-2 bg-[#00C4BC] hover:bg-[#00aaa3] text-white text-sm font-bold px-4 py-2 rounded-xl transition-all active:scale-95 shadow-sm shadow-[#00C4BC]/20"
          >
            <Plus size={16} />
            Nuevo consentimiento
          </button>
        </div>

        {/* ── Content ── */}
        <div className="max-w-4xl mx-auto px-4 md:px-8 py-6 space-y-4">

          {consents.length === 0 && (
            <div className="text-center py-20">
              <div className="w-14 h-14 rounded-full bg-surface2 flex items-center justify-center mx-auto mb-4">
                <FileText size={26} className="text-app3" />
              </div>
              <p className="font-semibold text-app">Sin consentimientos</p>
              <p className="text-app3 text-sm mt-1">Creá el primero con el botón de arriba.</p>
            </div>
          )}

          {consents.map(c => {
            const expanded = expandedId === c.id
            const templateName = (c.consent_templates as any)?.name ?? 'Consentimiento'
            const dateStr = c.signed_at
              ? formatDate(c.signed_at)
              : formatDate(c.created_at)

            return (
              <div key={c.id} className="bg-surface border border-app rounded-2xl overflow-hidden">

                {/* Row header */}
                <div
                  className="px-5 py-4 flex items-center gap-3 cursor-pointer hover:bg-surface2 transition-colors"
                  onClick={() => handleExpand(c.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-[#00C4BC] bg-[#E6F8F1] dark:bg-[#00C4BC]/15 px-2 py-0.5 rounded-md">
                        {templateName}
                      </span>
                      <span className="text-xs text-app3">{dateStr}</span>
                    </div>
                    <p className="text-sm text-app2 mt-0.5 truncate">
                      {c.status === 'signed' ? 'Firmado por el paciente' : c.status}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                      c.status === 'signed'
                        ? 'text-[#00C4BC] bg-[#E6F8F1] dark:bg-[#00C4BC]/15'
                        : 'text-app3 bg-surface2'
                    }`}>
                      {c.status === 'signed' ? '✓ Firmado' : c.status}
                    </span>
                    {expanded
                      ? <ChevronUp size={16} className="text-app3" />
                      : <ChevronDown size={16} className="text-app3" />}
                  </div>
                </div>

                {/* Expanded detail */}
                {expanded && (
                  <div className="border-t border-app px-5 py-4 space-y-4">
                    {detailLoading && !detail ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="w-6 h-6 border-2 border-[#00C4BC] border-t-transparent rounded-full animate-spin" />
                      </div>
                    ) : detail ? (
                      <>
                        {/* Document preview */}
                        <div className="bg-white border border-app rounded-xl overflow-hidden">
                          <div
                            className="px-6 py-5 text-gray-800 text-sm leading-relaxed max-h-72 overflow-y-auto [&_h2]:text-lg [&_h2]:font-bold [&_h2]:mb-3 [&_h2]:mt-0 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:mb-2 [&_h3]:mt-4 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-2 [&_li]:mb-1 [&_p]:mb-3 [&_strong]:font-semibold"
                            dangerouslySetInnerHTML={{ __html: detail.content_html }}
                          />
                        </div>

                        {/* Signature */}
                        <div>
                          <p className="text-xs font-semibold text-app2 uppercase tracking-wider mb-2">Firma del paciente</p>
                          {detail.signature_data ? (
                            <div className="border border-app rounded-xl overflow-hidden bg-white" style={{ maxWidth: 320 }}>
                              <img
                                src={detail.signature_data}
                                alt="Firma del paciente"
                                className="w-full object-contain"
                                style={{ maxHeight: 120 }}
                              />
                            </div>
                          ) : (
                            <p className="text-sm text-app3 italic">Sin firma registrada</p>
                          )}
                          {detail.signed_at && (
                            <p className="text-xs text-app3 mt-2">
                              Firmado el {new Date(detail.signed_at).toLocaleDateString('es-AR', {
                                day: 'numeric', month: 'long', year: 'numeric',
                                hour: '2-digit', minute: '2-digit',
                              })}
                            </p>
                          )}
                        </div>
                      </>
                    ) : null}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ════════════════════════════════════════
          SELECT TEMPLATE MODAL
      ════════════════════════════════════════ */}
      {showSelectModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center overflow-y-auto py-6 px-4">
          <div className="bg-surface border border-app rounded-2xl w-full max-w-lg shadow-2xl">

            <div className="flex items-center justify-between px-6 py-4 border-b border-app">
              <h2 className="font-bold text-app text-lg">Nuevo consentimiento</h2>
              <button
                onClick={() => setShowSelectModal(false)}
                className="w-8 h-8 rounded-full hover:bg-surface2 flex items-center justify-center text-app3 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="px-6 py-5">
              {templatesLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => <div key={i} className="bg-surface2 rounded-xl h-14 animate-pulse" />)}
                </div>
              ) : templates.length === 0 ? (
                <p className="text-sm text-app3 text-center py-8">No hay plantillas disponibles.</p>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-app2 mb-1">Seleccioná el tipo de consentimiento:</p>
                  {templates.map(t => (
                    <button
                      key={t.id}
                      onClick={() => selectTemplate(t)}
                      className="w-full text-left bg-surface2 hover:bg-[#E6F8F1] dark:hover:bg-[#00C4BC]/10 hover:border-[#00C4BC] border border-app rounded-xl px-4 py-4 transition-all active:scale-[0.99] group"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-semibold text-app group-hover:text-[#00C4BC] transition-colors text-sm">{t.name}</p>
                        <span className="text-app3 group-hover:text-[#00C4BC] transition-colors">›</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════
          SIGN MODAL
      ════════════════════════════════════════ */}
      {showSignModal && selectedTemplate && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center overflow-y-auto py-6 px-4">
          <div className="bg-surface border border-app rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col">

            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-app shrink-0">
              <div>
                <h2 className="font-bold text-app text-lg">{selectedTemplate.name}</h2>
                <p className="text-xs text-app3 mt-0.5">{patientName}</p>
              </div>
              <button
                onClick={() => { setShowSignModal(false); setSelectedTemplate(null) }}
                className="w-8 h-8 rounded-full hover:bg-surface2 flex items-center justify-center text-app3 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Document */}
            <div className="bg-white max-h-96 overflow-y-auto">
              <div
                className="px-6 py-6 text-gray-800 text-sm leading-relaxed [&_h2]:text-lg [&_h2]:font-bold [&_h2]:mb-3 [&_h2]:mt-0 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:mb-2 [&_h3]:mt-4 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-2 [&_li]:mb-1 [&_p]:mb-3 [&_strong]:font-semibold"
                dangerouslySetInnerHTML={{ __html: renderConsentHtml(selectedTemplate.content_html) }}
              />
            </div>

            {/* Signature area */}
            <div className="px-6 py-5 border-t border-app space-y-4">
              {saved ? (
                <div className="flex flex-col items-center justify-center py-6 gap-3">
                  <div className="w-14 h-14 rounded-full bg-[#E6F8F1] flex items-center justify-center">
                    <svg className="w-7 h-7 text-[#00C4BC]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="font-bold text-app text-base">Consentimiento guardado</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-app2 uppercase tracking-wider">Firma del paciente</p>
                    <button onClick={clearSignature} className="text-xs text-app3 hover:text-app transition-colors">
                      Limpiar
                    </button>
                  </div>
                  <div className="relative rounded-xl border-2 border-dashed border-app overflow-hidden bg-white">
                    {!hasSignature && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
                        <p className="text-gray-300 text-sm">Firme aquí</p>
                      </div>
                    )}
                    <canvas
                      ref={signatureCanvasRef}
                      className="w-full block"
                      style={{ height: 160, touchAction: 'none' }}
                      onPointerDown={onSignPointerDown}
                      onPointerMove={onSignPointerMove}
                      onPointerUp={onSignPointerUp}
                      onPointerLeave={onSignPointerUp}
                    />
                  </div>
                  <div className="flex gap-3 justify-end">
                    <button
                      onClick={() => { setShowSignModal(false); setSelectedTemplate(null) }}
                      className="px-5 py-2.5 rounded-xl border border-app text-app2 text-sm font-semibold hover:bg-surface2 transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={!hasSignature || saving}
                      className="px-6 py-2.5 rounded-xl bg-[#00C4BC] hover:bg-[#00aaa3] disabled:opacity-40 text-white text-sm font-bold transition-all active:scale-95 shadow-sm shadow-[#00C4BC]/20"
                    >
                      {saving ? 'Guardando...' : 'Firmar y guardar'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
