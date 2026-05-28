'use client'

import { useEffect, useState } from 'react'
import { createClient, getToken as getSupabaseToken } from '@/lib/supabase'
import { apiFetch } from '@/lib/api'
import { useRouter } from 'next/navigation'
import {
  ResponsiveContainer, BarChart, Bar, Cell, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie,
} from 'recharts'

const PERIOD_OPTIONS = [
  { value: '7d', label: 'Últimos 7 días' },
  { value: '30d', label: 'Últimos 30 días' },
  { value: 'month', label: 'Este mes' },
  { value: 'year', label: 'Este año' },
] as const

type Period = '7d' | '30d' | 'month' | 'year'

// by_day entry returned by the RPC
type DayEntry = {
  day: string      // "YYYY-MM-DD" in ART timezone
  attended: number
  absent: number
  cancelled: number
  other: number    // pending + confirmed + in_progress
}

const BAR_COLORS = ['#00C4BC', '#6366f1', '#3b82f6', '#8b5cf6', '#a78bfa', '#c4b5fd']
const PIE_COLORS = ['#00C4BC', '#6366f1', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']

function todayAR() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
}
function firstOfMonthAR() {
  return todayAR().slice(0, 8) + '01'
}

function periodFrom(period: Period): string {
  if (period === '7d') {
    const d = new Date(); d.setDate(d.getDate() - 6)
    return d.toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
  }
  if (period === '30d') {
    const d = new Date(); d.setDate(d.getDate() - 29)
    return d.toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
  }
  if (period === 'month') return firstOfMonthAR()
  if (period === 'year') return `${todayAR().slice(0, 4)}-01-01`
  return firstOfMonthAR()
}

// Returns the start date of the 90-day window
function ninetyDaysAgoAR(): string {
  const d = new Date(); d.setDate(d.getDate() - 89)
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
}

// Format YYYY-MM month key to Spanish short label ("may. 26")
function formatMonthLabel(isoMonth: string): string {
  const [y, m] = isoMonth.split('-')
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('es-AR', {
    month: 'short', year: '2-digit',
  })
}

// Derive period KPIs from the by_day cache (covers 7d / 30d / month)
function kpisFromByDay(byDay: DayEntry[], from: string, to: string) {
  const entries = byDay.filter(d => d.day >= from && d.day <= to)
  const attended  = entries.reduce((s, d) => s + d.attended,  0)
  const absent    = entries.reduce((s, d) => s + d.absent,    0)
  const cancelled = entries.reduce((s, d) => s + d.cancelled, 0)
  const other     = entries.reduce((s, d) => s + d.other,     0)
  const total     = attended + absent + cancelled + other
  const active    = attended + absent + other
  return { total, active, attended, absent }
}

