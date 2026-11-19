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

export type AppointmentCardData = {
  patientName: string
  startsAt: Date | string
  appointmentType?: string | null
  /** Especialidad / disciplina legible, p.ej. "Odontología". Opcional. */
  specialty?: string | null
  professionalName?: string | null
  clinicName?: string | null
  clinicAddress?: string | null
  /** Indicación breve configurable, p.ej. "Te esperamos 10 minutos antes". Opcional. */
  arrivalNote?: string | null
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

  // --- FOOTER: "Generado por Vital OS" + "vitalos.com.ar" ---
  // Measure each piece to center the composite line
  ctx.font = `10px ${FONT}`
  const genW = ctx.measureText('Generado por ').width
  ctx.font = `bold 10px ${FONT}`
  const vitalW = ctx.measureText('Vital').width
  const osW = ctx.measureText('OS').width
  const lineW = genW + vitalW + osW
  const startX = Math.floor((W - lineW) / 2)

  ctx.fillStyle = C.light
  ctx.font = `10px ${FONT}`
  ctx.textAlign = 'left'
  ctx.fillText('Generado por ', startX, y + 22)

  ctx.fillStyle = C.dark
  ctx.font = `bold 10px ${FONT}`
  ctx.fillText('Vital', startX + genW, y + 22)

  ctx.fillStyle = C.teal
  ctx.fillText('OS', startX + genW + vitalW, y + 22)

  ctx.fillStyle = C.light
  ctx.font = `9px ${FONT}`
  ctx.textAlign = 'center'
  ctx.fillText('vitalos.com.ar', W / 2, y + 38)

  return canvas
}

// ── Appointment card ────────────────────────────────────────────────────────

function fmtApptDate(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d
  const s = date.toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Argentina/Buenos_Aires',
  })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function fmtApptTime(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d
  return date.toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'America/Argentina/Buenos_Aires',
  })
}

/** Tarjeta de turno (PNG) para compartir por WhatsApp — simil comprobante/presupuesto. */
export async function generateAppointmentImage(
  data: AppointmentCardData,
): Promise<{ dataUrl: string; blob: Blob }> {
  const canvas = buildAppointmentCanvas(data)
  const dataUrl = canvas.toDataURL('image/png')
  const blob = await new Promise<Blob>((resolve) =>
    canvas.toBlob((b) => resolve(b!), 'image/png'),
  )
  return { dataUrl, blob }
}

