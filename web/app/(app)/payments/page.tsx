'use client'

import { useEffect, useRef, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { apiFetch } from '@/lib/api'
import { useRouter } from 'next/navigation'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, Cell, PieChart, Pie,
} from 'recharts'

const METODOS = [
  { value: 'cash', label: '💵 Efectivo' },
  { value: 'bank_transfer', label: '📲 Transferencia' },
  { value: 'debit_card', label: '💳 Débito' },
  { value: 'credit_card', label: '💳 Crédito' },
  { value: 'insurance', label: '🏥 Obra social' },
  { value: 'other', label: '📝 Otro' },
]

const TIPOS = [
  'Consulta', 'Limpieza', 'Endodoncia', 'Exodoncia', 'Ortodoncia',
  'Implante', 'Operatoria', 'Prótesis', 'Blanqueamiento', 'Urgencia',
  'Control', 'Armonizacion facial', 'Otro',
]

const CATEGORIAS_GASTO = [
  'Materiales', 'Equipamiento', 'Alquiler', 'Servicios',
  'Personal', 'Marketing', 'Impuestos', 'Seguros', 'Otro',
]

const PERIOD_OPTIONS = [
  { value: '7d', label: 'Últimos 7 días' },
  { value: '30d', label: 'Últimos 30 días' },
  { value: 'month', label: 'Este mes' },
  { value: 'year', label: 'Este año' },
  { value: 'custom', label: 'Personalizado' },
] as const

type Period = '7d' | '30d' | 'month' | 'year' | 'custom'

const PIE_COLORS = ['#00C4BC', '#6366f1', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']
const BAR_COLORS = ['#00C4BC', '#6366f1', '#3b82f6', '#8b5cf6', '#a78bfa', '#c4b5fd']
const HIST_PAGE_SIZE = 5

function todayAR() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
}
function firstOfMonthAR() {
  return todayAR().slice(0, 8) + '01'
}
function formatARS(n: number) {
  return '$' + n.toLocaleString('es-AR')
}
function formatDateAR(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', {
    day: 'numeric', month: 'short',
    timeZone: 'America/Argentina/Buenos_Aires',
  })
}

function periodToDateRange(period: Period, customFrom = '', customTo = '') {
  const to = todayAR()
  if (period === '7d') {
    const d = new Date(); d.setDate(d.getDate() - 6)
    return { from: d.toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }), to }
  }
  if (period === '30d') {
    const d = new Date(); d.setDate(d.getDate() - 29)
    return { from: d.toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }), to }
  }
  if (period === 'month') return { from: firstOfMonthAR(), to }
  if (period === 'year') return { from: `${todayAR().slice(0, 4)}-01-01`, to }
  if (period === 'custom') return { from: customFrom || todayAR(), to: customTo || todayAR() }
  return { from: firstOfMonthAR(), to }
}

function getPrevPeriodRange(period: Period): { from: string; to: string } | null {
  if (period === 'custom') return null
  if (period === '7d') {
    const end = new Date(); end.setDate(end.getDate() - 7)
    const start = new Date(); start.setDate(start.getDate() - 13)
    return {
      from: start.toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }),
      to: end.toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }),
    }
  }
  if (period === '30d') {
    const end = new Date(); end.setDate(end.getDate() - 30)
    const start = new Date(); start.setDate(start.getDate() - 59)
    return {
      from: start.toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }),
      to: end.toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }),
    }
  }
  if (period === 'month') {
    const now = new Date()
    const firstThisMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastPrevMonth = new Date(firstThisMonth.getTime() - 86400000)
    const firstPrevMonth = new Date(lastPrevMonth.getFullYear(), lastPrevMonth.getMonth(), 1)
    return {
      from: firstPrevMonth.toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }),
      to: lastPrevMonth.toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }),
    }
  }
  if (period === 'year') {
    const y = new Date().getFullYear() - 1
    return { from: `${y}-01-01`, to: `${y}-12-31` }
  }
  return null
}

const PREV_LABEL: Record<Period, string | null> = {
  '7d': 'vs 7 días ant.',
  '30d': 'vs 30 días ant.',
  month: 'vs mes anterior',
  year: 'vs año anterior',
  custom: null,
}

function periodChartLabel(p: Period, customFrom: string, customTo: string): string {
  if (p === '7d') return 'Últimos 7 días'
  if (p === '30d') return 'Últimos 30 días'
  if (p === 'month') return new Date().toLocaleDateString('es-AR', { month: 'long', year: 'numeric', timeZone: 'America/Argentina/Buenos_Aires' })
  if (p === 'year') return String(new Date().getFullYear())
  if (customFrom && customTo) return `${formatDateAR(customFrom)} – ${formatDateAR(customTo)}`
  return 'Período personalizado'
}

