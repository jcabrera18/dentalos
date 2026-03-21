'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { apiFetch } from '@/lib/api'
import { useRouter } from 'next/navigation'

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

export default function PaymentsPage() {
  const [payments, setPayments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [token, setToken] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [patients, setPatients] = useState<any[]>([])
  const [preselectedPatientId, setPreselectedPatientId] = useState<string | null>(null)
  const [summaryWeek, setSummaryWeek] = useState<any>(null)
  const [summaryMonth, setSummaryMonth] = useState<any>(null)
  const [summaryYear, setSummaryYear] = useState<any>(null)
  const [tab, setTab] = useState<'ingresos' | 'gastos' | 'balance'>('ingresos')
  const [expenses, setExpenses] = useState<any[]>([])
  const [expenseSummaryWeek, setExpenseSummaryWeek] = useState<any>(null)
  const [expenseSummaryMonth, setExpenseSummaryMonth] = useState<any>(null)
  const [expenseSummaryYear, setExpenseSummaryYear] = useState<any>(null)
  const [showExpenseModal, setShowExpenseModal] = useState(false)
  const [showNewPatient, setShowNewPatient] = useState(false)
  const [newPatientName, setNewPatientName] = useState('')
  const [newPatientLastName, setNewPatientLastName] = useState('')
  const [creatingPatient, setCreatingPatient] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/'); return }
      setToken(session.access_token)

      await Promise.all([
        fetchPayments(session.access_token),
        fetchPatients(session.access_token),
        fetchAllSummaries(session.access_token),
        fetchExpenses(session.access_token),
        fetchExpenseSummaries(session.access_token),
      ])

      const searchParams = new URLSearchParams(window.location.search)
      const prePatientId = searchParams.get('patient_id')
      if (prePatientId) {
        setPreselectedPatientId(prePatientId)
        setShowModal(true)
      }

      setLoading(false)
    }
    load()
  }, [])

  async function fetchPayments(t: string) {
    const data = await apiFetch('/payments?limit=30', { token: t })
    setPayments(data.data ?? [])
  }

  async function fetchPatients(t: string) {
    const data = await apiFetch('/patients?limit=100', { token: t })
    setPatients(data.data ?? [])
  }

  async function fetchAllSummaries(t: string) {
    const [weekData, monthData, yearData] = await Promise.all([
      apiFetch('/payments/summary?period=week', { token: t }),
      apiFetch('/payments/summary?period=month', { token: t }),
      apiFetch('/payments/summary?period=year', { token: t }),
    ])
    setSummaryWeek(weekData.data)
    setSummaryMonth(monthData.data)
    setSummaryYear(yearData.data)
  }

  async function fetchExpenses(t: string) {
    const data = await apiFetch('/expenses?limit=30', { token: t })
    setExpenses(data.data ?? [])
  }

  async function fetchExpenseSummaries(t: string) {
    const [weekData, monthData, yearData] = await Promise.all([
      apiFetch('/expenses/summary?period=week', { token: t }),
      apiFetch('/expenses/summary?period=month', { token: t }),
      apiFetch('/expenses/summary?period=year', { token: t }),
    ])
    setExpenseSummaryWeek(weekData.data)
    setExpenseSummaryMonth(monthData.data)
    setExpenseSummaryYear(yearData.data)
  }

  async function deleteExpense(id: string) {
    await apiFetch(`/expenses/${id}`, { method: 'DELETE', token })
    await Promise.all([fetchExpenses(token), fetchExpenseSummaries(token)])
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-app flex items-center justify-center">
        <div className="text-app2">Cargando...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-app text-app">

      {/* Header con tabs */}
      <div className="px-6 py-4 border-b border-app flex items-center justify-between">
        <div className="flex items-center gap-1 bg-surface2 rounded-xl p-1">
          <button onClick={() => setTab('ingresos')}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${tab === 'ingresos' ? 'bg-surface text-app shadow-sm' : 'text-app3 hover:text-app'
              }`}>
            💰 Ingresos
          </button>
          <button onClick={() => setTab('gastos')}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${tab === 'gastos' ? 'bg-surface text-app shadow-sm' : 'text-app3 hover:text-app'
              }`}>
            📦 Gastos
          </button>
          <button onClick={() => setTab('balance')}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${tab === 'balance' ? 'bg-surface text-app shadow-sm' : 'text-app3 hover:text-app'
              }`}>
            📊 Balance
          </button>
        </div>

        <button
          onClick={() => {
            if (tab === 'ingresos') setShowModal(true)
            else if (tab === 'gastos') setShowExpenseModal(true)
          }}
          className={`font-semibold px-4 py-2 rounded-lg text-sm transition-all active:scale-95 ${tab === 'balance'
            ? 'invisible'
            : 'bg-blue-500 hover:bg-blue-600 text-white'
            }`}
        >
          + {tab === 'gastos' ? 'Registrar gasto' : 'Registrar cobro'}
        </button>
      </div>

      <main className="p-6 max-w-4xl mx-auto">
        {tab === 'ingresos' ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              {[
                { label: 'Esta semana', data: summaryWeek },
                { label: 'Este mes', data: summaryMonth },
                { label: 'Este año', data: summaryYear },
              ].map(({ label, data }) => (
                <div key={label} className="bg-surface border border-app rounded-xl p-5">
                  <div className="text-xs text-app3 uppercase tracking-wider mb-1">{label}</div>
                  <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mb-2">
                    ${Number(data?.total ?? 0).toLocaleString('es-AR')}
                  </div>
                  <div className="text-xs text-app3 mb-3">{data?.transactions ?? 0} cobros</div>
                  <div className="space-y-1.5">
                    {(data?.byMethod ?? []).map((m: any) => (
                      <div key={m.method} className="flex items-center justify-between">
                        <span className="text-xs text-app2">
                          {METODOS.find(x => x.value === m.method)?.label ?? m.method}
                        </span>
                        <span className="text-xs font-semibold text-app">
                          ${Number(m.total).toLocaleString('es-AR')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-surface border border-app rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-app">
                <h3 className="font-semibold text-app">Historial de cobros</h3>
              </div>
              {payments.length === 0 ? (
                <div className="px-6 py-12 text-center text-app3">No hay cobros registrados todavía</div>
              ) : (
                <div className="divide-y divide-app">
                  {payments.map((p: any) => (
                    <div key={p.id} className="px-6 py-4 flex items-center gap-4">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400 text-sm">
                        💰
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-app truncate">
                          {p.patients?.first_name} {p.patients?.last_name}
                        </div>
                        <div className="text-sm text-app2">
                          {METODOS.find(m => m.value === p.method)?.label ?? p.method}
                          {p.installments > 1 && ` · ${p.installments} cuotas`}
                        </div>
                        {p.notes && <div className="text-xs text-app3 mt-0.5 truncate">📝 {p.notes}</div>}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="font-bold text-emerald-600 dark:text-emerald-400">
                          ${Number(p.amount).toLocaleString('es-AR')}
                        </div>
                        <div className="text-xs text-app3">
                          {new Date(p.paid_at).toLocaleDateString('es-AR', {
                            day: 'numeric', month: 'short',
                            timeZone: 'America/Argentina/Buenos_Aires'
                          })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>

        ) : tab === 'gastos' ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              {[
                { label: 'Esta semana', data: expenseSummaryWeek },
                { label: 'Este mes', data: expenseSummaryMonth },
                { label: 'Este año', data: expenseSummaryYear },
              ].map(({ label, data }) => (
                <div key={label} className="bg-surface border border-app rounded-xl p-5">
                  <div className="text-xs text-app3 uppercase tracking-wider mb-1">{label}</div>
                  <div className="text-2xl font-bold text-red-500 dark:text-red-400 mb-2">
                    ${Number(data?.total ?? 0).toLocaleString('es-AR')}
                  </div>
                  <div className="text-xs text-app3 mb-3">{data?.transactions ?? 0} gastos</div>
                  <div className="space-y-1.5">
                    {(data?.byCategory ?? []).map((c: any) => (
                      <div key={c.category} className="flex items-center justify-between">
                        <span className="text-xs text-app2">{c.category}</span>
                        <span className="text-xs font-semibold text-app">
                          ${Number(c.total).toLocaleString('es-AR')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-surface border border-app rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-app">
                <h3 className="font-semibold text-app">Historial de gastos</h3>
              </div>
              {expenses.length === 0 ? (
                <div className="px-6 py-12 text-center text-app3">No hay gastos registrados todavía</div>
              ) : (
                <div className="divide-y divide-app">
                  {expenses.map((e: any) => (
                    <div key={e.id} className="px-6 py-4 flex items-center gap-4">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 dark:text-red-400 text-sm">
                        📦
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-app truncate">{e.category}</div>
                        {e.description && <div className="text-sm text-app2 truncate">{e.description}</div>}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="font-bold text-red-500 dark:text-red-400">
                          -${Number(e.amount).toLocaleString('es-AR')}
                        </div>
                        <div className="text-xs text-app3">
                          {new Date(e.paid_at).toLocaleDateString('es-AR', {
                            day: 'numeric', month: 'short',
                            timeZone: 'America/Argentina/Buenos_Aires'
                          })}
                        </div>
                      </div>
                      <button onClick={() => deleteExpense(e.id)}
                        className="text-app3 hover:text-red-500 active:scale-90 transition-all text-sm flex-shrink-0">
                        🗑
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>

        ) : (
          <>
            {/* ── BALANCE ── */}
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
                  <div className="text-xs text-app3 uppercase tracking-wider mb-4 font-semibold">
                    {labels[idx]}
                  </div>

                  {/* Números principales */}
                  <div className="grid grid-cols-3 gap-4 mb-5">
                    <div>
                      <div className="text-xs text-app3 mb-1">Ingresos</div>
                      <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                        ${income.toLocaleString('es-AR')}
                      </div>
                      <div className="text-xs text-app3">{incomeData?.transactions ?? 0} cobros</div>
                    </div>
                    <div>
                      <div className="text-xs text-app3 mb-1">Gastos</div>
                      <div className="text-xl font-bold text-red-500 dark:text-red-400">
                        ${expense.toLocaleString('es-AR')}
                      </div>
                      <div className="text-xs text-app3">{expenseData?.transactions ?? 0} gastos</div>
                    </div>
                    <div>
                      <div className="text-xs text-app3 mb-1">Ganancia neta</div>
                      <div className={`text-xl font-bold ${isPositive ? 'text-blue-600 dark:text-blue-400' : 'text-red-500 dark:text-red-400'
                        }`}>
                        {isPositive ? '+' : ''}{balance.toLocaleString('es-AR')}
                      </div>
                      <div className="text-xs text-app3">
                        {income > 0 ? `${Math.round((balance / income) * 100)}% margen` : '—'}
                      </div>
                    </div>
                  </div>

                  {/* Barra de progreso */}
                  {income > 0 && (
                    <div className="mb-4">
                      <div className="flex justify-between text-xs text-app3 mb-1">
                        <span>Gastos vs ingresos</span>
                        <span>{Math.round((expense / income) * 100)}%</span>
                      </div>
                      <div className="h-2 bg-surface2 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${expense / income > 0.8 ? 'bg-red-500' :
                            expense / income > 0.5 ? 'bg-amber-500' : 'bg-emerald-500'
                            }`}
                          style={{ width: `${Math.min(100, (expense / income) * 100)}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Breakdown lado a lado */}
                  {((incomeData?.byMethod?.length ?? 0) > 0 || (expenseData?.byCategory?.length ?? 0) > 0) && (
                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-app">
                      <div>
                        <div className="text-xs text-app3 uppercase tracking-wider mb-2">Por método de cobro</div>
                        <div className="space-y-1">
                          {(incomeData?.byMethod ?? []).map((m: any) => (
                            <div key={m.method} className="flex justify-between text-xs">
                              <span className="text-app2">
                                {METODOS.find(x => x.value === m.method)?.label ?? m.method}
                              </span>
                              <span className="text-app font-semibold">
                                ${Number(m.total).toLocaleString('es-AR')}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-app3 uppercase tracking-wider mb-2">Por categoría de gasto</div>
                        <div className="space-y-1">
                          {(expenseData?.byCategory ?? []).map((c: any) => (
                            <div key={c.category} className="flex justify-between text-xs">
                              <span className="text-app2">{c.category}</span>
                              <span className="text-app font-semibold">
                                ${Number(c.total).toLocaleString('es-AR')}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
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
            setShowModal(false)
            setPreselectedPatientId(null)
            await Promise.all([fetchPayments(token), fetchAllSummaries(token)])
          }}
        />
      )}

      {showExpenseModal && (
        <NewExpenseModal
          token={token}
          onClose={() => setShowExpenseModal(false)}
          onCreated={async () => {
            setShowExpenseModal(false)
            await Promise.all([fetchExpenses(token), fetchExpenseSummaries(token)])
          }}
        />
      )}
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

            {/* Paciente */}
            <div>
              <label className="block text-xs font-semibold text-app3 uppercase tracking-wider mb-2">
                Paciente
              </label>
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
                      className="flex-1 bg-surface3 text-app2 text-xs font-semibold py-2 rounded-lg transition-colors">
                      Cancelar
                    </button>
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
                      {filteredPatients.length === 0 && (
                        <div className="px-4 py-3 text-app3 text-sm">Sin resultados</div>
                      )}
                    </div>
                  )}
                  <button type="button" onClick={() => setShowNewPatient(true)}
                    className="w-full bg-surface2 hover:bg-surface3 border border-dashed border-app2 text-app2 hover:text-app text-xs font-semibold py-2.5 rounded-xl transition-colors">
                    + Crear nuevo paciente
                  </button>
                </div>
              )}
            </div>

            {/* Monto */}
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

            {/* Forma de pago */}
            <div>
              <label className="block text-xs font-semibold text-app3 uppercase tracking-wider mb-2">Forma de pago</label>
              <div className="grid grid-cols-3 gap-2">
                {METODOS.map(m => (
                  <button key={m.value} type="button" onClick={() => set('method', m.value)}
                    className={`py-2.5 px-2 rounded-xl text-xs font-semibold transition-colors ${form.method === m.value
                        ? 'bg-blue-500 text-white'
                        : 'bg-surface2 border border-app text-app2 hover:border-app2'
                      }`}>
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Cuotas */}
            {form.method === 'credit_card' && (
              <div>
                <label className="block text-xs font-semibold text-app3 uppercase tracking-wider mb-2">Cuotas</label>
                <div className="grid grid-cols-4 gap-2">
                  {['1', '3', '6', '12'].map(c => (
                    <button key={c} type="button" onClick={() => set('installments', c)}
                      className={`py-2.5 rounded-xl text-sm font-semibold transition-colors ${form.installments === c
                          ? 'bg-blue-500 text-white'
                          : 'bg-surface2 border border-app text-app2'
                        }`}>
                      {c}x
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Notas */}
            <div>
              <label className="block text-xs font-semibold text-app3 uppercase tracking-wider mb-2">Notas (opcional)</label>
              <input type="text" value={form.notes} onChange={e => set('notes', e.target.value)}
                placeholder="Referencia, observación..."
                className="w-full bg-surface2 border border-app rounded-xl px-4 py-3 text-app text-sm focus:outline-none focus:border-blue-400" />
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
    paid_at: new Date().toLocaleDateString('en-CA', {
      timeZone: 'America/Argentina/Buenos_Aires'
    }),
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
      <div className="bg-surface border border-app rounded-2xl w-full max-w-md p-6"
        onClick={e => e.stopPropagation()}>
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
                  className={`py-2 px-2 rounded-xl text-xs font-semibold transition-all active:scale-95 ${form.category === c
                    ? 'bg-blue-500 text-white'
                    : 'bg-surface2 border border-app text-app2 hover:border-app2'
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
              className="w-full bg-surface2 border border-app rounded-xl px-4 py-3 text-app text-sm focus:outline-none focus:border-blue-400" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-app3 uppercase tracking-wider mb-2">Fecha</label>
            <input type="date" value={form.paid_at} onChange={e => set('paid_at', e.target.value)}
              className="w-full bg-surface2 border border-app rounded-xl px-4 py-3 text-app text-sm focus:outline-none focus:border-blue-400" />
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
              className="flex-1 bg-red-500 hover:bg-red-600 disabled:opacity-50 active:scale-95 text-white font-semibold py-3 rounded-xl transition-all">
              {loading ? 'Guardando...' : 'Registrar gasto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}