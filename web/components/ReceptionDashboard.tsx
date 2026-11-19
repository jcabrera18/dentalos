'use client'

// Secciones del dashboard de recepción (rol Administrativo): vista de toda la
// clínica. Sin datos clínicos: solo agenda, estado de turnos y contacto.

import { useState } from 'react'
import { useCalendar, useUpdateAppointmentStatus, usePatientContact } from '@/lib/queries'
import { professionalColor, professionalShortName } from '@/lib/professionalColor'
import { Clock, UserCheck, CheckCircle, MessageCircle, CalendarCheck, AlertCircle } from 'lucide-react'

const AR_TZ = 'America/Argentina/Buenos_Aires'

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: AR_TZ })
}

function arDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: AR_TZ })
}

function addDaysStr(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Misma normalización que el worker de notificaciones (API): wa.me necesita 549 + área + número.
function waPhone(raw: string | null | undefined): string | null {
  const digits = String(raw ?? '').replace(/\D/g, '')
  if (!digits) return null
  if (digits.startsWith('549')) return digits
  if (digits.startsWith('54')) return `549${digits.slice(2)}`
  if (digits.startsWith('0')) return `549${digits.slice(1)}`
  return `549${digits}`
}

/** Chip con el color y nombre corto del profesional del turno. */
export function ProfChip({ appt, className = '' }: { appt: any; className?: string }) {
  if (!appt?.professional_name) return null
  return (
    <span className={`inline-flex items-center gap-1 min-w-0 ${className}`}>
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: professionalColor(appt) }} />
      <span className="truncate">{professionalShortName(appt.professional_name)}</span>
    </span>
  )
}

