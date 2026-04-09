'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { apiFetch } from '@/lib/api'
import { useRouter } from 'next/navigation'

export default function PatientsPage() {
  const [patients, setPatients]   = useState<any[]>([])
  const [search, setSearch]       = useState('')
  const [loading, setLoading]     = useState(true)
  const [token, setToken]         = useState('')
  const [showModal, setShowModal] = useState(false)
  const [page, setPage]           = useState(1)
  const PATIENTS_PER_PAGE         = 10
  const router   = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/'); return }
      setToken(session.access_token)
      await fetchPatients(session.access_token, '')
      setLoading(false)
    }
    load()
  }, [])

  async function fetchPatients(t: string, q: string) {
    const url = q.length >= 2 ? `/patients?q=${encodeURIComponent(q)}` : '/patients'
    const data = await apiFetch(url, { token: t })
    setPatients(data.data ?? [])
  }

  async function handleSearch(q: string) {
    setSearch(q)
    setPage(1)
    if (token) await fetchPatients(token, q)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-app">
        <main className="p-6 max-w-4xl mx-auto animate-pulse">
          {/* Header skeleton */}
          <div className="flex items-center justify-between mb-6">
            <div className="h-6 bg-surface2 rounded w-28" />
            <div className="h-9 bg-surface2 rounded-lg w-36" />
          </div>
          {/* Search skeleton */}
          <div className="mb-6 h-12 bg-surface2 rounded-xl" />
          {/* List skeleton */}
          <div className="space-y-2">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="bg-surface border border-app rounded-xl p-4 flex items-center gap-4">
                <div className="h-10 w-10 bg-surface2 rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-surface2 rounded w-48" />
                  <div className="h-3 bg-surface2 rounded w-32" />
                </div>
                <div className="h-4 bg-surface2 rounded w-16" />
              </div>
            ))}
          </div>
        </main>
      </div>
    )
  }

  const total      = patients.length
  const totalPages = Math.ceil(total / PATIENTS_PER_PAGE)
  const paged      = patients.slice((page - 1) * PATIENTS_PER_PAGE, page * PATIENTS_PER_PAGE)

  return (
    <div className="min-h-screen bg-app text-app">
      <main className="p-6 max-w-4xl mx-auto">

        {/* Acciones */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">Pacientes</h2>
          <button
            onClick={() => setShowModal(true)}
            className="bg-blue-500 hover:bg-blue-600 active:scale-95 text-white font-semibold px-4 py-2 rounded-lg text-sm transition-all"
          >
            + Nuevo paciente
          </button>
        </div>

        {/* Búsqueda */}
        <div className="mb-6">
          <input
            type="text"
            value={search}
            onChange={e => handleSearch(e.target.value)}
            placeholder="Buscar por nombre, teléfono o DNI..."
            className="w-full bg-surface border border-app rounded-xl px-4 py-3 text-app focus:outline-none focus:border-blue-400"
          />
        </div>

        {/* Lista */}
        <div className="bg-surface border border-app rounded-xl overflow-hidden">
          {patients.length === 0 ? (
            <div className="px-6 py-12 text-center text-app3">
              {search ? 'No se encontraron pacientes' : 'No hay pacientes todavía'}
            </div>
          ) : (
            <>
              <div className="divide-y divide-app">
                {paged.map((p: any) => (
                  <div
                    key={p.id}
                    onClick={() => router.push(`/dashboard/patients/${p.id}`)}
                    className="px-6 py-4 flex items-center gap-4 hover:bg-surface2/50 transition-colors cursor-pointer"
                  >
                    <div className="w-10 h-10 rounded-full bg-surface3 flex items-center justify-center font-bold text-app2 flex-shrink-0">
                      {p.first_name[0]}{p.last_name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-app">{p.first_name} {p.last_name}</div>
                      <div className="text-sm text-app2">{p.phone}</div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      {p.insurance_name && (
                        <div className="text-xs text-app3">{p.insurance_name}</div>
                      )}
                      {p.last_appointment_at && (
                        <div className="text-xs text-app3 mt-1">
                          Último turno: {new Date(p.last_appointment_at).toLocaleDateString('es-AR')}
                        </div>
                      )}
                    </div>
                    <div className="text-app3">→</div>
                  </div>
                ))}
              </div>

              {totalPages > 1 && (
                <div className="px-6 py-4 border-t border-app flex items-center justify-between">
                  <span className="text-xs text-app3">
                    {total} pacientes · página {page} de {totalPages}
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="px-3 py-1.5 text-xs font-semibold bg-surface2 border border-app rounded-lg disabled:opacity-40 hover:bg-surface3 transition-colors active:scale-95"
                    >
                      ←
                    </button>
                    <button
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="px-3 py-1.5 text-xs font-semibold bg-surface2 border border-app rounded-lg disabled:opacity-40 hover:bg-surface3 transition-colors active:scale-95"
                    >
                      →
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {showModal && (
        <NewPatientModal
          token={token}
          onClose={() => setShowModal(false)}
          onCreated={async () => {
            setShowModal(false)
            await fetchPatients(token, search)
          }}
        />
      )}
    </div>
  )
}

function NewPatientModal({ token, onClose, onCreated }: {
  token: string
  onClose: () => void
  onCreated: () => void
}) {
  const [form, setForm] = useState({
    first_name: '', last_name: '', phone: '',
    document_number: '', date_of_birth: '',
    email: '', insurance_name: '', allergies: '',
    current_medications: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await apiFetch('/patients', {
        method: 'POST',
        token,
        body: JSON.stringify({ ...form, document_type: 'DNI' })
      })
      onCreated()
    } catch (err: any) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-surface border border-app rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="w-9 h-1 bg-surface3 rounded-full mx-auto mb-6 sm:hidden" />
          <h2 className="text-lg font-bold text-app mb-6">Nuevo paciente</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-app3 mb-1 uppercase tracking-wider">Nombre</label>
                <input value={form.first_name} onChange={e => set('first_name', e.target.value)}
                  className="w-full bg-surface2 border border-app rounded-lg px-3 py-2.5 text-app text-sm focus:outline-none focus:border-blue-400"
                  required />
              </div>
              <div>
                <label className="block text-xs font-medium text-app3 mb-1 uppercase tracking-wider">Apellido</label>
                <input value={form.last_name} onChange={e => set('last_name', e.target.value)}
                  className="w-full bg-surface2 border border-app rounded-lg px-3 py-2.5 text-app text-sm focus:outline-none focus:border-blue-400"
                  required />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-app3 mb-1 uppercase tracking-wider">Teléfono (WhatsApp)</label>
              <input value={form.phone} onChange={e => set('phone', e.target.value)}
                type="tel" placeholder="+54 11 ..."
                className="w-full bg-surface2 border border-app rounded-lg px-3 py-2.5 text-app text-sm focus:outline-none focus:border-blue-400"
                required />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-app3 mb-1 uppercase tracking-wider">DNI</label>
                <input value={form.document_number} onChange={e => set('document_number', e.target.value)}
                  className="w-full bg-surface2 border border-app rounded-lg px-3 py-2.5 text-app text-sm focus:outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-app3 mb-1 uppercase tracking-wider">Fecha de nacimiento</label>
                <input value={form.date_of_birth} onChange={e => set('date_of_birth', e.target.value)}
                  type="date"
                  className="w-full bg-surface2 border border-app rounded-lg px-3 py-2.5 text-app text-sm focus:outline-none focus:border-blue-400" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-app3 mb-1 uppercase tracking-wider">Email</label>
              <input value={form.email} onChange={e => set('email', e.target.value)}
                type="email"
                className="w-full bg-surface2 border border-app rounded-lg px-3 py-2.5 text-app text-sm focus:outline-none focus:border-blue-400" />
            </div>

            <div>
              <label className="block text-xs font-medium text-app3 mb-1 uppercase tracking-wider">Obra social</label>
              <input value={form.insurance_name} onChange={e => set('insurance_name', e.target.value)}
                placeholder="OSDE, PAMI, Swiss Medical..."
                className="w-full bg-surface2 border border-app rounded-lg px-3 py-2.5 text-app text-sm focus:outline-none focus:border-blue-400" />
            </div>

            <div>
              <label className="block text-xs font-medium text-app3 mb-1 uppercase tracking-wider">Alergias</label>
              <input value={form.allergies} onChange={e => set('allergies', e.target.value)}
                placeholder="Penicilina, látex..."
                className="w-full bg-surface2 border border-app rounded-lg px-3 py-2.5 text-app text-sm focus:outline-none focus:border-blue-400" />
            </div>

            <div>
              <label className="block text-xs font-medium text-app3 mb-1 uppercase tracking-wider">Medicación actual</label>
              <input value={form.current_medications} onChange={e => set('current_medications', e.target.value)}
                className="w-full bg-surface2 border border-app rounded-lg px-3 py-2.5 text-app text-sm focus:outline-none focus:border-blue-400" />
            </div>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-600 dark:text-red-400 text-sm">
                {error}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose}
                className="flex-1 bg-surface2 hover:bg-surface3 border border-app text-app font-semibold py-3 rounded-lg transition-colors">
                Cancelar
              </button>
              <button type="submit" disabled={loading}
                className="flex-1 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition-colors">
                {loading ? 'Guardando...' : 'Guardar paciente'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}