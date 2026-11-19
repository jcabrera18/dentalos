'use client'

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { apiFetch } from '@/lib/api'
import { useMe } from '@/lib/queries'
import {
  BOND_EVIDENCE_OPTIONS, CONTACT_RELATIONSHIPS, CONSENT_RULE_HINT, GUARDIAN_RELATIONSHIPS, ageFromDob,
  buildSignerStatementsHtml, consentSignerRule, relationshipLabel,
  type ConsentSignerRule, type ConsentSignerType,
} from '@/lib/patientContact'
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
  signer_type?: ConsentSignerType
}

interface ConsentDetail extends Consent {
  content_html: string
  signature_data: string | null
  signer_name?: string | null
  signer_document?: string | null
  signer_relationship?: string | null
  signer_authority?: string | null
  guardian_signature_data?: string | null
  treatment_invasive?: boolean | null
  patient_heard?: boolean | null
  signer_identity_verified?: boolean | null
  signer_bond_evidence?: string | null
  patient_age_at_signing?: number | null
}

// Identificación del representante para el rótulo de su firma.
function representativeLabel(detail: ConsentDetail): string {
  const rel = relationshipLabel(detail.signer_relationship)
  const parts = [detail.signer_name, rel && `(${rel})`, detail.signer_document && `· DNI ${detail.signer_document}`]
  return parts.filter(Boolean).join(' ')
}

// Firmas del documento, en orden y con su rótulo (CCyC art. 26, migraciones 078/079).
// 'patient_and_guardian': el adolescente consiente con asistencia de su representante.
function signatureEntries(detail: ConsentDetail): { label: string; data: string | null }[] {
  if (detail.signer_type === 'guardian') {
    return [{ label: `Firma del representante: ${representativeLabel(detail)}`, data: detail.signature_data }]
  }
  if (detail.signer_type === 'patient_and_guardian') {
    return [
      { label: 'Firma del paciente', data: detail.signature_data },
      { label: `Firma del representante (asistencia): ${representativeLabel(detail)}`, data: detail.guardian_signature_data ?? null },
    ]
  }
  return [{ label: 'Firma del paciente', data: detail.signature_data }]
}

function signedByText(t: ConsentSignerType | undefined): string {
  if (t === 'guardian') return 'Firmado por su representante'
  if (t === 'patient_and_guardian') return 'Firmado por el paciente y su representante'
  return 'Firmado por el paciente'
}

// Quién puede firmar según la regla de edad (y, de 13 a 15, si el tratamiento es invasivo).
// Espejo de validateConsentSigner en la API, que es la que decide.
function allowedSignerTypes(rule: ConsentSignerRule, invasive: boolean | null): ConsentSignerType[] {
  switch (rule) {
    case 'dob_required': return []
    case 'guardian_required': return ['guardian']
    case 'guardian_if_invasive':
      if (invasive === null) return []
      return invasive ? ['patient_and_guardian'] : ['patient', 'patient_and_guardian']
    default: return ['patient', 'patient_and_guardian', 'guardian']
  }
}

const SIGNER_TYPE_LABEL: Record<ConsentSignerType, string> = {
  patient: 'El paciente',
  guardian: 'Su representante',
  patient_and_guardian: 'Paciente + representante',
}

// ── Signature pad ─────────────────────────────────────────────

type SignaturePadHandle = { toDataURL: () => string }

