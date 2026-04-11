'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { apiFetch } from '@/lib/api'
import { useRouter, useParams } from 'next/navigation'

export default function PatientDetailPage() {
  const [patient, setPatient] = useState<any>(null)
  const [balance, setBalance] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [odontogram, setOdontogram] = useState<any[]>([])
  const [selectedTooth, setSelectedTooth] = useState<number | null>(null)
  const [savingTooth, setSavingTooth] = useState(false)
  const [token, setToken] = useState('')
  const [files, setFiles] = useState<any[]>([])
  const [fileUrls, setFileUrls] = useState<Record<string, string>>({})
  const [previewFile, setPreviewFile] = useState<{ url: string; name: string } | null>(null)
  const [toothDiagnostics, setToothDiagnostics] = useState<any[]>([])
  const [uploading, setUploading] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [editForm, setEditForm] = useState<any>({})
  const [editErrors, setEditErrors] = useState<Record<string, string>>({})
  const [apptPage, setApptPage] = useState(1)
  const [notes, setNotes] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)
  const [notesSaved, setNotesSaved] = useState(false)
  const APPTS_PER_PAGE = 5
  const router = useRouter()
  const params = useParams()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/'); return }
      setToken(session.access_token)

      const [patientData, balanceData, odontogramData, diagData] = await Promise.all([
        apiFetch(`/patients/${params.id}`, { token: session.access_token }),
        apiFetch(`/patients/${params.id}/balance`, { token: session.access_token }),
        apiFetch(`/treatments/odontogram/${params.id}`, { token: session.access_token }),
        apiFetch(`/treatments/tooth-diagnostics/${params.id}`, { token: session.access_token }),
      ])

      const { createClient: createSupabase } = await import('@/lib/supabase')
      const sb = createSupabase()
      const { data: fileList } = await sb.storage
        .from('patient-files')
        .list(`${params.id}/`)
      const list = fileList ?? []
      setFiles(list)
      await loadFileUrls(list)

      setPatient(patientData.data)
      setNotes(patientData.data?.notes ?? '')
      setBalance(balanceData.data)
      setOdontogram(odontogramData.data ?? [])
      setToothDiagnostics(diagData.data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  async function handleSaveNotes() {
    setSavingNotes(true)
    setNotesSaved(false)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    await apiFetch(`/patients/${params.id}`, {
      method: 'PATCH',
      token: session.access_token,
      body: JSON.stringify({ notes })
    })
    setSavingNotes(false)
    setNotesSaved(true)
    setTimeout(() => setNotesSaved(false), 2000)
  }

  async function addDiagnostic(diag: {
    tooth_number: number
    face?: string
    diagnosis_code?: string
    diagnosis_label: string
    procedure?: string
  }) {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    await apiFetch('/treatments/tooth-diagnostics', {
      method: 'POST',
      token: session.access_token,
      body: JSON.stringify({ ...diag, patient_id: params.id })
    })
    const data = await apiFetch(
      `/treatments/tooth-diagnostics/${params.id}`,
      { token: session.access_token }
    )
    setToothDiagnostics(data.data ?? [])
  }

  async function deleteDiagnostic(id: string) {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    await apiFetch(`/treatments/tooth-diagnostics/${id}`, {
      method: 'DELETE',
      token: session.access_token,
    })
    setToothDiagnostics(d => d.filter(x => x.id !== id))
  }

  async function handleSaveEdit() {
    const errors: Record<string, string> = {}
    if (!editForm.first_name?.trim()) errors.first_name = 'Requerido'
    if (!editForm.last_name?.trim()) errors.last_name = 'Requerido'
    if (!editForm.phone?.trim() || editForm.phone === 'Sin teléfono') errors.phone = 'Requerido'

    if (Object.keys(errors).length > 0) {
      setEditErrors(errors)
      return
    }
    setEditErrors({})

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    await apiFetch(`/patients/${params.id}`, {
      method: 'PATCH',
      token: session.access_token,
      body: JSON.stringify(editForm)
    })
    const data = await apiFetch(`/patients/${params.id}`, { token: session.access_token })
    setPatient(data.data)
    setEditMode(false)
  }

  async function loadFileUrls(fileList: any[]) {
    if (fileList.length === 0) { setFileUrls({}); return }
    const sb = createClient()
    const paths = fileList.map((f) => `${params.id}/${f.name}`)
    const { data } = await sb.storage.from('patient-files').createSignedUrls(paths, 3600)
    const urls: Record<string, string> = {}
    data?.forEach((item) => {
      const name = item.path?.split('/').pop()
      if (name && item.signedUrl) urls[name] = item.signedUrl
    })
    setFileUrls(urls)
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const sb = createClient()
      const ext = file.name.split('.').pop()

      // Detectar si viene del botón de odontograma
      const isOdontograma = (e.target as any).dataset?.type === 'odontograma'
      const fileName = isOdontograma
        ? `foto_odontograma_${Date.now()}.${ext}`
        : `${Date.now()}.${ext}`

      const path = `${params.id}/${fileName}`
      await sb.storage.from('patient-files').upload(path, file)
      const { data: fileList } = await sb.storage.from('patient-files').list(`${params.id}/`)
      const list = fileList ?? []
      setFiles(list)
      await loadFileUrls(list)
    } finally {
      setUploading(false)
    }
  }

  async function handleFileDelete(fileName: string) {
    const sb = createClient()
    await sb.storage.from('patient-files').remove([`${params.id}/${fileName}`])
    const { data: fileList } = await sb.storage.from('patient-files').list(`${params.id}/`)
    const list = fileList ?? []
    setFiles(list)
    await loadFileUrls(list)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-app">
        <main className="p-6 max-w-5xl mx-auto animate-pulse">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Left column skeleton */}
            <div className="space-y-4">
              <div className="bg-surface border border-app rounded-xl p-6 flex flex-col items-center gap-3">
                <div className="w-16 h-16 bg-surface2 rounded-full" />
                <div className="h-5 bg-surface2 rounded w-36" />
                <div className="h-3 bg-surface2 rounded w-20" />
              </div>
              <div className="bg-surface border border-app rounded-xl p-4 space-y-3">
                <div className="h-3 bg-surface2 rounded w-20" />
                <div className="h-4 bg-surface2 rounded w-32" />
                <div className="h-4 bg-surface2 rounded w-40" />
              </div>
              <div className="bg-surface border border-app rounded-xl p-4 space-y-3">
                <div className="h-3 bg-surface2 rounded w-24" />
                <div className="h-4 bg-surface2 rounded w-36" />
                <div className="h-4 bg-surface2 rounded w-28" />
              </div>
            </div>
            {/* Right columns skeleton */}
            <div className="md:col-span-2 space-y-4">
              {/* Tabs skeleton */}
              <div className="flex gap-2">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-9 bg-surface2 rounded-lg w-24" />
                ))}
              </div>
              {/* Content rows skeleton */}
              <div className="space-y-3">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="bg-surface border border-app rounded-xl p-4 space-y-2">
                    <div className="h-4 bg-surface2 rounded w-48" />
                    <div className="h-3 bg-surface2 rounded w-32" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    )
  }

  if (!patient) {
    return (
      <div className="min-h-screen bg-app flex items-center justify-center">
        <div className="text-app2">Paciente no encontrado</div>
      </div>
    )
  }

  const age = patient.date_of_birth
    ? Math.floor((Date.now() - new Date(patient.date_of_birth).getTime()) / 31557600000)
    : null

  async function updateTooth(toothNumber: number, surfaces: Record<string, string>, note: string) {
    setSavingTooth(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      // Convertir "V:red,M:blue" a array ["V:red", "M:blue"]
      const surfacesArray = surfaces.surfaces
        ? surfaces.surfaces.split(',').filter(Boolean)
        : []
      await apiFetch(`/treatments/odontogram/${params.id}`, {
        method: 'PUT',
        token: session.access_token,
        body: JSON.stringify({
          tooth_number: toothNumber,
          condition: surfacesArray.length > 0 ? 'other' : 'healthy',
          surfaces: surfacesArray,
          notes: note || undefined,
        })
      })
      const data = await apiFetch(
        `/treatments/odontogram/${params.id}`,
        { token: session.access_token }
      )
      setOdontogram(data.data ?? [])
      setSelectedTooth(null)
    } finally {
      setSavingTooth(false)
    }
  }

  return (
    <div className="min-h-screen bg-app text-app">

      <main className="p-6 max-w-5xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

          {/* Columna izquierda — info del paciente */}
          <div className="space-y-4">
            {/* Avatar + nombre */}
            <div className="bg-surface border border-app rounded-xl p-6 text-center relative">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-400 flex items-center justify-center text-2xl font-bold mx-auto mb-3">
                {patient.first_name[0]}{patient.last_name[0]}
              </div>
              <div className="font-bold text-lg">{patient.first_name} {patient.last_name}</div>
              {age && <div className="text-app2 text-sm mt-1">{age} años</div>}
              {patient.document_number && (
                <div className="text-app3 text-sm">DNI {patient.document_number}</div>
              )}
              <button
                onClick={() => {
                  setEditMode(true); setEditForm({
                    first_name: patient.first_name,
                    last_name: patient.last_name,
                    phone: patient.phone,
                    email: patient.email ?? '',
                    document_number: patient.document_number ?? '',
                    date_of_birth: patient.date_of_birth ?? '',
                    insurance_name: patient.insurance_name ?? '',
                    insurance_plan: patient.insurance_plan ?? '',
                    insurance_number: patient.insurance_number ?? '',
                    allergies: patient.allergies ?? '',
                    current_medications: patient.current_medications ?? '',
                  })
                }}
                className="mt-3 text-xs text-app3 hover:text-emerald-400 transition-colors"
              >
                Editar datos
              </button>
            </div>

            {/* Saldo */}
            {balance && Number(balance.balance_due) > 0 && (
              <div className="bg-red-950/40 border border-red-800/50 rounded-xl p-4">
                <div className="text-xs text-red-400 font-semibold uppercase tracking-wider mb-1">
                  💸 Saldo pendiente
                </div>
                <div className="text-2xl font-bold text-red-400">
                  ${Number(balance.balance_due).toLocaleString('es-AR')}
                </div>
              </div>
            )}

            {/* Contacto */}
            <div className="bg-surface border border-app rounded-xl p-4 space-y-3">
              <div className="text-xs text-app3 uppercase tracking-wider font-semibold">Contacto</div>
              <div className="text-sm">📱 {patient.phone}</div>
              {patient.email && <div className="text-sm">✉️ {patient.email}</div>}
            </div>

            {/* Obra social */}
            {patient.insurance_name && (
              <div className="bg-surface border border-app rounded-xl p-4">
                <div className="text-xs text-app3 uppercase tracking-wider font-semibold mb-2">Obra Social</div>
                <div className="text-sm font-medium">{patient.insurance_name} {patient.insurance_plan}</div>
                {patient.insurance_number && (
                  <div className="text-xs text-app3 mt-1">Afiliado: {patient.insurance_number}</div>
                )}
              </div>
            )}

            {/* Alertas médicas */}
            {patient.allergies && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
                <div className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-wider mb-2">
                  ⚠️ Alergias
                </div>
                <div className="text-sm font-medium text-red-700 dark:text-red-300 mt-1">
                  {patient.allergies}
                </div>
              </div>
            )}

            {patient.current_medications && (
              <div className="bg-surface border border-app rounded-xl p-4">
                <div className="text-xs text-app3 uppercase tracking-wider font-semibold mb-2">Medicación</div>
                <div className="text-sm">{patient.current_medications}</div>
              </div>
            )}

            {/* Acciones */}
            <button
              onClick={() => router.push(`/dashboard/patients/${params.id}/appointment`)}
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-app font-semibold py-3 rounded-xl transition-colors"
            >
              📅 Nuevo turno
            </button>

            <button
              onClick={() => router.push(`/dashboard/payments?patient_id=${params.id}&patient_name=${patient.first_name} ${patient.last_name}`)}
              className="w-full bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-app font-semibold py-3 rounded-xl transition-all"
            >
              💰 Registrar cobro
            </button>

          </div>

          {/* Columna derecha — historial + tratamientos */}
          <div className="md:col-span-2 space-y-6">

            {/* Notas del paciente */}
            <div className="bg-surface border border-app rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-app flex items-center justify-between">
                <h3 className="font-semibold text-app">Notas del paciente</h3>
                <button
                  onClick={handleSaveNotes}
                  disabled={savingNotes}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all active:scale-95 ${notesSaved
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                    : 'bg-emerald-500 hover:bg-emerald-600 text-white disabled:opacity-50'
                    }`}
                >
                  {savingNotes ? 'Guardando...' : notesSaved ? '✓ Guardado' : 'Guardar'}
                </button>
              </div>
              <div className="p-4">
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={4}
                  placeholder="Antecedentes, observaciones generales, indicaciones especiales..."
                  className="w-full bg-surface2 border border-app rounded-xl px-4 py-3 text-app text-sm focus:outline-none focus:border-emerald-400 resize-none"
                />
              </div>
            </div>

            {/* Odontograma */}
            <div className="bg-surface border border-app rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-app">
                <h3 className="font-semibold">Odontograma</h3>
              </div>
              <div className="p-4">
                <OdontogramView
                  odontogram={odontogram}
                  onSaveTooth={updateTooth}
                />
              </div>
            </div>

            {/* Archivos y radiografías */}
            <div className="bg-surface border border-app rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-app flex items-center justify-between">
                <h3 className="font-semibold">Archivos y radiografías</h3>
                <div className="flex gap-2">
                  <label className={`cursor-pointer text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all active:scale-95 ${uploading
                    ? 'bg-surface2 border-app text-app3 opacity-50'
                    : 'bg-surface2 border-app2 hover:bg-surface3 text-app2 hover:text-app'
                    }`}>
                    Foto odontograma
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*"
                      capture="environment"
                      data-type="odontograma"
                      onChange={handleFileUpload}
                      disabled={uploading}
                    />
                  </label>
                  <label className={`cursor-pointer text-xs font-semibold px-3 py-1.5 rounded-lg transition-all active:scale-95 ${uploading ? 'bg-surface3 text-app3' : 'bg-emerald-500 hover:bg-emerald-600 text-app'
                    }`}>
                    {uploading ? 'Subiendo...' : '+ Archivo'}
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*,.pdf,.dcm"
                      onChange={handleFileUpload}
                      disabled={uploading}
                    />
                  </label>
                </div>
              </div>

              {files.length === 0 ? (
                <div className="px-6 py-8 text-center">
                  <div className="text-3xl mb-2">📁</div>
                  <div className="text-app3 text-sm">Sin archivos adjuntos</div>
                  <div className="text-app3 text-xs mt-1">
                    Radiografías, fotos, documentos
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 p-4">
                  {files.map((file: any) => {
                    const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(file.name)
                    const isPdf = /\.pdf$/i.test(file.name)
                    const url = fileUrls[file.name]
                    const size = file.metadata?.size
                      ? `${(file.metadata.size / 1024).toFixed(0)} KB`
                      : ''
                    const date = file.created_at
                      ? new Date(file.created_at).toLocaleDateString('es-AR', {
                        day: 'numeric', month: 'short'
                      })
                      : ''

                    return (
                      <div key={file.name} className="group relative bg-surface2 rounded-xl overflow-hidden border border-app">
                        {/* Thumbnail */}
                        <button
                          className="w-full aspect-square flex items-center justify-center overflow-hidden bg-surface3"
                          onClick={() => {
                            if (url) {
                              if (isImage) setPreviewFile({ url, name: file.name })
                              else window.open(url, '_blank')
                            }
                          }}
                        >
                          {isImage && url ? (
                            <img
                              src={url}
                              alt={file.name}
                              className="w-full h-full object-cover transition-transform group-hover:scale-105"
                            />
                          ) : (
                            <span className="text-4xl">{isPdf ? '📄' : '📁'}</span>
                          )}
                        </button>
                        {/* Info + acciones */}
                        <div className="p-2">
                          <div className="text-xs font-medium truncate text-app">{file.name}</div>
                          <div className="text-xs text-app3">{date} {size}</div>
                          <button
                            onClick={() => handleFileDelete(file.name)}
                            className="mt-1.5 w-full text-xs bg-red-900/20 hover:bg-red-900/40 active:scale-95 text-red-400 py-1 rounded-lg transition-all"
                          >
                            Borrar
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Tratamientos activos */}
            {patient.treatments?.filter((t: any) => t.status === 'in_progress' || t.status === 'accepted').length > 0 && (
              <div className="bg-surface border border-app rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-app">
                  <h3 className="font-semibold">📋 Tratamientos activos</h3>
                </div>
                <div className="divide-y divide-gray-800">
                  {patient.treatments
                    .filter((t: any) => t.status === 'in_progress' || t.status === 'accepted')
                    .map((t: any) => (
                      <div key={t.id} className="px-6 py-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-medium">{t.name}</div>
                          <div className="text-sm font-mono text-app2">
                            {t.sessions_done} / {t.sessions_planned ?? '?'} sesiones
                          </div>
                        </div>
                        {t.sessions_planned && (
                          <div className="h-1.5 bg-surface2 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full"
                              style={{ width: `${Math.min(100, (t.sessions_done / t.sessions_planned) * 100)}%` }}
                            />
                          </div>
                        )}
                        {t.total_quoted && (
                          <div className="flex justify-between text-xs text-app3 mt-2">
                            <span>Presupuesto: ${Number(t.total_quoted).toLocaleString('es-AR')}</span>
                            <span>Pagado: ${Number(t.total_paid).toLocaleString('es-AR')}</span>
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Historial clínico */}
            <div className="bg-surface border border-app rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-app">
                <h3 className="font-semibold">Historial clínico</h3>
              </div>
              {!patient.appointments?.length ? (
                <div className="px-6 py-8 text-center text-app3 text-sm">
                  Sin historial de consultas
                </div>
              ) : (
                <div className="divide-y divide-gray-800">
                  {(() => {
                    const sorted = [...patient.appointments].sort((a: any, b: any) =>
                      new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime()
                    )
                    const total = sorted.length
                    const totalPages = Math.ceil(total / APPTS_PER_PAGE)
                    const paged = sorted.slice((apptPage - 1) * APPTS_PER_PAGE, apptPage * APPTS_PER_PAGE)

                    return (
                      <>
                        {paged.map((appt: any) => (
                          <div key={appt.id} className="px-6 py-4">
                            <div className="flex items-start justify-between gap-4 mb-2">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="text-sm font-mono text-app2 flex-shrink-0">
                                  {new Date(appt.starts_at).toLocaleDateString('es-AR', {
                                    day: 'numeric', month: 'short', year: 'numeric',
                                    timeZone: 'America/Argentina/Buenos_Aires'
                                  })}
                                </div>
                                <div className="text-sm font-semibold truncate">
                                  {appt.appointment_type ?? 'Consulta'}
                                </div>
                              </div>
                              <span className={`text-xs font-semibold px-2 py-1 rounded-full flex-shrink-0 ${appt.status === 'completed' ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' :
                                appt.status === 'absent' ? 'bg-red-500/15 text-red-600 dark:text-red-400' :
                                  appt.status === 'cancelled' ? 'bg-surface2 text-app3' :
                                    'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                                }`}>
                                {appt.status === 'completed' ? 'Atendido' :
                                  appt.status === 'absent' ? 'Ausente' :
                                    appt.status === 'cancelled' ? 'Cancelado' : 'Pendiente'}
                              </span>
                            </div>
                            {appt.chief_complaint && (
                              <div className="mt-2 bg-surface2/60 rounded-lg px-4 py-3 border-l-2 border-amber-400/70">
                                <div className="text-xs text-amber-600 dark:text-amber-400 font-semibold uppercase tracking-wider mb-1">
                                  Motivo de consulta
                                </div>
                                <div className="text-sm text-app2 whitespace-pre-wrap">
                                  {appt.chief_complaint}
                                </div>
                              </div>
                            )}
                            {appt.clinical_notes ? (
                              <div className="mt-2 bg-surface2/60 rounded-lg px-4 py-3 border-l-2 border-emerald-500/50">
                                <div className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold uppercase tracking-wider mb-1">
                                  Notas de la consulta
                                </div>
                                <div className="text-sm text-app2 whitespace-pre-wrap">
                                  {appt.clinical_notes}
                                </div>
                              </div>
                            ) : appt.status === 'completed' ? (
                              <div className="mt-1 text-xs text-app3 italic">
                                Sin notas registradas
                              </div>
                            ) : null}
                          </div>
                        ))}

                        {totalPages > 1 && (
                          <div className="px-6 py-4 border-t border-app flex items-center justify-between">
                            <span className="text-xs text-app3">
                              {total} consultas · página {apptPage} de {totalPages}
                            </span>
                            <div className="flex gap-2">
                              <button
                                onClick={() => setApptPage(p => Math.max(1, p - 1))}
                                disabled={apptPage === 1}
                                className="px-3 py-1.5 text-xs font-semibold bg-surface2 border border-app rounded-lg disabled:opacity-40 hover:bg-surface3 transition-colors active:scale-95"
                              >
                                ←
                              </button>
                              <button
                                onClick={() => setApptPage(p => Math.min(totalPages, p + 1))}
                                disabled={apptPage === totalPages}
                                className="px-3 py-1.5 text-xs font-semibold bg-surface2 border border-app rounded-lg disabled:opacity-40 hover:bg-surface3 transition-colors active:scale-95"
                              >
                                →
                              </button>
                            </div>
                          </div>
                        )}
                      </>
                    )
                  })()}
                </div>
              )}
            </div>

          </div>
        </div>
      </main>

      {/* Lightbox previsualización */}
      {previewFile && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setPreviewFile(null)}
        >
          <div className="relative max-w-4xl max-h-full w-full flex items-center justify-center" onClick={e => e.stopPropagation()}>
            <img
              src={previewFile.url}
              alt={previewFile.name}
              className="max-w-full max-h-[85vh] rounded-xl object-contain shadow-2xl"
            />
            <div className="absolute top-3 right-3 flex gap-2">
              <a
                href={previewFile.url}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-black/60 hover:bg-black/80 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
                onClick={e => e.stopPropagation()}
              >
                Abrir
              </a>
              <button
                onClick={() => setPreviewFile(null)}
                className="bg-black/60 hover:bg-black/80 text-white text-xl w-8 h-8 rounded-lg flex items-center justify-center transition-all"
              >
                ×
              </button>
            </div>
            <div className="absolute bottom-3 left-0 right-0 text-center">
              <span className="bg-black/60 text-white text-xs px-3 py-1 rounded-full">{previewFile.name}</span>
            </div>
          </div>
        </div>
      )}

      {/* Modal edición paciente */}
      {editMode && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-surface border border-app rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="w-9 h-1 bg-surface3 rounded-full mx-auto mb-5 sm:hidden" />
              <h2 className="text-lg font-bold mb-5">Editar paciente</h2>

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-app2 uppercase tracking-wider mb-1">Nombre</label>
                    <input value={editForm.first_name} onChange={e => setEditForm((f: any) => ({ ...f, first_name: e.target.value }))}
                      className={`w-full bg-surface2 border rounded-lg px-3 py-2.5 text-app text-sm focus:outline-none ${editErrors.first_name ? 'border-red-500' : 'border-app focus:border-emerald-400'
                        }`} />
                    {editErrors.first_name && <p className="text-red-400 text-xs mt-1">{editErrors.first_name}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-app2 uppercase tracking-wider mb-1">Apellido</label>
                    <input value={editForm.last_name} onChange={e => setEditForm((f: any) => ({ ...f, last_name: e.target.value }))}
                      className={`w-full bg-surface2 border rounded-lg px-3 py-2.5 text-app text-sm focus:outline-none ${editErrors.last_name ? 'border-red-500' : 'border-app focus:border-emerald-400'
                        }`} />
                    {editErrors.last_name && <p className="text-red-400 text-xs mt-1">{editErrors.last_name}</p>}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-app2 uppercase tracking-wider mb-1">Teléfono</label>
                  <input
                    value={editForm.phone}
                    onChange={e => setEditForm((f: any) => ({ ...f, phone: e.target.value }))}
                    onFocus={() => {
                      if (editForm.phone === 'Sin teléfono') {
                        setEditForm((f: any) => ({ ...f, phone: '' }))
                      }
                    }}
                    type="tel"
                    className={`w-full bg-surface2 border rounded-lg px-3 py-2.5 text-app text-sm focus:outline-none ${editErrors.phone ? 'border-red-500' : 'border-app focus:border-emerald-400'
                      }`}
                  />
                  {editErrors.phone && <p className="text-red-400 text-xs mt-1">Requerido</p>}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-app2 uppercase tracking-wider mb-1">Email</label>
                  <input value={editForm.email} onChange={e => setEditForm((f: any) => ({ ...f, email: e.target.value }))}
                    type="email"
                    className="w-full bg-surface2 border border-app rounded-lg px-3 py-2.5 text-app text-sm focus:outline-none focus:border-emerald-400" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-app2 uppercase tracking-wider mb-1">DNI</label>
                    <input value={editForm.document_number} onChange={e => setEditForm((f: any) => ({ ...f, document_number: e.target.value }))}
                      className="w-full bg-surface2 border border-app rounded-lg px-3 py-2.5 text-app text-sm focus:outline-none focus:border-emerald-400" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-app2 uppercase tracking-wider mb-1">Fecha de nacimiento</label>
                    <input value={editForm.date_of_birth} onChange={e => setEditForm((f: any) => ({ ...f, date_of_birth: e.target.value }))}
                      type="date"
                      className="w-full bg-surface2 border border-app rounded-lg px-3 py-2.5 text-app text-sm focus:outline-none focus:border-emerald-400" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-app2 uppercase tracking-wider mb-1">Obra social</label>
                    <input value={editForm.insurance_name} onChange={e => setEditForm((f: any) => ({ ...f, insurance_name: e.target.value }))}
                      placeholder="OSDE, PAMI..."
                      className="w-full bg-surface2 border border-app rounded-lg px-3 py-2.5 text-app text-sm focus:outline-none focus:border-emerald-400" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-app2 uppercase tracking-wider mb-1">Plan</label>
                    <input value={editForm.insurance_plan} onChange={e => setEditForm((f: any) => ({ ...f, insurance_plan: e.target.value }))}
                      className="w-full bg-surface2 border border-app rounded-lg px-3 py-2.5 text-app text-sm focus:outline-none focus:border-emerald-400" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-app2 uppercase tracking-wider mb-1">Alergias</label>
                  <input value={editForm.allergies} onChange={e => setEditForm((f: any) => ({ ...f, allergies: e.target.value }))}
                    placeholder="Penicilina, látex..."
                    className="w-full bg-surface2 border border-app rounded-lg px-3 py-2.5 text-app text-sm focus:outline-none focus:border-emerald-400" />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-app2 uppercase tracking-wider mb-1">Medicación actual</label>
                  <input value={editForm.current_medications} onChange={e => setEditForm((f: any) => ({ ...f, current_medications: e.target.value }))}
                    className="w-full bg-surface2 border border-app rounded-lg px-3 py-2.5 text-app text-sm focus:outline-none focus:border-emerald-400" />
                </div>
              </div>

              <div className="flex gap-3 mt-5">
                <button onClick={() => setEditMode(false)}
                  className="flex-1 bg-surface2 hover:bg-surface3 text-app font-semibold py-3 rounded-xl transition-colors">
                  Cancelar
                </button>
                <button onClick={handleSaveEdit}
                  className="flex-1 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-app font-semibold py-3 rounded-xl transition-all">
                  Guardar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>



  )
}

