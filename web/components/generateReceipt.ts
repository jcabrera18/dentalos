export type AccountStatementData = {
  patientName: string
  clinicName?: string | null
  professionalName?: string | null
  totalBilled: number
  totalCollected: number
  balanceDue: number
  recentPayments: Array<{
    paid_at: string
    method: string
    amount: number
    total_amount?: number | null
    concept?: string | null
  }>
}

export type ReceiptData = {
  patientName: string
  date: Date | string
  concept?: string | null
  method: string
  amount: number
  totalAmount?: number | null
  notes?: string | null
  installments?: number | null
  professionalName?: string | null
  clinicName?: string | null
  balance?: number | null
}

const METHOD_LABELS: Record<string, string> = {
  cash: 'Efectivo',
  bank_transfer: 'Transferencia bancaria',
  debit_card: 'Tarjeta de débito',
  credit_card: 'Tarjeta de crédito',
  insurance: 'Obra social',
  other: 'Otro',
}

const C = {
  teal: '#00C4BC',
  tealBg: '#F0FDFA',
  dark: '#111827',
  mid: '#374151',
  light: '#9CA3AF',
  border: '#E5E7EB',
  white: '#FFFFFF',
  amber: '#D97706',
  amberBg: '#FFFBEB',
}

const W = 400
const PAD = 24
const DPR = 2

function fmt(n: number): string {
  return '$' + n.toLocaleString('es-AR')
}

function fmtDate(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d
  return date.toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Argentina/Buenos_Aires',
  })
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let cur = ''
  for (const word of words) {
    const test = cur ? `${cur} ${word}` : word
    if (ctx.measureText(test).width > maxW && cur) {
      lines.push(cur)
      cur = word
    } else {
      cur = test
    }
  }
  if (cur) lines.push(cur)
  return lines
}

export function downloadReceiptPNG(data: ReceiptData) {
  const canvas = buildCanvas(data)
  const link = document.createElement('a')
  const safe = data.patientName.replace(/\s+/g, '_').toLowerCase()
  const date = new Date().toISOString().split('T')[0]
  link.download = `recibo_${safe}_${date}.png`
  link.href = canvas.toDataURL('image/png')
  link.click()
}

