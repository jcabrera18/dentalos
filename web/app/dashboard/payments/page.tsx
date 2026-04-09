'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { apiFetch } from '@/lib/api'
import { useRouter } from 'next/navigation'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, Cell,
} from 'recharts'

const METODOS = [
  { value: 'cash', label: '💵 Efectivo' },
  { value: 'bank_transfer', label: '📲 Transferencia' },
  { value: 'debit_card', label: '💳 Débito' },
  { value: 'credit_card', label: '💳 Crédito' },
  { value: 'insurance', label: '🏥 Obra social' },
  { value: 'other', label: '📝 Otro' },
]

const CATEGORIAS_GASTO = [
  'Materiales', 'Equipamiento', 'Alquiler', 'Servicios',
  'Personal', 'Marketing', 'Impuestos', 'Seguros', 'Otro'
]

const PAGE_SIZE = 20

function todayAR() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
}

function firstOfMonthAR() {
  const t = todayAR() // YYYY-MM-DD
  return t.slice(0, 8) + '01'
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

export default function PaymentsPage() {
  const [loading, setLoading] = useState(true)
  const [token, setToken] = useState('')
  const [tab, setTab] = useState<'ingresos' | 'gastos' | 'balance' | 'pacientes'>('ingresos')

  // ── Ingresos ──
  const [payments, setPayments] = useState<any[]>([])
  const [paymentPage, setPaymentPage] = useState(1)
  const [hasMorePayments, setHasMorePayments] = useState(false)
  const [summaryWeek, setSummaryWeek] = useState<any>(null)
  const [summaryMonth, setSummaryMonth] = useState<any>(null)
  const [summaryYear, setSummaryYear] = useState<any>(null)
  const [chartData, setChartData] = useState<{ day: string; total: number }[]>([])

  // ── Gastos ──
  const [expenses, setExpenses] = useState<any[]>([])
  const [expensePage, setExpensePage] = useState(1)
  const [hasMoreExpenses, setHasMoreExpenses] = useState(false)

  // ── Balance (movimientos combinados) ──
  const [balancePage, setBalancePage] = useState(1)
  const [expenseSummaryWeek, setExpenseSummaryWeek] = useState<any>(null)
  const [expenseSummaryMonth, setExpenseSummaryMonth] = useState<any>(null)
  const [expenseSummaryYear, setExpenseSummaryYear] = useState<any>(null)

  // ── Modals ──
  const [showModal, setShowModal] = useState(false)
  const [showExpenseModal, setShowExpenseModal] = useState(false)
  const [patients, setPatients] = useState<any[]>([])
  const [preselectedPatientId, setPreselectedPatientId] = useState<string | null>(null)

  // ── Métricas pacientes ──
  const [attendedByMonth, setAttendedByMonth] = useState<{ month: string; total: number }[]>([])
  const [topTypes, setTopTypes] = useState<{ type: string; count: number }[]>([])
  const [absenceRate, setAbsenceRate] = useState(0)
  const [absenceDetail, setAbsenceDetail] = useState({ cancelled: 0, total: 0 })
  const [loadingMetrics, setLoadingMetrics] = useState(false)

  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/'); return }
      const t = session.access_token
      setToken(t)

      await Promise.all([
        fetchPayments(t, 1),
        fetchPatients(t),
        fetchAllSummaries(t),
        fetchExpenses(t, 1),
        fetchExpenseSummaries(t),
        fetchChartData(t),
      ])

      const searchParams = new URLSearchParams(window.location.search)
      const prePatientId = searchParams.get('patient_id')
      if (prePatientId) { setPreselectedPatientId(prePatientId); setShowModal(true) }

      setLoading(false)
    }
    load()
  }, [])

  // ── Fetch helpers ──

  async function fetchPayments(t: string, page: number) {
    const offset = (page - 1) * PAGE_SIZE
    const data = await apiFetch(`/payments?limit=${PAGE_SIZE}&offset=${offset}`, { token: t })
    const list = data.data ?? []
    setPayments(list)
    setHasMorePayments(list.length === PAGE_SIZE)
    setPaymentPage(page)
  }

  async function fetchExpenses(t: string, page: number) {
    const offset = (page - 1) * PAGE_SIZE
    const data = await apiFetch(`/expenses?limit=${PAGE_SIZE}&offset=${offset}`, { token: t })
    const list = data.data ?? []
    setExpenses(list)
    setHasMoreExpenses(list.length === PAGE_SIZE)
    setExpensePage(page)
  }

  async function fetchPatients(t: string) {
    const data = await apiFetch('/patients?limit=100', { token: t })
    setPatients(data.data ?? [])
  }

  async function fetchAllSummaries(t: string) {
    const [w, m, y] = await Promise.all([
      apiFetch('/payments/summary?period=week', { token: t }),
      apiFetch('/payments/summary?period=month', { token: t }),
      apiFetch('/payments/summary?period=year', { token: t }),
    ])
    setSummaryWeek(w.data); setSummaryMonth(m.data); setSummaryYear(y.data)
  }

  async function fetchExpenseSummaries(t: string) {
    const [w, m, y] = await Promise.all([
      apiFetch('/expenses/summary?period=week', { token: t }),
      apiFetch('/expenses/summary?period=month', { token: t }),
      apiFetch('/expenses/summary?period=year', { token: t }),
    ])
    setExpenseSummaryWeek(w.data); setExpenseSummaryMonth(m.data); setExpenseSummaryYear(y.data)
  }

  async function fetchChartData(t: string) {
    const from = firstOfMonthAR()
    const to = todayAR()
    // Traer todos los cobros del mes con limit alto
    const data = await apiFetch(`/payments?from=${from}&to=${to}&limit=500`, { token: t })
    const list: any[] = data.data ?? []

    // Agrupar por día (UTC-3)
    const byDay: Record<string, number> = {}
    list.forEach((p) => {
      const day = new Date(p.paid_at).toLocaleDateString('en-CA', {
        timeZone: 'America/Argentina/Buenos_Aires',
      })
      byDay[day] = (byDay[day] ?? 0) + Number(p.amount)
    })

    // Generar todos los días del mes hasta hoy
    const result: { day: string; total: number }[] = []
    const start = new Date(`${from}T12:00:00-03:00`)
    const end = new Date(`${to}T12:00:00-03:00`)
    const cur = new Date(start)
    while (cur <= end) {
      const key = cur.toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
      const label = cur.toLocaleDateString('es-AR', {
        day: 'numeric', month: 'short',
        timeZone: 'America/Argentina/Buenos_Aires',
      })
      result.push({ day: label, total: byDay[key] ?? 0 })
      cur.setDate(cur.getDate() + 1)
    }
    setChartData(result)
  }

  async function fetchPatientMetrics(t: string) {
    setLoadingMetrics(true)
    try {
      const sixMonthsAgo = new Date()
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
      const from = sixMonthsAgo.toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
      const to = todayAR()

      const data = await apiFetch(`/appointments?from=${from}&to=${to}`, { token: t })
      const appts: any[] = data.data ?? []

      // Pacientes atendidos por mes (no cancelados)
      const monthMap: Record<string, number> = {}
      appts.forEach((a) => {
        if (a.status === 'cancelled') return
        const label = new Date(a.starts_at).toLocaleDateString('es-AR', {
          month: 'short', year: '2-digit',
          timeZone: 'America/Argentina/Buenos_Aires',
        })
        monthMap[label] = (monthMap[label] ?? 0) + 1
      })
      // Ordenar cronológicamente (últimos 6 meses)
      const monthEntries = Object.entries(monthMap).map(([month, total]) => ({ month, total }))
      setAttendedByMonth(monthEntries)

      // Tipos más frecuentes
      const typeMap: Record<string, number> = {}
      appts.forEach((a) => {
        if (a.status === 'cancelled') return
        const type = a.appointment_type ?? 'Sin tipo'
        typeMap[type] = (typeMap[type] ?? 0) + 1
      })
      const sorted = Object.entries(typeMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([type, count]) => ({ type, count }))
      setTopTypes(sorted)

      // Tasa de ausentismo del mes actual
      const firstOM = firstOfMonthAR()
      const thisMonth = appts.filter((a) => {
        const d = new Date(a.starts_at).toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
        return d >= firstOM && d <= to
      })
      const cancelled = thisMonth.filter((a) => a.status === 'cancelled').length
      const total = thisMonth.length
      setAbsenceRate(total > 0 ? Math.round((cancelled / total) * 100) : 0)
      setAbsenceDetail({ cancelled, total })
    } finally {
      setLoadingMetrics(false)
    }
  }

  async function deleteExpense(id: string) {
    await apiFetch(`/expenses/${id}`, { method: 'DELETE', token })
    await Promise.all([fetchExpenses(token, expensePage), fetchExpenseSummaries(token)])
  }

  function handleTabChange(t: typeof tab) {
    setTab(t)
    if (t === 'balance') setBalancePage(1)
    if (t === 'pacientes' && attendedByMonth.length === 0 && !loadingMetrics) {
      fetchPatientMetrics(token)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-app">
        {/* Tabs bar skeleton */}
        <div className="px-4 py-3 border-b border-app flex items-center gap-2 animate-pulse">
          <div className="flex gap-1 flex-1">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-9 bg-surface2 rounded-lg w-24" />
            ))}
          </div>
          <div className="h-9 bg-surface2 rounded-lg w-20" />
        </div>
        <main className="p-6 max-w-4xl mx-auto animate-pulse">
          {/* Summary cards skeleton */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-surface border border-app rounded-xl p-5 space-y-3">
                <div className="h-3 bg-surface2 rounded w-20" />
                <div className="h-7 bg-surface2 rounded w-28" />
                <div className="h-3 bg-surface2 rounded w-16" />
                <div className="space-y-2 pt-1">
                  <div className="h-3 bg-surface2 rounded w-full" />
                  <div className="h-3 bg-surface2 rounded w-4/5" />
                </div>
              </div>
            ))}
          </div>
          {/* Chart skeleton */}
          <div className="bg-surface border border-app rounded-xl p-5 mb-6">
            <div className="h-4 bg-surface2 rounded w-32 mb-4" />
            <div className="h-40 bg-surface2 rounded-lg" />
          </div>
          {/* List rows skeleton */}
          <div className="space-y-2">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-surface border border-app rounded-xl p-4 flex items-center gap-4">
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-surface2 rounded w-48" />
                  <div className="h-3 bg-surface2 rounded w-32" />
                </div>
                <div className="h-5 bg-surface2 rounded w-20" />
              </div>
            ))}
          </div>
        </main>
      </div>
    )
  }

  const totalChart = chartData.reduce((s, d) => s + d.total, 0)

  return (
    <div className="min-h-screen bg-app text-app">

      {/* Header con tabs */}
      <div className="px-4 py-3 border-b border-app flex items-center justify-between gap-2">
        <div className="flex items-center gap-0.5 bg-surface2 rounded-xl p-1 flex-1 overflow-x-auto">
          {([
            { key: 'ingresos', label: '💰 Ingresos' },
            { key: 'gastos', label: '📦 Gastos' },
            { key: 'balance', label: '📊 Balance' },
            { key: 'pacientes', label: '👥 Pacientes' },
          ] as const).map(({ key, label }) => (
            <button key={key} onClick={() => handleTabChange(key)}
              className={`px-3 py-2 text-sm font-semibold rounded-lg transition-all whitespace-nowrap ${tab === key ? 'bg-surface text-app shadow-sm' : 'text-app3 hover:text-app'}`}>
              {label}
            </button>
          ))}
        </div>

        <button
          onClick={() => { if (tab === 'ingresos') setShowModal(true); else if (tab === 'gastos') setShowExpenseModal(true) }}
          className={`font-semibold px-4 py-2 rounded-lg text-sm transition-all active:scale-95 flex-shrink-0 ${(tab === 'balance' || tab === 'pacientes') ? 'invisible' : 'bg-blue-500 hover:bg-blue-600 text-white'}`}
        >
          + {tab === 'gastos' ? 'Gasto' : 'Cobro'}
        </button>
      </div>

      <main className="p-6 max-w-4xl mx-auto">

        {/* ── INGRESOS ── */}
        {tab === 'ingresos' && (
          <>
            {/* Cards resumen */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              {[
                { label: 'Esta semana', data: summaryWeek },
                { label: 'Este mes', data: summaryMonth },
                { label: 'Este año', data: summaryYear },
              ].map(({ label, data }) => (
                <div key={label} className="bg-surface border border-app rounded-xl p-5">
                  <div className="text-xs text-app3 uppercase tracking-wider mb-1">{label}</div>
                  <div className="text-2xl font-bold text-emerald-500 dark:text-emerald-400 mb-1">
                    {formatARS(Number(data?.total ?? 0))}
                  </div>
                  <div className="text-xs text-app3 mb-3">{data?.transactions ?? 0} cobros</div>
                  <div className="space-y-1">
                    {(data?.byMethod ?? []).map((m: any) => (
                      <div key={m.method} className="flex items-center justify-between">
                        <span className="text-xs text-app2">{METODOS.find(x => x.value === m.method)?.label ?? m.method}</span>
                        <span className="text-xs font-semibold">{formatARS(Number(m.total))}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Gráfico curva del mes */}
            <div className="bg-surface border border-app rounded-xl p-5 mb-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-app">Ingresos del mes</h3>
                  <div className="text-xs text-app3 mt-0.5">
                    {new Date().toLocaleDateString('es-AR', { month: 'long', year: 'numeric', timeZone: 'America/Argentina/Buenos_Aires' })}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold text-emerald-500 dark:text-emerald-400">{formatARS(totalChart)}</div>
                  <div className="text-xs text-app3">{chartData.filter(d => d.total > 0).length} días con cobros</div>
                </div>
              </div>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis
                      dataKey="day"
                      tick={{ fontSize: 10, fill: 'var(--text3)' }}
                      tickLine={false}
                      axisLine={false}
                      interval={Math.floor(chartData.length / 6)}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: 'var(--text3)' }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
                      width={36}
                    />
                    <Tooltip
                      contentStyle={{
                        background: 'var(--surface)',
                        border: '1px solid var(--border)',
                        borderRadius: '10px',
                        fontSize: '12px',
                        color: 'var(--text)',
                      }}
                      formatter={(val: any) => [formatARS(Number(val)), 'Ingresos']}
                      cursor={{ stroke: 'var(--border)' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="total"
                      stroke="#10b981"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4, fill: '#10b981' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[180px] flex items-center justify-center text-app3 text-sm">Sin cobros este mes</div>
              )}
            </div>

            {/* Historial paginado */}
            <div className="bg-surface border border-app rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-app flex items-center justify-between">
                <h3 className="font-semibold">Historial de cobros</h3>
                <span className="text-xs text-app3">Página {paymentPage}</span>
              </div>
              {payments.length === 0 ? (
                <div className="px-6 py-12 text-center text-app3">No hay cobros registrados</div>
              ) : (
                <>
                  <div className="divide-y divide-app">
                    {payments.map((p: any) => (
                      <div key={p.id} className="px-6 py-4 flex items-center gap-4">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">💰</div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold truncate">
                            {p.patients ? `${p.patients.first_name} ${p.patients.last_name}` : <span className="text-app3 italic">Sin paciente</span>}
                          </div>
                          <div className="text-sm text-app2">
                            {METODOS.find(m => m.value === p.method)?.label ?? p.method}
                            {p.installments > 1 && ` · ${p.installments} cuotas`}
                          </div>
                          {p.notes && <div className="text-xs text-app3 mt-0.5 truncate">📝 {p.notes}</div>}
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="font-bold text-emerald-500 dark:text-emerald-400">{formatARS(Number(p.amount))}</div>
                          <div className="text-xs text-app3">{formatDateAR(p.paid_at)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <Pagination
                    page={paymentPage}
                    hasMore={hasMorePayments}
                    onPrev={() => fetchPayments(token, paymentPage - 1)}
                    onNext={() => fetchPayments(token, paymentPage + 1)}
                  />
                </>
              )}
            </div>
          </>
        )}

        {/* ── GASTOS ── */}
        {tab === 'gastos' && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              {[
                { label: 'Esta semana', data: expenseSummaryWeek },
                { label: 'Este mes', data: expenseSummaryMonth },
                { label: 'Este año', data: expenseSummaryYear },
              ].map(({ label, data }) => (
                <div key={label} className="bg-surface border border-app rounded-xl p-5">
                  <div className="text-xs text-app3 uppercase tracking-wider mb-1">{label}</div>
                  <div className="text-2xl font-bold text-red-500 dark:text-red-400 mb-1">
                    {formatARS(Number(data?.total ?? 0))}
                  </div>
                  <div className="text-xs text-app3 mb-3">{data?.transactions ?? 0} gastos</div>
                  <div className="space-y-1">
                    {(data?.byCategory ?? []).map((c: any) => (
                      <div key={c.category} className="flex items-center justify-between">
                        <span className="text-xs text-app2">{c.category}</span>
                        <span className="text-xs font-semibold">{formatARS(Number(c.total))}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-surface border border-app rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-app flex items-center justify-between">
                <h3 className="font-semibold">Historial de gastos</h3>
                <span className="text-xs text-app3">Página {expensePage}</span>
              </div>
              {expenses.length === 0 ? (
                <div className="px-6 py-12 text-center text-app3">No hay gastos registrados</div>
              ) : (
                <>
                  <div className="divide-y divide-app">
                    {expenses.map((e: any) => (
                      <div key={e.id} className="px-6 py-4 flex items-center gap-4">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center text-red-500">📦</div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold truncate">{e.category}</div>
                          {e.description && <div className="text-sm text-app2 truncate">{e.description}</div>}
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="font-bold text-red-500 dark:text-red-400">-{formatARS(Number(e.amount))}</div>
                          <div className="text-xs text-app3">{formatDateAR(e.paid_at)}</div>
                        </div>
                        <button onClick={() => deleteExpense(e.id)}
                          className="text-app3 hover:text-red-500 active:scale-90 transition-all flex-shrink-0">
                          🗑
                        </button>
                      </div>
                    ))}
                  </div>
                  <Pagination
                    page={expensePage}
                    hasMore={hasMoreExpenses}
                    onPrev={() => fetchExpenses(token, expensePage - 1)}
                    onNext={() => fetchExpenses(token, expensePage + 1)}
                  />
                </>
              )}
            </div>
          </>
        )}

        {/* ── BALANCE ── */}
        {tab === 'balance' && (() => {
          const BPAGE = 15
          const combined = [
            ...payments.map(p => ({ ...p, _type: 'ingreso' as const, date: p.paid_at })),
            ...expenses.map(e => ({ ...e, _type: 'gasto' as const, date: e.paid_at })),
          ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
          const totalPages = Math.ceil(combined.length / BPAGE) || 1
          const pageItems = combined.slice((balancePage - 1) * BPAGE, balancePage * BPAGE)
          return (
          <>
            {(['week', 'month', 'year'] as const).map((period, idx) => {
              const labels = ['Esta semana', 'Este mes', 'Este año']
              const incomeData = [summaryWeek, summaryMonth, summaryYear][idx]
              const expenseData = [expenseSummaryWeek, expenseSummaryMonth, expenseSummaryYear][idx]
              const income = Number(incomeData?.total ?? 0)
              const expense = Number(expenseData?.total ?? 0)
              const balance = income - expense
              const isPositive = balance >= 0

              return (
                <div key={period} className="bg-surface border border-app rounded-xl p-5 mb-4">
                  <div className="text-xs text-app3 uppercase tracking-wider mb-4 font-semibold">{labels[idx]}</div>
                  <div className="grid grid-cols-3 gap-4 mb-5">
                    <div>
                      <div className="text-xs text-app3 mb-1">Ingresos</div>
                      <div className="text-xl font-bold text-emerald-500 dark:text-emerald-400">{formatARS(income)}</div>
                      <div className="text-xs text-app3">{incomeData?.transactions ?? 0} cobros</div>
                    </div>
                    <div>
                      <div className="text-xs text-app3 mb-1">Gastos</div>
                      <div className="text-xl font-bold text-red-500 dark:text-red-400">{formatARS(expense)}</div>
                      <div className="text-xs text-app3">{expenseData?.transactions ?? 0} gastos</div>
                    </div>
                    <div>
                      <div className="text-xs text-app3 mb-1">Ganancia neta</div>
                      <div className={`text-xl font-bold ${isPositive ? 'text-blue-500 dark:text-blue-400' : 'text-red-500 dark:text-red-400'}`}>
                        {isPositive ? '+' : ''}{balance.toLocaleString('es-AR')}
                      </div>
                      <div className="text-xs text-app3">
                        {income > 0 ? `${Math.round((balance / income) * 100)}% margen` : '—'}
                      </div>
                    </div>
                  </div>

                  {income > 0 && (
                    <div className="mb-4">
                      <div className="flex justify-between text-xs text-app3 mb-1">
                        <span>Gastos vs ingresos</span>
                        <span>{Math.round((expense / income) * 100)}%</span>
                      </div>
                      <div className="h-2 bg-surface2 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${expense / income > 0.8 ? 'bg-red-500' : expense / income > 0.5 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                          style={{ width: `${Math.min(100, (expense / income) * 100)}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {((incomeData?.byMethod?.length ?? 0) > 0 || (expenseData?.byCategory?.length ?? 0) > 0) && (
                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-app">
                      <div>
                        <div className="text-xs text-app3 uppercase tracking-wider mb-2">Por método de cobro</div>
                        <div className="space-y-1">
                          {(incomeData?.byMethod ?? []).map((m: any) => (
                            <div key={m.method} className="flex justify-between text-xs">
                              <span className="text-app2">{METODOS.find(x => x.value === m.method)?.label ?? m.method}</span>
                              <span className="font-semibold">{formatARS(Number(m.total))}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-app3 uppercase tracking-wider mb-2">Por categoría</div>
                        <div className="space-y-1">
                          {(expenseData?.byCategory ?? []).map((c: any) => (
                            <div key={c.category} className="flex justify-between text-xs">
                              <span className="text-app2">{c.category}</span>
                              <span className="font-semibold">{formatARS(Number(c.total))}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}

            {/* Tabla combinada de movimientos */}
            {combined.length > 0 && (
              <div className="bg-surface border border-app rounded-xl overflow-hidden mt-4">
                <div className="px-6 py-4 border-b border-app flex items-center justify-between">
                  <h3 className="font-semibold">Últimos movimientos</h3>
                  <span className="text-xs text-app3">{combined.length} registros · Pág. {balancePage}/{totalPages}</span>
                </div>
                <div className="divide-y divide-app">
                  {pageItems.map((item: any) => (
                    <div key={`${item._type}-${item.id}`} className="px-6 py-3 flex items-center gap-4">
                      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm ${item._type === 'ingreso' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                        {item._type === 'ingreso' ? '💰' : '📦'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">
                          {item._type === 'ingreso'
                            ? (item.patients ? `${item.patients.first_name} ${item.patients.last_name}` : 'Sin paciente')
                            : item.category}
                        </div>
                        <div className="text-xs text-app3">
                          {item._type === 'ingreso'
                            ? (METODOS.find((m: any) => m.value === item.method)?.label ?? item.method)
                            : item.description || ''}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className={`font-bold text-sm ${item._type === 'ingreso' ? 'text-emerald-500 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                          {item._type === 'ingreso' ? '+' : '-'}{formatARS(Number(item.amount))}
                        </div>
                        <div className="text-xs text-app3">{formatDateAR(item.date)}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <Pagination
                  page={balancePage}
                  hasMore={balancePage < totalPages}
                  onPrev={() => setBalancePage(p => Math.max(1, p - 1))}
                  onNext={() => setBalancePage(p => p + 1)}
                />
              </div>
            )}
          </>
          )
        })()}

        {/* ── PACIENTES ── */}
        {tab === 'pacientes' && (
          <>
            {loadingMetrics ? (
              <div className="py-20 text-center text-app3">Cargando métricas...</div>
            ) : (
              <div className="space-y-6">

                {/* Tasa de ausentismo — métrica destacada */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-surface border border-app rounded-xl p-5">
                    <div className="text-xs text-app3 uppercase tracking-wider mb-1">Turnos este mes</div>
                    <div className="text-3xl font-bold text-app">{absenceDetail.total}</div>
                    <div className="text-xs text-app3 mt-1">agendados en total</div>
                  </div>
                  <div className="bg-surface border border-app rounded-xl p-5">
                    <div className="text-xs text-app3 uppercase tracking-wider mb-1">Asistieron</div>
                    <div className="text-3xl font-bold text-emerald-500 dark:text-emerald-400">
                      {absenceDetail.total - absenceDetail.cancelled}
                    </div>
                    <div className="text-xs text-app3 mt-1">
                      {absenceDetail.total > 0 ? `${100 - absenceRate}% del total` : '—'}
                    </div>
                  </div>
                  <div className={`bg-surface border rounded-xl p-5 ${absenceRate > 20 ? 'border-red-500/40' : 'border-app'}`}>
                    <div className="text-xs text-app3 uppercase tracking-wider mb-1">Tasa de ausentismo</div>
                    <div className={`text-3xl font-bold ${absenceRate > 20 ? 'text-red-500' : absenceRate > 10 ? 'text-amber-500' : 'text-emerald-500'}`}>
                      {absenceRate}%
                    </div>
                    <div className="text-xs text-app3 mt-1">{absenceDetail.cancelled} cancelados este mes</div>
                  </div>
                </div>

                {/* Pacientes atendidos por mes */}
                <div className="bg-surface border border-app rounded-xl p-5">
                  <h3 className="font-semibold mb-1">Pacientes atendidos por mes</h3>
                  <div className="text-xs text-app3 mb-4">Últimos 6 meses · excluye cancelados</div>
                  {attendedByMonth.length > 0 ? (
                    <ResponsiveContainer width="100%" height={200}>
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
                            <Cell key={i} fill={i === attendedByMonth.length - 1 ? '#3b82f6' : '#6366f1'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[200px] flex items-center justify-center text-app3 text-sm">Sin datos de turnos</div>
                  )}
                </div>

                {/* Tratamientos más frecuentes */}
                <div className="bg-surface border border-app rounded-xl p-5">
                  <h3 className="font-semibold mb-1">Tipos de consulta más frecuentes</h3>
                  <div className="text-xs text-app3 mb-4">Últimos 6 meses · excluye cancelados</div>
                  {topTypes.length > 0 ? (
                    <div className="space-y-3">
                      {topTypes.map((t, i) => {
                        const max = topTypes[0].count
                        const pct = Math.round((t.count / max) * 100)
                        return (
                          <div key={t.type}>
                            <div className="flex justify-between text-sm mb-1">
                              <span className="text-app font-medium">{t.type}</span>
                              <span className="text-app2 font-semibold">{t.count}</span>
                            </div>
                            <div className="h-2 bg-surface2 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${pct}%`,
                                  background: i === 0 ? '#3b82f6' : i === 1 ? '#6366f1' : i === 2 ? '#8b5cf6' : '#a78bfa',
                                }}
                              />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="py-8 text-center text-app3 text-sm">Sin datos de turnos</div>
                  )}
                </div>

              </div>
            )}
          </>
        )}

      </main>

      {showModal && (
        <NewPaymentModal
          token={token}
          patients={patients}
          preselectedPatientId={preselectedPatientId}
          onClose={() => { setShowModal(false); setPreselectedPatientId(null) }}
          onCreated={async () => {
            setShowModal(false); setPreselectedPatientId(null)
            await Promise.all([fetchPayments(token, 1), fetchAllSummaries(token), fetchChartData(token)])
          }}
        />
      )}

      {showExpenseModal && (
        <NewExpenseModal
          token={token}
          onClose={() => setShowExpenseModal(false)}
          onCreated={async () => {
            setShowExpenseModal(false)
            await Promise.all([fetchExpenses(token, 1), fetchExpenseSummaries(token)])
          }}
        />
      )}
    </div>
  )
}

function Pagination({ page, hasMore, onPrev, onNext }: {
  page: number; hasMore: boolean; onPrev: () => void; onNext: () => void
}) {
  if (page === 1 && !hasMore) return null
  return (
    <div className="px-6 py-4 border-t border-app flex items-center justify-between">
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

function NewPaymentModal({ token, patients: initialPatients, preselectedPatientId, onClose, onCreated }: {
  token: string
  patients: any[]
  preselectedPatientId?: string | null
  onClose: () => void
  onCreated: () => void
}) {
  const [form, setForm] = useState({
    patient_id: preselectedPatientId ?? '',
    amount: '',
    method: 'cash',
    installments: '1',
    notes: '',
  })
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

  const filteredPatients = patients.filter(p =>
    `${p.first_name} ${p.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
    p.phone.includes(search)
  )

  const selectedPatient = patients.find(p => p.id === form.patient_id)

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.amount || Number(form.amount) <= 0) { setError('Ingresá un monto válido'); return }
    setLoading(true)
    setError('')
    try {
      await apiFetch('/payments', {
        method: 'POST',
        token,
        body: JSON.stringify({
          patient_id: form.patient_id || undefined,
          amount: Number(form.amount),
          method: form.method,
          installments: Number(form.installments),
          notes: form.notes || undefined,
        })
      })
      onCreated()
    } catch (err: any) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-surface border border-app rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="w-9 h-1 bg-surface3 rounded-full mx-auto mb-6 sm:hidden" />
          <h2 className="text-lg font-bold text-app mb-5">Registrar cobro</h2>
          <form onSubmit={handleSubmit} className="space-y-4">

            <div>
              <label className="block text-xs font-semibold text-app3 uppercase tracking-wider mb-2">Paciente</label>
              {selectedPatient ? (
                <div className="flex items-center justify-between bg-surface2 rounded-xl px-4 py-3">
                  <div className="font-medium text-app">{selectedPatient.first_name} {selectedPatient.last_name}</div>
                  <button type="button" onClick={() => { set('patient_id', ''); setShowNewPatient(false) }}
                    className="text-app3 hover:text-app text-sm">✕</button>
                </div>
              ) : showNewPatient ? (
                <div className="bg-surface2 rounded-xl p-3 border border-blue-500/30">
                  <div className="text-xs text-blue-600 dark:text-blue-400 font-semibold mb-2">Nuevo paciente rápido</div>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <input type="text" value={newPatientName} onChange={e => setNewPatientName(e.target.value)}
                      placeholder="Nombre"
                      className="bg-surface3 border border-app rounded-lg px-3 py-2 text-app text-sm focus:outline-none focus:border-blue-400" />
                    <input type="text" value={newPatientLastName} onChange={e => setNewPatientLastName(e.target.value)}
                      placeholder="Apellido"
                      className="bg-surface3 border border-app rounded-lg px-3 py-2 text-app text-sm focus:outline-none focus:border-blue-400" />
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setShowNewPatient(false)}
                      className="flex-1 bg-surface3 text-app2 text-xs font-semibold py-2 rounded-lg transition-colors">Cancelar</button>
                    <button type="button" onClick={handleCreatePatient}
                      disabled={!newPatientName || creatingPatient}
                      className="flex-1 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white text-xs font-semibold py-2 rounded-lg transition-colors">
                      {creatingPatient ? 'Creando...' : 'Crear y usar'}
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar paciente..."
                    className="w-full bg-surface2 border border-app rounded-xl px-4 py-3 text-app text-sm focus:outline-none focus:border-blue-400 mb-2" />
                  {search && (
                    <div className="bg-surface2 border border-app rounded-xl overflow-hidden max-h-40 overflow-y-auto mb-2">
                      {filteredPatients.slice(0, 5).map(p => (
                        <div key={p.id} onClick={() => { set('patient_id', p.id); setSearch('') }}
                          className="px-4 py-2.5 hover:bg-surface3 cursor-pointer text-sm text-app">
                          {p.first_name} {p.last_name} · <span className="text-app2">{p.phone}</span>
                        </div>
                      ))}
                      {filteredPatients.length === 0 && <div className="px-4 py-3 text-app3 text-sm">Sin resultados</div>}
                    </div>
                  )}
                  <button type="button" onClick={() => setShowNewPatient(true)}
                    className="w-full bg-surface2 hover:bg-surface3 border border-dashed border-app2 text-app2 hover:text-app text-xs font-semibold py-2.5 rounded-xl transition-colors">
                    + Crear nuevo paciente
                  </button>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-app3 uppercase tracking-wider mb-2">Monto</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-app3 font-bold">$</span>
                <input type="number" value={form.amount} onChange={e => set('amount', e.target.value)}
                  placeholder="0"
                  className="w-full bg-surface2 border border-app rounded-xl pl-8 pr-4 py-3 text-app text-xl font-bold focus:outline-none focus:border-blue-400"
                  min="1" required />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-app3 uppercase tracking-wider mb-2">Forma de pago</label>
              <div className="grid grid-cols-3 gap-2">
                {METODOS.map(m => (
                  <button key={m.value} type="button" onClick={() => set('method', m.value)}
                    className={`py-2.5 px-2 rounded-xl text-xs font-semibold transition-colors ${form.method === m.value ? 'bg-blue-500 text-white' : 'bg-surface2 border border-app text-app2 hover:border-app2'}`}>
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {form.method === 'credit_card' && (
              <div>
                <label className="block text-xs font-semibold text-app3 uppercase tracking-wider mb-2">Cuotas</label>
                <div className="grid grid-cols-4 gap-2">
                  {['1', '3', '6', '12'].map(c => (
                    <button key={c} type="button" onClick={() => set('installments', c)}
                      className={`py-2.5 rounded-xl text-sm font-semibold transition-colors ${form.installments === c ? 'bg-blue-500 text-white' : 'bg-surface2 border border-app text-app2'}`}>
                      {c}x
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-app3 uppercase tracking-wider mb-2">Notas (opcional)</label>
              <input type="text" value={form.notes} onChange={e => set('notes', e.target.value)}
                placeholder="Referencia, observación..."
                className="w-full bg-surface2 border border-app rounded-xl px-4 py-3 text-app text-sm focus:outline-none focus:border-blue-400" />
            </div>

            {error && <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-600 dark:text-red-400 text-sm">{error}</div>}

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose}
                className="flex-1 bg-surface2 hover:bg-surface3 border border-app text-app font-semibold py-3 rounded-xl transition-colors">
                Cancelar
              </button>
              <button type="submit" disabled={loading}
                className="flex-1 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors">
                {loading ? 'Guardando...' : 'Registrar cobro'}
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
        method: 'POST',
        token,
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
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4"
      onClick={onClose}>
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
                className="w-full bg-surface2 border border-app rounded-xl pl-8 pr-4 py-3 text-app text-xl font-bold focus:outline-none focus:border-blue-400"
                min="1" required />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-app3 uppercase tracking-wider mb-2">Categoría</label>
            <div className="grid grid-cols-3 gap-2">
              {CATEGORIAS_GASTO.map(c => (
                <button key={c} type="button" onClick={() => set('category', c)}
                  className={`py-2 px-2 rounded-xl text-xs font-semibold transition-all active:scale-95 ${form.category === c ? 'bg-blue-500 text-white' : 'bg-surface2 border border-app text-app2 hover:border-app2'}`}>
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-app3 uppercase tracking-wider mb-2">Descripción (opcional)</label>
            <input type="text" value={form.description} onChange={e => set('description', e.target.value)}
              placeholder="Detalle del gasto..."
              className="w-full bg-surface2 border border-app rounded-xl px-4 py-3 text-app text-sm focus:outline-none focus:border-blue-400" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-app3 uppercase tracking-wider mb-2">Fecha</label>
            <input type="date" value={form.paid_at} onChange={e => set('paid_at', e.target.value)}
              className="w-full bg-surface2 border border-app rounded-xl px-4 py-3 text-app text-sm focus:outline-none focus:border-blue-400" />
          </div>

          {error && <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-600 dark:text-red-400 text-sm">{error}</div>}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 bg-surface2 hover:bg-surface3 border border-app text-app font-semibold py-3 rounded-xl transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 bg-red-500 hover:bg-red-600 disabled:opacity-50 active:scale-95 text-white font-semibold py-3 rounded-all transition-all">
              {loading ? 'Guardando...' : 'Registrar gasto'}
            </button>
          </div>
        </form>
        </div>
      </div>
    </div>
  )
}
