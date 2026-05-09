'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { apiFetch } from '@/lib/api'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import { useSubscription } from '@/lib/useSubscription'
import { usePlansModal } from '@/app/providers'

const DAYS = [
  { key: 0, label: 'Lunes' },
  { key: 1, label: 'Martes' },
  { key: 2, label: 'Miércoles' },
  { key: 3, label: 'Jueves' },
  { key: 4, label: 'Viernes' },
  { key: 5, label: 'Sábado' },
  { key: 6, label: 'Domingo' },
]

export type DayHours = { enabled: boolean; start: string; end: string }
export type WorkingHours = Record<number, DayHours>

export const DEFAULT_WORKING_HOURS: WorkingHours = {
  0: { enabled: true,  start: '09:00', end: '18:00' },
  1: { enabled: true,  start: '09:00', end: '18:00' },
  2: { enabled: true,  start: '09:00', end: '18:00' },
  3: { enabled: true,  start: '09:00', end: '18:00' },
  4: { enabled: true,  start: '09:00', end: '18:00' },
  5: { enabled: false, start: '09:00', end: '13:00' },
  6: { enabled: false, start: '09:00', end: '13:00' },
}

const PLAN_LABELS: Record<string, string> = {
  trial:      'Prueba gratuita',
  basic:      'Starter',
  pro:        'Growth',
  clinic:     'Scale',
  enterprise: 'Enterprise',
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  trialing:  { label: 'En prueba',  color: 'text-blue-500' },
  active:    { label: 'Activo',     color: 'text-[#00C4BC]' },
  past_due:  { label: 'Vencido',    color: 'text-red-500' },
  canceled:  { label: 'Cancelado',  color: 'text-red-500' },
  expired:   { label: 'Expirado',   color: 'text-red-500' },
}