function buildCanvas(data: ReceiptData): HTMLCanvasElement {
  const INNER_W = W - PAD * 2
  const FONT = 'Arial, Helvetica, sans-serif'

  const tmp = document.createElement('canvas').getContext('2d')!
  tmp.font = `11px ${FONT}`
  const noteLines = data.notes?.trim() ? wrapText(tmp, data.notes.trim(), INNER_W) : []

  const totalAmt = Number(data.totalAmount ?? 0)
  const paidAmt = Number(data.amount)
  const hasInstallments = (data.installments ?? 1) > 1
  const hasTotalRow = totalAmt > 0 && totalAmt !== paidAmt
  const bal = data.balance !== null && data.balance !== undefined ? Number(data.balance) : null

  // Compute canvas height
  let H = 4 + PAD           // top bar + top padding
  H += 26                   // header first row (clinic + date)
  if (data.professionalName) H += 18
  H += 10                   // gap before separator
  H += 17                   // separator + gap
  H += 64                   // patient box + gap
  H += 28                   // detail title + gap
  if (data.concept) H += 22
  H += 22                   // method
  if (hasInstallments) H += 22
  if (hasTotalRow) H += 22
  H += 22                   // amount paid
  H += 16                   // gap
  if (bal !== null) H += 56 // balance box + gap
  if (noteLines.length > 0) H += 16 + noteLines.length * 18 + 8
  H += 16 + 1               // gap + separator
  H += 52 + PAD             // footer + bottom padding

  const canvas = document.createElement('canvas')
  canvas.width = W * DPR
  canvas.height = H * DPR
  const ctx = canvas.getContext('2d')!
  ctx.scale(DPR, DPR)

  ctx.fillStyle = C.white
  ctx.fillRect(0, 0, W, H)

  // Top accent bar
  ctx.fillStyle = C.teal
  ctx.fillRect(0, 0, W, 4)

  let y = 4 + PAD

  // --- HEADER ---
  // Clinic name (left, bold large) — main identity
  if (data.clinicName) {
    ctx.fillStyle = C.dark
    ctx.font = `bold 15px ${FONT}`
    ctx.textAlign = 'left'
    ctx.fillText(data.clinicName, PAD, y + 16)
  }

  // Right: label + date
  ctx.fillStyle = C.light
  ctx.font = `8px ${FONT}`
  ctx.textAlign = 'right'
  ctx.fillText('COMPROBANTE DE PAGO', W - PAD, y + 10)
  ctx.font = `11px ${FONT}`
  ctx.fillText(fmtDate(data.date), W - PAD, y + 23)

  y += 26

  if (data.professionalName) {
    ctx.fillStyle = C.mid
    ctx.font = `11px ${FONT}`
    ctx.textAlign = 'left'
    ctx.fillText(data.professionalName, PAD, y + 12)
    y += 18
  }

  y += 10

  // Separator
  ctx.strokeStyle = C.border
  ctx.lineWidth = 0.75
  ctx.beginPath()
  ctx.moveTo(PAD, y)
  ctx.lineTo(W - PAD, y)
  ctx.stroke()
  y += 17

  // --- PATIENT BOX ---
  ctx.fillStyle = C.tealBg
  roundRect(ctx, PAD, y, INNER_W, 48, 8)
  ctx.fill()
  ctx.fillStyle = C.teal
  ctx.font = `bold 8px ${FONT}`
  ctx.textAlign = 'left'
  ctx.fillText('PACIENTE', PAD + 12, y + 14)
  ctx.fillStyle = C.dark
  ctx.font = `bold 16px ${FONT}`
  ctx.fillText(data.patientName, PAD + 12, y + 34)
  y += 64

  // --- DETAIL SECTION ---
  ctx.fillStyle = C.teal
  ctx.font = `bold 8px ${FONT}`
  ctx.textAlign = 'left'
  ctx.fillText('DETALLE DEL COBRO', PAD, y + 12)
  y += 28

  function row(label: string, value: string, valueColor: string = C.dark) {
    ctx.fillStyle = C.light
    ctx.font = `12px ${FONT}`
    ctx.textAlign = 'left'
    ctx.fillText(label, PAD, y + 14)
    ctx.fillStyle = valueColor
    ctx.font = `bold 12px ${FONT}`
    ctx.textAlign = 'right'
    ctx.fillText(value, W - PAD, y + 14)
    y += 22
  }

  if (data.concept) row('Servicio', data.concept)
  row('Forma de pago', METHOD_LABELS[data.method] ?? data.method)
  if (hasInstallments) row('Cuotas', `${data.installments}x`)
  if (hasTotalRow) row('Total del servicio', fmt(totalAmt))
  row('Monto abonado', fmt(paidAmt), C.teal)

  y += 16

  // --- BALANCE BOX ---
  if (bal !== null) {
    const isOwed = bal > 0
    const isFavor = bal < 0
    ctx.fillStyle = isOwed ? C.amberBg : C.tealBg
    roundRect(ctx, PAD, y, INNER_W, 40, 8)
    ctx.fill()
    const boxColor = isOwed ? C.amber : C.teal
    ctx.fillStyle = boxColor
    ctx.font = `bold 12px ${FONT}`
    if (isOwed) {
      ctx.textAlign = 'left'
      ctx.fillText('Saldo pendiente', PAD + 12, y + 24)
      ctx.textAlign = 'right'
      ctx.fillText(fmt(bal), W - PAD - 12, y + 24)
    } else if (isFavor) {
      ctx.textAlign = 'left'
      ctx.fillText('Saldo a favor', PAD + 12, y + 24)
      ctx.textAlign = 'right'
      ctx.fillText(fmt(Math.abs(bal)), W - PAD - 12, y + 24)
    } else {
      ctx.textAlign = 'center'
      ctx.fillText('✓  Saldo al día', W / 2, y + 24)
    }
    y += 56
  }

  // --- NOTES ---
  if (noteLines.length > 0) {
    ctx.fillStyle = C.light
    ctx.font = `bold 8px ${FONT}`
    ctx.textAlign = 'left'
    ctx.fillText('OBSERVACIONES', PAD, y + 12)
    y += 16
    ctx.fillStyle = C.mid
    ctx.font = `11px ${FONT}`
    for (const line of noteLines) {
      ctx.fillText(line, PAD, y + 14)
      y += 18
    }
    y += 8
  }

  y += 16

  // Separator
  ctx.strokeStyle = C.border
  ctx.lineWidth = 0.75
  ctx.beginPath()
  ctx.moveTo(PAD, y)
  ctx.lineTo(W - PAD, y)
  ctx.stroke()
  y += 1

  // --- FOOTER: "Generado por Dental OS" + "dentalos.pro" ---
  // Measure each piece to center the composite line
  ctx.font = `10px ${FONT}`
  const genW = ctx.measureText('Generado por ').width
  ctx.font = `bold 10px ${FONT}`
  const dentalW = ctx.measureText('Dental').width
  const osW = ctx.measureText('OS').width
  const lineW = genW + dentalW + osW
  const startX = Math.floor((W - lineW) / 2)

  ctx.fillStyle = C.light
  ctx.font = `10px ${FONT}`
  ctx.textAlign = 'left'
  ctx.fillText('Generado por ', startX, y + 22)

  ctx.fillStyle = C.dark
  ctx.font = `bold 10px ${FONT}`
  ctx.fillText('Dental', startX + genW, y + 22)

  ctx.fillStyle = C.teal
  ctx.fillText('OS', startX + genW + dentalW, y + 22)

  ctx.fillStyle = C.light
  ctx.font = `9px ${FONT}`
  ctx.textAlign = 'center'
  ctx.fillText('dentalos.pro', W / 2, y + 38)

  return canvas
}