// Cuadrantes FDI
const Q1 = [18, 17, 16, 15, 14, 13, 12, 11]
const Q2 = [21, 22, 23, 24, 25, 26, 27, 28]
const Q3 = [31, 32, 33, 34, 35, 36, 37, 38]
const Q4 = [48, 47, 46, 45, 44, 43, 42, 41]

type FaceColor = 'red' | 'blue' | 'emerald' | null
type ToothState = { V?: FaceColor; M?: FaceColor; O?: FaceColor; D?: FaceColor; L?: FaceColor; note?: string; missing?: boolean; toExtract?: boolean }

function ToothSVG({ state, onClick, isSelected, number }: {
  state: ToothState
  onClick: () => void
  isSelected: boolean
  number: number
}) {
  function fc(face: keyof ToothState): string {
    if (state.missing || state.toExtract) return '#111827'
    const c = state[face as 'V' | 'M' | 'O' | 'D' | 'L']
    if (c === 'red') return '#dc2626'
    if (c === 'blue') return '#2563eb'
    if (c === 'emerald') return '#059669'
    return 'transparent'
  }

  const hasAny = (['V', 'M', 'O', 'D', 'L'] as const).some(f => state[f]) || state.missing || state.toExtract

  return (
    <div className="flex flex-col items-center gap-0.5 cursor-pointer" onClick={onClick}>
      <svg width="32" height="32" viewBox="0 0 40 40"
        className={`transition-all ${isSelected
          ? 'drop-shadow-[0_0_5px_rgba(250,204,21,0.9)]'
          : 'hover:drop-shadow-[0_0_3px_rgba(156,163,175,0.4)]'}`}>

        <defs>
          <clipPath id={`tooth-clip-${number}`}>
            <circle cx="20" cy="20" r="17.5" />
          </clipPath>
        </defs>

        {/* Interior con clip */}
        <g clipPath={`url(#tooth-clip-${number})`}>
          {!state.missing && (
            <>
              <path d="M20,20 L6,6 A19,19 0 0,1 34,6 Z"
                fill={fc('V')} stroke="#4b5563" strokeWidth="0.8" />
              <path d="M20,20 L34,34 A19,19 0 0,1 6,34 Z"
                fill={fc('L')} stroke="#4b5563" strokeWidth="0.8" />
              <path d="M20,20 L6,34 A19,19 0 0,1 6,6 Z"
                fill={fc('M')} stroke="#4b5563" strokeWidth="0.8" />
              <path d="M20,20 L34,6 A19,19 0 0,1 34,34 Z"
                fill={fc('D')} stroke="#4b5563" strokeWidth="0.8" />
              <line x1="6" y1="6" x2="34" y2="34" stroke="#4b5563" strokeWidth="0.8" />
              <line x1="34" y1="6" x2="6" y2="34" stroke="#4b5563" strokeWidth="0.8" />
              <circle cx="20" cy="20" r="7"
                fill={fc('O')} stroke="#4b5563" strokeWidth="0.8" />
            </>
          )}
          {state.missing && (
            <>
              <line x1="5" y1="5" x2="35" y2="35" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" />
              <line x1="35" y1="5" x2="5" y2="35" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" />
            </>
          )}
          {state.toExtract && (
            <>
              <line x1="5" y1="5" x2="35" y2="35" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeDasharray="4 2" />
              <line x1="35" y1="5" x2="5" y2="35" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeDasharray="4 2" />
            </>
          )}
        </g>

        {/* Borde exterior — encima del clip */}
        <circle cx="20" cy="20" r="18"
          fill="transparent"
          stroke={isSelected ? '#facc15' : state.missing ? '#374151' : state.toExtract ? '#f97316' : '#4b5563'}
          strokeWidth={isSelected ? "2" : state.toExtract ? "2" : "1.5"}
          strokeDasharray={state.toExtract && !isSelected ? "5 3" : undefined}
        />
      </svg>
      <span className={`text-[9px] font-mono font-bold ${isSelected ? 'text-yellow-400' :
        state.missing ? 'text-gray-700' :
          state.toExtract ? 'text-orange-400' :
            hasAny ? 'text-app2' : 'text-app3'
        }`}>
        {number}
      </span>
    </div>
  )
}

