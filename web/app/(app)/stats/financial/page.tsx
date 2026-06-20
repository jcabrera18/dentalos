'use client'

import { useEffect, useRef, useState } from 'react'
import { Eye, EyeOff, MoreVertical } from 'lucide-react'
import { createClient, getToken as getSupabaseToken } from '@/lib/supabase'
import { apiFetch } from '@/lib/api'
import { fetchProfile } from '@/lib/profileCache'
import { useRouter } from 'next/navigation'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell,
} from 'recharts'
import { PaymentModal, METODOS } from '@/components/PaymentModal'
import { InvoiceModal } from '@/components/InvoiceModal'
import { downloadReceiptPNG } from '@/components/generateReceipt'

// Module-level cache for afip-config — rarely changes during a session
let afipConfigCache: { data: any; fetchedAt: number } | null = null
const AFIP_CACHE_TTL_MS = 5 * 60 * 1000

const EXPENSE_CATEGORIES = [
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
const PAGE_SIZE = 5

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

function daysSince(dateStr: string): number {
  const today = new Date(new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }))
  const d = new Date(dateStr)
  return Math.floor((today.getTime() - d.getTime()) / 86400000)
}

export default function FinancialStatsPage() {
  const [loading, setLoading] = useState(true)
  const [analyticsLoading, setAnalyticsLoading] = useState(false)
  const [movementsLoading, setMovementsLoading] = useState(false)
  const [patientsLoading, setPatientsLoading] = useState(false)
  const [token, setToken] = useState('')

  const [period, setPeriod] = useState<Period>('month')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  const [kpis, setKpis] = useState<any>(null)
  const [analytics, setAnalytics] = useState<any>(null)
  const [movements, setMovements] = useState<any[]>([])
  const [movementsTotal, setMovementsTotal] = useState(0)

  const [movementsFilter, setMovementsFilter] = useState<'all' | 'payment' | 'expense'>('all')
  const [movementsPage, setMovementsPage] = useState(1)

  const [showPendingModal, setShowPendingModal] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [showExpenseModal, setShowExpenseModal] = useState(false)
  const [editingPayment, setEditingPayment] = useState<any>(null)
  const [paymentToDelete, setPaymentToDelete] = useState<any>(null)
  const [deletingPayment, setDeletingPayment] = useState(false)
  const [deletePaymentError, setDeletePaymentError] = useState('')
  const [patients, setPatients] = useState<any[]>([])
  const [professionals, setProfessionals] = useState<any[]>([])
  const [preselectedPatientId, setPreselectedPatientId] = useState<string | null>(null)

  const [masked, setMasked] = useState(false)
  function maskedAmt(n: number) { return masked ? '••••••' : formatARS(n) }

  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [menuPos, setMenuPos] = useState<{ top: number; right: number }>({ top: 0, right: 0 })

  const [clinicName, setClinicName] = useState('')
  const [myProfessionalName, setMyProfessionalName] = useState('')

  const [myAfipIvaCondition, setMyAfipIvaCondition] = useState<string>('MO')
  const [myAfipConfigured, setMyAfipConfigured] = useState(false)
  const [invoicesMap, setInvoicesMap] = useState<Record<string, any>>({})
  const [invoiceModalPayment, setInvoiceModalPayment] = useState<any>(null)
  const [downloadingPdfId, setDownloadingPdfId] = useState<string | null>(null)

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
      setToken(t)

      // Critical path: only what's needed to render the page
      await Promise.all([
        fetchKpis(t),
        fetchAnalytics('month', t),
        fetchMovements('month', t, '', '', 'all', 1),
      ])

      setLoading(false)

      // Background: secondary data that doesn't block render
      Promise.all([
        fetchMyProfile(t),
        fetchAfipConfig(t),
        fetchProfessionals(t),
      ])

      // Handle ?patient_id= deeplink — needs patients loaded first
      const searchParams = new URLSearchParams(window.location.search)
      const prePatientId = searchParams.get('patient_id')
      if (prePatientId) {
        setPreselectedPatientId(prePatientId)
        await fetchPatients(t)
        setShowPaymentModal(true)
      }
    }
    load()
  }, [])

  async function fetchKpis(t: string) {
    const data = await apiFetch('/finance/kpis', { token: t })
    setKpis(data.data ?? null)
  }

  async function fetchAnalytics(p: Period, t: string, cFrom = '', cTo = '') {
    setAnalyticsLoading(true)
    try {
      const { from, to } = periodToDateRange(p, cFrom, cTo)
      const prevRange = getPrevPeriodRange(p)
      let url = `/finance/analytics?from=${from}&to=${to}`
      if (prevRange) url += `&prev_from=${prevRange.from}&prev_to=${prevRange.to}`
      const data = await apiFetch(url, { token: t })
      setAnalytics(data.data ?? null)
    } finally {
      setAnalyticsLoading(false)
    }
  }

  async function fetchMovements(p: Period, t: string, cFrom = '', cTo = '', type: 'all' | 'payment' | 'expense' = 'all', page = 1) {
    setMovementsLoading(true)
    try {
      const { from, to } = periodToDateRange(p, cFrom, cTo)
      const offset = (page - 1) * PAGE_SIZE
      const data = await apiFetch(`/finance/movements?from=${from}&to=${to}&type=${type}&limit=${PAGE_SIZE}&offset=${offset}`, { token: t })
      const rows: any[] = data.data ?? []
      setMovements(rows)
      setMovementsTotal(data.meta?.total ?? 0)

      // Lazy-load invoices for visible payment rows only
      const paymentIds = rows.filter(r => r.type === 'payment').map(r => r.id)
      if (paymentIds.length > 0) {
        fetchInvoicesForIds(paymentIds, t)
      } else {
        setInvoicesMap({})
      }
    } finally {
      setMovementsLoading(false)
    }
  }

  async function fetchInvoicesForIds(paymentIds: string[], t: string) {
    try {
      const data = await apiFetch(`/invoices?payment_ids=${paymentIds.join(',')}`, { token: t })
      const map: Record<string, any> = {}
      for (const inv of (data.data ?? [])) {
        if (inv.payment_id) map[inv.payment_id] = inv
      }
      setInvoicesMap(map)
    } catch {}
  }

  async function fetchPatients(t: string) {
    setPatientsLoading(true)
    try {
      const data = await apiFetch('/patients?limit=100', { token: t })
      setPatients(data.data ?? [])
    } finally {
      setPatientsLoading(false)
    }
  }

  async function fetchProfessionals(t: string) {
    const data = await apiFetch('/professionals', { token: t })
    setProfessionals(data.data ?? [])
  }

  async function fetchMyProfile(t: string) {
    try {
      const d = await fetchProfile(t)
      setMyProfessionalName(`${d.first_name ?? ''} ${d.last_name ?? ''}`.trim())
      setClinicName(d.clinics?.name ?? '')
    } catch {}
  }

  async function fetchAfipConfig(t: string) {
    try {
      if (afipConfigCache && Date.now() - afipConfigCache.fetchedAt < AFIP_CACHE_TTL_MS) {
        const d = afipConfigCache.data
        if (d?.iva_condition) setMyAfipIvaCondition(d.iva_condition)
        setMyAfipConfigured(!!(d?.cuit && d?.has_cert && d?.has_key && d?.afip_punto_venta))
        return
      }
      const data = await apiFetch('/professionals/me/afip-config', { token: t })
      const d = data.data
      afipConfigCache = { data: d, fetchedAt: Date.now() }
      if (d?.iva_condition) setMyAfipIvaCondition(d.iva_condition)
      setMyAfipConfigured(!!(d?.cuit && d?.has_cert && d?.has_key && d?.afip_punto_venta))
    } catch {}
  }

  async function downloadInvoicePdf(invoiceId: string, invoiceType: string, numero: number) {
    setDownloadingPdfId(invoiceId)
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? ''
      const res = await fetch(`${apiUrl}/invoices/${invoiceId}/pdf`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('No se pudo generar el PDF')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `factura-${invoiceType}-${String(numero).padStart(8, '0')}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err: any) {
      alert(err.message ?? 'Error al descargar PDF')
    } finally {
      setDownloadingPdfId(null)
    }
  }

  async function ensurePatientsLoaded(): Promise<void> {
    if (patients.length > 0) return
    const t = await getToken()
    if (!t) return
    await fetchPatients(t)
  }

  async function refreshAll() {
    const t = await getToken()
    if (!t) return
    await Promise.all([
      fetchKpis(t),
      fetchAnalytics(period, t, customFrom, customTo),
      fetchMovements(period, t, customFrom, customTo, movementsFilter, 1),
    ])
    setMovementsPage(1)
  }

  async function handleChangePeriod(p: Period) {
    setPeriod(p)
    setMovementsPage(1)
    if (p !== 'custom') {
      const t = await getToken()
      if (!t) return
      await Promise.all([
        fetchAnalytics(p, t),
        fetchMovements(p, t, '', '', movementsFilter, 1),
      ])
    }
  }

  async function handleApplyCustomPeriod() {
    if (!customFrom || !customTo) return
    setMovementsPage(1)
    const t = await getToken()
    if (!t) return
    await Promise.all([
      fetchAnalytics('custom', t, customFrom, customTo),
      fetchMovements('custom', t, customFrom, customTo, movementsFilter, 1),
    ])
  }

  async function handleMovementsFilterChange(f: 'all' | 'payment' | 'expense') {
    setMovementsFilter(f)
    setMovementsPage(1)
    const t = await getToken()
    if (!t) return
    await fetchMovements(period, t, customFrom, customTo, f, 1)
  }

  async function handleMovementsPageChange(page: number) {
    setMovementsPage(page)
    const t = await getToken()
    if (!t) return
    await fetchMovements(period, t, customFrom, customTo, movementsFilter, page)
  }

  async function confirmDeletePayment() {
    if (!paymentToDelete) return
    const t = await getToken()
    if (!t) return
    setDeletingPayment(true)
    setDeletePaymentError('')
    try {
      await apiFetch(`/payments/${paymentToDelete.id}`, { method: 'DELETE', token: t })
      await refreshAll()
      setPaymentToDelete(null)
    } catch (err) {
      setDeletePaymentError(err instanceof Error ? err.message : 'No se pudo eliminar el cobro')
    } finally {
      setDeletingPayment(false)
    }
  }

  async function deleteExpense(id: string) {
    const t = await getToken()
    if (!t) return
    await apiFetch(`/expenses/${id}`, { method: 'DELETE', token: t })
    await refreshAll()
  }

  // ── Derived: persistent KPIs ──
  const allIncome = Number(kpis?.all_time_income ?? 0)
  const allExpense = Number(kpis?.all_time_expenses ?? 0)
  const availableBalance = allIncome - allExpense
  const monthIncome = Number(kpis?.month_income ?? 0)
  const monthExpenses = Number(kpis?.month_expenses ?? 0)
  const pendingTotal = Number(kpis?.pending_total ?? 0)
  const debtors: any[] = kpis?.debtors ?? []

  // ── Derived: period analytics ──
  const income = Number(analytics?.income ?? 0)
  const expenses = Number(analytics?.expenses ?? 0)
  const incomeCount = Number(analytics?.income_count ?? 0)
  const avgTicket = incomeCount > 0 ? Math.round(income / incomeCount) : 0
  const prevIncome = Number(analytics?.prev_income ?? 0)
  const prevExpenses = Number(analytics?.prev_expenses ?? 0)
  const prevIncomeCount = Number(analytics?.prev_income_count ?? 0)
  const prevAvgTicket = prevIncomeCount > 0 ? Math.round(prevIncome / prevIncomeCount) : 0

  const byMethod: { method: string; total: number }[] = analytics?.by_method ?? []
  const byCategory: { category: string; total: number }[] = analytics?.by_category ?? []
  const byProfessional: { name: string; total: number }[] = analytics?.by_professional ?? []

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
  const deltaExpenses = delta(expenses, prevExpenses)
  const deltaAvgTicket = delta(avgTicket, prevAvgTicket)
  const prevLabel = PREV_LABEL[period]

  const totalPages = Math.ceil(movementsTotal / PAGE_SIZE) || 1

  if (loading) {
    return (
      <div className="min-h-screen bg-app">
        <div className="sticky top-0 z-10 bg-app border-b border-app px-6 py-3 animate-pulse">
          <div className="h-5 bg-surface2 rounded w-32" />
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

      {/* ── Header ── */}
      <div className="sticky top-0 z-10 bg-app border-b border-app">
        <div className="px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-1 h-6 bg-[#00C4BC] rounded-full flex-shrink-0" />
            <h1 className="text-xl font-extrabold text-app tracking-tight">Financieras</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMasked(m => !m)}
              title={masked ? 'Mostrar cifras' : 'Ocultar cifras'}
              className="flex items-center justify-center w-9 h-9 rounded-lg bg-surface2 hover:bg-surface3 border border-app text-app3 hover:text-app transition-all active:scale-95"
            >
              {masked ? <Eye size={16} /> : <EyeOff size={16} />}
            </button>
            <button
              onClick={async () => {
                setEditingPayment(null)
                setPreselectedPatientId(null)
                await ensurePatientsLoaded()
                setShowPaymentModal(true)
              }}
              disabled={patientsLoading}
              className="flex items-center gap-1.5 bg-[#00C4BC] hover:bg-[#00aaa3] disabled:opacity-70 text-white text-sm font-semibold px-3 py-2 rounded-lg transition-all active:scale-95"
            >
              {patientsLoading ? '...' : '+ Cobro'}
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

      <main className="p-6 max-w-4xl mx-auto space-y-8">

        {/* ── Section 1: Persistent KPIs ── */}
        <section className="space-y-4">
          <SectionHeading accent="#00C4BC">Resumen financiero actual</SectionHeading>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-surface border border-app rounded-xl p-5">
              <div className="text-xs text-app3 uppercase tracking-wider mb-1">Caja disponible</div>
              <div className={`text-2xl font-bold ${availableBalance >= 0 ? 'text-[#00C4BC] dark:text-emerald-400' : 'text-red-500'}`}>
                {maskedAmt(availableBalance)}
              </div>
              <div className="text-xs text-app3 mt-1">total cobrado − egresos</div>
            </div>

            <div
              className={`bg-surface border rounded-xl p-5 transition-all ${pendingTotal > 0 ? 'border-amber-500/40 cursor-pointer hover:border-amber-500/70 hover:bg-amber-500/5 active:scale-[0.98]' : 'border-app'}`}
              onClick={() => pendingTotal > 0 && setShowPendingModal(true)}
            >
              <div className="text-xs text-app3 uppercase tracking-wider mb-1">Pendiente por cobrar</div>
              <div className={`text-2xl font-bold ${pendingTotal > 0 ? 'text-amber-400' : 'text-[#00C4BC]'}`}>
                {pendingTotal > 0 ? maskedAmt(pendingTotal) : '—'}
              </div>
              <div className="text-xs text-app3 mt-1">
                {pendingTotal > 0 ? `${debtors.length} pacientes · ver →` : 'Todos al día'}
              </div>
            </div>

            <div className="bg-surface border border-app rounded-xl p-5">
              <div className="text-xs text-app3 uppercase tracking-wider mb-1">Cobrado este mes</div>
              <div className="text-2xl font-bold text-[#00C4BC] dark:text-emerald-400">{maskedAmt(monthIncome)}</div>
              <div className="text-xs text-app3 mt-1">{Number(kpis?.month_income_count ?? 0)} cobros</div>
            </div>

            <div className="bg-surface border border-app rounded-xl p-5">
              <div className="text-xs text-app3 uppercase tracking-wider mb-1">Egresos este mes</div>
              <div className={`text-2xl font-bold ${monthExpenses > 0 ? 'text-red-500 dark:text-red-400' : 'text-app3'}`}>
                {monthExpenses > 0 ? maskedAmt(monthExpenses) : '—'}
              </div>
              <div className="text-xs text-app3 mt-1">{Number(kpis?.month_expense_count ?? 0)} registros</div>
            </div>
          </div>

          {monthIncome > 0 && !masked && (
            <div className="bg-surface border border-app rounded-xl px-5 py-4">
              <div className="flex justify-between text-xs text-app3 mb-2">
                <span>Egresos vs cobrado este mes</span>
                <span>{Math.round((monthExpenses / monthIncome) * 100)}%</span>
              </div>
              <div className="h-2 bg-surface2 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${monthExpenses / monthIncome > 0.8 ? 'bg-red-500' : monthExpenses / monthIncome > 0.5 ? 'bg-amber-500' : 'bg-[#00C4BC]'}`}
                  style={{ width: `${Math.min(100, (monthExpenses / monthIncome) * 100)}%` }}
                />
              </div>
            </div>
          )}
        </section>

        {/* ── Section 2: Period analytics ── */}
        <section className="space-y-4">
          <SectionHeading accent="#6366f1">Análisis del consultorio</SectionHeading>

          {/* Period selector */}
          <div className="bg-surface border border-app rounded-xl p-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-app3 whitespace-nowrap">Período:</span>
              <select
                value={period}
                onChange={e => handleChangePeriod(e.target.value as Period)}
                className="flex-1 bg-surface2 border border-app rounded-lg px-3 py-1.5 text-sm font-semibold text-app focus:outline-none focus:border-[#00C4BC] cursor-pointer"
              >
                {PERIOD_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            {period === 'custom' && (
              <div className="flex items-center gap-2 flex-wrap mt-3 pt-3 border-t border-app">
                <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                  className="bg-surface2 border border-app rounded-lg px-3 py-1.5 text-sm text-app focus:outline-none focus:border-[#00C4BC]" />
                <span className="text-app3 text-sm">→</span>
                <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                  className="bg-surface2 border border-app rounded-lg px-3 py-1.5 text-sm text-app focus:outline-none focus:border-[#00C4BC]" />
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

          {/* Smart insights */}
          {!analyticsLoading && !masked && (() => {
            const insights: { icon: string; text: string; type: 'good' | 'bad' | 'neutral' }[] = []

            if (deltaIncome && prevLabel && deltaIncome.pct >= 5) {
              insights.push({ icon: deltaIncome.up ? '📈' : '📉', text: `Ingresos ${deltaIncome.up ? '+' : '-'}${deltaIncome.pct}% ${prevLabel}`, type: deltaIncome.up ? 'good' : 'bad' })
            }
            if (deltaAvgTicket && prevLabel && deltaAvgTicket.pct >= 5) {
              insights.push({ icon: deltaAvgTicket.up ? '💰' : '💸', text: `Ticket promedio ${deltaAvgTicket.up ? '+' : '-'}${deltaAvgTicket.pct}% ${prevLabel}`, type: deltaAvgTicket.up ? 'good' : 'bad' })
            }
            const oldDebtors = debtors.filter((d: any) => daysSince(d.last_payment_at) > 30)
            if (oldDebtors.length > 0) {
              insights.push({ icon: '⏳', text: `${oldDebtors.length} paciente${oldDebtors.length > 1 ? 's' : ''} deben hace +30 días`, type: 'bad' })
            } else if (debtors.length > 0) {
              insights.push({ icon: '⏳', text: `${debtors.length} paciente${debtors.length > 1 ? 's' : ''} con saldo pendiente`, type: 'neutral' })
            }
            if (byMethod.length > 0 && income > 0) {
              const top = byMethod[0]
              const pct = Math.round((top.total / income) * 100)
              if (pct >= 40) {
                const methodLabel = METODOS.find(x => x.value === top.method)?.label ?? top.method
                insights.push({ icon: '💳', text: `${methodLabel} representa ${pct}% de cobros`, type: 'neutral' })
              }
            }
            if (incomeCount >= 5) {
              const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
              const byWeekday: Record<number, number> = {}
              ;(analytics?.by_day ?? []).forEach(({ day, total }: { day: string; total: number }) => {
                const dow = new Date(String(day) + 'T12:00:00').getDay()
                byWeekday[dow] = (byWeekday[dow] ?? 0) + Number(total)
              })
              const topDay = Object.entries(byWeekday).sort((a, b) => Number(b[1]) - Number(a[1]))[0]
              if (topDay) insights.push({ icon: '📅', text: `${DAYS[Number(topDay[0])]} es tu día más rentable`, type: 'neutral' })
            }
            if (income > 0 && expenses > 0 && expenses / income > 0.8) {
              insights.push({ icon: '⚠️', text: `Egresos al ${Math.round((expenses / income) * 100)}% de ingresos`, type: 'bad' })
            }

            if (insights.length === 0) return null
            return (
              <div className="bg-surface border-2 border-[var(--border)] rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-base">✦</span>
                  <span className="text-sm font-bold text-app uppercase tracking-widest">Diagnóstico del período</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {insights.map((ins, i) => (
                    <div key={i} className={`flex items-start gap-3 rounded-xl px-4 py-3 border ${ins.type === 'good' ? 'bg-emerald-500/10 border-emerald-500/30' : ins.type === 'bad' ? 'bg-red-500/10 border-red-500/30' : 'bg-surface2 border-app'}`}>
                      <span className="text-xl leading-none mt-0.5">{ins.icon}</span>
                      <span className={`text-sm font-semibold leading-snug ${ins.type === 'good' ? 'text-emerald-600 dark:text-emerald-400' : ins.type === 'bad' ? 'text-red-600 dark:text-red-400' : 'text-app2'}`}>{ins.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}

          {/* Period KPIs + chart + breakdown */}
          <div className={`transition-opacity duration-150 ${analyticsLoading ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-surface border border-app rounded-xl p-5">
                <div className="text-xs text-app3 uppercase tracking-wider mb-1">Ingresos del período</div>
                <div className="text-2xl font-bold text-[#00C4BC] dark:text-emerald-400">{maskedAmt(income)}</div>
                {!masked && <DeltaBadge d={deltaIncome} label={prevLabel} positiveIsGood />}
                <div className="text-xs text-app3 mt-1">{incomeCount} cobros</div>
              </div>
              <div className="bg-surface border border-app rounded-xl p-5">
                <div className="text-xs text-app3 uppercase tracking-wider mb-1">Egresos del período</div>
                <div className="text-2xl font-bold text-red-500 dark:text-red-400">{maskedAmt(expenses)}</div>
                {!masked && <DeltaBadge d={deltaExpenses} label={prevLabel} positiveIsGood={false} />}
                <div className="text-xs text-app3 mt-1">{Number(analytics?.expense_count ?? 0)} registros</div>
              </div>
              <div className="bg-surface border border-app rounded-xl p-5">
                <div className="text-xs text-app3 uppercase tracking-wider mb-1">Ticket promedio</div>
                <div className="text-2xl font-bold text-[#00C4BC]">{avgTicket > 0 ? maskedAmt(avgTicket) : '—'}</div>
                {!masked && <DeltaBadge d={deltaAvgTicket} label={prevLabel} positiveIsGood />}
                <div className="text-xs text-app3 mt-1">por cobro</div>
              </div>
            </div>

            {chartData.some(d => d.total > 0) && (
              <div className="bg-surface border border-app rounded-xl p-5 my-4">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-app">Evolución</h3>
                    <div className="text-xs text-app3 mt-0.5">{periodChartLabel(period, customFrom, customTo)}</div>
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

            {(income > 0 || expenses > 0) && (
              <div>
                <SectionChip>Desglose del período</SectionChip>
                <div className={`grid gap-4 ${byProfessional.length > 1 ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
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
                    ) : <div className="text-xs text-app3">Sin ingresos</div>}
                  </div>
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
                    ) : <div className="text-xs text-app3">Sin gastos</div>}
                  </div>
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
                              formatter={(val: any, _: any, entry: any) => [`${formatARS(Number(val))} (${income > 0 ? Math.round((Number(val) / income) * 100) : 0}%)`, entry.name]}
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

        {/* ── Section 3: Movements ── */}
        <section>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4 mb-3">
            <SectionChip>Actividad financiera</SectionChip>
            <div className="flex items-center gap-1 bg-surface2 rounded-lg p-1 self-start sm:self-auto">
              {([
                { key: 'all', label: 'Todos' },
                { key: 'payment', label: 'Cobros' },
                { key: 'expense', label: 'Egresos' },
              ] as const).map(f => (
                <button
                  key={f.key}
                  onClick={() => handleMovementsFilterChange(f.key)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${movementsFilter === f.key ? 'bg-[#E6F8F1] text-[#00C4BC]' : 'text-app3 hover:text-app'}`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className={`bg-surface border border-app rounded-xl overflow-hidden transition-opacity duration-150 ${movementsLoading ? 'opacity-40 pointer-events-none' : ''}`}>
            <div className="px-5 py-3 border-b border-app flex items-center justify-between">
              <span className="text-sm font-semibold">{movementsTotal} movimientos</span>
              {totalPages > 1 && <span className="text-xs text-app3">Pág. {movementsPage}/{totalPages}</span>}
            </div>

            {!movementsLoading && movements.length === 0 ? (
              <div className="px-5 py-12 text-center text-app3 text-sm">Sin movimientos en este período</div>
            ) : (
              <>
                <div className="divide-y divide-app">
                  {movements.map((item: any) => (
                    <div key={`${item.type}-${item.id}`} className="px-5 py-3.5 flex items-center gap-4">
                      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm ${item.type === 'payment' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                        {item.type === 'payment' ? '💰' : '📦'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">
                          {item.type === 'payment'
                            ? (item.patient_name
                              ? <span onClick={() => router.push(`/patients/${item.patient_id}`)} className="cursor-pointer hover:text-[#00C4BC] transition-colors">{item.patient_name}</span>
                              : 'Sin paciente')
                            : item.category}
                        </div>
                        <div className="text-xs text-app3 truncate">
                          {item.type === 'payment' ? (METODOS.find(m => m.value === item.method)?.label ?? item.method) : (item.description || '')}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className={`font-bold text-sm ${item.type === 'payment' ? 'text-emerald-500 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                          {masked ? '••••••' : `${item.type === 'payment' ? '+' : '-'}${formatARS(Number(item.amount))}`}
                        </div>
                        {item.type === 'payment' && !masked && (() => {
                          const balance = Number(item.patient_balance_due ?? 0)
                          if (balance > 0) return <div className="text-xs text-amber-500 font-semibold">Debe {formatARS(balance)}</div>
                          if (balance < 0) return <div className="text-xs text-[#00C4BC] font-semibold">A favor {formatARS(Math.abs(balance))}</div>
                          return null
                        })()}
                        <div className="text-xs text-app3">{formatDateAR(item.date)}</div>
                      </div>
                      {item.type === 'payment' ? (
                        <div className="relative flex-shrink-0">
                          <button
                            onClick={(e) => {
                              if (openMenuId === item.id) { setOpenMenuId(null); return }
                              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                              const menuHeight = 260
                              const openUp = window.innerHeight - rect.bottom < menuHeight
                              setMenuPos({
                                top: openUp ? rect.top - menuHeight - 4 : rect.bottom + 4,
                                right: window.innerWidth - rect.right,
                              })
                              setOpenMenuId(item.id)
                            }}
                            className="p-1.5 rounded-lg text-app3 hover:text-app hover:bg-surface2 transition-all cursor-pointer"
                          >
                            <MoreVertical size={16} />
                          </button>
                          {openMenuId === item.id && (
                            <>
                              <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} />
                              <div className="fixed z-20 bg-surface border border-app rounded-xl shadow-lg py-1 min-w-[130px]" style={{ top: menuPos.top, right: menuPos.right }}>
                                <button onClick={async () => { setOpenMenuId(null); setEditingPayment(item); setPreselectedPatientId(null); await ensurePatientsLoaded(); setShowPaymentModal(true) }} className="w-full text-left px-4 py-2 text-sm text-app hover:bg-surface2 transition-colors cursor-pointer">
                                  Editar
                                </button>
                                {invoicesMap[item.id] ? (
                                  <button
                                    onClick={() => { setOpenMenuId(null); const inv = invoicesMap[item.id]; downloadInvoicePdf(inv.id, inv.invoice_type, inv.afip_numero ?? inv.numero) }}
                                    disabled={downloadingPdfId === invoicesMap[item.id]?.id}
                                    className="w-full text-left px-4 py-2 text-sm text-emerald-500 hover:bg-surface2 transition-colors disabled:opacity-50 cursor-pointer"
                                  >
                                    {downloadingPdfId === invoicesMap[item.id]?.id ? 'Generando...' : 'Descargar factura'}
                                  </button>
                                ) : myAfipConfigured ? (
                                  <button onClick={() => { setOpenMenuId(null); setInvoiceModalPayment({ ...item, patient_name: item.patient_name ?? '' }) }} className="w-full text-left px-4 py-2 text-sm text-amber-500 hover:bg-surface2 transition-colors cursor-pointer">
                                    Facturar
                                  </button>
                                ) : (
                                  <div className="px-4 py-2">
                                    <p className="text-sm text-app3 opacity-50 cursor-not-allowed">Facturar</p>
                                    <p className="text-xs text-app3 mt-0.5">Configurá tus datos AFIP en <span className="text-[#00C4BC]">Configuración</span></p>
                                  </div>
                                )}
                                <button
                                  onClick={() => {
                                    setOpenMenuId(null)
                                    const profObj = professionals.find((p: any) => p.id === item.professional_id)
                                    const profName = profObj ? `${profObj.first_name} ${profObj.last_name}` : (myProfessionalName || null)
                                    downloadReceiptPNG({
                                      patientName: item.patient_name ?? 'Paciente',
                                      date: item.date,
                                      concept: item.concept ?? null,
                                      method: item.method,
                                      amount: Number(item.amount),
                                      totalAmount: item.total_amount ? Number(item.total_amount) : null,
                                      notes: item.notes ?? null,
                                      installments: item.installments ?? null,
                                      professionalName: profName,
                                      clinicName: clinicName || null,
                                      balance: item.patient_balance_due != null ? Number(item.patient_balance_due) : null,
                                    })
                                  }}
                                  className="w-full text-left px-4 py-2 text-sm text-app hover:bg-surface2 transition-colors cursor-pointer"
                                >
                                  Descargar recibo
                                </button>
                                <div className="my-1 border-t border-app" />
                                <button onClick={() => { setOpenMenuId(null); setPaymentToDelete(item) }} className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-surface2 transition-colors cursor-pointer">
                                  Eliminar
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      ) : (
                        <button onClick={() => deleteExpense(item.id)} className="text-app3 hover:text-red-500 active:scale-90 transition-all flex-shrink-0 text-base">
                          🗑
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <Pagination
                  page={movementsPage}
                  hasMore={movementsPage < totalPages}
                  onPrev={() => handleMovementsPageChange(Math.max(1, movementsPage - 1))}
                  onNext={() => handleMovementsPageChange(movementsPage + 1)}
                />
              </>
            )}
          </div>
        </section>

      </main>

      {/* ── Modals ── */}
      {invoiceModalPayment && (
        <InvoiceModal
          payment={invoiceModalPayment}
          profesionalIvaCondition={myAfipIvaCondition}
          token={token}
          onClose={() => setInvoiceModalPayment(null)}
          onSuccess={(inv) => setInvoicesMap(prev => ({ ...prev, [inv.payment_id]: inv }))}
        />
      )}

      {showPaymentModal && (
        <PaymentModal
          token={token}
          patients={patients}
          professionals={professionals}
          payment={editingPayment}
          preselectedPatientId={preselectedPatientId}
          clinicName={clinicName || undefined}
          myProfessionalName={myProfessionalName || undefined}
          profesionalIvaCondition={myAfipIvaCondition}
          hasAfipConfig={myAfipConfigured}
          onClose={() => { setShowPaymentModal(false); setPreselectedPatientId(null); setEditingPayment(null) }}
          onSaved={async () => {
            setShowPaymentModal(false); setPreselectedPatientId(null); setEditingPayment(null)
            await refreshAll()
          }}
        />
      )}

      {paymentToDelete && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4" onClick={() => setPaymentToDelete(null)}>
          <div className="bg-surface border border-app rounded-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-app">
              <h2 className="text-lg font-semibold">Confirmar eliminación</h2>
              <p className="text-sm text-app3 mt-1">¿Eliminar este cobro de forma definitiva?</p>
            </div>
            <div className="px-6 py-4 space-y-2">
              {deletePaymentError && <div className="px-3 py-2 rounded-lg bg-red-600/10 text-xs text-red-500">{deletePaymentError}</div>}
              <div className="flex gap-2">
                <button onClick={() => setPaymentToDelete(null)} className="flex-1 bg-surface2 hover:bg-surface3 border border-app rounded-xl text-sm font-semibold py-3 transition-all active:scale-95">
                  Cancelar
                </button>
                <button onClick={confirmDeletePayment} disabled={deletingPayment} className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-semibold py-3 transition-all active:scale-95 disabled:opacity-50">
                  {deletingPayment ? 'Eliminando...' : 'Eliminar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showExpenseModal && (
        <ExpenseModal
          token={token}
          onClose={() => setShowExpenseModal(false)}
          onCreated={async () => { setShowExpenseModal(false); await refreshAll() }}
        />
      )}

      {showPendingModal && (
        <PendingDebtorsModal
          debtors={debtors}
          masked={masked}
          onClose={() => setShowPendingModal(false)}
          onRegisterPayment={async (patientId) => {
            setShowPendingModal(false)
            setPreselectedPatientId(patientId)
            setEditingPayment(null)
            await ensurePatientsLoaded()
            setShowPaymentModal(true)
          }}
        />
      )}
    </div>
  )
}

// ── UI helpers ──

function SectionHeading({ children, accent }: { children: React.ReactNode; accent: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-1 h-5 rounded-full flex-shrink-0" style={{ background: accent }} />
      <h2 className="text-sm font-bold text-app uppercase tracking-widest">{children}</h2>
      <div className="h-px flex-1 bg-[var(--border)]" />
    </div>
  )
}

function SectionChip({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <span className="text-xs font-bold text-[#00C4BC] uppercase tracking-widest bg-[#E6F8F1] px-2.5 py-1 rounded-full">
        {children}
      </span>
    </div>
  )
}

function DeltaBadge({ d, label, positiveIsGood }: { d: { pct: number; up: boolean } | null; label: string | null; positiveIsGood: boolean }) {
  if (!d || !label) return null
  const isGood = positiveIsGood ? d.up : !d.up
  return (
    <div className={`inline-flex items-center gap-1 text-xs font-semibold mt-1.5 px-1.5 py-0.5 rounded-md ${isGood ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-red-500/10 text-red-500'}`}>
      <span>{d.up ? '↑' : '↓'}</span>
      <span>{d.pct}%</span>
      <span className="font-normal opacity-70">{label}</span>
    </div>
  )
}

function Pagination({ page, hasMore, onPrev, onNext }: { page: number; hasMore: boolean; onPrev: () => void; onNext: () => void }) {
  if (page === 1 && !hasMore) return null
  return (
    <div className="px-5 py-4 border-t border-app flex items-center justify-between">
      <button onClick={onPrev} disabled={page === 1} className="px-4 py-2 text-sm font-semibold bg-surface2 border border-app rounded-lg disabled:opacity-40 hover:bg-surface3 transition-colors active:scale-95">
        ← Anterior
      </button>
      <span className="text-sm text-app3">Página {page}</span>
      <button onClick={onNext} disabled={!hasMore} className="px-4 py-2 text-sm font-semibold bg-surface2 border border-app rounded-lg disabled:opacity-40 hover:bg-surface3 transition-colors active:scale-95">
        Siguiente →
      </button>
    </div>
  )
}

const DEBTORS_PAGE_SIZE = 5
type AgingBand = 'all' | '0-30' | '30-60' | '60+'

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

  const totalPages = Math.ceil(filtered.length / DEBTORS_PAGE_SIZE) || 1
  const pageItems = filtered.slice((page - 1) * DEBTORS_PAGE_SIZE, page * DEBTORS_PAGE_SIZE)

  const BANDS: { value: AgingBand; label: string }[] = [
    { value: 'all', label: 'Todos' },
    { value: '0-30', label: '0–30 días' },
    { value: '30-60', label: '30–60 días' },
    { value: '60+', label: '+60 días' },
  ]

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface border border-app rounded-2xl w-full max-w-lg flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
        <div className="px-6 pt-5 pb-4 border-b border-app flex-shrink-0">
          <div className="w-9 h-1 bg-surface3 rounded-full mx-auto mb-4 sm:hidden" />
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-base font-bold text-app">Pacientes con saldo pendiente</h2>
              <p className="text-xs text-app3 mt-0.5">
                {debtors.length} {debtors.length === 1 ? 'paciente debe' : 'pacientes deben'} ·{' '}
                <span className="text-amber-400 font-semibold">{masked ? '••••••' : '$' + total.toLocaleString('es-AR')}</span>
              </p>
            </div>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-app3 hover:text-app hover:bg-surface2 transition-all">✕</button>
          </div>

          {top5.length > 0 && (
            <div className="mb-3 bg-surface2 rounded-xl p-3">
              <div className="text-xs font-semibold text-app3 uppercase tracking-wider mb-2">Top 5 deudores</div>
              <div className="space-y-1.5">
                {top5.map((d, i) => (
                  <div key={d.id} className="flex items-center gap-2">
                    <span className="text-xs font-bold text-app3 w-4 text-right">{i + 1}.</span>
                    <span className="text-xs text-app flex-1 truncate">{d.name}</span>
                    <span className="text-xs font-bold text-amber-400">{masked ? '••••••' : '$' + d.balance.toLocaleString('es-AR')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-1.5 mb-3">
            {BANDS.map(b => (
              <button key={b.value} onClick={() => { setAgingBand(b.value); setSearch(''); setPage(1) }}
                className={`text-xs px-2.5 py-1 rounded-lg font-semibold transition-all ${agingBand === b.value ? 'bg-amber-500 text-white' : 'bg-surface2 text-app3 hover:text-app hover:bg-surface3'}`}>
                {b.label}
              </button>
            ))}
          </div>

          <input type="text" value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Buscar paciente..."
            className="w-full bg-surface2 border border-app rounded-xl px-3 py-2 text-app text-sm focus:outline-none focus:border-[#00C4BC]" />
        </div>

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
                      {new Date(d.last_payment_at).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/Argentina/Buenos_Aires' })}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 mr-2">
                    <div className="text-sm font-bold text-amber-400">{masked ? '••••••' : '$' + d.balance.toLocaleString('es-AR')}</div>
                    <div className="text-xs text-app3">{daysSince(d.last_payment_at)}d atrás</div>
                  </div>
                  <div className="flex flex-col gap-1.5 flex-shrink-0">
                    <button onClick={() => onRegisterPayment(d.id)} className="text-xs font-semibold bg-[#00C4BC] hover:bg-[#00aaa3] text-white px-2.5 py-1.5 rounded-lg transition-all active:scale-95 whitespace-nowrap">
                      Cobrar
                    </button>
                    <button disabled title="Recordar por WhatsApp (próximamente)" className="text-xs font-semibold bg-surface2 border border-app text-app3 px-2.5 py-1.5 rounded-lg opacity-50 cursor-not-allowed whitespace-nowrap flex items-center gap-1 justify-center">
                      <span>💬</span> WSP
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {totalPages > 1 && (
          <div className="px-5 py-3 border-t border-app flex items-center justify-between flex-shrink-0">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1.5 text-xs font-semibold bg-surface2 border border-app rounded-lg disabled:opacity-40 hover:bg-surface3 transition-colors active:scale-95">← Anterior</button>
            <span className="text-xs text-app3">{page} / {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-3 py-1.5 text-xs font-semibold bg-surface2 border border-app rounded-lg disabled:opacity-40 hover:bg-surface3 transition-colors active:scale-95">Siguiente →</button>
          </div>
        )}
      </div>
    </div>
  )
}

function ExpenseModal({ token, onClose, onCreated }: { token: string; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    amount: '',
    category: '',
    description: '',
    paid_at: new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }),
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function setField(field: string, value: string) { setForm(f => ({ ...f, [field]: value })) }

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
                <input type="number" value={form.amount} onChange={e => setField('amount', e.target.value)}
                  placeholder="0"
                  className="w-full bg-surface2 border border-app rounded-xl pl-8 pr-4 py-3 text-app text-xl font-bold focus:outline-none focus:border-[#00C4BC]"
                  min="1" required />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-app3 uppercase tracking-wider mb-2">Categoría</label>
              <div className="grid grid-cols-3 gap-2">
                {EXPENSE_CATEGORIES.map(c => (
                  <button key={c} type="button" onClick={() => setField('category', c)}
                    className={`py-2 px-2 rounded-xl text-xs font-semibold transition-all active:scale-95 ${form.category === c ? 'bg-[#00C4BC] text-white' : 'bg-surface2 border border-app text-app2 hover:border-app2'}`}>
                    {c}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-app3 uppercase tracking-wider mb-2">Descripción (opcional)</label>
              <input type="text" value={form.description} onChange={e => setField('description', e.target.value)}
                placeholder="Detalle del gasto..."
                className="w-full bg-surface2 border border-app rounded-xl px-4 py-3 text-app text-sm focus:outline-none focus:border-[#00C4BC]" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-app3 uppercase tracking-wider mb-2">Fecha</label>
              <input type="date" value={form.paid_at} onChange={e => setField('paid_at', e.target.value)}
                className="w-full bg-surface2 border border-app rounded-xl px-4 py-3 text-app text-sm focus:outline-none focus:border-[#00C4BC]" />
            </div>
            {error && <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-600 dark:text-red-400 text-sm">{error}</div>}
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose} className="flex-1 bg-surface2 hover:bg-surface3 border border-app text-app font-semibold py-3 rounded-xl transition-colors">
                Cancelar
              </button>
              <button type="submit" disabled={loading} className="flex-1 bg-red-500 hover:bg-red-600 disabled:opacity-50 active:scale-95 text-white font-semibold py-3 rounded-xl transition-all">
                {loading ? 'Guardando...' : 'Registrar gasto'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
