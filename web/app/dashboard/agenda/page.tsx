'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { apiFetch } from '@/lib/api'
import { useRouter } from 'next/navigation'

const HOURS = ['06:00', '07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00', '22:00', '23:00']
const DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

function getWeekDates(offset = 0) {
  const now = new Date()
  const day = now.getDay() === 0 ? 6 : now.getDay() - 1
  const monday = new Date(now)
  monday.setDate(now.getDate() - day + offset * 7)
  return Array.from({ length: 7 }, (_, i) => {
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
  const argTime = d.toLocaleTimeString('es-AR', {
    hour: '2-digit', minute: '2-digit', hour12: false,
    timeZone: 'America/Argentina/Buenos_Aires'
  })
  const [h, m] = argTime.split(':').map(Number)
  const startHour = 6
  return Math.max(0, (h - startHour) * 64 + (m / 60) * 64)
}

function getSlotHeight(startsAt: string, endsAt: string): number {
  const diff = (new Date(endsAt).getTime() - new Date(startsAt).getTime()) / 60000
  return Math.max(32, (diff / 60) * 64)
}

const STATUS_COLORS: Record<string, string> = {
  pending:     'border-l-amber-400 bg-amber-400/15 text-amber-900 dark:text-amber-200',
  confirmed:   'border-l-emerald-400 bg-emerald-400/15 text-emerald-900 dark:text-emerald-200',
  completed:   'border-l-emerald-400 bg-emerald-400/15 text-emerald-900 dark:text-emerald-200',
  absent:      'border-l-red-400 bg-red-400/15 text-red-900 dark:text-red-200',
  cancelled:   'border-l-gray-400 bg-gray-400/10 text-gray-500 dark:text-gray-400',
  in_progress: 'border-l-purple-400 bg-purple-400/15 text-purple-900 dark:text-purple-200',
}

export default function AgendaPage() {
  const [appointments, setAppointments] = useState<any[]>([])
  const [blocks, setBlocks]             = useState<any[]>([])
  const [loading, setLoading]           = useState(true)
  const [token, setToken]               = useState('')
  const [userId, setUserId]             = useState('')
  const [linkCopied, setLinkCopied]     = useState(false)
  const [weekOffset, setWeekOffset]     = useState(0)
  const [selectedDay, setSelectedDay]   = useState(todayArg())
  const [selectedAppt, setSelectedAppt] = useState<any>(null)
  const [showNewAppt, setShowNewAppt]   = useState(false)
  const [newApptSlot, setNewApptSlot]   = useState<{ date: string; time: string } | null>(null)
  const [patients, setPatients]         = useState<any[]>([])
  const [professionals, setProfessionals] = useState<any[]>([])
  const [selectedProfId, setSelectedProfId] = useState('')
  const [editingAppt, setEditingAppt]   = useState<any>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [showNewBlock, setShowNewBlock] = useState(false)
  const [newBlockDate, setNewBlockDate] = useState<string | null>(null)
  const [selectedBlock, setSelectedBlock] = useState<any>(null)
  const router   = useRouter()
  const supabase = createClient()

  const weekDates = getWeekDates(weekOffset)
  const from = formatDate(weekDates[0])
  const to   = formatDate(weekDates[6])

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/'); return }
      setToken(session.access_token)
      const meData = await apiFetch('/auth/me', { token: session.access_token })
      setUserId(meData.data.id)
      const [_, pData, profData] = await Promise.all([
        fetchAll(session.access_token),
        apiFetch('/patients?limit=100', { token: session.access_token }),
        apiFetch('/professionals', { token: session.access_token }),
      ])
      setPatients(pData.data ?? [])
      setProfessionals(profData.data ?? [])
      setLoading(false)
    }
    load()
  }, [weekOffset])

  async function fetchAll(t: string) {
    setLoading(true)
    const [apptData, blockData] = await Promise.all([
      apiFetch(`/appointments?from=${from}&to=${to}`, { token: t }),
      apiFetch(`/schedule-blocks?from=${from}&to=${to}`, { token: t }),
    ])
    setAppointments(apptData.data ?? [])
    setBlocks(blockData.data ?? [])
    setLoading(false)
  }

  async function fetchAppointments(t: string) {
    return fetchAll(t)
  }

  async function updateStatus(id: string, status: string) {
    await apiFetch(`/appointments/${id}`, {
      method: 'PATCH', token,
      body: JSON.stringify({ status })
    })
    await fetchAll(token)
    setSelectedAppt(null)
  }

  async function deleteAppt(id: string) {
    await apiFetch(`/appointments/${id}`, {
      method: 'PATCH', token,
      body: JSON.stringify({ status: 'cancelled' })
    })
    setAppointments(prev => prev.filter(a => a.id !== id))
    setSelectedAppt(null)
    setConfirmDelete(null)
  }

  async function deleteBlock(id: string) {
    await apiFetch(`/schedule-blocks/${id}`, { method: 'DELETE', token })
    setBlocks(prev => prev.filter(b => b.id !== id))
    setSelectedBlock(null)
  }

  const today = todayArg()

  const dayAppts = appointments.filter(a => {
    const d = new Date(a.starts_at).toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
    return d === selectedDay && a.status !== 'cancelled' && (!selectedProfId || a.professional_id === selectedProfId)
  })

  const dayBlocks = blocks.filter(b => {
    const d = new Date(b.starts_at).toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
    return d === selectedDay && (!selectedProfId || b.professional_id === selectedProfId)
  })

  function apptsByDay(dateStr: string) {
    return appointments.filter(a => {
      const d = new Date(a.starts_at).toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
      return d === dateStr && a.status !== 'cancelled' && (!selectedProfId || a.professional_id === selectedProfId)
    })
  }

  function blocksByDay(dateStr: string) {
    return blocks.filter(b => {
      const d = new Date(b.starts_at).toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
      return d === dateStr && (!selectedProfId || b.professional_id === selectedProfId)
    })
  }

  const WeekNav = () => (
    <div className="flex items-center gap-2">
      <button onClick={() => setWeekOffset(w => w - 1)}
        className="bg-surface2 hover:bg-surface3 px-3 py-1.5 rounded-lg text-sm transition-colors">←</button>
      <button onClick={() => { setWeekOffset(0); setSelectedDay(today) }}
        className="bg-surface2 hover:bg-surface3 px-3 py-1.5 rounded-lg text-sm transition-colors">Hoy</button>
      <button onClick={() => setWeekOffset(w => w + 1)}
        className="bg-surface2 hover:bg-surface3 px-3 py-1.5 rounded-lg text-sm transition-colors">→</button>
    </div>
  )

  const ApptModal = () => selectedAppt ? (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4"
      onClick={() => setSelectedAppt(null)}>
      <div className="bg-surface border border-app rounded-2xl w-full max-w-sm p-6"
        onClick={e => e.stopPropagation()}>
        <div className="w-9 h-1 bg-surface3 rounded-full mx-auto mb-5 sm:hidden" />
        <div className="mb-5">
          <div className="font-bold text-lg text-app">{selectedAppt.patient_name}</div>
          <div className="text-app2 text-sm">{selectedAppt.appointment_type ?? 'Consulta'}</div>
          <div className="text-app3 text-sm mt-1">
            {new Date(selectedAppt.starts_at).toLocaleString('es-AR', {
              weekday: 'short', day: 'numeric', month: 'short',
              hour: '2-digit', minute: '2-digit',
              timeZone: 'America/Argentina/Buenos_Aires'
            })}
          </div>
          {selectedAppt.insurance_name && (
            <div className="text-app3 text-xs mt-1">{selectedAppt.insurance_name}</div>
          )}
          {selectedAppt.chief_complaint && (
            <div className="mt-3 bg-surface2 rounded-xl px-3 py-2.5 border-l-2 border-amber-400">
              <div className="text-xs text-app3 uppercase tracking-wider mb-1">Motivo de consulta</div>
              <div className="text-sm text-app2">{selectedAppt.chief_complaint}</div>
            </div>
          )}
        </div>

        {selectedAppt.status !== 'cancelled' && selectedAppt.status !== 'completed' && (
          <>
            <div className="text-xs text-app3 uppercase tracking-wider mb-2">Cambiar estado</div>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {[
                { status: 'confirmed',   label: '✓ Confirmado' },
                { status: 'completed',   label: 'Atendido' },
                { status: 'absent',      label: 'Ausente' },
                { status: 'in_progress', label: 'En curso' },
              ].map(({ status, label }) => (
                <button key={status}
                  onClick={() => updateStatus(selectedAppt.id, status)}
                  className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors active:scale-95 ${
                    selectedAppt.status === status
                      ? 'bg-emerald-500 text-white'
                      : 'bg-surface2 hover:bg-surface3 text-app2 border border-app'
                  }`}>
                  {label}
                </button>
              ))}
            </div>
          </>
        )}

        <div className="space-y-2">
          <button onClick={() => router.push(`/dashboard/patients/${selectedAppt.patient_id}`)}
            className="w-full bg-surface2 hover:bg-surface3 border border-app active:scale-95 text-app py-2.5 rounded-xl text-sm font-medium transition-all">
            Ver ficha del paciente →
          </button>
          <button onClick={() => router.push(`/dashboard/patients/${selectedAppt.patient_id}/appointment`)}
            className="w-full bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 active:scale-95 text-emerald-600 dark:text-emerald-400 py-2.5 rounded-xl text-sm font-medium transition-all">
            Nuevo turno para este paciente
          </button>
          {selectedAppt.status !== 'cancelled' && selectedAppt.status !== 'completed' && (
            <button onClick={() => { setEditingAppt(selectedAppt); setSelectedAppt(null) }}
              className="w-full bg-surface2 hover:bg-surface3 border border-app active:scale-95 text-app2 py-2.5 rounded-xl text-sm font-medium transition-all">
              ✏️ Editar turno
            </button>
          )}
          <button onClick={() => { setConfirmDelete(selectedAppt.id); setSelectedAppt(null) }}
            className="w-full bg-red-500/15 hover:bg-red-500/25 border border-red-500/40 active:scale-95 text-red-600 dark:text-red-400 py-2.5 rounded-xl text-sm font-medium transition-all">
            🗑 Eliminar turno
          </button>
        </div>
      </div>
    </div>
  ) : null

  if (loading && appointments.length === 0) {
    return (
      <div className="bg-app text-app flex flex-col h-[calc(100vh-57px)] animate-pulse">
        {/* Week nav skeleton */}
        <div className="border-b border-app px-4 py-2">
          <div className="flex items-center justify-between mb-2">
            <div className="h-4 bg-surface2 rounded w-32" />
            <div className="flex gap-2">
              <div className="h-7 w-7 bg-surface2 rounded-lg" />
              <div className="h-7 w-7 bg-surface2 rounded-lg" />
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1">
            {[...Array(7)].map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-1 py-1">
                <div className="h-3 bg-surface2 rounded w-6" />
                <div className="h-8 w-8 bg-surface2 rounded-full" />
              </div>
            ))}
          </div>
        </div>
        {/* Time grid skeleton */}
        <div className="flex-1 overflow-hidden relative">
          <div className="flex h-full">
            <div className="w-14 flex-shrink-0 border-r border-app flex flex-col">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-16 flex items-start pt-1 px-2">
                  <div className="h-3 bg-surface2 rounded w-8" />
                </div>
              ))}
            </div>
            <div className="flex-1 grid grid-cols-7">
              {[...Array(7)].map((_, col) => (
                <div key={col} className="border-r border-app last:border-r-0">
                  {[...Array(8)].map((_, row) => (
                    <div key={row} className="h-16 border-b border-app/40" />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-app text-app flex flex-col h-[calc(100vh-57px)]">

      {/* ── MOBILE VIEW ── */}
      <div className="md:hidden flex flex-col h-full">
        <div className="border-b border-app px-4 py-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-app2">
              {weekDates[0].toLocaleDateString('es-AR', { month: 'long', year: 'numeric', timeZone: 'America/Argentina/Buenos_Aires' })}
            </span>
            <WeekNav />
          </div>
          {professionals.length > 1 && (
            <div className="mb-2">
              <select
                value={selectedProfId}
                onChange={e => setSelectedProfId(e.target.value)}
                className="w-full bg-surface2 border border-app rounded-xl px-3 py-2 text-app text-sm focus:outline-none focus:border-emerald-400"
              >
                <option value="">Todos los profesionales</option>
                {professionals.map(p => (
                  <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>
                ))}
              </select>
            </div>
          )}
          <div className="grid grid-cols-7 gap-0">
            {weekDates.map((d, i) => {
              const dateStr    = formatDate(d)
              const isToday    = dateStr === today
              const isSelected = dateStr === selectedDay
              const hasAppts   = apptsByDay(dateStr).length > 0
              const hasBlocks  = blocksByDay(dateStr).length > 0
              return (
                <button key={i} onClick={() => setSelectedDay(dateStr)}
                  className="flex flex-col items-center gap-0.5 py-1 rounded-xl transition-colors">
                  <span className="text-[10px] text-app3">{DAYS[i]}</span>
                  <span className={`w-7 h-7 flex items-center justify-center rounded-full text-sm font-bold transition-colors ${
                    isSelected ? 'bg-emerald-500 text-white' :
                    isToday ? 'border border-emerald-400 text-emerald-400' : 'text-app'
                  }`}>
                    {d.getDate()}
                  </span>
                  <div className="flex gap-0.5">
                    {hasAppts && <span className={`w-1 h-1 rounded-full ${isSelected ? 'bg-white' : 'bg-emerald-400'}`} />}
                    {hasBlocks && <span className={`w-1 h-1 rounded-full ${isSelected ? 'bg-white' : 'bg-slate-400'}`} />}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {dayBlocks.length === 0 && dayAppts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="text-4xl mb-3">📅</div>
              <div className="text-app2 font-medium">Sin turnos</div>
              <div className="text-app3 text-sm mt-1">
                {new Date(selectedDay + 'T12:00:00').toLocaleDateString('es-AR', {
                  weekday: 'long', day: 'numeric', month: 'long'
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {dayBlocks.map(block => (
                <div key={block.id} onClick={() => setSelectedBlock(block)}
                  className="rounded-xl border-l-4 border-l-slate-400 bg-slate-400/10 p-4 cursor-pointer active:scale-95 transition-transform">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-bold text-slate-600 dark:text-slate-300 truncate">🔒 Bloqueado</div>
                      {block.reason && <div className="text-sm text-slate-500 truncate">{block.reason}</div>}
                    </div>
                    <div className="text-right flex-shrink-0 font-mono text-sm font-bold text-slate-500">
                      {new Date(block.starts_at).toLocaleTimeString('es-AR', {
                        hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires'
                      })}
                      {' – '}
                      {new Date(block.ends_at).toLocaleTimeString('es-AR', {
                        hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires'
                      })}
                    </div>
                  </div>
                </div>
              ))}
              {[...dayAppts].sort((a, b) =>
                new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
              ).map(appt => (
                <div key={appt.id} onClick={() => setSelectedAppt(appt)}
                  className={`rounded-xl border-l-4 p-4 cursor-pointer active:scale-95 transition-transform ${STATUS_COLORS[appt.status] ?? STATUS_COLORS.pending}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-bold text-app truncate">{appt.patient_name}</div>
                      <div className="text-sm opacity-80 truncate">{appt.appointment_type ?? 'Consulta'}</div>
                      {appt.professional_name && <div className="text-xs opacity-60 mt-0.5">{appt.professional_name}</div>}
                      {appt.insurance_name && <div className="text-xs opacity-60 mt-1">{appt.insurance_name}</div>}
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

      {/* ── DESKTOP VIEW ── */}
      <div className="hidden md:flex flex-col flex-1 overflow-hidden">
        {/* Barra superior con navegación */}
        <div className="px-6 py-2 border-b border-app flex items-center justify-between flex-shrink-0">
          <span className="text-sm text-app2">
            {weekDates[0].toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })} –{' '}
            {weekDates[6].toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
          <div className="flex items-center gap-3">
            {professionals.length > 1 && (
              <select
                value={selectedProfId}
                onChange={e => setSelectedProfId(e.target.value)}
                className="bg-surface2 border border-app rounded-lg px-3 py-1.5 text-app text-sm focus:outline-none focus:border-emerald-400"
              >
                <option value="">Todos los profesionales</option>
                {professionals.map(p => (
                  <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>
                ))}
              </select>
            )}
            <button
              onClick={() => { setNewBlockDate(selectedDay); setShowNewBlock(true) }}
              className="flex items-center gap-1.5 bg-slate-500/10 hover:bg-slate-500/20 border border-slate-500/30 text-slate-600 dark:text-slate-300 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors">
              🔒 Bloquear horario
            </button>
            <button
              onClick={() => {
                const link = `${window.location.origin}/booking/${userId}`
                navigator.clipboard.writeText(link)
                setLinkCopied(true)
                setTimeout(() => setLinkCopied(false), 2000)
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                linkCopied
                  ? 'bg-emerald-500/20 border border-emerald-500/50 text-emerald-600 dark:text-emerald-300'
                  : 'bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-600 dark:text-emerald-300'
              }`}>
              {linkCopied ? '✓ Copiado' : '📋 Link de agenda'}
            </button>
            <WeekNav />
          </div>
        </div>

        {/* Contenedor scroll — header sticky + grid body */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          {/* Header días sticky */}
          <div className="grid sticky top-0 z-20 bg-app border-b border-app"
            style={{ gridTemplateColumns: '48px repeat(7, 1fr)' }}>
            <div />
            {weekDates.map((d, i) => {
              const isToday = formatDate(d) === today
              return (
                <div key={i} className="py-2 text-center border-l border-gray-200 dark:border-gray-800">
                  <div className="text-[10px] text-app3 uppercase tracking-wider">{DAYS[i]}</div>
                  <div className={`text-base font-bold mx-auto w-7 h-7 flex items-center justify-center rounded-full ${
                    isToday ? 'bg-emerald-500 text-white' : 'text-app'
                  }`}>
                    {d.getDate()}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Grid body */}
          <div className="grid" style={{ gridTemplateColumns: '48px repeat(7, 1fr)' }}>
            {/* Columna horas */}
            <div>
              {HOURS.map(h => (
                <div key={h} className="h-16 relative border-t border-app/20">
                  <span className="absolute top-1 right-2 text-xs text-app3">{h}</span>
                </div>
              ))}
            </div>

            {/* Columnas días */}
            {weekDates.map((d, dayIdx) => {
              const dateStr = formatDate(d)
              const isToday = dateStr === today
              const dayApts = apptsByDay(dateStr)
              const dayBlks = blocksByDay(dateStr)
              return (
                <div key={dayIdx}
                  className={`relative border-l border-gray-200 dark:border-gray-800 ${isToday ? 'bg-emerald-500/5' : ''}`}
                  style={{ minHeight: `${HOURS.length * 64}px` }}
                  onClick={(e) => {
                    if (e.target === e.currentTarget) {
                      const rect = e.currentTarget.getBoundingClientRect()
                      const y = e.clientY - rect.top
                      const hourIndex = Math.floor(y / 64)
                      const hour = 6 + hourIndex
                      setNewApptSlot({ date: dateStr, time: `${String(hour).padStart(2, '0')}:00` })
                      setShowNewAppt(true)
                    }
                  }}>
                  {HOURS.map((_, i) => (
                    <div key={i} className="absolute w-full border-t border-gray-200 dark:border-gray-800"
                      style={{ top: i * 64 }} />
                  ))}
                  {/* Schedule blocks */}
                  {dayBlks.map(block => (
                    <div key={block.id}
                      onClick={() => setSelectedBlock(block)}
                      className="absolute left-1 right-1 rounded-md border-l-4 border-l-slate-400 bg-slate-400/20 dark:bg-slate-600/25 px-1.5 py-1 cursor-pointer hover:opacity-80 transition-opacity overflow-hidden"
                      style={{
                        top:    getSlotTop(block.starts_at),
                        height: getSlotHeight(block.starts_at, block.ends_at),
                        backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(100,116,139,0.1) 4px, rgba(100,116,139,0.1) 8px)',
                      }}>
                      <div className="text-xs font-bold text-slate-600 dark:text-slate-300 truncate">🔒 Bloqueado</div>
                      {block.reason && <div className="text-xs text-slate-500 truncate opacity-80">{block.reason}</div>}
                    </div>
                  ))}
                  {/* Appointments */}
                  {dayApts.map(appt => (
                    <div key={appt.id}
                      onClick={() => setSelectedAppt(appt)}
                      className={`absolute left-1 right-1 rounded-md border-l-4 px-1.5 py-0.5 cursor-pointer hover:opacity-80 transition-opacity overflow-hidden ${STATUS_COLORS[appt.status] ?? STATUS_COLORS.pending}`}
                      style={{
                        top:    getSlotTop(appt.starts_at),
                        height: getSlotHeight(appt.starts_at, appt.ends_at),
                      }}>
                      <div className="text-xs font-bold leading-tight truncate">{appt.patient_name}</div>
                      <div className="text-[10px] leading-tight opacity-70 truncate">{[appt.appointment_type, appt.professional_name].filter(Boolean).join(' · ')}</div>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* FABs */}
      <button
        onClick={() => { setNewApptSlot({ date: selectedDay, time: '09:00' }); setShowNewAppt(true) }}
        className="fixed bottom-24 right-6 md:bottom-6 md:right-6 w-14 h-14 bg-emerald-500 hover:bg-emerald-600 rounded-full flex items-center justify-center text-2xl shadow-lg transition-colors z-30"
      >
        +
      </button>
      <button
        onClick={() => { setNewBlockDate(selectedDay); setShowNewBlock(true) }}
        className="md:hidden fixed bottom-24 right-24 w-12 h-12 bg-slate-500 hover:bg-slate-600 rounded-full flex items-center justify-center text-lg shadow-lg transition-colors z-30"
        title="Bloquear horario"
      >
        🔒
      </button>
      <button
        onClick={() => {
          const link = `${window.location.origin}/booking/${userId}`
          navigator.clipboard.writeText(link)
          setLinkCopied(true)
          setTimeout(() => setLinkCopied(false), 2000)
        }}
        className={`md:hidden fixed bottom-24 right-40 w-12 h-12 rounded-full flex items-center justify-center text-lg shadow-lg transition-all z-30 font-medium ${
          linkCopied
            ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
            : 'bg-emerald-500 hover:bg-emerald-600 text-white'
        }`}
        title="Copiar link de agenda"
      >
        {linkCopied ? '✓' : '📋'}
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
            await fetchAll(token)
          }}
          onPatientCreated={(patient) => {
            setPatients((prev: any[]) => [patient, ...prev])
          }}
        />
      )}

      {showNewBlock && (
        <BlockModal
          token={token}
          defaultDate={newBlockDate ?? selectedDay}
          onClose={() => setShowNewBlock(false)}
          onCreated={async () => {
            setShowNewBlock(false)
            await fetchAll(token)
          }}
        />
      )}

      {selectedBlock && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedBlock(null)}>
          <div className="bg-surface border border-app rounded-2xl w-full max-w-sm p-6"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-slate-400/20 flex items-center justify-center text-xl">🔒</div>
              <div>
                <div className="font-bold text-app">Horario bloqueado</div>
                <div className="text-sm text-app3">
                  {new Date(selectedBlock.starts_at).toLocaleString('es-AR', {
                    weekday: 'short', day: 'numeric', month: 'short',
                    hour: '2-digit', minute: '2-digit',
                    timeZone: 'America/Argentina/Buenos_Aires'
                  })}
                  {' – '}
                  {new Date(selectedBlock.ends_at).toLocaleTimeString('es-AR', {
                    hour: '2-digit', minute: '2-digit',
                    timeZone: 'America/Argentina/Buenos_Aires'
                  })}
                </div>
              </div>
            </div>
            {selectedBlock.reason && (
              <div className="mb-4 bg-surface2 rounded-xl px-3 py-2.5 border-l-2 border-slate-400">
                <div className="text-xs text-app3 uppercase tracking-wider mb-1">Motivo</div>
                <div className="text-sm text-app2">{selectedBlock.reason}</div>
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={() => setSelectedBlock(null)}
                className="flex-1 bg-surface2 hover:bg-surface3 border border-app text-app font-semibold py-3 rounded-xl transition-colors">
                Cerrar
              </button>
              <button onClick={() => deleteBlock(selectedBlock.id)}
                className="flex-1 bg-red-500/15 hover:bg-red-500/25 border border-red-500/40 text-red-600 dark:text-red-400 font-semibold py-3 rounded-xl transition-colors">
                🗑 Eliminar bloqueo
              </button>
            </div>
          </div>
        </div>
      )}

      {editingAppt && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4"
          onClick={() => setEditingAppt(null)}>
          <div className="bg-surface border border-app rounded-2xl w-full max-w-sm p-6"
            onClick={e => e.stopPropagation()}>
            <div className="w-9 h-1 bg-surface3 rounded-full mx-auto mb-5 sm:hidden" />
            <h3 className="font-bold text-lg text-app mb-4">Editar turno</h3>
            <form
              onSubmit={async (e) => {
                e.preventDefault()
                const date = (document.getElementById('edit-date') as HTMLInputElement).value
                const time = (document.getElementById('edit-time') as HTMLInputElement).value
                const type = (document.getElementById('edit-type') as HTMLInputElement).value
                const startsAt = `${date}T${time}:00-03:00`
                const endsAt = new Date(new Date(startsAt).getTime() + editingAppt.duration_minutes * 60000).toISOString()
                await apiFetch(`/appointments/${editingAppt.id}`, {
                  method: 'PATCH', token,
                  body: JSON.stringify({ starts_at: startsAt, ends_at: endsAt, appointment_type: type || undefined })
                })
                await fetchAll(token)
                setEditingAppt(null)
              }}
              className="space-y-3"
            >
              <div>
                <label className="block text-xs font-semibold text-app3 uppercase tracking-wider mb-1">Fecha</label>
                <input type="date" id="edit-date"
                  defaultValue={new Date(editingAppt.starts_at).toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })}
                  className="w-full bg-surface2 border border-app rounded-xl px-3 py-2.5 text-app text-sm focus:outline-none focus:border-emerald-400" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-app3 uppercase tracking-wider mb-1">Hora</label>
                <input type="time" id="edit-time"
                  defaultValue={(() => {
                    const d = new Date(editingAppt.starts_at)
                    return d.toLocaleString('en-CA', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Argentina/Buenos_Aires' })
                  })()}
                  className="w-full bg-surface2 border border-app rounded-xl px-3 py-2.5 text-app text-sm focus:outline-none focus:border-emerald-400" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-app3 uppercase tracking-wider mb-1">Tipo de consulta</label>
                <input type="text" id="edit-type"
                  defaultValue={editingAppt.appointment_type ?? ''}
                  className="w-full bg-surface2 border border-app rounded-xl px-3 py-2.5 text-app text-sm focus:outline-none focus:border-emerald-400" />
              </div>
              <div className="flex gap-3 mt-5">
                <button type="button" onClick={() => setEditingAppt(null)}
                  className="flex-1 bg-surface2 hover:bg-surface3 border border-app text-app font-semibold py-3 rounded-xl transition-colors">
                  Cancelar
                </button>
                <button type="submit"
                  className="flex-1 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white font-semibold py-3 rounded-xl transition-all">
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-app rounded-2xl w-full max-w-sm p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">🗑</span>
            </div>
            <h3 className="font-bold text-lg text-app mb-2">Eliminar turno</h3>
            <p className="text-app2 text-sm mb-6">Esta acción no se puede deshacer.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)}
                className="flex-1 bg-surface2 hover:bg-surface3 active:scale-95 text-app font-semibold py-3 rounded-xl transition-all">
                Cancelar
              </button>
              <button onClick={() => deleteAppt(confirmDelete)}
                className="flex-1 bg-red-600 hover:bg-red-500 active:scale-95 text-white font-bold py-3 rounded-xl transition-all">
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      <ApptModal />
    </div>
  )
}

function BlockModal({ token, defaultDate, onClose, onCreated }: {
  token: string
  defaultDate: string
  onClose: () => void
  onCreated: () => void
}) {
  const [date, setDate]       = useState(defaultDate)
  const [allDay, setAllDay]   = useState(false)
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime]     = useState('10:00')
  const [reason, setReason]   = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const startsAt = allDay
      ? `${date}T00:00:00-03:00`
      : `${date}T${startTime}:00-03:00`
    const endsAt = allDay
      ? `${date}T23:59:59-03:00`
      : `${date}T${endTime}:00-03:00`

    if (new Date(endsAt) <= new Date(startsAt)) {
      setError('La hora de fin debe ser posterior a la de inicio.')
      return
    }

    setLoading(true)
    try {
      await apiFetch('/schedule-blocks', {
        method: 'POST', token,
        body: JSON.stringify({ starts_at: startsAt, ends_at: endsAt, reason: reason || undefined }),
      })
      onCreated()
    } catch (err: any) {
      setError(err.message ?? 'Error al crear el bloqueo.')
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4"
      onClick={onClose}>
      <div className="bg-surface border border-app rounded-2xl w-full max-w-sm max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>
        <div className="p-6">
        <div className="w-9 h-1 bg-surface3 rounded-full mx-auto mb-5 sm:hidden" />
        <div className="flex items-center gap-2 mb-5">
          <span className="text-xl">🔒</span>
          <h2 className="text-lg font-bold text-app">Bloquear horario</h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-app3 uppercase tracking-wider mb-1">Fecha</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="w-full bg-surface2 border border-app rounded-xl px-3 py-2.5 text-app text-sm focus:outline-none focus:border-slate-400" />
          </div>

          <div className="flex items-center gap-3">
            <button type="button"
              onClick={() => setAllDay(v => !v)}
              className={`relative w-11 h-6 rounded-full transition-colors ${allDay ? 'bg-slate-500' : 'bg-surface3'}`}>
              <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${allDay ? 'left-5' : 'left-0.5'}`} />
            </button>
            <span className="text-sm text-app2">Todo el día</span>
          </div>

          {!allDay && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-app3 uppercase tracking-wider mb-1">Desde</label>
                <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)}
                  className="w-full bg-surface2 border border-app rounded-xl px-3 py-2.5 text-app text-sm focus:outline-none focus:border-slate-400" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-app3 uppercase tracking-wider mb-1">Hasta</label>
                <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)}
                  className="w-full bg-surface2 border border-app rounded-xl px-3 py-2.5 text-app text-sm focus:outline-none focus:border-slate-400" />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-app3 uppercase tracking-wider mb-1">
              Motivo <span className="text-app3 font-normal normal-case">(opcional)</span>
            </label>
            <input type="text" value={reason} onChange={e => setReason(e.target.value)}
              placeholder="Ej: Congreso, Vacaciones..."
              className="w-full bg-surface2 border border-app rounded-xl px-3 py-2.5 text-app text-sm focus:outline-none focus:border-slate-400" />
          </div>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-600 dark:text-red-400 text-sm">{error}</div>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 bg-surface2 hover:bg-surface3 border border-app text-app font-semibold py-3 rounded-xl transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 bg-slate-600 hover:bg-slate-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors">
              {loading ? 'Bloqueando...' : 'Bloquear'}
            </button>
          </div>
        </form>
        </div>
      </div>
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
  const [search, setSearch]               = useState('')
  const [patientId, setPatientId]         = useState('')
  const [newPatientMode, setNewPatientMode] = useState(false)
  const [newPatientName, setNewPatientName] = useState('')
  const [newPatientLastName, setNewPatientLastName] = useState('')
  const [creatingPatient, setCreatingPatient] = useState(false)
  const [form, setForm] = useState({
    date, time, duration_minutes: '45', appointment_type: '', chief_complaint: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  const selectedPatient = patients.find(p => p.id === patientId)
  const filtered = patients.filter(p =>
    `${p.first_name} ${p.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
    (p.phone ?? '').includes(search)
  ).slice(0, 5)

const TIPOS = ['Consulta', 'Limpieza', 'Endodoncia', 'Exodoncia', 'Ortodoncia', 'Implante', 'Operatoria', 'Prótesis', 'Blanqueamiento', 'Urgencia', 'Control', 'Armonizacion facial', 'Otro']
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
      const me = await apiFetch('/auth/me', { token })
      const startsAt = `${form.date}T${form.time}:00-03:00`
      await apiFetch('/appointments', {
        method: 'POST', token,
        body: JSON.stringify({
          patient_id:       patientId,
          professional_id:  me.data.id,
          starts_at:        startsAt,
          duration_minutes: Number(form.duration_minutes),
          appointment_type: form.appointment_type || undefined,
          chief_complaint:  form.chief_complaint  || undefined,
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
        method: 'POST', token,
        body: JSON.stringify({
          first_name: newPatientName,
          last_name:  newPatientLastName || '.',
          phone:      'Sin teléfono',
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
      <div className="bg-surface border border-app rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>
        <div className="p-6">
          <div className="w-9 h-1 bg-surface3 rounded-full mx-auto mb-5 sm:hidden" />
          <h2 className="text-lg font-bold text-app mb-5">Nuevo turno</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-app3 uppercase tracking-wider mb-2">Paciente</label>
              {selectedPatient ? (
                <div className="flex items-center justify-between bg-surface2 rounded-xl px-4 py-3">
                  <div className="font-medium text-app">{selectedPatient.first_name} {selectedPatient.last_name}</div>
                  <button type="button" onClick={() => { setPatientId(''); setNewPatientMode(false) }}
                    className="text-app3 hover:text-app text-sm">✕</button>
                </div>
              ) : newPatientMode ? (
                <div className="bg-surface2 rounded-xl p-3 border border-emerald-500/30">
                  <div className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold mb-2">Nuevo paciente rápido</div>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <input type="text" value={newPatientName} onChange={e => setNewPatientName(e.target.value)}
                      placeholder="Nombre"
                      className="bg-surface3 border border-app rounded-lg px-3 py-2 text-app text-sm focus:outline-none focus:border-emerald-400" />
                    <input type="text" value={newPatientLastName} onChange={e => setNewPatientLastName(e.target.value)}
                      placeholder="Apellido"
                      className="bg-surface3 border border-app rounded-lg px-3 py-2 text-app text-sm focus:outline-none focus:border-emerald-400" />
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setNewPatientMode(false)}
                      className="flex-1 bg-surface3 text-app2 text-xs font-semibold py-2 rounded-lg transition-colors">
                      Cancelar
                    </button>
                    <button type="button" onClick={handleCreatePatient}
                      disabled={!newPatientName || creatingPatient}
                      className="flex-1 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-xs font-semibold py-2 rounded-lg transition-colors">
                      {creatingPatient ? 'Creando...' : 'Crear y usar'}
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar por nombre o teléfono..."
                    className="w-full bg-surface2 border border-app rounded-xl px-4 py-3 text-app text-sm focus:outline-none focus:border-emerald-400 mb-2"
                    autoFocus />
                  {search && (
                    <div className="bg-surface2 border border-app rounded-xl overflow-hidden mb-2">
                      {filtered.map(p => (
                        <div key={p.id} onClick={() => { setPatientId(p.id); setSearch('') }}
                          className="px-4 py-3 hover:bg-surface3 cursor-pointer text-sm border-b border-app last:border-0 text-app">
                          <span className="font-medium">{p.first_name} {p.last_name}</span>
                          <span className="text-app2 ml-2">{p.phone}</span>
                        </div>
                      ))}
                      {filtered.length === 0 && <div className="px-4 py-3 text-app3 text-sm">Sin resultados</div>}
                    </div>
                  )}
                  <button type="button" onClick={() => setNewPatientMode(true)}
                    className="w-full bg-surface2 hover:bg-surface3 border border-dashed border-app2 text-app2 hover:text-app text-xs font-semibold py-2.5 rounded-xl transition-colors">
                    + Crear nuevo paciente
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-app3 uppercase tracking-wider mb-2">Fecha</label>
                <input type="date" value={form.date} onChange={e => set('date', e.target.value)}
                  className="w-full bg-surface2 border border-app rounded-xl px-3 py-2.5 text-app text-sm focus:outline-none focus:border-emerald-400" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-app3 uppercase tracking-wider mb-2">Hora</label>
                <input type="time" value={form.time} onChange={e => set('time', e.target.value)}
                  className="w-full bg-surface2 border border-app rounded-xl px-3 py-2.5 text-app text-sm focus:outline-none focus:border-emerald-400" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-app3 uppercase tracking-wider mb-2">Duración</label>
              <div className="grid grid-cols-4 gap-2">
                {DURACIONES.map(d => (
                  <button key={d.value} type="button" onClick={() => set('duration_minutes', d.value)}
                    className={`py-2 rounded-xl text-sm font-semibold transition-colors ${
                      form.duration_minutes === d.value
                        ? 'bg-emerald-500 text-white'
                        : 'bg-surface2 border border-app text-app2'
                    }`}>
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-app3 uppercase tracking-wider mb-2">Tipo de consulta</label>
              <select value={form.appointment_type} onChange={e => set('appointment_type', e.target.value)}
                className="w-full bg-surface2 border border-app rounded-xl px-4 py-2.5 text-app text-sm focus:outline-none focus:border-emerald-400">
                {TIPOS.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-app3 uppercase tracking-wider mb-2">Motivo (opcional)</label>
              <input type="text" value={form.chief_complaint} onChange={e => set('chief_complaint', e.target.value)}
                placeholder="Descripción..."
                className="w-full bg-surface2 border border-app rounded-xl px-4 py-3 text-app text-sm focus:outline-none focus:border-emerald-400" />
            </div>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-600 dark:text-red-400 text-sm">{error}</div>
            )}

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose}
                className="flex-1 bg-surface2 hover:bg-surface3 border border-app text-app font-semibold py-3 rounded-xl transition-colors">
                Cancelar
              </button>
              <button type="submit" disabled={loading}
                className="flex-1 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors">
                {loading ? 'Agendando...' : 'Confirmar turno'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