const SignaturePad = forwardRef<SignaturePadHandle, { label: string; onChange: (hasSignature: boolean) => void }>(
  function SignaturePad({ label, onChange }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const drawing = useRef(false)
    const [has, setHas] = useState(false)
    const onChangeRef = useRef(onChange)
    useEffect(() => { onChangeRef.current = onChange })

    useImperativeHandle(ref, () => ({
      toDataURL: () => canvasRef.current?.toDataURL('image/png') ?? '',
    }))

    // Tamaño real del canvas al montarse (el modal ya está en pantalla).
    useEffect(() => {
      const id = requestAnimationFrame(() => {
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
        onChangeRef.current(false)
      })
      return () => cancelAnimationFrame(id)
    }, [])

    function point(e: React.PointerEvent<HTMLCanvasElement>, canvas: HTMLCanvasElement) {
      const rect = canvas.getBoundingClientRect()
      return [(e.clientX - rect.left) * (canvas.width / rect.width), (e.clientY - rect.top) * (canvas.height / rect.height)] as const
    }

    function onDown(e: React.PointerEvent<HTMLCanvasElement>) {
      const canvas = canvasRef.current
      const ctx = canvas?.getContext('2d')
      if (!canvas || !ctx) return
      canvas.setPointerCapture(e.pointerId)
      ctx.beginPath()
      ctx.moveTo(...point(e, canvas))
      drawing.current = true
    }

    function onMove(e: React.PointerEvent<HTMLCanvasElement>) {
      if (!drawing.current) return
      const canvas = canvasRef.current
      const ctx = canvas?.getContext('2d')
      if (!canvas || !ctx) return
      ctx.lineTo(...point(e, canvas))
      ctx.stroke()
      if (!has) { setHas(true); onChange(true) }
    }

    function clear() {
      const canvas = canvasRef.current
      const ctx = canvas?.getContext('2d')
      if (!canvas || !ctx) return
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      setHas(false)
      onChange(false)
    }

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-app2 uppercase tracking-wider">{label}</p>
          <button type="button" onClick={clear} className="text-xs text-app3 hover:text-app transition-colors">
            Limpiar
          </button>
        </div>
        <div className="relative rounded-xl border-2 border-dashed border-app overflow-hidden bg-white">
          {!has && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
              <p className="text-gray-300 text-sm">Firme aquí</p>
            </div>
          )}
          <canvas
            ref={canvasRef}
            className="w-full block"
            style={{ height: 160, touchAction: 'none' }}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={() => { drawing.current = false }}
            onPointerLeave={() => { drawing.current = false }}
          />
        </div>
      </div>
    )
  },
)

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

