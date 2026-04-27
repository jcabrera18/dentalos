'use client'

import { useEffect, useState } from 'react'
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
  { value: 'day', label: 'Hoy' },
  { value: 'week', label: 'Semana' },
  { value: 'month', label: 'Mes' },
  { value: 'year', label: 'Año' },
  { value: 'all', label: 'Histórico' },
] as const

type Period = 'day' | 'week' | 'month' | 'year' | 'all'

const PIE_COLORS = ['#00C4BC', '#6366f1', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']
const BAR_COLORS = ['#00C4BC', '#6366f1', '#3b82f6', '#8b5cf6', '#a78bfa', '#c4b5fd']
const HIST_PAGE_SIZE = 20

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
function getPrevPeriodRange(period: Period): { from: string; to: string } | null {
  if (period === 'all') return null
  if (period === 'day') {
    const d = new Date()
    d.setDate(d.getDate() - 1)
    const s = d.toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
    return { from: s, to: s }
  }
  if (period === 'week') {
    const end = new Date(); end.setDate(end.getDate() - 7)
    const start = new Date(); start.setDate(start.getDate() - 13)
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
  day: 'vs ayer',
  week: 'vs sem. anterior',
  month: 'vs mes anterior',
  year: 'vs año anterior',
  all: null,
}

function periodToDateRange(period: Period) {
  const to = todayAR()
  let from: string
  if (period === 'day') {
    from = to
  } else if (period === 'week') {
    const d = new Date(); d.setDate(d.getDate() - 6)
    from = d.toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
  } else if (period === 'month') {
    from = firstOfMonthAR()
  } else if (period === 'year') {
    from = `${todayAR().slice(0, 4)}-01-01`
  } else {
    from = '2025-01-01'
  }
  return { from, to }
}

export default function StatisticsPage() {
  const [loading, setLoading] = useState(true)
  const [dataLoading, setDataLoading] = useState(false)
  const [token, setToken] = useState('')

  // Subvista
  const [subview, setSubview] = useState<'financieras' | 'clinicas'>('financieras')

  // Período y datos financieros
  const [period, setPeriod] = useState<Period>('month')
  const [payments, setPayments] = useState<any[]>([])
  const [expenses, setExpenses] = useState<any[]>([])
  const [chartData, setChartData] = useState<{ day: string; total: number }[]>([])

  // Métricas clínicas (últimos 90 días, cargadas una vez — para gráficos)
  const [attendedByMonth, setAttendedByMonth] = useState<{ month: string; total: number }[]>([])
  const [topTypes, setTopTypes] = useState<{ type: string; count: number }[]>([])
  const [attendedByProfessional, setAttendedByProfessional] = useState<{ name: string; color: string; count: number }[]>([])

  // KPIs clínicos por período
  const [clinicalPeriod, setClinicalPeriod] = useState<Period>('month')
  const [clinicalAppts, setClinicalAppts] = useState<any[]>([])
  const [clinicalLoading, setClinicalLoading] = useState(false)

  // Período anterior (para comparación)
  const [prevPayments, setPrevPayments] = useState<any[]>([])
  const [prevExpenses, setPrevExpenses] = useState<any[]>([])

  // Historial
  const [histFilter, setHistFilter] = useState<'all' | 'ingresos' | 'gastos'>('all')
  const [histPage, setHistPage] = useState(1)

  // Modales
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

  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/'); return }
      const t = session.access_token
      setToken(t)

      await Promise.all([
        fetchFinancialData('month', t),
        fetchChartData(t),
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

  async function fetchFinancialData(p: Period, t: string) {
    setDataLoading(true)
    try {
      const { from, to } = periodToDateRange(p)
      const prevRange = getPrevPeriodRange(p)

      const fetches: Promise<any>[] = [
        apiFetch(`/payments?from=${from}&to=${to}&limit=500`, { token: t }),
        apiFetch(`/expenses?from=${from}&to=${to}&limit=500`, { token: t }),
      ]
      if (prevRange) {
        fetches.push(apiFetch(`/payments?from=${prevRange.from}&to=${prevRange.to}&limit=500`, { token: t }))
        fetches.push(apiFetch(`/expenses?from=${prevRange.from}&to=${prevRange.to}&limit=500`, { token: t }))
      }

      const [pData, eData, prevPData, prevEData] = await Promise.all(fetches)
      setPayments(pData.data ?? [])
      setExpenses(eData.data ?? [])
      setPrevPayments(prevPData?.data ?? [])
      setPrevExpenses(prevEData?.data ?? [])
      setHistPage(1)
    } finally {
      setDataLoading(false)
    }
  }

  async function fetchChartData(t: string) {
    const from = firstOfMonthAR()
    const to = todayAR()
    const data = await apiFetch(`/payments?from=${from}&to=${to}&limit=500`, { token: t })
    const list: any[] = data.data ?? []

    const byDay: Record<string, number> = {}
    list.forEach(p => {
      const day = new Date(p.paid_at).toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
      byDay[day] = (byDay[day] ?? 0) + Number(p.amount)
    })

    const result: { day: string; total: number }[] = []
    const start = new Date(`${from}T12:00:00-03:00`)
    const end = new Date(`${to}T12:00:00-03:00`)
    const cur = new Date(start)
    while (cur <= end) {
      const key = cur.toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
      const label = cur.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', timeZone: 'America/Argentina/Buenos_Aires' })
      result.push({ day: label, total: byDay[key] ?? 0 })
      cur.setDate(cur.getDate() + 1)
    }
    setChartData(result)
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

    // Atendidos por mes
    const monthMap: Record<string, number> = {}
    appts.forEach(a => {
      if (a.status === 'cancelled') return
      const label = new Date(a.starts_at).toLocaleDateString('es-AR', {
        month: 'short', year: '2-digit', timeZone: 'America/Argentina/Buenos_Aires',
      })
      monthMap[label] = (monthMap[label] ?? 0) + 1
    })
    setAttendedByMonth(Object.entries(monthMap).map(([month, total]) => ({ month, total })))

    // Tipos más frecuentes
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

    // Atendidos por profesional
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

  async function handleChangePeriod(p: Period) {
    setPeriod(p)
    await fetchFinancialData(p, token)
  }

  async function handleChangeClinicalPeriod(p: Period) {
    setClinicalPeriod(p)
    await fetchClinicalPeriodData(p, token)
  }

  async function confirmDeletePayment() {
    if (!token || !paymentToDelete) return
    setDeletingPayment(true)
    setDeletePaymentError('')
    try {
      await apiFetch(`/payments/${paymentToDelete.id}`, { method: 'DELETE', token })
      await fetchFinancialData(period, token)
      if (period === 'month') await fetchChartData(token)
      setPaymentToDelete(null)
    } catch (err) {
      setDeletePaymentError(err instanceof Error ? err.message : 'No se pudo eliminar el cobro')
    } finally {
      setDeletingPayment(false)
    }
  }

  async function deleteExpense(id: string) {
    await apiFetch(`/expenses/${id}`, { method: 'DELETE', token })
    await fetchFinancialData(period, token)
  }

  // ── Valores calculados ──

  const income = payments.reduce((s, p) => s + Number(p.amount), 0)
  const expense = expenses.reduce((s, e) => s + Number(e.amount), 0)
  const net = income - expense
  const avgTicket = payments.length > 0 ? Math.round(income / payments.length) : 0

  const prevIncome = prevPayments.reduce((s, p) => s + Number(p.amount), 0)
  const prevExpense = prevExpenses.reduce((s, e) => s + Number(e.amount), 0)
  const prevAvgTicket = prevPayments.length > 0 ? Math.round(prevIncome / prevPayments.length) : 0

  const pendingCashflow = payments.reduce((s, p) => {
    const total = Number(p.total_amount) || 0
    const paid = Number(p.amount) || 0
    return s + Math.max(0, total - paid)
  }, 0)

  function delta(current: number, previous: number): { pct: number; up: boolean } | null {
    if (previous === 0 || !PREV_LABEL[period]) return null
    const pct = Math.round(((current - previous) / previous) * 100)
    return { pct: Math.abs(pct), up: pct >= 0 }
  }

  const deltaIncome = delta(income, prevIncome)
  const deltaExpense = delta(expense, prevExpense)
  const deltaAvgTicket = delta(avgTicket, prevAvgTicket)
  const prevLabel = PREV_LABEL[period]

  const byMethod = (Object.values(
    payments.reduce((acc, p) => {
      const k = p.method ?? 'other'
      acc[k] = { method: k, total: (acc[k]?.total ?? 0) + Number(p.amount) }
      return acc
    }, {} as Record<string, { method: string; total: number }>)
  ) as { method: string; total: number }[]).sort((a, b) => b.total - a.total)

  const byCategory = (Object.values(
    expenses.reduce((acc, e) => {
      const k = e.category ?? 'Otro'
      acc[k] = { category: k, total: (acc[k]?.total ?? 0) + Number(e.amount) }
      return acc
    }, {} as Record<string, { category: string; total: number }>)
  ) as { category: string; total: number }[]).sort((a, b) => b.total - a.total)

  const byProfessional = (Object.values(
    payments.reduce((acc, p) => {
      const k = p.professional_id ?? 'sin'
      const name = p.professionals
        ? `${p.professionals.first_name} ${p.professionals.last_name}`
        : 'Sin profesional'
      if (!acc[k]) acc[k] = { name, total: 0 }
      acc[k].total += Number(p.amount)
      return acc
    }, {} as Record<string, { name: string; total: number }>)
  ) as { name: string; total: number }[]).sort((a, b) => b.total - a.total)

  // ── KPIs clínicos por período ──
  const clinicalTotal = clinicalAppts.length
  const clinicalActive = clinicalAppts.filter(a => a.status !== 'cancelled').length
  const clinicalAttended = clinicalAppts.filter(a => a.status === 'completed').length
  const clinicalAbsent = clinicalAppts.filter(a => a.status === 'absent').length
  const clinicalAttendanceRate = clinicalActive > 0 ? Math.round((clinicalAttended / clinicalActive) * 100) : 0
  const clinicalAbsenceRate = clinicalActive > 0 ? Math.round((clinicalAbsent / clinicalActive) * 100) : 0
  const clinicalOccupancyRate = clinicalTotal > 0 ? Math.round((clinicalAttended / clinicalTotal) * 100) : 0

  // Historial combinado
  const combined = [
    ...payments.map(p => ({ ...p, _type: 'ingreso' as const, _date: p.paid_at })),
    ...expenses.map(e => ({ ...e, _type: 'gasto' as const, _date: e.paid_at })),
  ].sort((a, b) => new Date(b._date).getTime() - new Date(a._date).getTime())

  const filteredHist = histFilter === 'all'
    ? combined
    : histFilter === 'ingresos'
      ? combined.filter(i => i._type === 'ingreso')
      : combined.filter(i => i._type === 'gasto')

  const totalHistPages = Math.ceil(filteredHist.length / HIST_PAGE_SIZE) || 1
  const histItems = filteredHist.slice((histPage - 1) * HIST_PAGE_SIZE, histPage * HIST_PAGE_SIZE)

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
            {[...Array(5)].map((_, i) => <div key={i} className="h-8 bg-surface2 rounded-lg w-16" />)}
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

        {/* Fila 3: selector de período */}
        {(subview === 'financieras' || subview === 'clinicas') && (
          <div className="px-6 py-2.5 flex items-center gap-2 overflow-x-auto">
            <span className="text-xs text-app3 whitespace-nowrap flex-shrink-0">Período:</span>
            {PERIOD_OPTIONS.map(opt => {
              const active = subview === 'financieras' ? period : clinicalPeriod
              const handler = subview === 'financieras' ? handleChangePeriod : handleChangeClinicalPeriod
              return (
                <button
                  key={opt.value}
                  onClick={() => handler(opt.value)}
                  className={`px-3 py-1.5 text-sm font-semibold rounded-lg transition-all whitespace-nowrap flex-shrink-0 ${active === opt.value
                      ? 'bg-[#E6F8F1] text-[#00C4BC]'
                      : 'bg-surface2 text-app2 hover:text-app'
                    }`}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>
        )}
      </div>

      <main className="p-6 max-w-4xl mx-auto space-y-6">

        {/* ══════════════ FINANCIERAS ══════════════ */}
        {subview === 'financieras' && <>

          {/* ── BLOQUE 1: Resumen financiero ── */}
          <section>

            {dataLoading ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="bg-surface border border-app rounded-xl p-5 animate-pulse space-y-3">
                    <div className="h-3 bg-surface2 rounded w-20" />
                    <div className="h-7 bg-surface2 rounded w-24" />
                  </div>
                ))}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {/* Ingresos */}
                  <div className="bg-surface border border-app rounded-xl p-5">
                    <div className="text-xs text-app3 uppercase tracking-wider mb-1">Ingresos</div>
                    <div className="text-2xl font-bold text-[#00C4BC] dark:text-emerald-400">{formatARS(income)}</div>
                    <DeltaBadge d={deltaIncome} label={prevLabel} positiveIsGood />
                    <div className="text-xs text-app3 mt-1">{payments.length} cobros</div>
                  </div>

                  {/* Gastos */}
                  <div className="bg-surface border border-app rounded-xl p-5">
                    <div className="text-xs text-app3 uppercase tracking-wider mb-1">Gastos</div>
                    <div className="text-2xl font-bold text-red-500 dark:text-red-400">{formatARS(expense)}</div>
                    <DeltaBadge d={deltaExpense} label={prevLabel} positiveIsGood={false} />
                    <div className="text-xs text-app3 mt-1">{expenses.length} registros</div>
                  </div>

                  {/* Ticket promedio */}
                  <div className="bg-surface border border-app rounded-xl p-5">
                    <div className="text-xs text-app3 uppercase tracking-wider mb-1">Ticket promedio</div>
                    <div className="text-2xl font-bold text-[#00C4BC]">
                      {avgTicket > 0 ? formatARS(avgTicket) : '—'}
                    </div>
                    <DeltaBadge d={deltaAvgTicket} label={prevLabel} positiveIsGood />
                    <div className="text-xs text-app3 mt-1">por cobro</div>
                  </div>

                  {/* Cobros pendientes */}
                  <div className={`bg-surface border rounded-xl p-5 ${pendingCashflow > 0 ? 'border-amber-500/40' : 'border-app'}`}>
                    <div className="text-xs text-app3 uppercase tracking-wider mb-1">Cobros pendientes</div>
                    <div className={`text-2xl font-bold ${pendingCashflow > 0 ? 'text-amber-400' : 'text-[#00C4BC]'}`}>
                      {pendingCashflow > 0 ? formatARS(pendingCashflow) : '—'}
                    </div>
                    <div className="text-xs text-app3 mt-1">
                      {pendingCashflow > 0 ? 'por cobrar' : 'al día'}
                    </div>
                  </div>

                </div>

                {income > 0 && (
                  <div className="mt-3 bg-surface border border-app rounded-xl px-5 py-4">
                    <div className="flex justify-between text-xs text-app3 mb-2">
                      <span>Gastos vs ingresos</span>
                      <span>{Math.round((expense / income) * 100)}%</span>
                    </div>
                    <div className="h-2 bg-surface2 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${expense / income > 0.8 ? 'bg-red-500'
                            : expense / income > 0.5 ? 'bg-amber-500'
                              : 'bg-[#00C4BC]'
                          }`}
                        style={{ width: `${Math.min(100, (expense / income) * 100)}%` }}
                      />
                    </div>
                  </div>
                )}
              </>
            )}
          </section>

          {/* ── BLOQUE 2: Evolución del mes (solo period=month) ── */}
          {period === 'month' && !dataLoading && (
            <section>
              <div className="bg-surface border border-app rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-app">Evolución del mes</h3>
                    <div className="text-xs text-app3 mt-0.5">
                      {new Date().toLocaleDateString('es-AR', { month: 'long', year: 'numeric', timeZone: 'America/Argentina/Buenos_Aires' })}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-emerald-500">{formatARS(chartData.reduce((s, d) => s + d.total, 0))}</div>
                    <div className="text-xs text-app3">{chartData.filter(d => d.total > 0).length} días con cobros</div>
                  </div>
                </div>
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="day" tick={{ fontSize: 10, fill: 'var(--text3)' }} tickLine={false} axisLine={false} interval={Math.floor(chartData.length / 6)} />
                      <YAxis tick={{ fontSize: 10, fill: 'var(--text3)' }} tickLine={false} axisLine={false} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} width={36} />
                      <Tooltip
                        contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', fontSize: '12px', color: 'var(--text)' }}
                        formatter={(val: any) => [formatARS(Number(val)), 'Ingresos']}
                        cursor={{ stroke: 'var(--border)' }}
                      />
                      <Line type="monotone" dataKey="total" stroke="#00C4BC" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: '#00C4BC' }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[180px] flex items-center justify-center text-app3 text-sm">Sin cobros este mes</div>
                )}
              </div>
            </section>
          )}

          {/* ── BLOQUE 3: Desglose ── */}
          {!dataLoading && (income > 0 || expense > 0) && (
            <section>
              <SectionLabel>Desglose</SectionLabel>
              <div className={`grid gap-4 ${byProfessional.length > 1 ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>

                {/* Por método */}
                <div className="bg-surface border border-app rounded-xl p-5">
                  <div className="text-xs text-app3 uppercase tracking-wider mb-3">Por método de cobro</div>
                  {byMethod.length > 0 ? (
                    <div className="space-y-2">
                      {byMethod.map(m => (
                        <div key={m.method} className="flex justify-between text-sm">
                          <span className="text-app2">{METODOS.find(x => x.value === m.method)?.label ?? m.method}</span>
                          <span className="font-semibold">{formatARS(m.total)}</span>
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
                          <span className="font-semibold">{formatARS(c.total)}</span>
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
                        <Tooltip
                          contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', fontSize: '11px', color: 'var(--text)' }}
                          formatter={(val: any, _: any, entry: any) => [
                            `${formatARS(Number(val))} (${income > 0 ? Math.round((Number(val) / income) * 100) : 0}%)`,
                            entry.name,
                          ]}
                        />
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
                            {formatARS(p.total)} <span className="text-app3 font-normal">({income > 0 ? Math.round((p.total / income) * 100) : 0}%)</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

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
                {/* Turnos agendados */}
                <div className="bg-surface border border-app rounded-xl p-5">
                  <div className="text-xs text-app3 uppercase tracking-wider mb-1">Turnos agendados</div>
                  <div className="text-3xl font-bold text-app">{clinicalActive}</div>
                  <div className="text-xs text-app3 mt-1">demanda bruta</div>
                </div>

                {/* Tasa de asistencia */}
                <div className="bg-surface border border-app rounded-xl p-5">
                  <div className="text-xs text-app3 uppercase tracking-wider mb-1">Asistencia</div>
                  <div className="text-3xl font-bold text-[#00C4BC]">
                    {clinicalActive > 0 ? `${clinicalAttendanceRate}%` : '—'}
                  </div>
                  <div className="text-xs text-app3 mt-1">{clinicalAttended} asistieron</div>
                </div>

                {/* Ausentismo */}
                <div className={`bg-surface border rounded-xl p-5 ${clinicalAbsenceRate > 20 ? 'border-red-500/40' : 'border-app'}`}>
                  <div className="text-xs text-app3 uppercase tracking-wider mb-1">Ausentismo</div>
                  <div className={`text-3xl font-bold ${clinicalAbsenceRate > 20 ? 'text-red-500' : clinicalAbsenceRate > 10 ? 'text-amber-500' : 'text-[#00C4BC]'}`}>
                    {clinicalActive > 0 ? `${clinicalAbsenceRate}%` : '—'}
                  </div>
                  <div className="text-xs text-app3 mt-1">{clinicalAbsent} no vinieron</div>
                </div>

                {/* Tasa de ocupación */}
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

        {/* ── Historial (solo Financieras) ── */}
        {subview === 'financieras' && <section id="historial">

          {/* ── BLOQUE 5: Historial de movimientos ── */}
          <section>
            <div className="flex items-center justify-between gap-4 mb-3">
              <SectionLabel>Historial</SectionLabel>
              <div className="flex items-center gap-1 bg-surface2 rounded-lg p-1">
                {([
                  { key: 'all', label: 'Todos' },
                  { key: 'ingresos', label: 'Cobros' },
                  { key: 'gastos', label: 'Gastos' },
                ] as const).map(f => (
                  <button
                    key={f.key}
                    onClick={() => { setHistFilter(f.key); setHistPage(1) }}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${histFilter === f.key ? 'bg-[#E6F8F1] text-[#00C4BC]' : 'text-app3 hover:text-app'
                      }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-surface border border-app rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-app flex items-center justify-between">
                <span className="text-sm font-semibold">{filteredHist.length} movimientos</span>
                {totalHistPages > 1 && (
                  <span className="text-xs text-app3">Pág. {histPage}/{totalHistPages}</span>
                )}
              </div>

              {dataLoading ? (
                <div className="px-5 py-12 text-center text-app3 animate-pulse">Cargando...</div>
              ) : histItems.length === 0 ? (
                <div className="px-5 py-12 text-center text-app3 text-sm">Sin movimientos en este período</div>
              ) : (
                <>
                  <div className="divide-y divide-app">
                    {histItems.map((item: any) => (
                      <div key={`${item._type}-${item.id}`} className="px-5 py-3.5 flex items-center gap-4">
                        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm ${item._type === 'ingreso' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'
                          }`}>
                          {item._type === 'ingreso' ? '💰' : '📦'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">
                            {item._type === 'ingreso'
                              ? (item.patients ? `${item.patients.first_name} ${item.patients.last_name}` : 'Sin paciente')
                              : item.category}
                          </div>
                          <div className="text-xs text-app3 truncate">
                            {item._type === 'ingreso'
                              ? (METODOS.find(m => m.value === item.method)?.label ?? item.method)
                              : (item.description || '')}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className={`font-bold text-sm ${item._type === 'ingreso' ? 'text-emerald-500 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                            {item._type === 'ingreso' ? '+' : '-'}{formatARS(Number(item.amount))}
                          </div>
                          <div className="text-xs text-app3">{formatDateAR(item._date)}</div>
                        </div>
                        {item._type === 'ingreso' ? (
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
                    onPrev={() => setHistPage(p => Math.max(1, p - 1))}
                    onNext={() => setHistPage(p => p + 1)}
                  />
                </>
              )}
            </div>
          </section>

        </section>}

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
            await fetchFinancialData(period, token)
            if (period === 'month') await fetchChartData(token)
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
            await fetchFinancialData(period, token)
          }}
        />
      )}
    </div>
  )
}

// ── Utilidades de UI ──

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
  const [patients, setPatients] = useState(initialPatients)
  const [showNewPatient, setShowNewPatient] = useState(false)
  const [newPatientName, setNewPatientName] = useState('')
  const [newPatientLastName, setNewPatientLastName] = useState('')
  const [creatingPatient, setCreatingPatient] = useState(false)

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  const editingPatient = payment?.patients ? { id: payment.patient_id, ...payment.patients } : null
  const filteredPatients = patients.filter(p =>
    `${p.first_name} ${p.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
    (p.phone ?? '').includes(search)
  )
  const selectedPatient = patients.find(p => p.id === form.patient_id) ?? editingPatient

  async function handleCreatePatient() {
    if (!newPatientName) return
    setCreatingPatient(true)
    try {
      const data = await apiFetch('/patients', {
        method: 'POST', token,
        body: JSON.stringify({ first_name: newPatientName, last_name: newPatientLastName || '.', phone: 'Sin teléfono' })
      })
      setPatients(prev => [data.data, ...prev])
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.patient_id) { setError('Seleccioná un paciente'); return }
    if (paidAmount < 0) { setError('Ingresá un monto válido'); return }
    if (paidAmount === 0 && totalAmount <= 0) {
      setError('Si no entrega nada, cargá el total del servicio para dejarlo en cuenta corriente')
      return
    }
    if (totalAmount > 0 && paidAmount > totalAmount) { setError('El monto entregado no puede superar el total'); return }
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
        remaining: Math.max(0, remaining),
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
                    <button type="button" onClick={() => { set('patient_id', ''); setShowNewPatient(false) }}
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
                      {filteredPatients.slice(0, 5).map(p => (
                        <div key={p.id} onClick={() => { set('patient_id', p.id); setSearch('') }}
                          className="px-3 py-2 hover:bg-surface3 cursor-pointer text-sm text-app">
                          {p.first_name} {p.last_name} · <span className="text-app2">{p.phone}</span>
                        </div>
                      ))}
                      {filteredPatients.length === 0 && <div className="px-3 py-2.5 text-app3 text-sm">Sin resultados</div>}
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

            {remaining > 0 && (
              <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2">
                <span className="text-amber-500">⚠️</span>
                <span className="text-xs text-amber-600 dark:text-amber-400 font-semibold">Queda debiendo </span>
                <span className="text-sm font-bold text-amber-500">${remaining.toLocaleString('es-AR')}</span>
              </div>
            )}
            {totalAmount > 0 && paidAmount >= totalAmount && (
              <div className="flex items-center gap-2 bg-[#E6F8F1] border border-[#00C4BC]/30 rounded-xl px-3 py-2">
                <span className="text-xs text-[#00C4BC] font-semibold">✓ Pago completo</span>
              </div>
            )}

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
