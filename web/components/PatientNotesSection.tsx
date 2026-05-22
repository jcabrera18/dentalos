'use client'
import { useState } from 'react'
import { apiFetch } from '@/lib/api'

export function PatientNotesSection({ patientId, token, initialNotes }: {
  patientId: string
  token: string
  initialNotes: string
}) {
  const [notes, setNotes] = useState(initialNotes)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    await apiFetch(`/patients/${patientId}`, {
      method: 'PATCH',
      token,
      body: JSON.stringify({ notes }),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="bg-surface border border-app rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-app flex items-center justify-between">
        <h3 className="text-sm font-semibold text-app">Notas</h3>
        <button
          onClick={handleSave}
          disabled={saving}
          className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all active:scale-95 cursor-pointer ${saved
            ? 'bg-[#E6F8F1] dark:bg-[#00C4BC]/15 text-[#00C4BC]'
            : 'bg-[#00C4BC] hover:bg-[#00aaa3] text-white disabled:opacity-50 shadow-sm shadow-[#00C4BC]/20'
          }`}
        >
          {saving ? 'Guardando...' : saved ? '✓ Guardado' : 'Guardar'}
        </button>
      </div>
      <div className="p-3">
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={5}
          placeholder="Observaciones generales, indicaciones especiales..."
          className="w-full bg-surface2 border border-app rounded-xl px-3 py-2.5 text-app text-sm focus:outline-none focus:border-[#00C4BC] resize-none"
        />
      </div>
    </div>
  )
}
