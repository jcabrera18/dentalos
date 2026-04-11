'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { apiFetch } from '@/lib/api'
import { useRouter, useParams } from 'next/navigation'

export default function NewAppointmentPage() {
  const [patient, setPatient] = useState<any>(null)
  const [professional, setProfessional] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [token, setToken] = useState('')
  const router = useRouter()
  const params = useParams()
  const supabase = createClient()

  // Form state
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const defaultDate = tomorrow.toISOString().split('T')[0]

  const [form, setForm] = useState({
    date: defaultDate,
    time: '09:00',
    duration_minutes: '45',
    appointment_type: '',
    chief_complaint: '',
    internal_notes: '',
  })

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/'); return }
      setToken(session.access_token)

      const [patientData, meData] = await Promise.all([
        apiFetch(`/patients/${params.id}`, { token: session.access_token }),
        apiFetch('/auth/me', { token: session.access_token }),
      ])

      setPatient(patientData.data)
      setProfessional(meData.data)
      setLoading(false)
    }
    load()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')

    try {
      // Construir starts_at en UTC desde fecha + hora local Argentina
      const startsAt = `${form.date}T${form.time}:00-03:00`

      await apiFetch('/appointments', {
        method: 'POST',
        token,
        body: JSON.stringify({
          patient_id: params.id,
          professional_id: professional.id,
          starts_at: startsAt,
          duration_minutes: Number(form.duration_minutes),
          appointment_type: form.appointment_type || undefined,
          chief_complaint: form.chief_complaint || undefined,
          internal_notes: form.internal_notes || undefined,
        })
      })

      // Redirigir a la ficha del paciente
      router.push(`/dashboard/patients/${params.id}`)
    } catch (err: any) {
      setError(err.message)
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-app">
        <main className="p-6 max-w-lg mx-auto animate-pulse">
          {/* Patient card skeleton */}
          <div className="bg-surface border border-app rounded-xl p-4 mb-6 flex items-center gap-3">
            <div className="w-10 h-10 bg-surface2 rounded-full flex-shrink-0" />
            <div className="space-y-2">
              <div className="h-4 bg-surface2 rounded w-36" />
              <div className="h-3 bg-surface2 rounded w-24" />
            </div>
          </div>
          {/* Form skeleton */}
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="h-14 bg-surface2 rounded-xl" />
              <div className="h-14 bg-surface2 rounded-xl" />
            </div>
            <div className="h-14 bg-surface2 rounded-xl" />
            <div className="h-14 bg-surface2 rounded-xl" />
            <div className="h-14 bg-surface2 rounded-xl" />
          </div>
        </main>
      </div>
    )
  }

const TIPOS = ['Consulta', 'Limpieza', 'Endodoncia', 'Exodoncia', 'Ortodoncia', 'Implante', 'Operatoria', 'Prótesis', 'Blanqueamiento', 'Urgencia', 'Control', 'Armonizacion facial', 'Otro']
  const DURACIONES = [
    { value: '30', label: '30 min' },
    { value: '45', label: '45 min' },
    { value: '60', label: '1 hora' },
    { value: '90', label: '1h 30min' },
    { value: '120', label: '2 horas' },
  ]

  return (
    <div className="min-h-screen bg-app text-app">

      <main className="p-6 max-w-lg mx-auto">
        {/* Paciente */}
        <div className="bg-surface border border-app rounded-xl p-4 mb-6 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-400 flex items-center justify-center font-bold flex-shrink-0">
            {patient?.first_name[0]}{patient?.last_name[0]}
          </div>
          <div>
            <div className="font-semibold">{patient?.first_name} {patient?.last_name}</div>
            <div className="text-sm text-app2">{patient?.phone}</div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Fecha y hora */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-app2 uppercase tracking-wider mb-2">
                Fecha
              </label>
              <input
                type="date"
                value={form.date}
                onChange={e => set('date', e.target.value)}
                min={new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })}
                className="w-full bg-surface border border-app rounded-xl px-4 py-3 text-app focus:outline-none focus:border-emerald-400"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-app2 uppercase tracking-wider mb-2">
                Hora
              </label>
              <input
                type="time"
                value={form.time}
                onChange={e => set('time', e.target.value)}
                className="w-full bg-surface border border-app rounded-xl px-4 py-3 text-app focus:outline-none focus:border-emerald-400"
                required
              />
            </div>
          </div>

          {/* Duración */}
          <div>
            <label className="block text-xs font-semibold text-app2 uppercase tracking-wider mb-2">
              Duración
            </label>
            <div className="grid grid-cols-5 gap-2">
              {DURACIONES.map(d => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => set('duration_minutes', d.value)}
                  className={`py-2.5 rounded-xl text-sm font-semibold transition-colors ${form.duration_minutes === d.value
                    ? 'bg-emerald-500 text-app'
                    : 'bg-surface border border-app text-app2 hover:border-gray-500'
                    }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tipo de consulta */}
          <div>
            <label className="block text-xs font-semibold text-app2 uppercase tracking-wider mb-2">
              Tipo de consulta
            </label>
            <div className="grid grid-cols-3 gap-2">
              {TIPOS.map(tipo => (
                <button
                  key={tipo}
                  type="button"
                  onClick={() => set('appointment_type', tipo)}
                  className={`py-2 px-3 rounded-xl text-sm font-medium transition-colors text-left ${form.appointment_type === tipo
                    ? 'bg-emerald-500 text-app'
                    : 'bg-surface border border-app text-app2 hover:border-gray-500'
                    }`}
                >
                  {tipo}
                </button>
              ))}
            </div>
          </div>

          {/* Motivo */}
          <div>
            <label className="block text-xs font-semibold text-app2 uppercase tracking-wider mb-2">
              Motivo de consulta
            </label>
            <input
              type="text"
              value={form.chief_complaint}
              onChange={e => set('chief_complaint', e.target.value)}
              placeholder="Describe el motivo..."
              className="w-full bg-surface border border-app rounded-xl px-4 py-3 text-app focus:outline-none focus:border-emerald-400"
            />
          </div>

          {/* Notas internas */}
          <div>
            <label className="block text-xs font-semibold text-app2 uppercase tracking-wider mb-2">
              Notas internas (solo visibles para vos)
            </label>
            <textarea
              value={form.internal_notes}
              onChange={e => set('internal_notes', e.target.value)}
              rows={2}
              placeholder="Recordatorios, indicaciones especiales..."
              className="w-full bg-surface border border-app rounded-xl px-4 py-3 text-app focus:outline-none focus:border-emerald-400 resize-none"
            />
          </div>

          {/* Recordatorio */}
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
            <span className="flex-shrink-0">📱</span>
            <span>Se enviará confirmación por WhatsApp al guardar el turno.</span>
          </div>

          {error && (
            <div className="p-3 bg-red-900/30 border border-red-700 rounded-xl text-red-400 text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => router.push(`/dashboard/patients/${params.id}`)}
              className="flex-1 bg-surface2 hover:bg-surface3 border border-app text-app font-semibold py-3.5 rounded-xl transition-colors active:scale-95"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-semibold py-3.5 rounded-xl transition-colors active:scale-95">
            >
              {saving ? 'Agendando...' : 'Confirmar turno'}
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}