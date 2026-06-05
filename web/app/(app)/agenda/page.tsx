'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import { apiFetch } from '@/lib/api'
import { useQueryClient } from '@tanstack/react-query'
import { useMe, useProfessionals, useCalendar, queryKeys, authedApiFetch, type CalendarData } from '@/lib/queries'
import { useRouter } from 'next/navigation'
import { Play, CheckCircle, XCircle, UserCheck, Clock, AlertTriangle, X, Lock, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'

const HOURS = ['00:00', '01:00', '02:00', '03:00', '04:00', '05:00', '06:00', '07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00', '22:00', '23:00']
const DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const SLOT_H = 80 // px por hora — 4 slots de 15 min × 20 px cada uno
const GRID_START_H = 0  // primera hora visible (00:00)
const GRID_END_H   = 24 // hora de fin del grid (exclusive)

const START_SLOTS = Array.from({ length: 96 }, (_, i) => {
  const h = Math.floor(i / 4)
  const m = (i % 4) * 15
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
})

function buildCalDays(year: number, month: number): (number | null)[] {
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const offset = (firstDay + 6) % 7
  const days: (number | null)[] = Array(offset).fill(null)
  for (let d = 1; d <= daysInMonth; d++) days.push(d)
  return days
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' })
}

function getTodayStr(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
}

type WorkingDayHours = { enabled: boolean; start: string; end: string }
type WorkingHours = Record<number, WorkingDayHours>

/** Convierte una fecha a índice 0=Lun … 6=Dom */
function weekdayIndex(dateStr: string): number {
  const jsDay = new Date(dateStr + 'T12:00:00').getDay() // 0=Dom
  return jsDay === 0 ? 6 : jsDay - 1
}

/** Bloques (top/height en px) que deben aparecer grises por fuera del horario laboral */
function nonWorkingBlocks(dateStr: string, wh: WorkingHours | null): { top: number; height: number }[] {
  if (!wh) return []
  const idx = weekdayIndex(dateStr)
  const day = wh[idx] as any
  if (!day) return []

  if (!day.enabled) {
    return [{ top: 0, height: (GRID_END_H - GRID_START_H) * SLOT_H }]
  }

  const toH = (time: string) => { const [h, m] = time.split(':').map(Number); return h + m / 60 }

  // Soporta formato viejo { start, end } y nuevo { blocks: [...] }
  const timeBlocks: { start: string; end: string }[] = Array.isArray(day.blocks)
    ? [...day.blocks].sort((a: any, b: any) => toH(a.start) - toH(b.start))
    : [{ start: day.start, end: day.end }]

  const result: { top: number; height: number }[] = []
  const gridTotal = (GRID_END_H - GRID_START_H) * SLOT_H

  // Antes del primer bloque
  const firstStart = toH(timeBlocks[0].start)
  const beforeH = (firstStart - GRID_START_H) * SLOT_H
  if (beforeH > 0) result.push({ top: 0, height: beforeH })

  // Huecos entre bloques (ej. almuerzo)
  for (let i = 0; i < timeBlocks.length - 1; i++) {
    const gapTop  = (toH(timeBlocks[i].end)       - GRID_START_H) * SLOT_H
    const gapH    = (toH(timeBlocks[i + 1].start) - GRID_START_H) * SLOT_H - gapTop
    if (gapH > 0) result.push({ top: gapTop, height: gapH })
  }

  // Después del último bloque
  const lastEnd  = toH(timeBlocks[timeBlocks.length - 1].end)
  const afterTop = (lastEnd - GRID_START_H) * SLOT_H
  const afterH   = gridTotal - afterTop
  if (afterH > 0) result.push({ top: afterTop, height: afterH })

  return result
}

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

function fmt24(iso: string) {
  return new Date(iso).toLocaleTimeString('es-AR', {
    hour: '2-digit', minute: '2-digit', hour12: false,
    timeZone: 'America/Argentina/Buenos_Aires',
  })
}

function formatDuration(min: number) {
  if (!min) return ''
  return min < 60 ? `${min}m` : `${Math.floor(min / 60)}h${min % 60 ? `${min % 60}m` : ''}`
}

function getSlotTop(startsAt: string): number {
  const [h, m] = fmt24(startsAt).split(':').map(Number)
  return Math.max(0, (h - GRID_START_H) * SLOT_H + (m / 60) * SLOT_H)
}

function getSlotHeight(startsAt: string, endsAt: string): number {
  const diff = (new Date(endsAt).getTime() - new Date(startsAt).getTime()) / 60000
  return Math.max(20, (diff / 60) * SLOT_H)
}

// Estado = color (no tipo ni profesional)
const STATUS_CONFIG: Record<string, { border: string; bg: string; dot: string; label: string; textClass: string }> = {
  pending:     { border: 'border-l-amber-400',   bg: 'bg-amber-400/10',   dot: 'bg-amber-400',            label: 'Sin confirmar', textClass: 'text-amber-800 dark:text-amber-200' },
  confirmed:   { border: 'border-l-[#00C4BC]',   bg: 'bg-[#00C4BC]/10',   dot: 'bg-[#00C4BC]',            label: 'Confirmado',    textClass: 'text-teal-800 dark:text-teal-200'   },
  in_progress: { border: 'border-l-violet-400',  bg: 'bg-violet-400/10',  dot: 'bg-violet-400',           label: 'En atención',   textClass: 'text-violet-800 dark:text-violet-200' },
  completed:   { border: 'border-l-app3',        bg: 'bg-surface2',       dot: 'bg-app3',                 label: 'Atendido',      textClass: 'text-app3'                          },
  absent:      { border: 'border-l-red-400',     bg: 'bg-red-400/10',     dot: 'bg-red-400',              label: 'No vino',       textClass: 'text-red-800 dark:text-red-200'     },
  cancelled:   { border: 'border-l-app3',        bg: 'bg-surface2/50',    dot: 'bg-app3',                 label: 'Cancelado',     textClass: 'text-app3'                          },
}

export default function AgendaPage() {
  const [token, setToken]               = useState('')
  const [linkCopied, setLinkCopied]     = useState(false)
  const [weekOffset, setWeekOffset]     = useState(0)
  const [selectedDay, setSelectedDay]   = useState(todayArg())
  const [selectedAppt, setSelectedAppt] = useState<any>(null)
  const [showPanel, setShowPanel]       = useState(false)
  const [panelTab, setPanelTab]         = useState<'appt' | 'block'>('appt')
  const [panelSide, setPanelSide]       = useState<'right' | 'left'>('right')
  const [previewDuration, setPreviewDuration] = useState(45)
  const [blockPreview, setBlockPreview] = useState({ startDate: '', startTime: '09:00', endTime: '10:00', allDay: false })
  const [newApptSlot, setNewApptSlot]   = useState<{ date: string; time: string } | null>(null)

  const [selectedProfId, setSelectedProfId] = useState('')
  const [editingAppt, setEditingAppt]   = useState<any>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [newBlockDate, setNewBlockDate] = useState<string | null>(null)
  const [selectedBlock, setSelectedBlock] = useState<any>(null)
  const [showMobileBlocks, setShowMobileBlocks] = useState(false)
  const router   = useRouter()
  const supabase = createClient()
  const qc = useQueryClient()
  const scrollRef = useRef<HTMLDivElement>(null)

  const weekDates = getWeekDates(weekOffset)
  const from = formatDate(weekDates[0])
  const to   = formatDate(weekDates[6])

  // Data via React Query: pinta desde cache (IndexedDB) y revalida en background.
  // El calendario se cachea por semana → navegar semanas es instantáneo.
  const { data: me } = useMe()
  const { data: professionals = [] } = useProfessionals()
  const calendarQuery = useCalendar(from, to)

  const appointments: any[] = calendarQuery.data?.appointments ?? []
  const blocks: any[] = calendarQuery.data?.blocks ?? []
  const loading = calendarQuery.isPending
  const refreshing = calendarQuery.isFetching && !calendarQuery.isPending
  const userId: string = me?.id ?? ''

  // Horario laboral derivado: del profesional filtrado, o el mío si es "Todos".
  const myWorkingHours: WorkingHours | null =
    professionals.find((p: any) => p.id === userId)?.schedule_config?.working_hours ?? null
  const workingHours: WorkingHours | null = selectedProfId
    ? (professionals.find((p: any) => p.id === selectedProfId)?.schedule_config?.working_hours ?? null)
    : myWorkingHours

  // Revalida el calendario de la semana visible contra el server.
  async function refetchCalendar() {
    await qc.invalidateQueries({ queryKey: queryKeys.calendar(from, to) })
  }

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      if (!session) { router.push('/'); return }
      setToken(session.access_token)
    })
    return () => subscription.unsubscribe()
  }, [router, supabase])

  useEffect(() => {
    if (!selectedAppt) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setSelectedAppt(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedAppt])

  // Realtime: invalida el cache del calendario para que React Query revalide.
  // (refetchOnWindowFocus reemplaza el viejo handler de visibilitychange.)
  useEffect(() => {
    const channel = supabase
      .channel('agenda-appointments')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => {
        void qc.invalidateQueries({ queryKey: ['appointments', 'calendar'] })
      })
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [qc, supabase])

  // Auto-scroll al inicio del horario laboral (o 8am por defecto)
  useEffect(() => {
    if (loading) return // grid no está en el DOM todavía
    const toH = (time: string) => { const [h, m] = time.split(':').map(Number); return h + m / 60 }
    let targetHour = 8

    if (workingHours) {
      const todayIdx = weekdayIndex(todayArg())
      const day = workingHours[todayIdx] as any
      if (day?.enabled) {
        const dayBlocks: { start: string }[] = Array.isArray(day.blocks)
          ? day.blocks
          : day.start ? [{ start: day.start }] : []
        const sorted = [...dayBlocks].sort((a, b) => toH(a.start) - toH(b.start))
        if (sorted[0]?.start) targetHour = toH(sorted[0].start)
      }
    }

    const scrollTop = Math.max(0, (targetHour - GRID_START_H) * SLOT_H)
    // rAF garantiza que el DOM ya fue pintado antes de scrollear
    const raf = requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollTop, behavior: 'smooth' })
    })
    return () => cancelAnimationFrame(raf)
  }, [workingHours, selectedProfId, loading])

  async function handleRefresh() {
    if (refreshing) return
    await refetchCalendar()
  }

  async function updateStatus(id: string, status: string) {
    await authedApiFetch(`/appointments/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    })
    await refetchCalendar()
    setSelectedAppt(null)
  }

  async function deleteAppt(id: string) {
    await authedApiFetch(`/appointments/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'cancelled' })
    })
    // Update optimista en el cache del calendario.
    qc.setQueryData<CalendarData>(queryKeys.calendar(from, to), prev =>
      prev ? { ...prev, appointments: prev.appointments.filter((a: any) => a.id !== id) } : prev)
    setSelectedAppt(null)
    setConfirmDelete(null)
  }

  async function deleteBlock(id: string) {
    await authedApiFetch(`/schedule-blocks/${id}`, { method: 'DELETE' })
    qc.setQueryData<CalendarData>(queryKeys.calendar(from, to), prev =>
      prev ? { ...prev, blocks: prev.blocks.filter((b: any) => b.id !== id) } : prev)
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

  const ApptModal = () => {
    if (!selectedAppt) return null
    const cfg = STATUS_CONFIG[selectedAppt.status] ?? STATUS_CONFIG.pending
    const isActionable = !['completed', 'absent', 'cancelled'].includes(selectedAppt.status)
    return (
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4"
        onClick={() => setSelectedAppt(null)}>
        <div className="bg-surface border border-app rounded-2xl w-full max-w-sm"
          onClick={e => e.stopPropagation()}>

          {/* Header */}
          <div className="p-5 pb-4">
            <div className="w-9 h-1 bg-surface3 rounded-full mx-auto mb-4 sm:hidden" />
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-bold text-lg text-app leading-tight">{selectedAppt.patient_name}</div>
                <div className="flex items-center gap-2 mt-1 text-sm text-app2">
                  {selectedAppt.appointment_type && <span>{selectedAppt.appointment_type}</span>}
                  {selectedAppt.duration_minutes && (
                    <span className="flex items-center gap-1 text-app3">
                      <Clock size={12} />{formatDuration(selectedAppt.duration_minutes)}
                    </span>
                  )}
                </div>
                <div className="text-xs text-app3 mt-1 tabular-nums">
                  {new Date(selectedAppt.starts_at).toLocaleDateString('es-AR', {
                    weekday: 'short', day: 'numeric', month: 'short',
                    timeZone: 'America/Argentina/Buenos_Aires'
                  })} · {fmt24(selectedAppt.starts_at)}
                </div>
              </div>
              {/* Status badge */}
              <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border flex-shrink-0 ${
                selectedAppt.status === 'pending'     ? 'bg-amber-400/10 border-amber-400/20 text-amber-400' :
                selectedAppt.status === 'confirmed'   ? 'bg-[#E6F8F1] border-[#00C4BC]/20 text-[#00C4BC]' :
                selectedAppt.status === 'in_progress' ? 'bg-violet-400/10 border-violet-400/20 text-violet-400' :
                selectedAppt.status === 'completed'   ? 'bg-surface2 border-app text-app3' :
                selectedAppt.status === 'absent'      ? 'bg-red-400/10 border-red-400/20 text-red-400' :
                'bg-surface2 border-app text-app3'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                {cfg.label}
              </span>
            </div>

            {selectedAppt.chief_complaint && (
              <div className="mt-3 bg-surface2 rounded-xl px-3 py-2.5 border-l-2 border-amber-400 flex items-start gap-2">
                <AlertTriangle size={13} className="text-amber-400 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-app2">{selectedAppt.chief_complaint}</div>
              </div>
            )}
          </div>

          {/* Quick actions */}
          {isActionable && (
            <div className="px-5 pb-4 space-y-2">
              {selectedAppt.status === 'pending' && (
                <button onClick={() => updateStatus(selectedAppt.id, 'confirmed')}
                  className="w-full flex items-center justify-center gap-2 bg-[#E6F8F1] hover:bg-[#00C4BC] hover:text-white text-[#00C4BC] font-semibold py-3 rounded-xl transition-all active:scale-95 text-sm">
                  <UserCheck size={16} /> Confirmar turno
                </button>
              )}
              {(selectedAppt.status === 'pending' || selectedAppt.status === 'confirmed') && (
                <button onClick={() => updateStatus(selectedAppt.id, 'in_progress')}
                  className="w-full flex items-center justify-center gap-2 bg-violet-400/10 hover:bg-violet-400 hover:text-white text-violet-400 font-semibold py-3 rounded-xl transition-all active:scale-95 text-sm">
                  <Play size={16} /> Iniciar atención
                </button>
              )}
              {selectedAppt.status === 'in_progress' && (
                <button onClick={() => updateStatus(selectedAppt.id, 'completed')}
                  className="w-full flex items-center justify-center gap-2 bg-[#00C4BC] hover:bg-[#00aaa3] text-white font-semibold py-3 rounded-xl transition-all active:scale-95 text-sm">
                  <CheckCircle size={16} /> Marcar como atendido
                </button>
              )}
              <button onClick={() => updateStatus(selectedAppt.id, 'absent')}
                className="w-full flex items-center justify-center gap-2 bg-surface2 hover:bg-red-400/10 hover:text-red-400 text-app2 font-semibold py-3 rounded-xl transition-all active:scale-95 text-sm">
                <XCircle size={16} /> No vino
              </button>
            </div>
          )}

          {/* Secondary actions */}
          <div className="px-5 pb-5 pt-0 space-y-2 border-t border-app pt-4">
            <button onClick={() => router.push(`/patients/${selectedAppt.patient_id}`)}
              className="w-full bg-surface2 hover:bg-surface3 border border-app active:scale-95 text-app py-2.5 rounded-xl text-sm font-medium transition-all">
              Ver ficha del paciente →
            </button>
            {isActionable && (
              <button onClick={() => {
                const appt = selectedAppt
                setSelectedAppt(null)
                const apptDate = new Date(appt.starts_at).toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
                const apptTime = new Date(appt.starts_at).toLocaleString('en-CA', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Argentina/Buenos_Aires' })
                setPanelTab('appt')
                setPanelSide('right')
                setNewApptSlot({ date: apptDate, time: apptTime })
                setPreviewDuration(appt.duration_minutes ?? 45)
                setEditingAppt(appt)
                setShowPanel(true)
              }}
                className="w-full bg-surface2 hover:bg-surface3 border border-app active:scale-95 text-app2 py-2.5 rounded-xl text-sm font-medium transition-all">
                Editar turno
              </button>
            )}
            <button onClick={() => { setConfirmDelete(selectedAppt.id); setSelectedAppt(null) }}
              className="w-full bg-red-500/15 hover:bg-red-500/25 border border-red-500/40 active:scale-95 text-red-400 py-2.5 rounded-xl text-sm font-medium transition-all">
              Eliminar turno
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (loading && appointments.length === 0) {
    return (
      <div className="bg-app text-app flex flex-col h-[calc(100vh-57px)] animate-pulse">

        {/* ── MOBILE SKELETON ── */}
        <div className="md:hidden flex flex-col h-full">
          {/* Header: mes + nav + refresh + day picker */}
          <div className="border-b border-neutral-200 dark:border-neutral-800/50 px-4 py-2">
            <div className="flex items-center justify-between mb-2">
              <div className="h-4 bg-surface2 rounded w-28" />
              <div className="flex gap-1.5">
                <div className="h-7 w-9 bg-surface2 rounded-lg" />
                <div className="h-7 w-14 bg-surface2 rounded-lg" />
                <div className="h-7 w-9 bg-surface2 rounded-lg" />
              </div>
            </div>
            {/* Refresh button */}
            <div className="h-9 bg-surface2 rounded-xl mb-2" />
            {/* Day picker */}
            <div className="grid grid-cols-7 gap-0">
              {[...Array(7)].map((_, i) => (
                <div key={i} className="flex flex-col items-center gap-1 py-1">
                  <div className="h-2.5 bg-surface2 rounded w-5" />
                  <div className="h-7 w-7 bg-surface2 rounded-full" />
                  <div className="h-1 w-1 rounded-full bg-surface2" />
                </div>
              ))}
            </div>
          </div>
          {/* Appointment list */}
          <div className="flex-1 overflow-hidden p-4 space-y-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="rounded-xl border-l-2 border-l-surface3 bg-surface2 p-2.5">
                <div className="flex items-start gap-3">
                  <div className="h-4 bg-surface3 rounded w-10 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-4 bg-surface3 rounded w-3/4" />
                    <div className="h-3 bg-surface3 rounded w-1/2" />
                  </div>
                  <div className="h-5 bg-surface3 rounded-full w-16 flex-shrink-0" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── DESKTOP SKELETON ── */}
        <div className="hidden md:flex flex-col flex-1 overflow-hidden">
          {/* Toolbar */}
          <div className="px-6 py-2 border-b border-neutral-200 dark:border-neutral-800/50 flex items-center justify-between flex-shrink-0">
            <div className="h-4 bg-surface2 rounded w-36" />
            <div className="flex items-center gap-2">
              <div className="h-8 bg-surface2 rounded-lg w-24" />
              <div className="h-8 bg-surface2 rounded-lg w-24" />
              <div className="h-8 bg-surface2 rounded-lg w-32" />
              <div className="h-8 bg-surface2 rounded-lg w-9" />
              <div className="h-8 bg-surface2 rounded-lg w-10" />
              <div className="h-8 bg-surface2 rounded-lg w-9" />
            </div>
          </div>
          {/* Day header sticky */}
          <div className="grid border-b border-neutral-200 dark:border-neutral-800/50 flex-shrink-0"
            style={{ gridTemplateColumns: '48px repeat(7, 1fr)' }}>
            <div />
            {[...Array(7)].map((_, i) => (
              <div key={i} className="py-2 flex flex-col items-center gap-1 border-l border-neutral-200 dark:border-neutral-800/50">
                <div className="h-2.5 bg-surface2 rounded w-6" />
                <div className="h-7 w-7 bg-surface2 rounded-full" />
              </div>
            ))}
          </div>
          {/* Time grid */}
          <div className="flex-1 overflow-hidden">
            <div className="grid h-full" style={{ gridTemplateColumns: '48px repeat(7, 1fr)' }}>
              {/* Hours column */}
              <div>
                {[...Array(9)].map((_, i) => (
                  <div key={i} className="border-t border-neutral-200 dark:border-neutral-800/50 flex items-start pt-1 pr-1.5 justify-end"
                    style={{ height: SLOT_H }}>
                    <div className="h-2.5 bg-surface2 rounded w-8" />
                  </div>
                ))}
              </div>
              {/* Day columns */}
              {[...Array(7)].map((_, col) => (
                <div key={col} className="border-l border-neutral-200 dark:border-neutral-800/50">
                  {[...Array(9)].map((_, row) => (
                    <div key={row} className="border-t border-neutral-200 dark:border-neutral-800/50"
                      style={{ height: SLOT_H }} />
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
        <div className="border-b border-neutral-200 dark:border-neutral-800/50 px-4 py-2">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-app2">
                {weekDates[0].toLocaleDateString('es-AR', { month: 'long', year: 'numeric', timeZone: 'America/Argentina/Buenos_Aires' })}
              </span>
              {dayBlocks.length > 0 && (
                <button
                  onClick={() => setShowMobileBlocks(v => !v)}
                  className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border transition-colors ${
                    showMobileBlocks
                      ? 'bg-slate-400/20 border-slate-400/40 text-slate-600 dark:text-slate-300'
                      : 'bg-surface2 border-app text-app3'
                  }`}
                >
                  🔒 {dayBlocks.length}
                </button>
              )}
            </div>
            <WeekNav />
          </div>
          <div className="mb-2">
            <button
              onClick={handleRefresh}
              disabled={!token || refreshing}
              className="w-full flex items-center justify-center gap-2 bg-surface2 hover:bg-surface3 disabled:opacity-60 border border-app rounded-xl px-3 py-2 text-app text-sm font-medium transition-colors"
            >
              <span className={`${refreshing ? 'animate-spin' : ''}`}>↻</span>
              {refreshing ? 'Actualizando...' : 'Actualizar agenda'}
            </button>
          </div>
          {professionals.length > 1 && (
            <div className="mb-2">
              <select
                value={selectedProfId}
                onChange={e => setSelectedProfId(e.target.value)}
                className="w-full bg-surface2 border border-app rounded-xl px-3 py-2 text-app text-sm focus:outline-none focus:border-[#00C4BC]"
              >
                <option value="">Todos los profesionales</option>
                {professionals.map((p: any) => (
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
                    isSelected ? 'bg-[#00C4BC] text-white' :
                    isToday ? 'border border-[#00C4BC] text-[#00C4BC]' : 'text-app'
                  }`}>
                    {d.getDate()}
                  </span>
                  <div className="flex gap-0.5">
                    {hasAppts && <span className={`w-1 h-1 rounded-full ${isSelected ? 'bg-white' : 'bg-[#00C4BC]'}`} />}
                    {hasBlocks && <span className={`w-1 h-1 rounded-full ${isSelected ? 'bg-white' : 'bg-slate-400'}`} />}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {/* Banner de día no laboral en mobile */}
          {(() => {
            const nwBlocks = nonWorkingBlocks(selectedDay, workingHours)
            const isFullDayOff = nwBlocks.length === 1 && nwBlocks[0].top === 0
            if (!isFullDayOff) return null
            return (
              <div className="mb-3 rounded-xl border border-slate-400/30 bg-slate-400/10 px-4 py-3 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                <span className="text-base">🚫</span>
                <span>Día no laboral — el profesional no atiende este día.</span>
              </div>
            )
          })()}
          {dayAppts.length === 0 && (dayBlocks.length === 0 || !showMobileBlocks) ? (
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
            <div className="space-y-2">
              {showMobileBlocks && dayBlocks.map(block => (
                <div key={block.id} onClick={() => setSelectedBlock(block)}
                  className="rounded-xl border-l-2 border-l-slate-400/60 bg-slate-400/8 p-3 cursor-pointer active:scale-95 transition-transform">
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
              ).map(appt => {
                const cfg = STATUS_CONFIG[appt.status] ?? STATUS_CONFIG.pending
                const isDone = ['completed', 'absent', 'cancelled'].includes(appt.status)
                return (
                  <div key={appt.id} className={`rounded-xl border-l-2 ${cfg.border} ${cfg.bg} overflow-hidden`}>
                    {/* Main row */}
                    <div className="flex items-start gap-3 p-2.5" onClick={() => setSelectedAppt(appt)}>
                      {/* Hora */}
                      <div className="tabular-nums text-sm font-semibold text-app2 w-12 flex-shrink-0 pt-0.5">
                        {fmt24(appt.starts_at)}
                      </div>
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-app text-sm truncate">{appt.patient_name}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          {appt.appointment_type && <span className="text-xs text-app2 truncate">{appt.appointment_type}</span>}
                          {appt.duration_minutes && (
                            <span className="flex items-center gap-0.5 text-xs text-app3 flex-shrink-0">
                              <Clock size={10} />{formatDuration(appt.duration_minutes)}
                            </span>
                          )}
                          {appt.chief_complaint && (
                            <AlertTriangle size={11} className="text-amber-400 flex-shrink-0" />
                          )}
                        </div>
                      </div>
                      {/* Status badge */}
                      <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${cfg.textClass}`}>
                        <span className={`w-1 h-1 rounded-full ${cfg.dot}`} />
                        {cfg.label}
                      </span>
                    </div>
                    {/* Quick actions inline */}
                    {!isDone && (
                      <div className="flex gap-1 px-3 pb-2.5">
                        {appt.status === 'pending' && (
                          <button onClick={() => updateStatus(appt.id, 'confirmed')}
                            className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-[#E6F8F1] text-[#00C4BC] hover:bg-[#00C4BC] hover:text-white transition-all active:scale-95">
                            <UserCheck size={12} /> Confirmar
                          </button>
                        )}
                        {(appt.status === 'pending' || appt.status === 'confirmed') && (
                          <button onClick={() => updateStatus(appt.id, 'in_progress')}
                            className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-violet-400/10 text-violet-400 hover:bg-violet-400 hover:text-white transition-all active:scale-95">
                            <Play size={12} /> Iniciar
                          </button>
                        )}
                        {appt.status === 'in_progress' && (
                          <button onClick={() => updateStatus(appt.id, 'completed')}
                            className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-[#00C4BC] text-white hover:bg-[#00aaa3] transition-all active:scale-95">
                            <CheckCircle size={12} /> Atendido
                          </button>
                        )}
                        <button onClick={() => updateStatus(appt.id, 'absent')}
                          className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-surface2 text-app3 hover:bg-red-400/10 hover:text-red-400 transition-all active:scale-95">
                          <XCircle size={12} /> No vino
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── DESKTOP VIEW ── */}
      <div className="hidden md:flex flex-col flex-1 overflow-hidden">
        {/* Barra superior con navegación */}
        <div className="px-6 py-2 border-b border-neutral-200 dark:border-neutral-800/50 flex items-center justify-between flex-shrink-0">
          <span className="text-sm text-app2">
            {weekDates[0].toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })} –{' '}
            {weekDates[6].toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
          <div className="flex items-center gap-3">
            {professionals.length > 1 && (
              <select
                value={selectedProfId}
                onChange={e => setSelectedProfId(e.target.value)}
                className="bg-surface2 border border-app rounded-lg px-3 py-1.5 text-app text-sm focus:outline-none focus:border-[#00C4BC]"
              >
                <option value="">Todos los profesionales</option>
                {professionals.map((p: any) => (
                  <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>
                ))}
              </select>
            )}
            <button
              onClick={handleRefresh}
              disabled={!token || refreshing}
              className="flex items-center gap-1.5 bg-surface2 hover:bg-surface3 disabled:opacity-60 border border-app px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
            >
              <span className={`${refreshing ? 'animate-spin' : ''}`}>↻</span>
              {refreshing ? 'Actualizando...' : 'Actualizar'}
            </button>
            <button
              onClick={() => { setNewBlockDate(selectedDay); setPanelTab('block'); setPanelSide('right'); setShowPanel(true) }}
              className="flex items-center gap-1.5 bg-slate-500/10 hover:bg-slate-500/20 border border-slate-500/30 text-slate-600 dark:text-slate-300 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors">
              🔒 Bloquear horario
            </button>
            <div className="relative group">
              <button
                onClick={() => {
                  const link = `${window.location.origin}/booking/${userId}`
                  navigator.clipboard.writeText(link)
                  setLinkCopied(true)
                  setTimeout(() => setLinkCopied(false), 2000)
                }}
                disabled={!userId}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  linkCopied
                    ? 'bg-[#E6F8F1] border border-[#00C4BC]/50 text-[#00C4BC]'
                    : 'bg-[#E6F8F1] hover:bg-[#00C4BC]/20 border border-[#00C4BC]/30 text-[#00C4BC]'
                } disabled:opacity-60 disabled:hover:bg-[#E6F8F1]`}>
                {linkCopied ? '✓ Copiado' : '📋 Link de agenda'}
              </button>
              <div className="pointer-events-none absolute top-full right-0 mt-2 w-64 opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50">
                <div className="bg-neutral-900 text-white text-xs rounded-xl px-3 py-2.5 shadow-lg leading-relaxed">
                  <div className="absolute right-4 bottom-full w-0 h-0 border-x-4 border-x-transparent border-b-4 border-b-neutral-900" />
                  <div className="font-semibold mb-0.5">Link de reserva online</div>
                  Copiá este link y compartilo con tus pacientes. Ellos pueden elegir un horario y reservar un turno sin que tengas que llamarlos.
                </div>
              </div>
            </div>
            <WeekNav />
          </div>
        </div>

        {/* Contenedor scroll — header sticky + grid body */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden">
          {/* Header días sticky */}
          <div className="grid sticky top-0 z-20 bg-app border-b border-neutral-200 dark:border-neutral-800/50"
            style={{ gridTemplateColumns: '48px repeat(7, 1fr)' }}>
            <div />
            {weekDates.map((d, i) => {
              const isToday = formatDate(d) === today
              return (
                <div key={i} className="py-2 text-center border-l border-neutral-200 dark:border-neutral-800/50">
                  <div className="text-[10px] text-app3 uppercase tracking-wider">{DAYS[i]}</div>
                  <div className={`text-base font-bold mx-auto w-7 h-7 flex items-center justify-center rounded-full ${
                    isToday ? 'bg-[#00C4BC] text-white' : 'text-app'
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
                <div key={h} className="relative border-t border-neutral-200 dark:border-neutral-800/50" style={{ height: SLOT_H }}>
                  <span className="absolute top-1 right-1.5 text-[10px] tabular-nums text-app3 leading-none">{h}</span>
                  <span className="absolute right-1.5 text-[9px] tabular-nums text-app3/40 leading-none" style={{ top: SLOT_H / 2 + 2 }}>:30</span>
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
                  className={`relative border-l border-neutral-200 dark:border-neutral-800/50 ${isToday ? 'bg-[#00C4BC]/4' : ''}`}
                  style={{ minHeight: `${HOURS.length * SLOT_H}px` }}
                  onClick={(e) => {
                    if (e.target === e.currentTarget) {
                      const rect = e.currentTarget.getBoundingClientRect()
                      const y = e.clientY - rect.top
                      const snappedSlots = Math.floor((y / SLOT_H) * 4) // 4 slots de 15 min por hora
                      const gridMins = GRID_START_H * 60 + snappedSlots * 15
                      const hour = Math.floor(gridMins / 60)
                      const min = gridMins % 60
                      const side = e.clientX > window.innerWidth * 0.55 ? 'left' : 'right'
                      setPanelSide(side)
                      setPanelTab('appt')
                      setNewApptSlot({ date: dateStr, time: `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}` })
                      setPreviewDuration(45)
                      setEditingAppt(null)
                      setShowPanel(true)
                    }
                  }}>
                  {HOURS.map((_, i) => (
                    <div key={i}>
                      {/* Línea de hora */}
                      <div className="absolute w-full border-t border-neutral-200 dark:border-neutral-800/50"
                        style={{ top: i * SLOT_H }} />
                      {/* Líneas de 15 min */}
                      <div className="absolute w-full border-t border-neutral-100 dark:border-neutral-800/25"
                        style={{ top: i * SLOT_H + SLOT_H * 0.25 }} />
                      {/* Línea de 30 min — más visible */}
                      <div className="absolute w-full border-t border-neutral-200/70 dark:border-neutral-800/40"
                        style={{ top: i * SLOT_H + SLOT_H * 0.5 }} />
                      {/* Línea de 45 min */}
                      <div className="absolute w-full border-t border-neutral-100 dark:border-neutral-800/25"
                        style={{ top: i * SLOT_H + SLOT_H * 0.75 }} />
                    </div>
                  ))}

                  {/* Horarios no laborales — bloquean clicks */}
                  {nonWorkingBlocks(dateStr, workingHours).map((block, i) => (
                    <div
                      key={`nw-${i}`}
                      className="absolute left-0 right-0 z-[2] cursor-not-allowed"
                      onClick={e => e.stopPropagation()}
                      style={{
                        top: block.top,
                        height: block.height,
                        background: 'repeating-linear-gradient(135deg, transparent, transparent 5px, rgba(120,120,120,0.18) 5px, rgba(120,120,120,0.18) 6px)',
                        backgroundColor: 'rgba(120,120,120,0.08)',
                      }}
                    />
                  ))}

                  {/* Schedule blocks */}
                  {dayBlks.map(block => (
                    <div key={block.id}
                      onClick={() => setSelectedBlock(block)}
                      className="absolute left-0.5 right-0.5 rounded border-l-2 border-l-slate-400/60 bg-slate-400/10 px-1 py-0.5 cursor-pointer hover:bg-slate-400/18 transition-colors overflow-hidden"
                      style={{
                        top:    getSlotTop(block.starts_at),
                        height: getSlotHeight(block.starts_at, block.ends_at),
                        backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(100,116,139,0.08) 3px, rgba(100,116,139,0.08) 6px)',
                      }}>
                      <div className="text-[10px] font-bold text-slate-500 truncate">Bloqueado</div>
                    </div>
                  ))}

                  {/* Preview block — bloqueo */}
                  {showPanel && panelTab === 'block' && blockPreview.startDate && blockPreview.startDate <= dateStr && (newBlockDate ?? selectedDay) >= dateStr && blockPreview.startDate <= (newBlockDate ?? selectedDay) && (() => {
                    if (blockPreview.allDay) {
                      return (
                        <div className="absolute left-0.5 right-0.5 rounded border-l-2 border-l-slate-400 pointer-events-none z-10 overflow-hidden"
                          style={{ top: 0, height: HOURS.length * SLOT_H, backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(100,116,139,0.12) 3px, rgba(100,116,139,0.12) 6px)', backgroundColor: 'rgba(100,116,139,0.08)' }}>
                          <div className="text-[11px] font-semibold text-slate-500 truncate leading-tight px-1.5 py-0.5">Bloqueado</div>
                        </div>
                      )
                    }
                    const ps = `${dateStr}T${blockPreview.startTime}:00-03:00`
                    const pe = `${dateStr}T${blockPreview.endTime}:00-03:00`
                    if (new Date(pe) <= new Date(ps)) return null
                    const bH = getSlotHeight(ps, pe)
                    return (
                      <div className="absolute left-0.5 right-0.5 rounded border-l-2 border-l-slate-400 pointer-events-none z-10 overflow-hidden px-1.5 py-0.5"
                        style={{ top: getSlotTop(ps), height: bH, backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(100,116,139,0.12) 3px, rgba(100,116,139,0.12) 6px)', backgroundColor: 'rgba(100,116,139,0.08)' }}>
                        <div className="text-[11px] font-semibold text-slate-500 truncate leading-tight">Bloqueado</div>
                        {bH >= 28 && <div className="text-[10px] text-slate-400 truncate leading-tight">{blockPreview.startTime} – {blockPreview.endTime}</div>}
                      </div>
                    )
                  })()}

                  {/* Preview block while creating / editing an appointment */}
                  {showPanel && panelTab === 'appt' && newApptSlot && newApptSlot.date === dateStr && (() => {
                    const previewStart = `${newApptSlot.date}T${newApptSlot.time}:00-03:00`
                    const previewEndMs = new Date(previewStart).getTime() + previewDuration * 60000
                    const previewEnd = new Date(previewEndMs).toISOString()
                    const blockH = getSlotHeight(previewStart, previewEnd)
                    return (
                      <div
                        className="absolute left-0.5 right-0.5 rounded border-l-2 border-l-[#00C4BC] bg-[#00C4BC]/15 border border-dashed border-[#00C4BC]/50 px-1.5 py-0.5 pointer-events-none z-10 overflow-hidden"
                        style={{ top: getSlotTop(previewStart), height: blockH }}
                      >
                        {!editingAppt && <div className="text-[11px] font-semibold text-[#00C4BC] truncate leading-tight">Nuevo turno</div>}
                        {!editingAppt && blockH >= 28 && (
                          <div className="text-[10px] text-[#00C4BC]/80 truncate leading-tight">{fmt24(previewStart)} – {fmt24(previewEnd)}</div>
                        )}
                      </div>
                    )
                  })()}

                  {/* Appointments */}
                  {dayApts.map(appt => {
                    const cfg = STATUS_CONFIG[appt.status] ?? STATUS_CONFIG.pending
                    const blockH = getSlotHeight(appt.starts_at, appt.ends_at)
                    const isDone = ['completed', 'absent', 'cancelled'].includes(appt.status)
                    return (
                      <div key={appt.id}
                        className={`group absolute left-0.5 right-0.5 rounded border-l-2 cursor-pointer hover:z-10 hover:brightness-97 transition-all overflow-visible ${cfg.border} ${cfg.bg}`}
                        style={{ top: getSlotTop(appt.starts_at), height: blockH }}
                        onClick={() => setSelectedAppt(appt)}
                      >
                        {/* Contenido del bloque */}
                        <div className="px-1.5 py-0.5 overflow-hidden h-full">
                          <div className={`text-[11px] font-bold leading-tight truncate ${cfg.textClass}`}>
                            {appt.patient_name}
                          </div>
                          {blockH >= 34 && (
                            <div className="flex items-center gap-1 mt-0.5">
                              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot} ${appt.status === 'in_progress' ? 'animate-pulse' : ''}`} />
                              <span className={`text-[9px] truncate opacity-80 ${cfg.textClass}`}>
                                {appt.appointment_type ?? cfg.label}
                              </span>
                              {appt.chief_complaint && (
                                <AlertTriangle size={9} className="text-amber-400 flex-shrink-0" />
                              )}
                            </div>
                          )}
                        </div>

                        {/* Hover actions — aparecen debajo del bloque */}
                        {!isDone && blockH >= 32 && (
                          <div className="hidden group-hover:flex absolute left-0 top-full z-30 gap-1 p-1.5 bg-surface border border-app/30 rounded-b-lg shadow-md mt-px w-max">
                            {appt.status === 'pending' && (
                              <button
                                onClick={e => { e.stopPropagation(); updateStatus(appt.id, 'confirmed') }}
                                className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded bg-[#E6F8F1] text-[#00C4BC] hover:bg-[#00C4BC] hover:text-white transition-all"
                              >
                                <UserCheck size={10} /> Confirmar
                              </button>
                            )}
                            {(appt.status === 'pending' || appt.status === 'confirmed') && (
                              <button
                                onClick={e => { e.stopPropagation(); updateStatus(appt.id, 'in_progress') }}
                                className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded bg-violet-400/10 text-violet-400 hover:bg-violet-400 hover:text-white transition-all"
                              >
                                <Play size={10} /> Iniciar
                              </button>
                            )}
                            {appt.status === 'in_progress' && (
                              <button
                                onClick={e => { e.stopPropagation(); updateStatus(appt.id, 'completed') }}
                                className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded bg-[#00C4BC] text-white hover:bg-[#00aaa3] transition-all"
                              >
                                <CheckCircle size={10} /> Atendido
                              </button>
                            )}
                            <button
                              onClick={e => { e.stopPropagation(); updateStatus(appt.id, 'absent') }}
                              className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded bg-surface2 text-app3 hover:bg-red-400/10 hover:text-red-400 transition-all"
                            >
                              <XCircle size={10} /> No vino
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* FABs */}
      <button
        onClick={() => { setNewApptSlot({ date: selectedDay, time: '09:00' }); setPreviewDuration(45); setEditingAppt(null); setPanelTab('appt'); setPanelSide('right'); setShowPanel(true) }}
        className="fixed bottom-24 right-6 md:bottom-6 md:right-6 w-14 h-14 bg-[#00C4BC] hover:bg-[#00aaa3] rounded-full flex items-center justify-center text-2xl shadow-lg transition-colors z-30"
      >
        +
      </button>
      <button
        onClick={() => { setNewBlockDate(selectedDay); setPanelTab('block'); setPanelSide('right'); setShowPanel(true) }}
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
        disabled={!userId}
        className={`md:hidden fixed bottom-24 right-40 w-12 h-12 rounded-full flex items-center justify-center text-lg shadow-lg transition-all z-30 font-medium ${
          linkCopied
            ? 'bg-[#00C4BC] hover:bg-[#00aaa3] text-white'
            : 'bg-[#00C4BC] hover:bg-[#00aaa3] text-white'
        } disabled:opacity-60`}
        title="Copiar link de agenda"
      >
        {linkCopied ? '✓' : '📋'}
      </button>

      {showPanel && (
        <AgendaPanel
          token={token}
          defaultTab={panelTab}
          side={panelSide}
          apptSlot={newApptSlot}
          blockDate={newBlockDate ?? selectedDay}
          professionals={professionals}
          defaultProfessionalId={
            selectedProfId ||
            professionals.find((p: any) => p.id === userId)?.id ||
            professionals[0]?.id ||
            ''
          }
          editingAppt={editingAppt}
          onClose={() => { setShowPanel(false); setEditingAppt(null) }}
          onApptCreated={async (professionalId) => {
            setShowPanel(false)
            setEditingAppt(null)
            setSelectedProfId(prev => prev && prev !== professionalId ? professionalId : prev)
            await refetchCalendar()
          }}
          onBlockCreated={async () => {
            setShowPanel(false)
            await refetchCalendar()
          }}
          onDurationChange={setPreviewDuration}
          onSlotChange={(date, time) => setNewApptSlot({ date, time })}
          onBlockPreviewChange={setBlockPreview}
          onTabChange={(t) => {
            setPanelTab(t)
            if (t === 'block' && newApptSlot) setNewBlockDate(newApptSlot.date)
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

function AgendaPanel({
  token, defaultTab, side, apptSlot, blockDate, professionals, defaultProfessionalId, editingAppt,
  onClose, onApptCreated, onBlockCreated, onDurationChange, onSlotChange, onBlockPreviewChange, onTabChange,
}: {
  token: string
  defaultTab: 'appt' | 'block'
  side: 'right' | 'left'
  apptSlot: { date: string; time: string } | null
  blockDate: string
  professionals: any[]
  defaultProfessionalId: string
  editingAppt?: any
  onClose: () => void
  onApptCreated: (professionalId: string) => void
  onBlockCreated: () => void
  onDurationChange: (minutes: number) => void
  onSlotChange: (date: string, time: string) => void
  onBlockPreviewChange: (p: { startDate: string; startTime: string; endTime: string; allDay: boolean }) => void
  onTabChange: (tab: 'appt' | 'block') => void
}) {
  const [tab, setTab] = useState<'appt' | 'block'>(defaultTab)

  function changeTab(t: 'appt' | 'block') { setTab(t); onTabChange(t) }

  useEffect(() => { setTab(defaultTab) }, [defaultTab])

  useEffect(() => {
    function handleKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  return (
    <div className={`fixed top-0 bottom-0 w-[390px] z-40 bg-surface flex flex-col shadow-2xl ${
      side === 'right' ? 'right-0 border-l border-app' : 'left-0 border-r border-app'
    }`}>
      <div className="flex items-center border-b border-app px-3 shrink-0">
        <button onClick={onClose} className="p-2 mr-2 text-app3 hover:text-app transition-colors rounded-lg hover:bg-surface2 cursor-pointer">
          <X size={16} />
        </button>
        {editingAppt ? (
          <span className="px-3 py-3.5 text-sm font-semibold text-app">Editar turno</span>
        ) : (
          <>
            <button
              onClick={() => changeTab('appt')}
              className={`px-3 py-3.5 text-sm font-semibold border-b-2 transition-colors mr-1 cursor-pointer ${
                tab === 'appt' ? 'border-[#00C4BC] text-[#00C4BC]' : 'border-transparent text-app3 hover:text-app'
              }`}
            >Nuevo turno</button>
            <button
              onClick={() => changeTab('block')}
              className={`px-3 py-3.5 text-sm font-semibold border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
                tab === 'block' ? 'border-slate-500 text-slate-600 dark:text-slate-300' : 'border-transparent text-app3 hover:text-app'
              }`}
            ><Lock size={12} /> Bloquear</button>
          </>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {tab === 'appt' || editingAppt
          ? <PanelApptForm
              token={token}
              date={apptSlot?.date ?? blockDate}
              time={apptSlot?.time ?? '09:00'}
              professionals={professionals}
              defaultProfessionalId={defaultProfessionalId}
              editingAppt={editingAppt}
              onClose={onClose}
              onCreated={onApptCreated}
              onDurationChange={onDurationChange}
              onSlotChange={onSlotChange}
            />
          : <PanelBlockForm
              token={token}
              defaultDate={blockDate}
              defaultTime={apptSlot?.time ?? '09:00'}
              onClose={onClose}
              onCreated={onBlockCreated}
              onBlockPreviewChange={onBlockPreviewChange}
            />
        }
      </div>
    </div>
  )
}

function PanelApptForm({ token, date, time, professionals, defaultProfessionalId, editingAppt, onClose, onCreated, onDurationChange, onSlotChange }: {
  token: string
  date: string
  time: string
  professionals: any[]
  defaultProfessionalId: string
  editingAppt?: any
  onClose: () => void
  onCreated: (professionalId: string) => void
  onDurationChange: (minutes: number) => void
  onSlotChange: (date: string, time: string) => void
}) {
  const initDate = editingAppt
    ? new Date(editingAppt.starts_at).toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
    : date
  const initTime = editingAppt
    ? new Date(editingAppt.starts_at).toLocaleString('en-CA', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Argentina/Buenos_Aires' })
    : time

  const [search, setSearch]               = useState(editingAppt?.patient_name ?? '')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [searching, setSearching]         = useState(false)
  const [selectedPatientData, setSelectedPatientData] = useState<any>(
    editingAppt ? { id: editingAppt.patient_id, full_name: editingAppt.patient_name } : null
  )
  const [patientId, setPatientId]         = useState(editingAppt?.patient_id ?? '')
  const [professionalId, setProfessionalId] = useState(editingAppt?.professional_id ?? defaultProfessionalId)
  const [newPatientMode, setNewPatientMode] = useState(false)
  const [newPatientName, setNewPatientName] = useState('')
  const [newPatientLastName, setNewPatientLastName] = useState('')
  const [newPatientPhone, setNewPatientPhone] = useState('')
  const [creatingPatient, setCreatingPatient] = useState(false)
  const [form, setForm] = useState({
    date: initDate, time: initTime,
    duration_minutes: String(editingAppt?.duration_minutes ?? 45),
    appointment_type: editingAppt?.appointment_type ?? '',
    chief_complaint: editingAppt?.chief_complaint ?? '',
  })
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState('')
  const [showDatePicker, setShowDatePicker]   = useState(false)
  const [showStartPicker, setShowStartPicker] = useState(false)
  const [showEndPicker, setShowEndPicker]     = useState(false)
  const startSelectedRef = useRef<HTMLButtonElement>(null)
  const [calMonth, setCalMonth] = useState(() => {
    const d = new Date(form.date + 'T12:00:00')
    return { year: d.getFullYear(), month: d.getMonth() }
  })

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  function addMinutes(t: string, mins: number): string {
    const [h, m] = t.split(':').map(Number)
    const total = h * 60 + m + mins
    return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
  }

  useEffect(() => {
    if (editingAppt) return
    setForm(f => ({ ...f, date, time }))
  }, [date, time, editingAppt])

  useEffect(() => {
    if (professionalId || !defaultProfessionalId) return
    setProfessionalId(defaultProfessionalId)
  }, [defaultProfessionalId, professionalId])

  const selectedPatient = selectedPatientData

  useEffect(() => {
    if (!search.trim()) { setSearchResults([]); return }
    setSearching(true)
    apiFetch(`/patients?q=${encodeURIComponent(search.trim())}&limit=10`, { token })
      .then((data: any) => setSearchResults(data.data ?? []))
      .catch(() => setSearchResults([]))
      .finally(() => setSearching(false))
  }, [search, token])

  useEffect(() => {
    const d = new Date(form.date + 'T12:00:00')
    setCalMonth({ year: d.getFullYear(), month: d.getMonth() })
  }, [form.date])

  const endTime = addMinutes(form.time, Number(form.duration_minutes))

  useEffect(() => {
    if (showStartPicker) startSelectedRef.current?.scrollIntoView({ block: 'center' })
  }, [showStartPicker])

  const todayStr = getTodayStr()

  const TIPOS = ['Consulta', 'Limpieza', 'Endodoncia', 'Exodoncia', 'Ortodoncia', 'Implante', 'Operatoria', 'Prótesis', 'Blanqueamiento', 'Urgencia', 'Control', 'Armonizacion facial', 'Otro']
  const DURACIONES = [
    { value: '15',  label: '15 min' },
    { value: '20',  label: '20 min' },
    { value: '30',  label: '30 min' },
    { value: '45',  label: '45 min' },
    { value: '60',  label: '1 h' },
    { value: '75',  label: '1 h 15 min' },
    { value: '90',  label: '1 h 30 min' },
    { value: '120', label: '2 h' },
    { value: '150', label: '2 h 30 min' },
    { value: '180', label: '3 h' },
  ]

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!patientId) { setError('Seleccioná un paciente'); return }
    if (!professionalId) { setError('Seleccioná un profesional'); return }
    setLoading(true)
    setError('')
    try {
      const startsAt = `${form.date}T${form.time}:00-03:00`
      const endsAt = new Date(new Date(startsAt).getTime() + Number(form.duration_minutes) * 60000).toISOString()
      if (editingAppt) {
        await apiFetch(`/appointments/${editingAppt.id}`, {
          method: 'PATCH', token,
          body: JSON.stringify({
            starts_at:        startsAt,
            ends_at:          endsAt,
            duration_minutes: Number(form.duration_minutes),
            appointment_type: form.appointment_type || undefined,
            chief_complaint:  form.chief_complaint  || undefined,
          })
        })
      } else {
        await apiFetch('/appointments', {
          method: 'POST', token,
          body: JSON.stringify({
            patient_id:       patientId,
            professional_id:  professionalId,
            starts_at:        startsAt,
            duration_minutes: Number(form.duration_minutes),
            appointment_type: form.appointment_type || undefined,
            chief_complaint:  form.chief_complaint  || undefined,
          })
        })
      }
      onCreated(professionalId)
    } catch (err: any) {
      setError(err.message)
      setLoading(false)
    }
  }

  async function handleCreatePatient() {
    if (!newPatientName || !newPatientPhone.trim()) return
    setCreatingPatient(true)
    try {
      const data = await apiFetch('/patients', {
        method: 'POST', token,
        body: JSON.stringify({
          first_name: newPatientName,
          last_name:  newPatientLastName || '.',
          phone:      newPatientPhone.trim(),
        })
      })
      setSelectedPatientData(data.data)
      setPatientId(data.data.id)
      setNewPatientMode(false)
      setNewPatientName('')
      setNewPatientLastName('')
      setNewPatientPhone('')
    } catch (err: any) {
      console.error(err)
    } finally {
      setCreatingPatient(false)
    }
  }

  return (
    <div className="p-5">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-app3 uppercase tracking-wider mb-2">Paciente</label>
          {selectedPatient ? (
            <div className="flex items-center justify-between bg-surface2 rounded-xl px-4 py-3">
              <div className="font-medium text-app">
                {selectedPatient.full_name ?? `${selectedPatient.first_name ?? ''} ${selectedPatient.last_name ?? ''}`.trim()}
              </div>
              {!editingAppt && (
                <button type="button" onClick={() => { setPatientId(''); setSelectedPatientData(null); setNewPatientMode(false) }}
                  className="text-app3 hover:text-app text-sm cursor-pointer">✕</button>
              )}
            </div>
          ) : newPatientMode ? (
            <div className="bg-surface2 rounded-xl p-3 border border-[#00C4BC]/30">
              <div className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold mb-2">Nuevo paciente rápido</div>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <input type="text" value={newPatientName} onChange={e => setNewPatientName(e.target.value)}
                  placeholder="Nombre"
                  className="bg-surface3 border border-app rounded-lg px-3 py-2 text-app text-sm focus:outline-none focus:border-[#00C4BC]" />
                <input type="text" value={newPatientLastName} onChange={e => setNewPatientLastName(e.target.value)}
                  placeholder="Apellido"
                  className="bg-surface3 border border-app rounded-lg px-3 py-2 text-app text-sm focus:outline-none focus:border-[#00C4BC]" />
              </div>
              <input type="tel" value={newPatientPhone} onChange={e => setNewPatientPhone(e.target.value)}
                placeholder="Teléfono"
                className="w-full bg-surface3 border border-app rounded-lg px-3 py-2 text-app text-sm focus:outline-none focus:border-[#00C4BC] mb-2" />
              <div className="flex gap-2">
                <button type="button" onClick={() => { setNewPatientMode(false); setNewPatientPhone('') }}
                  className="flex-1 bg-surface3 text-app2 text-xs font-semibold py-2 rounded-lg transition-colors cursor-pointer">
                  Cancelar
                </button>
                <button type="button" onClick={handleCreatePatient}
                  disabled={!newPatientName || !newPatientPhone.trim() || creatingPatient}
                  className="flex-1 bg-[#00C4BC] hover:bg-[#00aaa3] disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold py-2 rounded-lg transition-colors cursor-pointer">
                  {creatingPatient ? 'Creando...' : 'Crear y usar'}
                </button>
              </div>
            </div>
          ) : (
            <div className="relative">
              <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Buscar por nombre o teléfono..."
                className="w-full bg-surface2 border border-app rounded-xl px-4 py-3 text-app text-sm focus:outline-none focus:border-[#00C4BC]"
                autoFocus />
              {search && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-surface border border-app rounded-xl shadow-xl z-50 overflow-hidden max-h-56 overflow-y-auto">
                  {searching && <div className="px-4 py-3 text-app3 text-sm">Buscando...</div>}
                  {!searching && searchResults.map(p => (
                    <div key={p.id} onClick={() => { setPatientId(p.id); setSelectedPatientData(p); setSearch('') }}
                      className="px-4 py-3 hover:bg-surface2 cursor-pointer text-sm border-b border-app last:border-0 text-app">
                      <span className="font-medium">{p.first_name} {p.last_name}</span>
                      <span className="text-app2 ml-2">{p.phone}</span>
                    </div>
                  ))}
                  {!searching && searchResults.length === 0 && <div className="px-4 py-3 text-app3 text-sm">Sin resultados</div>}
                </div>
              )}
              <button type="button" onClick={() => setNewPatientMode(true)}
                className="w-full mt-2 bg-surface2 hover:bg-surface3 border border-dashed border-app2 text-app2 hover:text-app text-xs font-semibold py-2.5 rounded-xl transition-colors cursor-pointer">
                + Crear nuevo paciente
              </button>
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-app3 uppercase tracking-wider mb-2">Fecha y horario</label>
          <div className="flex items-center gap-2">
            <div className="relative flex-1 min-w-0">
              <button
                type="button"
                onClick={() => { setShowDatePicker(v => !v); setShowStartPicker(false); setShowEndPicker(false) }}
                className="w-full flex items-center justify-between gap-1.5 bg-surface2 border border-app rounded-xl px-3 py-2.5 text-app text-sm hover:border-[#00C4BC] transition-colors cursor-pointer"
              >
                <span className="truncate capitalize">{formatDateLabel(form.date)}</span>
                <ChevronDown size={14} className="text-app3 shrink-0" />
              </button>
              {showDatePicker && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowDatePicker(false)} />
                  <div className="absolute top-full left-0 mt-1 bg-surface border border-app rounded-2xl shadow-xl z-50 p-4 w-72">
                    <div className="flex items-center justify-between mb-3">
                      <button type="button"
                        onClick={() => setCalMonth(c => {
                          const d = new Date(c.year, c.month - 1)
                          return { year: d.getFullYear(), month: d.getMonth() }
                        })}
                        className="p-1.5 rounded-lg hover:bg-surface2 text-app3 hover:text-app transition-colors cursor-pointer">
                        <ChevronLeft size={16} />
                      </button>
                      <span className="text-sm font-semibold text-app capitalize">
                        {new Date(calMonth.year, calMonth.month).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}
                      </span>
                      <button type="button"
                        onClick={() => setCalMonth(c => {
                          const d = new Date(c.year, c.month + 1)
                          return { year: d.getFullYear(), month: d.getMonth() }
                        })}
                        className="p-1.5 rounded-lg hover:bg-surface2 text-app3 hover:text-app transition-colors cursor-pointer">
                        <ChevronRight size={16} />
                      </button>
                    </div>
                    <div className="grid grid-cols-7 mb-1">
                      {['L','M','Mi','J','V','S','D'].map(d => (
                        <div key={d} className="text-center text-[10px] font-semibold text-app3 uppercase py-1">{d}</div>
                      ))}
                    </div>
                    <div className="grid grid-cols-7 gap-y-0.5">
                      {buildCalDays(calMonth.year, calMonth.month).map((day, i) => {
                        if (!day) return <div key={i} />
                        const ds = `${calMonth.year}-${String(calMonth.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                        const isSelected = form.date === ds
                        const isToday = todayStr === ds
                        return (
                          <button key={i} type="button"
                            onClick={() => { set('date', ds); onSlotChange(ds, form.time); setShowDatePicker(false) }}
                            className={`h-8 w-full flex items-center justify-center rounded-lg text-sm transition-colors cursor-pointer ${
                              isSelected
                                ? 'bg-[#00C4BC] text-white font-semibold'
                                : isToday
                                ? 'bg-[#00C4BC]/10 text-[#00C4BC] font-semibold hover:bg-[#00C4BC]/20'
                                : 'text-app hover:bg-surface2'
                            }`}
                          >
                            {day}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => { setShowStartPicker(v => !v); setShowEndPicker(false); setShowDatePicker(false) }}
                className="w-[86px] flex items-center justify-between gap-1.5 bg-surface2 border border-app rounded-xl px-3 py-2.5 text-app text-sm hover:border-[#00C4BC] transition-colors cursor-pointer"
              >
                <span>{form.time}</span>
                <ChevronDown size={14} className="text-app3 shrink-0" />
              </button>
              {showStartPicker && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowStartPicker(false)} />
                  <div className="absolute top-full left-0 mt-1 bg-surface border border-app rounded-xl shadow-xl z-50 overflow-hidden w-28 max-h-60 overflow-y-auto">
                    {START_SLOTS.map(t => {
                      const selected = form.time === t
                      return (
                        <button key={t} type="button"
                          ref={selected ? startSelectedRef : undefined}
                          onClick={() => { set('time', t); onSlotChange(form.date, t); setShowStartPicker(false) }}
                          className={`w-full px-4 py-2.5 text-sm text-left transition-colors cursor-pointer ${
                            selected ? 'bg-[#00C4BC]/10 text-[#00C4BC] font-semibold' : 'text-app hover:bg-surface2'
                          }`}
                        >
                          {t}
                        </button>
                      )
                    })}
                  </div>
                </>
              )}
            </div>
            <span className="text-app3 shrink-0 text-sm">—</span>
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => { setShowEndPicker(v => !v); setShowStartPicker(false); setShowDatePicker(false) }}
                className="w-[86px] flex items-center justify-between gap-1.5 bg-surface2 border border-app rounded-xl px-3 py-2.5 text-app text-sm hover:border-[#00C4BC] transition-colors cursor-pointer"
              >
                <span>{endTime}</span>
                <ChevronDown size={14} className="text-app3 shrink-0" />
              </button>
              {showEndPicker && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowEndPicker(false)} />
                  <div className="absolute top-full right-0 mt-1 bg-surface border border-app rounded-xl shadow-xl z-50 overflow-hidden w-44 max-h-64 overflow-y-auto">
                    {DURACIONES.map(d => {
                      const opt = addMinutes(form.time, Number(d.value))
                      const selected = form.duration_minutes === d.value
                      return (
                        <button key={d.value} type="button"
                          onClick={() => { set('duration_minutes', d.value); onDurationChange(Number(d.value)); setShowEndPicker(false) }}
                          className={`w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors cursor-pointer ${
                            selected ? 'bg-[#00C4BC]/10 text-[#00C4BC] font-semibold' : 'text-app hover:bg-surface2'
                          }`}
                        >
                          <span className="font-medium">{opt}</span>
                          <span className={`text-xs ${selected ? 'text-[#00C4BC]/70' : 'text-app3'}`}>{d.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {professionals.length > 1 && (
          <div>
            <label className="block text-xs font-semibold text-app3 uppercase tracking-wider mb-2">Profesional</label>
            <select
              value={professionalId}
              onChange={e => setProfessionalId(e.target.value)}
              className="w-full bg-surface2 border border-app rounded-xl px-4 py-2.5 text-app text-sm focus:outline-none focus:border-[#00C4BC]"
            >
              <option value="" disabled>Seleccionar profesional</option>
              {professionals.map(p => (
                <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>
              ))}
            </select>
          </div>
        )}

        {professionals.length === 0 && (
          <div className="rounded-xl border border-app bg-surface2 px-4 py-3 text-sm text-app3">
            Cargando profesionales...
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-app3 uppercase tracking-wider mb-2">Tipo de consulta</label>
          <select value={form.appointment_type} onChange={e => set('appointment_type', e.target.value)}
            className="w-full bg-surface2 border border-app rounded-xl px-4 py-2.5 text-app text-sm focus:outline-none focus:border-[#00C4BC]">
            {TIPOS.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-app3 uppercase tracking-wider mb-2">Motivo (opcional)</label>
          <input type="text" value={form.chief_complaint} onChange={e => set('chief_complaint', e.target.value)}
            placeholder="Descripción..."
            className="w-full bg-surface2 border border-app rounded-xl px-4 py-3 text-app text-sm focus:outline-none focus:border-[#00C4BC]" />
        </div>

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-600 dark:text-red-400 text-sm">{error}</div>
        )}

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose}
            className="flex-1 bg-surface2 hover:bg-surface3 border border-app text-app font-semibold py-3 rounded-xl transition-colors cursor-pointer">
            Cancelar
          </button>
          <button type="submit" disabled={loading || professionals.length === 0}
            className="flex-1 bg-[#00C4BC] hover:bg-[#00aaa3] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors cursor-pointer">
            {loading ? (editingAppt ? 'Guardando...' : 'Agendando...') : (editingAppt ? 'Guardar cambios' : 'Confirmar turno')}
          </button>
        </div>
      </form>
    </div>
  )
}

function PanelBlockForm({ token, defaultDate, defaultTime, onClose, onCreated, onBlockPreviewChange }: {
  token: string
  defaultDate: string
  defaultTime: string
  onClose: () => void
  onCreated: () => void
  onBlockPreviewChange: (p: { startDate: string; startTime: string; endTime: string; allDay: boolean }) => void
}) {
  function endFromStart(t: string) {
    const [h, m] = t.split(':').map(Number)
    const total = h * 60 + m + 60
    return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
  }

  const CHIPS = ['Almuerzo', 'Reunión', 'Vacaciones', 'Congreso']
  const [reason, setReason]       = useState('')
  const [startDate, setStartDate] = useState(defaultDate)
  const [endDate, setEndDate]     = useState(defaultDate)
  const [allDay, setAllDay]       = useState(false)
  const [startTime, setStartTime] = useState(defaultTime)
  const [endTime, setEndTime]     = useState(() => endFromStart(defaultTime))
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')

  const [showStartDatePicker, setShowStartDatePicker] = useState(false)
  const [showEndDatePicker, setShowEndDatePicker]     = useState(false)
  const [showStartTimePicker, setShowStartTimePicker] = useState(false)
  const [showEndTimePicker, setShowEndTimePicker]     = useState(false)
  const startTimeRef = useRef<HTMLButtonElement>(null)
  const endTimeRef   = useRef<HTMLButtonElement>(null)

  const [calStart, setCalStart] = useState(() => { const d = new Date(defaultDate + 'T12:00:00'); return { year: d.getFullYear(), month: d.getMonth() } })
  const [calEnd, setCalEnd]     = useState(() => { const d = new Date(defaultDate + 'T12:00:00'); return { year: d.getFullYear(), month: d.getMonth() } })

  const todayStr = getTodayStr()

  useEffect(() => {
    setStartDate(defaultDate)
    setEndDate(defaultDate)
    const d = new Date(defaultDate + 'T12:00:00')
    const cal = { year: d.getFullYear(), month: d.getMonth() }
    setCalStart(cal)
    setCalEnd(cal)
  }, [defaultDate])

  useEffect(() => {
    setStartTime(defaultTime)
    setEndTime(endFromStart(defaultTime))
  }, [defaultTime])

  useEffect(() => {
    onBlockPreviewChange({ startDate, startTime, endTime, allDay })
  }, [startDate, startTime, endTime, allDay])

  useEffect(() => {
    if (showStartTimePicker) startTimeRef.current?.scrollIntoView({ block: 'center' })
  }, [showStartTimePicker])

  useEffect(() => {
    if (showEndTimePicker) endTimeRef.current?.scrollIntoView({ block: 'center' })
  }, [showEndTimePicker])

  function closeAll() { setShowStartDatePicker(false); setShowEndDatePicker(false); setShowStartTimePicker(false); setShowEndTimePicker(false) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const startsAt = allDay ? `${startDate}T00:00:00-03:00` : `${startDate}T${startTime}:00-03:00`
    const endsAt   = allDay ? `${endDate}T23:59:59-03:00`   : `${endDate}T${endTime}:00-03:00`
    if (new Date(endsAt) <= new Date(startsAt)) { setError('La fecha/hora de fin debe ser posterior a la de inicio.'); return }
    setLoading(true)
    try {
      await apiFetch('/schedule-blocks', { method: 'POST', token, body: JSON.stringify({ starts_at: startsAt, ends_at: endsAt, reason: reason || undefined }) })
      onCreated()
    } catch (err: any) {
      setError(err.message ?? 'Error al crear el bloqueo.')
      setLoading(false)
    }
  }

  function DateBtn({ value, calState, setCalState, onChange, showPicker, setShowPicker, minDate }: {
    value: string; calState: { year: number; month: number }; setCalState: (c: { year: number; month: number }) => void
    onChange: (d: string) => void; showPicker: boolean; setShowPicker: (v: boolean) => void; minDate?: string
  }) {
    return (
      <div className="relative">
        <button type="button" onClick={() => { closeAll(); setShowPicker(!showPicker) }}
          className="w-full flex items-center justify-between gap-1.5 bg-surface2 border border-app rounded-xl px-3 py-2.5 text-app text-sm hover:border-slate-400 transition-colors cursor-pointer">
          <span className="truncate capitalize">{formatDateLabel(value)}</span>
          <ChevronDown size={14} className="text-app3 shrink-0" />
        </button>
        {showPicker && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowPicker(false)} />
            <div className="absolute top-full left-0 mt-1 bg-surface border border-app rounded-2xl shadow-xl z-50 p-4 w-72">
              <div className="flex items-center justify-between mb-3">
                <button type="button" onClick={() => setCalState({ year: new Date(calState.year, calState.month - 1).getFullYear(), month: new Date(calState.year, calState.month - 1).getMonth() })}
                  className="p-1.5 rounded-lg hover:bg-surface2 text-app3 hover:text-app transition-colors cursor-pointer"><ChevronLeft size={16} /></button>
                <span className="text-sm font-semibold text-app capitalize">
                  {new Date(calState.year, calState.month).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}
                </span>
                <button type="button" onClick={() => setCalState({ year: new Date(calState.year, calState.month + 1).getFullYear(), month: new Date(calState.year, calState.month + 1).getMonth() })}
                  className="p-1.5 rounded-lg hover:bg-surface2 text-app3 hover:text-app transition-colors cursor-pointer"><ChevronRight size={16} /></button>
              </div>
              <div className="grid grid-cols-7 mb-1">
                {['L','M','Mi','J','V','S','D'].map(d => <div key={d} className="text-center text-[10px] font-semibold text-app3 uppercase py-1">{d}</div>)}
              </div>
              <div className="grid grid-cols-7 gap-y-0.5">
                {buildCalDays(calState.year, calState.month).map((day, i) => {
                  if (!day) return <div key={i} />
                  const ds = `${calState.year}-${String(calState.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                  const isSelected = value === ds
                  const isToday = todayStr === ds
                  const disabled = minDate ? ds < minDate : false
                  return (
                    <button key={i} type="button" disabled={disabled}
                      onClick={() => { onChange(ds); setShowPicker(false) }}
                      className={`h-8 w-full flex items-center justify-center rounded-lg text-sm transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer ${
                        isSelected ? 'bg-slate-500 text-white font-semibold'
                        : isToday  ? 'bg-slate-500/10 text-slate-600 dark:text-slate-300 font-semibold hover:bg-slate-500/20'
                        : 'text-app hover:bg-surface2'
                      }`}>{day}</button>
                  )
                })}
              </div>
            </div>
          </>
        )}
      </div>
    )
  }

  function TimeBtn({ value, refEl, showPicker, setShowPicker, onChange }: {
    value: string; refEl: React.RefObject<HTMLButtonElement | null>; showPicker: boolean; setShowPicker: (v: boolean) => void; onChange: (t: string) => void
  }) {
    return (
      <div className="relative">
        <button type="button" onClick={() => { closeAll(); setShowPicker(!showPicker) }}
          className="w-[86px] flex items-center justify-between gap-1.5 bg-surface2 border border-app rounded-xl px-3 py-2.5 text-app text-sm hover:border-slate-400 transition-colors cursor-pointer">
          <span>{value}</span>
          <ChevronDown size={14} className="text-app3 shrink-0" />
        </button>
        {showPicker && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowPicker(false)} />
            <div className="absolute top-full left-0 mt-1 bg-surface border border-app rounded-xl shadow-xl z-50 overflow-hidden w-28 max-h-60 overflow-y-auto">
              {START_SLOTS.map(t => {
                const selected = value === t
                return (
                  <button key={t} type="button"
                    ref={selected ? refEl : undefined}
                    onClick={() => { onChange(t); setShowPicker(false) }}
                    className={`w-full px-4 py-2.5 text-sm text-left transition-colors cursor-pointer ${selected ? 'bg-slate-500/10 text-slate-600 dark:text-slate-300 font-semibold' : 'text-app hover:bg-surface2'}`}>
                    {t}
                  </button>
                )
              })}
            </div>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="p-5">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-xs font-semibold text-app3 uppercase tracking-wider mb-2">Motivo del bloqueo</label>
          <input type="text" value={reason} onChange={e => setReason(e.target.value)}
            placeholder="¿Por qué bloqueás este horario?" autoFocus
            className="w-full bg-surface2 border border-app rounded-xl px-4 py-3 text-app text-sm focus:outline-none focus:border-slate-400" />
          <div className="flex flex-wrap gap-2 mt-2.5">
            {CHIPS.map(chip => (
              <button key={chip} type="button" onClick={() => setReason(chip)}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors border cursor-pointer ${
                  reason === chip ? 'bg-slate-500 text-white border-slate-500' : 'bg-surface2 border-app text-app3 hover:text-app hover:border-slate-400'
                }`}>{chip}</button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-app3 uppercase tracking-wider mb-2">Fecha y horario</label>
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <DateBtn value={startDate} calState={calStart} setCalState={setCalStart}
                onChange={d => { setStartDate(d); if (d > endDate) { setEndDate(d); setCalEnd(calStart) } }}
                showPicker={showStartDatePicker} setShowPicker={setShowStartDatePicker} />
            </div>
            {!allDay && (
              <>
                <TimeBtn value={startTime} refEl={startTimeRef} showPicker={showStartTimePicker} setShowPicker={setShowStartTimePicker} onChange={setStartTime} />
                <span className="text-app3 shrink-0 text-sm">—</span>
                <TimeBtn value={endTime} refEl={endTimeRef} showPicker={showEndTimePicker} setShowPicker={setShowEndTimePicker} onChange={setEndTime} />
              </>
            )}
          </div>
          {endDate !== startDate && (
            <div className="mt-2">
              <label className="block text-xs font-semibold text-app3 uppercase tracking-wider mb-2">Fecha fin</label>
              <DateBtn value={endDate} calState={calEnd} setCalState={setCalEnd}
                onChange={setEndDate} showPicker={showEndDatePicker} setShowPicker={setShowEndDatePicker} minDate={startDate} />
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button type="button" onClick={() => setAllDay(v => !v)}
            className={`relative w-11 h-6 rounded-full transition-colors shrink-0 cursor-pointer ${allDay ? 'bg-slate-500' : 'bg-surface3'}`}>
            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${allDay ? 'left-5' : 'left-0.5'}`} />
          </button>
          <span className="text-sm text-app2">Todo el día</span>
          {startDate !== endDate && allDay && (
            <button type="button" onClick={() => setEndDate(startDate)} className="ml-auto text-xs text-app3 hover:text-app underline cursor-pointer">
              solo {formatDateLabel(startDate).split(' ').slice(1).join(' ')}
            </button>
          )}
        </div>

        {!allDay && endDate !== startDate && (
          <div className="flex items-center gap-2 pt-1">
            <span className="text-xs text-app3 shrink-0">Fin:</span>
            <div className="flex-1 min-w-0">
              <DateBtn value={endDate} calState={calEnd} setCalState={setCalEnd}
                onChange={setEndDate} showPicker={showEndDatePicker} setShowPicker={setShowEndDatePicker} minDate={startDate} />
            </div>
            <TimeBtn value={endTime} refEl={endTimeRef} showPicker={showEndTimePicker} setShowPicker={setShowEndTimePicker} onChange={setEndTime} />
          </div>
        )}

        {error && <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-600 dark:text-red-400 text-sm">{error}</div>}

        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose}
            className="flex-1 bg-surface2 hover:bg-surface3 border border-app text-app font-semibold py-3 rounded-xl transition-colors cursor-pointer">
            Cancelar
          </button>
          <button type="submit" disabled={loading}
            className="flex-1 bg-slate-600 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer">
            <Lock size={14} />
            {loading ? 'Bloqueando...' : 'Bloquear'}
          </button>
        </div>
      </form>
    </div>
  )
}