export default function ClinicalStatsPage() {
  const [loading, setLoading] = useState(true)
  const [periodLoading, setPeriodLoading] = useState(false)

  const [period, setPeriod] = useState<Period>('month')

  // 90-day by_day cache — used for instant period switching
  const [byDayCache, setByDayCache] = useState<DayEntry[]>([])

  // Static 90-day charts
  const [appointmentsByMonth, setAppointmentsByMonth] = useState<{ month: string; total: number }[]>([])
  const [topTypes, setTopTypes] = useState<{ type: string; count: number }[]>([])
  const [byProfessional, setByProfessional] = useState<{ name: string; color: string; count: number }[]>([])

  // Period KPIs
  const [periodKpis, setPeriodKpis] = useState({ total: 0, active: 0, attended: 0, absent: 0 })

  const router = useRouter()
  const supabase = createClient()

  async function getToken(): Promise<string> {
    const t = await getSupabaseToken()
    if (!t) { router.push('/'); return '' }
    return t
  }

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/'); return }
      const t = session.access_token

      const from = ninetyDaysAgoAR()
      const to   = todayAR()

      const res = await apiFetch(`/appointments/stats/clinical?from=${from}&to=${to}`, { token: t })
      const d = res.data ?? {}

      // Static charts
      const rawByMonth: { month: string; total: number }[] =
        (d.by_month ?? []).map((r: any) => ({ month: formatMonthLabel(r.month), total: Number(r.total) }))
      setAppointmentsByMonth(rawByMonth)
      setTopTypes((d.top_types ?? []).map((r: any) => ({ type: r.type, count: Number(r.count) })))
      setByProfessional((d.by_professional ?? []).map((r: any) => ({ name: r.name, color: r.color, count: Number(r.count) })))

      // Cache by_day for client-side period filtering
      const byDay: DayEntry[] = (d.by_day ?? []).map((r: any) => ({
        day:       String(r.day),
        attended:  Number(r.attended),
        absent:    Number(r.absent),
        cancelled: Number(r.cancelled),
        other:     Number(r.other),
      }))
      setByDayCache(byDay)

      // Default period = month (always within 90-day cache)
      setPeriodKpis(kpisFromByDay(byDay, firstOfMonthAR(), to))

      setLoading(false)
    }
    load()
  }, [])

  async function handleChangePeriod(p: Period) {
    setPeriod(p)
    const from = periodFrom(p)
    const to   = todayAR()

    if (p !== 'year') {
      // Instant — filter the 90-day cache client-side, no network request
      setPeriodKpis(kpisFromByDay(byDayCache, from, to))
      return
    }

    // 'year' may extend beyond the 90-day cache — fetch a real COUNT
    setPeriodLoading(true)
    try {
      const t = await getToken()
      if (!t) return
      const res = await apiFetch(`/appointments/stats/period?from=${from}&to=${to}`, { token: t })
      const d = res.data ?? {}
      setPeriodKpis({
        total:    Number(d.total    ?? 0),
        active:   Number(d.active   ?? 0),
        attended: Number(d.attended ?? 0),
        absent:   Number(d.absent   ?? 0),
      })
    } finally {
      setPeriodLoading(false)
    }
  }

  const { total, active, attended, absent } = periodKpis
  const attendanceRate = active > 0 ? Math.round((attended / active) * 100) : 0
  const absenceRate    = active > 0 ? Math.round((absent   / active) * 100) : 0
  const occupancyRate  = total > 0  ? Math.round((attended / total)  * 100) : 0

  if (loading) {
    return (
      <div className="min-h-screen bg-app">
        <div className="sticky top-0 z-10 bg-app border-b border-app px-6 py-3 animate-pulse">
          <div className="h-5 bg-surface2 rounded w-28" />
        </div>
        <main className="p-6 max-w-4xl mx-auto animate-pulse space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-surface border border-app rounded-xl p-5 space-y-3">
                <div className="h-3 bg-surface2 rounded w-20" />
                <div className="h-7 bg-surface2 rounded w-16" />
                <div className="h-3 bg-surface2 rounded w-24" />
              </div>
            ))}
          </div>
          <div className="bg-surface border border-app rounded-xl p-5">
            <div className="h-4 bg-surface2 rounded w-48 mb-4" />
            <div className="h-44 bg-surface2 rounded-lg" />
          </div>
          <div className="bg-surface border border-app rounded-xl p-5">
            <div className="h-4 bg-surface2 rounded w-48 mb-4" />
            {[...Array(5)].map((_, i) => <div key={i} className="h-6 bg-surface2 rounded mb-2" />)}
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-app text-app">

      {/* ── Header ── */}
      <div className="sticky top-0 z-10 bg-app border-b border-app">
        <div className="px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-1 h-6 bg-[#6366f1] rounded-full flex-shrink-0" />
            <h1 className="text-xl font-extrabold text-app tracking-tight">Clínicas</h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-app3 whitespace-nowrap">Período:</span>
            <select
              value={period}
              onChange={e => handleChangePeriod(e.target.value as Period)}
              className="bg-surface2 border border-app rounded-lg px-3 py-1.5 text-sm font-semibold text-app focus:outline-none focus:border-[#6366f1] cursor-pointer"
            >
              {PERIOD_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <main className="p-6 max-w-4xl mx-auto space-y-8">

        {/* ── Section 1: Period KPIs ── */}
        <section>
          <div className={`transition-opacity duration-150 ${periodLoading ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-surface border border-app rounded-xl p-5">
                <div className="text-xs text-app3 uppercase tracking-wider mb-1">Turnos agendados</div>
                <div className="text-3xl font-bold text-app">{active}</div>
                <div className="text-xs text-app3 mt-1">demanda bruta</div>
              </div>

              <div className="bg-surface border border-app rounded-xl p-5">
                <div className="text-xs text-app3 uppercase tracking-wider mb-1">Asistencia</div>
                <div className="text-3xl font-bold text-[#00C4BC]">
                  {active > 0 ? `${attendanceRate}%` : '—'}
                </div>
                <div className="text-xs text-app3 mt-1">{attended} asistieron</div>
              </div>

              <div className={`bg-surface border rounded-xl p-5 ${absenceRate > 20 ? 'border-red-500/40' : 'border-app'}`}>
                <div className="text-xs text-app3 uppercase tracking-wider mb-1">Ausentismo</div>
                <div className={`text-3xl font-bold ${absenceRate > 20 ? 'text-red-500' : absenceRate > 10 ? 'text-amber-500' : 'text-[#00C4BC]'}`}>
                  {active > 0 ? `${absenceRate}%` : '—'}
                </div>
                <div className="text-xs text-app3 mt-1">{absent} no vinieron</div>
              </div>

              <div className={`bg-surface border rounded-xl p-5 ${occupancyRate > 0 && occupancyRate < 60 ? 'border-amber-500/40' : 'border-app'}`}>
                <div className="text-xs text-app3 uppercase tracking-wider mb-1">Ocupación</div>
                <div className={`text-3xl font-bold ${occupancyRate >= 80 ? 'text-[#00C4BC]' : occupancyRate >= 60 ? 'text-amber-500' : occupancyRate > 0 ? 'text-red-500' : 'text-app3'}`}>
                  {total > 0 ? `${occupancyRate}%` : '—'}
                </div>
                <div className="text-xs text-app3 mt-1">capacidad utilizada</div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Section 2: Appointments by month (90d static) ── */}
        {appointmentsByMonth.length > 0 && (
          <section className="bg-surface border border-app rounded-xl p-5">
            <h3 className="font-semibold text-sm mb-0.5">Pacientes atendidos por mes</h3>
            <div className="text-xs text-app3 mb-4">Últimos 90 días · excluye cancelados</div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={appointmentsByMonth} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--text3)' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text3)' }} tickLine={false} axisLine={false} width={28} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', fontSize: '12px', color: 'var(--text)' }}
                  formatter={(val: any) => [val, 'Atendidos']}
                  cursor={{ fill: 'var(--surface2)' }}
                />
                <Bar dataKey="total" radius={[6, 6, 0, 0]}>
                  {appointmentsByMonth.map((_, i) => (
                    <Cell key={i} fill={i === appointmentsByMonth.length - 1 ? '#00C4BC' : '#6366f1'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </section>
        )}

        {/* ── Section 3: Top appointment types ── */}
        {topTypes.length > 0 && (
          <section className="bg-surface border border-app rounded-xl p-5">
            <h3 className="font-semibold text-sm mb-0.5">Tipos de consulta más frecuentes</h3>
            <div className="text-xs text-app3 mb-4">Últimos 90 días · excluye cancelados</div>
            <div className="space-y-3">
              {topTypes.map((t, i) => {
                const pct = Math.round((t.count / topTypes[0].count) * 100)
                return (
                  <div key={t.type}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium text-app">{t.type}</span>
                      <span className="font-semibold text-app2">{t.count}</span>
                    </div>
                    <div className="h-2 bg-surface2 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: BAR_COLORS[i] ?? '#00C4BC' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* ── Section 4: By professional ── */}
        {byProfessional.length > 1 && (() => {
          const totalCount = byProfessional.reduce((s, p) => s + p.count, 0)
          return (
            <section className="bg-surface border border-app rounded-xl p-5">
              <h3 className="font-semibold text-sm mb-0.5">Atendidos por profesional</h3>
              <div className="text-xs text-app3 mb-4">Últimos 90 días · excluye cancelados</div>
              <div className="flex flex-col sm:flex-row items-center gap-6">
                <div className="flex-shrink-0">
                  <ResponsiveContainer width={160} height={160}>
                    <PieChart>
                      <Pie data={byProfessional} dataKey="count" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={68} paddingAngle={2}>
                        {byProfessional.map((p, i) => <Cell key={i} fill={p.color} />)}
                      </Pie>
                      <Tooltip
                        contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', fontSize: '11px', color: 'var(--text)' }}
                        formatter={(val: any, _: any, entry: any) => [`${val} turnos (${Math.round((Number(val) / totalCount) * 100)}%)`, entry.name]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 space-y-3 w-full">
                  {byProfessional.map(p => {
                    const pct = Math.round((p.count / totalCount) * 100)
                    return (
                      <div key={p.name}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="flex items-center gap-2 font-medium text-app">
                            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: p.color }} />
                            {p.name}
                          </span>
                          <span className="font-semibold text-app2">
                            {p.count} <span className="text-app3 font-normal">({pct}%)</span>
                          </span>
                        </div>
                        <div className="h-1.5 bg-surface2 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: p.color }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </section>
          )
        })()}

      </main>
    </div>
  )
}
