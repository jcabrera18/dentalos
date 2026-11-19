'use client'

// Enviar indicaciones al paciente (post-consulta / post-quirúrgicas) como imagen
// por WhatsApp. Flujo: elegir plantilla → ajustar ítems (solo para este envío) →
// vista previa → compartir / copiar / descargar. Cada envío queda registrado en
// el historial del paciente (POST /indications).
//
// Lo usan: agenda y dashboard (al marcar "Atendido") y la ficha del paciente.

import { useState } from 'react'
import { X, Plus, Trash2, Share2, Copy, Download, Check, ChevronLeft, Loader2, Sparkles, ClipboardList } from 'lucide-react'
import {
  useIndicationTemplates, useLogIndication, useMe, useProfessionals, usePermissions,
  type IndicationTemplate,
} from '@/lib/queries'
import { DISCIPLINE_LABELS, normalizeDiscipline } from '@/lib/capabilities'
import { generateIndicationsImage } from '@/components/generateReceipt'
import { canShareFiles, copyImageToClipboard, downloadBlob, safeFileSlug, shareImageFile } from '@/lib/shareImage'

export type IndicationsModalProps = {
  patientId: string
  patientName: string
  appointmentId?: string | null
  /** Profesional tratante (el del turno). Si falta y quien envía atiende, es él. */
  professionalId?: string | null
  appointmentType?: string | null
  /** Reenvío: contenido ya enviado (salta directo a la edición). */
  initial?: { title: string; items: string[]; footer_note: string | null; template_id?: string | null } | null
  onClose: () => void
}

type EditItem = { id: number; text: string; checked: boolean }
type Prof = { id: string; first_name?: string; last_name?: string; discipline?: string | null; license_number?: string | null }

let nextId = 1
const toEditItems = (items: string[]): EditItem[] => items.map((text) => ({ id: nextId++, text, checked: true }))