export default function StatisticsPage() {
  const [loading, setLoading] = useState(true)
  const [dataLoading, setDataLoading] = useState(false)
  const [movementsLoading, setMovementsLoading] = useState(false)
  const [token, setToken] = useState('')

  const [subview, setSubview] = useState<'financieras' | 'clinicas'>('financieras')
  const [period, setPeriod] = useState<Period>('month')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  // Persistent KPIs (all-time + this month, not period-scoped)
  const [kpis, setKpis] = useState<any>(null)
  // Period analytics: income/expenses totals, breakdowns, chart data
  const [analytics, setAnalytics] = useState<any>(null)
  // Server-paginated movements list
  const [movements, setMovements] = useState<any[]>([])
  const [movementsTotal, setMovementsTotal] = useState(0)

  // Clinical metrics (last 90 days, static)
  const [attendedByMonth, setAttendedByMonth] = useState<{ month: string; total: number }[]>([])
  const [topTypes, setTopTypes] = useState<{ type: string; count: number }[]>([])
  const [attendedByProfessional, setAttendedByProfessional] = useState<{ name: string; color: string; count: number }[]>([])

  // Clinical KPIs per period
  const [clinicalPeriod, setClinicalPeriod] = useState<Period>('month')
  const [clinicalAppts, setClinicalAppts] = useState<any[]>([])
  const [clinicalLoading, setClinicalLoading] = useState(false)

  // Historial filters — type matches API values
  const [histFilter, setHistFilter] = useState<'all' | 'payment' | 'expense'>('all')
  const [histPage, setHistPage] = useState(1)

  // Modales
  const [showPendingModal, setShowPendingModal] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [paymentSuccess, setPaymentSuccess] = useState<{ patientName: string; amount: number; remaining: number } | null>(null)
  const [showExpenseModal, setShowExpenseModal] = useState(false)
  const [editingPayment, setEditingPayment] = useState<any>(null)
  const [paymentToDelete, setPaymentToDelete] = useState<any>(null)
  const [deletingPayment, setDeletingPayment] = useState(false)
  const [deletePaymentError, setDeletePaymentError] = useState('')
  const [patients, setPatients] = useState<any[]>([])
  const [professionals, setProfessionals] = useState<any[]>([])
  const [preselectedPatientId, setPreselectedPatientId] = useState<string | null>(null)

  const [masked, setMasked] = useState(false)
  function maskedAmt(n: number) {
    return masked ? '••••••' : formatARS(n)
  }

  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/'); return }
      const t = session.access_token
      setToken(t)

      await Promise.all([
        fetchKpis(t),
        fetchAnalytics('month', t),
        fetchMovements('month', t, '', '', 'all', 1),
        fetchPatients(t),
        fetchProfessionals(t),
        fetchClinicalMetrics(t),
        fetchClinicalPeriodData('month', t),
      ])

      const searchParams = new URLSearchParams(window.location.search)
      const prePatientId = searchParams.get('patient_id')
      if (prePatientId) { setPreselectedPatientId(prePatientId); setShowPaymentModal(true) }

      setLoading(false)
    }
    load()
  }, [])

  // ── Fetchers ──

  async function fetchKpis(t: string) {
    const data = await apiFetch('/finance/kpis', { token: t })
    setKpis(data.data ?? null)
  }

  async function fetchAnalytics(p: Period, t: string, cFrom = '', cTo = '') {
    setDataLoading(true)
    try {
      const { from, to } = periodToDateRange(p, cFrom, cTo)
      const prevRange = getPrevPeriodRange(p)
      let url = `/finance/analytics?from=${from}&to=${to}`
      if (prevRange) url += `&prev_from=${prevRange.from}&prev_to=${prevRange.to}`
      const data = await apiFetch(url, { token: t })
      setAnalytics(data.data ?? null)
    } finally {
      setDataLoading(false)
    }
  }

  async function fetchMovements(p: Period, t: string, cFrom = '', cTo = '', type: 'all' | 'payment' | 'expense' = 'all', page = 1) {
    setMovementsLoading(true)
    try {
      const { from, to } = periodToDateRange(p, cFrom, cTo)
      const offset = (page - 1) * HIST_PAGE_SIZE
      const data = await apiFetch(`/finance/movements?from=${from}&to=${to}&type=${type}&limit=${HIST_PAGE_SIZE}&offset=${offset}`, { token: t })
      setMovements(data.data ?? [])
      setMovementsTotal(data.meta?.total ?? 0)
    } finally {
      setMovementsLoading(false)
    }
  }

  async function fetchPatients(t: string) {
    const data = await apiFetch('/patients?limit=100', { token: t })
    setPatients(data.data ?? [])
  }

  async function fetchProfessionals(t: string) {
    const data = await apiFetch('/professionals', { token: t })
    setProfessionals(data.data ?? [])
  }

  async function fetchClinicalMetrics(t: string) {
    const ninetyDaysAgo = new Date()
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 89)
    const from = ninetyDaysAgo.toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
    const to = todayAR()
    const data = await apiFetch(`/appointments?from=${from}&to=${to}`, { token: t })
    const appts: any[] = data.data ?? []

    const monthMap: Record<string, number> = {}
    appts.forEach(a => {
      if (a.status === 'cancelled') return
      const label = new Date(a.starts_at).toLocaleDateString('es-AR', {
        month: 'short', year: '2-digit', timeZone: 'America/Argentina/Buenos_Aires',
      })
      monthMap[label] = (monthMap[label] ?? 0) + 1
    })
    setAttendedByMonth(Object.entries(monthMap).map(([month, total]) => ({ month, total })))

    const typeMap: Record<string, number> = {}
    appts.forEach(a => {
      if (a.status === 'cancelled') return
      const type = a.appointment_type ?? 'Sin tipo'
      typeMap[type] = (typeMap[type] ?? 0) + 1
    })
    setTopTypes(
      Object.entries(typeMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([type, count]) => ({ type, count }))
    )

    const profMap: Record<string, { name: string; color: string; count: number }> = {}
    appts.forEach(a => {
      if (a.status === 'cancelled') return
      const id = a.professional_id ?? 'sin'
      if (!profMap[id]) profMap[id] = {
        name: a.professional_name ?? 'Sin profesional',
        color: a.professional_color ?? '#6366f1',
        count: 0,
      }
      profMap[id].count++
    })
    setAttendedByProfessional(Object.values(profMap).sort((a, b) => b.count - a.count))
  }

  async function fetchClinicalPeriodData(p: Period, t: string) {
    setClinicalLoading(true)
    try {
      const { from, to } = periodToDateRange(p)
      const data = await apiFetch(`/appointments?from=${from}&to=${to}`, { token: t })
      setClinicalAppts(data.data ?? [])
    } finally {
      setClinicalLoading(false)
    }
  }

  async function refreshAll() {
    await Promise.all([
      fetchKpis(token),
      fetchAnalytics(period, token, customFrom, customTo),
      fetchMovements(period, token, customFrom, customTo, histFilter, 1),
    ])
    setHistPage(1)
  }

  async function handleChangePeriod(p: Period) {
    setPeriod(p)
    setHistPage(1)
    if (p !== 'custom') {
      await Promise.all([
        fetchAnalytics(p, token),
        fetchMovements(p, token, '', '', histFilter, 1),
      ])
    }
  }

  async function handleApplyCustomPeriod() {
    if (!customFrom || !customTo) return
    setHistPage(1)
    await Promise.all([
      fetchAnalytics('custom', token, customFrom, customTo),
      fetchMovements('custom', token, customFrom, customTo, histFilter, 1),
    ])
  }

  async function handleChangeClinicalPeriod(p: Period) {
    setClinicalPeriod(p)
    await fetchClinicalPeriodData(p, token)
  }

  async function handleHistFilterChange(f: 'all' | 'payment' | 'expense') {
    setHistFilter(f)
    setHistPage(1)
    await fetchMovements(period, token, customFrom, customTo, f, 1)
  }

  async function handleHistPageChange(page: number) {
    setHistPage(page)
    await fetchMovements(period, token, customFrom, customTo, histFilter, page)
  }

  async function confirmDeletePayment() {
    if (!token || !paymentToDelete) return
    setDeletingPayment(true)
    setDeletePaymentError('')
    try {
      await apiFetch(`/payments/${paymentToDelete.id}`, { method: 'DELETE', token })
      await refreshAll()
      setPaymentToDelete(null)
    } catch (err) {
      setDeletePaymentError(err instanceof Error ? err.message : 'No se pudo eliminar el cobro')
    } finally {
      setDeletingPayment(false)
    }
  }

  async function deleteExpense(id: string) {
    await apiFetch(`/expenses/${id}`, { method: 'DELETE', token })
    await refreshAll()
  }

  // ── Derived values from kpis (persistent, not period-scoped) ──

  const allIncome = Number(kpis?.all_time_income ?? 0)
  const allExpense = Number(kpis?.all_time_expenses ?? 0)
  const cajaDispo = allIncome - allExpense
  const cobradoEsteMes = Number(kpis?.month_income ?? 0)
  const egresosEsteMes = Number(kpis?.month_expenses ?? 0)
  const pendingTotal = Number(kpis?.pending_total ?? 0)
  const allDebtorsByPatient: any[] = kpis?.debtors ?? []

  // ── Derived values from analytics (period-scoped) ──

  const income = Number(analytics?.income ?? 0)
  const expense = Number(analytics?.expenses ?? 0)
  const incomeCount = Number(analytics?.income_count ?? 0)
  const avgTicket = incomeCount > 0 ? Math.round(income / incomeCount) : 0
  const prevIncome = Number(analytics?.prev_income ?? 0)
  const prevExpense = Number(analytics?.prev_expenses ?? 0)
  const prevIncomeCount = Number(analytics?.prev_income_count ?? 0)
  const prevAvgTicket = prevIncomeCount > 0 ? Math.round(prevIncome / prevIncomeCount) : 0

  const byMethod: { method: string; total: number }[] = analytics?.by_method ?? []
  const byCategory: { category: string; total: number }[] = analytics?.by_category ?? []
  const byProfessional: { name: string; total: number }[] = analytics?.by_professional ?? []

  // Fill zero-days in the date range so the chart has a point for every day
  const chartData = (() => {
    const byDay: Record<string, number> = {}
    ;(analytics?.by_day ?? []).forEach(({ day, total }: { day: string; total: number }) => {
      byDay[String(day)] = Number(total)
    })
    const result: { day: string; total: number }[] = []
    const { from, to } = periodToDateRange(period, customFrom, customTo)
    const start = new Date(`${from}T12:00:00-03:00`)
    const end = new Date(`${to}T12:00:00-03:00`)
    const cur = new Date(start)
    while (cur <= end) {
      const key = cur.toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
      const label = cur.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', timeZone: 'America/Argentina/Buenos_Aires' })
      result.push({ day: label, total: byDay[key] ?? 0 })
      cur.setDate(cur.getDate() + 1)
    }
    return result
  })()

  function delta(current: number, previous: number): { pct: number; up: boolean } | null {
    if (previous === 0 || !PREV_LABEL[period]) return null
    const pct = Math.round(((current - previous) / previous) * 100)
    return { pct: Math.abs(pct), up: pct >= 0 }
  }

  const deltaIncome = delta(income, prevIncome)
  const deltaExpense = delta(expense, prevExpense)
  const deltaAvgTicket = delta(avgTicket, prevAvgTicket)
  const prevLabel = PREV_LABEL[period]

  // ── KPIs clínicos por período ──
  const clinicalTotal = clinicalAppts.length
  const clinicalActive = clinicalAppts.filter(a => a.status !== 'cancelled').length
  const clinicalAttended = clinicalAppts.filter(a => a.status === 'completed').length
  const clinicalAbsent = clinicalAppts.filter(a => a.status === 'absent').length
  const clinicalAttendanceRate = clinicalActive > 0 ? Math.round((clinicalAttended / clinicalActive) * 100) : 0
  const clinicalAbsenceRate = clinicalActive > 0 ? Math.round((clinicalAbsent / clinicalActive) * 100) : 0
  const clinicalOccupancyRate = clinicalTotal > 0 ? Math.round((clinicalAttended / clinicalTotal) * 100) : 0

  const totalHistPages = Math.ceil(movementsTotal / HIST_PAGE_SIZE) || 1


  // ── Loading skeleton ──
  if (loading) {
    return (
      <div className="min-h-screen bg-app">
        <div className="sticky top-0 z-10 bg-app border-b border-app">
          <div className="px-6 py-3 flex items-center gap-3 animate-pulse">
            <div className="w-1 h-6 bg-[#00C4BC]/40 rounded-full" />
            <div className="h-5 bg-surface2 rounded w-36" />
          </div>
          <div className="px-6 pb-3 flex gap-2 animate-pulse">
            {[...Array(2)].map((_, i) => <div key={i} className="h-8 bg-surface2 rounded-lg w-20" />)}
          </div>
        </div>
        <main className="p-6 max-w-4xl mx-auto animate-pulse space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-surface border border-app rounded-xl p-5 space-y-3">
                <div className="h-3 bg-surface2 rounded w-20" />
                <div className="h-7 bg-surface2 rounded w-24" />
                <div className="h-3 bg-surface2 rounded w-16" />
              </div>
            ))}
          </div>
          <div className="bg-surface border border-app rounded-xl p-5">
            <div className="h-4 bg-surface2 rounded w-32 mb-4" />
            <div className="h-44 bg-surface2 rounded-lg" />
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-surface border border-app rounded-xl p-5 space-y-3">
                <div className="h-3 bg-surface2 rounded w-24" />
                {[...Array(4)].map((_, j) => <div key={j} className="h-3 bg-surface2 rounded" />)}
              </div>
            ))}
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-app text-app">

      {/* ── Header sticky ── */}
      <div className="sticky top-0 z-10 bg-app border-b border-app">

        {/* Fila 1: título + acciones contextuales */}
        <div className="px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-1 h-6 bg-[#00C4BC] rounded-full flex-shrink-0" />
            <h1 className="text-xl font-extrabold text-app tracking-tight">Estadísticas</h1>
          </div>
          <div className={`flex items-center gap-2 transition-all ${subview === 'financieras' ? 'visible' : 'invisible pointer-events-none'}`}>
            <button
              onClick={() => setMasked(m => !m)}
              title={masked ? 'Mostrar cifras' : 'Ocultar cifras'}
              className="flex items-center justify-center w-9 h-9 rounded-lg bg-surface2 hover:bg-surface3 border border-app text-app3 hover:text-app transition-all active:scale-95"
            >
              {masked ? <Eye size={16} /> : <EyeOff size={16} />}
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setEditingPayment(null); setPreselectedPatientId(null); setShowPaymentModal(true) }}
                className="flex items-center gap-1.5 bg-[#00C4BC] hover:bg-[#00aaa3] text-white text-sm font-semibold px-3 py-2 rounded-lg transition-all active:scale-95"
              >
                + Cobro
              </button>
              <button
                onClick={() => setShowExpenseModal(true)}
                className="flex items-center gap-1.5 bg-surface2 hover:bg-surface3 border border-app text-app text-sm font-semibold px-3 py-2 rounded-lg transition-all active:scale-95"
              >
                + Gasto
              </button>
            </div>
          </div>
        </div>

        {/* Fila 2: submenu */}
        <div className="px-6 flex items-center gap-1">
          {([
            { key: 'financieras', label: 'Financieras' },
            { key: 'clinicas', label: 'Clínicas' },
          ] as const).map(tab => (
            <button
              key={tab.key}
              onClick={() => setSubview(tab.key)}
              className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-all ${subview === tab.key
                  ? 'border-[#00C4BC] text-[#00C4BC]'
                  : 'border-transparent text-app3 hover:text-app'
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Fila 3: selector de período solo para Clínicas */}
        {subview === 'clinicas' && (
          <div className="px-6 py-2.5 flex items-center gap-2 overflow-x-auto">
            <span className="text-xs text-app3 whitespace-nowrap flex-shrink-0">Período:</span>
            {PERIOD_OPTIONS.filter(o => o.value !== 'custom').map(opt => (
              <button
                key={opt.value}
                onClick={() => handleChangeClinicalPeriod(opt.value as Period)}
                className={`px-3 py-1.5 text-sm font-semibold rounded-lg transition-all whitespace-nowrap flex-shrink-0 ${clinicalPeriod === opt.value
                    ? 'bg-[#E6F8F1] text-[#00C4BC]'
                    : 'bg-surface2 text-app2 hover:text-app'
                  }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <main className="p-6 max-w-4xl mx-auto space-y-8">

        {/* ══════════════ FINANCIERAS ══════════════ */}
        {subview === 'financieras' && <>

          {/* ── BLOQUE 1: Estado financiero (persistente) ── */}
          <section className="space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-1 h-5 bg-[#00C4BC] rounded-full flex-shrink-0" />
              <h2 className="text-sm font-bold text-app uppercase tracking-widest">Resumen financiero actual</h2>
              <div className="h-px flex-1 bg-[var(--border)]" />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">

              {/* Caja disponible */}
              <div className="bg-surface border border-app rounded-xl p-5">
                <div className="text-xs text-app3 uppercase tracking-wider mb-1">Caja disponible</div>
                <div className={`text-2xl font-bold ${cajaDispo >= 0 ? 'text-[#00C4BC] dark:text-emerald-400' : 'text-red-500'}`}>
                  {maskedAmt(cajaDispo)}
                </div>
                <div className="text-xs text-app3 mt-1">total cobrado − egresos</div>
              </div>

              {/* Pendiente por cobrar */}
              <div
                className={`bg-surface border rounded-xl p-5 transition-all ${pendingTotal > 0 ? 'border-amber-500/40 cursor-pointer hover:border-amber-500/70 hover:bg-amber-500/5 active:scale-[0.98]' : 'border-app'}`}
                onClick={() => pendingTotal > 0 && setShowPendingModal(true)}
              >
                <div className="text-xs text-app3 uppercase tracking-wider mb-1">Pendiente por cobrar</div>
                <div className={`text-2xl font-bold ${pendingTotal > 0 ? 'text-amber-400' : 'text-[#00C4BC]'}`}>
                  {pendingTotal > 0 ? maskedAmt(pendingTotal) : '—'}
                </div>
                <div className="text-xs text-app3 mt-1 flex items-center gap-1">
                  {pendingTotal > 0 ? (
                    <><span>{allDebtorsByPatient.length} pacientes · ver →</span></>
                  ) : 'Todos al día'}
                </div>
              </div>

              {/* Cobrado este mes */}
              <div className="bg-surface border border-app rounded-xl p-5">
                <div className="text-xs text-app3 uppercase tracking-wider mb-1">Cobrado este mes</div>
                <div className="text-2xl font-bold text-[#00C4BC] dark:text-emerald-400">
                  {maskedAmt(cobradoEsteMes)}
                </div>
                <div className="text-xs text-app3 mt-1">{Number(kpis?.month_income_count ?? 0)} cobros</div>
              </div>

              {/* Egresos este mes */}
              <div className="bg-surface border border-app rounded-xl p-5">
                <div className="text-xs text-app3 uppercase tracking-wider mb-1">Egresos este mes</div>
                <div className={`text-2xl font-bold ${egresosEsteMes > 0 ? 'text-red-500 dark:text-red-400' : 'text-app3'}`}>
                  {egresosEsteMes > 0 ? maskedAmt(egresosEsteMes) : '—'}
                </div>
                <div className="text-xs text-app3 mt-1">{Number(kpis?.month_expense_count ?? 0)} registros</div>
              </div>

            </div>

            {/* Barra egresos vs cobrado este mes */}
            {cobradoEsteMes > 0 && !masked && (
              <div className="bg-surface border border-app rounded-xl px-5 py-4">
                <div className="flex justify-between text-xs text-app3 mb-2">
                  <span>Egresos vs cobrado este mes</span>
                  <span>{Math.round((egresosEsteMes / cobradoEsteMes) * 100)}%</span>
                </div>
                <div className="h-2 bg-surface2 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${egresosEsteMes / cobradoEsteMes > 0.8 ? 'bg-red-500'
                        : egresosEsteMes / cobradoEsteMes > 0.5 ? 'bg-amber-500'
                          : 'bg-[#00C4BC]'
                      }`}
                    style={{ width: `${Math.min(100, (egresosEsteMes / cobradoEsteMes) * 100)}%` }}
                  />
                </div>
              </div>
            )}
          </section>

          {/* ── BLOQUE 2: Análisis del consultorio ── */}
          <section className="space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-1 h-5 bg-[#6366f1] rounded-full flex-shrink-0" />
              <h2 className="text-sm font-bold text-app uppercase tracking-widest">Análisis del consultorio</h2>
              <div className="h-px flex-1 bg-[var(--border)]" />
            </div>

            {/* Selector temporal */}
            <div className="bg-surface border border-app rounded-xl p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-app3 whitespace-nowrap mr-1">Período:</span>
                {PERIOD_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => handleChangePeriod(opt.value)}
                    className={`px-3 py-1.5 text-sm font-semibold rounded-lg transition-all whitespace-nowrap ${period === opt.value
                      ? 'bg-[#E6F8F1] text-[#00C4BC]'
                      : 'bg-surface2 text-app2 hover:text-app'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {period === 'custom' && (
                <div className="flex items-center gap-2 flex-wrap mt-3 pt-3 border-t border-app">
                  <input
                    type="date"
                    value={customFrom}
                    onChange={e => setCustomFrom(e.target.value)}
                    className="bg-surface2 border border-app rounded-lg px-3 py-1.5 text-sm text-app focus:outline-none focus:border-[#00C4BC]"
                  />
                  <span className="text-app3 text-sm">→</span>
                  <input
                    type="date"
                    value={customTo}
                    onChange={e => setCustomTo(e.target.value)}
                    className="bg-surface2 border border-app rounded-lg px-3 py-1.5 text-sm text-app focus:outline-none focus:border-[#00C4BC]"
                  />
                  <button
                    onClick={handleApplyCustomPeriod}
                    disabled={!customFrom || !customTo}
                    className="px-4 py-1.5 bg-[#00C4BC] hover:bg-[#00aaa3] disabled:opacity-40 text-white text-sm font-semibold rounded-lg transition-all active:scale-95"
                  >
                    Aplicar
                  </button>
                </div>
              )}
            </div>

            {/* Resumen inteligente del período */}
            {!dataLoading && !masked && (() => {
              const insights: { icon: string; text: string; type: 'good' | 'bad' | 'neutral' }[] = []

              // Ingresos vs período anterior
              if (deltaIncome && prevLabel && deltaIncome.pct >= 5) {
                insights.push({
                  icon: deltaIncome.up ? '📈' : '📉',
                  text: `Ingresos ${deltaIncome.up ? '+' : '-'}${deltaIncome.pct}% ${prevLabel}`,
                  type: deltaIncome.up ? 'good' : 'bad',
                })
              }

              // Ticket promedio vs período anterior
              if (deltaAvgTicket && prevLabel && deltaAvgTicket.pct >= 5) {
                insights.push({
                  icon: deltaAvgTicket.up ? '💰' : '💸',
                  text: `Ticket promedio ${deltaAvgTicket.up ? '+' : '-'}${deltaAvgTicket.pct}% ${prevLabel}`,
                  type: deltaAvgTicket.up ? 'good' : 'bad',
                })
              }

              // Deudores antiguos
              const oldDebtors = allDebtorsByPatient.filter((d: any) => daysSince(d.last_payment_at) > 30)
              if (oldDebtors.length > 0) {
                insights.push({
                  icon: '⏳',
                  text: `${oldDebtors.length} paciente${oldDebtors.length > 1 ? 's' : ''} deben hace +30 días`,
                  type: 'bad',
                })
              } else if (allDebtorsByPatient.length > 0) {
                insights.push({
                  icon: '⏳',
                  text: `${allDebtorsByPatient.length} paciente${allDebtorsByPatient.length > 1 ? 's' : ''} con saldo pendiente`,
                  type: 'neutral',
                })
              }

              // Método de cobro dominante (≥40%)
              if (byMethod.length > 0 && income > 0) {
                const top = byMethod[0]
                const pct = Math.round((top.total / income) * 100)
                if (pct >= 40) {
                  const label = METODOS.find(x => x.value === top.method)?.label ?? top.method
                  insights.push({ icon: '💳', text: `${label} representa ${pct}% de cobros`, type: 'neutral' })
                }
              }

              // Mejor día de la semana
              if (incomeCount >= 5) {
                const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
                const byWeekday: Record<number, number> = {}
                ;(analytics?.by_day ?? []).forEach(({ day, total }: { day: string; total: number }) => {
                  const dow = new Date(String(day) + 'T12:00:00').getDay()
                  byWeekday[dow] = (byWeekday[dow] ?? 0) + Number(total)
                })
                const topDay = Object.entries(byWeekday).sort((a, b) => Number(b[1]) - Number(a[1]))[0]
                if (topDay) {
                  insights.push({ icon: '📅', text: `${DIAS[Number(topDay[0])]} es tu día más rentable`, type: 'neutral' })
                }
              }

              // Ratio egresos/ingresos muy alto
              if (income > 0 && expense > 0 && expense / income > 0.8) {
                insights.push({ icon: '⚠️', text: `Egresos al ${Math.round((expense / income) * 100)}% de ingresos`, type: 'bad' })
              }

              if (insights.length === 0) return null

              return (
                <div>
                  <div className="flex items-center gap-2 mb-2.5">
                    <span className="text-xs font-semibold text-app3 uppercase tracking-wider">Resumen inteligente</span>
                    <div className="h-px flex-1 bg-[var(--border)]" />
                  </div>
                  <DragScroll>
                    {insights.map((ins, i) => (
                      <div
                        key={i}
                        className={`flex items-center gap-2 flex-shrink-0 rounded-lg px-3 py-2 border text-xs font-semibold whitespace-nowrap ${
                          ins.type === 'good'
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                            : ins.type === 'bad'
                              ? 'bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400'
                              : 'bg-surface2 border-app text-app2'
                        }`}
                      >
                        <span>{ins.icon}</span>
                        <span>{ins.text}</span>
                      </div>
                    ))}
                  </DragScroll>
                </div>
              )
            })()}

            {/* Métricas del período */}
            <div className={`transition-opacity duration-150 ${dataLoading ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">

                  {/* Ingresos del período */}
                  <div className="bg-surface border border-app rounded-xl p-5">
                    <div className="text-xs text-app3 uppercase tracking-wider mb-1">Ingresos del período</div>
                    <div className="text-2xl font-bold text-[#00C4BC] dark:text-emerald-400">{maskedAmt(income)}</div>
                    {!masked && <DeltaBadge d={deltaIncome} label={prevLabel} positiveIsGood />}
                    <div className="text-xs text-app3 mt-1">{incomeCount} cobros</div>
                  </div>

                  {/* Egresos del período */}
                  <div className="bg-surface border border-app rounded-xl p-5">
                    <div className="text-xs text-app3 uppercase tracking-wider mb-1">Egresos del período</div>
                    <div className="text-2xl font-bold text-red-500 dark:text-red-400">{maskedAmt(expense)}</div>
                    {!masked && <DeltaBadge d={deltaExpense} label={prevLabel} positiveIsGood={false} />}
                    <div className="text-xs text-app3 mt-1">{Number(analytics?.expense_count ?? 0)} registros</div>
                  </div>

                  {/* Ticket promedio */}
                  <div className="bg-surface border border-app rounded-xl p-5">
                    <div className="text-xs text-app3 uppercase tracking-wider mb-1">Ticket promedio</div>
                    <div className="text-2xl font-bold text-[#00C4BC]">
                      {avgTicket > 0 ? maskedAmt(avgTicket) : '—'}
                    </div>
                    {!masked && <DeltaBadge d={deltaAvgTicket} label={prevLabel} positiveIsGood />}
                    <div className="text-xs text-app3 mt-1">por cobro</div>
                  </div>

                </div>

                {/* Evolución del período */}
                {chartData.some(d => d.total > 0) && (
                  <div className="bg-surface border border-app rounded-xl p-5 my-4">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="font-semibold text-app">Evolución</h3>
                        <div className="text-xs text-app3 mt-0.5">
                          {periodChartLabel(period, customFrom, customTo)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-emerald-500">{maskedAmt(income)}</div>
                        <div className="text-xs text-app3">{chartData.filter(d => d.total > 0).length} días con cobros</div>
                      </div>
                    </div>
                    <ResponsiveContainer width="100%" height={180}>
                      <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                        <XAxis dataKey="day" tick={{ fontSize: 10, fill: 'var(--text3)' }} tickLine={false} axisLine={false} interval={Math.max(0, Math.floor(chartData.length / 6))} />
                        <YAxis tick={{ fontSize: 10, fill: 'var(--text3)' }} tickLine={false} axisLine={false} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} width={36} />
                        {!masked && (
                          <Tooltip
                            contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', fontSize: '12px', color: 'var(--text)' }}
                            formatter={(val: any) => [formatARS(Number(val)), 'Ingresos']}
                            cursor={{ stroke: 'var(--border)' }}
                          />
                        )}
                        <Line type="monotone" dataKey="total" stroke="#00C4BC" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: '#00C4BC' }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Desglose del período */}
                {(income > 0 || expense > 0) && (
                  <div>
                    <SectionLabel>Desglose del período</SectionLabel>
                    <div className={`grid gap-4 ${byProfessional.length > 1 ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>

                      {/* Por método */}
                      <div className="bg-surface border border-app rounded-xl p-5">
                        <div className="text-xs text-app3 uppercase tracking-wider mb-3">Por método de cobro</div>
                        {byMethod.length > 0 ? (
                          <div className="space-y-2">
                            {byMethod.map(m => (
                              <div key={m.method} className="flex justify-between text-sm">
                                <span className="text-app2">{METODOS.find(x => x.value === m.method)?.label ?? m.method}</span>
                                <span className="font-semibold">{maskedAmt(m.total)}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-xs text-app3">Sin ingresos</div>
                        )}
                      </div>

                      {/* Por categoría */}
                      <div className="bg-surface border border-app rounded-xl p-5">
                        <div className="text-xs text-app3 uppercase tracking-wider mb-3">Por categoría de gasto</div>
                        {byCategory.length > 0 ? (
                          <div className="space-y-2">
                            {byCategory.map(c => (
                              <div key={c.category} className="flex justify-between text-sm">
                                <span className="text-app2">{c.category}</span>
                                <span className="font-semibold">{maskedAmt(c.total)}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-xs text-app3">Sin gastos</div>
                        )}
                      </div>

                      {/* Por profesional (pie, solo si >1) */}
                      {byProfessional.length > 1 && (
                        <div className="bg-surface border border-app rounded-xl p-5">
                          <div className="text-xs text-app3 uppercase tracking-wider mb-3">Por profesional</div>
                          <ResponsiveContainer width="100%" height={110}>
                            <PieChart>
                              <Pie data={byProfessional} dataKey="total" nameKey="name" cx="50%" cy="50%" innerRadius={28} outerRadius={48} paddingAngle={2}>
                                {byProfessional.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                              </Pie>
                              {!masked && (
                                <Tooltip
                                  contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', fontSize: '11px', color: 'var(--text)' }}
                                  formatter={(val: any, _: any, entry: any) => [
                                    `${formatARS(Number(val))} (${income > 0 ? Math.round((Number(val) / income) * 100) : 0}%)`,
                                    entry.name,
                                  ]}
                                />
                              )}
                            </PieChart>
                          </ResponsiveContainer>
                          <div className="space-y-1.5 mt-2">
                            {byProfessional.map((p, i) => (
                              <div key={p.name} className="flex items-center justify-between text-xs gap-2">
                                <span className="flex items-center gap-1.5 text-app2 truncate">
                                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                                  {p.name}
                                </span>
                                <span className="font-semibold text-app flex-shrink-0">
                                  {maskedAmt(p.total)} {!masked && <span className="text-app3 font-normal">({income > 0 ? Math.round((p.total / income) * 100) : 0}%)</span>}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
            </div>
          </section>

          {/* ── BLOQUE 3: Historial de movimientos ── */}
          <section>
            <div className="flex items-center justify-between gap-4 mb-3">
              <SectionLabel>Actividad financiera</SectionLabel>
              <div className="flex items-center gap-1 bg-surface2 rounded-lg p-1">
                {([
                  { key: 'all', label: 'Todos' },
                  { key: 'payment', label: 'Cobros' },
                  { key: 'expense', label: 'Egresos' },
                ] as const).map(f => (
                  <button
                    key={f.key}
                    onClick={() => handleHistFilterChange(f.key as 'all' | 'payment' | 'expense')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${histFilter === f.key ? 'bg-[#E6F8F1] text-[#00C4BC]' : 'text-app3 hover:text-app'
                      }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div className={`bg-surface border border-app rounded-xl overflow-hidden transition-opacity duration-150 ${movementsLoading ? 'opacity-40 pointer-events-none' : ''}`}>
              <div className="px-5 py-3 border-b border-app flex items-center justify-between">
                <span className="text-sm font-semibold">{movementsTotal} movimientos</span>
                {totalHistPages > 1 && (
                  <span className="text-xs text-app3">Pág. {histPage}/{totalHistPages}</span>
                )}
              </div>

              {!movementsLoading && movements.length === 0 ? (
                <div className="px-5 py-12 text-center text-app3 text-sm">Sin movimientos en este período</div>
              ) : (
                <>
                  <div className="divide-y divide-app">
                    {movements.map((item: any) => (
                      <div key={`${item.type}-${item.id}`} className="px-5 py-3.5 flex items-center gap-4">
                        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm ${item.type === 'payment' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'
                          }`}>
                          {item.type === 'payment' ? '💰' : '📦'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">
                            {item.type === 'payment'
                              ? (item.patient_name
                                ? <span
                                    onClick={() => router.push(`/patients/${item.patient_id}`)}
                                    className="cursor-pointer hover:text-[#00C4BC] transition-colors"
                                  >{item.patient_name}</span>
                                : 'Sin paciente')
                              : item.category}
                          </div>
                          <div className="text-xs text-app3 truncate">
                            {item.type === 'payment'
                              ? (METODOS.find(m => m.value === item.method)?.label ?? item.method)
                              : (item.description || '')}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className={`font-bold text-sm ${item.type === 'payment' ? 'text-emerald-500 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                            {masked ? '••••••' : `${item.type === 'payment' ? '+' : '-'}${formatARS(Number(item.amount))}`}
                          </div>
                          {item.type === 'payment' && !masked && (() => {
                            const balance = Number(item.patient_balance_due ?? 0)
                            if (balance > 0) return (
                              <div className="text-xs text-amber-500 font-semibold">
                                Debe {formatARS(balance)}
                              </div>
                            )
                            if (balance < 0) return (
                              <div className="text-xs text-[#00C4BC] font-semibold">
                                A favor {formatARS(Math.abs(balance))}
                              </div>
                            )
                            return null
                          })()}
                          <div className="text-xs text-app3">{formatDateAR(item.date)}</div>
                        </div>
                        {item.type === 'payment' ? (
                          <div className="flex flex-col gap-1 flex-shrink-0">
                            <button
                              onClick={() => { setEditingPayment(item); setPreselectedPatientId(null); setShowPaymentModal(true) }}
                              className="text-xs font-semibold bg-surface2 hover:bg-surface3 border border-app text-app2 px-2.5 py-1.5 rounded-lg transition-all active:scale-95"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => setPaymentToDelete(item)}
                              className="text-xs font-semibold bg-surface2 hover:bg-surface3 border border-app text-app2 px-2.5 py-1.5 rounded-lg transition-all active:scale-95"
                            >
                              Eliminar
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => deleteExpense(item.id)}
                            className="text-app3 hover:text-red-500 active:scale-90 transition-all flex-shrink-0 text-base"
                          >
                            🗑
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <Pagination
                    page={histPage}
                    hasMore={histPage < totalHistPages}
                    onPrev={() => handleHistPageChange(Math.max(1, histPage - 1))}
                    onNext={() => handleHistPageChange(histPage + 1)}
                  />
                </>
              )}
            </div>
          </section>

        </> /* fin financieras */}

        {/* ══════════════ CLÍNICAS ══════════════ */}
        {subview === 'clinicas' && <>

          {/* ── BLOQUE: Métricas clínicas ── */}
          <section>

            {/* KPIs clínicos */}
            {clinicalLoading ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="bg-surface border border-app rounded-xl p-5 animate-pulse space-y-3">
                    <div className="h-3 bg-surface2 rounded w-20" />
                    <div className="h-7 bg-surface2 rounded w-16" />
                    <div className="h-3 bg-surface2 rounded w-24" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="bg-surface border border-app rounded-xl p-5">
                  <div className="text-xs text-app3 uppercase tracking-wider mb-1">Turnos agendados</div>
                  <div className="text-3xl font-bold text-app">{clinicalActive}</div>
                  <div className="text-xs text-app3 mt-1">demanda bruta</div>
                </div>

                <div className="bg-surface border border-app rounded-xl p-5">
                  <div className="text-xs text-app3 uppercase tracking-wider mb-1">Asistencia</div>
                  <div className="text-3xl font-bold text-[#00C4BC]">
                    {clinicalActive > 0 ? `${clinicalAttendanceRate}%` : '—'}
                  </div>
                  <div className="text-xs text-app3 mt-1">{clinicalAttended} asistieron</div>
                </div>

                <div className={`bg-surface border rounded-xl p-5 ${clinicalAbsenceRate > 20 ? 'border-red-500/40' : 'border-app'}`}>
                  <div className="text-xs text-app3 uppercase tracking-wider mb-1">Ausentismo</div>
                  <div className={`text-3xl font-bold ${clinicalAbsenceRate > 20 ? 'text-red-500' : clinicalAbsenceRate > 10 ? 'text-amber-500' : 'text-[#00C4BC]'}`}>
                    {clinicalActive > 0 ? `${clinicalAbsenceRate}%` : '—'}
                  </div>
                  <div className="text-xs text-app3 mt-1">{clinicalAbsent} no vinieron</div>
                </div>

                <div className={`bg-surface border rounded-xl p-5 ${clinicalOccupancyRate > 0 && clinicalOccupancyRate < 60 ? 'border-amber-500/40' : 'border-app'}`}>
                  <div className="text-xs text-app3 uppercase tracking-wider mb-1">Ocupación</div>
                  <div className={`text-3xl font-bold ${clinicalOccupancyRate >= 80 ? 'text-[#00C4BC]' : clinicalOccupancyRate >= 60 ? 'text-amber-500' : clinicalOccupancyRate > 0 ? 'text-red-500' : 'text-app3'}`}>
                    {clinicalTotal > 0 ? `${clinicalOccupancyRate}%` : '—'}
                  </div>
                  <div className="text-xs text-app3 mt-1">capacidad utilizada</div>
                </div>
              </div>
            )}

            {/* Atendidos por mes */}
            {attendedByMonth.length > 0 && (
              <div className="bg-surface border border-app rounded-xl p-5 mb-4">
                <h3 className="font-semibold text-sm mb-0.5">Pacientes atendidos por mes</h3>
                <div className="text-xs text-app3 mb-4">Excluye cancelados</div>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={attendedByMonth} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--text3)' }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--text3)' }} tickLine={false} axisLine={false} width={28} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', fontSize: '12px', color: 'var(--text)' }}
                      formatter={(val: any) => [val, 'Atendidos']}
                      cursor={{ fill: 'var(--surface2)' }}
                    />
                    <Bar dataKey="total" radius={[6, 6, 0, 0]}>
                      {attendedByMonth.map((_, i) => (
                        <Cell key={i} fill={i === attendedByMonth.length - 1 ? '#00C4BC' : '#6366f1'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Tipos más frecuentes */}
            {topTypes.length > 0 && (
              <div className="bg-surface border border-app rounded-xl p-5 mb-4">
                <h3 className="font-semibold text-sm mb-0.5">Tipos de consulta más frecuentes</h3>
                <div className="text-xs text-app3 mb-4">Excluye cancelados</div>
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
              </div>
            )}

            {/* Por profesional (si >1) */}
            {attendedByProfessional.length > 1 && (() => {
              const total = attendedByProfessional.reduce((s, p) => s + p.count, 0)
              return (
                <div className="bg-surface border border-app rounded-xl p-5">
                  <h3 className="font-semibold text-sm mb-0.5">Atendidos por profesional</h3>
                  <div className="text-xs text-app3 mb-4">Excluye cancelados</div>
                  <div className="flex flex-col sm:flex-row items-center gap-6">
                    <div className="flex-shrink-0">
                      <ResponsiveContainer width={160} height={160}>
                        <PieChart>
                          <Pie data={attendedByProfessional} dataKey="count" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={68} paddingAngle={2}>
                            {attendedByProfessional.map((p, i) => <Cell key={i} fill={p.color} />)}
                          </Pie>
                          <Tooltip
                            contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', fontSize: '11px', color: 'var(--text)' }}
                            formatter={(val: any, _: any, entry: any) => [
                              `${val} turnos (${Math.round((Number(val) / total) * 100)}%)`,
                              entry.name,
                            ]}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex-1 space-y-3 w-full">
                      {attendedByProfessional.map(p => {
                        const pct = Math.round((p.count / total) * 100)
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
                </div>
              )
            })()}
          </section>

        </> /* fin clinicas */}

      </main>

      {/* ── Modales ── */}
      {showPaymentModal && (
        <PaymentModal
          token={token}
          patients={patients}
          professionals={professionals}
          payment={editingPayment}
          preselectedPatientId={preselectedPatientId}
          onClose={() => { setShowPaymentModal(false); setPreselectedPatientId(null); setEditingPayment(null) }}
          onSaved={async (success) => {
            setShowPaymentModal(false); setPreselectedPatientId(null); setEditingPayment(null)
            await refreshAll()
            if (success) setPaymentSuccess(success)
          }}
        />
      )}

      {paymentSuccess && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4"
          onClick={() => setPaymentSuccess(null)}
        >
          <div
            className="bg-surface border border-app rounded-2xl w-full max-w-sm overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-6 pt-6 pb-5 text-center">
              <div className="w-14 h-14 rounded-full bg-[#E6F8F1] text-[#00C4BC] text-2xl font-bold flex items-center justify-center mx-auto mb-4">
                ✓
              </div>
              <h2 className="text-lg font-bold text-app">Cobro registrado</h2>
              <p className="text-sm text-app3 mt-2">
                {paymentSuccess.patientName} abonó {formatARS(paymentSuccess.amount)}.
              </p>
              {paymentSuccess.remaining > 0 && (
                <div className="mt-4 rounded-xl bg-amber-500/10 border border-amber-500/25 px-4 py-3 text-left">
                  <div className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                    Saldo pendiente
                  </div>
                  <div className="text-base font-bold text-amber-500 mt-1">
                    {formatARS(paymentSuccess.remaining)}
                  </div>
                </div>
              )}
              {paymentSuccess.remaining < 0 && (
                <div className="mt-4 rounded-xl bg-[#E6F8F1] border border-[#00C4BC]/25 px-4 py-3 text-left">
                  <div className="text-xs font-semibold text-[#00C4BC] uppercase tracking-wider">
                    Saldo a favor
                  </div>
                  <div className="text-base font-bold text-[#00C4BC] mt-1">
                    {formatARS(Math.abs(paymentSuccess.remaining))}
                  </div>
                </div>
              )}
            </div>
            <div className="px-6 pb-6">
              <button
                type="button"
                onClick={() => setPaymentSuccess(null)}
                className="w-full bg-[#00C4BC] hover:bg-[#00aaa3] text-white font-semibold py-2.5 rounded-xl transition-colors"
              >
                Listo
              </button>
            </div>
          </div>
        </div>
      )}

      {paymentToDelete && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4"
          onClick={() => setPaymentToDelete(null)}
        >
          <div className="bg-surface border border-app rounded-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-app">
              <h2 className="text-lg font-semibold">Confirmar eliminación</h2>
              <p className="text-sm text-app3 mt-1">¿Eliminar este cobro de forma definitiva?</p>
            </div>
            <div className="px-6 py-4 space-y-2">
              {deletePaymentError && (
                <div className="px-3 py-2 rounded-lg bg-red-600/10 text-xs text-red-500">{deletePaymentError}</div>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => setPaymentToDelete(null)}
                  className="flex-1 bg-surface2 hover:bg-surface3 border border-app rounded-xl text-sm font-semibold py-3 transition-all active:scale-95"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmDeletePayment}
                  disabled={deletingPayment}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-semibold py-3 transition-all active:scale-95 disabled:opacity-50"
                >
                  {deletingPayment ? 'Eliminando...' : 'Eliminar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showExpenseModal && (
        <NewExpenseModal
          token={token}
          onClose={() => setShowExpenseModal(false)}
          onCreated={async () => {
            setShowExpenseModal(false)
            await refreshAll()
          }}
        />
      )}

      {showPendingModal && (
        <PendingDebtorsModal
          debtors={allDebtorsByPatient}
          masked={masked}
          onClose={() => setShowPendingModal(false)}
          onRegisterPayment={(patientId) => {
            setShowPendingModal(false)
            setPreselectedPatientId(patientId)
            setEditingPayment(null)
            setShowPaymentModal(true)
          }}
        />
      )}
    </div>
  )
}

// ── Utilidades de UI ──

function DragScroll({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const startX = useRef(0)
  const scrollLeft = useRef(0)

  function onMouseDown(e: React.MouseEvent) {
    dragging.current = true
    startX.current = e.pageX - (ref.current?.offsetLeft ?? 0)
    scrollLeft.current = ref.current?.scrollLeft ?? 0
  }
  function onMouseUp() { dragging.current = false }
  function onMouseLeave() { dragging.current = false }
  function onMouseMove(e: React.MouseEvent) {
    if (!dragging.current || !ref.current) return
    e.preventDefault()
    const x = e.pageX - ref.current.offsetLeft
    ref.current.scrollLeft = scrollLeft.current - (x - startX.current)
  }

  return (
    <div
      ref={ref}
      className="flex gap-2 overflow-x-auto pb-1 select-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      style={{ cursor: dragging.current ? 'grabbing' : 'grab' }}
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseLeave}
      onMouseMove={onMouseMove}
      onWheel={(e) => { e.preventDefault(); e.currentTarget.scrollLeft += e.deltaY }}
    >
      {children}
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <span className="text-xs font-bold text-[#00C4BC] uppercase tracking-widest bg-[#E6F8F1] px-2.5 py-1 rounded-full">
        {children}
      </span>
    </div>
  )
}

function DeltaBadge({
  d,
  label,
  positiveIsGood,
}: {
  d: { pct: number; up: boolean } | null
  label: string | null
  positiveIsGood: boolean
}) {
  if (!d || !label) return null
  const isGood = positiveIsGood ? d.up : !d.up
  return (
    <div className={`inline-flex items-center gap-1 text-xs font-semibold mt-1.5 px-1.5 py-0.5 rounded-md ${isGood
        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
        : 'bg-red-500/10 text-red-500'
      }`}>
      <span>{d.up ? '↑' : '↓'}</span>
      <span>{d.pct}%</span>
      <span className="font-normal opacity-70">{label}</span>
    </div>
  )
}

function Pagination({ page, hasMore, onPrev, onNext }: {
  page: number; hasMore: boolean; onPrev: () => void; onNext: () => void
}) {
  if (page === 1 && !hasMore) return null
  return (
    <div className="px-5 py-4 border-t border-app flex items-center justify-between">
      <button
        onClick={onPrev}
        disabled={page === 1}
        className="px-4 py-2 text-sm font-semibold bg-surface2 border border-app rounded-lg disabled:opacity-40 hover:bg-surface3 transition-colors active:scale-95"
      >
        ← Anterior
      </button>
      <span className="text-sm text-app3">Página {page}</span>
      <button
        onClick={onNext}
        disabled={!hasMore}
        className="px-4 py-2 text-sm font-semibold bg-surface2 border border-app rounded-lg disabled:opacity-40 hover:bg-surface3 transition-colors active:scale-95"
      >
        Siguiente →
      </button>
    </div>
  )
}

function PaymentModal({ token, patients: initialPatients, professionals, payment, preselectedPatientId, onClose, onSaved }: {
  token: string
  patients: any[]
  professionals: any[]
  payment?: any | null
  preselectedPatientId?: string | null
  onClose: () => void
  onSaved: (success?: { patientName: string; amount: number; remaining: number }) => void
}) {
  const isEditing = Boolean(payment)
  const [form, setForm] = useState(() => ({
    patient_id: payment?.patient_id ?? preselectedPatientId ?? '',
    concept: payment?.concept ?? '',
    total_amount: payment?.total_amount != null ? String(Number(payment.total_amount)) : '',
    amount: payment?.amount != null ? String(Number(payment.amount)) : '0',
    method: payment?.method ?? 'cash',
    installments: String(payment?.installments ?? 1),
    notes: payment?.notes ?? '',
    professional_id: payment?.professional_id ?? '',
  }))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedPatientData, setSelectedPatientData] = useState<any>(() => {
    if (payment?.patients) return { id: payment.patient_id, ...payment.patients }
    if (preselectedPatientId) return initialPatients.find((p: any) => p.id === preselectedPatientId) ?? null
    return null
  })
  const [showNewPatient, setShowNewPatient] = useState(false)
  const [newPatientName, setNewPatientName] = useState('')
  const [newPatientLastName, setNewPatientLastName] = useState('')
  const [creatingPatient, setCreatingPatient] = useState(false)
  const [patientBalance, setPatientBalance] = useState<number | null>(null)

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  const selectedPatient = selectedPatientData

  useEffect(() => {
    if (!form.patient_id || isEditing) { setPatientBalance(null); return }
    apiFetch(`/patients/${form.patient_id}/account-summary`, { token })
      .then((data: any) => setPatientBalance(Number(data.data?.balance_due ?? 0)))
      .catch(() => setPatientBalance(null))
  }, [form.patient_id, token, isEditing])

  useEffect(() => {
    if (!preselectedPatientId || selectedPatientData) return
    apiFetch(`/patients/${preselectedPatientId}`, { token })
      .then((data: any) => {
        const p = data.data ?? data
        setSelectedPatientData(p)
        set('patient_id', p.id)
      })
      .catch(() => {})
  }, [preselectedPatientId, token])

  useEffect(() => {
    if (!search.trim()) { setSearchResults([]); return }
    setSearching(true)
    apiFetch(`/patients?q=${encodeURIComponent(search.trim())}&limit=10`, { token })
      .then((data: any) => setSearchResults(data.data ?? []))
      .catch(() => setSearchResults([]))
      .finally(() => setSearching(false))
  }, [search, token])

  async function handleCreatePatient() {
    if (!newPatientName) return
    setCreatingPatient(true)
    try {
      const data = await apiFetch('/patients', {
        method: 'POST', token,
        body: JSON.stringify({ first_name: newPatientName, last_name: newPatientLastName || '.', phone: 'Sin teléfono' })
      })
      setSelectedPatientData(data.data)
      set('patient_id', data.data.id)
      setShowNewPatient(false)
      setNewPatientName('')
      setNewPatientLastName('')
    } catch (err: any) {
      console.error(err)
    } finally {
      setCreatingPatient(false)
    }
  }

  const totalAmount = Number(form.total_amount) || 0
  const paidAmount = Number(form.amount) || 0
  const installments = form.method === 'credit_card' ? Number(form.installments) : 1
  const remaining = totalAmount > 0 ? totalAmount - paidAmount : 0
  const currentBalance = patientBalance ?? 0
  const netBalance = totalAmount > 0
    ? currentBalance + totalAmount - paidAmount
    : currentBalance - paidAmount

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.patient_id) { setError('Seleccioná un paciente'); return }
    if (paidAmount < 0) { setError('Ingresá un monto válido'); return }
    if (paidAmount === 0 && totalAmount <= 0) {
      setError('Si no entrega nada, cargá el total del servicio para dejarlo en cuenta corriente')
      return
    }
    setLoading(true)
    setError('')
    try {
      const payload = {
        amount: paidAmount,
        concept: form.concept || (isEditing ? null : undefined),
        total_amount: totalAmount > 0 ? totalAmount : (isEditing ? null : undefined),
        method: form.method,
        installments,
        notes: form.notes.trim() ? form.notes.trim() : (isEditing ? null : undefined),
        ...(form.professional_id ? { professional_id: form.professional_id } : {}),
      }
      await apiFetch(isEditing ? `/payments/${payment.id}` : '/payments', {
        method: isEditing ? 'PATCH' : 'POST', token,
        body: JSON.stringify({ ...(isEditing ? {} : { patient_id: form.patient_id || undefined }), ...payload })
      })
      onSaved(isEditing ? undefined : {
        patientName: selectedPatient ? `${selectedPatient.first_name} ${selectedPatient.last_name}` : 'Paciente',
        amount: paidAmount,
        remaining: netBalance,
      })
    } catch (err: any) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-surface border border-app rounded-2xl w-full max-w-md">
        <div className="p-5">
          <div className="w-9 h-1 bg-surface3 rounded-full mx-auto mb-4 sm:hidden" />
          <h2 className="text-base font-bold text-app mb-4">{isEditing ? 'Editar cobro' : 'Registrar cobro'}</h2>
          <form onSubmit={handleSubmit} className="space-y-3">

            {/* Paciente */}
            <div>
              <label className="block text-xs font-semibold text-app3 uppercase tracking-wider mb-1.5">Paciente</label>
              {selectedPatient ? (
                <div className="flex items-center justify-between bg-surface2 rounded-xl px-3 py-2.5">
                  <div className="font-medium text-app text-sm">{selectedPatient.first_name} {selectedPatient.last_name}</div>
                  {!isEditing && (
                    <button type="button" onClick={() => { set('patient_id', ''); setSelectedPatientData(null); setShowNewPatient(false) }}
                      className="text-app3 hover:text-app text-sm ml-2">✕</button>
                  )}
                </div>
              ) : isEditing ? (
                <div className="bg-surface2 rounded-xl px-3 py-2.5 text-sm text-app3">Paciente no disponible</div>
              ) : showNewPatient ? (
                <div className="bg-surface2 rounded-xl p-3 border border-[#00C4BC]/30">
                  <div className="text-xs text-[#00C4BC] font-semibold mb-2">Nuevo paciente rápido</div>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <input type="text" value={newPatientName} onChange={e => setNewPatientName(e.target.value)}
                      placeholder="Nombre"
                      className="bg-surface3 border border-app rounded-lg px-3 py-2 text-app text-sm focus:outline-none focus:border-[#00C4BC]" />
                    <input type="text" value={newPatientLastName} onChange={e => setNewPatientLastName(e.target.value)}
                      placeholder="Apellido"
                      className="bg-surface3 border border-app rounded-lg px-3 py-2 text-app text-sm focus:outline-none focus:border-[#00C4BC]" />
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setShowNewPatient(false)}
                      className="flex-1 bg-surface3 text-app2 text-xs font-semibold py-2 rounded-lg transition-colors">Cancelar</button>
                    <button type="button" onClick={handleCreatePatient}
                      disabled={!newPatientName || creatingPatient}
                      className="flex-1 bg-[#00C4BC] hover:bg-[#00aaa3] disabled:opacity-50 text-white text-xs font-semibold py-2 rounded-lg transition-colors">
                      {creatingPatient ? 'Creando...' : 'Crear y usar'}
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar paciente..."
                    className="w-full bg-surface2 border border-app rounded-xl px-3 py-2.5 text-app text-sm focus:outline-none focus:border-[#00C4BC] mb-1.5" />
                  {search && (
                    <div className="bg-surface2 border border-app rounded-xl overflow-hidden max-h-36 overflow-y-auto mb-1.5">
                      {searching && <div className="px-3 py-2.5 text-app3 text-sm">Buscando...</div>}
                      {!searching && searchResults.map(p => (
                        <div key={p.id} onClick={() => { set('patient_id', p.id); setSelectedPatientData(p); setSearch('') }}
                          className="px-3 py-2 hover:bg-surface3 cursor-pointer text-sm text-app">
                          {p.first_name} {p.last_name} · <span className="text-app2">{p.phone}</span>
                        </div>
                      ))}
                      {!searching && searchResults.length === 0 && <div className="px-3 py-2.5 text-app3 text-sm">Sin resultados</div>}
                    </div>
                  )}
                  <button type="button" onClick={() => setShowNewPatient(true)}
                    className="w-full bg-surface2 hover:bg-surface3 border border-dashed border-app2 text-app2 hover:text-app text-xs font-semibold py-2 rounded-xl transition-colors">
                    + Crear nuevo paciente
                  </button>
                </div>
              )}
            </div>

            {/* Tipo + método */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-app3 uppercase tracking-wider mb-1.5">Tipo de consulta</label>
                <select value={form.concept} onChange={e => set('concept', e.target.value)}
                  className="w-full bg-surface2 border border-app rounded-xl px-3 py-2.5 text-app text-sm focus:outline-none focus:border-[#00C4BC] appearance-none">
                  <option value="">— Sin tipo —</option>
                  {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-app3 uppercase tracking-wider mb-1.5">Forma de pago</label>
                <select value={form.method} onChange={e => set('method', e.target.value)}
                  className="w-full bg-surface2 border border-app rounded-xl px-3 py-2.5 text-app text-sm focus:outline-none focus:border-[#00C4BC] appearance-none">
                  {METODOS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
            </div>

            {/* Profesional */}
            {professionals.length > 1 && (
              <div>
                <label className="block text-xs font-semibold text-app3 uppercase tracking-wider mb-1.5">Profesional</label>
                <select value={form.professional_id} onChange={e => set('professional_id', e.target.value)}
                  className="w-full bg-surface2 border border-app rounded-xl px-3 py-2.5 text-app text-sm focus:outline-none focus:border-[#00C4BC] appearance-none">
                  <option value="">— Sin especificar —</option>
                  {professionals.map(p => (
                    <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Cuotas */}
            {form.method === 'credit_card' && (
              <div>
                <label className="block text-xs font-semibold text-app3 uppercase tracking-wider mb-1.5">Cuotas</label>
                <div className="grid grid-cols-4 gap-2">
                  {['1', '3', '6', '12'].map(c => (
                    <button key={c} type="button" onClick={() => set('installments', c)}
                      className={`py-2 rounded-xl text-sm font-semibold transition-colors ${form.installments === c ? 'bg-[#00C4BC] text-white' : 'bg-surface2 border border-app text-app2'}`}>
                      {c}x
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Total + Entregado */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-app3 uppercase tracking-wider mb-1.5">
                  Total <span className="font-normal normal-case text-app3">(opcional)</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-app3 font-bold text-sm">$</span>
                  <input type="number" value={form.total_amount} onChange={e => set('total_amount', e.target.value)}
                    placeholder="0"
                    className="w-full bg-surface2 border border-app rounded-xl pl-7 pr-3 py-2.5 text-app text-lg font-bold focus:outline-none focus:border-[#00C4BC]"
                    min="0" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-app3 uppercase tracking-wider mb-1.5">Entregado</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-app3 font-bold text-sm">$</span>
                  <input type="number" value={form.amount} onChange={e => set('amount', e.target.value)}
                    onFocus={() => { if (form.amount === '0') set('amount', '') }}
                    onBlur={() => { if (form.amount === '') set('amount', '0') }}
                    placeholder="0"
                    className="w-full bg-surface2 border border-app rounded-xl pl-7 pr-3 py-2.5 text-app text-lg font-bold focus:outline-none focus:border-[#00C4BC]"
                    min="0" required />
                </div>
              </div>
            </div>

            {(totalAmount > 0 || (patientBalance !== null && patientBalance !== 0)) && (() => {
              const showNet = patientBalance !== null && patientBalance !== 0
              const valueToShow = showNet ? netBalance : remaining
              if (valueToShow > 0) return (
                <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2">
                  <span className="text-amber-500">⚠️</span>
                  <span className="text-xs text-amber-600 dark:text-amber-400 font-semibold">Queda debiendo </span>
                  <span className="text-sm font-bold text-amber-500">${valueToShow.toLocaleString('es-AR')}</span>
                </div>
              )
              if (valueToShow < 0) return (
                <div className="flex items-center gap-2 bg-[#E6F8F1] border border-[#00C4BC]/30 rounded-xl px-3 py-2">
                  <span className="text-xs text-[#00C4BC] font-semibold">✓ Saldo a favor: ${Math.abs(valueToShow).toLocaleString('es-AR')}</span>
                </div>
              )
              return (
                <div className="flex items-center gap-2 bg-[#E6F8F1] border border-[#00C4BC]/30 rounded-xl px-3 py-2">
                  <span className="text-xs text-[#00C4BC] font-semibold">✓ {showNet ? 'Queda al día' : 'Pago completo'}</span>
                </div>
              )
            })()}

            {/* Notas */}
            <div>
              <label className="block text-xs font-semibold text-app3 uppercase tracking-wider mb-1.5">Notas (opcional)</label>
              <input type="text" value={form.notes} onChange={e => set('notes', e.target.value)}
                placeholder="Referencia, observación..."
                className="w-full bg-surface2 border border-app rounded-xl px-3 py-2.5 text-app text-sm focus:outline-none focus:border-[#00C4BC]" />
            </div>

            {error && <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-600 dark:text-red-400 text-sm">{error}</div>}

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={onClose}
                className="flex-1 bg-surface2 hover:bg-surface3 border border-app text-app font-semibold py-2.5 rounded-xl transition-colors">
                Cancelar
              </button>
              <button type="submit" disabled={loading}
                className="flex-1 bg-[#00C4BC] hover:bg-[#00aaa3] disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition-colors">
                {loading ? 'Guardando...' : isEditing ? 'Guardar cambios' : 'Registrar cobro'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

const PENDING_PAGE_SIZE = 5

type AgingBand = 'all' | '0-30' | '30-60' | '60+'

function daysSince(dateStr: string): number {
  const today = new Date(new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }))
  const d = new Date(dateStr)
  return Math.floor((today.getTime() - d.getTime()) / 86400000)
}

function PendingDebtorsModal({ debtors, masked, onClose, onRegisterPayment }: {
  debtors: { id: string; name: string; phone: string; balance: number; last_payment_at: string }[]
  masked: boolean
  onClose: () => void
  onRegisterPayment: (patientId: string) => void
}) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [agingBand, setAgingBand] = useState<AgingBand>('all')

  const top5 = debtors.slice(0, 5)
  const total = debtors.reduce((s, d) => s + d.balance, 0)

  const agingFiltered = agingBand === 'all' ? debtors : debtors.filter(d => {
    const days = daysSince(d.last_payment_at)
    if (agingBand === '0-30') return days <= 30
    if (agingBand === '30-60') return days > 30 && days <= 60
    return days > 60
  })

  const filtered = search.trim()
    ? agingFiltered.filter(d => d.name.toLowerCase().includes(search.trim().toLowerCase()))
    : agingFiltered

  const totalPages = Math.ceil(filtered.length / PENDING_PAGE_SIZE) || 1
  const pageItems = filtered.slice((page - 1) * PENDING_PAGE_SIZE, page * PENDING_PAGE_SIZE)

  function handleSearch(v: string) { setSearch(v); setPage(1) }
  function handleBand(b: AgingBand) { setAgingBand(b); setSearch(''); setPage(1) }

  const BANDS: { value: AgingBand; label: string }[] = [
    { value: 'all', label: 'Todos' },
    { value: '0-30', label: '0–30 días' },
    { value: '30-60', label: '30–60 días' },
    { value: '60+', label: '+60 días' },
  ]

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-surface border border-app rounded-2xl w-full max-w-lg flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-app flex-shrink-0">
          <div className="w-9 h-1 bg-surface3 rounded-full mx-auto mb-4 sm:hidden" />
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-base font-bold text-app">Pacientes con saldo pendiente</h2>
              <p className="text-xs text-app3 mt-0.5">
                {debtors.length} {debtors.length === 1 ? 'paciente debe' : 'pacientes deben'} ·{' '}
                <span className="text-amber-400 font-semibold">
                  {masked ? '••••••' : '$' + total.toLocaleString('es-AR')}
                </span>
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-app3 hover:text-app hover:bg-surface2 transition-all"
            >
              ✕
            </button>
          </div>

          {/* Top 5 deudores */}
          {top5.length > 0 && (
            <div className="mb-3 bg-surface2 rounded-xl p-3">
              <div className="text-xs font-semibold text-app3 uppercase tracking-wider mb-2">Top 5 deudores</div>
              <div className="space-y-1.5">
                {top5.map((d, i) => (
                  <div key={d.id} className="flex items-center gap-2">
                    <span className="text-xs font-bold text-app3 w-4 text-right">{i + 1}.</span>
                    <span className="text-xs text-app flex-1 truncate">{d.name}</span>
                    <span className="text-xs font-bold text-amber-400">
                      {masked ? '••••••' : '$' + d.balance.toLocaleString('es-AR')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Aging filter pills */}
          <div className="flex gap-1.5 mb-3">
            {BANDS.map(b => (
              <button
                key={b.value}
                onClick={() => handleBand(b.value)}
                className={`text-xs px-2.5 py-1 rounded-lg font-semibold transition-all ${
                  agingBand === b.value
                    ? 'bg-amber-500 text-white'
                    : 'bg-surface2 text-app3 hover:text-app hover:bg-surface3'
                }`}
              >
                {b.label}
              </button>
            ))}
          </div>

          <input
            type="text"
            value={search}
            onChange={e => handleSearch(e.target.value)}
            placeholder="Buscar paciente..."
            className="w-full bg-surface2 border border-app rounded-xl px-3 py-2 text-app text-sm focus:outline-none focus:border-[#00C4BC]"
          />
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-6 py-10 text-center text-app3 text-sm">
              {search || agingBand !== 'all' ? 'Sin resultados' : 'Sin cobros pendientes'}
            </div>
          ) : (
            <div className="divide-y divide-app">
              {pageItems.map(d => (
                <div key={d.id} className="px-5 py-4 flex items-center gap-4">
                  <div className="w-9 h-9 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center text-sm font-bold flex-shrink-0">
                    {d.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm text-app truncate">{d.name}</div>
                    <div className="text-xs text-app3 mt-0.5">
                      Último pago:{' '}
                      {new Date(d.last_payment_at).toLocaleDateString('es-AR', {
                        day: 'numeric', month: 'short', year: 'numeric',
                        timeZone: 'America/Argentina/Buenos_Aires',
                      })}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 mr-2">
                    <div className="text-sm font-bold text-amber-400">
                      {masked ? '••••••' : '$' + d.balance.toLocaleString('es-AR')}
                    </div>
                    <div className="text-xs text-app3">{daysSince(d.last_payment_at)}d atrás</div>
                  </div>
                  <div className="flex flex-col gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => onRegisterPayment(d.id)}
                      className="text-xs font-semibold bg-[#00C4BC] hover:bg-[#00aaa3] text-white px-2.5 py-1.5 rounded-lg transition-all active:scale-95 whitespace-nowrap"
                    >
                      Cobrar
                    </button>
                    <button
                      title="Recordar por WhatsApp (próximamente)"
                      disabled
                      className="text-xs font-semibold bg-surface2 border border-app text-app3 px-2.5 py-1.5 rounded-lg opacity-50 cursor-not-allowed whitespace-nowrap flex items-center gap-1 justify-center"
                    >
                      <span>💬</span> WSP
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Paginado */}
        {totalPages > 1 && (
          <div className="px-5 py-3 border-t border-app flex items-center justify-between flex-shrink-0">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 text-xs font-semibold bg-surface2 border border-app rounded-lg disabled:opacity-40 hover:bg-surface3 transition-colors active:scale-95"
            >
              ← Anterior
            </button>
            <span className="text-xs text-app3">{page} / {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 text-xs font-semibold bg-surface2 border border-app rounded-lg disabled:opacity-40 hover:bg-surface3 transition-colors active:scale-95"
            >
              Siguiente →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function NewExpenseModal({ token, onClose, onCreated }: {
  token: string
  onClose: () => void
  onCreated: () => void
}) {
  const [form, setForm] = useState({
    amount: '',
    category: '',
    description: '',
    paid_at: new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }),
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.amount || Number(form.amount) <= 0) { setError('Ingresá un monto válido'); return }
    if (!form.category) { setError('Seleccioná una categoría'); return }
    setLoading(true)
    setError('')
    try {
      await apiFetch('/expenses', {
        method: 'POST', token,
        body: JSON.stringify({
          amount: Number(form.amount),
          category: form.category,
          description: form.description || undefined,
          paid_at: `${form.paid_at}T12:00:00-03:00`,
        })
      })
      onCreated()
    } catch (err: any) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface border border-app rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-6">
          <div className="w-9 h-1 bg-surface3 rounded-full mx-auto mb-5 sm:hidden" />
          <h2 className="text-lg font-bold text-app mb-5">Registrar gasto</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-app3 uppercase tracking-wider mb-2">Monto</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-app3 font-bold">$</span>
                <input type="number" value={form.amount} onChange={e => set('amount', e.target.value)}
                  placeholder="0"
                  className="w-full bg-surface2 border border-app rounded-xl pl-8 pr-4 py-3 text-app text-xl font-bold focus:outline-none focus:border-[#00C4BC]"
                  min="1" required />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-app3 uppercase tracking-wider mb-2">Categoría</label>
              <div className="grid grid-cols-3 gap-2">
                {CATEGORIAS_GASTO.map(c => (
                  <button key={c} type="button" onClick={() => set('category', c)}
                    className={`py-2 px-2 rounded-xl text-xs font-semibold transition-all active:scale-95 ${form.category === c ? 'bg-[#00C4BC] text-white' : 'bg-surface2 border border-app text-app2 hover:border-app2'
                      }`}>
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-app3 uppercase tracking-wider mb-2">Descripción (opcional)</label>
              <input type="text" value={form.description} onChange={e => set('description', e.target.value)}
                placeholder="Detalle del gasto..."
                className="w-full bg-surface2 border border-app rounded-xl px-4 py-3 text-app text-sm focus:outline-none focus:border-[#00C4BC]" />
            </div>

            <div>
              <label className="block text-xs font-semibold text-app3 uppercase tracking-wider mb-2">Fecha</label>
              <input type="date" value={form.paid_at} onChange={e => set('paid_at', e.target.value)}
                className="w-full bg-surface2 border border-app rounded-xl px-4 py-3 text-app text-sm focus:outline-none focus:border-[#00C4BC]" />
            </div>

            {error && <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-600 dark:text-red-400 text-sm">{error}</div>}

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose}
                className="flex-1 bg-surface2 hover:bg-surface3 border border-app text-app font-semibold py-3 rounded-xl transition-colors">
                Cancelar
              </button>
              <button type="submit" disabled={loading}
                className="flex-1 bg-red-500 hover:bg-red-600 disabled:opacity-50 active:scale-95 text-white font-semibold py-3 rounded-xl transition-all">
                {loading ? 'Guardando...' : 'Registrar gasto'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