function OdontogramView({ odontogram, onSaveTooth }: {
  odontogram: any[]
  onSaveTooth: (toothNumber: number, surfaces: Record<string, string>, note: string) => Promise<void>
}) {
  const [selectedTooth, setSelectedTooth] = useState<number | null>(null)
  const [paintColor, setPaintColor] = useState<'red' | 'blue' | 'emerald'>('red')
  const [saving, setSaving] = useState(false)

  // Estado local de cada diente
  const [teeth, setTeeth] = useState<Record<number, ToothState>>(() => {
    const init: Record<number, ToothState> = {}
    odontogram.forEach(t => {
      if (t.surfaces?.includes('missing')) {
        init[t.tooth_number] = { missing: true, note: t.notes ?? '' }
      } else if (t.surfaces?.includes('to_extract')) {
        init[t.tooth_number] = { toExtract: true, note: t.notes ?? '' }
      } else {
        const surfaces: Record<string, FaceColor> = {}
        if (t.surfaces) {
          t.surfaces.forEach((s: string) => {
            const [face, color] = s.split(':')
            if (face && color) surfaces[face] = color as FaceColor
          })
        }
        init[t.tooth_number] = { ...surfaces, note: t.notes ?? '' }
      }
    })
    return init
  })

  function getState(n: number): ToothState {
    return teeth[n] ?? {}
  }

  function buildSurfaces(state: ToothState): string {
    if (state.missing) return 'missing'
    if (state.toExtract) return 'to_extract'
    return (['V', 'M', 'O', 'D', 'L'] as const)
      .filter(f => state[f])
      .map(f => `${f}:${state[f]}`)
      .join(',')
  }

  async function toggleFace(n: number, face: 'V' | 'M' | 'O' | 'D' | 'L') {
    const current = teeth[n] ?? {}
    const currentColor = current[face]
    const newColor: FaceColor = (currentColor === null || currentColor === undefined)
      ? paintColor
      : currentColor === paintColor ? null : paintColor
    const newState = { ...current, [face]: newColor }
    setTeeth(prev => ({ ...prev, [n]: newState }))
    setSaving(true)
    await onSaveTooth(n, { surfaces: buildSurfaces(newState) }, newState.note ?? '')
    setSaving(false)
  }

  function setNote(n: number, note: string) {
    setTeeth(prev => ({ ...prev, [n]: { ...(prev[n] ?? {}), note } }))
  }

  async function saveNote(n: number) {
    const state = teeth[n] ?? {}
    setSaving(true)
    await onSaveTooth(n, { surfaces: buildSurfaces(state) }, state.note ?? '')
    setSaving(false)
  }

  function Quadrant({ teeth: qs, label }: { teeth: number[]; label: string }) {
    return (
      <div>
        <div className="text-[10px] text-app3 font-mono text-center mb-1">{label}</div>
        <div className="flex gap-0.5">
          {qs.map(n => (
            <ToothSVG
              key={n}
              number={n}
              state={getState(n)}
              isSelected={selectedTooth === n}
              onClick={() => setSelectedTooth(selectedTooth === n ? null : n)}
            />
          ))}
        </div>
      </div>
    )
  }

  // Panel de caras — click directo sobre el SVG grande
  function BigToothEditor({ n }: { n: number }) {
    const state = getState(n)
    function fc(face: 'V' | 'M' | 'O' | 'D' | 'L'): string {
      if (state.missing || state.toExtract) return '#111827'
      const c = state[face]
      if (c === 'red') return '#dc2626'
      if (c === 'blue') return '#2563eb'
      if (c === 'emerald') return '#059669'
      return 'transparent'
    }

    return (
      <svg width="110" height="110" viewBox="0 0 40 40" className="flex-shrink-0" style={{ userSelect: 'none' }}>
        <defs>
          <clipPath id="big-tooth-clip">
            <circle cx="20" cy="20" r="17.5" />
          </clipPath>
        </defs>

        <g clipPath="url(#big-tooth-clip)" pointerEvents="all">
          {!state.missing && (
            <>
              <path d="M20,20 L6,6 A19,19 0 0,1 34,6 Z"
                fill={fc('V')} stroke="#6b7280" strokeWidth="0.8"
                className="cursor-pointer hover:opacity-70"
                onClick={() => toggleFace(n, 'V')} />
              <path d="M20,20 L34,34 A19,19 0 0,1 6,34 Z"
                fill={fc('L')} stroke="#6b7280" strokeWidth="0.8"
                className="cursor-pointer hover:opacity-70"
                onClick={() => toggleFace(n, 'L')} />
              <path d="M20,20 L6,34 A19,19 0 0,1 6,6 Z"
                fill={fc('M')} stroke="#6b7280" strokeWidth="0.8"
                className="cursor-pointer hover:opacity-70"
                onClick={() => toggleFace(n, 'M')} />
              <path d="M20,20 L34,6 A19,19 0 0,1 34,34 Z"
                fill={fc('D')} stroke="#6b7280" strokeWidth="0.8"
                className="cursor-pointer hover:opacity-70"
                onClick={() => toggleFace(n, 'D')} />
              <line x1="6" y1="6" x2="34" y2="34" stroke="#6b7280" strokeWidth="0.8" pointerEvents="none" />
              <line x1="34" y1="6" x2="6" y2="34" stroke="#6b7280" strokeWidth="0.8" pointerEvents="none" />
              <circle cx="20" cy="20" r="7"
                fill={fc('O')} stroke="#6b7280" strokeWidth="0.8"
                className="cursor-pointer hover:opacity-70"
                onClick={() => toggleFace(n, 'O')} />
            </>
          )}
          {state.missing && (
            <>
              <line x1="5" y1="5" x2="35" y2="35" stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round" pointerEvents="none" />
              <line x1="35" y1="5" x2="5" y2="35" stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round" pointerEvents="none" />
            </>
          )}
          {state.toExtract && (
            <>
              <line x1="5" y1="5" x2="35" y2="35" stroke="#f97316" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="5 3" pointerEvents="none" />
              <line x1="35" y1="5" x2="5" y2="35" stroke="#f97316" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="5 3" pointerEvents="none" />
            </>
          )}
        </g>

        <circle cx="20" cy="20" r="18"
          fill="transparent"
          stroke={state.toExtract ? '#f97316' : '#facc15'}
          strokeWidth="1.5"
          strokeDasharray={state.toExtract ? "6 3" : undefined}
          pointerEvents="none"
        />
      </svg>
    )
  }

  return (
    <div>
      {/* Color selector — minimalista */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => setPaintColor('red')}
          className={`w-8 h-8 rounded-full transition-all active:scale-90 ring-2 ring-offset-2 ring-offset-gray-900 ${paintColor === 'red'
            ? 'bg-red-600 ring-red-500'
            : 'bg-red-900/40 ring-transparent hover:ring-red-800'
            }`}
          title="Realizado"
        />
        <button
          onClick={() => setPaintColor('emerald')}
          className={`w-8 h-8 rounded-full transition-all active:scale-90 ring-2 ring-offset-2 ring-offset-gray-900 ${paintColor === 'emerald'
            ? 'bg-emerald-600 ring-emerald-500'
            : 'bg-emerald-900/40 ring-transparent hover:ring-emerald-800'
            }`}
          title="Por realizar"
        />
        <span className="text-xs text-app3">
          Tocá una cara para pintar · Tocá de nuevo para borrar
        </span>
      </div>

      {/* Grid cuadrantes */}
      <div className="overflow-x-auto pb-2">
        <div className="inline-flex flex-col gap-1 min-w-full">
          <div className="flex gap-3 justify-center">
            <Quadrant teeth={Q1} label="Q1" />
            <div className="w-px bg-surface3" />
            <Quadrant teeth={Q2} label="Q2" />
          </div>
          <div className="border-t border-dashed border-app my-1" />
          <div className="flex gap-3 justify-center">
            <Quadrant teeth={Q4} label="Q4" />
            <div className="w-px bg-surface3" />
            <Quadrant teeth={Q3} label="Q3" />
          </div>
        </div>
      </div>

      {/* Editor de pieza seleccionada */}
      {selectedTooth && (
        <div className="mt-4 bg-surface2 rounded-xl border border-yellow-700/50 p-4">
          <div className="flex items-start gap-4">
            {/* SVG grande editable */}
            <div className="flex flex-col items-center gap-1 flex-shrink-0">
              <BigToothEditor n={selectedTooth} />
              <span className="text-xs text-yellow-400 font-mono font-bold">Pieza {selectedTooth}</span>
            </div>

            {/* Notas */}
            <div className="flex-1 flex flex-col gap-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <div className="text-xs text-app2 uppercase tracking-wider">Notas</div>
                  {saving && <span className="text-[10px] text-app3">Guardando...</span>}
                </div>
                <textarea
                  value={getState(selectedTooth).note ?? ''}
                  onChange={e => setNote(selectedTooth, e.target.value)}
                  onBlur={() => saveNote(selectedTooth)}
                  rows={4}
                  placeholder="Observaciones, diagnóstico, procedimiento indicado..."
                  className="w-full bg-surface3 border border-gray-600 rounded-xl px-3 py-2 text-app text-sm focus:outline-none focus:border-yellow-500 resize-none"
                />
              </div>

              <div className="flex flex-col gap-2">
                {/* Fila 1: próxima a extraer + ausente */}
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      const newToExtract = !getState(selectedTooth).toExtract
                      const newState = { toExtract: newToExtract, note: getState(selectedTooth).note }
                      setTeeth(prev => ({ ...prev, [selectedTooth]: newState }))
                      const surfaces = newToExtract ? 'to_extract' : ''
                      await onSaveTooth(selectedTooth, { surfaces }, newState.note ?? '')
                    }}
                    className={`flex-1 text-xs font-semibold py-2.5 rounded-xl transition-all active:scale-95 border ${getState(selectedTooth).toExtract
                      ? 'bg-orange-900/60 border-orange-600 text-orange-300'
                      : 'bg-surface2 border-gray-600 text-app2 hover:border-orange-700 hover:text-orange-400'
                      }`}
                  >
                    {getState(selectedTooth).toExtract ? '⚠ Próxima a extraer' : 'Próxima a extraer'}
                  </button>
                  <button
                    onClick={async () => {
                      const newMissing = !getState(selectedTooth).missing
                      const newState = { missing: newMissing, note: getState(selectedTooth).note }
                      setTeeth(prev => ({ ...prev, [selectedTooth]: newState }))
                      const surfaces = newMissing ? 'missing' : ''
                      await onSaveTooth(selectedTooth, { surfaces }, newState.note ?? '')
                    }}
                    className={`flex-1 text-xs font-semibold py-2.5 rounded-xl transition-all active:scale-95 border ${getState(selectedTooth).missing
                      ? 'bg-red-900/60 border-red-600 text-red-300'
                      : 'bg-surface2 border-gray-600 text-app2 hover:border-red-700 hover:text-red-400'
                      }`}
                  >
                    {getState(selectedTooth).missing ? '✕ Ausente' : 'Ausente / Extraído'}
                  </button>
                </div>
                {/* Fila 2: borrar */}
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      const newState = { note: getState(selectedTooth).note }
                      setTeeth(prev => ({ ...prev, [selectedTooth]: newState }))
                      await onSaveTooth(selectedTooth, { surfaces: '' }, newState.note ?? '')
                    }}
                    className="flex-1 px-4 py-2 rounded-xl text-xs font-semibold bg-surface2 border border-gray-600 text-app2 hover:border-gray-500 transition-all active:scale-95"
                    title="Borrar colores"
                  >
                    Borrar marcas
                  </button>
                </div>

              </div>

            </div>
          </div>
        </div>
      )}

      {/* Leyenda */}
      <div className="flex flex-wrap gap-4 mt-4 text-xs text-app3">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-red-600 inline-block" />
          Ya realizado
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-emerald-600 inline-block" />
          Por realizar
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full border-2 border-dashed border-orange-400 inline-block" />
          Próxima a extraer
        </span>
      </div>



    </div>



  )
}