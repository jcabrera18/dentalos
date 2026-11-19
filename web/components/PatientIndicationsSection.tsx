'use client'

// Ficha del paciente: indicaciones enviadas (historial) + "Enviar indicaciones".
// Visible con el permiso `indications.send` (el Administrativo lo tiene por defecto).

import { useState } from 'react'
import { ClipboardList, Plus, Send } from 'lucide-react'
import { usePatientIndications, type PatientIndication } from '@/lib/queries'
import { IndicationsModal } from '@/components/IndicationsModal'

const PREVIEW_COUNT = 3

export function PatientIndicationsSection({ patientId, patientName }: { patientId: string; patientName: string }) {
  const { data: rows = [], isPending } = usePatientIndications(patientId)
  const [modal, setModal] = useState<{ resend?: PatientIndication } | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)

  const shown = expanded ? rows : rows.slice(0, PREVIEW_COUNT)

  return (
    <div className="bg-surface border border-app rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-app flex items-center justify-between gap-3">
        <h3 className="font-semibold flex items-center gap-2">
          <ClipboardList size={16} className="text-[#00C4BC]" /> Indicaciones
        </h3>
        <button onClick={() => setModal({})}
          className="flex items-center gap-1.5 bg-[#00C4BC] hover:bg-[#00aaa3] text-white text-xs font-bold px-3 py-2 rounded-lg transition-all active:scale-95">
          <Plus size={14} /> Enviar indicaciones
        </button>
      </div>

      {isPending ? (
        <div className="px-6 py-5 animate-pulse space-y-2">
          <div className="h-3 bg-surface2 rounded w-2/3" />
          <div className="h-3 bg-surface2 rounded w-1/2" />
        </div>
      ) : rows.length === 0 ? (
        <p className="px-6 py-5 text-sm text-app3">
          Todavía no se enviaron indicaciones a este paciente.
        </p>
      ) : (
        <div className="divide-y divide-app">
          {shown.map((r) => (
            <div key={r.id} className="px-6 py-3">
              <div className="flex items-center justify-between gap-3">
                <button onClick={() => setOpenId(openId === r.id ? null : r.id)} className="min-w-0 text-left">
                  <div className="font-medium text-sm text-app truncate">{r.title}</div>
                  <div className="text-xs text-app3 mt-0.5">
                    {new Date(r.created_at).toLocaleDateString('es-AR', {
                      day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/Argentina/Buenos_Aires',
                    })}
                    {r.professional && ` · ${r.professional.first_name} ${r.professional.last_name}`}
                    {` · ${r.items.length} indicaciones`}
                  </div>
                </button>
                <button onClick={() => setModal({ resend: r })}
                  className="flex items-center gap-1 text-xs font-semibold text-app2 hover:text-[#00C4BC] bg-surface2 hover:bg-surface3 px-2.5 py-1.5 rounded-lg flex-shrink-0">
                  <Send size={12} /> Reenviar
                </button>
              </div>
              {openId === r.id && (
                <ul className="mt-2 ml-1 space-y-1 text-xs text-app2 list-disc list-inside">
                  {r.items.map((it, i) => <li key={i}>{it.replace(/\*\*(.+?)\*\*/g, '$1')}</li>)}
                </ul>
              )}
            </div>
          ))}
          {rows.length > PREVIEW_COUNT && (
            <button onClick={() => setExpanded(!expanded)}
              className="w-full px-6 py-2.5 text-xs font-semibold text-app3 hover:text-app2">
              {expanded ? 'Ver menos' : `Ver todas (${rows.length})`}
            </button>
          )}
        </div>
      )}

      {modal && (
        <IndicationsModal
          patientId={patientId}
          patientName={patientName}
          professionalId={modal.resend?.professional_id ?? null}
          appointmentId={modal.resend?.appointment_id ?? null}
          initial={modal.resend ? {
            title: modal.resend.title,
            items: modal.resend.items,
            footer_note: modal.resend.footer_note,
            template_id: modal.resend.template_id,
          } : null}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
