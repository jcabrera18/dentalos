'use client'

import { Users } from 'lucide-react'
import { usePatientContact } from '@/lib/queries'
import { relationshipLabel } from '@/lib/patientContact'

// Línea compacta con el contacto/tutor del paciente para el detalle de un turno.
// No renderiza nada si el paciente no tiene contacto cargado.
export function AppointmentContactLine({ patientId }: { patientId: string | null | undefined }) {
  const { data } = usePatientContact(patientId)
  if (!data || !(data.contact_name || data.contact_phone)) return null

  const rel = relationshipLabel(data.contact_relationship)
  return (
    <div className="mt-3 bg-surface2 rounded-xl px-3 py-2.5 flex items-start gap-2 text-sm">
      <Users size={14} className="text-[#00C4BC] mt-0.5 flex-shrink-0" />
      <div className="min-w-0">
        <div className="text-app2">
          <span className="text-app3">{data.is_minor ? 'Tutor:' : 'Contacto:'}</span>{' '}
          <span className="font-medium text-app">{data.contact_name || '—'}</span>
          {rel && <span className="text-app3"> ({rel})</span>}
        </div>
        {data.contact_phone && (
          <a
            href={`https://wa.me/${data.contact_phone.replace(/\D/g, '')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[#00C4BC] hover:underline"
          >
            {data.contact_phone}
            {data.reminders_to_contact ? ' · recibe los recordatorios' : ''}
          </a>
        )}
      </div>
    </div>
  )
}