// ── Account Statement ──────────────────────────────────────────────────────

export function downloadAccountStatementPNG(data: AccountStatementData) {
  const canvas = buildStatementCanvas(data)
  const link = document.createElement('a')
  const safe = data.patientName.replace(/\s+/g, '_').toLowerCase()
  const date = new Date().toISOString().split('T')[0]
  link.download = `estado_cuenta_${safe}_${date}.png`
  link.href = canvas.toDataURL('image/png')
  link.click()
}

function buildStatementCanvas(data: AccountStatementData): HTMLCanvasElement {
  const INNER_W = W - PAD * 2
  const FONT = 'Arial, Helvetica, sans-serif'
  const payments = data.recentPayments.slice(0, 5)
  const bal = Number(data.balanceDue)

  // Compute height
  let H = 4 + PAD
  H += 26                        // header row
  if (data.professionalName) H += 18
  H += 10                        // gap before sep
  H += 17                        // sep + gap
  H += 64                        // patient box + gap
  H += 20 + 8                    // RESUMEN label + gap
  H += 22 + 22                   // 2 summary rows
  H += 20                        // gap
  H += 20 + 8                    // ÚLTIMOS MOVIMIENTOS + gap
  H += payments.length * 36      // payment rows
  H += 16                        // gap
  if (bal !== 0) H += 56         // balance box + gap
  H += 16 + 1                    // gap + sep
  H += 52 + PAD                  // footer + bottom

  const canvas = document.createElement('canvas')
  canvas.width = W * DPR
  canvas.height = H * DPR
  const ctx = canvas.getContext('2d')!
  ctx.scale(DPR, DPR)

  ctx.fillStyle = C.white
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = C.teal
  ctx.fillRect(0, 0, W, 4)

  let y = 4 + PAD

  // --- HEADER ---
  if (data.clinicName) {
    ctx.fillStyle = C.dark
    ctx.font = `bold 15px ${FONT}`
    ctx.textAlign = 'left'
    ctx.fillText(data.clinicName, PAD, y + 16)
  }
  ctx.fillStyle = C.light
  ctx.font = `8px ${FONT}`
  ctx.textAlign = 'right'
  ctx.fillText('ESTADO DE CUENTA', W - PAD, y + 10)
  ctx.font = `11px ${FONT}`
  ctx.fillText(new Date().toLocaleDateString('es-AR', {
    day: 'numeric', month: 'long', year: 'numeric',
    timeZone: 'America/Argentina/Buenos_Aires',
  }), W - PAD, y + 23)
  y += 26

  if (data.professionalName) {
    ctx.fillStyle = C.mid
    ctx.font = `11px ${FONT}`
    ctx.textAlign = 'left'
    ctx.fillText(data.professionalName, PAD, y + 12)
    y += 18
  }
  y += 10

  // Separator
  ctx.strokeStyle = C.border
  ctx.lineWidth = 0.75
  ctx.beginPath(); ctx.moveTo(PAD, y); ctx.lineTo(W - PAD, y); ctx.stroke()
  y += 17

  // --- PATIENT BOX ---
  ctx.fillStyle = C.tealBg
  roundRect(ctx, PAD, y, INNER_W, 48, 8)
  ctx.fill()
  ctx.fillStyle = C.teal
  ctx.font = `bold 8px ${FONT}`
  ctx.textAlign = 'left'
  ctx.fillText('PACIENTE', PAD + 12, y + 14)
  ctx.fillStyle = C.dark
  ctx.font = `bold 16px ${FONT}`
  ctx.fillText(data.patientName, PAD + 12, y + 34)
  y += 64

  // --- RESUMEN ---
  ctx.fillStyle = C.teal
  ctx.font = `bold 8px ${FONT}`
  ctx.textAlign = 'left'
  ctx.fillText('RESUMEN', PAD, y + 12)
  y += 20 + 8

  function summaryRow(label: string, value: string, valueColor: string = C.dark) {
    ctx.fillStyle = C.light
    ctx.font = `12px ${FONT}`
    ctx.textAlign = 'left'
    ctx.fillText(label, PAD, y + 14)
    ctx.fillStyle = valueColor
    ctx.font = `bold 12px ${FONT}`
    ctx.textAlign = 'right'
    ctx.fillText(value, W - PAD, y + 14)
    y += 22
  }
  summaryRow('Total de servicios', fmt(Number(data.totalBilled)))
  summaryRow('Total cobrado', fmt(Number(data.totalCollected)), C.teal)
  y += 20

  // --- ÚLTIMOS MOVIMIENTOS ---
  ctx.fillStyle = C.teal
  ctx.font = `bold 8px ${FONT}`
  ctx.textAlign = 'left'
  ctx.fillText(`ÚLTIMOS ${payments.length} MOVIMIENTOS`, PAD, y + 12)
  y += 20 + 8

  for (const p of payments) {
    const dateStr = new Date(p.paid_at).toLocaleDateString('es-AR', {
      day: 'numeric', month: 'short',
      timeZone: 'America/Argentina/Buenos_Aires',
    })
    const label = p.concept || METHOD_LABELS[p.method] || p.method

    ctx.fillStyle = C.light
    ctx.font = `9px ${FONT}`
    ctx.textAlign = 'left'
    ctx.fillText(dateStr, PAD, y + 13)

    ctx.fillStyle = C.mid
    ctx.font = `11px ${FONT}`
    ctx.fillText(label, PAD, y + 27)

    ctx.fillStyle = C.teal
    ctx.font = `bold 12px ${FONT}`
    ctx.textAlign = 'right'
    ctx.fillText(`+${fmt(Number(p.amount))}`, W - PAD, y + 20)

    // Row separator
    ctx.strokeStyle = C.border
    ctx.lineWidth = 0.5
    ctx.beginPath(); ctx.moveTo(PAD, y + 36); ctx.lineTo(W - PAD, y + 36); ctx.stroke()

    y += 36
  }

  y += 16

  // --- BALANCE BOX ---
  if (bal !== 0) {
    const isOwed = bal > 0
    ctx.fillStyle = isOwed ? C.amberBg : C.tealBg
    roundRect(ctx, PAD, y, INNER_W, 40, 8)
    ctx.fill()
    const boxColor = isOwed ? C.amber : C.teal
    ctx.fillStyle = boxColor
    ctx.font = `bold 12px ${FONT}`
    ctx.textAlign = 'left'
    ctx.fillText(isOwed ? 'Saldo pendiente' : 'Saldo a favor', PAD + 12, y + 24)
    ctx.textAlign = 'right'
    ctx.fillText(fmt(Math.abs(bal)), W - PAD - 12, y + 24)
    y += 56
  }

  y += 16

  // Separator
  ctx.strokeStyle = C.border
  ctx.lineWidth = 0.75
  ctx.beginPath(); ctx.moveTo(PAD, y); ctx.lineTo(W - PAD, y); ctx.stroke()
  y += 1

  // --- FOOTER ---
  ctx.font = `10px ${FONT}`
  const genW = ctx.measureText('Generado por ').width
  ctx.font = `bold 10px ${FONT}`
  const dentalW = ctx.measureText('Dental').width
  const osW = ctx.measureText('OS').width
  const startX = Math.floor((W - genW - dentalW - osW) / 2)

  ctx.fillStyle = C.light
  ctx.font = `10px ${FONT}`
  ctx.textAlign = 'left'
  ctx.fillText('Generado por ', startX, y + 22)
  ctx.fillStyle = C.dark
  ctx.font = `bold 10px ${FONT}`
  ctx.fillText('Dental', startX + genW, y + 22)
  ctx.fillStyle = C.teal
  ctx.fillText('OS', startX + genW + dentalW, y + 22)
  ctx.fillStyle = C.light
  ctx.font = `9px ${FONT}`
  ctx.textAlign = 'center'
  ctx.fillText('dentalos.pro', W / 2, y + 38)

  return canvas
}