function buildAppointmentCanvas(data: AppointmentCardData): HTMLCanvasElement {
  const INNER_W = W - PAD * 2
  const FONT = 'Arial, Helvetica, sans-serif'

  // Especialidad · tipo de consulta (ambos opcionales).
  const tipo = [data.specialty?.trim(), data.appointmentType?.trim()]
    .filter(Boolean)
    .join(' · ')

  const tmp = document.createElement('canvas').getContext('2d')!
  tmp.font = `11px ${FONT}`
  const addrLines = data.clinicAddress?.trim()
    ? wrapText(tmp, data.clinicAddress.trim(), INNER_W - 90)
    : []
  const arrival = data.arrivalNote?.trim() || ''

  // Nota de reprogramación (siempre). Texto genérico, no clínico.
  const reprogramText = 'Si no podés asistir, comunicate con el profesional para reprogramar el turno.'
  tmp.font = `10px ${FONT}`
  const reprogramLines = wrapText(tmp, reprogramText, INNER_W)

  // Compute canvas height
  let H = 4 + PAD           // top bar + top padding
  H += 26                   // header row (clinic)
  H += 10                   // gap before separator
  H += 17                   // separator + gap
  H += 96 + 16              // date/time hero box + gap
  H += 64                   // patient box + gap
  H += 28                   // detail title + gap
  if (data.professionalName) H += 22
  if (tipo) H += 22
  H += addrLines.length > 0 ? 16 + addrLines.length * 16 + 8 : 0
  H += 16                   // gap
  if (arrival) H += 40 + 16 // arrival note box + gap
  H += reprogramLines.length * 15 + 12 // reprogram fine print + gap
  H += 16 + 1               // gap + separator
  H += 52 + PAD             // footer + bottom padding

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
  ctx.fillText('COMPROBANTE DE TURNO', W - PAD, y + 15)
  y += 26 + 10

  // Separator
  ctx.strokeStyle = C.border
  ctx.lineWidth = 0.75
  ctx.beginPath(); ctx.moveTo(PAD, y); ctx.lineTo(W - PAD, y); ctx.stroke()
  y += 17

  // --- DATE / TIME HERO BOX ---
  ctx.fillStyle = C.tealBg
  roundRect(ctx, PAD, y, INNER_W, 96, 8)
  ctx.fill()
  ctx.fillStyle = C.teal
  ctx.font = `bold 8px ${FONT}`
  ctx.textAlign = 'left'
  ctx.fillText('TU PRÓXIMO TURNO', PAD + 14, y + 22)
  ctx.fillStyle = C.dark
  ctx.font = `bold 15px ${FONT}`
  ctx.fillText(fmtApptDate(data.startsAt), PAD + 14, y + 48)
  ctx.fillStyle = C.teal
  ctx.font = `bold 26px ${FONT}`
  ctx.fillText(`${fmtApptTime(data.startsAt)} hs`, PAD + 14, y + 82)
  y += 96 + 16

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
  ctx.fillText('DETALLE', PAD, y + 12)
  y += 28

  function row(label: string, value: string) {
    ctx.fillStyle = C.light
    ctx.font = `12px ${FONT}`
    ctx.textAlign = 'left'
    ctx.fillText(label, PAD, y + 14)
    ctx.fillStyle = C.dark
    ctx.font = `bold 12px ${FONT}`
    ctx.textAlign = 'right'
    ctx.fillText(value, W - PAD, y + 14)
    y += 22
  }

  if (data.professionalName) row('Profesional', data.professionalName)
  if (tipo) row('Tipo de consulta', tipo)

  if (addrLines.length > 0) {
    ctx.fillStyle = C.light
    ctx.font = `bold 8px ${FONT}`
    ctx.textAlign = 'left'
    ctx.fillText('DIRECCIÓN', PAD, y + 12)
    y += 16
    ctx.fillStyle = C.mid
    ctx.font = `11px ${FONT}`
    for (const line of addrLines) {
      ctx.fillText(line, PAD, y + 12)
      y += 16
    }
    y += 8
  }

  y += 16

  // --- ARRIVAL NOTE (solo si el consultorio la configuró) ---
  if (arrival) {
    ctx.fillStyle = C.tealBg
    roundRect(ctx, PAD, y, INNER_W, 40, 8)
    ctx.fill()
    ctx.fillStyle = C.teal
    ctx.font = `12px ${FONT}`
    ctx.textAlign = 'center'
    ctx.fillText(arrival, W / 2, y + 24)
    y += 40 + 16
  }

  // --- REPROGRAM NOTE (siempre) ---
  ctx.fillStyle = C.light
  ctx.font = `10px ${FONT}`
  ctx.textAlign = 'center'
  for (const line of reprogramLines) {
    ctx.fillText(line, W / 2, y + 11)
    y += 15
  }
  y += 12

  // Separator
  ctx.strokeStyle = C.border
  ctx.lineWidth = 0.75
  ctx.beginPath(); ctx.moveTo(PAD, y); ctx.lineTo(W - PAD, y); ctx.stroke()
  y += 1

  // --- FOOTER (marca discreta, "OS" en verde) ---
  ctx.font = `bold 11px ${FONT}`
  const pre = 'Tu consultorio, más simple con Vital'
  const preW = ctx.measureText(pre).width
  const osW = ctx.measureText('OS').width
  const fx = Math.floor((W - preW - osW) / 2)
  ctx.textAlign = 'left'
  ctx.fillStyle = C.mid
  ctx.fillText(pre, fx, y + 22)
  ctx.fillStyle = C.teal
  ctx.fillText('OS', fx + preW, y + 22)

  ctx.fillStyle = C.light
  ctx.font = `9px ${FONT}`
  ctx.textAlign = 'center'
  ctx.fillText('vitalos.com.ar', W / 2, y + 38)

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
  const vitalW = ctx.measureText('Vital').width
  const osW = ctx.measureText('OS').width
  const startX = Math.floor((W - genW - vitalW - osW) / 2)

  ctx.fillStyle = C.light
  ctx.font = `10px ${FONT}`
  ctx.textAlign = 'left'
  ctx.fillText('Generado por ', startX, y + 22)
  ctx.fillStyle = C.dark
  ctx.font = `bold 10px ${FONT}`
  ctx.fillText('Vital', startX + genW, y + 22)
  ctx.fillStyle = C.teal
  ctx.fillText('OS', startX + genW + vitalW, y + 22)
  ctx.fillStyle = C.light
  ctx.font = `9px ${FONT}`
  ctx.textAlign = 'center'
  ctx.fillText('vitalos.com.ar', W / 2, y + 38)

  return canvas
}

// ── Indicaciones al paciente ───────────────────────────────────────────────

export type IndicationsCardData = {
  title: string
  /** Ítems; `**texto**` se dibuja en negrita. */
  items: string[]
  footerNote?: string | null
  patientName: string
  date: Date | string
  professionalName?: string | null
  /** Matrícula del profesional tratante, p.ej. "M.P. 1234". */
  licenseNumber?: string | null
  clinicName?: string | null
}

type Run = { text: string; bold: boolean }
type Word = { text: string; bold: boolean; space: boolean }

