'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { apiFetch } from '@/lib/api'
import {
  ArrowLeft, Plus, Trash2, Pencil, Printer, FileText,
  ChevronDown, ChevronUp, X, Share2, Download, Copy, Check,
} from 'lucide-react'

// ── PDF generator (new window approach) ──────────────────────

function generatePrintHtml(quote: Quote, patientName: string): string {
  const prof = quote.professionals
  const profName = prof ? `Dr/a. ${prof.first_name} ${prof.last_name}` : ''

  function fmtARS(n: number) {
    return '$ ' + Number(n).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
  }
  function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString('es-AR', {
      day: '2-digit', month: 'long', year: 'numeric',
      timeZone: 'America/Argentina/Buenos_Aires',
    })
  }

  const itemRows = quote.items.map((item, idx) => `
    <tr style="background:${idx % 2 === 0 ? '#fff' : '#f9fafb'}">
      <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0">
        <strong style="color:#111">${item.treatment_name}</strong>
        ${item.comment ? `<br><span style="font-size:11px;color:#999">${item.comment}</span>` : ''}
      </td>
      <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;color:#555">${item.tooth_number || '—'}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;text-align:right;color:#555">${item.quantity}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;text-align:right;color:#555">${fmtARS(item.unit_price)}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;text-align:right;font-weight:600;color:#111">${fmtARS(item.subtotal)}</td>
    </tr>`).join('')

  const discountRow = Number(quote.global_discount_pct) > 0 ? `
    <tr>
      <td colspan="3"></td>
      <td style="padding:6px 12px;text-align:right;color:#555">Descuento (${quote.global_discount_pct}%)</td>
      <td style="padding:6px 12px;text-align:right;color:#059669;font-weight:600">− ${fmtARS(Number(quote.discount_amount))}</td>
    </tr>` : ''

  const notesHtml = quote.notes ? `
    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:14px 16px;margin-bottom:24px">
      <p style="font-size:11px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 6px">Notas</p>
      <p style="color:#374151;margin:0;white-space:pre-line">${quote.notes}</p>
    </div>` : ''

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Presupuesto ${quote.quote_number}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; color:#111; background:#fff; font-size:14px; line-height:1.5; }
    @media print { body { -webkit-print-color-adjust:exact; print-color-adjust:exact; } }
  </style>
</head>
<body>
<div style="max-width:760px;margin:0 auto;padding:48px 40px">

  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:40px;padding-bottom:24px;border-bottom:2px solid #f0f0f0">
    <div>
      <h1 style="font-size:26px;font-weight:900;color:#111;letter-spacing:-0.5px">Dental<span style="color:#00C4BC">OS</span></h1>
      ${profName ? `<p style="color:#6b7280;font-size:12px;margin-top:4px">${profName}</p>` : ''}
    </div>
    <div style="text-align:right">
      <p style="font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;margin-bottom:4px">Presupuesto</p>
      <p style="font-size:22px;font-weight:900;color:#111;font-family:monospace">${quote.quote_number}</p>
      <p style="font-size:12px;color:#6b7280;margin-top:4px">${fmtDate(quote.created_at)}</p>
      ${quote.valid_until ? `<p style="font-size:12px;color:#6b7280">Válido hasta: ${fmtDate(quote.valid_until)}</p>` : ''}
    </div>
  </div>

  <div style="margin-bottom:28px">
    <p style="font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;margin-bottom:6px">Paciente</p>
    <p style="font-size:16px;font-weight:700;color:#111">${patientName}</p>
    ${quote.patients?.phone ? `<p style="font-size:12px;color:#6b7280">${quote.patients.phone}</p>` : ''}
    ${quote.patients?.email ? `<p style="font-size:12px;color:#6b7280">${quote.patients.email}</p>` : ''}
  </div>

  <table style="width:100%;border-collapse:collapse;margin-bottom:24px;font-size:13px">
    <thead>
      <tr style="background:#f9fafb;border-top:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb">
        <th style="text-align:left;padding:10px 12px;font-weight:600;color:#6b7280">Tratamiento</th>
        <th style="text-align:left;padding:10px 12px;font-weight:600;color:#6b7280">Pieza</th>
        <th style="text-align:right;padding:10px 12px;font-weight:600;color:#6b7280">Cant.</th>
        <th style="text-align:right;padding:10px 12px;font-weight:600;color:#6b7280">Precio unit.</th>
        <th style="text-align:right;padding:10px 12px;font-weight:600;color:#6b7280">Subtotal</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
    <tfoot>
      <tr>
        <td colspan="3"></td>
        <td style="padding:8px 12px;text-align:right;color:#6b7280">Subtotal</td>
        <td style="padding:8px 12px;text-align:right;color:#111">${fmtARS(Number(quote.subtotal))}</td>
      </tr>
      ${discountRow}
      <tr style="border-top:2px solid #e5e7eb">
        <td colspan="3"></td>
        <td style="padding:10px 12px;text-align:right;font-weight:700;color:#111;font-size:15px">Total</td>
        <td style="padding:10px 12px;text-align:right;font-weight:700;color:#111;font-size:15px">${fmtARS(Number(quote.total))}</td>
      </tr>
    </tfoot>
  </table>

  ${notesHtml}

  <div style="border-top:1px solid #f0f0f0;padding-top:20px;text-align:center">
    <p style="font-size:11px;color:#9ca3af">Este presupuesto tiene validez indicada en la fecha de vencimiento. Los precios están expresados en pesos argentinos (ARS).</p>
  </div>

