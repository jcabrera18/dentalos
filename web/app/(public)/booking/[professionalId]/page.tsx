'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Plus_Jakarta_Sans } from 'next/font/google'

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
})

const BRAND = '#00C4BC'
const BRAND_HOVER = '#00aaa3'
const BRAND_TINT = '#E6F8F1'
const DARK = '#0F1720'

const API_URL = process.env.NEXT_PUBLIC_API_URL

type DayHours = { enabled: boolean; start: string; end: string }
type WorkingHours = Record<number, DayHours>

/** Filtra slots según el horario laboral del profesional */
function filterSlotsByWorkingHours(slots: string[], date: string, wh: WorkingHours | null): string[] {
  if (!wh) return slots
  const jsDay = new Date(date + 'T12:00:00').getDay() // 0=Dom
  const dayKey = jsDay === 0 ? 6 : jsDay - 1          // 0=Lun … 6=Dom
  const day = wh[dayKey]
  if (!day || !day.enabled) return []

  const [startH, startM] = day.start.split(':').map(Number)
  const [endH,   endM]   = day.end.split(':').map(Number)
  const startTotal = startH * 60 + startM
  const endTotal   = endH   * 60 + endM

  return slots.filter(slot => {
    const d = new Date(slot)
    const slotTotal = d.toLocaleString('en-CA', {
      hour: '2-digit', minute: '2-digit', hour12: false,
      timeZone: 'America/Argentina/Buenos_Aires',
    }).split(':').map(Number).reduce((h, m) => h * 60 + m)
    return slotTotal >= startTotal && slotTotal < endTotal
  })
}

const APPOINTMENT_TYPES = [
  'Consulta', 'Limpieza', 'Endodoncia', 'Exodoncia',
  'Ortodoncia', 'Implante', 'Operatoria', 'Prótesis',
  'Blanqueamiento', 'Urgencia', 'Control', 'Armonización facial', 'Otro',
]

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]
const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

type Step = 'date' | 'time' | 'form' | 'success'

type Professional = {
  id: string
  first_name: string
  last_name: string
  specialty: string | null
  color: string | null
  clinics: { name: string } | null
}

type BookingForm = {
  first_name: string
  last_name: string
  phone: string
  email: string
  appointment_type: string
  chief_complaint: string
}

function toDateStr(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('es-AR', {
    hour: '2-digit', minute: '2-digit',
    timeZone: 'America/Argentina/Buenos_Aires',
  })
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', {
    weekday: 'long', day: 'numeric', month: 'long',
    timeZone: 'America/Argentina/Buenos_Aires',
  })
}