/** Separa `**negrita**` en tramos. Un `**` sin cerrar se dibuja literal. */
function parseBold(text: string): Run[] {
  const runs: Run[] = []
  const re = /\*\*(.+?)\*\*/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    if (m.index > last) runs.push({ text: text.slice(last, m.index), bold: false })
    runs.push({ text: m[1], bold: true })
    last = m.index + m[0].length
  }
  if (last < text.length) runs.push({ text: text.slice(last), bold: false })
  return runs
}

/** Ajuste de línea con tramos en negrita. Devuelve líneas como listas de palabras. */
function wrapRich(
  ctx: CanvasRenderingContext2D, text: string, maxW: number, size: number, font: string,
): Word[][] {
  // Palabras con su estilo; `space` indica si van precedidas por un espacio.
  const words: Word[] = []
  let pendingSpace = false
  for (const run of parseBold(text)) {
    const parts = run.text.split(/(\s+)/)
    for (const part of parts) {
      if (!part) continue
      if (/^\s+$/.test(part)) { pendingSpace = true; continue }
      words.push({ text: part, bold: run.bold, space: pendingSpace && words.length > 0 })
      pendingSpace = false
    }
  }

  const widthOf = (w: Word) => {
    ctx.font = `${w.bold ? 'bold ' : ''}${size}px ${font}`
    return ctx.measureText(w.text).width
  }
  ctx.font = `${size}px ${font}`
  const spaceW = ctx.measureText(' ').width

  const lines: Word[][] = []
  let cur: Word[] = []
  let curW = 0
  for (const w of words) {
    const ww = widthOf(w)
    const add = (cur.length && w.space ? spaceW : 0) + ww
    if (cur.length && curW + add > maxW) {
      lines.push(cur)
      cur = [{ ...w, space: false }]
      curW = ww
    } else {
      cur.push(cur.length ? w : { ...w, space: false })
      curW += add
    }
  }
  if (cur.length) lines.push(cur)
  return lines
}

function drawRichLine(
  ctx: CanvasRenderingContext2D, line: Word[], x: number, y: number, size: number, font: string, color: string,
) {
  ctx.font = `${size}px ${font}`
  const spaceW = ctx.measureText(' ').width
  ctx.textAlign = 'left'
  ctx.fillStyle = color
  let cx = x
  for (const w of line) {
    if (w.space) cx += spaceW
    ctx.font = `${w.bold ? 'bold ' : ''}${size}px ${font}`
    ctx.fillText(w.text, cx, y)
    cx += ctx.measureText(w.text).width
  }
}

/** Indicaciones (PNG) para compartir por WhatsApp — simil comprobante/presupuesto. */
export async function generateIndicationsImage(
  data: IndicationsCardData,
): Promise<{ dataUrl: string; blob: Blob }> {
  const canvas = buildIndicationsCanvas(data)
  const dataUrl = canvas.toDataURL('image/png')
  const blob = await new Promise<Blob>((resolve) =>
    canvas.toBlob((b) => resolve(b!), 'image/png'),
  )
  return { dataUrl, blob }
}