export function IndicationsModal({
  patientId, patientName, appointmentId, professionalId, appointmentType, initial, onClose,
}: IndicationsModalProps) {
  const { data: me } = useMe()
  const access = usePermissions()
  const { data: professionals = [] } = useProfessionals()
  const { data: templates = [], isPending: templatesLoading, isError: templatesError, refetch: refetchTemplates } = useIndicationTemplates()
  const logIndication = useLogIndication()

  // Profesional tratante → disciplina sugerida + nombre/matrícula en la imagen.
  // Sin turno (ficha del paciente) se elige; por defecto, quien envía si atiende.
  const [chosenProfId, setChosenProfId] = useState<string | null>(null)
  const treatingId = professionalId || chosenProfId || (access.clinicalAccess ? me?.id : null) || null
  const profList = professionals as Prof[]
  const treating: Prof | null = profList.find((p) => p.id === treatingId)
    ?? (treatingId && me?.id === treatingId ? (me as Prof) : null)
  const discipline = normalizeDiscipline(treating?.discipline ?? me?.discipline)
  const clinicName: string = (me?.clinics as { name?: string } | undefined)?.name ?? ''

  const [step, setStep] = useState<'pick' | 'edit' | 'preview'>(initial ? 'edit' : 'pick')
  const [showAll, setShowAll] = useState(false)
  const [templateId, setTemplateId] = useState<string | null>(initial?.template_id ?? null)
  const [title, setTitle] = useState(initial?.title ?? '')
  const [items, setItems] = useState<EditItem[]>(() => toEditItems(initial?.items ?? []))
  const [footer, setFooter] = useState(initial?.footer_note ?? '')
  const [newItem, setNewItem] = useState('')

  const [image, setImage] = useState<{ url: string; blob: Blob } | null>(null)
  const [generating, setGenerating] = useState(false)
  const [copied, setCopied] = useState(false)
  const [loggedKey, setLoggedKey] = useState<string | null>(null)
  const [logError, setLogError] = useState('')
  const [sharing, setSharing] = useState(false)

  const active = templates.filter((t) => t.is_active)
  const typeKey = appointmentType?.trim().toLowerCase() ?? ''
  const isSuggested = (t: IndicationTemplate) =>
    !!typeKey && t.appointment_types.some((a) => a.trim().toLowerCase() === typeKey)

  const visible = (showAll ? active : active.filter((t) => normalizeDiscipline(t.discipline) === discipline))
    .sort((a, b) => Number(isSuggested(b)) - Number(isSuggested(a)) || a.name.localeCompare(b.name))
  const otherDisciplinesCount = active.length - active.filter((t) => normalizeDiscipline(t.discipline) === discipline).length

  function pickTemplate(t: IndicationTemplate | null) {
    setTemplateId(t?.id ?? null)
    setTitle(t?.title ?? 'Indicaciones')
    setItems(toEditItems(t?.items ?? []))
    setFooter(t?.footer_note ?? '')
    setStep('edit')
  }

  function addItem() {
    const text = newItem.trim()
    if (!text) return
    setItems((prev) => [...prev, { id: nextId++, text, checked: true }])
    setNewItem('')
  }

  const finalItems = items.filter((i) => i.checked && i.text.trim()).map((i) => i.text.trim())
  const canPreview = title.trim().length > 0 && finalItems.length > 0
  const contentKey = JSON.stringify([title.trim(), finalItems, footer.trim()])
  const filename = `indicaciones-${safeFileSlug(patientName)}.png`

  async function goPreview() {
    if (!canPreview) return
    setGenerating(true)
    try {
      const { dataUrl, blob } = await generateIndicationsImage({
        title: title.trim(),
        items: finalItems,
        footerNote: footer.trim() || null,
        patientName,
        date: new Date(),
        professionalName: treating ? `${treating.first_name ?? ''} ${treating.last_name ?? ''}`.trim() : null,
        licenseNumber: treating?.license_number ?? null,
        clinicName: clinicName || null,
      })
      setImage({ url: dataUrl, blob })
      setCopied(false)
      setStep('preview')
    } finally {
      setGenerating(false)
    }
  }

  // Registra el envío una vez por contenido (copiar + descargar no duplica).
  function logSend() {
    if (loggedKey === contentKey) return
    setLoggedKey(contentKey)
    setLogError('')
    logIndication.mutate(
      {
        patient_id: patientId,
        ...(appointmentId ? { appointment_id: appointmentId } : {}),
        ...(templateId ? { template_id: templateId } : {}),
        ...(treatingId ? { professional_id: treatingId } : {}),
        title: title.trim(),
        items: finalItems,
        footer_note: footer.trim() || null,
      },
      {
        onError: () => {
          setLoggedKey(null)
          setLogError('La imagen se generó, pero no se pudo registrar el envío en el historial del paciente.')
        },
      },
    )
  }

  async function handleShare() {
    if (!image) return
    setSharing(true)
    try {
      const res = await shareImageFile(image.blob, filename)
      if (res === 'shared') logSend()
      else if (res === 'unsupported') await handleCopy()
    } finally {
      setSharing(false)
    }
  }

  async function handleCopy() {
    if (!image) return
    if (await copyImageToClipboard(image.blob)) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } else {
      downloadBlob(image.blob, filename)
    }
    logSend()
  }

  function handleDownload() {
    if (!image) return
    downloadBlob(image.blob, filename)
    logSend()
  }

  const nativeShare = canShareFiles()
  const sent = loggedKey === contentKey && !logError

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60] flex items-end sm:items-center justify-center p-4"
      onClick={onClose}>
      <div className="bg-surface border border-app rounded-2xl w-full max-w-lg max-h-[92vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-app">
          <div className="min-w-0 flex items-start gap-2">
            {step !== 'pick' && (
              <button onClick={() => setStep(step === 'preview' ? 'edit' : 'pick')}
                aria-label="Volver"
                className="w-8 h-8 -ml-1 rounded-full hover:bg-surface2 flex items-center justify-center text-app3 transition-colors flex-shrink-0">
                <ChevronLeft size={18} />
              </button>
            )}
            <div className="min-w-0">
              <p className="font-bold text-app">
                {step === 'pick' ? 'Enviar indicaciones' : step === 'edit' ? 'Ajustar indicaciones' : 'Vista previa'}
              </p>
              <p className="text-xs text-app3 mt-0.5 truncate">{patientName}</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Cerrar"
            className="w-8 h-8 rounded-full hover:bg-surface2 flex items-center justify-center text-app3 transition-colors flex-shrink-0">
            <X size={18} />
          </button>
        </div>

        {/* ── Paso 1: plantilla ── */}
        {step === 'pick' && (
          <div className="overflow-y-auto p-5 space-y-2">
            {templatesLoading ? (
              <div className="flex items-center justify-center py-10 text-app3">
                <Loader2 size={18} className="animate-spin" />
              </div>
            ) : (
              <>
                {templatesError && (
                  <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-sm text-red-600 dark:text-red-400 flex items-center justify-between gap-3">
                    <span>No se pudieron cargar las plantillas.</span>
                    <button onClick={() => void refetchTemplates()} className="text-xs font-bold underline flex-shrink-0">Reintentar</button>
                  </div>
                )}
                {!templatesError && visible.length === 0 && (
                  <p className="text-sm text-app3 py-4 text-center">
                    No hay plantillas de indicaciones para {DISCIPLINE_LABELS[discipline]}.
                    {access.clinicalAccess && ' Podés crearlas en Configuración → Indicaciones.'}
                  </p>
                )}
                {visible.map((t) => (
                  <button key={t.id} onClick={() => pickTemplate(t)}
                    className="w-full text-left bg-surface2 hover:bg-surface3 border border-app hover:border-[#00C4BC] rounded-xl px-4 py-3 transition-all active:scale-[0.99]">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-sm text-app truncate">{t.name}</span>
                      {isSuggested(t) && (
                        <span className="flex items-center gap-1 text-[11px] font-bold text-[#00C4BC] bg-[#E6F8F1] dark:bg-[#00C4BC]/10 px-2 py-0.5 rounded-md flex-shrink-0">
                          <Sparkles size={11} /> Sugerida
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-app3 mt-0.5 truncate">
                      {t.items.length} indicaciones
                      {showAll && ` · ${DISCIPLINE_LABELS[normalizeDiscipline(t.discipline)]}`}
                    </div>
                  </button>
                ))}
                {!showAll && otherDisciplinesCount > 0 && (
                  <button onClick={() => setShowAll(true)}
                    className="w-full text-xs font-semibold text-app3 hover:text-app2 py-2">
                    Ver plantillas de otras especialidades ({otherDisciplinesCount})
                  </button>
                )}
                <button onClick={() => pickTemplate(null)}
                  className="w-full flex items-center justify-center gap-2 border border-dashed border-app hover:border-[#00C4BC] text-app2 hover:text-[#00C4BC] rounded-xl px-4 py-3 text-sm font-semibold transition-colors">
                  <ClipboardList size={15} /> Empezar en blanco
                </button>
              </>
            )}
          </div>
        )}

        {/* ── Paso 2: edición (solo para este envío) ── */}
        {step === 'edit' && (
          <>
            <div className="overflow-y-auto p-5 space-y-4">
              {!professionalId && (
                <div>
                  <label className="block text-xs font-semibold text-app2 uppercase tracking-wider mb-1.5">Profesional</label>
                  <select value={treatingId ?? ''} onChange={(e) => setChosenProfId(e.target.value || null)}
                    className="w-full bg-surface2 border border-app rounded-xl px-4 py-2.5 text-app text-sm focus:outline-none focus:border-[#00C4BC]">
                    {!access.clinicalAccess && <option value="">Sin profesional en la imagen</option>}
                    {profList.map((p) => (
                      <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-app2 uppercase tracking-wider mb-1.5">Título</label>
                <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120}
                  className="w-full bg-surface2 border border-app rounded-xl px-4 py-2.5 text-app text-sm focus:outline-none focus:border-[#00C4BC]" />
              </div>

              <div>
                <div className="flex items-baseline justify-between mb-1.5">
                  <label className="text-xs font-semibold text-app2 uppercase tracking-wider">Indicaciones</label>
                  <span className="text-[11px] text-app3">Destildá las que no apliquen · **texto** = negrita</span>
                </div>
                <div className="space-y-1.5">
                  {items.map((it) => (
                    <div key={it.id} className="flex items-start gap-2">
                      <input type="checkbox" checked={it.checked}
                        onChange={(e) => setItems((prev) => prev.map((p) => p.id === it.id ? { ...p, checked: e.target.checked } : p))}
                        className="mt-2.5 w-4 h-4 accent-[#00C4BC] flex-shrink-0" />
                      <textarea value={it.text} rows={Math.min(4, Math.ceil(it.text.length / 52) || 1)} maxLength={500}
                        onChange={(e) => setItems((prev) => prev.map((p) => p.id === it.id ? { ...p, text: e.target.value } : p))}
                        className={`flex-1 bg-surface2 border border-app rounded-lg px-3 py-1.5 text-sm resize-none focus:outline-none focus:border-[#00C4BC] ${it.checked ? 'text-app' : 'text-app3 line-through'}`} />
                      <button onClick={() => setItems((prev) => prev.filter((p) => p.id !== it.id))}
                        aria-label="Quitar indicación"
                        className="mt-1 w-7 h-7 rounded-lg hover:bg-red-500/10 text-app3 hover:text-red-400 flex items-center justify-center flex-shrink-0">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 mt-2">
                  <input value={newItem} onChange={(e) => setNewItem(e.target.value)} maxLength={500}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addItem() } }}
                    placeholder="Agregar indicación (ej.: Amoxicilina 500 mg cada 8 hs por 7 días)"
                    className="flex-1 bg-surface2 border border-app rounded-lg px-3 py-2 text-sm text-app focus:outline-none focus:border-[#00C4BC]" />
                  <button onClick={addItem} disabled={!newItem.trim()}
                    className="px-3 rounded-lg bg-[#E6F8F1] dark:bg-[#00C4BC]/10 text-[#00C4BC] disabled:opacity-40 flex items-center">
                    <Plus size={16} />
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-app2 uppercase tracking-wider mb-1.5">Aviso final (opcional)</label>
                <textarea value={footer} onChange={(e) => setFooter(e.target.value)} rows={2} maxLength={300}
                  placeholder="Ante sangrado abundante o fiebre, comunicate con el consultorio."
                  className="w-full bg-surface2 border border-app rounded-xl px-4 py-2.5 text-app text-sm resize-none focus:outline-none focus:border-[#00C4BC]" />
              </div>
              <p className="text-[11px] text-app3">Los cambios aplican solo a este envío; la plantilla no se modifica.</p>
            </div>
            <div className="px-5 py-4 border-t border-app">
              <button onClick={goPreview} disabled={!canPreview || generating}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#00C4BC] hover:bg-[#00aaa3] disabled:opacity-50 text-white text-sm font-bold transition-all active:scale-95">
                {generating ? <Loader2 size={15} className="animate-spin" /> : null}
                Ver imagen ({finalItems.length})
              </button>
            </div>
          </>
        )}

        {/* ── Paso 3: vista previa + enviar ── */}
        {step === 'preview' && image && (
          <>
            <div className="overflow-y-auto p-4 bg-surface2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image.url} alt="Indicaciones" className="w-full rounded-xl border border-app shadow-sm" />
            </div>
            <div className="px-5 py-4 border-t border-app space-y-2">
              {logError && <p className="text-xs text-amber-500">{logError}</p>}
              {sent && <p className="text-xs text-[#00C4BC] flex items-center gap-1"><Check size={13} /> Registrado en el historial del paciente</p>}
              {nativeShare ? (
                <button onClick={handleShare} disabled={sharing}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#00C4BC] hover:bg-[#00aaa3] disabled:opacity-60 text-white text-sm font-bold transition-all active:scale-95">
                  <Share2 size={15} /> Compartir por WhatsApp
                </button>
              ) : (
                <p className="text-xs text-app3">Copiá o descargá la imagen para enviarla por WhatsApp.</p>
              )}
              <div className="flex gap-2">
                <button onClick={handleCopy}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all active:scale-95 ${
                    nativeShare ? 'border border-app hover:bg-surface2 text-app2' : 'bg-[#00C4BC] hover:bg-[#00aaa3] text-white'}`}>
                  {copied ? <Check size={15} /> : <Copy size={15} />}
                  {copied ? '¡Copiada!' : 'Copiar imagen'}
                </button>
                <button onClick={handleDownload}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-app hover:bg-surface2 text-app2 text-sm font-semibold transition-colors">
                  <Download size={15} /> Descargar
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
