'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { apiFetch } from '@/lib/api'
import { useRouter } from 'next/navigation'

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null)
  const [agenda, setAgenda] = useState<any[]>([])
  const [stats, setStats] = useState<any>({})
  const [inactive, setInactive] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showNotesModal, setShowNotesModal] = useState(false)
  const [pendingAppt, setPendingAppt] = useState<any>(null)
  const [clinicalNotes, setClinicalNotes] = useState('')
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      // Verificar sesión
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/')
        return
      }

      const token = session.access_token

      // Cargar perfil + agenda + stats en paralelo
      const [meData, agendaData, statsData, inactiveData] = await Promise.all([
        apiFetch('/auth/me', { token }),
        apiFetch('/appointments/today', { token }),
        apiFetch('/appointments/stats/today', { token }),
        apiFetch('/patients/alerts/inactive?days=90', { token }),
      ])

      setUser(meData.data)
      setAgenda(agendaData.data ?? [])
      setStats(statsData.data ?? {})
      setInactive(inactiveData.data ?? [])
      setLoading(false)
    }

    load()
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-gray-400">Cargando...</div>
      </div>
    )
  }

  const today = new Date().toLocaleDateString('es-AR', {
    weekday: 'long', day: 'numeric', month: 'long'
  })

  async function markStatus(id: string, status: string) {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    await apiFetch(`/appointments/${id}`, {
      method: 'PATCH',
      token: session.access_token,
      body: JSON.stringify({ status })
    })
    // Recargar agenda y stats
    const [agendaData, statsData] = await Promise.all([
      apiFetch('/appointments/today', { token: session.access_token }),
      apiFetch('/appointments/stats/today', { token: session.access_token }),
    ])
    setAgenda(agendaData.data ?? [])
    setStats(statsData.data ?? {})
  }

  async function confirmAttended() {
    if (!pendingAppt) return
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    await apiFetch(`/appointments/${pendingAppt.id}/complete`, {
      method: 'POST',
      token: session.access_token,
      body: JSON.stringify({ clinical_notes: clinicalNotes || undefined })
    })

    const [agendaData, statsData] = await Promise.all([
      apiFetch('/appointments/today', { token: session.access_token }),
      apiFetch('/appointments/stats/today', { token: session.access_token }),
    ])
    setAgenda(agendaData.data ?? [])
    setStats(statsData.data ?? {})
    setShowNotesModal(false)
    setPendingAppt(null)
    setClinicalNotes('')
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">

      <main className="p-6 max-w-6xl mx-auto">
        {/* Greeting */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold">
            Buenos días, Od. {user?.first_name} 👋
          </h2>
          <p className="text-gray-400 mt-1 capitalize">{today}</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Turnos hoy</div>
            <div className="text-3xl font-bold text-blue-400">{stats.total ?? 0}</div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Atendidos</div>
            <div className="text-3xl font-bold text-emerald-400">{stats.completed ?? 0}</div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Pendientes</div>
            <div className="text-3xl font-bold text-amber-400">{stats.pending ?? 0}</div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Ausentes</div>
            <div className="text-3xl font-bold text-red-400">{stats.absent ?? 0}</div>
          </div>
        </div>

        {/* Pacientes inactivos */}
        {inactive.length > 0 && (
          <div className="bg-amber-950/20 border border-amber-800/40 rounded-xl overflow-hidden mb-6">
            <div className="px-6 py-4 border-b border-amber-800/30 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-amber-400">
                  Pacientes sin turno hace +90 días
                </h3>
              </div>
              <span className="text-xs font-bold bg-amber-500/20 text-amber-400 px-2 py-1 rounded-full">
                {inactive.length}
              </span>
            </div>
            <div className="divide-y divide-amber-800/20">
              {inactive.slice(0, 5).map((p: any) => (
                <div key={p.id} className="px-6 py-3 flex items-center gap-3 hover:bg-amber-900/10 transition-colors">
                  <div className="w-8 h-8 rounded-full bg-amber-900/40 flex items-center justify-center text-amber-400 text-xs font-bold flex-shrink-0">
                    {p.first_name[0]}{p.last_name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">
                      {p.first_name} {p.last_name}
                    </div>
                    <div className="text-xs text-gray-500">
                      {p.last_appointment_at
                        ? new Date(p.last_appointment_at).toLocaleDateString('es-AR', {
                          day: 'numeric', month: 'short', year: 'numeric'
                        })
                        : 'Sin turnos previos'}
                    </div>
                  </div>
                  <a
                    href={`https://wa.me/${p.phone.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs bg-emerald-900/40 hover:bg-emerald-700/40 active:scale-95 text-emerald-400 px-3 py-1.5 rounded-lg transition-all font-semibold flex-shrink-0"
                  >
                    WhatsApp
                  </a>
                </div>
              ))}
              {inactive.length > 5 && (
                <div className="px-6 py-3 text-center text-sm text-gray-500">
                  +{inactive.length - 5} pacientes más
                </div>
              )}
            </div>
          </div>
        )}

        {/* Agenda del día */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-visible">
          <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
            <h3 className="font-semibold">Agenda de hoy</h3>
            <span className="text-sm text-gray-500">{agenda.length} turnos</span>
          </div>

          {agenda.length === 0 ? (
            <div className="px-6 py-12 text-center text-gray-500">
              No hay turnos para hoy
            </div>
          ) : (
            <div className="divide-y divide-gray-800">
              {agenda.map((appt: any) => (
                <div key={appt.id} className="px-6 py-4 flex items-center gap-4 hover:bg-gray-800/50 transition-colors">
                  <div className="font-mono text-sm text-gray-400 w-16 flex-shrink-0">
                    {new Date(appt.starts_at).toLocaleTimeString('es-AR', {
                      hour: '2-digit', minute: '2-digit',
                      timeZone: 'America/Argentina/Buenos_Aires'
                    })}
                  </div>
                  <div
                    className="w-1 h-10 rounded-full flex-shrink-0"
                    style={{ background: appt.professional_color }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">{appt.patient_name}</div>
                    <div className="text-sm text-gray-400 truncate">{appt.appointment_type}</div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {appt.status === 'completed' || appt.status === 'absent' || appt.status === 'cancelled' ? (
                      <span className={`text-xs font-semibold px-3 py-1 rounded-full ${appt.status === 'completed' ? 'bg-emerald-900/40 text-emerald-400' :
                        appt.status === 'absent' ? 'bg-red-900/40 text-red-400' :
                          'bg-gray-800 text-gray-500'
                        }`}>
                        {appt.status === 'completed' ? 'Atendido' :
                          appt.status === 'absent' ? 'Ausente' : 'Cancelado'}
                      </span>
                    ) : (
                      <div className="flex items-center gap-1">
                        <div className="relative">
                          <button
                            onClick={() => setOpenDropdown(openDropdown === appt.id ? null : appt.id)}
                            className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all ${appt.status === 'confirmed' ? 'bg-blue-900/40 border-blue-700 text-blue-300' :
                                appt.status === 'in_progress' ? 'bg-purple-900/40 border-purple-700 text-purple-300' :
                                  'bg-amber-900/40 border-amber-700 text-amber-300'
                              }`}>
                            {appt.status === 'confirmed' ? 'Confirmado' :
                              appt.status === 'in_progress' ? 'En curso' : 'Pendiente'}
                            <span className="opacity-60">▾</span>
                          </button>

                          {openDropdown === appt.id && (
                            <>
                              {/* Overlay para cerrar al hacer click afuera */}
                              <div className="fixed inset-0 z-10" onClick={() => setOpenDropdown(null)} />
                              <div className="absolute right-0 top-full mt-1 bg-gray-900 border border-gray-700 rounded-xl shadow-xl z-20 overflow-hidden min-w-[140px]">
                                {[
                                  { value: 'confirmed', label: 'Confirmado', color: 'text-blue-400' },
                                  { value: 'in_progress', label: 'En curso', color: 'text-purple-400' },
                                  { value: 'completed', label: 'Atendido', color: 'text-emerald-400' },
                                  { value: 'absent', label: 'Ausente', color: 'text-red-400' },
                                  { value: 'cancelled', label: 'Cancelado', color: 'text-gray-500' },
                                ].map(({ value, label, color }) => (
                                  <button
                                    key={value}
                                    onClick={async () => {
                                      setOpenDropdown(null)
                                      if (value === 'completed') {
                                        setPendingAppt(appt)
                                        setShowNotesModal(true)
                                      } else {
                                        await markStatus(appt.id, value)
                                      }
                                    }}
                                    className={`w-full text-left px-4 py-2.5 text-xs font-semibold hover:bg-gray-800 transition-colors ${color} ${appt.status === value ? 'bg-gray-800' : ''
                                      }`}
                                  >
                                    {label}
                                  </button>
                                ))}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal notas clínicas */}
        {showNotesModal && pendingAppt && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4"
            onClick={() => setShowNotesModal(false)}>
            <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md p-6"
              onClick={e => e.stopPropagation()}>
              <div className="w-9 h-1 bg-gray-700 rounded-full mx-auto mb-5 sm:hidden" />
              <div className="mb-4">
                <div className="font-bold text-lg">{pendingAppt.patient_name}</div>
                <div className="text-gray-400 text-sm">{pendingAppt.appointment_type}</div>
              </div>
              <div className="mb-4">
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Notas de la consulta (opcional)
                </label>
                <textarea
                  value={clinicalNotes}
                  onChange={e => setClinicalNotes(e.target.value)}
                  rows={4}
                  placeholder="Procedimiento realizado, observaciones, indicaciones..."
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-blue-400 resize-none"
                  autoFocus
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowNotesModal(false)}
                  className="flex-1 bg-gray-800 hover:bg-gray-700 text-white font-semibold py-3 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmAttended}
                  className="flex-1 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white font-semibold py-3 rounded-xl transition-all"
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  )
}