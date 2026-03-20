'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { apiFetch } from '@/lib/api'
import { useRouter, useParams } from 'next/navigation'

export default function PatientDetailPage() {
  const [patient, setPatient]   = useState<any>(null)
  const [balance, setBalance]   = useState<any>(null)
  const [loading, setLoading]   = useState(true)
  const [token, setToken]       = useState('')
  const router   = useRouter()
  const params   = useParams()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/'); return }
      setToken(session.access_token)

      const [patientData, balanceData] = await Promise.all([
        apiFetch(`/patients/${params.id}`, { token: session.access_token }),
        apiFetch(`/patients/${params.id}/balance`, { token: session.access_token }),
      ])

      setPatient(patientData.data)
      setBalance(balanceData.data)
      setLoading(false)
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-gray-400">Cargando...</div>
      </div>
    )
  }

  if (!patient) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-gray-400">Paciente no encontrado</div>
      </div>
    )
  }

  const age = patient.date_of_birth
    ? Math.floor((Date.now() - new Date(patient.date_of_birth).getTime()) / 31557600000)
    : null

  return (
    <div className="min-h-screen bg-gray-950 text-white">

      <main className="p-6 max-w-5xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

          {/* Columna izquierda — info del paciente */}
          <div className="space-y-4">
            {/* Avatar + nombre */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 text-center">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-emerald-400 flex items-center justify-center text-2xl font-bold mx-auto mb-3">
                {patient.first_name[0]}{patient.last_name[0]}
              </div>
              <div className="font-bold text-lg">{patient.first_name} {patient.last_name}</div>
              {age && <div className="text-gray-400 text-sm mt-1">{age} años</div>}
              {patient.document_number && (
                <div className="text-gray-500 text-sm">DNI {patient.document_number}</div>
              )}
            </div>

            {/* Saldo */}
            {balance && Number(balance.balance_due) > 0 && (
              <div className="bg-red-950/40 border border-red-800/50 rounded-xl p-4">
                <div className="text-xs text-red-400 font-semibold uppercase tracking-wider mb-1">
                  💸 Saldo pendiente
                </div>
                <div className="text-2xl font-bold text-red-400">
                  ${Number(balance.balance_due).toLocaleString('es-AR')}
                </div>
              </div>
            )}

            {/* Contacto */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
              <div className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Contacto</div>
              <div className="text-sm">📱 {patient.phone}</div>
              {patient.email && <div className="text-sm">✉️ {patient.email}</div>}
            </div>

            {/* Obra social */}
            {patient.insurance_name && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <div className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-2">Obra Social</div>
                <div className="text-sm font-medium">{patient.insurance_name} {patient.insurance_plan}</div>
                {patient.insurance_number && (
                  <div className="text-xs text-gray-500 mt-1">Afiliado: {patient.insurance_number}</div>
                )}
              </div>
            )}

            {/* Alertas médicas */}
            {patient.allergies && (
              <div className="bg-red-950/30 border border-red-800/40 rounded-xl p-4">
                <div className="text-xs text-red-400 uppercase tracking-wider font-semibold mb-2">⚠️ Alergias</div>
                <div className="text-sm text-red-300">{patient.allergies}</div>
              </div>
            )}

            {patient.current_medications && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <div className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-2">Medicación</div>
                <div className="text-sm">{patient.current_medications}</div>
              </div>
            )}

            {/* Acciones */}
            <button
              onClick={() => router.push(`/dashboard/patients/${params.id}/appointment`)}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 rounded-xl transition-colors"
            >
              📅 Nuevo turno
            </button>
          </div>

          {/* Columna derecha — historial + tratamientos */}
          <div className="md:col-span-2 space-y-6">

            {/* Tratamientos activos */}
            {patient.treatments?.filter((t: any) => t.status === 'in_progress' || t.status === 'accepted').length > 0 && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-800">
                  <h3 className="font-semibold">📋 Tratamientos activos</h3>
                </div>
                <div className="divide-y divide-gray-800">
                  {patient.treatments
                    .filter((t: any) => t.status === 'in_progress' || t.status === 'accepted')
                    .map((t: any) => (
                      <div key={t.id} className="px-6 py-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-medium">{t.name}</div>
                          <div className="text-sm font-mono text-gray-400">
                            {t.sessions_done} / {t.sessions_planned ?? '?'} sesiones
                          </div>
                        </div>
                        {t.sessions_planned && (
                          <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-blue-500 to-emerald-400 rounded-full"
                              style={{ width: `${Math.min(100, (t.sessions_done / t.sessions_planned) * 100)}%` }}
                            />
                          </div>
                        )}
                        {t.total_quoted && (
                          <div className="flex justify-between text-xs text-gray-500 mt-2">
                            <span>Presupuesto: ${Number(t.total_quoted).toLocaleString('es-AR')}</span>
                            <span>Pagado: ${Number(t.total_paid).toLocaleString('es-AR')}</span>
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Historial de turnos */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-800">
                <h3 className="font-semibold">📖 Historial de turnos</h3>
              </div>
              {!patient.appointments?.length ? (
                <div className="px-6 py-8 text-center text-gray-500 text-sm">
                  Sin historial de turnos
                </div>
              ) : (
                <div className="divide-y divide-gray-800">
                  {[...patient.appointments]
                    .sort((a: any, b: any) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime())
                    .map((appt: any) => (
                      <div key={appt.id} className="px-6 py-4 flex items-center gap-4">
                        <div className="text-sm font-mono text-gray-400 flex-shrink-0 w-28">
                          {new Date(appt.starts_at).toLocaleDateString('es-AR', {
                            day: 'numeric', month: 'short', year: 'numeric',
                            timeZone: 'America/Argentina/Buenos_Aires'
                          })}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">
                            {appt.appointment_type ?? 'Consulta'}
                          </div>
                        </div>
                        <span className={`text-xs font-semibold px-2 py-1 rounded-full flex-shrink-0 ${
                          appt.status === 'completed' ? 'bg-emerald-900/40 text-emerald-400' :
                          appt.status === 'absent'    ? 'bg-red-900/40 text-red-400' :
                          appt.status === 'cancelled' ? 'bg-gray-800 text-gray-500' :
                          'bg-amber-900/40 text-amber-400'
                        }`}>
                          {appt.status === 'completed' ? 'Atendido' :
                           appt.status === 'absent'    ? 'Ausente' :
                           appt.status === 'cancelled' ? 'Cancelado' : 'Pendiente'}
                        </span>
                      </div>
                    ))}
                </div>
              )}
            </div>

          </div>
        </div>
      </main>
    </div>
  )
}