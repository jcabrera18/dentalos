'use client'
import { useState, useEffect } from 'react'
import { apiFetch } from '@/lib/api'

const APPTS_PER_PAGE = 5

const STATUS_OPTIONS = [
  { value: 'completed',   label: 'Atendido' },
  { value: 'confirmed',   label: 'Confirmado' },
  { value: 'in_progress', label: 'En progreso' },
  { value: 'absent',      label: 'Ausente' },
  { value: 'cancelled',   label: 'Cancelado' },
  { value: 'pending',     label: 'Pendiente' },
]

function statusStyle(status: string) {
  if (status === 'completed')   return 'bg-[#E6F8F1] dark:bg-[#00C4BC]/10 border-[#00C4BC]/20 text-[#00C4BC]'
  if (status === 'confirmed')   return 'bg-blue-500/10 border-blue-400/20 text-blue-400'
  if (status === 'in_progress') return 'bg-purple-500/10 border-purple-400/20 text-purple-400'
  if (status === 'absent')      return 'bg-red-500/10 border-red-400/20 text-red-400'
  if (status === 'cancelled')   return 'bg-surface2 border-app text-app3'
  return 'bg-amber-500/10 border-amber-400/20 text-amber-400'
}

function statusLabel(status: string) {
  return STATUS_OPTIONS.find(s => s.value === status)?.label ?? status
}

