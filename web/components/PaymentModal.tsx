'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'

export const METODOS = [
  { value: 'cash', label: '💵 Efectivo' },
  { value: 'bank_transfer', label: '📲 Transferencia' },
  { value: 'debit_card', label: '💳 Débito' },
  { value: 'credit_card', label: '💳 Crédito' },
  { value: 'insurance', label: '🏥 Obra social' },
  { value: 'other', label: '📝 Otro' },
]

export const TIPOS = [
  'Consulta', 'Limpieza', 'Endodoncia', 'Exodoncia', 'Ortodoncia',
  'Implante', 'Operatoria', 'Prótesis', 'Blanqueamiento', 'Urgencia',
  'Control', 'Armonizacion facial', 'Otro',
]

export function PaymentModal({ token, patients: initialPatients, professionals, payment, preselectedPatientId, onClose, onSaved }: {
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
