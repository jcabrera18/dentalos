'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { apiFetch } from '@/lib/api'
import { useRouter } from 'next/navigation'

const HOURS = ['08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00']
const DAYS  = ['Lun','Mar','Mié','Jue','Vie','Sáb']

function getWeekDates(offset = 0) {
  const now = new Date()
  const day = now.getDay() === 0 ? 6 : now.getDay() - 1
  const monday = new Date(now)
  monday.setDate(now.getDate() - day + offset * 7)
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
}

function formatDate(d: Date) {
  return d.toISOString().split('T')[0]
}

function getSlotTop(startsAt: string): number {
  const d = new Date(startsAt)
  const h = d.getUTCHours() - 8
  const m = d.getUTCMinutes()
  return Math.max(0, h * 56 + (m / 60) * 56)
}

function getSlotHeight(startsAt: string, endsAt: string): number {
  const diff = (new Date(endsAt).getTime() - new Date(startsAt).getTime()) / 60000
  return Math.max(28, (diff / 60) * 56)
}

const STATUS_COLORS: Record<string, string> = {
  pending:    'border-amber-400 bg-amber-950/40 text-amber-300',
  confirmed:  'border-blue-400 bg-blue-950/40 text-blue-300',
  completed:  'border-emerald-400 bg-emerald-950/40 text-emerald-300',
  absent:     'border-red-400 bg-red-950/40 text-red-300',
  cancelled:  'border-gray-600 bg-gray-800/40 text-gray-500',
  in_progress:'border-purple-400 bg-purple-950/40 text-purple-300',
}