function escapeText(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
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

  const signaturesHtml = signatureEntries(detail).map(sig => `
    <div style="margin-bottom:20px">
      <p style="font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;margin-bottom:10px">${escapeText(sig.label)}</p>
      ${sig.data
        ? `<img src="${sig.data}" alt="Firma" style="max-width:320px;max-height:140px;object-fit:contain" />`
        : '<p style="color:#9ca3af;font-style:italic;margin:0">Sin firma registrada</p>'}
    </div>`).join('')

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
    ${signaturesHtml}
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
  // Firmas escaladas (máx 320×140 cada una).
  const signatures = await Promise.all(signatureEntries(detail).map(async sig => {
    const img = sig.data ? await loadImage(sig.data) : null
    let w = 0, h = 0
    if (img) {
      const scale = Math.min(320 / img.width, 140 / img.height, 1)
      w = Math.round(img.width * scale)
      h = Math.round(img.height * scale)
    }
    return { label: sig.label.toUpperCase(), img, w, h }
  }))

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
  const signedLine = detail.signed_at ? `Firmado el ${formatDateTime(detail.signed_at)}` : ''

  let H = 48 + 90 + 20 + 1 + 20          // top + header + divider + patient label gap
  H += 15 + 22 + 20                       // patient name + gap
  H += 1 + 20                             // divider antes del contenido
  for (const b of laidOut) H += b.st.gapBefore + b.lines.length * b.st.lineH + b.st.gapAfter
  for (const sig of signatures) H += 4 + 24 + (sig.h || 18) + 12  // rótulo + firma/placeholder + separación
  H += signedLine ? 24 : 0                                         // fecha
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
  for (const sig of signatures) {
    y += 4
    ctx.font = `600 10px ${FONT}`; ctx.fillStyle = G4
    ctx.fillText(sig.label, PAD, y + 10); y += 24
    if (sig.img) {
      ctx.drawImage(sig.img, PAD, y, sig.w, sig.h)
      y += sig.h
    } else {
      ctx.font = `italic 13px ${FONT}`; ctx.fillStyle = G4
      ctx.fillText('Sin firma registrada', PAD, y + 12); y += 18
    }
    y += 12
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
  const qc = useQueryClient()

  const [patient, setPatient] = useState<{
    first_name: string
    last_name: string
    document_number?: string | null
    date_of_birth?: string | null
    contact_name?: string | null
    contact_relationship?: string | null
    contact_document_number?: string | null
    contact_is_legal_guardian?: boolean | null
  } | null>(null)
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
  const [saveError, setSaveError] = useState('')

  // Quién firma (CCyC art. 26): lo define la edad y, de 13 a 15, si el tratamiento es invasivo.
  const patientAge = ageFromDob(patient?.date_of_birth)
  const signerRule = consentSignerRule(patientAge)
  const [treatmentInvasive, setTreatmentInvasive] = useState<boolean | null>(null)
  const [signerType, setSignerType] = useState<ConsentSignerType>('patient')
  const [signerName, setSignerName] = useState('')
  const [signerDocument, setSignerDocument] = useState('')
  const [signerRelationship, setSignerRelationship] = useState('')
  const [signerAuthority, setSignerAuthority] = useState('')
  // Constancias del profesional (080): el niño fue oído; DNI y vínculo del representante verificados.
  const [patientHeard, setPatientHeard] = useState(false)
  const [identityVerified, setIdentityVerified] = useState(false)
  const [bondEvidence, setBondEvidence] = useState('')
  const [dobInput, setDobInput] = useState('')
  const [dobSaving, setDobSaving] = useState(false)
  const allowedSigners = allowedSignerTypes(signerRule, treatmentInvasive)
  // Si la opción elegida dejó de valer (cambió la edad o el carácter del tratamiento), se usa la primera permitida.
  const effectiveSigner: ConsentSignerType | null = allowedSigners.includes(signerType) ? signerType : (allowedSigners[0] ?? null)
  const involvesGuardian = effectiveSigner !== null && effectiveSigner !== 'patient'
  const guardianLegallyNeeded = signerRule === 'guardian_required'
    || (signerRule === 'guardian_if_invasive' && treatmentInvasive === true)
  const authorityRequired = involvesGuardian && (
    (guardianLegallyNeeded && !GUARDIAN_RELATIONSHIPS.includes(signerRelationship))
    || (signerRule === 'patient' && effectiveSigner === 'guardian')
  )
  // me es compartido y cacheable → React Query; derivamos el nombre del profesional.
  const { data: me } = useMe()
  const professionalName = me ? `${me.first_name} ${me.last_name}` : ''

  // Firmas: principal (paciente, o representante si firma solo él) y la del representante que asiste.
  const mainPadRef = useRef<SignaturePadHandle>(null)
  const guardianPadRef = useRef<SignaturePadHandle>(null)
  const [hasSignature, setHasSignature] = useState(false)
  const [hasGuardianSignature, setHasGuardianSignature] = useState(false)

  // ── Load data ───────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/'); return }

      const token = session.access_token

      const [patientRes, consentsRes] = await Promise.all([
        apiFetch(`/patients/${patientId}`, { token }),
        apiFetch(`/consents?patient_id=${patientId}`, { token }),
      ])

      setPatient(patientRes.data)
      setConsents(consentsRes.data ?? [])
      setLoading(false)
    }
    load()
  }, [patientId])

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
    setSaveError('')
    setHasSignature(false)
    setHasGuardianSignature(false)
    setTreatmentInvasive(null)
    setSignerAuthority('')
    setPatientHeard(false)
    setIdentityVerified(false)
    setBondEvidence('')
    setDobInput('')
    // Default: lo que exige la edad (se ajusta solo vía effectiveSigner).
    setSignerType(signerRule === 'guardian_required' ? 'guardian' : 'patient')
    setSignerName(patient?.contact_name ?? '')
    setSignerDocument(patient?.contact_document_number ?? '')
    setSignerRelationship(patient?.contact_relationship ?? '')
    setShowSignModal(true)
  }

  // ── Signature handlers ──────────────────────────────────────

  function escapeHtml(s: string) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;')
  }

  // Plantilla con los placeholders resueltos: es lo que se envía. Las constancias
  // legales (representación, verificación, etc.) las agrega la API al guardar.
  function renderConsentHtml(html: string) {
    if (!patient) return html
    const patientFull = `${patient.first_name} ${patient.last_name}`
    // {{signer_*}} = quien presta el consentimiento: el representante solo si firma en lugar del paciente.
    const isGuardian = effectiveSigner === 'guardian'
    const rel = relationshipLabel(signerRelationship)
    return html
      .replace(/\{\{patient_name\}\}/g, escapeHtml(patientFull))
      .replace(/\{\{patient_document\}\}/g, escapeHtml(patient.document_number ?? ''))
      .replace(/\{\{professional_name\}\}/g, escapeHtml(professionalName))
      .replace(/\{\{signer_name\}\}/g, escapeHtml(isGuardian ? signerName : patientFull))
      .replace(/\{\{signer_document\}\}/g, escapeHtml(isGuardian ? signerDocument : (patient.document_number ?? '')))
      .replace(/\{\{signer_relationship\}\}/g, escapeHtml(isGuardian ? rel : ''))
  }

  // Vista previa = plantilla + las constancias que agregará la API (mismo texto).
  function renderPreviewHtml(html: string) {
    if (!patient || !effectiveSigner) return renderConsentHtml(html)
    return renderConsentHtml(html) + buildSignerStatementsHtml({
      patient_name: `${patient.first_name} ${patient.last_name}`,
      age: patientAge,
      signer_type: effectiveSigner,
      treatment_invasive: signerRule === 'guardian_if_invasive' ? treatmentInvasive : null,
      signer_name: signerName,
      signer_document: signerDocument,
      signer_relationship: signerRelationship,
      signer_authority: authorityRequired ? signerAuthority : null,
      patient_heard: patientHeard,
      signer_identity_verified: identityVerified,
      signer_bond_evidence: bondEvidence,
    })
  }

  // Fecha de nacimiento faltante: se carga desde el modal (define quién firma).
  async function saveDob() {
    if (!dobInput || !patient) return
    setDobSaving(true)
    setSaveError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      await apiFetch(`/patients/${patientId}`, {
        method: 'PATCH',
        token: session.access_token,
        body: JSON.stringify({ date_of_birth: dobInput }),
      })
      setPatient({ ...patient, date_of_birth: dobInput })
      setSignerType(consentSignerRule(ageFromDob(dobInput)) === 'guardian_required' ? 'guardian' : 'patient')
      void qc.invalidateQueries({ queryKey: ['patient', patientId] })
      void qc.invalidateQueries({ queryKey: ['patients'] })
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'No se pudo guardar la fecha de nacimiento')
    } finally {
      setDobSaving(false)
    }
  }

  // ── Save consent ────────────────────────────────────────────

  async function handleSave() {
    if (!selectedTemplate || !effectiveSigner || !hasSignature || !mainPadRef.current) return
    if (involvesGuardian && (!signerName.trim() || !signerDocument.trim() || !signerRelationship)) {
      setSaveError('Completá nombre, vínculo y DNI del representante')
      return
    }
    if (authorityRequired && !signerAuthority.trim()) {
      setSaveError('Indicá el instrumento que habilita al representante')
      return
    }
    if (involvesGuardian && (!identityVerified || !bondEvidence)) {
      setSaveError('Confirmá que verificaste el DNI del representante e indicá cómo se acreditó el vínculo')
      return
    }
    if (signerRule === 'guardian_required' && !patientHeard) {
      setSaveError('Confirmá que informaste al paciente y lo escuchaste según su edad y madurez')
      return
    }
    if (effectiveSigner === 'patient_and_guardian' && (!hasGuardianSignature || !guardianPadRef.current)) {
      setSaveError('Falta la firma del representante')
      return
    }
    setSaveError('')
    setSaving(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const signatureData = mainPadRef.current.toDataURL()
      const renderedHtml = renderConsentHtml(selectedTemplate.content_html)
      await apiFetch('/consents', {
        method: 'POST',
        token: session.access_token,
        body: JSON.stringify({
          patient_id: patientId,
          template_id: selectedTemplate.id,
          content_html: renderedHtml,
          signature_data: signatureData,
          signer_type: effectiveSigner,
          ...(signerRule === 'guardian_if_invasive' ? { treatment_invasive: treatmentInvasive } : {}),
          ...(signerRule === 'guardian_required' ? { patient_heard: patientHeard } : {}),
          ...(involvesGuardian ? {
            signer_name: signerName.trim(),
            signer_document: signerDocument.trim(),
            signer_relationship: signerRelationship,
            signer_authority: authorityRequired ? signerAuthority.trim() : undefined,
            signer_identity_verified: identityVerified,
            signer_bond_evidence: bondEvidence,
          } : {}),
          ...(effectiveSigner === 'patient_and_guardian' ? {
            guardian_signature_data: guardianPadRef.current!.toDataURL(),
          } : {}),
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
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'No se pudo guardar el consentimiento')
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
                      {c.status === 'signed' ? signedByText(c.signer_type) : c.status}
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

                        {/* Signatures */}
                        <div className="space-y-3">
                          {signatureEntries(detail).map(sig => (
                            <div key={sig.label}>
                              <p className="text-xs font-semibold text-app2 uppercase tracking-wider mb-2">{sig.label}</p>
                              {sig.data ? (
                                <div className="border border-app rounded-xl overflow-hidden bg-white" style={{ maxWidth: 320 }}>
                                  <img src={sig.data} alt="Firma" className="w-full object-contain" style={{ maxHeight: 120 }} />
                                </div>
                              ) : (
                                <p className="text-sm text-app3 italic">Sin firma registrada</p>
                              )}
                            </div>
                          ))}
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
                dangerouslySetInnerHTML={{ __html: renderPreviewHtml(selectedTemplate.content_html) }}
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
                  {/* Quién firma (CCyC art. 26) */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-semibold text-app2 uppercase tracking-wider">¿Quién firma?</p>
                      {patientAge !== null && <span className="text-xs text-app3">{patientAge} años</span>}
                    </div>

                    {(signerRule === 'dob_required' || (patientAge !== null && patientAge < 18)) && (
                      <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                        {CONSENT_RULE_HINT[signerRule]}
                      </p>
                    )}

                    {signerRule === 'dob_required' && (
                      <div className="flex gap-2">
                        <input type="date" value={dobInput} onChange={e => setDobInput(e.target.value)}
                          max={new Date().toISOString().slice(0, 10)}
                          className="flex-1 bg-surface2 border border-app rounded-lg px-3 py-2 text-app text-sm focus:outline-none focus:border-[#00C4BC]" />
                        <button type="button" onClick={saveDob} disabled={!dobInput || dobSaving}
                          className="px-4 py-2 rounded-lg bg-[#00C4BC] hover:bg-[#00aaa3] disabled:opacity-40 text-white text-sm font-semibold">
                          {dobSaving ? 'Guardando…' : 'Guardar fecha'}
                        </button>
                      </div>
                    )}

                    {signerRule === 'guardian_if_invasive' && (
                      <div className="space-y-1.5">
                        <p className="text-sm text-app2">¿El tratamiento es invasivo o compromete la salud del paciente?</p>
                        <div className="grid grid-cols-2 gap-2">
                          {([
                            { v: true, label: 'Sí, invasivo' },
                            { v: false, label: 'No invasivo' },
                          ] as const).map(opt => (
                            <button key={String(opt.v)} type="button" onClick={() => setTreatmentInvasive(opt.v)}
                              className={`py-2 rounded-xl text-sm font-semibold border transition-all ${
                                treatmentInvasive === opt.v ? 'border-[#00C4BC] bg-[#00C4BC]/10 text-[#00C4BC]' : 'border-app bg-surface2 text-app2 hover:border-app2'
                              }`}>
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {allowedSigners.length > 1 && (
                      <div className={`grid gap-2 ${allowedSigners.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
                        {allowedSigners.map(v => (
                          <button key={v} type="button" onClick={() => setSignerType(v)}
                            className={`py-2 px-1 rounded-xl text-xs sm:text-sm font-semibold border transition-all ${
                              effectiveSigner === v ? 'border-[#00C4BC] bg-[#00C4BC]/10 text-[#00C4BC]' : 'border-app bg-surface2 text-app2 hover:border-app2'
                            }`}>
                            {SIGNER_TYPE_LABEL[v]}
                          </button>
                        ))}
                      </div>
                    )}
                    {allowedSigners.length === 1 && effectiveSigner && (
                      <p className="text-sm text-app2">Firma: <span className="font-semibold text-app">{SIGNER_TYPE_LABEL[effectiveSigner]}</span></p>
                    )}

                    {involvesGuardian && (
                      <div className="space-y-2">
                        <div className="grid grid-cols-1 sm:grid-cols-[1fr_130px_130px] gap-2">
                          <input value={signerName} onChange={e => setSignerName(e.target.value)}
                            placeholder="Nombre y apellido del representante"
                            className="bg-surface2 border border-app rounded-lg px-3 py-2 text-app text-sm focus:outline-none focus:border-[#00C4BC]" />
                          <select value={signerRelationship} onChange={e => setSignerRelationship(e.target.value)}
                            className="bg-surface2 border border-app rounded-lg px-2 py-2 text-app text-sm focus:outline-none focus:border-[#00C4BC]">
                            <option value="">Vínculo *</option>
                            {CONTACT_RELATIONSHIPS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                          </select>
                          <input value={signerDocument} onChange={e => setSignerDocument(e.target.value)}
                            placeholder="DNI *" inputMode="numeric"
                            className="bg-surface2 border border-app rounded-lg px-3 py-2 text-app text-sm focus:outline-none focus:border-[#00C4BC]" />
                        </div>
                        {authorityRequired && (
                          <div>
                            <input value={signerAuthority} onChange={e => setSignerAuthority(e.target.value)}
                              placeholder={signerRule === 'patient'
                                ? 'Instrumento que lo habilita (ej.: sentencia de curatela/apoyo, juzgado y fecha) *'
                                : 'Instrumento que lo habilita (ej.: delegación art. 643, guarda judicial) *'}
                              className="w-full bg-surface2 border border-app rounded-lg px-3 py-2 text-app text-sm focus:outline-none focus:border-[#00C4BC]" />
                            <p className="text-xs text-app3 mt-1">
                              {signerRule === 'patient'
                                ? 'Desde los 16 años decide el paciente: que firme solo un representante requiere un instrumento que lo habilite.'
                                : 'Solo la madre, el padre o el tutor pueden firmar por un menor sin más. Para otro vínculo, dejá constancia del instrumento.'}
                            </p>
                          </div>
                        )}

                        {/* Verificación del firmante (080): prueba de la firma electrónica (Ley 25.506 art. 5) */}
                        <div className="bg-surface2/60 border border-app rounded-lg p-3 space-y-2">
                          <label className="flex items-start gap-2.5 text-sm text-app2 cursor-pointer">
                            <input type="checkbox" checked={identityVerified} onChange={e => setIdentityVerified(e.target.checked)}
                              className="mt-0.5 accent-[#00C4BC]" />
                            <span>Verifiqué la identidad del representante con su DNI</span>
                          </label>
                          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                            <span className="text-sm text-app2 shrink-0">Vínculo acreditado con:</span>
                            <select value={bondEvidence} onChange={e => setBondEvidence(e.target.value)}
                              className="flex-1 bg-surface2 border border-app rounded-lg px-2 py-2 text-app text-sm focus:outline-none focus:border-[#00C4BC]">
                              <option value="">Seleccionar… *</option>
                              {BOND_EVIDENCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                          </div>
                          {bondEvidence === 'declaracion' && (
                            <p className="text-xs text-amber-700 dark:text-amber-400">
                              Queda constancia de que el vínculo fue declarado por el firmante, sin documentación. Si podés, pedí la partida de nacimiento.
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {signerRule === 'guardian_required' && (
                      <label className="flex items-start gap-2.5 text-sm text-app2 cursor-pointer">
                        <input type="checkbox" checked={patientHeard} onChange={e => setPatientHeard(e.target.checked)}
                          className="mt-0.5 accent-[#00C4BC]" />
                        <span>
                          Le expliqué el tratamiento al paciente y lo escuché según su edad y madurez
                          <span className="block text-xs text-app3">Derecho del niño a ser oído (CCyC arts. 26 y 707; Ley 26.529 art. 2 inc. e).</span>
                        </span>
                      </label>
                    )}
                  </div>

                  {effectiveSigner && (
                    <SignaturePad
                      key={effectiveSigner === 'guardian' ? 'main-guardian' : 'main-patient'}
                      ref={mainPadRef}
                      label={effectiveSigner === 'guardian' ? 'Firma del representante' : 'Firma del paciente'}
                      onChange={setHasSignature}
                    />
                  )}
                  {effectiveSigner === 'patient_and_guardian' && (
                    <SignaturePad
                      key="guardian-assist"
                      ref={guardianPadRef}
                      label="Firma del representante (asistencia)"
                      onChange={setHasGuardianSignature}
                    />
                  )}
                  {saveError && (
                    <p className="text-sm text-red-600 dark:text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{saveError}</p>
                  )}
                  <div className="flex gap-3 justify-end">
                    <button
                      onClick={() => { setShowSignModal(false); setSelectedTemplate(null) }}
                      className="px-5 py-2.5 rounded-xl border border-app text-app2 text-sm font-semibold hover:bg-surface2 transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={!effectiveSigner || !hasSignature || saving
                        || (effectiveSigner === 'patient_and_guardian' && !hasGuardianSignature)
                        || (involvesGuardian && (!identityVerified || !bondEvidence))
                        || (signerRule === 'guardian_required' && !patientHeard)}
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
