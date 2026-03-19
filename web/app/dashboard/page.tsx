'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { apiFetch } from '@/lib/api'
import { useRouter } from 'next/navigation'

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null)
  const [agenda, setAgenda] = useState<any[]>([])
  const [stats, setStats] = useState<any>({})
  const [loading, setLoading] = useState(true)
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
      const [meData, agendaData, statsData] = await Promise.all([
        apiFetch('/auth/me', { token }),
        apiFetch('/appointments/today', { token }),
        apiFetch('/appointments/stats/today', { token }),
      ])

      setUser(meData.data)
      setAgenda(agendaData.data ?? [])
      setStats(statsData.data ?? {})
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

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">
          Dental<span className="text-blue-400">OS</span>
        </h1>
        <div className="flex items-center gap-4">
          <span className="text-gray-400 text-sm">
            Dr. {user?.first_name} {user?.last_name}
          </span>
          <button
            onClick={handleLogout}
            className="text-sm text-gray-500 hover:text-white transition-colors"
          >
            Salir
          </button>
        </div>
      </header>

      <main className="p-6 max-w-6xl mx-auto">
        {/* Greeting */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold">
            Buenos días, Dr. {user?.first_name} 👋
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


        {/* Navegación rápida */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: '📅 Agenda', href: '/dashboard/agenda' },
            { label: '👥 Pacientes', href: '/dashboard/patients' },
            { label: '💰 Cobros', href: '/dashboard/payments' },
          ].map(({ label, href }) => (
            <button
              key={href}
              onClick={() => router.push(href)}
              className="bg-gray-900 border border-gray-800 hover:border-gray-600 rounded-xl py-4 text-sm font-semibold transition-colors text-center"
            >
              {label}
            </button>
          ))}
        </div>

        {/* Agenda del día */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
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
                  <div className="font-mono text-sm text-gray-400 w-12 flex-shrink-0">
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
                  <span className={`text-xs font-semibold px-3 py-1 rounded-full flex-shrink-0 ${appt.status === 'completed' ? 'bg-emerald-900/40 text-emerald-400' :
                      appt.status === 'confirmed' ? 'bg-blue-900/40 text-blue-400' :
                        appt.status === 'absent' ? 'bg-red-900/40 text-red-400' :
                          'bg-amber-900/40 text-amber-400'
                    }`}>
                    {appt.status === 'completed' ? 'Atendido' :
                      appt.status === 'confirmed' ? 'Confirmado' :
                        appt.status === 'absent' ? 'Ausente' : 'Pendiente'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}