</div>
<script>window.onload = function(){ window.print(); }</script>
</body>
</html>`
}

// ── Image generator (canvas, no dependencies) ─────────────────

async function generateQuoteImage(
  quote: Quote,
  patientName: string,
): Promise<{ dataUrl: string; blob: Blob }> {
  const W = 800
  const PAD = 44
  const DPR = 2
  const TEAL = '#00C4BC'
  const G1 = '#111827'
  const G2 = '#374151'
  const G3 = '#6B7280'
  const G4 = '#9CA3AF'
  const LINE_C = '#E5E7EB'
  const FONT = '-apple-system, Arial, sans-serif'
  const ITEM_H = quote.items.some(i => i.comment) ? 52 : 44
  const GAP = 20

  function fmtN(n: number) {
    return '$ ' + Number(n).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
  }
  function fmtD(iso: string) {
    return new Date(iso).toLocaleDateString('es-AR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      timeZone: 'America/Argentina/Buenos_Aires',
    })
  }

  // Estimate height (pre-pass)
  let H = 48 + 90 + GAP + 1 + GAP  // top + header + divider
  H += 18 + 22 + (quote.patients?.phone ? 18 : 0) + GAP  // patient
  H += 1 + GAP + 32  // divider + table header
  H += quote.items.length * ITEM_H  // items
  H += GAP + 28 + (Number(quote.global_discount_pct) > 0 ? 28 : 0) + 12 + 44  // totals
  if (quote.notes) {
    const lines = Math.max(1, Math.ceil(quote.notes.length / 65))
    H += GAP + 1 + GAP + 18 + lines * 20
  }
  H += GAP + 1 + 36 + 32  // footer + bottom

  const canvas = document.createElement('canvas')
  canvas.width = W * DPR
  canvas.height = H * DPR
  const ctx = canvas.getContext('2d')!
  ctx.scale(DPR, DPR)

  // Background
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, W, H)

  function hline(yy: number) {
    ctx.strokeStyle = LINE_C; ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(PAD, yy); ctx.lineTo(W - PAD, yy); ctx.stroke()
  }

  let y = 48

  // ── Header ──────────────────────────────────

  ctx.textAlign = 'left'
  ctx.font = `bold 26px ${FONT}`
  ctx.fillStyle = G1
  ctx.fillText('Dental', PAD, y + 26)
  const dw = ctx.measureText('Dental').width
  ctx.fillStyle = TEAL
  ctx.fillText('OS', PAD + dw, y + 26)

  if (quote.professionals) {
    ctx.font = `12px ${FONT}`; ctx.fillStyle = G3
    ctx.fillText(`Dr/a. ${quote.professionals.first_name} ${quote.professionals.last_name}`, PAD, y + 46)
  }

  ctx.textAlign = 'right'
  ctx.font = `600 10px ${FONT}`; ctx.fillStyle = G4
  ctx.fillText('PRESUPUESTO', W - PAD, y + 12)
  ctx.font = `bold 20px monospace`; ctx.fillStyle = G1
  ctx.fillText(quote.quote_number, W - PAD, y + 34)
  ctx.font = `12px ${FONT}`; ctx.fillStyle = G3
  ctx.fillText(fmtD(quote.created_at), W - PAD, y + 52)
  if (quote.valid_until) ctx.fillText(`Válido hasta: ${fmtD(quote.valid_until)}`, W - PAD, y + 68)

  ctx.textAlign = 'left'
  y += 90

  // ── Patient ─────────────────────────────────

  hline(y); y += GAP
  ctx.font = `600 10px ${FONT}`; ctx.fillStyle = G4
  ctx.fillText('PACIENTE', PAD, y); y += 18
  ctx.font = `bold 15px ${FONT}`; ctx.fillStyle = G1
  ctx.fillText(patientName, PAD, y); y += 22
  if (quote.patients?.phone) {
    ctx.font = `12px ${FONT}`; ctx.fillStyle = G3
    ctx.fillText(quote.patients.phone, PAD, y); y += 18
  }
  y += GAP

  // ── Items table ─────────────────────────────

  hline(y); y += GAP

  // Column X positions
  const C = { name: PAD, tooth: W - PAD - 290, qty: W - PAD - 200, price: W - PAD - 100, sub: W - PAD }

  // Table header row
  ctx.fillStyle = '#F3F4F6'
  ctx.fillRect(0, y - 4, W, 32)
  ctx.font = `600 10px ${FONT}`; ctx.fillStyle = G3
  ctx.textAlign = 'left'
  ctx.fillText('TRATAMIENTO', C.name, y + 14)
  ctx.fillText('PIEZA', C.tooth, y + 14)
  ctx.textAlign = 'right'
  ctx.fillText('CANT.', C.qty, y + 14)
  ctx.fillText('PRECIO', C.price, y + 14)
  ctx.fillText('SUBTOTAL', C.sub, y + 14)
  ctx.textAlign = 'left'
  y += 32

  quote.items.forEach((item, idx) => {
    if (idx % 2 === 1) { ctx.fillStyle = '#F9FAFB'; ctx.fillRect(0, y, W, ITEM_H) }

    // Treatment name (auto-truncate)
    const maxNameW = C.tooth - C.name - 12
    ctx.font = `500 13px ${FONT}`; ctx.fillStyle = G1
    let nm = item.treatment_name
    while (ctx.measureText(nm).width > maxNameW && nm.length > 4) nm = nm.slice(0, -1)
    if (nm.length < item.treatment_name.length) nm += '…'
    ctx.fillText(nm, C.name, y + 19)

    if (item.comment) {
      ctx.font = `11px ${FONT}`; ctx.fillStyle = G4
      let cm = item.comment.slice(0, 50)
      if (cm.length < item.comment.length) cm += '…'
      ctx.fillText(cm, C.name, y + 36)
    }

    ctx.font = `12px ${FONT}`; ctx.fillStyle = G2
    ctx.fillText(item.tooth_number || '—', C.tooth, y + 19)

    ctx.textAlign = 'right'
    ctx.fillText(String(item.quantity), C.qty, y + 19)
    ctx.fillText(fmtN(item.unit_price), C.price, y + 19)
    ctx.font = `600 13px ${FONT}`; ctx.fillStyle = G1
    ctx.fillText(fmtN(item.subtotal), C.sub, y + 19)
    ctx.textAlign = 'left'

    y += ITEM_H
    ctx.strokeStyle = LINE_C; ctx.lineWidth = 0.5
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke()
  })

  y += GAP

  // ── Totals ──────────────────────────────────

  const LX = W - PAD - 210
  ctx.textAlign = 'right'
  ctx.font = `13px ${FONT}`; ctx.fillStyle = G3
  ctx.fillText('Subtotal', LX, y + 16)
  ctx.fillStyle = G2; ctx.fillText(fmtN(Number(quote.subtotal)), W - PAD, y + 16); y += 28

  if (Number(quote.global_discount_pct) > 0) {
    ctx.fillStyle = '#059669'
    ctx.fillText(`Descuento (${quote.global_discount_pct}%)`, LX, y + 16)
    ctx.fillText(`− ${fmtN(Number(quote.discount_amount))}`, W - PAD, y + 16); y += 28
  }

  ctx.strokeStyle = '#D1D5DB'; ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(LX - 8, y + 4); ctx.lineTo(W - PAD, y + 4); ctx.stroke()
  y += 12

  ctx.font = `bold 15px ${FONT}`; ctx.fillStyle = G1
  ctx.fillText('Total', LX, y + 22)
  ctx.font = `bold 18px ${FONT}`; ctx.fillStyle = TEAL
  ctx.fillText(fmtN(Number(quote.total)), W - PAD, y + 22)
  ctx.textAlign = 'left'; y += 44

  // ── Notes ───────────────────────────────────

  if (quote.notes) {
    hline(y); y += GAP
    ctx.font = `600 10px ${FONT}`; ctx.fillStyle = G4
    ctx.fillText('NOTAS', PAD, y); y += 18
    ctx.font = `12px ${FONT}`; ctx.fillStyle = G2
    const maxW = W - PAD * 2
    let line = ''
    for (const word of quote.notes.split(' ')) {
      const test = line ? `${line} ${word}` : word
      if (ctx.measureText(test).width > maxW) { ctx.fillText(line, PAD, y); y += 20; line = word }
      else line = test
    }
    if (line) { ctx.fillText(line, PAD, y); y += 20 }
  }

  // ── Footer ──────────────────────────────────

  y += GAP
  hline(y); y += 16
  ctx.font = `11px ${FONT}`; ctx.fillStyle = G4; ctx.textAlign = 'center'
  ctx.fillText('Los precios están expresados en pesos argentinos (ARS).', W / 2, y)

  const dataUrl = canvas.toDataURL('image/png')
  const blob = await new Promise<Blob>(res => canvas.toBlob(b => res(b!), 'image/png'))
  return { dataUrl, blob }
}

// ── Types ────────────────────────────────────────────────────

interface QuoteItem {
  id: string
  treatment_name: string
  tooth_number: string
  quantity: number
  unit_price: number
  subtotal: number
  comment: string
}

interface Quote {
  id: string
  quote_number: string
  patient_id: string
  professional_id: string
  items: QuoteItem[]
  subtotal: number
  global_discount_pct: number
  discount_amount: number
  total: number
  notes: string | null
  valid_until: string | null
  created_at: string
  patients: { first_name: string; last_name: string; phone: string | null; email: string | null }
  professionals: { first_name: string; last_name: string } | null
}

interface Professional {
  id: string
  first_name: string
  last_name: string
}

// ── Helpers ──────────────────────────────────────────────────

function newItem(): QuoteItem {
  return {
    id: crypto.randomUUID(),
    treatment_name: '',
    tooth_number: '',
    quantity: 1,
    unit_price: 0,
    subtotal: 0,
    comment: '',
  }
}

function formatARS(n: number) {
  return '$\u00a0' + n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    timeZone: 'America/Argentina/Buenos_Aires',
  })
}

function todayISO() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
}

// ── Empty form state ─────────────────────────────────────────

function emptyForm(professionalId: string) {
  return {
    professional_id: professionalId,
    items: [newItem()],
    global_discount_pct: 0,
    notes: '',
    valid_until: '',
  }
}

// ── Main component ───────────────────────────────────────────

export default function PatientQuotesPage() {
  const params = useParams()
  const router = useRouter()
  const patientId = params.id as string

  const [quotes, setQuotes] = useState<Quote[]>([])
  const [patient, setPatient] = useState<{ first_name: string; last_name: string; phone: string | null } | null>(null)
  const [professionals, setProfessionals] = useState<Professional[]>([])
  const [loading, setLoading] = useState(true)
  const [myProfessionalId, setMyProfessionalId] = useState('')

  // Form modal
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm(''))
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  // Delete confirm
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Image preview
  const [imagePreview, setImagePreview] = useState<{ url: string; blob: Blob; quoteNumber: string } | null>(null)
  const [imageGenerating, setImageGenerating] = useState<string | null>(null) // quoteId
  const [imageCopied, setImageCopied] = useState(false)

  // Expanded rows
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const supabase = createClient()

  // ── Load data ──────────────────────────────

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/'); return }

      const token = session.access_token
      const profId: string = (session.user.user_metadata?.professional_id ?? session.user.id) as string
      setMyProfessionalId(profId)

      const [patientRes, quotesRes, profsRes] = await Promise.all([
        apiFetch(`/patients/${patientId}`, { token }),
        apiFetch(`/quotes?patient_id=${patientId}`, { token }),
        apiFetch('/professionals', { token }),
      ])

      setPatient(patientRes.data)
      setQuotes(quotesRes.data ?? [])
      setProfessionals(profsRes.data ?? [])
      setForm(emptyForm(profId))
      setLoading(false)
    }
    load()
  }, [patientId])

  // ── Computed totals ────────────────────────

  function calcTotals(items: QuoteItem[], discountPct: number) {
    const subtotal = items.reduce((s, i) => s + i.subtotal, 0)
    const discountAmount = Math.round(subtotal * (discountPct / 100) * 100) / 100
    const total = Math.round((subtotal - discountAmount) * 100) / 100
    return { subtotal, discountAmount, total }
  }

  const { subtotal, discountAmount, total } = calcTotals(form.items, form.global_discount_pct)

  // ── Item helpers ───────────────────────────

  function updateItem(idx: number, field: keyof QuoteItem, value: string | number) {
    setForm(f => {
      const items = f.items.map((item, i) => {
        if (i !== idx) return item
        const updated = { ...item, [field]: value }
        if (field === 'quantity' || field === 'unit_price') {
          updated.subtotal = Math.round(Number(updated.quantity) * Number(updated.unit_price) * 100) / 100
        }
        return updated
      })
      return { ...f, items }
    })
  }

  function addItem() {
    setForm(f => ({ ...f, items: [...f.items, newItem()] }))
  }

  function removeItem(idx: number) {
    setForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }))
  }

  // ── Open create/edit ───────────────────────

  function openCreate() {
    setEditingId(null)
    setForm(emptyForm(myProfessionalId))
    setFormError('')
    setShowForm(true)
  }

  function openEdit(q: Quote) {
    setEditingId(q.id)
    setForm({
      professional_id: q.professional_id,
      items: q.items.map(i => ({
        ...i,
        tooth_number: i.tooth_number ?? '',
        comment: i.comment ?? '',
      })),
      global_discount_pct: Number(q.global_discount_pct ?? 0),
      notes: q.notes ?? '',
      valid_until: q.valid_until ?? '',
    })
    setFormError('')
    setShowForm(true)
  }

  // ── Save ───────────────────────────────────

  async function handleSave() {
    if (form.items.some(i => !i.treatment_name.trim())) {
      setFormError('Todos los ítems deben tener un nombre de tratamiento.')
      return
    }

    setSaving(true)
    setFormError('')

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const payload = {
        patient_id: patientId,
        professional_id: form.professional_id || myProfessionalId,
        items: form.items.map(i => ({
          ...i,
          tooth_number: i.tooth_number || null,
          comment: i.comment || null,
        })),
        global_discount_pct: form.global_discount_pct,
        notes: form.notes || null,
        valid_until: form.valid_until || null,
      }

      if (editingId) {
        const res = await apiFetch(`/quotes/${editingId}`, {
          method: 'PATCH',
          token: session.access_token,
          body: JSON.stringify(payload),
        })
        setQuotes(qs => qs.map(q => q.id === editingId ? res.data : q))
      } else {
        const res = await apiFetch('/quotes', {
          method: 'POST',
          token: session.access_token,
          body: JSON.stringify(payload),
        })
        setQuotes(qs => [res.data, ...qs])
      }

      setShowForm(false)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  // ── Delete ─────────────────────────────────

  async function handleDelete() {
    if (!deleteId) return
    setDeleting(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      await apiFetch(`/quotes/${deleteId}`, { method: 'DELETE', token: session.access_token })
      setQuotes(qs => qs.filter(q => q.id !== deleteId))
      setDeleteId(null)
    } catch (err) {
      // silent — user can retry
    } finally {
      setDeleting(false)
    }
  }

  // ── Image / Share ─────────────────────────

  async function handleShareImage(q: Quote) {
    setImageGenerating(q.id)
    try {
      const { dataUrl, blob } = await generateQuoteImage(q, patientName)
      const file = new File([blob], `presupuesto-${q.quote_number}.png`, { type: 'image/png' })

      // Mobile: native share sheet (WhatsApp, etc.)
      if (typeof navigator.share === 'function' && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `Presupuesto ${q.quote_number}` })
        return
      }

      // Desktop: show preview modal
      setImagePreview({ url: dataUrl, blob, quoteNumber: q.quote_number })
    } catch {
      // user cancelled native share — no-op
    } finally {
      setImageGenerating(null)
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
    a.download = `presupuesto-${imagePreview.quoteNumber}.png`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── Print ──────────────────────────────────

  function handlePrint(quote: Quote) {
    const html = generatePrintHtml(quote, patientName)
    const win = window.open('', '_blank', 'width=860,height=960')
    if (!win) return
    win.document.write(html)
    win.document.close()
  }

  // ── Render ─────────────────────────────────

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
            <h1 className="text-base font-bold text-app leading-tight">Presupuestos</h1>
            <p className="text-xs text-app3">{patientName}</p>
          </div>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 bg-[#00C4BC] hover:bg-[#00aaa3] text-white text-sm font-bold px-4 py-2 rounded-xl transition-all active:scale-95 shadow-sm shadow-[#00C4BC]/20"
          >
            <Plus size={16} />
            Nuevo presupuesto
          </button>
        </div>

        {/* ── Content ── */}
        <div className="max-w-4xl mx-auto px-4 md:px-8 py-6 space-y-4">

          {quotes.length === 0 && (
            <div className="text-center py-20">
              <div className="w-14 h-14 rounded-full bg-surface2 flex items-center justify-center mx-auto mb-4">
                <FileText size={26} className="text-app3" />
              </div>
              <p className="font-semibold text-app">Sin presupuestos</p>
              <p className="text-app3 text-sm mt-1">Creá el primero con el botón de arriba.</p>
            </div>
          )}

          {quotes.map(q => {
            const expanded = expandedId === q.id
            const prof = q.professionals
            return (
              <div key={q.id} className="bg-surface border border-app rounded-2xl overflow-hidden">

                {/* Row header */}
                <div
                  className="px-5 py-4 flex items-center gap-3 cursor-pointer hover:bg-surface2 transition-colors"
                  onClick={() => setExpandedId(expanded ? null : q.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-[#00C4BC] bg-[#E6F8F1] dark:bg-[#00C4BC]/15 px-2 py-0.5 rounded-md font-mono">
                        {q.quote_number}
                      </span>
                      <span className="text-xs text-app3">{formatDate(q.created_at)}</span>
                      {q.valid_until && (
                        <span className="text-xs text-app3">· Vence {formatDate(q.valid_until)}</span>
                      )}
                    </div>
                    <p className="text-sm text-app2 mt-0.5 truncate">
                      {prof ? `Dr/a. ${prof.first_name} ${prof.last_name}` : ''}
                      {' · '}
                      {q.items.length} {q.items.length === 1 ? 'ítem' : 'ítems'}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-app">{formatARS(Number(q.total))}</p>
                    {Number(q.global_discount_pct) > 0 && (
                      <p className="text-xs text-app3 line-through">{formatARS(Number(q.subtotal))}</p>
                    )}
                  </div>
                  {expanded ? <ChevronUp size={16} className="text-app3 flex-shrink-0" /> : <ChevronDown size={16} className="text-app3 flex-shrink-0" />}
                </div>

                {/* Expanded detail */}
                {expanded && (
                  <div className="border-t border-app px-5 py-4 space-y-4">

                    {/* Items table */}
                    <div className="overflow-x-auto -mx-2">
                      <table className="w-full text-sm min-w-[520px]">
                        <thead>
                          <tr className="text-app3 text-xs border-b border-app">
                            <th className="text-left pb-2 px-2 font-semibold">Tratamiento</th>
                            <th className="text-left pb-2 px-2 font-semibold">Pieza</th>
                            <th className="text-right pb-2 px-2 font-semibold">Cant.</th>
                            <th className="text-right pb-2 px-2 font-semibold">Precio unit.</th>
                            <th className="text-right pb-2 px-2 font-semibold">Subtotal</th>
                          </tr>
                        </thead>
                        <tbody>
                          {q.items.map((item, idx) => (
                            <tr key={item.id} className={idx % 2 === 0 ? 'bg-surface' : 'bg-surface2/50'}>
                              <td className="py-2 px-2">
                                <p className="font-medium text-app">{item.treatment_name}</p>
                                {item.comment && <p className="text-xs text-app3 mt-0.5">{item.comment}</p>}
                              </td>
                              <td className="py-2 px-2 text-app2">{item.tooth_number || '—'}</td>
                              <td className="py-2 px-2 text-right text-app2">{item.quantity}</td>
                              <td className="py-2 px-2 text-right text-app2">{formatARS(item.unit_price)}</td>
                              <td className="py-2 px-2 text-right font-semibold text-app">{formatARS(item.subtotal)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Totals */}
                    <div className="flex justify-end">
                      <div className="space-y-1 text-sm min-w-[220px]">
                        <div className="flex justify-between gap-6 text-app2">
                          <span>Subtotal</span>
                          <span>{formatARS(Number(q.subtotal))}</span>
                        </div>
                        {Number(q.global_discount_pct) > 0 && (
                          <div className="flex justify-between gap-6 text-emerald-600 dark:text-emerald-400">
                            <span>Descuento ({q.global_discount_pct}%)</span>
                            <span>− {formatARS(Number(q.discount_amount))}</span>
                          </div>
                        )}
                        <div className="flex justify-between gap-6 font-bold text-app border-t border-app pt-1 mt-1">
                          <span>Total</span>
                          <span>{formatARS(Number(q.total))}</span>
                        </div>
                      </div>
                    </div>

                    {/* Notes */}
                    {q.notes && (
                      <p className="text-sm text-app2 bg-surface2 rounded-xl px-4 py-3 border border-app">
                        {q.notes}
                      </p>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2 justify-end flex-wrap pt-1">
                      <button
                        onClick={() => handleShareImage(q)}
                        disabled={imageGenerating === q.id}
                        className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl border border-[#00C4BC]/40 bg-[#E6F8F1] dark:bg-[#00C4BC]/10 hover:bg-[#d0f0ee] dark:hover:bg-[#00C4BC]/20 text-[#00C4BC] transition-colors disabled:opacity-60"
                      >
                        <Share2 size={14} />
                        {imageGenerating === q.id ? 'Generando...' : 'Imagen / WhatsApp'}
                      </button>
                      <button
                        onClick={() => handlePrint(q)}
                        className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl border border-app hover:bg-surface2 text-app2 transition-colors"
                      >
                        <Printer size={14} />
                        Imprimir / PDF
                      </button>
                      <button
                        onClick={() => openEdit(q)}
                        className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl border border-app hover:bg-surface2 text-app2 transition-colors"
                      >
                        <Pencil size={14} />
                        Editar
                      </button>
                      <button
                        onClick={() => setDeleteId(q.id)}
                        className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl border border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 transition-colors"
                      >
                        <Trash2 size={14} />
                        Eliminar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ════════════════════════════════════════
          FORM MODAL (Create / Edit)
      ════════════════════════════════════════ */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center overflow-y-auto py-6 px-4">
          <div className="bg-surface border border-app rounded-2xl w-full max-w-3xl shadow-2xl">

            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-app">
              <h2 className="font-bold text-app text-lg">
                {editingId ? 'Editar presupuesto' : 'Nuevo presupuesto'}
              </h2>
              <button
                onClick={() => setShowForm(false)}
                className="w-8 h-8 rounded-full hover:bg-surface2 flex items-center justify-center text-app3 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="px-6 py-5 space-y-6">

              {/* Header fields */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-1">
                  <label className="block text-xs font-semibold text-app2 mb-1.5">Odontólogo/a</label>
                  <select
                    value={form.professional_id}
                    onChange={e => setForm(f => ({ ...f, professional_id: e.target.value }))}
                    className="w-full bg-surface2 border border-app rounded-xl px-3 py-2.5 text-app text-sm focus:outline-none focus:border-[#00C4BC]"
                  >
                    {professionals.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.first_name} {p.last_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-app2 mb-1.5">Válido hasta</label>
                  <input
                    type="date"
                    value={form.valid_until}
                    min={todayISO()}
                    onChange={e => setForm(f => ({ ...f, valid_until: e.target.value }))}
                    className="w-full bg-surface2 border border-app rounded-xl px-3 py-2.5 text-app text-sm focus:outline-none focus:border-[#00C4BC]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-app2 mb-1.5">Descuento global (%)</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    value={form.global_discount_pct === 0 ? '' : form.global_discount_pct}
                    placeholder="0"
                    onChange={e => {
                      const v = parseFloat(e.target.value)
                      setForm(f => ({ ...f, global_discount_pct: isNaN(v) ? 0 : Math.min(100, Math.max(0, v)) }))
                    }}
                    className="w-full bg-surface2 border border-app rounded-xl px-3 py-2.5 text-app text-sm focus:outline-none focus:border-[#00C4BC]"
                  />
                </div>
              </div>

              {/* Items */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-xs font-semibold text-app2">Ítems del presupuesto</label>
                  <button
                    onClick={addItem}
                    className="flex items-center gap-1 text-xs font-bold text-[#00C4BC] hover:text-[#00aaa3] transition-colors"
                  >
                    <Plus size={14} />
                    Agregar ítem
                  </button>
                </div>

                <div className="space-y-3">
                  {form.items.map((item, idx) => (
                    <div key={item.id} className="bg-surface2 border border-app rounded-xl p-4 space-y-3">

                      {/* Row 1: treatment + tooth */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="sm:col-span-2">
                          <label className="block text-xs text-app3 mb-1">Tratamiento *</label>
                          <input
                            type="text"
                            value={item.treatment_name}
                            placeholder="Ej: Endodoncia, Corona zirconio..."
                            onChange={e => updateItem(idx, 'treatment_name', e.target.value)}
                            className="w-full bg-surface border border-app rounded-lg px-3 py-2 text-app text-sm focus:outline-none focus:border-[#00C4BC]"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-app3 mb-1">Pieza dental</label>
                          <input
                            type="text"
                            value={item.tooth_number}
                            placeholder="Ej: 26"
                            onChange={e => updateItem(idx, 'tooth_number', e.target.value)}
                            className="w-full bg-surface border border-app rounded-lg px-3 py-2 text-app text-sm focus:outline-none focus:border-[#00C4BC]"
                          />
                        </div>
                      </div>

                      {/* Row 2: qty + price + subtotal */}
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs text-app3 mb-1">Cantidad</label>
                          <input
                            type="number"
                            min={1}
                            value={item.quantity}
                            onChange={e => updateItem(idx, 'quantity', Math.max(1, parseInt(e.target.value) || 1))}
                            className="w-full bg-surface border border-app rounded-lg px-3 py-2 text-app text-sm focus:outline-none focus:border-[#00C4BC]"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-app3 mb-1">Precio unit. ($)</label>
                          <input
                            type="number"
                            min={0}
                            step={100}
                            value={item.unit_price === 0 ? '' : item.unit_price}
                            placeholder="0"
                            onChange={e => updateItem(idx, 'unit_price', parseFloat(e.target.value) || 0)}
                            className="w-full bg-surface border border-app rounded-lg px-3 py-2 text-app text-sm focus:outline-none focus:border-[#00C4BC]"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-app3 mb-1">Subtotal</label>
                          <div className="w-full bg-surface border border-app rounded-lg px-3 py-2 text-app text-sm font-semibold text-[#00C4BC]">
                            {formatARS(item.subtotal)}
                          </div>
                        </div>
                      </div>

                      {/* Row 3: comment + delete */}
                      <div className="flex gap-3 items-start">
                        <div className="flex-1">
                          <label className="block text-xs text-app3 mb-1">Comentario</label>
                          <input
                            type="text"
                            value={item.comment}
                            placeholder="Observación opcional..."
                            onChange={e => updateItem(idx, 'comment', e.target.value)}
                            className="w-full bg-surface border border-app rounded-lg px-3 py-2 text-app text-sm focus:outline-none focus:border-[#00C4BC]"
                          />
                        </div>
                        {form.items.length > 1 && (
                          <button
                            onClick={() => removeItem(idx)}
                            className="mt-5 p-2 rounded-lg text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex-shrink-0"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Totals preview */}
              <div className="bg-surface2 border border-app rounded-xl px-5 py-4">
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between text-app2">
                    <span>Subtotal</span>
                    <span>{formatARS(subtotal)}</span>
                  </div>
                  {form.global_discount_pct > 0 && (
                    <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                      <span>Descuento ({form.global_discount_pct}%)</span>
                      <span>− {formatARS(discountAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-app text-base border-t border-app pt-2 mt-1">
                    <span>Total</span>
                    <span>{formatARS(total)}</span>
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-app2 mb-1.5">Notas / condiciones</label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  rows={3}
                  placeholder="Condiciones de pago, aclaraciones, garantías..."
                  className="w-full bg-surface2 border border-app rounded-xl px-3 py-2.5 text-app text-sm focus:outline-none focus:border-[#00C4BC] resize-none"
                />
              </div>

              {/* Error */}
              {formError && (
                <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3">
                  {formError}
                </p>
              )}

              {/* Footer buttons */}
              <div className="flex gap-3 justify-end pt-1">
                <button
                  onClick={() => setShowForm(false)}
                  className="px-5 py-2.5 rounded-xl border border-app text-app2 text-sm font-semibold hover:bg-surface2 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-6 py-2.5 rounded-xl bg-[#00C4BC] hover:bg-[#00aaa3] disabled:opacity-60 text-white text-sm font-bold transition-all active:scale-95 shadow-sm shadow-[#00C4BC]/20"
                >
                  {saving ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Crear presupuesto'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════
          IMAGE PREVIEW MODAL
      ════════════════════════════════════════ */}
      {imagePreview && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-app rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-app">
              <div>
                <p className="font-bold text-app">Imagen del presupuesto</p>
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
            <div className="p-4 bg-surface2">
              <img
                src={imagePreview.url}
                alt="Presupuesto"
                className="w-full rounded-xl border border-app shadow-sm"
              />
            </div>

            {/* Actions */}
            <div className="px-5 py-4 flex gap-3">
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

      {/* ════════════════════════════════════════
          DELETE CONFIRM
      ════════════════════════════════════════ */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-app rounded-2xl w-full max-w-sm p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center mx-auto mb-4">
              <Trash2 size={22} className="text-red-500" />
            </div>
            <h3 className="font-bold text-app text-lg mb-2">¿Eliminar presupuesto?</h3>
            <p className="text-app3 text-sm mb-6">Esta acción no se puede deshacer.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteId(null)}
                className="flex-1 py-3 rounded-xl border border-app text-app font-semibold hover:bg-surface2 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 py-3 rounded-xl bg-red-500 hover:bg-red-600 disabled:opacity-60 text-white font-bold transition-colors"
              >
                {deleting ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
