'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { apiFetch } from '@/lib/api'
import { useRouter } from 'next/navigation'

const HOURS = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00']
const DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

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
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
}

function todayArg() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
}

function getSlotTop(startsAt: string): number {
  const d = new Date(startsAt)
  const h = d.toLocaleString('en-CA', { hour: 'numeric', hour12: false, timeZone: 'America/Argentina/Buenos_Aires' })
  const m = d.toLocaleString('en-CA', { minute: 'numeric', timeZone: 'America/Argentina/Buenos_Aires' })
  return Math.max(0, (Number(h) - 8) * 64 + (Number(m) / 60) * 64)
}

function getSlotHeight(startsAt: string, endsAt: string): number {
  const diff = (new Date(endsAt).getTime() - new Date(startsAt).getTime()) / 60000
  return Math.max(32, (diff / 60) * 64)
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'border-amber-400 bg-amber-950/50 text-amber-300',
  confirmed: 'border-blue-400 bg-blue-950/50 text-blue-300',
  completed: 'border-emerald-400 bg-emerald-950/50 text-emerald-300',
  absent: 'border-red-400 bg-red-950/50 text-red-300',
  cancelled: 'border-gray-600 bg-gray-800/50 text-gray-500',
  in_progress: 'border-purple-400 bg-purple-950/50 text-purple-300',
}