function buildIndicationsCanvas(data: IndicationsCardData): HTMLCanvasElement {
  const IW = 440 // un poco más ancha que el comprobante: listas largas
  const INNER_W = IW - PAD * 2
  const FONT = 'Arial, Helvetica, sans-serif'
  const ITEM_SIZE = 13
  const ITEM_LH = 18
  const BULLET_W = 16
  const ITEM_GAP = 7

  const items = data.items.map((s) => s.trim()).filter(Boolean)
  const tmp = document.createElement('canvas').getContext('2d')!

  tmp.font = `bold 18px ${FONT}`
  const titleLines = wrapText(tmp, data.title.trim(), INNER_W)
  const itemLines = items.map((it) => wrapRich(tmp, it, INNER_W - BULLET_W, ITEM_SIZE, FONT))
  const footer = data.footerNote?.trim() || ''
  tmp.font = `bold 11px ${FONT}`
  const footerLines = footer ? wrapText(tmp, footer, INNER_W - 28) : []
  const prof = [data.professionalName?.trim(), data.licenseNumber?.trim()].filter(Boolean).join(' · ')

  // Altura
  let H = 4 + PAD
  if (data.clinicName) H += 26 + 10 + 17       // clínica + separador
  H += titleLines.length * 24 + 8               // título
  H += 48 + 18                                  // caja paciente/fecha + gap
  for (const lines of itemLines) H += lines.length * ITEM_LH + ITEM_GAP
  H += 10
  if (footerLines.length) H += 20 + footerLines.length * 15 + 16
  if (prof) H += 40
  H += 16 + 1 + 52 + PAD                        // gap + separador + marca

  const canvas = document.createElement('canvas')
  canvas.width = IW * DPR
  canvas.height = H * DPR
  const ctx = canvas.getContext('2d')!
  ctx.scale(DPR, DPR)

  ctx.fillStyle = C.white
  ctx.fillRect(0, 0, IW, H)
  ctx.fillStyle = C.teal
  ctx.fillRect(0, 0, IW, 4)

  let y = 4 + PAD

  // --- HEADER ---
  if (data.clinicName) {
    ctx.fillStyle = C.dark
    ctx.font = `bold 15px ${FONT}`
    ctx.textAlign = 'left'
    ctx.fillText(data.clinicName, PAD, y + 16)
    ctx.fillStyle = C.light
    ctx.font = `8px ${FONT}`
    ctx.textAlign = 'right'
    ctx.fillText('INDICACIONES', IW - PAD, y + 15)
    y += 26 + 10
    ctx.strokeStyle = C.border
    ctx.lineWidth = 0.75
    ctx.beginPath(); ctx.moveTo(PAD, y); ctx.lineTo(IW - PAD, y); ctx.stroke()
    y += 17
  }

  // --- TÍTULO ---
  ctx.fillStyle = C.dark
  ctx.font = `bold 18px ${FONT}`
  ctx.textAlign = 'center'
  for (const line of titleLines) {
    ctx.fillText(line, IW / 2, y + 18)
    y += 24
  }
  y += 8

  // --- PACIENTE / FECHA ---
  ctx.fillStyle = C.tealBg
  roundRect(ctx, PAD, y, INNER_W, 48, 8)
  ctx.fill()
  ctx.textAlign = 'left'
  ctx.fillStyle = C.teal
  ctx.font = `bold 8px ${FONT}`
  ctx.fillText('PACIENTE', PAD + 12, y + 16)
  ctx.textAlign = 'right'
  ctx.fillText('FECHA', IW - PAD - 12, y + 16)
  ctx.fillStyle = C.dark
  ctx.font = `bold 14px ${FONT}`
  ctx.textAlign = 'left'
  ctx.fillText(data.patientName, PAD + 12, y + 35, INNER_W - 140)
  ctx.font = `12px ${FONT}`
  ctx.textAlign = 'right'
  ctx.fillText(fmtDate(data.date), IW - PAD - 12, y + 35)
  y += 48 + 18

  // --- ÍTEMS ---
  for (const lines of itemLines) {
    ctx.fillStyle = C.teal
    ctx.beginPath()
    ctx.arc(PAD + 4, y + 9, 2.6, 0, Math.PI * 2)
    ctx.fill()
    for (const line of lines) {
      drawRichLine(ctx, line, PAD + BULLET_W, y + 13, ITEM_SIZE, FONT, C.dark)
      y += ITEM_LH
    }
    y += ITEM_GAP
  }
  y += 10

  // --- AVISO (recuadro ámbar) ---
  if (footerLines.length) {
    const boxH = 20 + footerLines.length * 15
    ctx.fillStyle = C.amberBg
    roundRect(ctx, PAD, y, INNER_W, boxH, 8)
    ctx.fill()
    ctx.fillStyle = C.amber
    ctx.fillRect(PAD, y + 6, 3, boxH - 12)
    ctx.font = `bold 11px ${FONT}`
    ctx.textAlign = 'left'
    let fy = y + 10
    for (const line of footerLines) {
      ctx.fillText(line, PAD + 14, fy + 11)
      fy += 15
    }
    y += boxH + 16
  }

  // --- PROFESIONAL ---
  if (prof) {
    ctx.fillStyle = C.light
    ctx.font = `bold 8px ${FONT}`
    ctx.textAlign = 'left'
    ctx.fillText('PROFESIONAL', PAD, y + 10)
    ctx.fillStyle = C.mid
    ctx.font = `bold 12px ${FONT}`
    ctx.fillText(prof, PAD, y + 27, INNER_W)
    y += 40
  }

  y += 16
  ctx.strokeStyle = C.border
  ctx.lineWidth = 0.75
  ctx.beginPath(); ctx.moveTo(PAD, y); ctx.lineTo(IW - PAD, y); ctx.stroke()
  y += 1

  // --- MARCA ---
  ctx.font = `bold 11px ${FONT}`
  const pre = 'Tu consultorio, más simple con Vital'
  const preW = ctx.measureText(pre).width
  const osW = ctx.measureText('OS').width
  const fx = Math.floor((IW - preW - osW) / 2)
  ctx.textAlign = 'left'
  ctx.fillStyle = C.mid
  ctx.fillText(pre, fx, y + 22)
  ctx.fillStyle = C.teal
  ctx.fillText('OS', fx + preW, y + 22)
  ctx.fillStyle = C.light
  ctx.font = `9px ${FONT}`
  ctx.textAlign = 'center'
  ctx.fillText('vitalos.com.ar', IW / 2, y + 38)

  return canvas
}
