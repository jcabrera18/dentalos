'use client'

// Configuración → plantillas de indicaciones de la clínica (alta, edición,
// activar/desactivar, borrar). Solo usuarios con acceso clínico: la API exige
// 'clinical' para escribir plantillas. Enviarlas es otro permiso (indications.send).

import { useState } from 'react'
import { ClipboardList, Plus, Pencil, Trash2, Loader2 } from 'lucide-react'
import {
  useIndicationTemplates, useSaveIndicationTemplate, useDeleteIndicationTemplate,
  type IndicationTemplate, type IndicationTemplateInput,
} from '@/lib/queries'
import { DISCIPLINES, DISCIPLINE_LABELS, consultationTypesFor, normalizeDiscipline, type Discipline } from '@/lib/capabilities'

type Draft = IndicationTemplateInput & { id?: string; itemsText: string }

const emptyDraft = (discipline: Discipline): Draft => ({
  discipline, name: '', title: 'Indicaciones', items: [], itemsText: '',
  footer_note: '', appointment_types: [], is_active: true,
})

export function IndicationTemplatesSection({ myDiscipline }: { myDiscipline: string | null | undefined }) {
  const mine = normalizeDiscipline(myDiscipline)
  const { data: templates = [], isPending } = useIndicationTemplates()
  const save = useSaveIndicationTemplate()
  const remove = useDeleteIndicationTemplate()

  const [filter, setFilter] = useState<Discipline>(mine)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<IndicationTemplate | null>(null)
  const [error, setError] = useState('')

  const disciplinesInUse = DISCIPLINES.filter((d) => d === mine || templates.some((t) => normalizeDiscipline(t.discipline) === d))
  const list = templates.filter((t) => normalizeDiscipline(t.discipline) === filter)

  function edit(t: IndicationTemplate) {
    setError('')
    setDraft({ ...t, discipline: normalizeDiscipline(t.discipline), footer_note: t.footer_note ?? '', itemsText: t.items.join('\n') })
  }

  async function handleSave() {
    if (!draft) return
    const items = draft.itemsText.split('\n').map((s) => s.trim()).filter(Boolean)
    if (!draft.name.trim() || !draft.title.trim()) return setError('Completá el nombre y el título.')
    if (items.length === 0) return setError('Agregá al menos una indicación.')
    if (items.length > 40) return setError('Máximo 40 indicaciones por plantilla.')
    if (items.some((i) => i.length > 500)) return setError('Cada indicación puede tener hasta 500 caracteres.')
    setError('')
    try {
      await save.mutateAsync({
        id: draft.id,
        discipline: draft.discipline,
        name: draft.name.trim(),
        title: draft.title.trim(),
        items,
        footer_note: draft.footer_note?.trim() || null,
        appointment_types: draft.appointment_types,
        is_active: draft.is_active,
      })
      setFilter(draft.discipline as Discipline)
      setDraft(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la plantilla')
    }
  }

  async function toggleActive(t: IndicationTemplate) {
    await save.mutateAsync({ id: t.id, is_active: !t.is_active }).catch(() => {})
  }

  const input = 'w-full px-4 py-2.5 rounded-xl bg-surface2 border border-app text-app text-sm focus:outline-none focus:border-[#00C4BC]'

  return (
    <div className="bg-surface border border-app rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-app flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-app flex items-center gap-2">
            <ClipboardList size={16} className="text-[#00C4BC]" /> Indicaciones al paciente
          </h2>
          <p className="text-xs text-app3 mt-1">
            Plantillas que se envían como imagen por WhatsApp al terminar un turno. Se sugieren según el tipo de turno.
          </p>
        </div>
        {!draft && (
          <button onClick={() => { setError(''); setDraft(emptyDraft(filter)) }}
            className="flex items-center gap-1 text-xs font-bold text-[#00C4BC] bg-[#E6F8F1] dark:bg-[#00C4BC]/10 px-2.5 py-1.5 rounded-lg flex-shrink-0">
            <Plus size={13} /> Nueva
          </button>
        )}
      </div>

      {draft ? (
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-app2 mb-1">Nombre interno</label>
              <input value={draft.name} maxLength={100} onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="Post extracción" className={input} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-app2 mb-1">Especialidad</label>
              <select value={draft.discipline}
                onChange={(e) => setDraft({ ...draft, discipline: e.target.value as Discipline, appointment_types: [] })}
                className={input}>
                {DISCIPLINES.map((d) => <option key={d} value={d}>{DISCIPLINE_LABELS[d]}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-app2 mb-1">Título en la imagen</label>
            <input value={draft.title} maxLength={120} onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder="Indicaciones Post Quirúrgicas" className={input} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-app2 mb-1">
              Indicaciones <span className="font-normal text-app3">— una por línea; **texto** para negrita</span>
            </label>
            <textarea value={draft.itemsText} rows={9} onChange={(e) => setDraft({ ...draft, itemsText: e.target.value })}
              placeholder={'No realizar actividad física durante las primeras 48 hs.\n**NO FUMAR**'}
              className={`${input} resize-y font-mono text-[13px] leading-relaxed`} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-app2 mb-1">Aviso final (opcional)</label>
            <input value={draft.footer_note ?? ''} maxLength={300} onChange={(e) => setDraft({ ...draft, footer_note: e.target.value })}
              placeholder="Ante sangrado abundante o fiebre, comunicate con el consultorio." className={input} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-app2 mb-1.5">Sugerir para turnos de tipo</label>
            <div className="flex flex-wrap gap-1.5">
              {consultationTypesFor(draft.discipline as Discipline).map((type) => {
                const on = draft.appointment_types.includes(type)
                return (
                  <button key={type} type="button"
                    onClick={() => setDraft({
                      ...draft,
                      appointment_types: on ? draft.appointment_types.filter((a) => a !== type) : [...draft.appointment_types, type],
                    })}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                      on ? 'bg-[#00C4BC]/15 border-[#00C4BC]/40 text-[#00C4BC]' : 'bg-surface2 border-app text-app3 hover:text-app2'}`}>
                    {type}
                  </button>
                )
              })}
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-app2">
            <input type="checkbox" checked={draft.is_active} className="w-4 h-4 accent-[#00C4BC]"
              onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })} />
            Activa (aparece al enviar indicaciones)
          </label>

          {error && <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-600 dark:text-red-400 text-sm">{error}</div>}

          <div className="flex justify-end gap-2 pt-1">
            <button onClick={() => setDraft(null)}
              className="px-4 py-2.5 rounded-xl bg-surface2 hover:bg-surface3 text-app2 text-sm font-semibold">Cancelar</button>
            <button onClick={handleSave} disabled={save.isPending}
              className="px-5 py-2.5 rounded-xl bg-[#00C4BC] hover:bg-[#00aaa3] disabled:opacity-50 text-white text-sm font-semibold flex items-center gap-2">
              {save.isPending && <Loader2 size={14} className="animate-spin" />} Guardar plantilla
            </button>
          </div>
        </div>
      ) : (
        <div>
          {disciplinesInUse.length > 1 && (
            <div className="px-5 pt-4 flex flex-wrap gap-1.5">
              {disciplinesInUse.map((d) => (
                <button key={d} onClick={() => setFilter(d)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${
                    filter === d ? 'bg-[#00C4BC]/15 border-[#00C4BC]/40 text-[#00C4BC]' : 'bg-surface2 border-app text-app3'}`}>
                  {DISCIPLINE_LABELS[d]}
                </button>
              ))}
            </div>
          )}
          {isPending ? (
            <div className="p-5 flex justify-center text-app3"><Loader2 size={18} className="animate-spin" /></div>
          ) : list.length === 0 ? (
            <p className="p-5 text-sm text-app3">No hay plantillas para {DISCIPLINE_LABELS[filter]}. Creá la primera con “Nueva”.</p>
          ) : (
            <div className="divide-y divide-app">
              {list.map((t) => (
                <div key={t.id} className="px-5 py-3 flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className={`text-sm font-semibold truncate ${t.is_active ? 'text-app' : 'text-app3 line-through'}`}>{t.name}</div>
                    <div className="text-xs text-app3 truncate">
                      {t.items.length} indicaciones
                      {t.appointment_types.length > 0 && ` · ${t.appointment_types.join(', ')}`}
                    </div>
                  </div>
                  <button onClick={() => toggleActive(t)}
                    className={`text-[11px] font-bold px-2 py-1 rounded-md border flex-shrink-0 ${
                      t.is_active ? 'bg-[#E6F8F1] dark:bg-[#00C4BC]/10 border-[#00C4BC]/20 text-[#00C4BC]' : 'bg-surface2 border-app text-app3'}`}>
                    {t.is_active ? 'Activa' : 'Inactiva'}
                  </button>
                  <button onClick={() => edit(t)} aria-label="Editar"
                    className="w-8 h-8 rounded-lg hover:bg-surface2 text-app3 hover:text-app flex items-center justify-center flex-shrink-0">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => setConfirmDelete(t)} aria-label="Borrar"
                    className="w-8 h-8 rounded-lg hover:bg-red-500/10 text-app3 hover:text-red-400 flex items-center justify-center flex-shrink-0">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setConfirmDelete(null)}>
          <div className="bg-surface border border-app rounded-2xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-lg text-app mb-2">¿Borrar “{confirmDelete.name}”?</h3>
            <p className="text-sm text-app3 mb-5">
              Deja de aparecer al enviar indicaciones. Lo ya enviado a los pacientes queda en su historial.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDelete(null)}
                className="flex-1 py-2.5 rounded-xl bg-surface2 hover:bg-surface3 text-app2 text-sm font-semibold">Cancelar</button>
              <button disabled={remove.isPending}
                onClick={async () => { await remove.mutateAsync(confirmDelete.id).catch(() => {}); setConfirmDelete(null) }}
                className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white text-sm font-semibold">Borrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