export default function AgendaPage() {
  const [appointments, setAppointments] = useState<any[]>([])
  const [loading, setLoading]           = useState(true)
  const [token, setToken]               = useState('')
  const [weekOffset, setWeekOffset]     = useState(0)
  const [selectedAppt, setSelectedAppt] = useState<any>(null)
  const router   = useRouter()
  const supabase = createClient()

  const weekDates = getWeekDates(weekOffset)
  const from = formatDate(weekDates[0])
  const to   = formatDate(weekDates[5])

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/'); return }
      setToken(session.access_token)
      await fetchAppointments(session.access_token)
      setLoading(false)
    }
    load()
  }, [weekOffset])

  async function fetchAppointments(t: string) {
    setLoading(true)
    const data = await apiFetch(`/appointments?from=${from}&to=${to}`, { token: t })
    setAppointments(data.data ?? [])
    setLoading(false)
  }

  async function updateStatus(id: string, status: string) {
    await apiFetch(`/appointments/${id}`, {
      method: 'PATCH',
      token,
      body: JSON.stringify({ status })
    })
    await fetchAppointments(token)
    setSelectedAppt(null)
  }

  const today = new Date().toISOString().split('T')[0]

  if (loading && appointments.length === 0) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-gray-400">Cargando...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/dashboard')} className="text-gray-400 hover:text-white transition-colors">
            ← Dashboard
          </button>
          <h1 className="text-xl font-bold">Agenda</h1>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setWeekOffset(w => w - 1)}
            className="bg-gray-800 hover:bg-gray-700 px-3 py-2 rounded-lg text-sm transition-colors">←</button>
          <button onClick={() => setWeekOffset(0)}
            className="bg-gray-800 hover:bg-gray-700 px-3 py-2 rounded-lg text-sm transition-colors">Hoy</button>
          <button onClick={() => setWeekOffset(w => w + 1)}
            className="bg-gray-800 hover:bg-gray-700 px-3 py-2 rounded-lg text-sm transition-colors">→</button>
          <span className="text-sm text-gray-400 hidden sm:block">
            {weekDates[0].toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })} –{' '}
            {weekDates[5].toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
        </div>
      </header>

      {/* Calendar */}
      <div className="flex-1 overflow-auto">
        {/* Day headers */}
        <div className="grid sticky top-0 z-10 bg-gray-950 border-b border-gray-800"
          style={{ gridTemplateColumns: '48px repeat(6, 1fr)' }}>
          <div />
          {weekDates.map((d, i) => {
            const isToday = formatDate(d) === today
            return (
              <div key={i} className="py-3 text-center border-l border-gray-800">
                <div className="text-xs text-gray-500 uppercase tracking-wider">{DAYS[i]}</div>
                <div className={`text-lg font-bold mx-auto mt-0.5 w-8 h-8 flex items-center justify-center rounded-full ${
                  isToday ? 'bg-blue-500 text-white' : ''
                }`}>
                  {d.getDate()}
                </div>
              </div>
            )
          })}
        </div>

        {/* Time grid */}
        <div className="grid" style={{ gridTemplateColumns: '48px repeat(6, 1fr)' }}>
          {/* Time labels */}
          <div>
            {HOURS.map(h => (
              <div key={h} className="h-14 text-right pr-2 pt-1">
                <span className="text-xs text-gray-600 font-mono">{h}</span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          {weekDates.map((d, dayIdx) => {
            const dateStr = formatDate(d)
            const isToday = dateStr === today
            const dayAppts = appointments.filter(a =>
              a.starts_at.startsWith(dateStr) ||
              new Date(a.starts_at).toISOString().split('T')[0] === dateStr
            )

            return (
              <div key={dayIdx}
                className={`relative border-l border-gray-800 ${isToday ? 'bg-blue-950/5' : ''}`}
                style={{ height: `${HOURS.length * 56}px` }}>
                {/* Hour lines */}
                {HOURS.map((_, i) => (
                  <div key={i} className="absolute w-full border-t border-gray-800/50"
                    style={{ top: i * 56 }} />
                ))}

                {/* Appointments */}
                {dayAppts.map(appt => (
                  <div
                    key={appt.id}
                    onClick={() => setSelectedAppt(appt)}
                    className={`absolute left-1 right-1 rounded-md border-l-2 px-1.5 py-1 cursor-pointer hover:opacity-80 transition-opacity overflow-hidden ${STATUS_COLORS[appt.status] ?? STATUS_COLORS.pending}`}
                    style={{
                      top:    getSlotTop(appt.starts_at),
                      height: getSlotHeight(appt.starts_at, appt.ends_at),
                    }}
                  >
                    <div className="text-xs font-bold truncate">{appt.patient_name}</div>
                    <div className="text-xs opacity-70 truncate">{appt.appointment_type}</div>
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      </div>

      {/* Appointment detail modal */}
      {selectedAppt && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4"
          onClick={() => setSelectedAppt(null)}>
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-sm p-6"
            onClick={e => e.stopPropagation()}>
            <div className="w-9 h-1 bg-gray-700 rounded-full mx-auto mb-5 sm:hidden" />

            <div className="mb-4">
              <div className="font-bold text-lg">{selectedAppt.patient_name}</div>
              <div className="text-gray-400 text-sm">{selectedAppt.appointment_type}</div>
              <div className="text-gray-500 text-sm font-mono mt-1">
                {new Date(selectedAppt.starts_at).toLocaleTimeString('es-AR', {
                  hour: '2-digit', minute: '2-digit',
                  timeZone: 'America/Argentina/Buenos_Aires'
                })} — {new Date(selectedAppt.ends_at).toLocaleTimeString('es-AR', {
                  hour: '2-digit', minute: '2-digit',
                  timeZone: 'America/Argentina/Buenos_Aires'
                })}
              </div>
              {selectedAppt.insurance_name && (
                <div className="text-gray-500 text-xs mt-1">{selectedAppt.insurance_name}</div>
              )}
            </div>

            <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Cambiar estado</div>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {[
                { status: 'confirmed',  label: '✓ Confirmado' },
                { status: 'completed',  label: '✅ Atendido' },
                { status: 'absent',     label: '❌ Ausente' },
                { status: 'cancelled',  label: '🚫 Cancelado' },
              ].map(({ status, label }) => (
                <button key={status}
                  onClick={() => updateStatus(selectedAppt.id, status)}
                  className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                    selectedAppt.status === status
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-800 hover:bg-gray-700 text-gray-300'
                  }`}>
                  {label}
                </button>
              ))}
            </div>

            <button
              onClick={() => router.push(`/dashboard/patients/${selectedAppt.patient_id}`)}
              className="w-full bg-gray-800 hover:bg-gray-700 text-white py-2 rounded-lg text-sm transition-colors">
              Ver ficha del paciente →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}