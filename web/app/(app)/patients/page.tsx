'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { apiFetch } from '@/lib/api'
import { useRouter } from 'next/navigation'
import { UserPlus, Search, ChevronRight, Loader2 } from 'lucide-react'
import {
  cachePatients,
  clearPatientsInFlight,
  getCachedPatients,
  getPatientsInFlight,
  invalidatePatientsCache,
  type PatientSummary,
  setPatientsInFlight,
} from '@/lib/patients-cache'

function daysAgoLabel(dateStr: string): string {
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000)
  if (days === 0) return 'hoy'
  if (days === 1) return 'ayer'
  if (days < 365) return `hace ${days} días`
  const years = Math.floor(days / 365)
  return `hace ${years} ${years === 1 ? 'año' : 'años'}`
}

const SEARCH_MIN_LENGTH = 3
const SEARCH_DEBOUNCE_MS = 300
const PATIENTS_LIMIT = 10

export default function PatientsPage() {
  const [patients, setPatients]     = useState<PatientSummary[]>([])
  const [search, setSearch]         = useState('')
  const [loading, setLoading]       = useState(true)
  const [searching, setSearching]   = useState(false)
  const [token, setToken]           = useState('')
  const [showModal, setShowModal]   = useState(false)
  const router   = useRouter()
  const supabase = createClient()
  const requestIdRef    = useRef(0)
  const authCheckedRef  = useRef(false)
  const initialLoadedRef = useRef(false)

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/'); return }
      setToken(session.access_token)
      authCheckedRef.current = true
    }
    void load()
  }, [router, supabase])

  async function fetchPatients(t: string, q: string, options?: { force?: boolean }) {
    const normalizedQuery = q.trim()
    const force = options?.force ?? false

    if (normalizedQuery.length > 0 && normalizedQuery.length < SEARCH_MIN_LENGTH) {
      setPatients([])
      return
    }

    const requestId = ++requestIdRef.current
    const cachedPatients = !force ? getCachedPatients(t, normalizedQuery) : null
    if (cachedPatients) {
      setPatients(cachedPatients)
      return
    }

    const inFlightRequest = !force ? getPatientsInFlight(t, normalizedQuery) : null
    const request =
      inFlightRequest ??
      (async () => {
        const searchParams = new URLSearchParams({
          limit: String(PATIENTS_LIMIT),
        })

        if (normalizedQuery) {
          searchParams.set('q', normalizedQuery)
        }

        const url = `/patients?${searchParams.toString()}`

        const data = await apiFetch(url, { token: t })
        const nextPatients = data.data ?? []
        cachePatients(t, normalizedQuery, nextPatients)
        return nextPatients
      })()

    if (!inFlightRequest) {
      setPatientsInFlight(t, normalizedQuery, request)
    }

    try {
      const nextPatients = await request

      if (requestId === requestIdRef.current) {
        setPatients(nextPatients)
      }
    } finally {
      if (!inFlightRequest) {
        clearPatientsInFlight(t, normalizedQuery)
      }
    }
  }

  useEffect(() => {
    if (!token) {
      if (authCheckedRef.current) {
        setLoading(false)
      }
      return
    }

    const normalizedSearch = search.trim()

    if (normalizedSearch.length === 0) {
      if (!initialLoadedRef.current) {
        setLoading(true)
      } else {
        setSearching(true)
      }
      void fetchPatients(token, '').finally(() => {
        setLoading(false)
        setSearching(false)
        initialLoadedRef.current = true
      })
      return
    }

    if (normalizedSearch.length < SEARCH_MIN_LENGTH) {
      setSearching(false)
      return
    }

    setSearching(true)

    const timeoutId = window.setTimeout(() => {
      void fetchPatients(token, normalizedSearch).finally(() => {
        setSearching(false)
      })
    }, SEARCH_DEBOUNCE_MS)

    return () => window.clearTimeout(timeoutId)
  }, [search, token])

  function handleSearch(q: string) {
    setSearch(q)
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

  return (
    <div className="min-h-screen bg-app text-app">
      <main className="p-6 max-w-4xl mx-auto">

        {/* Acciones */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-app">Pacientes</h2>
            <p className="text-sm text-app3 mt-0.5">Gestioná tu cartera de pacientes</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-[#00C4BC] hover:bg-[#00aaa3] active:scale-95 text-white font-semibold px-4 py-2.5 rounded-xl text-sm transition-all shadow-sm shadow-[#00C4BC]/20"
          >
            <UserPlus size={16} />
            Nuevo paciente
          </button>
        </div>

        {/* Búsqueda */}
        <div className="mb-5 relative">
          {searching
            ? <Loader2 size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#00C4BC] animate-spin pointer-events-none" />
            : <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-app3 pointer-events-none" />
          }
          <input
            type="text"
            value={search}
            onChange={e => handleSearch(e.target.value)}
            placeholder="Buscar por nombre, teléfono o DNI..."
            className="w-full bg-surface border border-app rounded-xl pl-10 pr-4 py-3 text-app focus:outline-none focus:border-[#00C4BC] transition-colors"
          />
        </div>

        {/* Lista */}
        <div className="bg-surface border border-app rounded-xl overflow-hidden">
          {searching ? (
            <div className="divide-y divide-app/40 animate-pulse">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="px-5 py-3.5 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-surface2 flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-surface2 rounded w-40" />
                    <div className="h-3 bg-surface2 rounded w-24" />
                  </div>
                  <div className="hidden sm:block h-3 bg-surface2 rounded w-20" />
                  <div className="hidden md:block h-3 bg-surface2 rounded w-24" />
                  <div className="w-4 h-4 bg-surface2 rounded" />
                </div>
              ))}
            </div>
          ) : patients.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <div className="w-12 h-12 rounded-full bg-surface2 flex items-center justify-center mx-auto mb-3">
                <Search size={20} className="text-app3" />
              </div>
              <p className="text-app3 font-medium">
                {search ? 'No se encontraron pacientes' : 'No hay pacientes todavía'}
              </p>
              {!search && (
                <p className="text-app3 text-sm mt-1">Agregá el primero con el botón de arriba</p>
              )}
            </div>
          ) : (
            <>
              {/* Header de columnas */}
              <div className="px-5 py-2.5 border-b border-app bg-surface2/50 grid grid-cols-[auto_1fr_auto_auto_auto] items-center gap-4">
                <div className="w-10" />
                <div className="text-xs font-semibold text-app3 uppercase tracking-wider">Paciente</div>
                <div className="text-xs font-semibold text-app3 uppercase tracking-wider hidden sm:block w-32 text-right">Obra social</div>
                <div className="text-xs font-semibold text-app3 uppercase tracking-wider hidden md:block w-36 text-right">Último turno</div>
                <div className="w-5" />
              </div>
              <div className="divide-y divide-app/40">
                {patients.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => router.push(`/patients/${p.id}`)}
                    className="px-5 py-3.5 grid grid-cols-[auto_1fr_auto_auto_auto] items-center gap-4 hover:bg-[#00C4BC]/5 hover:border-l-2 hover:border-l-[#00C4BC] transition-all cursor-pointer group border-l-2 border-l-transparent"
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${
                      p.gender === 'F'
                        ? 'bg-pink-500/20 text-pink-400'
                        : p.gender === 'M'
                        ? 'bg-blue-500/20 text-blue-400'
                        : 'bg-surface3 text-app2'
                    }`}>
                      {p.first_name[0]}{p.last_name[0]}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-app truncate">{p.first_name} {p.last_name}</div>
                      <div className="text-sm text-app3 truncate">{p.phone}</div>
                    </div>
                    <div className="hidden sm:block w-32 text-right flex-shrink-0">
                      <span className="text-xs text-app3">{p.insurance_name ?? '—'}</span>
                    </div>
                    <div className="hidden md:block w-36 text-right flex-shrink-0">
                      {p.last_appointment_at ? (
                        <>
                          <div className="text-xs text-app3">
                            {new Date(p.last_appointment_at).toLocaleDateString('es-AR')}
                          </div>
                          <div className="text-xs font-medium text-app2">
                            {daysAgoLabel(p.last_appointment_at)}
                          </div>
                        </>
                      ) : (
                        <span className="text-xs text-app3">—</span>
                      )}
                    </div>
                    <ChevronRight size={16} className="text-app3 group-hover:text-[#00C4BC] transition-colors flex-shrink-0" />
                  </div>
                ))}
              </div>
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
            invalidatePatientsCache()
            await fetchPatients(token, search, { force: true })
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
    gender: '',
    email: '', insurance_name: '', insurance_plan: '', insurance_number: '', allergies: '',
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
      const payload: Record<string, string> = { document_type: 'DNI' }
      for (const [k, v] of Object.entries(form)) {
        if (v !== '') payload[k] = v
      }
      await apiFetch('/patients', {
        method: 'POST',
        token,
        body: JSON.stringify(payload)
      })
      onCreated()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el paciente')
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-surface border border-app rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="w-9 h-1 bg-surface3 rounded-full mx-auto mb-5 sm:hidden" />
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold text-app">Nuevo paciente</h2>
            <button onClick={onClose} className="text-app3 hover:text-app transition-colors p-1 rounded-lg hover:bg-surface2">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-app3 mb-1 uppercase tracking-wider">Nombre</label>
                <input value={form.first_name} onChange={e => set('first_name', e.target.value)}
                  className="w-full bg-surface2 border border-app rounded-lg px-3 py-2.5 text-app text-sm focus:outline-none focus:border-[#00C4BC]"
                  required />
              </div>
              <div>
                <label className="block text-xs font-medium text-app3 mb-1 uppercase tracking-wider">Apellido</label>
                <input value={form.last_name} onChange={e => set('last_name', e.target.value)}
                  className="w-full bg-surface2 border border-app rounded-lg px-3 py-2.5 text-app text-sm focus:outline-none focus:border-[#00C4BC]"
                  required />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-app3 mb-1 uppercase tracking-wider">Teléfono (WhatsApp)</label>
                <input value={form.phone} onChange={e => set('phone', e.target.value)}
                  type="tel" placeholder="+54 11 ..."
                  className="w-full bg-surface2 border border-app rounded-lg px-3 py-2.5 text-app text-sm focus:outline-none focus:border-[#00C4BC]" />
              </div>
              <div>
                <label className="block text-xs font-medium text-app3 mb-1 uppercase tracking-wider">Email</label>
                <input value={form.email} onChange={e => set('email', e.target.value)}
                  type="email"
                  className="w-full bg-surface2 border border-app rounded-lg px-3 py-2.5 text-app text-sm focus:outline-none focus:border-[#00C4BC]" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-app3 mb-1 uppercase tracking-wider">DNI</label>
                <input value={form.document_number} onChange={e => set('document_number', e.target.value)}
                  className="w-full bg-surface2 border border-app rounded-lg px-3 py-2.5 text-app text-sm focus:outline-none focus:border-[#00C4BC]" />
              </div>
              <div>
                <label className="block text-xs font-medium text-app3 mb-1 uppercase tracking-wider">Fecha de nacimiento</label>
                <input value={form.date_of_birth} onChange={e => set('date_of_birth', e.target.value)}
                  type="date"
                  className="w-full bg-surface2 border border-app rounded-lg px-3 py-2.5 text-app text-sm focus:outline-none focus:border-[#00C4BC]" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-app3 mb-1 uppercase tracking-wider">Sexo</label>
              <div className="flex gap-2">
                {[{ v: 'F', label: 'Femenino' }, { v: 'M', label: 'Masculino' }, { v: 'otro', label: 'Otro' }].map(opt => (
                  <button
                    key={opt.v}
                    type="button"
                    onClick={() => set('gender', form.gender === opt.v ? '' : opt.v)}
                    className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-all ${
                      form.gender === opt.v
                        ? opt.v === 'F'
                          ? 'bg-pink-500/20 border-pink-400 text-pink-400'
                          : opt.v === 'M'
                          ? 'bg-blue-500/20 border-blue-400 text-blue-400'
                          : 'bg-surface3 border-app2 text-app'
                        : 'bg-surface2 border-app text-app3 hover:border-app2'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-app3 mb-1 uppercase tracking-wider">Obra social</label>
                <input value={form.insurance_name} onChange={e => set('insurance_name', e.target.value)}
                  placeholder="OSDE, PAMI..."
                  className="w-full bg-surface2 border border-app rounded-lg px-3 py-2.5 text-app text-sm focus:outline-none focus:border-[#00C4BC]" />
              </div>
              <div>
                <label className="block text-xs font-medium text-app3 mb-1 uppercase tracking-wider">Plan</label>
                <input value={form.insurance_plan} onChange={e => set('insurance_plan', e.target.value)}
                  placeholder="410, Bronce..."
                  className="w-full bg-surface2 border border-app rounded-lg px-3 py-2.5 text-app text-sm focus:outline-none focus:border-[#00C4BC]" />
              </div>
              <div>
                <label className="block text-xs font-medium text-app3 mb-1 uppercase tracking-wider">Nro afiliado</label>
                <input value={form.insurance_number} onChange={e => set('insurance_number', e.target.value)}
                  placeholder="12345678"
                  className="w-full bg-surface2 border border-app rounded-lg px-3 py-2.5 text-app text-sm focus:outline-none focus:border-[#00C4BC]" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-app3 mb-1 uppercase tracking-wider">Alergias</label>
                <input value={form.allergies} onChange={e => set('allergies', e.target.value)}
                  placeholder="Penicilina, látex..."
                  className="w-full bg-surface2 border border-app rounded-lg px-3 py-2.5 text-app text-sm focus:outline-none focus:border-[#00C4BC]" />
              </div>
              <div>
                <label className="block text-xs font-medium text-app3 mb-1 uppercase tracking-wider">Medicación actual</label>
                <input value={form.current_medications} onChange={e => set('current_medications', e.target.value)}
                  className="w-full bg-surface2 border border-app rounded-lg px-3 py-2.5 text-app text-sm focus:outline-none focus:border-[#00C4BC]" />
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-600 dark:text-red-400 text-sm">
                {error}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose}
                className="flex-1 bg-surface2 hover:bg-surface3 border border-app text-app font-semibold py-3 rounded-xl transition-colors">
                Cancelar
              </button>
              <button type="submit" disabled={loading}
                className="flex-1 bg-[#00C4BC] hover:bg-[#00aaa3] disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-all active:scale-95">
                {loading ? 'Guardando...' : 'Guardar paciente'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