export function PatientAppointmentsSection({ patientId, token }: {
  patientId: string
  token: string
}) {
  const [appointments, setAppointments] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editStatus, setEditStatus] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void (async () => {
      setLoading(true)
      const offset = (page - 1) * APPTS_PER_PAGE
      const res = await apiFetch(
        `/patients/${patientId}/appointments?limit=${APPTS_PER_PAGE}&offset=${offset}`,
        { token }
      )
      setAppointments(res.data ?? [])
      setTotal(res.meta?.total ?? 0)
      setLoading(false)
    })()
  }, [patientId, page])

  function openEdit(appt: any) {
    setEditingId(appt.id)
    setEditStatus(appt.status)
    setEditNotes(appt.clinical_notes ?? '')
  }

  function cancelEdit() {
    setEditingId(null)
  }

  async function saveEdit(apptId: string) {
    setSaving(true)
    try {
      await apiFetch(`/appointments/${apptId}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({
          status: editStatus,
          clinical_notes: editNotes || undefined,
        }),
      })
      setAppointments(prev =>
        prev.map(a =>
          a.id === apptId
            ? { ...a, status: editStatus, clinical_notes: editNotes || null }
            : a
        )
      )
      setEditingId(null)
    } finally {
      setSaving(false)
    }
  }

  const totalPages = Math.ceil(total / APPTS_PER_PAGE)

  return (
    <div className="bg-surface border border-app rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-app">
        <h3 className="font-semibold">Historial clínico</h3>
      </div>
      {loading ? (
        <div className="divide-y divide-app">
          {Array.from({ length: APPTS_PER_PAGE }).map((_, i) => (
            <div key={i} className="px-5 py-3.5 animate-pulse">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 bg-surface2 rounded w-2/5" />
                  <div className="h-2.5 bg-surface2 rounded w-1/4" />
                </div>
                <div className="h-5 bg-surface2 rounded-md w-16 shrink-0" />
              </div>
            </div>
          ))}
        </div>
      ) : !appointments.length ? (
        <div className="px-6 py-8 text-center text-app3 text-sm">Sin historial de consultas</div>
      ) : (
        <div className="divide-y divide-app">
          {appointments.map((appt: any) => {
            const dt = new Date(appt.starts_at)
            const fecha = dt.toLocaleDateString('es-AR', {
              day: 'numeric', month: 'short',
              timeZone: 'America/Argentina/Buenos_Aires',
            })
            const hora = dt.toLocaleTimeString('es-AR', {
              hour: '2-digit', minute: '2-digit',
              timeZone: 'America/Argentina/Buenos_Aires',
            })
            const isEditing = editingId === appt.id

            return (
              <div key={appt.id} className="px-5 py-3.5">
                <div className="flex items-start justify-between gap-3">
                  {/* Contenido principal */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-app leading-tight">{appt.appointment_type ?? 'Consulta'}</span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[11px] text-app3">{fecha}</span>
                      <span className="text-app3 text-[11px]">·</span>
                      <span className="text-[11px] text-app3">{hora}</span>
                    </div>
                  </div>

                  {/* Badge + editar */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-md border ${statusStyle(appt.status)}`}>
                      {statusLabel(appt.status)}
                    </span>
                    {!isEditing && (
                      <button
                        onClick={() => openEdit(appt)}
                        className="text-app3 hover:text-app transition-colors p-1 rounded-lg hover:bg-surface2 cursor-pointer"
                        title="Editar"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                      </button>
                    )}
                  </div>
                </div>

                {/* Notas / motivo (vista normal) */}
                {!isEditing && (
                  <>
                    {appt.chief_complaint && (
                      <div className="mt-2 text-xs text-app2 bg-surface2 rounded-lg px-3 py-1.5 border-l-2 border-amber-400/50">
                        {appt.chief_complaint}
                      </div>
                    )}
                    {appt.clinical_notes ? (
                      <div className="mt-1.5 text-xs text-app2 bg-surface2 rounded-lg px-3 py-1.5 border-l-2 border-[#00C4BC]/40 whitespace-pre-wrap">
                        {appt.clinical_notes}
                      </div>
                    ) : appt.status === 'completed' ? (
                      <div className="mt-1.5 text-xs text-app3 italic">Sin notas</div>
                    ) : null}
                  </>
                )}

                {/* Formulario de edición inline */}
                {isEditing && (
                  <div className="mt-3 space-y-2.5">
                    {/* Estado */}
                    <div>
                      <label className="block text-xs font-semibold text-app3 uppercase tracking-wider mb-1.5">Estado</label>
                      <div className="flex flex-wrap gap-1.5">
                        {STATUS_OPTIONS.map(opt => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setEditStatus(opt.value)}
                            className={`px-3 py-1 text-xs font-semibold rounded-lg border transition-all ${
                              editStatus === opt.value
                                ? statusStyle(opt.value) + ' ring-1 ring-current'
                                : 'bg-surface2 border-app text-app3 hover:border-app2'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Notas clínicas */}
                    <div>
                      <label className="block text-xs font-semibold text-app3 uppercase tracking-wider mb-1.5">Notas clínicas</label>
                      <textarea
                        value={editNotes}
                        onChange={e => setEditNotes(e.target.value)}
                        rows={3}
                        placeholder="Descripción del tratamiento, observaciones..."
                        className="w-full bg-surface2 border border-app rounded-lg px-3 py-2 text-app text-xs focus:outline-none focus:border-[#00C4BC] resize-none"
                      />
                    </div>

                    {/* Acciones */}
                    <div className="flex gap-2">
                      <button
                        onClick={cancelEdit}
                        disabled={saving}
                        className="flex-1 bg-surface2 hover:bg-surface3 text-app text-xs font-semibold py-2 rounded-lg transition-colors disabled:opacity-50"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={() => saveEdit(appt.id)}
                        disabled={saving}
                        className="flex-1 bg-[#00C4BC] hover:bg-[#00aaa3] active:scale-95 text-white text-xs font-bold py-2 rounded-lg transition-all disabled:opacity-50 shadow-sm shadow-[#00C4BC]/20"
                      >
                        {saving ? 'Guardando...' : 'Guardar'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          {totalPages > 1 && (
            <div className="px-5 py-3 border-t border-app flex items-center justify-between">
              <span className="text-xs text-app3">
                {total} consultas · pág. {page}/{totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 text-xs font-semibold bg-surface2 border border-app rounded-lg disabled:opacity-40 hover:bg-surface3 transition-colors active:scale-95 cursor-pointer disabled:cursor-default"
                >←</button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1.5 text-xs font-semibold bg-surface2 border border-app rounded-lg disabled:opacity-40 hover:bg-surface3 transition-colors active:scale-95 cursor-pointer disabled:cursor-default"
                >→</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
