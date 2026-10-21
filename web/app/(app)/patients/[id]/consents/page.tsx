'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { apiFetch } from '@/lib/api'
import {
  ArrowLeft, Plus, FileText, ChevronDown, ChevronUp, X,
  Printer, Share2, Download, Copy, Check,
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

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'America/Argentina/Buenos_Aires',
  })
}

// Reglas de formato del contenido del consentimiento (HTML de plantilla).
// Compartidas entre la impresión y la imagen para WhatsApp.
const CONSENT_CONTENT_CSS = `
  .consent-body h2 { font-size:18px; font-weight:700; margin:0 0 12px; color:#111; }
  .consent-body h3 { font-size:15px; font-weight:600; margin:16px 0 8px; color:#111; }
  .consent-body ul { list-style:disc; padding-left:20px; margin:8px 0; }
  .consent-body li { margin-bottom:4px; }
  .consent-body p { margin:0 0 12px; }
  .consent-body strong { font-weight:600; }
`

// ── Print document (new window) ───────────────────────────────

function generatePrintHtml(
  detail: ConsentDetail,
  patientName: string,
  templateName: string,
): string {
  const signedLine = detail.signed_at
    ? `Firmado el ${formatDateTime(detail.signed_at)}`
    : ''

  const signatureHtml = detail.signature_data
    ? `<img src="${detail.signature_data}" alt="Firma del paciente" style="max-width:320px;max-height:140px;object-fit:contain" />`
    : '<p style="color:#9ca3af;font-style:italic;margin:0">Sin firma registrada</p>'

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Consentimiento · ${patientName}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; color:#111; background:#fff; font-size:14px; line-height:1.6; }
    ${CONSENT_CONTENT_CSS}
    @media print { body { -webkit-print-color-adjust:exact; print-color-adjust:exact; } }
  </style>
</head>
<body>
<div style="max-width:760px;margin:0 auto;padding:48px 40px">

  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px;padding-bottom:24px;border-bottom:2px solid #f0f0f0">
    <div>
      <h1 style="font-size:26px;font-weight:900;color:#111;letter-spacing:-0.5px">Vital<span style="color:#00C4BC">OS</span></h1>
    </div>
    <div style="text-align:right">
      <p style="font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;margin-bottom:4px">Consentimiento</p>
      <p style="font-size:16px;font-weight:700;color:#111">${templateName}</p>
    </div>
  </div>

  <div style="margin-bottom:28px">
    <p style="font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;margin-bottom:6px">Paciente</p>
    <p style="font-size:16px;font-weight:700;color:#111">${patientName}</p>
  </div>

  <div class="consent-body" style="margin-bottom:36px;color:#1f2937">${detail.content_html}</div>

  <div style="margin-top:40px">
    <p style="font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;margin-bottom:10px">Firma del paciente</p>
    ${signatureHtml}
    ${signedLine ? `<p style="font-size:12px;color:#6b7280;margin-top:8px">${signedLine}</p>` : ''}
  </div>

  <div style="border-top:1px solid #f0f0f0;padding-top:20px;margin-top:40px;text-align:center">
    <p style="font-size:11px;color:#9ca3af">Generado con <strong style="color:#111">Vital<span style="color:#00C4BC">OS</span></strong> · <span style="color:#00C4BC;font-weight:600">vitalos.com.ar</span></p>
  </div>

</div>
<script>window.onload = function(){ window.print(); }</script>
</body>
</html>`
}

// ── Image generator (canvas, no dependencies) ─────────────────
// Mismo enfoque que el presupuesto: todo se dibuja a mano en un canvas (el
// render de HTML vía <foreignObject> sale en blanco en muchos navegadores).
// El content_html de la plantilla se parsea a bloques de texto (títulos,
// párrafos, ítems de lista) y se dibuja con wrapping. La firma es un data: URL,
// así que se carga y dibuja sin problemas.

interface ConsentBlock {
  kind: 'h2' | 'h3' | 'p' | 'li'
  text: string
}

// Convierte el HTML de la plantilla en bloques de texto planos para el canvas.
function parseConsentBlocks(html: string): ConsentBlock[] {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html')
  const blocks: ConsentBlock[] = []

  function textOf(el: Element) {
    return (el.textContent ?? '').replace(/\s+/g, ' ').trim()
  }

  function walk(parent: ParentNode) {
    parent.childNodes.forEach(node => {
      if (node.nodeType === Node.TEXT_NODE) {
        const t = (node.textContent ?? '').replace(/\s+/g, ' ').trim()
        if (t) blocks.push({ kind: 'p', text: t })
        return
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return
      const el = node as Element
      const tag = el.tagName.toLowerCase()
      switch (tag) {
        case 'h1':
        case 'h2': { const t = textOf(el); if (t) blocks.push({ kind: 'h2', text: t }); break }
        case 'h3':
        case 'h4':
        case 'h5': { const t = textOf(el); if (t) blocks.push({ kind: 'h3', text: t }); break }
        case 'ul':
        case 'ol':
          el.querySelectorAll(':scope > li').forEach(li => {
            const t = textOf(li); if (t) blocks.push({ kind: 'li', text: t })
          })
          break
        case 'li': { const t = textOf(el); if (t) blocks.push({ kind: 'li', text: t }); break }
        case 'br':
          break
        case 'div':
        case 'section':
        case 'article':
          walk(el) // contenedores: bajar un nivel
          break
        default: { const t = textOf(el); if (t) blocks.push({ kind: 'p', text: t }) }
      }
    })
  }

  walk(doc.body)
  return blocks
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image()
    img.onload = () => res(img)
    img.onerror = () => rej(new Error('No se pudo cargar la firma'))
    img.src = src
  })
}

async function generateConsentImage(
  detail: ConsentDetail,
  patientName: string,
  templateName: string,
): Promise<{ dataUrl: string; blob: Blob }> {
  const W = 760
  const PAD = 44
  const DPR = 2
  const TEAL = '#00C4BC'
  const G1 = '#111827'
  const G2 = '#374151'
  const G3 = '#6B7280'
  const G4 = '#9CA3AF'
  const LINE_C = '#E5E7EB'
  const FONT = '-apple-system, Arial, sans-serif'
  const contentW = W - PAD * 2

  // Estilo por tipo de bloque.
  const STYLE: Record<ConsentBlock['kind'], { font: string; color: string; lineH: number; gapBefore: number; gapAfter: number; bullet: boolean }> = {
    h2: { font: `bold 18px ${FONT}`, color: G1, lineH: 25, gapBefore: 18, gapAfter: 8, bullet: false },
    h3: { font: `600 15px ${FONT}`, color: G1, lineH: 22, gapBefore: 14, gapAfter: 6, bullet: false },
    p:  { font: `14px ${FONT}`, color: G2, lineH: 21, gapBefore: 0, gapAfter: 11, bullet: false },
    li: { font: `14px ${FONT}`, color: G2, lineH: 21, gapBefore: 0, gapAfter: 7, bullet: true },
  }
  const BULLET_INDENT = 18

  const blocks = parseConsentBlocks(detail.content_html)
  const signature = detail.signature_data ? await loadImage(detail.signature_data) : null

  // Firma escalada (máx 320×140).
  let sigW = 0, sigH = 0
  if (signature) {
    const maxW = 320, maxH = 140
    const scale = Math.min(maxW / signature.width, maxH / signature.height, 1)
    sigW = Math.round(signature.width * scale)
    sigH = Math.round(signature.height * scale)
  }

  // Canvas de medición para calcular el wrapping y la altura total.
  const measureCtx = document.createElement('canvas').getContext('2d')!
  function wrap(text: string, font: string, maxW: number): string[] {
    measureCtx.font = font
    const words = text.split(' ')
    const lines: string[] = []
    let line = ''
    for (const word of words) {
      const test = line ? `${line} ${word}` : word
      if (measureCtx.measureText(test).width > maxW && line) { lines.push(line); line = word }
      else line = test
    }
    if (line) lines.push(line)
    return lines.length ? lines : ['']
  }

  // Pre-cálculo de líneas de los bloques (para altura y dibujo).
  const laidOut = blocks.map(b => {
    const st = STYLE[b.kind]
    const maxW = st.bullet ? contentW - BULLET_INDENT : contentW
    return { ...b, st, lines: wrap(b.text, st.font, maxW) }
  })

  // ── Altura total ────────────────────────────
  const signatureLabel = 'FIRMA DEL PACIENTE'
  const signedLine = detail.signed_at ? `Firmado el ${formatDateTime(detail.signed_at)}` : ''

  let H = 48 + 90 + 20 + 1 + 20          // top + header + divider + patient label gap
  H += 15 + 22 + 20                       // patient name + gap
  H += 1 + 20                             // divider antes del contenido
  for (const b of laidOut) H += b.st.gapBefore + b.lines.length * b.st.lineH + b.st.gapAfter
  H += 24 + 16 + (sigH || 18) + (signedLine ? 24 : 0)  // firma label + firma/placeholder + fecha
  H += 24 + 1 + 16 + 18                   // footer

  const canvas = document.createElement('canvas')
  canvas.width = W * DPR
  canvas.height = H * DPR
  const ctx = canvas.getContext('2d')!
  ctx.scale(DPR, DPR)
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, W, H)

  function hline(yy: number) {
    ctx.strokeStyle = LINE_C; ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(PAD, yy); ctx.lineTo(W - PAD, yy); ctx.stroke()
  }

  let y = 48

  // ── Header ──────────────────────────────────
  ctx.textAlign = 'left'
  ctx.font = `bold 26px ${FONT}`; ctx.fillStyle = G1
  ctx.fillText('Vital', PAD, y + 26)
  const dw = ctx.measureText('Vital').width
  ctx.fillStyle = TEAL; ctx.fillText('OS', PAD + dw, y + 26)

  ctx.textAlign = 'right'
  ctx.font = `600 10px ${FONT}`; ctx.fillStyle = G4
  ctx.fillText('CONSENTIMIENTO', W - PAD, y + 12)
  // Nombre de plantilla: hasta 2 líneas para que nunca se corte.
  const nameFont = `bold 16px ${FONT}`
  const maxNameW = 440
  let nameLines = wrap(templateName, nameFont, maxNameW)
  if (nameLines.length > 2) {
    ctx.font = nameFont
    let second = nameLines.slice(1).join(' ')
    while (ctx.measureText(`${second}…`).width > maxNameW && second.length > 1) second = second.slice(0, -1)
    nameLines = [nameLines[0], `${second}…`]
  }
  ctx.font = nameFont; ctx.fillStyle = G1
  let ny = y + 34
  for (const line of nameLines) { ctx.fillText(line, W - PAD, ny); ny += 20 }
  ctx.textAlign = 'left'
  y += 90

  // ── Patient ─────────────────────────────────
  hline(y); y += 20
  ctx.font = `600 10px ${FONT}`; ctx.fillStyle = G4
  ctx.fillText('PACIENTE', PAD, y); y += 20
  ctx.font = `bold 15px ${FONT}`; ctx.fillStyle = G1
  ctx.fillText(patientName, PAD, y); y += 22
  y += 20

  // ── Content blocks ──────────────────────────
  hline(y); y += 20
  for (const b of laidOut) {
    y += b.st.gapBefore
    ctx.font = b.st.font; ctx.fillStyle = b.st.color
    if (b.st.bullet) {
      ctx.fillStyle = TEAL
      ctx.fillText('•', PAD, y + 14)
      ctx.fillStyle = b.st.color
    }
    const x = b.st.bullet ? PAD + BULLET_INDENT : PAD
    for (const line of b.lines) {
      ctx.fillText(line, x, y + 14)
      y += b.st.lineH
    }
    y += b.st.gapAfter
  }

  // ── Signature ───────────────────────────────
  y += 4
  ctx.font = `600 10px ${FONT}`; ctx.fillStyle = G4
  ctx.fillText(signatureLabel, PAD, y + 10); y += 24
  if (signature) {
    ctx.drawImage(signature, PAD, y, sigW, sigH)
    y += sigH
  } else {
    ctx.font = `italic 13px ${FONT}`; ctx.fillStyle = G4
    ctx.fillText('Sin firma registrada', PAD, y + 12); y += 18
  }
  if (signedLine) {
    y += 6
    ctx.font = `12px ${FONT}`; ctx.fillStyle = G3
    ctx.fillText(signedLine, PAD, y + 12); y += 18
  }

  // ── Footer ──────────────────────────────────
  y += 24
  hline(y); y += 16
  const brand = 'Generado con VitalOS · vitalos.com.ar'
  ctx.font = `600 11px ${FONT}`
  const brandW = ctx.measureText(brand).width
  const prefix = 'Generado con '
  const prefixW = ctx.measureText(prefix).width
  const bx = W / 2 - brandW / 2
  ctx.textAlign = 'left'
  ctx.fillStyle = G3; ctx.fillText(prefix, bx, y + 8)
  ctx.fillStyle = TEAL; ctx.fillText('VitalOS · vitalos.com.ar', bx + prefixW, y + 8)

  const dataUrl = canvas.toDataURL('image/png')
  const blob = await new Promise<Blob>(res => canvas.toBlob(b => res(b!), 'image/png'))
  return { dataUrl, blob }
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

  // Share / image state (misma lógica que presupuestos)
  const [imagePreview, setImagePreview] = useState<{ url: string; blob: Blob; name: string } | null>(null)
  const [imageGenerating, setImageGenerating] = useState(false)
  const [imageCopied, setImageCopied] = useState(false)

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

  function escapeHtml(s: string) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;')
  }

  function renderConsentHtml(html: string) {
    if (!patient) return html
    return html
      .replace(/\{\{patient_name\}\}/g, escapeHtml(`${patient.first_name} ${patient.last_name}`))
      .replace(/\{\{patient_document\}\}/g, escapeHtml(patient.document_number ?? ''))
      .replace(/\{\{professional_name\}\}/g, escapeHtml(professionalName))
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

  // ── Share / Print (misma lógica que presupuestos) ───────────

  function patientFullName() {
    return patient ? `${patient.first_name} ${patient.last_name}` : '—'
  }

  async function handleShareImage(d: ConsentDetail, templateName: string) {
    setImageGenerating(true)
    try {
      const { dataUrl, blob } = await generateConsentImage(d, patientFullName(), templateName)
      const fileName = `consentimiento-${patientFullName().replace(/\s+/g, '-').toLowerCase()}.png`
      const file = new File([blob], fileName, { type: 'image/png' })

      // Mobile: hoja de compartir nativa (WhatsApp, etc.). Compartimos SOLO el
      // archivo para que WhatsApp no envíe la imagen dos veces.
      if (typeof navigator.share === 'function' && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file] })
        return
      }

      // Desktop: modal de preview para copiar/descargar.
      setImagePreview({ url: dataUrl, blob, name: fileName })
    } catch {
      // usuario canceló share nativo — no-op
    } finally {
      setImageGenerating(false)
    }
  }

  async function handleCopyImage() {
    if (!imagePreview) return
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': imagePreview.blob })])
      setImageCopied(true)
      setTimeout(() => setImageCopied(false), 2500)
    } catch {
      handleDownloadImage()
    }
  }

  function handleDownloadImage() {
    if (!imagePreview) return
    const url = URL.createObjectURL(imagePreview.blob)
    const a = document.createElement('a')
    a.href = url
    a.download = imagePreview.name
    a.click()
    URL.revokeObjectURL(url)
  }

  function handlePrint(d: ConsentDetail, templateName: string) {
    const html = generatePrintHtml(d, patientFullName(), templateName)
    const win = window.open('', '_blank', 'width=860,height=960')
    if (!win) return
    win.document.write(html)
    win.document.close()
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

                        {/* Actions */}
                        <div className="flex gap-2 justify-end flex-wrap pt-1">
                          <button
                            onClick={() => handleShareImage(detail, templateName)}
                            disabled={imageGenerating}
                            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl border border-[#00C4BC]/40 bg-[#E6F8F1] dark:bg-[#00C4BC]/10 hover:bg-[#d0f0ee] dark:hover:bg-[#00C4BC]/20 text-[#00C4BC] transition-colors disabled:opacity-60"
                          >
                            <Share2 size={14} />
                            {imageGenerating ? 'Generando...' : 'Imagen / WhatsApp'}
                          </button>
                          <button
                            onClick={() => handlePrint(detail, templateName)}
                            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl border border-app hover:bg-surface2 text-app2 transition-colors"
                          >
                            <Printer size={14} />
                            Imprimir / PDF
                          </button>
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

      {/* ════════════════════════════════════════
          IMAGE PREVIEW MODAL (desktop)
      ════════════════════════════════════════ */}
      {imagePreview && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-app rounded-2xl w-full max-w-md shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-app shrink-0">
              <div>
                <p className="font-bold text-app">Imagen del consentimiento</p>
                <p className="text-xs text-app3 mt-0.5">Copiá o descargá para enviar por WhatsApp</p>
              </div>
              <button
                onClick={() => setImagePreview(null)}
                className="w-8 h-8 rounded-full hover:bg-surface2 flex items-center justify-center text-app3 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Image preview */}
            <div className="p-4 bg-surface2 overflow-y-auto">
              <img
                src={imagePreview.url}
                alt="Consentimiento"
                className="w-full rounded-xl border border-app shadow-sm"
              />
            </div>

            {/* Actions */}
            <div className="px-5 py-4 flex gap-3 shrink-0">
              <button
                onClick={handleCopyImage}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-[#00C4BC] hover:bg-[#00aaa3] text-white text-sm font-bold transition-all active:scale-95"
              >
                {imageCopied ? <Check size={15} /> : <Copy size={15} />}
                {imageCopied ? '¡Copiada!' : 'Copiar imagen'}
              </button>
              <button
                onClick={handleDownloadImage}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-app hover:bg-surface2 text-app2 text-sm font-semibold transition-colors"
              >
                <Download size={15} />
                Descargar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