function PlanCard() {
  const { data: sub, loading } = useSubscription()
  const { openPlansModal } = usePlansModal()

  if (loading) {
    return (
      <div className="bg-surface border border-app rounded-2xl p-5 mb-8 animate-pulse">
        <div className="h-5 bg-surface2 rounded w-32 mb-3" />
        <div className="h-3 bg-surface2 rounded w-48 mb-4" />
        <div className="h-2 bg-surface2 rounded-full w-full" />
      </div>
    )
  }

  if (!sub) return null

  const planLabel = PLAN_LABELS[sub.plan] ?? sub.planName ?? sub.plan
  const statusInfo = STATUS_LABELS[sub.status] ?? { label: sub.status, color: 'text-app3' }

  // Determine which countdown to show: trial first, then subscription
  let daysLeft: number | null = null
  let totalDays: number | null = null
  let endsAt: string | null = null
  let countdownLabel = ''

  if (sub.trial.active && sub.trial.daysLeft !== null) {
    daysLeft = sub.trial.daysLeft
    totalDays = 14
    endsAt = sub.trial.endsAt
    countdownLabel = 'Prueba gratuita'
  } else if (sub.subscription.daysLeft !== null && !sub.subscription.expired) {
    daysLeft = sub.subscription.daysLeft
    totalDays = 30
    endsAt = sub.subscription.endsAt
    countdownLabel = 'Suscripción activa'
  }

  const progress = daysLeft !== null && totalDays !== null
    ? Math.max(0, Math.min(100, Math.round((daysLeft / totalDays) * 100)))
    : null

  const barColor = daysLeft !== null && daysLeft <= 3
    ? 'bg-red-500'
    : daysLeft !== null && daysLeft <= 7
    ? 'bg-yellow-400'
    : 'bg-[#00C4BC]'

  const formattedDate = endsAt
    ? new Date(endsAt).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })
    : null

  return (
    <div className="bg-surface border border-app rounded-2xl p-5 mb-8">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-base font-semibold text-app">{planLabel}</span>
            <span className={`text-xs font-medium ${statusInfo.color}`}>· {statusInfo.label}</span>
          </div>
          {formattedDate && (
            <p className="text-xs text-app3">
              {sub.trial.expired || sub.subscription.expired
                ? 'Venció el '
                : 'Vence el '}{formattedDate}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-1 text-right shrink-0 ml-auto">
          <div className="flex gap-6 justify-end">
            {sub.features.maxPatients !== null && (
              <div>
                <p className="text-xs text-app3">Pacientes</p>
                <p className="text-sm font-semibold text-app">
                  {sub.usage.patients} / {sub.features.maxPatients}
                </p>
              </div>
            )}
            {sub.features.maxProfessionals !== null && (
              <div>
                <p className="text-xs text-app3">Profesionales</p>
                <p className="text-sm font-semibold text-app">
                  {sub.usage.professionals} / {sub.features.maxProfessionals}
                </p>
              </div>
            )}
          </div>
          {sub.features.waMsgMonthlyQuota !== null && (
            <div>
              <p className="text-xs text-app3">WhatsApp este mes</p>
              <p className="text-sm font-semibold text-app">
                {sub.usage.waMsgUsedThisMonth} / {sub.features.waMsgMonthlyQuota}
              </p>
            </div>
          )}
        </div>
      </div>

      {progress !== null && daysLeft !== null && (
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-app3">{countdownLabel}</span>
            <span className={`text-xs font-semibold ${daysLeft <= 3 ? 'text-red-500' : daysLeft <= 7 ? 'text-yellow-500' : 'text-app'}`}>
              {daysLeft === 0 ? 'Vence hoy' : `${daysLeft} día${daysLeft !== 1 ? 's' : ''} restante${daysLeft !== 1 ? 's' : ''}`}
            </span>
          </div>
          <div className="h-2 bg-surface2 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${barColor}`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {(sub.trial.expired || sub.subscription.expired) && (
        <div className="mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-600 dark:text-red-400 text-xs">
          Tu plan ha vencido. Renovalo para seguir usando todas las funcionalidades.
        </div>
      )}

      <div className="mt-4 flex justify-end">
        <button
          onClick={openPlansModal}
          className="px-4 py-2 rounded-xl text-sm font-semibold bg-[#00C4BC] hover:bg-[#00aaa3] text-white transition-colors active:scale-95"
        >
          {sub.trial.active || sub.status === 'trialing' ? 'Ver planes' : 'Cambiar plan'}
        </button>
      </div>
    </div>
  )
}

export default function SettingsPage() {
  const [token, setToken]               = useState('')
  const [professionals, setProfessionals] = useState<any[]>([])
  const [myId, setMyId]                 = useState('')
  const [selectedProfId, setSelectedProfId] = useState('')
  const [workingHours, setWorkingHours] = useState<WorkingHours>(DEFAULT_WORKING_HOURS)
  const [loading, setLoading]           = useState(true)
  const [saving, setSaving]             = useState(false)
  const [saved, setSaved]               = useState(false)
  const [error, setError]               = useState('')
  const supabase = createClient()

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_e: AuthChangeEvent, session: Session | null) => {
        if (session) setToken(session.access_token)
      }
    )
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!token) return
    void loadData()
  }, [token])

  async function loadData() {
    setLoading(true)
    try {
      const [meData, profData] = await Promise.all([
        apiFetch('/auth/me', { token }),
        apiFetch('/professionals', { token }),
      ])
      const myUserId = meData.data.id
      setMyId(myUserId)

      const profs: any[] = profData.data ?? []
      setProfessionals(profs)

      const self = profs.find(p => p.id === myUserId) ?? profs[0]
      if (!self) return

      setSelectedProfId(self.id)
      await loadScheduleConfig(self.id)
    } finally {
      setLoading(false)
    }
  }

  async function loadScheduleConfig(profId: string) {
    const { data } = await supabase
      .from('professionals')
      .select('schedule_config')
      .eq('id', profId)
      .single()
    setWorkingHours(data?.schedule_config?.working_hours ?? { ...DEFAULT_WORKING_HOURS })
  }

  useEffect(() => {
    if (!selectedProfId) return
    void loadScheduleConfig(selectedProfId)
  }, [selectedProfId])

  function setDayField(day: number, field: keyof DayHours, value: string | boolean) {
    setWorkingHours(prev => ({
      ...prev,
      [day]: { ...prev[day], [field]: value },
    }))
  }

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      // Leer el schedule_config actual para no pisar otros campos
      const { data: current } = await supabase
        .from('professionals')
        .select('schedule_config')
        .eq('id', selectedProfId)
        .single()

      const updatedConfig = { ...(current?.schedule_config ?? {}), working_hours: workingHours }

      const { error: sbError } = await supabase
        .from('professionals')
        .update({ schedule_config: updatedConfig })
        .eq('id', selectedProfId)

      if (sbError) throw new Error(sbError.message)

      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (err: any) {
      setError(err.message ?? 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 animate-pulse">
        <div className="h-7 bg-surface2 rounded-lg w-40 mb-2" />
        <div className="h-4 bg-surface2 rounded w-64 mb-8" />
        <div className="bg-surface border border-app rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-app">
            <div className="h-5 bg-surface2 rounded w-48 mb-2" />
            <div className="h-3 bg-surface2 rounded w-80" />
          </div>
          <div className="divide-y divide-app">
            {[...Array(7)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4">
                <div className="w-10 h-5 bg-surface2 rounded-full flex-shrink-0" />
                <div className="w-24 h-4 bg-surface2 rounded" />
                <div className="flex items-center gap-2 flex-1">
                  <div className="w-36 h-8 bg-surface2 rounded-lg" />
                  <div className="w-3 h-3 bg-surface2 rounded" />
                  <div className="w-36 h-8 bg-surface2 rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-6 flex justify-end">
          <div className="w-36 h-11 bg-surface2 rounded-xl" />
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-app mb-1">Configuración</h1>
      <p className="text-app3 text-sm mb-8">Gestioná los horarios laborales de cada profesional.</p>

      <PlanCard />

      {/* Professional selector */}
      {professionals.length > 1 && (
        <div className="mb-6">
          <label className="block text-xs font-semibold text-app3 uppercase tracking-wider mb-2">
            Profesional
          </label>
          <select
            value={selectedProfId}
            onChange={e => setSelectedProfId(e.target.value)}
            className="bg-surface2 border border-app rounded-xl px-3 py-2.5 text-app text-sm focus:outline-none focus:border-[#00C4BC]"
          >
            {professionals.map(p => (
              <option key={p.id} value={p.id}>
                {p.first_name} {p.last_name}{p.id === myId ? ' (yo)' : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Working hours editor */}
      <div className="bg-surface border border-app rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-app">
          <h2 className="font-semibold text-app">Horarios de atención</h2>
          <p className="text-xs text-app3 mt-0.5">
            Los horarios fuera de este rango aparecerán bloqueados en la agenda y no se ofrecerán en el booking online.
          </p>
        </div>

        <div className="divide-y divide-app">
          {DAYS.map(({ key, label }) => {
            const day = workingHours[key] ?? DEFAULT_WORKING_HOURS[key]
            return (
              <div
                key={key}
                className={`flex items-center gap-4 px-5 py-4 transition-colors ${!day.enabled ? 'bg-surface2/40' : ''}`}
              >
                {/* Toggle */}
                <button
                  type="button"
                  onClick={() => setDayField(key, 'enabled', !day.enabled)}
                  className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${
                    day.enabled ? 'bg-[#00C4BC]' : 'bg-surface3'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${
                      day.enabled ? 'left-5' : 'left-0.5'
                    }`}
                  />
                </button>

                {/* Day name */}
                <span className={`w-24 text-sm font-medium flex-shrink-0 ${day.enabled ? 'text-app' : 'text-app3'}`}>
                  {label}
                </span>

                {/* Time range */}
                {day.enabled ? (
                  <div className="flex items-center gap-2 flex-1 flex-wrap">
                    <input
                      type="time"
                      value={day.start}
                      onChange={e => setDayField(key, 'start', e.target.value)}
                      className="bg-surface2 border border-app rounded-lg px-2 py-1.5 text-app text-sm focus:outline-none focus:border-[#00C4BC] w-36"
                    />
                    <span className="text-app3 text-sm">–</span>
                    <input
                      type="time"
                      value={day.end}
                      onChange={e => setDayField(key, 'end', e.target.value)}
                      className="bg-surface2 border border-app rounded-lg px-2 py-1.5 text-app text-sm focus:outline-none focus:border-[#00C4BC] w-36"
                    />
                  </div>
                ) : (
                  <span className="text-app3 text-sm italic">No trabaja</span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {error && (
        <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-600 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      <div className="mt-6 flex items-center justify-between">
        <p className="text-xs text-app3 max-w-xs">
          Los cambios se reflejarán en la agenda y en el link de booking online del profesional.
        </p>
        <button
          onClick={handleSave}
          disabled={saving || !selectedProfId}
          className={`px-6 py-3 rounded-xl font-semibold text-sm transition-all active:scale-95 disabled:opacity-50 ${
            saved
              ? 'bg-[#E6F8F1] text-[#00C4BC] border border-[#00C4BC]/30'
              : 'bg-[#00C4BC] hover:bg-[#00aaa3] text-white'
          }`}
        >
          {saving ? 'Guardando...' : saved ? '✓ Guardado' : 'Guardar cambios'}
        </button>
      </div>
    </div>
  )
}