export default function BookingPage() {
  const { professionalId } = useParams<{ professionalId: string }>()

  const [professional, setProfessional] = useState<Professional | null>(null)
  const [workingHours, setWorkingHours] = useState<WorkingHours | null>(null)
  const [pageLoading, setPageLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const supabase = createClient()

  const [step, setStep] = useState<Step>('date')

  // Calendar
  const [calMonth, setCalMonth] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  // Slots
  const [slots, setSlots] = useState<string[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)

  // Form
  const [form, setForm] = useState<BookingForm>({
    first_name: '', last_name: '', phone: '',
    email: '', appointment_type: '', chief_complaint: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successData, setSuccessData] = useState<{ starts_at: string; appointment_type: string } | null>(null)

  // ── Load professional info ──────────────────────────
  useEffect(() => {
    Promise.all([
      fetch(`${API_URL}/public/booking/${professionalId}`).then(r => r.json()),
      supabase
        .from('professionals')
        .select('schedule_config')
        .eq('id', professionalId)
        .maybeSingle(),
    ])
      .then(([res, { data: profRow }]) => {
        if (res.data) setProfessional(res.data)
        else setNotFound(true)
        if (profRow?.schedule_config?.working_hours) {
          setWorkingHours(profRow.schedule_config.working_hours)
        }
      })
      .catch(() => setNotFound(true))
      .finally(() => setPageLoading(false))
  }, [professionalId])

  // ── Fetch available slots for a date ───────────────
  const fetchSlots = useCallback(async (date: string, wh: WorkingHours | null) => {
    setSlotsLoading(true)
    setSlots([])
    try {
      const res = await fetch(`${API_URL}/public/booking/${professionalId}/slots?date=${date}`)
      const json = await res.json()
      const raw: string[] = json.data ?? []
      setSlots(filterSlotsByWorkingHours(raw, date, wh))
    } catch {
      setSlots([])
    } finally {
      setSlotsLoading(false)
    }
  }, [professionalId])

  // ── Calendar helpers ────────────────────────────────
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const maxDate = new Date(today)
  maxDate.setDate(maxDate.getDate() + 90)

  const year  = calMonth.getFullYear()
  const month = calMonth.getMonth()
  const firstDow     = new Date(year, month, 1).getDay()
  const daysInMonth  = new Date(year, month + 1, 0).getDate()

  const isDayDisabled = (day: number) => {
    const d = new Date(year, month, day)
    if (d < today || d > maxDate) return true
    const jsDay = d.getDay()
    if (workingHours) {
      const dayKey = jsDay === 0 ? 6 : jsDay - 1
      const dayConfig = workingHours[dayKey]
      return !dayConfig || !dayConfig.enabled
    }
    return jsDay === 0
  }

  const canGoPrev = !(year === today.getFullYear() && month <= today.getMonth())
  const canGoNext = new Date(year, month + 1, 1) <= maxDate

  const handleDayClick = (day: number) => {
    if (isDayDisabled(day)) return
    const dateStr = toDateStr(new Date(year, month, day))
    setSelectedDate(dateStr)
    fetchSlots(dateStr, workingHours)
    setStep('time')
  }

  const handleSlotClick = (slot: string) => {
    setSelectedSlot(slot)
    setStep('form')
  }

  const handleSubmit = async () => {
    if (!form.first_name || !form.last_name || !form.phone || !form.appointment_type) {
      setError('Por favor completá todos los campos requeridos.')
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch(`${API_URL}/public/booking/${professionalId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name:       form.first_name,
          last_name:        form.last_name,
          phone:            form.phone,
          email:            form.email || undefined,
          appointment_type: form.appointment_type,
          starts_at:        selectedSlot,
          chief_complaint:  form.chief_complaint || undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Error al reservar. Intentá de nuevo.')
        return
      }
      setSuccessData(json.data)
      setStep('success')
    } catch {
      setError('Error de conexión. Intentá de nuevo.')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Render states ───────────────────────────────────
  if (pageLoading) {
    return (
      <div className={`${jakarta.className} min-h-screen flex items-center justify-center bg-white`}>
        <div className="text-center">
          <p className="text-2xl font-extrabold tracking-tight mb-6" style={{ color: DARK }}>
            Dental<span style={{ color: BRAND }}>OS</span>
          </p>
          <div
            className="w-8 h-8 rounded-full border-4 mx-auto animate-spin"
            style={{ borderColor: `${BRAND}30`, borderTopColor: BRAND }}
          />
        </div>
      </div>
    )
  }

  if (notFound) {
    return (
      <div className={`${jakarta.className} min-h-screen flex flex-col items-center justify-center bg-white p-6 text-center`}>
        <p className="text-2xl font-extrabold tracking-tight mb-8" style={{ color: DARK }}>
          Dental<span style={{ color: BRAND }}>OS</span>
        </p>
        <h1 className="text-xl font-bold mb-2" style={{ color: DARK }}>Profesional no encontrado</h1>
        <p className="text-sm" style={{ color: '#6B7280' }}>El enlace puede ser incorrecto o el profesional ya no está activo.</p>
      </div>
    )
  }

  const initials = `${professional?.first_name?.[0] ?? ''}${professional?.last_name?.[0] ?? ''}`
  const STEPS: { key: Step; label: string }[] = [
    { key: 'date', label: 'Fecha' },
    { key: 'time', label: 'Horario' },
    { key: 'form', label: 'Datos' },
  ]
  const stepIndex = step === 'success' ? 3 : STEPS.findIndex(s => s.key === step)

  return (
    <div className={`${jakarta.className} min-h-screen bg-white`}>
      {/* ── Ambient glow ── */}
      <div
        className="fixed top-0 right-0 w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{ background: `${BRAND}08`, filter: 'blur(120px)' }}
      />
      <div
        className="fixed bottom-0 left-0 w-[300px] h-[300px] rounded-full pointer-events-none"
        style={{ background: `${BRAND}05`, filter: 'blur(80px)' }}
      />

      <div className="relative max-w-md mx-auto px-4 py-8 space-y-4">

        {/* ── Logo ── */}
        <div className="text-center pt-2 pb-1">
          <p className="text-2xl font-extrabold tracking-tight" style={{ color: DARK }}>
            Dental<span style={{ color: BRAND }}>OS</span>
          </p>
        </div>

        {/* ── Professional card ── */}
        <div
          className="rounded-2xl p-5 flex items-center gap-4 border"
          style={{ background: '#fff', borderColor: `${BRAND}25`, boxShadow: `0 4px 20px ${BRAND}10` }}
        >
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
            style={{ background: `linear-gradient(135deg, ${BRAND}, ${BRAND_HOVER})` }}
          >
            {initials}
          </div>
          <div className="min-w-0">
            <h1 className="font-bold text-base leading-tight" style={{ color: DARK }}>
              Dr/a. {professional?.first_name} {professional?.last_name}
            </h1>
            {professional?.specialty && (
              <p className="text-sm truncate" style={{ color: '#6B7280' }}>{professional.specialty}</p>
            )}
            {professional?.clinics?.name && (
              <p className="text-xs truncate" style={{ color: '#9CA3AF' }}>{professional.clinics.name}</p>
            )}
          </div>
          <div
            className="ml-auto flex-shrink-0 text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wider"
            style={{ background: BRAND_TINT, color: BRAND }}
          >
            Turno
          </div>
        </div>

        {/* ── Step indicator ── */}
        {step !== 'success' && (
          <div className="flex items-start">
            {STEPS.flatMap((s, i) => {
              const isActive = i === stepIndex
              const isDone = i < stepIndex
              const items = []
              if (i > 0) {
                items.push(
                  <div
                    key={`line-${i}`}
                    className="flex-1 h-px mt-3.5 transition-all"
                    style={{ background: i <= stepIndex ? BRAND : '#E5E7EB' }}
                  />
                )
              }
              items.push(
                <div key={s.key} className="flex flex-col items-center shrink-0 w-16">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all"
                    style={{
                      background: isActive ? BRAND : isDone ? BRAND_TINT : '#F3F4F6',
                      color: isActive ? '#fff' : isDone ? BRAND : '#9CA3AF',
                      boxShadow: isActive ? `0 0 0 3px ${BRAND}25` : 'none',
                    }}
                  >
                    {isDone ? '✓' : i + 1}
                  </div>
                  <span
                    className="text-[10px] font-bold mt-1 uppercase tracking-wider text-center"
                    style={{ color: isActive ? BRAND : '#9CA3AF' }}
                  >
                    {s.label}
                  </span>
                </div>
              )
              return items
            })}
          </div>
        )}

        {/* ── Step: Pick date ── */}
        {step === 'date' && (
          <div
            className="bg-white rounded-2xl p-5 border"
            style={{ borderColor: '#E5E7EB', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}
          >
            <h2 className="font-bold mb-4" style={{ color: DARK }}>Elegí un día</h2>

            {/* Month nav */}
            <div className="flex items-center justify-between mb-3">
              <button
                onClick={() => setCalMonth(new Date(year, month - 1, 1))}
                disabled={!canGoPrev}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-lg font-light transition-colors disabled:opacity-25 disabled:cursor-not-allowed"
                style={{ color: '#6B7280' }}
                onMouseEnter={e => { if (canGoPrev) (e.currentTarget as HTMLButtonElement).style.background = BRAND_TINT }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '' }}
              >
                ‹
              </button>
              <span className="font-semibold text-sm capitalize" style={{ color: DARK }}>
                {MONTHS[month]} {year}
              </span>
              <button
                onClick={() => canGoNext && setCalMonth(new Date(year, month + 1, 1))}
                disabled={!canGoNext}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-lg font-light transition-colors disabled:opacity-25 disabled:cursor-not-allowed"
                style={{ color: '#6B7280' }}
                onMouseEnter={e => { if (canGoNext) (e.currentTarget as HTMLButtonElement).style.background = BRAND_TINT }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '' }}
              >
                ›
              </button>
            </div>

            {/* Day names header */}
            <div className="grid grid-cols-7 mb-1">
              {DAY_NAMES.map(d => (
                <div key={d} className="text-center text-[10px] py-1 font-bold uppercase tracking-wider" style={{ color: '#9CA3AF' }}>{d}</div>
              ))}
            </div>

            {/* Days */}
            <div className="grid grid-cols-7 gap-0.5">
              {Array.from({ length: firstDow }).map((_, i) => <div key={`pad-${i}`} />)}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1
                const disabled = isDayDisabled(day)
                const dateStr = toDateStr(new Date(year, month, day))
                const isSelected = dateStr === selectedDate
                const isToday = dateStr === toDateStr(new Date())

                return (
                  <button
                    key={day}
                    onClick={() => handleDayClick(day)}
                    disabled={disabled}
                    className="aspect-square rounded-xl text-sm transition-all"
                    style={{
                      fontWeight: isToday ? '800' : '500',
                      color: disabled ? '#D1D5DB' : isSelected ? '#fff' : DARK,
                      background: isSelected ? BRAND : 'transparent',
                      cursor: disabled ? 'not-allowed' : 'pointer',
                      boxShadow: isSelected ? `0 2px 8px ${BRAND}40` : 'none',
                    }}
                    onMouseEnter={e => {
                      if (!disabled && !isSelected)
                        (e.currentTarget as HTMLButtonElement).style.background = BRAND_TINT
                    }}
                    onMouseLeave={e => {
                      if (!isSelected)
                        (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
                    }}
                  >
                    {day}
                  </button>
                )
              })}
            </div>

            <p className="text-xs mt-4 text-center" style={{ color: '#9CA3AF' }}>
              Turnos disponibles hasta 90 días
            </p>
          </div>
        )}

        {/* ── Step: Pick time ── */}
        {step === 'time' && (
          <div
            className="bg-white rounded-2xl p-5 border"
            style={{ borderColor: '#E5E7EB', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}
          >
            <button
              onClick={() => setStep('date')}
              className="text-sm font-semibold mb-3 flex items-center gap-1 transition-colors"
              style={{ color: BRAND }}
              onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.color = BRAND_HOVER}
              onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.color = BRAND}
            >
              ← Cambiar fecha
            </button>

            <h2 className="font-bold mb-0.5" style={{ color: DARK }}>Elegí un horario</h2>
            <p className="text-sm mb-4 capitalize" style={{ color: '#6B7280' }}>
              {selectedDate && formatDate(`${selectedDate}T12:00:00-03:00`)}
            </p>

            {slotsLoading ? (
              <div className="flex justify-center py-10">
                <div
                  className="w-6 h-6 rounded-full border-4 animate-spin"
                  style={{ borderColor: `${BRAND}30`, borderTopColor: BRAND }}
                />
              </div>
            ) : slots.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm mb-4" style={{ color: '#6B7280' }}>No hay turnos disponibles para este día.</p>
                <button
                  onClick={() => setStep('date')}
                  className="text-sm font-bold"
                  style={{ color: BRAND }}
                >
                  Elegir otro día
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {slots.map(slot => (
                  <button
                    key={slot}
                    onClick={() => handleSlotClick(slot)}
                    className="py-2.5 rounded-xl border-2 text-sm font-bold transition-all"
                    style={{ borderColor: BRAND, color: BRAND, background: 'transparent' }}
                    onMouseEnter={e => {
                      const el = e.currentTarget as HTMLButtonElement
                      el.style.background = BRAND
                      el.style.color = '#fff'
                      el.style.boxShadow = `0 4px 12px ${BRAND}40`
                    }}
                    onMouseLeave={e => {
                      const el = e.currentTarget as HTMLButtonElement
                      el.style.background = 'transparent'
                      el.style.color = BRAND
                      el.style.boxShadow = 'none'
                    }}
                  >
                    {formatTime(slot)}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Step: Patient form ── */}
        {step === 'form' && (
          <div
            className="bg-white rounded-2xl p-5 border"
            style={{ borderColor: '#E5E7EB', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}
          >
            <button
              onClick={() => setStep('time')}
              className="text-sm font-semibold mb-3 flex items-center gap-1 transition-colors"
              style={{ color: BRAND }}
              onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.color = BRAND_HOVER}
              onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.color = BRAND}
            >
              ← Cambiar horario
            </button>

            {/* Selected slot summary */}
            <div
              className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 mb-5 border"
              style={{ background: BRAND_TINT, borderColor: `${BRAND}30` }}
            >
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: BRAND }} />
              <span className="text-sm font-semibold capitalize" style={{ color: DARK }}>
                {selectedDate && formatDate(`${selectedDate}T12:00:00-03:00`)}
                {' · '}
                {selectedSlot && formatTime(selectedSlot)}
              </span>
            </div>

            <h2 className="font-bold mb-4" style={{ color: DARK }}>Tus datos</h2>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-wider mb-1.5 block" style={{ color: DARK }}>Nombre *</span>
                  <input
                    className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none transition-all"
                    style={{ borderColor: '#E5E7EB', background: '#F9FAFB', color: DARK }}
                    value={form.first_name}
                    onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))}
                    placeholder="Juan"
                    autoComplete="given-name"
                    onFocus={e => { e.currentTarget.style.borderColor = BRAND; e.currentTarget.style.background = '#fff' }}
                    onBlur={e => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.background = '#F9FAFB' }}
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-wider mb-1.5 block" style={{ color: DARK }}>Apellido *</span>
                  <input
                    className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none transition-all"
                    style={{ borderColor: '#E5E7EB', background: '#F9FAFB', color: DARK }}
                    value={form.last_name}
                    onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))}
                    placeholder="García"
                    autoComplete="family-name"
                    onFocus={e => { e.currentTarget.style.borderColor = BRAND; e.currentTarget.style.background = '#fff' }}
                    onBlur={e => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.background = '#F9FAFB' }}
                  />
                </label>
              </div>

              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wider mb-1.5 block" style={{ color: DARK }}>Teléfono *</span>
                <input
                  className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none transition-all"
                  style={{ borderColor: '#E5E7EB', background: '#F9FAFB', color: DARK }}
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="+54 9 11 1234-5678"
                  type="tel"
                  autoComplete="tel"
                  onFocus={e => { e.currentTarget.style.borderColor = BRAND; e.currentTarget.style.background = '#fff' }}
                  onBlur={e => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.background = '#F9FAFB' }}
                />
              </label>

              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wider mb-1.5 block" style={{ color: DARK }}>
                  Email{' '}
                  <span style={{ color: '#9CA3AF', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(opcional)</span>
                </span>
                <input
                  className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none transition-all"
                  style={{ borderColor: '#E5E7EB', background: '#F9FAFB', color: DARK }}
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="juan@email.com"
                  type="email"
                  autoComplete="email"
                  onFocus={e => { e.currentTarget.style.borderColor = BRAND; e.currentTarget.style.background = '#fff' }}
                  onBlur={e => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.background = '#F9FAFB' }}
                />
              </label>

              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wider mb-1.5 block" style={{ color: DARK }}>Tipo de consulta *</span>
                <select
                  className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none transition-all appearance-none"
                  style={{ borderColor: '#E5E7EB', background: '#F9FAFB', color: form.appointment_type ? DARK : '#9CA3AF' }}
                  value={form.appointment_type}
                  onChange={e => setForm(f => ({ ...f, appointment_type: e.target.value }))}
                  onFocus={e => { e.currentTarget.style.borderColor = BRAND; e.currentTarget.style.background = '#fff' }}
                  onBlur={e => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.background = '#F9FAFB' }}
                >
                  <option value="">Seleccioná...</option>
                  {APPOINTMENT_TYPES.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wider mb-1.5 block" style={{ color: DARK }}>
                  Motivo{' '}
                  <span style={{ color: '#9CA3AF', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(opcional)</span>
                </span>
                <textarea
                  className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none transition-all resize-none"
                  style={{ borderColor: '#E5E7EB', background: '#F9FAFB', color: DARK }}
                  value={form.chief_complaint}
                  onChange={e => setForm(f => ({ ...f, chief_complaint: e.target.value }))}
                  placeholder="Contanos brevemente el motivo de tu visita..."
                  rows={3}
                  onFocus={e => { e.currentTarget.style.borderColor = BRAND; e.currentTarget.style.background = '#fff' }}
                  onBlur={e => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.background = '#F9FAFB' }}
                />
              </label>
            </div>

            {error && (
              <p className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">{error}</p>
            )}

            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="mt-5 w-full py-4 rounded-xl text-white font-bold text-sm transition-all disabled:opacity-60"
              style={{ background: BRAND, boxShadow: `0 4px 14px ${BRAND}40` }}
              onMouseEnter={e => { if (!submitting) (e.currentTarget as HTMLButtonElement).style.background = BRAND_HOVER }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = BRAND }}
            >
              {submitting ? 'Reservando...' : 'Confirmar turno →'}
            </button>
          </div>
        )}

        {/* ── Step: Success ── */}
        {step === 'success' && successData && (
          <div
            className="bg-white rounded-2xl p-6 text-center border"
            style={{ borderColor: `${BRAND}30`, boxShadow: `0 4px 20px ${BRAND}15` }}
          >
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5 text-2xl font-extrabold"
              style={{ background: BRAND_TINT, color: BRAND }}
            >
              ✓
            </div>
            <h2 className="font-extrabold text-xl mb-2" style={{ color: DARK }}>¡Turno solicitado!</h2>
            <p className="text-sm mb-6" style={{ color: '#6B7280' }}>
              Tu turno está confirmado. ¡Te esperamos!
            </p>

            <div className="rounded-xl p-4 text-left space-y-3" style={{ background: '#F9FAFB', border: '1px solid #E5E7EB' }}>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider mb-0.5" style={{ color: '#9CA3AF' }}>Fecha y hora</p>
                <p className="font-semibold capitalize text-sm" style={{ color: DARK }}>
                  {formatDate(successData.starts_at)} · {formatTime(successData.starts_at)}
                </p>
              </div>
              <div className="h-px" style={{ background: '#E5E7EB' }} />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider mb-0.5" style={{ color: '#9CA3AF' }}>Profesional</p>
                <p className="font-semibold text-sm" style={{ color: DARK }}>
                  Dr/a. {professional?.first_name} {professional?.last_name}
                </p>
              </div>
              <div className="h-px" style={{ background: '#E5E7EB' }} />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider mb-0.5" style={{ color: '#9CA3AF' }}>Tipo de consulta</p>
                <p className="font-semibold text-sm" style={{ color: DARK }}>{successData.appointment_type}</p>
              </div>
            </div>
          </div>
        )}

        {/* ── Footer ── */}
        <div className="text-center pt-2 pb-6">
          <p className="text-xs" style={{ color: '#9CA3AF' }}>
            Agendado con{' '}
            <span className="font-extrabold" style={{ color: DARK }}>
              Dental<span style={{ color: BRAND }}>OS</span>
            </span>
          </p>
        </div>

      </div>
    </div>
  )
}
