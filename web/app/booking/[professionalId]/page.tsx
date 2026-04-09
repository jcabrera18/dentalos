'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'

const API_URL = process.env.NEXT_PUBLIC_API_URL

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
  const [pageLoading, setPageLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

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
    fetch(`${API_URL}/public/booking/${professionalId}`)
      .then(r => r.json())
      .then(res => {
        if (res.data) setProfessional(res.data)
        else setNotFound(true)
      })
      .catch(() => setNotFound(true))
      .finally(() => setPageLoading(false))
  }, [professionalId])

  // ── Fetch available slots for a date ───────────────
  const fetchSlots = useCallback(async (date: string) => {
    setSlotsLoading(true)
    setSlots([])
    try {
      const res = await fetch(`${API_URL}/public/booking/${professionalId}/slots?date=${date}`)
      const json = await res.json()
      setSlots(json.data ?? [])
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
    return d < today || d > maxDate || d.getDay() === 0
  }

  const canGoPrev = !(year === today.getFullYear() && month <= today.getMonth())
  const canGoNext = new Date(year, month + 1, 1) <= maxDate

  const handleDayClick = (day: number) => {
    if (isDayDisabled(day)) return
    const dateStr = toDateStr(new Date(year, month, day))
    setSelectedDate(dateStr)
    fetchSlots(dateStr)
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div
          className="w-8 h-8 rounded-full border-4 border-gray-200 animate-spin"
          style={{ borderTopColor: '#6366f1' }}
        />
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6 text-center">
        <p className="text-4xl mb-4">🔍</p>
        <h1 className="text-xl font-semibold text-gray-800 mb-2">Profesional no encontrado</h1>
        <p className="text-gray-500 text-sm">El enlace puede ser incorrecto o el profesional ya no está activo.</p>
      </div>
    )
  }

  const accent = professional?.color ?? '#6366f1'
  const initials = `${professional?.first_name?.[0] ?? ''}${professional?.last_name?.[0] ?? ''}`

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-md mx-auto space-y-3">

        {/* ── Header ── */}
        <div className="bg-white rounded-2xl shadow-sm p-5 flex items-center gap-4">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-base flex-shrink-0"
            style={{ backgroundColor: accent }}
          >
            {initials}
          </div>
          <div className="min-w-0">
            <h1 className="font-semibold text-gray-900 text-base leading-tight">
              Dr/a. {professional?.first_name} {professional?.last_name}
            </h1>
            {professional?.specialty && (
              <p className="text-sm text-gray-500 truncate">{professional.specialty}</p>
            )}
            {professional?.clinics?.name && (
              <p className="text-xs text-gray-400 truncate">{professional.clinics.name}</p>
            )}
          </div>
        </div>

        {/* ── Step: Pick date ── */}
        {step === 'date' && (
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <h2 className="font-semibold text-gray-800 mb-4">Elegí un día</h2>

            {/* Month nav */}
            <div className="flex items-center justify-between mb-3">
              <button
                onClick={() => setCalMonth(new Date(year, month - 1, 1))}
                disabled={!canGoPrev}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-100 disabled:opacity-25 disabled:cursor-not-allowed text-lg font-light"
              >
                ‹
              </button>
              <span className="font-medium text-gray-800 text-sm capitalize">
                {MONTHS[month]} {year}
              </span>
              <button
                onClick={() => canGoNext && setCalMonth(new Date(year, month + 1, 1))}
                disabled={!canGoNext}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-100 disabled:opacity-25 disabled:cursor-not-allowed text-lg font-light"
              >
                ›
              </button>
            </div>

            {/* Day names header */}
            <div className="grid grid-cols-7 mb-1">
              {DAY_NAMES.map(d => (
                <div key={d} className="text-center text-xs text-gray-400 py-1 font-medium">{d}</div>
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
                    className={[
                      'aspect-square rounded-xl text-sm font-medium transition-all',
                      disabled
                        ? 'text-gray-300 cursor-not-allowed'
                        : 'hover:bg-gray-100 text-gray-700 cursor-pointer',
                      isSelected ? 'text-white' : '',
                      isToday && !isSelected ? 'font-bold' : '',
                    ].join(' ')}
                    style={isSelected ? { backgroundColor: accent } : undefined}
                  >
                    {day}
                  </button>
                )
              })}
            </div>

            <p className="text-xs text-gray-400 mt-4 text-center">
              Los domingos no hay atención · Turnos hasta 90 días
            </p>
          </div>
        )}

        {/* ── Step: Pick time ── */}
        {step === 'time' && (
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <button
              onClick={() => setStep('date')}
              className="text-sm text-gray-500 hover:text-gray-700 mb-3 flex items-center gap-1"
            >
              ← Cambiar fecha
            </button>

            <h2 className="font-semibold text-gray-800 mb-0.5">Elegí un horario</h2>
            <p className="text-sm text-gray-500 mb-4 capitalize">
              {selectedDate && formatDate(`${selectedDate}T12:00:00-03:00`)}
            </p>

            {slotsLoading ? (
              <div className="flex justify-center py-10">
                <div
                  className="w-6 h-6 rounded-full border-4 border-gray-200 animate-spin"
                  style={{ borderTopColor: accent }}
                />
              </div>
            ) : slots.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 mb-4 text-sm">No hay turnos disponibles para este día.</p>
                <button
                  onClick={() => setStep('date')}
                  className="text-sm font-semibold"
                  style={{ color: accent }}
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
                    className="py-2.5 rounded-xl border text-sm font-semibold transition-all hover:text-white hover:border-transparent"
                    style={{ borderColor: accent, color: accent }}
                    onMouseEnter={e => {
                      const el = e.currentTarget as HTMLButtonElement
                      el.style.backgroundColor = accent
                      el.style.color = 'white'
                    }}
                    onMouseLeave={e => {
                      const el = e.currentTarget as HTMLButtonElement
                      el.style.backgroundColor = ''
                      el.style.color = accent
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
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <button
              onClick={() => setStep('time')}
              className="text-sm text-gray-500 hover:text-gray-700 mb-3 flex items-center gap-1"
            >
              ← Cambiar horario
            </button>

            {/* Selected slot summary */}
            <div
              className="flex items-center gap-2 rounded-xl px-3 py-2.5 mb-5"
              style={{ backgroundColor: `${accent}15` }}
            >
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: accent }} />
              <span className="text-sm font-medium text-gray-700 capitalize">
                {selectedDate && formatDate(`${selectedDate}T12:00:00-03:00`)}
                {' · '}
                {selectedSlot && formatTime(selectedSlot)}
              </span>
            </div>

            <h2 className="font-semibold text-gray-800 mb-4">Tus datos</h2>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs text-gray-500 mb-1 block">Nombre *</span>
                  <input
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-400 transition-colors"
                    value={form.first_name}
                    onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))}
                    placeholder="Juan"
                    autoComplete="given-name"
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-gray-500 mb-1 block">Apellido *</span>
                  <input
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-400 transition-colors"
                    value={form.last_name}
                    onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))}
                    placeholder="García"
                    autoComplete="family-name"
                  />
                </label>
              </div>

              <label className="block">
                <span className="text-xs text-gray-500 mb-1 block">Teléfono *</span>
                <input
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-400 transition-colors"
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="+54 9 11 1234-5678"
                  type="tel"
                  autoComplete="tel"
                />
              </label>

              <label className="block">
                <span className="text-xs text-gray-500 mb-1 block">Email <span className="text-gray-400">(opcional)</span></span>
                <input
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-400 transition-colors"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="juan@email.com"
                  type="email"
                  autoComplete="email"
                />
              </label>

              <label className="block">
                <span className="text-xs text-gray-500 mb-1 block">Tipo de consulta *</span>
                <select
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-400 bg-white transition-colors appearance-none"
                  value={form.appointment_type}
                  onChange={e => setForm(f => ({ ...f, appointment_type: e.target.value }))}
                >
                  <option value="">Seleccioná...</option>
                  {APPOINTMENT_TYPES.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-xs text-gray-500 mb-1 block">
                  Motivo de consulta <span className="text-gray-400">(opcional)</span>
                </span>
                <textarea
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-400 transition-colors resize-none"
                  value={form.chief_complaint}
                  onChange={e => setForm(f => ({ ...f, chief_complaint: e.target.value }))}
                  placeholder="Contanos brevemente el motivo de tu visita..."
                  rows={3}
                />
              </label>
            </div>

            {error && (
              <p className="mt-3 text-sm text-red-500 bg-red-50 rounded-xl px-3 py-2">{error}</p>
            )}

            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="mt-5 w-full py-3 rounded-xl text-white font-semibold text-sm transition-opacity disabled:opacity-60 active:scale-95"
              style={{ backgroundColor: accent }}
            >
              {submitting ? 'Reservando...' : 'Confirmar turno'}
            </button>
          </div>
        )}

        {/* ── Step: Success ── */}
        {step === 'success' && successData && (
          <div className="bg-white rounded-2xl shadow-sm p-6 text-center">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold"
              style={{ backgroundColor: `${accent}18`, color: accent }}
            >
              ✓
            </div>
            <h2 className="font-bold text-gray-900 text-xl mb-2">¡Turno solicitado!</h2>
            <p className="text-gray-500 text-sm mb-5">
              Tu turno está confirmado. ¡Te esperamos!
            </p>

            <div className="bg-gray-50 rounded-xl p-4 text-left space-y-3">
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Fecha y hora</p>
                <p className="font-semibold text-gray-800 capitalize text-sm">
                  {formatDate(successData.starts_at)} · {formatTime(successData.starts_at)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Profesional</p>
                <p className="font-medium text-gray-800 text-sm">
                  Dr/a. {professional?.first_name} {professional?.last_name}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Tipo de consulta</p>
                <p className="font-medium text-gray-800 text-sm">{successData.appointment_type}</p>
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  )
}
