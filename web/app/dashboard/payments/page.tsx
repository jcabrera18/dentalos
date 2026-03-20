'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { apiFetch } from '@/lib/api'
import { useRouter } from 'next/navigation'

const METODOS = [
  { value: 'cash',          label: '💵 Efectivo' },
  { value: 'bank_transfer', label: '📲 Transferencia' },
  { value: 'debit_card',    label: '💳 Débito' },
  { value: 'credit_card',   label: '💳 Crédito' },
  { value: 'insurance',     label: '🏥 Obra social' },
  { value: 'other',         label: '📝 Otro' },
]

export default function PaymentsPage() {
  const [payments, setPayments]     = useState<any[]>([])
  const [summary, setSummary]       = useState<any>(null)
  const [loading, setLoading]       = useState(true)
  const [token, setToken]           = useState('')
  const [showModal, setShowModal]   = useState(false)
  const [patients, setPatients]     = useState<any[]>([])
  const router   = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/'); return }
      setToken(session.access_token)
      await Promise.all([
        fetchPayments(session.access_token),
        fetchSummary(session.access_token),
        fetchPatients(session.access_token),
      ])
      setLoading(false)
    }
    load()
  }, [])

  async function fetchPayments(t: string) {
    const data = await apiFetch('/payments?limit=30', { token: t })
    setPayments(data.data ?? [])
  }

  async function fetchSummary(t: string) {
    const today = new Date().toLocaleDateString('en-CA', {
      timeZone: 'America/Argentina/Buenos_Aires'
    })
    const data = await apiFetch(`/payments/cash-summary?date=${today}`, { token: t })
    setSummary(data.data)
  }

  async function fetchPatients(t: string) {
    const data = await apiFetch('/patients?limit=100', { token: t })
    setPatients(data.data ?? [])
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-gray-400">Cargando...</div>
      </div>
    )
  }

  const totalHoy = summary?.total ?? 0

  return (
    <div className="min-h-screen bg-gray-950 text-white">

      <main className="p-6 max-w-4xl mx-auto">
        {/* Resumen del día */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 col-span-2">
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Total cobrado hoy</div>
            <div className="text-3xl font-bold text-emerald-400">
              ${Number(totalHoy).toLocaleString('es-AR')}
            </div>
          </div>
          {(summary?.by_method ?? []).slice(0, 2).map((m: any) => (
            <div key={m.method} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                {METODOS.find(x => x.value === m.method)?.label ?? m.method}
              </div>
              <div className="text-xl font-bold text-white">
                ${Number(m.total).toLocaleString('es-AR')}
              </div>
              <div className="text-xs text-gray-500 mt-1">{m.transactions} cobros</div>
            </div>
          ))}
        </div>

        {/* Historial */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-800">
            <h3 className="font-semibold">Historial de cobros</h3>
          </div>
          {payments.length === 0 ? (
            <div className="px-6 py-12 text-center text-gray-500">
              No hay cobros registrados todavía
            </div>
          ) : (
            <div className="divide-y divide-gray-800">
              {payments.map((p: any) => (
                <div key={p.id} className="px-6 py-4 flex items-center gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-900/40 flex items-center justify-center text-emerald-400 text-sm">
                    💰
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">
                      {p.patients?.first_name} {p.patients?.last_name}
                    </div>
                    <div className="text-sm text-gray-400">
                      {METODOS.find(m => m.value === p.method)?.label ?? p.method}
                      {p.installments > 1 && ` · ${p.installments} cuotas`}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="font-bold text-emerald-400">
                      ${Number(p.amount).toLocaleString('es-AR')}
                    </div>
                    <div className="text-xs text-gray-500">
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
      </main>

      {showModal && (
        <NewPaymentModal
          token={token}
          patients={patients}
          onClose={() => setShowModal(false)}
          onCreated={async () => {
            setShowModal(false)
            await Promise.all([fetchPayments(token), fetchSummary(token)])
          }}
        />
      )}
    </div>
  )
}

function NewPaymentModal({ token, patients, onClose, onCreated }: {
  token: string
  patients: any[]
  onClose: () => void
  onCreated: () => void
}) {
  const [form, setForm] = useState({
    patient_id:   '',
    amount:       '',
    method:       'cash',
    installments: '1',
    notes:        '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [search, setSearch]   = useState('')

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  const filteredPatients = patients.filter(p =>
    `${p.first_name} ${p.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
    p.phone.includes(search)
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.patient_id) { setError('Seleccioná un paciente'); return }
    if (!form.amount || Number(form.amount) <= 0) { setError('Ingresá un monto válido'); return }

    setLoading(true)
    setError('')
    try {
      await apiFetch('/payments', {
        method: 'POST',
        token,
        body: JSON.stringify({
          patient_id:   form.patient_id,
          amount:       Number(form.amount),
          method:       form.method,
          installments: Number(form.installments),
          notes:        form.notes || undefined,
        })
      })
      onCreated()
    } catch (err: any) {
      setError(err.message)
      setLoading(false)
    }
  }

  const selectedPatient = patients.find(p => p.id === form.patient_id)

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="w-9 h-1 bg-gray-700 rounded-full mx-auto mb-6 sm:hidden" />
          <h2 className="text-lg font-bold mb-5">Registrar cobro</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Paciente */}
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Paciente
              </label>
              {selectedPatient ? (
                <div className="flex items-center justify-between bg-gray-800 rounded-xl px-4 py-3">
                  <div className="font-medium">{selectedPatient.first_name} {selectedPatient.last_name}</div>
                  <button type="button" onClick={() => set('patient_id', '')}
                    className="text-gray-500 hover:text-white text-sm">✕</button>
                </div>
              ) : (
                <div>
                  <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar paciente..."
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-blue-400 mb-2"
                  />
                  {search && (
                    <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden max-h-40 overflow-y-auto">
                      {filteredPatients.slice(0, 5).map(p => (
                        <div key={p.id}
                          onClick={() => { set('patient_id', p.id); setSearch('') }}
                          className="px-4 py-2.5 hover:bg-gray-700 cursor-pointer text-sm">
                          {p.first_name} {p.last_name} · <span className="text-gray-400">{p.phone}</span>
                        </div>
                      ))}
                      {filteredPatients.length === 0 && (
                        <div className="px-4 py-3 text-gray-500 text-sm">Sin resultados</div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Monto */}
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Monto
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span>
                <input
                  type="number"
                  value={form.amount}
                  onChange={e => set('amount', e.target.value)}
                  placeholder="0"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-8 pr-4 py-3 text-white text-xl font-bold focus:outline-none focus:border-blue-400"
                  min="1"
                  required
                />
              </div>
            </div>

            {/* Forma de pago */}
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Forma de pago
              </label>
              <div className="grid grid-cols-3 gap-2">
                {METODOS.map(m => (
                  <button key={m.value} type="button"
                    onClick={() => set('method', m.value)}
                    className={`py-2.5 px-2 rounded-xl text-xs font-semibold transition-colors ${
                      form.method === m.value
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-800 border border-gray-700 text-gray-400 hover:border-gray-500'
                    }`}>
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Cuotas (solo crédito) */}
            {form.method === 'credit_card' && (
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Cuotas
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {['1','3','6','12'].map(c => (
                    <button key={c} type="button"
                      onClick={() => set('installments', c)}
                      className={`py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                        form.installments === c
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-800 border border-gray-700 text-gray-400'
                      }`}>
                      {c}x
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Notas */}
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Notas (opcional)
              </label>
              <input
                type="text"
                value={form.notes}
                onChange={e => set('notes', e.target.value)}
                placeholder="Referencia, observación..."
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-blue-400"
              />
            </div>

            {error && (
              <div className="p-3 bg-red-900/30 border border-red-700 rounded-xl text-red-400 text-sm">
                {error}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose}
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-white font-semibold py-3 rounded-xl transition-colors">
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