'use client'

import { useState } from 'react'
import { ChevronDown, Users } from 'lucide-react'
import {
  CONTACT_RELATIONSHIPS,
  GUARDIAN_RELATIONSHIPS,
  contactRemindersNeedAuthorization,
  isMinorAge,
  type ContactForm,
} from '@/lib/patientContact'

const INPUT = 'w-full bg-surface2 border border-app rounded-lg px-3 py-2.5 text-app text-sm focus:outline-none focus:border-[#00C4BC]'
const LABEL = 'block text-xs font-medium text-app3 mb-1 uppercase tracking-wider'

// Sección "Contacto / responsable" de los formularios de alta y edición de paciente.
// Si el paciente es menor, se muestra abierta y con los defaults de tutor
// (representante legal + recibe recordatorios) mientras no se toquen a mano.
// Desde los 16 años (o sin fecha de nacimiento) los avisos al contacto exigen que el
// paciente lo autorice (Ley 26.529 art. 4): sin esa constancia la API los manda al paciente.
export function PatientContactFields({ value, onChange, age }: {
  value: ContactForm
  onChange: (patch: Partial<ContactForm>) => void
  age: number | null
}) {
  const isMinor = isMinorAge(age)
  const needsAuthorization = contactRemindersNeedAuthorization(age)
  const filled = Boolean(value.contact_name.trim() || value.contact_phone.trim())
  const [open, setOpen] = useState(filled || isMinor)
  // Flags que el usuario tocó a mano: no los pisamos con defaults.
  const [touched, setTouched] = useState({ guardian: filled, reminders: filled })
  const expanded = open || isMinor

  function setRelationship(rel: string) {
    const patch: Partial<ContactForm> = { contact_relationship: rel }
    if (isMinor && !touched.guardian) patch.contact_is_legal_guardian = GUARDIAN_RELATIONSHIPS.includes(rel)
    onChange(patch)
  }

  function setPhone(phone: string) {
    // Autorización dada para otro número: hay que volver a confirmarla (la API también la borra).
    const patch: Partial<ContactForm> = { contact_phone: phone, contact_reminders_authorized: false }
    if (isMinor && !touched.reminders) patch.contact_receives_reminders = phone.trim() !== ''
    onChange(patch)
  }

  return (
    <div className="border border-app rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 bg-surface2/60 hover:bg-surface2 transition-colors"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-app">
          <Users size={15} className="text-[#00C4BC]" />
          {isMinor ? 'Tutor / responsable' : 'Contacto / responsable'}
          <span className="text-xs font-normal text-app3">(opcional)</span>
        </span>
        {!isMinor && <ChevronDown size={16} className={`text-app3 transition-transform ${expanded ? 'rotate-180' : ''}`} />}
      </button>

      {expanded && (
        <div className="p-4 space-y-3">
          {isMinor && !filled && (
            <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
              Paciente menor de edad: te recomendamos cargar a su madre, padre o tutor.
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Nombre y apellido</label>
              <input value={value.contact_name} onChange={e => onChange({ contact_name: e.target.value })}
                placeholder="María Pérez" className={INPUT} />
            </div>
            <div>
              <label className={LABEL}>Vínculo</label>
              <select value={value.contact_relationship} onChange={e => setRelationship(e.target.value)} className={INPUT}>
                <option value="">Seleccionar…</option>
                {CONTACT_RELATIONSHIPS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>

            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Teléfono (WhatsApp)</label>
              <input value={value.contact_phone} onChange={e => setPhone(e.target.value)}
                type="tel" placeholder="+54 11 ..." className={INPUT} />
            </div>
            <div>
              <label className={LABEL}>Email</label>
              <input value={value.contact_email} onChange={e => onChange({ contact_email: e.target.value })}
                type="email" className={INPUT} />
            </div>
          </div>

          <div className="grid grid-cols-[110px_1fr] gap-3">
            <div>
              <label className={LABEL}>Documento</label>
              <select value={value.contact_document_type} onChange={e => onChange({ contact_document_type: e.target.value })} className={INPUT}>
                <option value="DNI">DNI</option>
                <option value="CUIT">CUIT</option>
                <option value="Pasaporte">Pasaporte</option>
              </select>

            </div>
            <div>
              <label className={LABEL}>Número</label>
              <input value={value.contact_document_number} onChange={e => onChange({ contact_document_number: e.target.value })}
                inputMode="numeric" className={INPUT} />
            </div>
          </div>

          <div className="space-y-2 pt-1">
            <label className="flex items-start gap-2.5 text-sm text-app2 cursor-pointer">
              <input type="checkbox" checked={value.contact_receives_reminders}
                disabled={!value.contact_phone.trim()}
                onChange={e => { setTouched(t => ({ ...t, reminders: true })); onChange({ contact_receives_reminders: e.target.checked }) }}
                className="mt-0.5 accent-[#00C4BC]" />
              <span>
                Enviarle los recordatorios de WhatsApp
                <span className="block text-xs text-app3">Los avisos de turnos le llegan a este contacto en lugar del paciente.</span>
              </span>
            </label>
            {value.contact_receives_reminders && needsAuthorization && (
              <label className="flex items-start gap-2.5 text-sm text-app2 cursor-pointer ml-6">
                <input type="checkbox" checked={value.contact_reminders_authorized}
                  onChange={e => onChange({ contact_reminders_authorized: e.target.checked })}
                  className="mt-0.5 accent-[#00C4BC]" />
                <span>
                  El paciente autorizó que sus avisos se envíen a este contacto
                  <span className={`block text-xs ${value.contact_reminders_authorized ? 'text-app3' : 'text-amber-600 dark:text-amber-400'}`}>
                    {age === null
                      ? 'Sin fecha de nacimiento cargada se pide la autorización del paciente. '
                      : 'Desde los 16 años, informar a un tercero sobre sus turnos requiere su autorización (Ley 26.529, art. 4). '}
                    Sin ella, los avisos siguen yendo al paciente.
                  </span>
                </span>
              </label>
            )}
            <label className="flex items-start gap-2.5 text-sm text-app2 cursor-pointer">
              <input type="checkbox" checked={value.contact_is_legal_guardian}
                onChange={e => { setTouched(t => ({ ...t, guardian: true })); onChange({ contact_is_legal_guardian: e.target.checked }) }}
                className="mt-0.5 accent-[#00C4BC]" />
              <span>
                Es representante legal
                <span className="block text-xs text-app3">Puede firmar consentimientos en nombre del paciente.</span>
              </span>
            </label>
          </div>

          <div>
            <label className={LABEL}>Notas</label>
            <input value={value.contact_notes} onChange={e => onChange({ contact_notes: e.target.value })}
              placeholder="Ej.: llamar después de las 18 h" className={INPUT} />
          </div>
        </div>
      )}
    </div>
  )
}
