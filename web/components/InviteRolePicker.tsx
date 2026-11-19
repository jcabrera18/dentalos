'use client'

import { Stethoscope, ClipboardList } from 'lucide-react'

// Selector de rol al invitar al equipo (sidebar y Configuración).
export function InviteRolePicker({
  onPick,
  onClose,
}: {
  onPick: (role: 'professional' | 'receptionist') => void
  onClose: () => void
}) {
  const options = [
    {
      role: 'professional' as const,
      icon: Stethoscope,
      title: 'Profesional',
      desc: 'Atiende pacientes: agenda propia, historia clínica y acceso completo.',
    },
    {
      role: 'receptionist' as const,
      icon: ClipboardList,
      title: 'Administrativo/a',
      desc: 'Gestiona agenda, cobros y facturación. Sin acceso a información clínica.',
    },
  ]
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface border border-app rounded-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
        <h3 className="font-bold text-lg text-app mb-1">Invitar al equipo</h3>
        <p className="text-app3 text-sm mb-4">¿Qué tipo de usuario querés invitar? Ocupa un lugar de tu plan.</p>
        <div className="space-y-2 mb-4">
          {options.map(o => {
            const Icon = o.icon
            return (
              <button
                key={o.role}
                onClick={() => onPick(o.role)}
                className="w-full flex items-start gap-3 text-left p-3 rounded-xl border border-app hover:border-[#00C4BC] hover:bg-[#E6F8F1]/50 dark:hover:bg-[#00C4BC]/10 transition-all cursor-pointer"
              >
                <Icon size={20} className="text-[#00C4BC] shrink-0 mt-0.5" />
                <span>
                  <span className="block text-sm font-semibold text-app">{o.title}</span>
                  <span className="block text-xs text-app3 mt-0.5">{o.desc}</span>
                </span>
              </button>
            )
          })}
        </div>
        <button
          onClick={onClose}
          className="w-full bg-surface2 hover:bg-surface3 text-app font-semibold py-2.5 rounded-xl transition-all text-sm"
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}