export default function AgendaPage() {
  const [appointments, setAppointments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [token, setToken] = useState('')
  const [weekOffset, setWeekOffset] = useState(0)
  const [selectedDay, setSelectedDay] = useState(todayArg())
  const [selectedAppt, setSelectedAppt] = useState<any>(null)
  const [showNewAppt, setShowNewAppt] = useState(false)
  const [newApptSlot, setNewApptSlot] = useState<{ date: string; time: string } | null>(null)
  const [patients, setPatients] = useState<any[]>([])
  const router = useRouter()
  const supabase = createClient()

  const weekDates = getWeekDates(weekOffset)
  const from = formatDate(weekDates[0])
  const to = formatDate(weekDates[5])

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/'); return }
      setToken(session.access_token)
      const [_, pData] = await Promise.all([
        fetchAppointments(session.access_token),
        apiFetch('/patients?limit=100', { token: session.access_token })
      ])
      setPatients(pData.data ?? [])
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

  const today = todayArg()

  // Turnos del día seleccionado (mobile)
  const dayAppts = appointments.filter(a => {
    const d = new Date(a.starts_at).toLocaleDateString('en-CA', {
      timeZone: 'America/Argentina/Buenos_Aires'
    })
    return d === selectedDay
  })

  // Turnos por día (desktop)
  function apptsByDay(dateStr: string) {
    return appointments.filter(a => {
      const d = new Date(a.starts_at).toLocaleDateString('en-CA', {
        timeZone: 'America/Argentina/Buenos_Aires'
      })
      return d === dateStr
    })
  }

  const WeekNav = () => (
    <div className="flex items-center gap-2">
      <button onClick={() => setWeekOffset(w => w - 1)}
        className="bg-gray-800 hover:bg-gray-700 px-3 py-2 rounded-lg text-sm transition-colors">←</button>
      <button onClick={() => { setWeekOffset(0); setSelectedDay(today) }}
        className="bg-gray-800 hover:bg-gray-700 px-3 py-2 rounded-lg text-sm transition-colors">Hoy</button>
      <button onClick={() => setWeekOffset(w => w + 1)}
        className="bg-gray-800 hover:bg-gray-700 px-3 py-2 rounded-lg text-sm transition-colors">→</button>
    </div>
  )

  const ApptModal = () => selectedAppt ? (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4"
      onClick={() => setSelectedAppt(null)}>
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-sm p-6"
        onClick={e => e.stopPropagation()}>
        <div className="w-9 h-1 bg-gray-700 rounded-full mx-auto mb-5 sm:hidden" />

        {/* Info del turno */}
        <div className="mb-5">
          <div className="font-bold text-lg">{selectedAppt.patient_name}</div>
          <div className="text-gray-400 text-sm">{selectedAppt.appointment_type ?? 'Consulta'}</div>
          <div className="text-gray-500 text-sm font-mono mt-1">
            {new Date(selectedAppt.starts_at).toLocaleString('es-AR', {
              weekday: 'short', day: 'numeric', month: 'short',
              hour: '2-digit', minute: '2-digit',
              timeZone: 'America/Argentina/Buenos_Aires'
            })}
          </div>
          {selectedAppt.insurance_name && (
            <div className="text-gray-500 text-xs mt-1">{selectedAppt.insurance_name}</div>
          )}
        </div>

        {/* Cambiar estado */}
        {selectedAppt.status !== 'cancelled' && selectedAppt.status !== 'completed' && (
          <>
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Cambiar estado</div>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {[
                { status: 'confirmed', label: '✓ Confirmado' },
                { status: 'completed', label: 'Atendido' },
                { status: 'absent', label: 'Ausente' },
                { status: 'in_progress', label: 'En curso' },
              ].map(({ status, label }) => (
                <button key={status}
                  onClick={() => updateStatus(selectedAppt.id, status)}
                  className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors active:scale-95 ${selectedAppt.status === status
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-800 hover:bg-gray-700 text-gray-300'
                    }`}>
                  {label}
                </button>
              ))}
            </div>
          </>
        )}

        {/* Acciones */}
        <div className="space-y-2">
          <button
            onClick={() => router.push(`/dashboard/patients/${selectedAppt.patient_id}`)}
            className="w-full bg-gray-800 hover:bg-gray-700 active:scale-95 text-white py-2.5 rounded-xl text-sm font-medium transition-all">
            Ver ficha del paciente →
          </button>

          <button
            onClick={() => router.push(`/dashboard/patients/${selectedAppt.patient_id}/appointment`)}
            className="w-full bg-blue-900/40 hover:bg-blue-800/40 active:scale-95 text-blue-400 py-2.5 rounded-xl text-sm font-medium transition-all">
            Nuevo turno para este paciente
          </button>

          {selectedAppt.status !== 'cancelled' && selectedAppt.status !== 'completed' && (
            <button
              onClick={() => updateStatus(selectedAppt.id, 'cancelled')}
              className="w-full bg-red-900/20 hover:bg-red-900/40 active:scale-95 text-red-400 py-2.5 rounded-xl text-sm font-medium transition-all">
              Cancelar turno
            </button>
          )}
        </div>
      </div>
    </div>
  ) : null

  if (loading && appointments.length === 0) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-gray-400">Cargando...</div>
      </div>
    )
  }

  return (
    <div className="bg-gray-950 text-white flex flex-col h-[calc(100vh-57px)]">

      {/* ── MOBILE VIEW ── */}
      <div className="md:hidden flex flex-col h-full">
        {/* Selector de días */}
        <div className="border-b border-gray-800 px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-gray-300">
              {weekDates[0].toLocaleDateString('es-AR', { month: 'long', year: 'numeric', timeZone: 'America/Argentina/Buenos_Aires' })}
            </span>
            <WeekNav />
          </div>
          <div className="grid grid-cols-6 gap-1">
            {weekDates.map((d, i) => {
              const dateStr = formatDate(d)
              const isToday = dateStr === today
              const isSelected = dateStr === selectedDay
              const hasAppts = apptsByDay(dateStr).length > 0
              return (
                <button key={i}
                  onClick={() => setSelectedDay(dateStr)}
                  className="flex flex-col items-center gap-1 py-2 rounded-xl transition-colors"
                >
                  <span className="text-xs text-gray-500">{DAYS[i]}</span>
                  <span className={`w-8 h-8 flex items-center justify-center rounded-full text-sm font-bold transition-colors ${isSelected ? 'bg-blue-500 text-white' :
                    isToday ? 'border border-blue-400 text-blue-400' : 'text-white'
                    }`}>
                    {d.getDate()}
                  </span>
                  {hasAppts && (
                    <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-blue-400'}`} />
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Lista de turnos del día */}
        <div className="flex-1 overflow-y-auto p-4">
          {dayAppts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="text-4xl mb-3">📅</div>
              <div className="text-gray-400 font-medium">Sin turnos</div>
              <div className="text-gray-600 text-sm mt-1">
                {new Date(selectedDay + 'T12:00:00').toLocaleDateString('es-AR', {
                  weekday: 'long', day: 'numeric', month: 'long'
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {[...dayAppts].sort((a, b) =>
                new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
              ).map(appt => (
                <div key={appt.id}
                  onClick={() => setSelectedAppt(appt)}
                  className={`rounded-xl border-l-4 p-4 cursor-pointer active:scale-95 transition-transform ${STATUS_COLORS[appt.status] ?? STATUS_COLORS.pending}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-bold text-white truncate">{appt.patient_name}</div>
                      <div className="text-sm opacity-80 truncate">{appt.appointment_type ?? 'Consulta'}</div>
                      {appt.insurance_name && (
                        <div className="text-xs opacity-60 mt-1">{appt.insurance_name}</div>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-mono text-sm font-bold">
                        {new Date(appt.starts_at).toLocaleTimeString('es-AR', {
                          hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires'
                        })}
                      </div>
                      <div className="text-xs opacity-60 mt-0.5">{appt.duration_minutes} min</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── DESKTOP VIEW (semanal) ── */}
      <div className="hidden md:flex flex-col h-full overflow-hidden">
        <div className="px-6 py-3 border-b border-gray-800 flex items-center justify-between flex-shrink-0">
          <span className="text-sm text-gray-400">
            {weekDates[0].toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })} –{' '}
            {weekDates[5].toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
          <WeekNav />
        </div>

        <div className="grid flex-shrink-0 border-b border-gray-800"
          style={{ gridTemplateColumns: '48px repeat(6, 1fr)' }}>
          <div />
          {weekDates.map((d, i) => {
            const isToday = formatDate(d) === today
            return (
              <div key={i} className="py-3 text-center border-l border-gray-800">
                <div className="text-xs text-gray-500 uppercase tracking-wider">{DAYS[i]}</div>
                <div className={`text-lg font-bold mx-auto mt-0.5 w-8 h-8 flex items-center justify-center rounded-full ${isToday ? 'bg-blue-500 text-white' : ''
                  }`}>
                  {d.getDate()}
                </div>
              </div>
            )
          })}
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="grid" style={{ gridTemplateColumns: '48px repeat(6, 1fr)' }}>
            <div>
              {HOURS.map(h => (
                <div key={h} className="h-16 text-right pr-2 pt-1">
                  <span className="text-xs text-gray-600 font-mono">{h}</span>
                </div>
              ))}
            </div>
            {weekDates.map((d, dayIdx) => {
              const dateStr = formatDate(d)
              const isToday = dateStr === today
              const dayApts = apptsByDay(dateStr)
              return (
                <div key={dayIdx}
                  className={`relative border-l border-gray-800 ${isToday ? 'bg-blue-950/5' : ''}`}
                  style={{ height: `${HOURS.length * 64}px` }}>
                  {HOURS.map((_, i) => (
                    <div key={i} className="absolute w-full border-t border-gray-800/50"
                      style={{ top: i * 64 }} />
                  ))}
                  {dayApts.map(appt => (
                    <div key={appt.id}
                      onClick={() => setSelectedAppt(appt)}
                      className={`absolute left-1 right-1 rounded-md border-l-2 px-1.5 py-1 cursor-pointer hover:opacity-80 transition-opacity overflow-hidden ${STATUS_COLORS[appt.status] ?? STATUS_COLORS.pending}`}
                      style={{
                        top: getSlotTop(appt.starts_at),
                        height: getSlotHeight(appt.starts_at, appt.ends_at),
                      }}>
                      <div className="text-xs font-bold text-white truncate">{appt.patient_name}</div>
                      <div className="text-xs opacity-70 truncate">{appt.appointment_type}</div>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <button
        onClick={() => { setNewApptSlot({ date: selectedDay, time: '09:00' }); setShowNewAppt(true) }}
        className="fixed bottom-24 right-4 w-14 h-14 bg-blue-500 hover:bg-blue-600 rounded-full flex items-center justify-center text-2xl shadow-lg transition-colors z-30"
      >
        +
      </button>

      {showNewAppt && newApptSlot && (
        <NewAppointmentModal
          token={token}
          date={newApptSlot.date}
          time={newApptSlot.time}
          patients={patients}
          onClose={() => setShowNewAppt(false)}
          onCreated={async () => {
            setShowNewAppt(false)
            await fetchAppointments(token)
          }}
          onPatientCreated={(patient) => {
            setPatients((prev: any[]) => [patient, ...prev])
          }}
        />
      )}

      <ApptModal />
    </div>
  )
}

function NewAppointmentModal({ token, date, time, patients, onClose, onCreated, onPatientCreated }: {
  token: string
  date: string
  time: string
  patients: any[]
  onClose: () => void
  onCreated: () => void
  onPatientCreated: (patient: any) => void
}) {
  const [search, setSearch] = useState('')
  const [patientId, setPatientId] = useState('')
  const [newPatientMode, setNewPatientMode] = useState(false)
  const [newPatientName, setNewPatientName] = useState('')
  const [newPatientLastName, setNewPatientLastName] = useState('')
  const [newPatientPhone, setNewPatientPhone] = useState('')
  const [creatingPatient, setCreatingPatient] = useState(false)

  const [form, setForm] = useState({
    date, time, duration_minutes: '45', appointment_type: '', chief_complaint: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  const selectedPatient = patients.find(p => p.id === patientId)
  const filtered = patients.filter(p =>
    `${p.first_name} ${p.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
    p.phone.includes(search)
  ).slice(0, 5)

  const TIPOS = ['Consulta general', 'Limpieza', 'Endodoncia', 'Extracción', 'Blanqueamiento', 'Ortodoncia', 'Implante', 'Corona', 'Control', 'Urgencia']
  const DURACIONES = [
    { value: '30', label: '30m' },
    { value: '45', label: '45m' },
    { value: '60', label: '1h' },
    { value: '90', label: '1h30' },
  ]

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!patientId) { setError('Seleccioná un paciente'); return }
    setLoading(true)
    setError('')
    try {
      // Get professional id
      const me = await apiFetch('/auth/me', { token })
      const startsAt = `${form.date}T${form.time}:00-03:00`
      await apiFetch('/appointments', {
        method: 'POST',
        token,
        body: JSON.stringify({
          patient_id: patientId,
          professional_id: me.data.id,
          starts_at: startsAt,
          duration_minutes: Number(form.duration_minutes),
          appointment_type: form.appointment_type || undefined,
          chief_complaint: form.chief_complaint || undefined,
        })
      })
      onCreated()
    } catch (err: any) {
      setError(err.message)
      setLoading(false)
    }
  }

  async function handleCreatePatient() {
    if (!newPatientName) return
    setCreatingPatient(true)
    try {
      const data = await apiFetch('/patients', {
        method: 'POST',
        token,
        body: JSON.stringify({
          first_name: newPatientName,
          last_name: newPatientLastName || '.',
          phone: 'Sin teléfono',
        })
      })
      onPatientCreated(data.data)
      setPatientId(data.data.id)
      setNewPatientMode(false)
      setNewPatientName('')
      setNewPatientLastName('')
    } catch (err: any) {
      console.error(err)
    } finally {
      setCreatingPatient(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4"
      onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>
        <div className="p-6">
          <div className="w-9 h-1 bg-gray-700 rounded-full mx-auto mb-5 sm:hidden" />
          <h2 className="text-lg font-bold mb-5">Nuevo turno</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Paciente */}
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Paciente</label>
              {selectedPatient ? (
                <div className="flex items-center justify-between bg-gray-800 rounded-xl px-4 py-3">
                  <div className="font-medium">{selectedPatient.first_name} {selectedPatient.last_name}</div>
                  <button type="button" onClick={() => { setPatientId(''); setNewPatientMode(false) }}
                    className="text-gray-500 hover:text-white text-sm">✕</button>
                </div>
              ) : newPatientMode ? (
                <div className="bg-gray-800 rounded-xl p-3 border border-blue-800/50">
                  <div className="text-xs text-blue-400 font-semibold mb-2">Nuevo paciente rápido</div>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <input
                      type="text"
                      value={newPatientName}
                      onChange={e => setNewPatientName(e.target.value)}
                      placeholder="Nombre"
                      className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-400"
                    />
                    <input
                      type="text"
                      value={newPatientLastName}
                      onChange={e => setNewPatientLastName(e.target.value)}
                      placeholder="Apellido"
                      className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-400"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button type="button"
                      onClick={() => setNewPatientMode(false)}
                      className="flex-1 bg-gray-700 text-gray-400 text-xs font-semibold py-2 rounded-lg transition-colors">
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleCreatePatient}
                      disabled={!newPatientName || creatingPatient}
                      className="flex-1 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white text-xs font-semibold py-2 rounded-lg transition-colors">
                      {creatingPatient ? 'Creando...' : 'Crear y usar'}
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar por nombre o teléfono..."
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-blue-400 mb-2"
                    autoFocus />
                  {search && (
                    <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden mb-2">
                      {filtered.map(p => (
                        <div key={p.id}
                          onClick={() => { setPatientId(p.id); setSearch('') }}
                          className="px-4 py-3 hover:bg-gray-700 cursor-pointer text-sm border-b border-gray-700 last:border-0">
                          <span className="font-medium">{p.first_name} {p.last_name}</span>
                          <span className="text-gray-400 ml-2">{p.phone}</span>
                        </div>
                      ))}
                      {filtered.length === 0 && (
                        <div className="px-4 py-3 text-gray-500 text-sm">Sin resultados</div>
                      )}
                    </div>
                  )}
                  <button type="button"
                    onClick={() => setNewPatientMode(true)}
                    className="w-full bg-gray-800 hover:bg-gray-700 border border-dashed border-gray-600 text-gray-400 hover:text-white text-xs font-semibold py-2.5 rounded-xl transition-colors">
                    + Crear nuevo paciente
                  </button>
                </div>
              )}
            </div>

            {/* Fecha y hora */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Fecha</label>
                <input type="date" value={form.date} onChange={e => set('date', e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Hora</label>
                <input type="time" value={form.time} onChange={e => set('time', e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-400" />
              </div>
            </div>

            {/* Duración */}
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Duración</label>
              <div className="grid grid-cols-4 gap-2">
                {DURACIONES.map(d => (
                  <button key={d.value} type="button" onClick={() => set('duration_minutes', d.value)}
                    className={`py-2 rounded-xl text-sm font-semibold transition-colors ${form.duration_minutes === d.value
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-800 border border-gray-700 text-gray-400'
                      }`}>
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tipo */}
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Tipo de consulta</label>
              <div className="grid grid-cols-3 gap-2">
                {TIPOS.map(t => (
                  <button key={t} type="button" onClick={() => set('appointment_type', t)}
                    className={`py-2 px-2 rounded-xl text-xs font-medium transition-colors ${form.appointment_type === t
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-800 border border-gray-700 text-gray-400'
                      }`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Motivo */}
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Motivo (opcional)</label>
              <input type="text" value={form.chief_complaint} onChange={e => set('chief_complaint', e.target.value)}
                placeholder="Descripción..."
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-blue-400" />
            </div>

            {error && (
              <div className="p-3 bg-red-900/30 border border-red-700 rounded-xl text-red-400 text-sm">{error}</div>
            )}

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose}
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-white font-semibold py-3 rounded-xl transition-colors">
                Cancelar
              </button>
              <button type="submit" disabled={loading}
                className="flex-1 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors">
                {loading ? 'Agendando...' : 'Confirmar turno'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}