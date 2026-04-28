'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { apiFetch } from '@/lib/api'
import { useRouter } from 'next/navigation'
import { Play, CheckCircle, XCircle, UserCheck, CreditCard, Clock, CalendarDays, MoreHorizontal } from 'lucide-react'

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null)
  const [agenda, setAgenda] = useState<any[]>([])
  const [stats, setStats] = useState<any>({})
  const [inactive, setInactive] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showNotesModal, setShowNotesModal] = useState(false)
  const [pendingAppt, setPendingAppt] = useState<any>(null)
  const [clinicalNotes, setClinicalNotes] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [paymentTotal, setPaymentTotal] = useState('')
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [confirmLoading, setConfirmLoading] = useState(false)
  const [attendedDone, setAttendedDone] = useState(false)
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      // Verificar sesión
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/')
        return
      }

      const token = session.access_token

      // Cargar perfil + agenda + stats en paralelo
      const [meData, agendaData, statsData, inactiveData] = await Promise.all([
        apiFetch('/auth/me', { token }),
        apiFetch('/appointments/today', { token }),
        apiFetch('/appointments/stats/today', { token }),
        apiFetch('/patients/alerts/inactive?days=90', { token }),
      ])

      setUser(meData.data)
      setAgenda(agendaData.data ?? [])
      setStats(statsData.data ?? {})
      setInactive(inactiveData.data ?? [])
      setLoading(false)

      // Identificar usuario en PostHog
      const posthog = (await import('posthog-js')).default
      posthog.identify(meData.data.id, {
        name: `${meData.data.first_name} ${meData.data.last_name}`,
        email: meData.data.email,
        clinic: meData.data.clinic_id,
        role: meData.data.role,
      })

    }

    load()
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-app">
        <main className="p-6 max-w-6xl mx-auto animate-pulse">
          {/* Greeting skeleton */}
          <div className="mb-6">
            <div className="h-8 bg-surface2 rounded-lg w-64 mb-2" />
            <div className="h-4 bg-surface2 rounded w-40" />
          </div>
          {/* KPIs skeleton */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-surface border border-app rounded-xl p-4">
                <div className="h-3 bg-surface2 rounded w-20 mb-3" />
                <div className="h-7 bg-surface2 rounded w-16 mb-2" />
                <div className="h-3 bg-surface2 rounded w-24" />
              </div>
            ))}
          </div>
          {/* Agenda skeleton */}
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-surface border border-app rounded-xl p-4 flex items-center gap-4">
                <div className="h-10 w-10 bg-surface2 rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-surface2 rounded w-40" />
                  <div className="h-3 bg-surface2 rounded w-24" />
                </div>
                <div className="h-6 bg-surface2 rounded-full w-20" />
              </div>
            ))}
          </div>
        </main>
      </div>
    )
  }

  const today = new Date().toLocaleDateString('es-AR', {
    weekday: 'long', day: 'numeric', month: 'long'
  })

  // ── Alertas de acción computadas de la agenda ──
  const now = new Date()

  const nextAppt = agenda
    .filter(a => !['completed', 'absent', 'cancelled'].includes(a.status) && new Date(a.starts_at) > now)
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())[0] ?? null

  const minutesUntilNext = nextAppt
    ? Math.round((new Date(nextAppt.starts_at).getTime() - now.getTime()) / 60000)
    : null

  const unconfirmedCount = agenda.filter(a => a.status === 'pending').length
  const inProgressCount  = agenda.filter(a => a.status === 'in_progress').length

  type ActionAlert = { key: string; label: string; urgency: 'ok' | 'warn' | 'alert'; onClick?: () => void }
  const actionAlerts: ActionAlert[] = []

  if (inProgressCount > 0) {
    actionAlerts.push({
      key: 'in_progress',
      label: inProgressCount === 1 ? '1 paciente en atención ahora' : `${inProgressCount} pacientes en atención`,
      urgency: 'ok',
    })
  }

  if (nextAppt && minutesUntilNext !== null) {
    const label = minutesUntilNext <= 0
      ? `${nextAppt.patient_name} debería estar llegando`
      : minutesUntilNext === 1
        ? `${nextAppt.patient_name} en 1 min`
        : `${nextAppt.patient_name} en ${minutesUntilNext} min`
    actionAlerts.push({
      key: 'next',
      label,
      urgency: minutesUntilNext <= 5 ? 'alert' : minutesUntilNext <= 15 ? 'warn' : 'ok',
    })
  }

  if (unconfirmedCount > 0) {
    actionAlerts.push({
      key: 'unconfirmed',
      label: unconfirmedCount === 1
        ? '1 turno sin confirmar'
        : `${unconfirmedCount} turnos sin confirmar`,
      urgency: unconfirmedCount >= 3 ? 'alert' : 'warn',
    })
  }

  async function markStatus(id: string, status: string) {
    setActionLoading(`${id}:${status}`)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setActionLoading(null); return }
    await apiFetch(`/appointments/${id}`, {
      method: 'PATCH',
      token: session.access_token,
      body: JSON.stringify({ status })
    })
    const [agendaData, statsData] = await Promise.all([
      apiFetch('/appointments/today', { token: session.access_token }),
      apiFetch('/appointments/stats/today', { token: session.access_token }),
    ])
    setAgenda(agendaData.data ?? [])
    setStats(statsData.data ?? {})
    setActionLoading(null)
  }

  function formatDuration(min: number) {
    if (!min) return ''
    return min < 60 ? `${min} min` : `${Math.floor(min / 60)}h${min % 60 ? ` ${min % 60}min` : ''}`
  }

  function closeNotesModal() {
    setShowNotesModal(false)
    setPendingAppt(null)
    setClinicalNotes('')
    setPaymentTotal('')
    setPaymentAmount('')
    setPaymentMethod('cash')
    setAttendedDone(false)
  }

  async function confirmAttended() {
    if (!pendingAppt) return
    setConfirmLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setConfirmLoading(false); return }

    await apiFetch(`/appointments/${pendingAppt.id}/complete`, {
      method: 'POST',
      token: session.access_token,
      body: JSON.stringify({ clinical_notes: clinicalNotes || undefined })
    })

    const amount = parseFloat(paymentAmount)
    const total = parseFloat(paymentTotal)
    if (!isNaN(amount) && amount > 0) {
      await apiFetch('/payments', {
        method: 'POST',
        token: session.access_token,
        body: JSON.stringify({
          patient_id:     pendingAppt.patient_id,
          appointment_id: pendingAppt.id,
          amount,
          method:         paymentMethod,
          ...(!isNaN(total) && total > 0 ? { total_amount: total } : {}),
        })
      })
    } else if (!isNaN(total) && total > 0) {
      // Registra deuda sin pago inicial
      await apiFetch('/payments', {
        method: 'POST',
        token: session.access_token,
        body: JSON.stringify({
          patient_id:     pendingAppt.patient_id,
          appointment_id: pendingAppt.id,
          amount:         0,
          method:         paymentMethod,
          total_amount:   total,
        })
      })
    }

    const [agendaData, statsData] = await Promise.all([
      apiFetch('/appointments/today', { token: session.access_token }),
      apiFetch('/appointments/stats/today', { token: session.access_token }),
    ])
    setAgenda(agendaData.data ?? [])
    setStats(statsData.data ?? {})
    setConfirmLoading(false)
    setAttendedDone(true)
  }

  // ── Helpers de status ──────────────────────
  const STATUS_CONFIG: Record<string, { label: string; dot: string; text: string; bg: string }> = {
    pending:     { label: 'Sin confirmar', dot: 'bg-amber-400',      text: 'text-amber-400',      bg: 'bg-amber-400/10 border-amber-400/20' },
    confirmed:   { label: 'Confirmado',    dot: 'bg-[#00C4BC]',      text: 'text-[#00C4BC]',      bg: 'bg-[#E6F8F1] border-[#00C4BC]/20' },
    in_progress: { label: 'En atención',   dot: 'bg-violet-400 animate-pulse', text: 'text-violet-400', bg: 'bg-violet-400/10 border-violet-400/20' },
    completed:   { label: 'Atendido',      dot: 'bg-app3',           text: 'text-app3',           bg: 'bg-surface2 border-app' },
    absent:      { label: 'No vino',       dot: 'bg-red-400',        text: 'text-red-400',        bg: 'bg-red-400/10 border-red-400/20' },
    cancelled:   { label: 'Cancelado',     dot: 'bg-app3',           text: 'text-app3',           bg: 'bg-surface2 border-app' },
  }

  const currentlyInProgress = agenda.filter(a => a.status === 'in_progress')
  const restOfAgenda = agenda.filter(a => a.status !== 'in_progress')

  return (
    <div className="min-h-screen bg-app text-app" onClick={() => openDropdown && setOpenDropdown(null)}>
      <main className="p-6 max-w-4xl mx-auto">

        {/* Greeting */}
        <div className="mb-5">
          <h2 className="text-2xl font-bold">Buenos días, Od. {user?.first_name}</h2>
          <p className="text-app2 mt-0.5 capitalize">{today}</p>
        </div>

        {/* Alertas de acción */}
        {actionAlerts.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-5">
            {actionAlerts.map(alert => (
              <div
                key={alert.key}
                className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-sm font-semibold border
                  ${alert.urgency === 'alert' ? 'bg-red-500/10 border-red-400/30 text-red-400'
                    : alert.urgency === 'warn'  ? 'bg-amber-500/10 border-amber-400/30 text-amber-400'
                    : 'bg-[#E6F8F1] border-[#00C4BC]/30 text-[#00C4BC]'}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                  alert.urgency === 'alert' ? 'bg-red-400 animate-pulse'
                  : alert.urgency === 'warn' ? 'bg-amber-400'
                  : 'bg-[#00C4BC]'}`} />
                {alert.label}
              </div>
            ))}
          </div>
        )}

        {/* ── HERO: paciente en atención ─────────────── */}
        {currentlyInProgress.map(appt => (
          <div key={appt.id} className="mb-5 bg-surface border-2 border-violet-400/30 rounded-2xl p-5 relative overflow-hidden">
            <div className="absolute inset-0 bg-violet-400/5 pointer-events-none" />
            <div className="relative">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
                <span className="text-xs font-bold text-violet-400 uppercase tracking-wider">En atención ahora</span>
              </div>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xl font-bold text-app">{appt.patient_name}</div>
                  <div className="flex items-center gap-3 mt-1 text-sm text-app2">
                    {appt.appointment_type && <span>{appt.appointment_type}</span>}
                    {appt.duration_minutes && (
                      <span className="flex items-center gap-1">
                        <Clock size={13} />
                        {formatDuration(appt.duration_minutes)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    disabled={actionLoading === `${appt.id}:completed`}
                    onClick={() => { setPendingAppt(appt); setShowNotesModal(true) }}
                    className="flex items-center gap-1.5 bg-[#00C4BC] hover:bg-[#00aaa3] disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-all active:scale-95"
                  >
                    <CheckCircle size={15} />
                    Atendido
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* KPIs operativos */}
        {(() => {
          const pendingCount   = agenda.filter(a => a.status === 'pending').length
          const confirmedCount = agenda.filter(a => a.status === 'confirmed').length
          const byConfirm      = pendingCount + confirmedCount

          const nextLabel = minutesUntilNext === null
            ? '—'
            : minutesUntilNext <= 0
              ? 'Ahora'
              : minutesUntilNext === 1
                ? '1 min'
                : `${minutesUntilNext} min`

          const nextColor = minutesUntilNext === null
            ? 'text-app3'
            : minutesUntilNext <= 5
              ? 'text-red-400'
              : minutesUntilNext <= 15
                ? 'text-amber-400'
                : 'text-[#00C4BC]'

          return (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
              <div className="bg-surface border border-app rounded-xl p-4">
                <div className="text-xs text-app3 uppercase tracking-wider mb-1">Turnos hoy</div>
                <div className="text-2xl font-bold text-[#00C4BC]">{stats.total ?? agenda.length}</div>
                <div className="text-xs text-app3 mt-1">agendados</div>
              </div>
              <div className="bg-surface border border-app rounded-xl p-4">
                <div className="text-xs text-app3 uppercase tracking-wider mb-1">Atendidos</div>
                <div className="text-2xl font-bold text-[#00C4BC]">{stats.completed ?? 0}</div>
                <div className="text-xs text-app3 mt-1">
                  {(stats.total ?? 0) > 0 ? `de ${stats.total}` : 'hoy'}
                </div>
              </div>
              <div className="bg-surface border border-app rounded-xl p-4">
                <div className="text-xs text-app3 uppercase tracking-wider mb-1">Por confirmar</div>
                <div className={`text-2xl font-bold ${byConfirm > 0 ? 'text-amber-400' : 'text-[#00C4BC]'}`}>
                  {byConfirm}
                </div>
                <div className="text-xs text-app3 mt-1">
                  {pendingCount > 0 ? `${pendingCount} sin confirmar` : confirmedCount > 0 ? `${confirmedCount} confirmados` : 'al día'}
                </div>
              </div>
              <div className="bg-surface border border-app rounded-xl p-4">
                <div className="text-xs text-app3 uppercase tracking-wider mb-1">Próximo turno</div>
                <div className={`text-2xl font-bold ${nextColor}`}>{nextLabel}</div>
                <div className="text-xs text-app3 mt-1 truncate">
                  {nextAppt ? nextAppt.patient_name : 'Sin turnos pendientes'}
                </div>
              </div>
            </div>
          )
        })()}

        {/* ── AGENDA ────────────────────────────────── */}
        <div className="bg-surface border border-app rounded-xl overflow-visible mb-5">
          <div className="px-5 py-4 border-b border-app flex items-center justify-between">
            <h3 className="font-semibold">Agenda de hoy</h3>
            <span className="text-sm text-app3">{agenda.length} turnos</span>
          </div>

          {agenda.length === 0 ? (
            <div className="px-5 py-12 text-center text-app3 text-sm">No hay turnos para hoy</div>
          ) : (
            <div className="divide-y divide-app">
              {restOfAgenda.map((appt: any) => {
                const cfg = STATUS_CONFIG[appt.status] ?? STATUS_CONFIG.pending
                const isDone = ['completed', 'absent', 'cancelled'].includes(appt.status)
                return (
                  <div
                    key={appt.id}
                    className={`px-5 py-4 flex items-center gap-4 transition-colors ${isDone ? 'opacity-60' : 'hover:bg-surface2/50'}`}
                  >
                    {/* Hora */}
                    <div className="tabular-nums text-sm font-medium text-app2 w-10 flex-shrink-0 leading-tight">
                      {new Date(appt.starts_at).toLocaleTimeString('es-AR', {
                        hour: '2-digit', minute: '2-digit', hour12: false,
                        timeZone: 'America/Argentina/Buenos_Aires'
                      })}
                    </div>

                    {/* Info paciente */}
                    <div className="flex-1 min-w-0">
                      <div className={`font-semibold truncate ${isDone ? '' : 'text-app'}`}>
                        {appt.patient_name}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-app3">
                        {appt.appointment_type && <span className="truncate">{appt.appointment_type}</span>}
                        {appt.duration_minutes && (
                          <span className="flex items-center gap-0.5 flex-shrink-0">
                            <Clock size={11} />
                            {formatDuration(appt.duration_minutes)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Badge + acciones */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {/* Badge de estado */}
                      <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${cfg.bg} ${cfg.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
                        {cfg.label}
                      </span>

                      {/* Mobile: dropdown de acciones */}
                      {!isDone && (appt.status === 'pending' || appt.status === 'confirmed' || appt.status === 'in_progress') && (
                        <div className="relative sm:hidden">
                          <button
                            disabled={!!actionLoading}
                            onClick={() => setOpenDropdown(openDropdown === appt.id ? null : appt.id)}
                            className="p-1.5 rounded-lg bg-surface2 text-app2 hover:bg-surface3 disabled:opacity-40 transition-colors"
                          >
                            <MoreHorizontal size={15} />
                          </button>
                          {openDropdown === appt.id && (
                            <div className="absolute right-0 top-full mt-1 z-50 bg-surface border border-app rounded-xl shadow-lg overflow-hidden min-w-[140px]">
                              {appt.status === 'pending' && (
                                <>
                                  <button
                                    disabled={!!actionLoading}
                                    onClick={() => { markStatus(appt.id, 'confirmed'); setOpenDropdown(null) }}
                                    className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-[#00C4BC] hover:bg-surface2 disabled:opacity-40 transition-colors"
                                  >
                                    <UserCheck size={14} /> Confirmar
                                  </button>
                                  <button
                                    disabled={!!actionLoading}
                                    onClick={() => { markStatus(appt.id, 'absent'); setOpenDropdown(null) }}
                                    className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-red-400 hover:bg-surface2 disabled:opacity-40 transition-colors"
                                  >
                                    <XCircle size={14} /> No vino
                                  </button>
                                </>
                              )}
                              {appt.status === 'confirmed' && (
                                <>
                                  <button
                                    disabled={!!actionLoading}
                                    onClick={() => { markStatus(appt.id, 'in_progress'); setOpenDropdown(null) }}
                                    className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-violet-400 hover:bg-surface2 disabled:opacity-40 transition-colors"
                                  >
                                    <Play size={14} /> Iniciar
                                  </button>
                                  <button
                                    disabled={!!actionLoading}
                                    onClick={() => { markStatus(appt.id, 'absent'); setOpenDropdown(null) }}
                                    className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-red-400 hover:bg-surface2 disabled:opacity-40 transition-colors"
                                  >
                                    <XCircle size={14} /> No vino
                                  </button>
                                </>
                              )}
                              {appt.status === 'in_progress' && (
                                <button
                                  disabled={!!actionLoading}
                                  onClick={() => { setPendingAppt(appt); setShowNotesModal(true); setOpenDropdown(null) }}
                                  className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-[#00C4BC] hover:bg-surface2 disabled:opacity-40 transition-colors"
                                >
                                  <CheckCircle size={14} /> Atendido
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Desktop: botones directos */}
                      {appt.status === 'pending' && (
                        <div className="hidden sm:flex items-center gap-2">
                          <button
                            disabled={!!actionLoading}
                            onClick={() => markStatus(appt.id, 'confirmed')}
                            className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-[#E6F8F1] text-[#00C4BC] hover:bg-[#00C4BC] hover:text-white disabled:opacity-40 transition-all active:scale-95"
                          >
                            <UserCheck size={13} /> Confirmar
                          </button>
                          <button
                            disabled={!!actionLoading}
                            onClick={() => markStatus(appt.id, 'absent')}
                            className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-surface2 text-app2 hover:bg-red-400/10 hover:text-red-400 disabled:opacity-40 transition-all active:scale-95"
                          >
                            <XCircle size={13} /> No vino
                          </button>
                        </div>
                      )}

                      {appt.status === 'confirmed' && (
                        <div className="hidden sm:flex items-center gap-2">
                          <button
                            disabled={!!actionLoading}
                            onClick={() => markStatus(appt.id, 'in_progress')}
                            className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-violet-400/10 text-violet-400 hover:bg-violet-400 hover:text-white disabled:opacity-40 transition-all active:scale-95"
                          >
                            <Play size={13} /> Iniciar
                          </button>
                          <button
                            disabled={!!actionLoading}
                            onClick={() => markStatus(appt.id, 'absent')}
                            className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-surface2 text-app2 hover:bg-red-400/10 hover:text-red-400 disabled:opacity-40 transition-all active:scale-95"
                          >
                            <XCircle size={13} /> No vino
                          </button>
                        </div>
                      )}

                      {appt.status === 'in_progress' && (
                        <button
                          disabled={!!actionLoading}
                          onClick={() => { setPendingAppt(appt); setShowNotesModal(true) }}
                          className="hidden sm:flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-[#00C4BC] text-white hover:bg-[#00aaa3] disabled:opacity-40 transition-all active:scale-95"
                        >
                          <CheckCircle size={13} /> Atendido
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Pacientes inactivos */}
        {inactive.length > 0 && (
          <div className="bg-amber-950/20 border border-amber-800/40 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-amber-800/30 flex items-center justify-between">
              <h3 className="font-semibold text-amber-400 text-sm">Sin turno hace +90 días</h3>
              <span className="text-xs font-bold bg-amber-500/20 text-amber-400 px-2 py-1 rounded-full">{inactive.length}</span>
            </div>
            <div className="divide-y divide-amber-800/20">
              {inactive.slice(0, 5).map((p: any) => (
                <div key={p.id} className="px-5 py-3 flex items-center gap-3 hover:bg-amber-900/10 transition-colors">
                  <div className="w-8 h-8 rounded-full bg-amber-900/40 flex items-center justify-center text-amber-400 text-xs font-bold flex-shrink-0">
                    {p.first_name[0]}{p.last_name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{p.first_name} {p.last_name}</div>
                    <div className="text-xs text-app3">
                      {p.last_appointment_at
                        ? new Date(p.last_appointment_at).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })
                        : 'Sin turnos previos'}
                    </div>
                  </div>
                  <a
                    href={`https://wa.me/${p.phone.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs bg-[#E6F8F1] hover:bg-[#00C4BC] hover:text-white active:scale-95 text-[#00C4BC] px-3 py-1.5 rounded-lg transition-all font-semibold flex-shrink-0"
                  >
                    WhatsApp
                  </a>
                </div>
              ))}
              {inactive.length > 5 && (
                <div className="px-5 py-3 text-center text-sm text-app3">+{inactive.length - 5} pacientes más</div>
              )}
            </div>
          </div>
        )}

      </main>

      {/* Modal — Confirmar atención */}
      {showNotesModal && pendingAppt && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4"
          onClick={() => !confirmLoading && closeNotesModal()}
        >
          <div className="bg-surface border border-app rounded-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>

            {attendedDone ? (
              /* ── Paso 2: atendido confirmado ── */
              <div className="px-6 py-8 text-center">
                <div className="w-12 h-12 rounded-full bg-[#E6F8F1] flex items-center justify-center mx-auto mb-4">
                  <CheckCircle size={24} className="text-[#00C4BC]" />
                </div>
                <div className="font-bold text-lg text-app mb-1">{pendingAppt.patient_name}</div>
                <div className="text-app3 text-sm mb-6">Turno registrado correctamente</div>
                <div className="space-y-2">
                  <button
                    onClick={() => router.push('/agenda')}
                    className="w-full bg-[#00C4BC] hover:bg-[#00aaa3] active:scale-95 text-white font-semibold py-3 rounded-xl transition-all text-sm flex items-center justify-center gap-2"
                  >
                    <CalendarDays size={16} />
                    Coordinar próximo turno
                  </button>
                  <button
                    onClick={closeNotesModal}
                    className="w-full bg-surface2 hover:bg-surface3 text-app2 font-semibold py-3 rounded-xl transition-colors text-sm"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            ) : (
              /* ── Paso 1: notas + cobro ── */
              <>
                <div className="px-6 pt-6 pb-4">
                  <div className="w-9 h-1 bg-surface3 rounded-full mx-auto mb-5 sm:hidden" />
                  <div className="font-bold text-lg">{pendingAppt.patient_name}</div>
                  <div className="text-app2 text-sm">{pendingAppt.appointment_type}</div>
                </div>

                <div className="px-6 pb-4 space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-app2 uppercase tracking-wider mb-2">
                      Notas de la consulta (opcional)
                    </label>
                    <textarea
                      value={clinicalNotes}
                      onChange={e => setClinicalNotes(e.target.value)}
                      rows={3}
                      placeholder="Procedimiento realizado, observaciones, indicaciones..."
                      className="w-full bg-surface2 border border-app rounded-xl px-4 py-3 text-app text-sm focus:outline-none focus:border-[#00C4BC] resize-none"
                      autoFocus
                    />
                  </div>

                  <div className="bg-surface2 border border-app rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <CreditCard size={14} className="text-[#00C4BC]" />
                      <span className="text-xs font-semibold text-app2 uppercase tracking-wider">Registrar cobro (opcional)</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <div>
                        <label className="block text-xs text-app3 mb-1">Total tratamiento</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-app3 text-sm font-medium">$</span>
                          <input
                            type="number"
                            min="0"
                            value={paymentTotal}
                            onChange={e => setPaymentTotal(e.target.value)}
                            placeholder="0"
                            className="w-full bg-surface border border-app rounded-lg pl-7 pr-3 py-2 text-app text-sm focus:outline-none focus:border-[#00C4BC]"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs text-app3 mb-1">Entregado</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-app3 text-sm font-medium">$</span>
                          <input
                            type="number"
                            min="0"
                            value={paymentAmount}
                            onChange={e => setPaymentAmount(e.target.value)}
                            placeholder="0"
                            className="w-full bg-surface border border-app rounded-lg pl-7 pr-3 py-2 text-app text-sm focus:outline-none focus:border-[#00C4BC]"
                          />
                        </div>
                      </div>
                    </div>
                    <select
                      value={paymentMethod}
                      onChange={e => setPaymentMethod(e.target.value)}
                      className="w-full bg-surface border border-app rounded-lg px-3 py-2 text-app text-sm focus:outline-none focus:border-[#00C4BC]"
                    >
                      <option value="cash">Efectivo</option>
                      <option value="debit_card">Débito</option>
                      <option value="credit_card">Crédito</option>
                      <option value="bank_transfer">Transferencia</option>
                      <option value="qr">QR</option>
                      <option value="insurance">Obra social</option>
                      <option value="other">Otro</option>
                    </select>
                    {(() => {
                      const total = parseFloat(paymentTotal)
                      const paid = parseFloat(paymentAmount)
                      const remaining = !isNaN(total) && total > 0 && !isNaN(paid) ? total - paid : 0
                      if (remaining > 0) return (
                        <div className="flex items-center gap-2 mt-2 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
                          <span className="text-xs text-amber-600 dark:text-amber-400 font-semibold">Queda debiendo</span>
                          <span className="text-sm font-bold text-amber-500">${remaining.toLocaleString('es-AR')}</span>
                        </div>
                      )
                      if (!isNaN(total) && total > 0 && !isNaN(paid) && paid >= total) return (
                        <div className="mt-2 bg-[#E6F8F1] border border-[#00C4BC]/30 rounded-lg px-3 py-2">
                          <span className="text-xs text-[#00C4BC] font-semibold">✓ Pago completo</span>
                        </div>
                      )
                      return null
                    })()}
                  </div>
                </div>

                <div className="px-6 pb-6 flex gap-2">
                  <button
                    onClick={closeNotesModal}
                    disabled={confirmLoading}
                    className="flex-1 bg-surface2 hover:bg-surface3 disabled:opacity-50 text-app font-semibold py-3 rounded-xl transition-colors text-sm"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={confirmAttended}
                    disabled={confirmLoading}
                    className="flex-1 bg-[#00C4BC] hover:bg-[#00aaa3] active:scale-95 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-all text-sm"
                  >
                    {confirmLoading ? 'Guardando...' : 'Confirmar'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