// ── Sala de espera / en atención ─────────────────────────
export function WaitingRoom({ agenda, now, onAttended }: { agenda: any[]; now: number; onAttended: (appt: any) => void }) {
  const inProgress = agenda.filter(a => a.status === 'in_progress')
  // Próximos a llegar: turnos activos de la próxima hora, más los demorados de
  // la última media hora (los más viejos sin marcar no se arrastran todo el día).
  const arriving = agenda
    .filter(a => (a.status === 'pending' || a.status === 'confirmed'))
    .filter(a => {
      const diff = new Date(a.starts_at).getTime() - now
      return diff <= 60 * 60000 && diff >= -30 * 60000
    })
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())
    .slice(0, 6)

  if (inProgress.length === 0 && arriving.length === 0) return null

  return (
    <div className="grid md:grid-cols-2 gap-3 mb-5">
      <div className="bg-surface border-2 border-violet-400/30 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className={`w-2 h-2 rounded-full bg-violet-400 ${inProgress.length ? 'animate-pulse' : 'opacity-40'}`} />
          <span className="text-xs font-bold text-violet-400 uppercase tracking-wider">En atención ahora</span>
          <span className="ml-auto text-xs text-app3">{inProgress.length}</span>
        </div>
        {inProgress.length === 0 ? (
          <div className="text-sm text-app3 py-2">Nadie en atención</div>
        ) : (
          <div className="space-y-2">
            {inProgress.map(a => (
              <div key={a.id} className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-app truncate">{a.patient_name}</div>
                  <div className="flex items-center gap-2 text-xs text-app3 min-w-0">
                    <ProfChip appt={a} />
                    <span className="flex-shrink-0">· turno {fmtTime(a.starts_at)}</span>
                  </div>
                </div>
                <button
                  onClick={() => onAttended(a)}
                  className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-[#00C4BC] text-white hover:bg-[#00aaa3] transition-all active:scale-95 cursor-pointer flex-shrink-0"
                >
                  <CheckCircle size={13} /> Atendido
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-surface border border-app rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Clock size={13} className="text-[#00C4BC]" />
          <span className="text-xs font-bold text-app2 uppercase tracking-wider">Por llegar (próxima hora)</span>
          <span className="ml-auto text-xs text-app3">{arriving.length}</span>
        </div>
        {arriving.length === 0 ? (
          <div className="text-sm text-app3 py-2">Nadie en la próxima hora</div>
        ) : (
          <div className="space-y-2">
            {arriving.map(a => {
              const late = new Date(a.starts_at).getTime() < now
              return (
                <div key={a.id} className="flex items-center gap-3">
                  <div className={`tabular-nums text-sm font-semibold w-11 flex-shrink-0 ${late ? 'text-red-400' : 'text-app2'}`}>
                    {fmtTime(a.starts_at)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-app truncate">{a.patient_name}</div>
                    <ProfChip appt={a} className="text-xs text-app3" />
                  </div>
                  <span className={`text-[11px] font-semibold flex-shrink-0 ${a.status === 'confirmed' ? 'text-[#00C4BC]' : 'text-amber-400'}`}>
                    {late ? 'Demorado' : a.status === 'confirmed' ? 'Confirmado' : 'Sin confirmar'}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Resumen por profesional ──────────────────────────────
export function ProfessionalSummary({ agenda, professionals, now, selected, onSelect }: {
  agenda: any[]
  professionals: any[]
  now: number
  selected: string
  onSelect: (id: string) => void
}) {
  // Profesionales de la clínica + los que tengan turnos hoy y no estén en la lista.
  const rows = new Map<string, { id: string; name: string; color: string }>()
  for (const p of professionals) {
    rows.set(p.id, { id: p.id, name: `${p.first_name} ${p.last_name}`, color: professionalColor(p) })
  }
  for (const a of agenda) {
    if (!rows.has(a.professional_id)) {
      rows.set(a.professional_id, { id: a.professional_id, name: a.professional_name ?? 'Profesional', color: professionalColor(a) })
    }
  }
  if (rows.size <= 1) return null

  return (
    <div className="mb-5">
      <h3 className="text-xs font-semibold text-app3 uppercase tracking-wider mb-2">Hoy por profesional</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {[...rows.values()].map(p => {
          const appts = agenda.filter(a => a.professional_id === p.id)
          const done = appts.filter(a => a.status === 'completed').length
          const toConfirm = appts.filter(a => a.status === 'pending').length
          const current = appts.find(a => a.status === 'in_progress')
          const next = appts
            .filter(a => (a.status === 'pending' || a.status === 'confirmed') && new Date(a.starts_at).getTime() >= now - 15 * 60000)
            .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())[0]
          const isSelected = selected === p.id
          return (
            <button
              key={p.id}
              onClick={() => onSelect(isSelected ? '' : p.id)}
              className={`text-left bg-surface border rounded-xl p-4 transition-colors cursor-pointer ${isSelected ? 'border-[#00C4BC]' : 'border-app hover:bg-surface2/50'}`}
              style={{ borderLeftWidth: 3, borderLeftColor: p.color }}
            >
              <div className="font-semibold text-app truncate">{p.name}</div>
              {appts.length === 0 ? (
                <div className="text-xs text-app3 mt-1">Sin turnos hoy</div>
              ) : (
                <>
                  <div className="flex items-center gap-3 mt-1 text-xs text-app2">
                    <span><b className="text-app">{appts.length}</b> turnos</span>
                    <span><b className="text-app">{done}</b> atendidos</span>
                    {toConfirm > 0 && <span className="text-amber-400"><b>{toConfirm}</b> sin confirmar</span>}
                  </div>
                  <div className="text-xs text-app3 mt-1.5 truncate">
                    {current
                      ? <span className="text-violet-400">Atendiendo a {current.patient_name}</span>
                      : next
                        ? <>Próximo: {fmtTime(next.starts_at)} · {next.patient_name}</>
                        : 'Sin más turnos hoy'}
                  </div>
                </>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Turnos de mañana para confirmar ──────────────────────
export function TomorrowToConfirm({ clinicName }: { clinicName: string }) {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: AR_TZ })
  const tomorrow = addDaysStr(today, 1)
  // El endpoint corta los días en UTC: se pide hasta pasado mañana y se filtra
  // por fecha argentina para no perder los turnos de la noche.
  const { data, isPending, isError, refetch } = useCalendar(tomorrow, addDaysStr(today, 2))
  const updateStatus = useUpdateAppointmentStatus()
  // Turnos confirmados desde acá: se ocultan al instante (el calendario no tiene
  // update optimista) y se reponen si el PATCH falla.
  const [confirming, setConfirming] = useState<Set<string>>(() => new Set())

  function confirm(id: string) {
    setConfirming(prev => new Set(prev).add(id))
    updateStatus.mutate({ id, status: 'confirmed' }, {
      onError: () => setConfirming(prev => { const n = new Set(prev); n.delete(id); return n }),
    })
  }

  const appts = (data?.appointments ?? [])
    .filter((a: any) => arDate(a.starts_at) === tomorrow && a.status !== 'cancelled')
  const pending = appts
    .filter((a: any) => a.status === 'pending' && !confirming.has(a.id))
    .sort((a: any, b: any) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())

  const tomorrowLabel = new Date(tomorrow + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="bg-surface border border-app rounded-xl overflow-hidden mb-5">
      <div className="px-5 py-4 border-b border-app flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold">Para confirmar mañana</h3>
          <div className="text-xs text-app3 capitalize">{tomorrowLabel}</div>
        </div>
        {!isPending && !isError && (
          <span className="text-sm text-app3 flex-shrink-0">
            {pending.length} de {appts.length} sin confirmar
          </span>
        )}
      </div>

      {isPending ? (
        <div className="px-5 py-6 text-sm text-app3">Cargando…</div>
      ) : isError ? (
        <div className="px-5 py-6 flex items-center gap-2 text-sm text-red-400">
          <AlertCircle size={16} className="flex-shrink-0" />
          No se pudieron cargar los turnos de mañana.
          <button onClick={() => refetch()} className="underline cursor-pointer">Reintentar</button>
        </div>
      ) : pending.length === 0 ? (
        <div className="px-5 py-6 flex items-center gap-2 text-sm text-app3">
          <CalendarCheck size={16} className="text-[#00C4BC]" />
          {appts.length === 0 ? 'No hay turnos para mañana' : 'Todos los turnos de mañana están confirmados'}
        </div>
      ) : (
        <div className="divide-y divide-app">
          {pending.map((a: any) => (
            <PendingRow
              key={a.id}
              appt={a}
              clinicName={clinicName}
              tomorrowLabel={tomorrowLabel}
              onConfirm={() => confirm(a.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function PendingRow({ appt: a, clinicName, tomorrowLabel, onConfirm }: {
  appt: any
  clinicName: string
  tomorrowLabel: string
  onConfirm: () => void
}) {
  // Menores de 16 / contacto autorizado: el recordatorio va al tutor (lo resuelve la API).
  const { data: contact, isPending: contactPending } = usePatientContact(a.patient_id)
  const toContact = Boolean(contact?.reminders_to_contact && contact.contact_phone)
  const phone = waPhone(toContact ? contact!.contact_phone : a.patient_phone)

  let wa: string | null = null
  if (phone && !(a.patient_id && contactPending)) {
    const patientFirst = String(a.patient_name ?? '').split(' ')[0]
    const greet = toContact ? String(contact!.contact_name ?? '').split(' ')[0] : patientFirst
    const whose = toContact ? `el turno de ${patientFirst}` : 'tu turno'
    const prof = a.professional_name ? ` con ${a.professional_name}` : ''
    const where = clinicName ? ` en ${clinicName}` : ''
    const msg = `Hola${greet ? ` ${greet}` : ''}, te recordamos ${whose} de mañana ${tomorrowLabel} a las ${fmtTime(a.starts_at)}${prof}${where}. ¿Nos confirmás la asistencia?`
    wa = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`
  }

  return (
    <div className="px-5 py-3 flex items-center gap-3">
      <div className="tabular-nums text-sm font-medium text-app2 w-11 flex-shrink-0">{fmtTime(a.starts_at)}</div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-app truncate">{a.patient_name}</div>
        <ProfChip appt={a} className="text-xs text-app3" />
      </div>
      {wa && (
        <a
          href={wa}
          target="_blank"
          rel="noopener noreferrer"
          title={toContact ? `A ${contact!.contact_name ?? 'contacto'} (tutor/contacto)` : undefined}
          className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-surface2 text-app2 hover:bg-[#25D366]/15 hover:text-[#1da851] transition-all active:scale-95 flex-shrink-0"
        >
          <MessageCircle size={13} /> <span className="hidden sm:inline">{toContact ? 'WhatsApp tutor' : 'WhatsApp'}</span>
        </a>
      )}
      <button
        onClick={onConfirm}
        className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-[#E6F8F1] text-[#00C4BC] hover:bg-[#00C4BC] hover:text-white transition-all active:scale-95 cursor-pointer flex-shrink-0"
      >
        <UserCheck size={13} /> <span className="hidden sm:inline">Confirmar</span>
      </button>
    </div>
  )
}
