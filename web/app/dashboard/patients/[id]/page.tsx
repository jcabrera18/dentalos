'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { apiFetch } from '@/lib/api'
import { useRouter, useParams } from 'next/navigation'

const EMPTY_ACCOUNT_SUMMARY = {
  total_billed: 0,
  total_collected: 0,
  balance_due: 0,
  payments_count: 0,
  last_payment_at: null,
}

function hasExplicitTotalAmount(payment: { total_amount?: number | string | null }) {
  return payment.total_amount !== null && payment.total_amount !== undefined
}

export default function PatientDetailPage() {
  const [patient, setPatient] = useState<any>(null)
  const [accountSummary, setAccountSummary] = useState(EMPTY_ACCOUNT_SUMMARY)
  const [loading, setLoading] = useState(true)
  const [odontogram, setOdontogram] = useState<any[]>([])
  const [selectedTooth, setSelectedTooth] = useState<number | null>(null)
  const [savingTooth, setSavingTooth] = useState(false)
  const [files, setFiles] = useState<any[]>([])
  const [fileUrls, setFileUrls] = useState<Record<string, string>>({})
  const [previewFile, setPreviewFile] = useState<{ url: string; name: string } | null>(null)
  const [toothDiagnostics, setToothDiagnostics] = useState<any[]>([])
  const [uploading, setUploading] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [editForm, setEditForm] = useState<any>({})
  const [editErrors, setEditErrors] = useState<Record<string, string>>({})
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [apptPage, setApptPage] = useState(1)
  const [notes, setNotes] = useState('')
  const [showAccountModal, setShowAccountModal] = useState(false)
  const [accountPayments, setAccountPayments] = useState<any[]>([])
  const [savingNotes, setSavingNotes] = useState(false)
  const [notesSaved, setNotesSaved] = useState(false)
  const [odontogramActiveType, setOdontogramActiveType] = useState<'adult' | 'child'>('adult')
  const APPTS_PER_PAGE = 5
  const router = useRouter()
  const params = useParams()
  const supabase = createClient()

  async function refreshAccountSummary(accessToken: string) {
    const summaryData = await apiFetch(`/patients/${params.id}/account-summary`, {
      token: accessToken,
    })
    setAccountSummary(summaryData.data ?? EMPTY_ACCOUNT_SUMMARY)
  }

  async function refreshAccountPayments(accessToken: string) {
    const paymentsData = await apiFetch(`/payments?patient_id=${params.id}&limit=500`, {
      token: accessToken,
    })
    setAccountPayments(paymentsData.data ?? [])
  }

  async function refreshAccountState(accessToken: string) {
    await Promise.all([
      refreshAccountSummary(accessToken),
      refreshAccountPayments(accessToken),
    ])
  }

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/'); return }

      const [patientData, accountSummaryData, odontogramData, diagData, paymentsData] = await Promise.all([
        apiFetch(`/patients/${params.id}`, { token: session.access_token }),
        apiFetch(`/patients/${params.id}/account-summary`, { token: session.access_token }),
        apiFetch(`/treatments/odontogram/${params.id}`, { token: session.access_token }),
        apiFetch(`/treatments/tooth-diagnostics/${params.id}`, { token: session.access_token }),
        apiFetch(`/payments?patient_id=${params.id}&limit=500`, { token: session.access_token }),
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
      setAccountSummary(accountSummaryData.data ?? EMPTY_ACCOUNT_SUMMARY)
      setOdontogramActiveType((patientData.data?.odontogram_type as 'adult' | 'child') ?? 'adult')
      setNotes(patientData.data?.notes ?? '')
      setOdontogram(odontogramData.data ?? [])
      setToothDiagnostics(diagData.data ?? [])
      setAccountPayments(paymentsData.data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  useEffect(() => {
    async function syncAccountState() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      await refreshAccountState(session.access_token)
    }

    function handleWindowFocus() {
      void syncAccountState()
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        void syncAccountState()
      }
    }

    window.addEventListener('focus', handleWindowFocus)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('focus', handleWindowFocus)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
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

  async function openAccountModal() {
    setShowAccountModal(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    await refreshAccountState(session.access_token)
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

  async function handleDeletePatient() {
    setDeleting(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    await apiFetch(`/patients/${params.id}`, {
      method: 'DELETE',
      token: session.access_token,
    })
    router.push('/dashboard/patients')
  }

  async function handleSaveEdit() {
    const errors: Record<string, string> = {}
    if (!editForm.first_name?.trim()) errors.first_name = 'Requerido'
    if (!editForm.last_name?.trim()) errors.last_name = 'Requerido'

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
      body: JSON.stringify({
        ...editForm,
        gender: editForm.gender || null,
      })
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

  async function updateTeethBulk(teeth: Array<{ toothNumber: number; surfaces: string; note: string }>) {
    setSavingTooth(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      await apiFetch(`/treatments/odontogram/${params.id}/bulk`, {
        method: 'PUT',
        token: session.access_token,
        body: JSON.stringify({
          teeth: teeth.map(t => {
            const surfacesArray = t.surfaces ? t.surfaces.split(',').filter(Boolean) : []
            return {
              tooth_number: t.toothNumber,
              condition: surfacesArray.length > 0 ? 'other' : 'healthy',
              surfaces: surfacesArray,
              notes: t.note || undefined,
            }
          })
        })
      })
    } finally {
      setSavingTooth(false)
    }
  }

  async function updateTooth(toothNumber: number, surfaces: Record<string, string>, note: string) {
    setSavingTooth(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
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
                    phone: patient.phone ?? '',
                    email: patient.email ?? '',
                    document_number: patient.document_number ?? '',
                    date_of_birth: patient.date_of_birth ?? '',
                    gender: patient.gender ?? '',
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
              onClick={openAccountModal}
              className="w-full bg-surface2 hover:bg-surface3 border border-app text-app2 hover:text-app text-sm font-semibold py-2.5 rounded-xl transition-all active:scale-95"
            >
              📋 Ver cuenta corriente
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
              <div className="px-6 py-4 border-b border-app flex items-center justify-between">
                <h3 className="font-semibold">Odontograma</h3>
                <div className="flex items-center gap-3">
                  {savingTooth && (
                    <span className="flex items-center gap-1.5 text-xs text-app3">
                      <svg className="animate-spin w-3 h-3 text-yellow-400 shrink-0" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                      </svg>
                      Guardando...
                    </span>
                  )}
                  <div className="flex items-center gap-1 bg-surface2 p-0.5 rounded-lg border border-gray-700">
                    {(['adult', 'child'] as const).map(t => (
                      <button key={t}
                        onClick={async () => {
                          setOdontogramActiveType(t)
                          const { data: { session } } = await supabase.auth.getSession()
                          if (!session) return
                          await apiFetch(`/patients/${params.id}`, {
                            method: 'PATCH', token: session.access_token,
                            body: JSON.stringify({ odontogram_type: t }),
                          })
                          setPatient((p: any) => ({ ...p, odontogram_type: t }))
                        }}
                        className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${odontogramActiveType === t ? 'bg-yellow-900/50 border border-yellow-700 text-yellow-300' : 'text-app3 hover:text-app2'}`}
                      >{t === 'adult' ? 'Adulto' : 'Niño'}</button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="p-4">
                <OdontogramView
                  odontogram={odontogram}
                  onSaveTooth={updateTooth}
                  onSaveBulk={updateTeethBulk}
                  odontogramType={odontogramActiveType}
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

      {/* Modal cuenta corriente */}
      {showAccountModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4"
          onClick={() => setShowAccountModal(false)}>
          <div className="bg-surface border border-app rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col"
            onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div className="px-6 py-4 border-b border-app flex items-center justify-between shrink-0">
              <div>
                <h2 className="text-lg font-bold">Cuenta corriente</h2>
                <div className="text-sm text-app2">{patient.first_name} {patient.last_name}</div>
              </div>
              <button onClick={() => setShowAccountModal(false)}
                className="text-app3 hover:text-app p-1 rounded-lg hover:bg-surface2 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            <>
              {/* Resumen */}
              <div className="px-6 py-4 border-b border-app shrink-0">
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-surface2 rounded-xl p-3 text-center">
                    <div className="text-xs text-app3 mb-1">Total facturado</div>
                    <div className="text-base font-bold text-app">${Number(accountSummary.total_billed).toLocaleString('es-AR')}</div>
                  </div>
                  <div className="bg-surface2 rounded-xl p-3 text-center">
                    <div className="text-xs text-app3 mb-1">Total cobrado</div>
                    <div className="text-base font-bold text-emerald-500">${Number(accountSummary.total_collected).toLocaleString('es-AR')}</div>
                  </div>
                  <div className={`rounded-xl p-3 text-center ${Number(accountSummary.balance_due) > 0 ? 'bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/50' : 'bg-surface2'}`}>
                    <div className={`text-xs mb-1 ${Number(accountSummary.balance_due) > 0 ? 'text-red-700 dark:text-red-400' : 'text-app3'}`}>Saldo pendiente</div>
                    <div className={`text-base font-bold ${Number(accountSummary.balance_due) > 0 ? 'text-red-800 dark:text-red-400' : 'text-app3'}`}>
                      ${Number(accountSummary.balance_due).toLocaleString('es-AR')}
                    </div>
                  </div>
                </div>
              </div>

              {/* Historial */}
              <div className="flex-1 overflow-y-auto">
                {accountPayments.length === 0 ? (
                  <div className="px-6 py-12 text-center text-app3 text-sm">Sin cobros registrados</div>
                ) : (
                  <div className="divide-y divide-app">
                    {[...accountPayments].sort((a, b) => new Date(b.paid_at).getTime() - new Date(a.paid_at).getTime()).map((p: any) => {
                      const servicio = hasExplicitTotalAmount(p) ? Number(p.total_amount) : 0
                      const pagado = Number(p.amount)
                      const debe = Math.max(servicio - pagado, 0)
                      const METODOS: Record<string, string> = {
                        cash: '💵 Efectivo', bank_transfer: '📲 Transferencia',
                        debit_card: '💳 Débito', credit_card: '💳 Crédito',
                        insurance: '🏥 Obra social', other: '📝 Otro',
                      }
                      return (
                        <div key={p.id} className="px-6 py-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="text-xs text-app3 font-mono">
                                {new Date(p.paid_at).toLocaleDateString('es-AR', {
                                  day: 'numeric', month: 'short', year: 'numeric',
                                  timeZone: 'America/Argentina/Buenos_Aires'
                                })}
                              </div>
                              <div className="text-sm font-medium text-app mt-0.5">
                                {METODOS[p.method] ?? p.method}
                              </div>
                              {p.notes && <div className="text-xs text-app3 mt-0.5 truncate">{p.notes}</div>}
                            </div>
                            <div className="text-right shrink-0 space-y-0.5">
                              {hasExplicitTotalAmount(p) && servicio !== pagado && (
                                <div className="text-xs text-app3">
                                  Total: <span className="font-semibold">${servicio.toLocaleString('es-AR')}</span>
                                </div>
                              )}
                              <div className="text-sm font-bold text-emerald-500">
                                +${pagado.toLocaleString('es-AR')}
                              </div>
                              {debe > 0 && (
                                <div className="text-xs font-semibold text-amber-500">
                                  Debe: ${debe.toLocaleString('es-AR')}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-app shrink-0">
                <button
                  onClick={() => {
                    setShowAccountModal(false)
                    router.push(`/dashboard/payments?patient_id=${params.id}&patient_name=${patient.first_name} ${patient.last_name}`)
                  }}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white font-semibold py-3 rounded-xl transition-all text-sm"
                >
                  💰 Registrar nuevo cobro
                </button>
              </div>
            </>
          </div>
        </div>
      )}

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
          <div className="bg-surface border border-app rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="w-9 h-1 bg-surface3 rounded-full mx-auto mb-5 sm:hidden" />
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold">Editar paciente</h2>
                <button onClick={() => setEditMode(false)} className="text-app3 hover:text-app transition-colors p-1 rounded-lg hover:bg-surface2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>

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

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-app2 uppercase tracking-wider mb-1">Teléfono</label>
                    <input
                      value={editForm.phone ?? ''}
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

                <div>
                  <label className="block text-xs font-semibold text-app2 uppercase tracking-wider mb-1">Sexo</label>
                  <div className="flex gap-2">
                    {[{ v: 'F', label: 'Femenino' }, { v: 'M', label: 'Masculino' }, { v: 'otro', label: 'Otro' }].map(opt => (
                      <button
                        key={opt.v}
                        type="button"
                        onClick={() => setEditForm((f: any) => ({ ...f, gender: f.gender === opt.v ? '' : opt.v }))}
                        className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-all ${
                          editForm.gender === opt.v
                            ? opt.v === 'F'
                              ? 'bg-pink-500/20 border-pink-400 text-pink-400'
                              : opt.v === 'M'
                              ? 'bg-blue-500/20 border-blue-400 text-blue-400'
                              : 'bg-surface3 border-app2 text-app'
                            : 'bg-surface2 border-app text-app3 hover:border-app2'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
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

                <div className="grid grid-cols-2 gap-3">
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
              </div>

              {/* Eliminar paciente */}
              <div className="mt-6 pt-5 border-t border-app">
                {!deleteConfirm ? (
                  <button
                    onClick={() => setDeleteConfirm(true)}
                    className="w-full text-sm text-red-400 hover:text-red-300 font-semibold py-2 rounded-xl hover:bg-red-500/10 transition-all"
                  >
                    Eliminar paciente
                  </button>
                ) : (
                  <div className="bg-red-950/40 border border-red-800/50 rounded-xl p-4 space-y-3">
                    <p className="text-sm text-red-300 font-semibold text-center">
                      ¿Seguro que querés eliminar a {patient.first_name} {patient.last_name}?
                    </p>
                    <p className="text-xs text-red-400/70 text-center">
                      Esta acción es irreversible y borrará todos sus datos.
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setDeleteConfirm(false)}
                        disabled={deleting}
                        className="flex-1 bg-surface2 hover:bg-surface3 text-app font-semibold py-2.5 rounded-xl transition-colors text-sm"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleDeletePatient}
                        disabled={deleting}
                        className="flex-1 bg-red-600 hover:bg-red-700 active:scale-95 text-white font-semibold py-2.5 rounded-xl transition-all text-sm disabled:opacity-60"
                      >
                        {deleting ? 'Eliminando...' : 'Sí, eliminar'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3 mt-4">
                <button onClick={() => { setEditMode(false); setDeleteConfirm(false) }}
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

// Cuadrantes FDI — adulto
const Q1 = [18, 17, 16, 15, 14, 13, 12, 11]
const Q2 = [21, 22, 23, 24, 25, 26, 27, 28]
const Q3 = [31, 32, 33, 34, 35, 36, 37, 38]
const Q4 = [48, 47, 46, 45, 44, 43, 42, 41]

// Cuadrantes FDI — dentición primaria (niño)
const CQ1 = [55, 54, 53, 52, 51]
const CQ2 = [61, 62, 63, 64, 65]
const CQ3 = [71, 72, 73, 74, 75]
const CQ4 = [85, 84, 83, 82, 81]

const ADULT_UPPER = [...Q1, ...Q2]
const ADULT_LOWER = [...Q4, ...Q3]
const CHILD_UPPER = [...CQ1, ...CQ2]
const CHILD_LOWER = [...CQ4, ...CQ3]
const ALL_ARCHES = [ADULT_UPPER, ADULT_LOWER, CHILD_UPPER, CHILD_LOWER]

function getTeethBetween(a: number, b: number): number[] | null {
  for (const arch of ALL_ARCHES) {
    const i = arch.indexOf(a), j = arch.indexOf(b)
    if (i !== -1 && j !== -1) {
      const [s, e] = i < j ? [i, j] : [j, i]
      return arch.slice(s, e + 1)
    }
  }
  return null
}

function nanoid6() { return Math.random().toString(36).slice(2, 8) }

type ProstheticType = 'bridge' | 'removable' | 'crown'
type Prosthetic = { id: string; type: ProstheticType; color: 'red' | 'blue'; teeth: number[] }

type FaceColor = 'red' | 'blue' | 'emerald' | null
type ToothStatus = 'missing' | 'toExtract' | 'crownExisting' | 'crownPending'
type ToothState = { V?: FaceColor; M?: FaceColor; O?: FaceColor; D?: FaceColor; L?: FaceColor; note?: string; missing?: boolean; toExtract?: boolean; crownExisting?: boolean; crownPending?: boolean }

function getToothStatus(state: ToothState): ToothStatus | null {
  if (state.missing) return 'missing'
  if (state.toExtract) return 'toExtract'
  if (state.crownExisting) return 'crownExisting'
  if (state.crownPending) return 'crownPending'
  return null
}

function ToothSVG({ state, onClick, isSelected, number, isStartPoint }: {
  state: ToothState
  onClick: () => void
  isSelected: boolean
  number: number
  isStartPoint?: boolean
}) {
  function fc(face: keyof ToothState): string {
    if (state.missing || state.toExtract || state.crownExisting || state.crownPending) return '#111827'
    const c = state[face as 'V' | 'M' | 'O' | 'D' | 'L']
    if (c === 'red') return '#dc2626'
    if (c === 'blue') return '#2563eb'
    if (c === 'emerald') return '#2563eb'
    return 'transparent'
  }

  const hasAny = (['V', 'M', 'O', 'D', 'L'] as const).some(f => state[f]) || state.missing || state.toExtract || state.crownExisting || state.crownPending

  return (
    <div className="flex flex-col items-center gap-0.5 cursor-pointer" onClick={onClick}>
      <svg width="32" height="32" viewBox="0 0 40 40"
        className={`transition-all ${isStartPoint
          ? 'drop-shadow-[0_0_6px_rgba(16,185,129,0.9)]'
          : isSelected
            ? 'drop-shadow-[0_0_5px_rgba(250,204,21,0.9)]'
            : 'hover:drop-shadow-[0_0_3px_rgba(156,163,175,0.4)]'}`}>

        <defs>
          <clipPath id={`tooth-clip-${number}`}>
            <rect x="2.5" y="2.5" width="35" height="35" />
          </clipPath>
        </defs>

        <g clipPath={`url(#tooth-clip-${number})`}>
          {!state.missing && (
            <>
              <path d="M20,20 L3,3 L37,3 Z"
                fill={fc('V')} stroke="#4b5563" strokeWidth="0.8" />
              <path d="M20,20 L37,37 L3,37 Z"
                fill={fc('L')} stroke="#4b5563" strokeWidth="0.8" />
              <path d="M20,20 L3,37 L3,3 Z"
                fill={fc('M')} stroke="#4b5563" strokeWidth="0.8" />
              <path d="M20,20 L37,3 L37,37 Z"
                fill={fc('D')} stroke="#4b5563" strokeWidth="0.8" />
              <line x1="3" y1="3" x2="37" y2="37" stroke="#4b5563" strokeWidth="0.8" />
              <line x1="37" y1="3" x2="3" y2="37" stroke="#4b5563" strokeWidth="0.8" />
              <rect x="13" y="13" width="14" height="14"
                fill={fc('O')} stroke="#4b5563" strokeWidth="0.8" />
            </>
          )}
          {state.missing && (
            <>
              <line x1="3" y1="3" x2="37" y2="37" stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round" />
              <line x1="37" y1="3" x2="3" y2="37" stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round" />
            </>
          )}
          {state.toExtract && (
            <>
              <line x1="3" y1="3" x2="37" y2="37" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" />
              <line x1="37" y1="3" x2="3" y2="37" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" />
            </>
          )}
        </g>

        <rect x="2" y="2" width="36" height="36"
          fill="transparent"
          stroke={isSelected ? '#facc15' : state.missing ? '#dc2626' : state.toExtract ? '#3b82f6' : '#4b5563'}
          strokeWidth={isSelected ? "2" : (state.toExtract || state.missing) ? "2" : "1.5"}
        />
        {(state.crownExisting || state.crownPending) && (
          <circle cx="20" cy="20" r="19"
            fill="transparent"
            stroke={state.crownExisting ? '#dc2626' : '#3b82f6'}
            strokeWidth="2"
          />
        )}
      </svg>
      <span className={`text-[9px] font-mono font-bold ${isSelected ? 'text-yellow-400' :
        state.missing ? 'text-red-400' :
          state.toExtract ? 'text-blue-400' :
            state.crownExisting ? 'text-red-400' :
              state.crownPending ? 'text-blue-400' :
                hasAny ? 'text-app2' : 'text-app3'
        }`}>
        {number}
      </span>
    </div>
  )
}

function OdontogramView({ odontogram, onSaveTooth, onSaveBulk, odontogramType }: {
  odontogram: any[]
  onSaveTooth: (toothNumber: number, surfaces: Record<string, string>, note: string) => Promise<void>
  onSaveBulk: (teeth: Array<{ toothNumber: number; surfaces: string; note: string }>) => Promise<void>
  odontogramType: 'adult' | 'child'
}) {
  const [selectedTooth, setSelectedTooth] = useState<number | null>(null)
  const [paintColor, setPaintColor] = useState<'red' | 'blue' | 'emerald'>('red')
  const [saving, setSaving] = useState(false)
  const [mode, setMode] = useState<'paint' | 'prosthetic'>('paint')
  const [prostheticType, setProstheticType] = useState<ProstheticType>('bridge')
  const [prostheticColor, setProstheticColor] = useState<'red' | 'blue'>('red')
  const [prostheticStart, setProstheticStart] = useState<number | null>(null)
  const [prevSnapshot, setPrevSnapshot] = useState<{ teeth: Record<number, ToothState>; prosthetics: Prosthetic[] } | null>(null)
  const handleUndoRef = useRef<() => Promise<void>>(async () => {})

  const [prosthetics, setProsthetics] = useState<Prosthetic[]>(() => {
    const map: Record<string, { type: string; color: string; teeth: number[] }> = {}
    odontogram.forEach(t => {
      const surfaces: string[] = t.surfaces ?? []
      const marker = surfaces.find((s: string) => s.startsWith('bridge:') || s.startsWith('removable:'))
      if (marker) {
        const parts = marker.split(':')
        const [type, color, id] = parts
        if (id) {
          if (!map[id]) map[id] = { type, color, teeth: [] }
          map[id].teeth.push(t.tooth_number)
        }
      }
    })
    return Object.entries(map).map(([id, p]) => {
      const arch = ALL_ARCHES.find(a => p.teeth.every(t => a.includes(t))) ?? ADULT_UPPER
      const sorted = [...p.teeth].sort((a, b) => arch.indexOf(a) - arch.indexOf(b))
      return { id, type: p.type as ProstheticType, color: p.color as 'red' | 'blue', teeth: sorted }
    })
  })

  const [teeth, setTeeth] = useState<Record<number, ToothState>>(() => {
    const init: Record<number, ToothState> = {}
    odontogram.forEach(t => {
      if (t.surfaces?.includes('missing')) {
        init[t.tooth_number] = { missing: true, note: t.notes ?? '' }
      } else if (t.surfaces?.includes('to_extract')) {
        init[t.tooth_number] = { toExtract: true, note: t.notes ?? '' }
      } else if (t.surfaces?.includes('crown_existing')) {
        init[t.tooth_number] = { crownExisting: true, note: t.notes ?? '' }
      } else if (t.surfaces?.includes('crown_pending')) {
        init[t.tooth_number] = { crownPending: true, note: t.notes ?? '' }
      } else {
        const faceColors: Record<string, FaceColor> = {}
        if (t.surfaces) {
          t.surfaces.forEach((s: string) => {
            if (s.startsWith('bridge:') || s.startsWith('removable:')) return
            const [face, color] = s.split(':')
            if (face && color) faceColors[face] = color as FaceColor
          })
        }
        init[t.tooth_number] = { ...faceColors, note: t.notes ?? '' }
      }
    })
    return init
  })

  function getState(n: number): ToothState {
    return teeth[n] ?? {}
  }

  function takeSnapshot() {
    const teethCopy: Record<number, ToothState> = {}
    Object.keys(teeth).forEach(k => { teethCopy[Number(k)] = { ...teeth[Number(k)] } })
    setPrevSnapshot({ teeth: teethCopy, prosthetics: prosthetics.map(p => ({ ...p, teeth: [...p.teeth] })) })
  }

  async function handleUndo() {
    if (!prevSnapshot) return
    const snap = prevSnapshot
    setPrevSnapshot(null)
    setTeeth(snap.teeth)
    setProsthetics(snap.prosthetics)
    const allNums = [...new Set([
      ...Object.keys(snap.teeth).map(Number),
      ...Object.keys(teeth).map(Number),
    ])]
    const bulkPayload: Array<{ toothNumber: number; surfaces: string; note: string }> = []
    for (const n of allNums) {
      const restoredState = snap.teeth[n] ?? {}
      const curState = teeth[n] ?? {}
      if (JSON.stringify(restoredState) !== JSON.stringify(curState)) {
        const base = buildSurfaces(restoredState)
        const p = snap.prosthetics.find(pr => pr.teeth.includes(n))
        const surfaces = p ? [base, `${p.type}:${p.color}:${p.id}`].filter(Boolean).join(',') : base
        bulkPayload.push({ toothNumber: n, surfaces, note: restoredState.note ?? '' })
      }
    }
    if (bulkPayload.length > 0) {
      setSaving(true)
      await onSaveBulk(bulkPayload)
      setSaving(false)
    }
  }

  handleUndoRef.current = handleUndo

  function buildSurfaces(state: ToothState): string {
    if (state.missing) return 'missing'
    if (state.toExtract) return 'to_extract'
    if (state.crownExisting) return 'crown_existing'
    if (state.crownPending) return 'crown_pending'
    return (['V', 'M', 'O', 'D', 'L'] as const)
      .filter(f => state[f])
      .map(f => `${f}:${state[f]}`)
      .join(',')
  }

  function surfacesFor(n: number, state: ToothState): string {
    const base = buildSurfaces(state)
    const p = prosthetics.find(pr => pr.teeth.includes(n))
    if (!p) return base
    const marker = `${p.type}:${p.color}:${p.id}`
    return [base, marker].filter(Boolean).join(',')
  }

  async function toggleFace(n: number, face: 'V' | 'M' | 'O' | 'D' | 'L') {
    takeSnapshot()
    const current = teeth[n] ?? {}
    const currentColor = current[face]
    const newColor: FaceColor = (currentColor === null || currentColor === undefined)
      ? paintColor
      : currentColor === paintColor ? null : paintColor
    const newState = { ...current, [face]: newColor }
    setTeeth(prev => ({ ...prev, [n]: newState }))
    setSaving(true)
    await onSaveTooth(n, { surfaces: surfacesFor(n, newState) }, newState.note ?? '')
    setSaving(false)
  }

  function setNote(n: number, note: string) {
    setTeeth(prev => ({ ...prev, [n]: { ...(prev[n] ?? {}), note } }))
  }

  async function setStatus(n: number, status: ToothStatus) {
    takeSnapshot()
    const current = teeth[n] ?? {}
    const currentStatus = getToothStatus(current)
    const newState: ToothState = { note: current.note }
    if (currentStatus !== status) newState[status] = true
    setTeeth(prev => ({ ...prev, [n]: newState }))
    setSaving(true)
    await onSaveTooth(n, { surfaces: surfacesFor(n, newState) }, newState.note ?? '')
    setSaving(false)
  }

  async function saveNote(n: number) {
    const state = teeth[n] ?? {}
    setSaving(true)
    await onSaveTooth(n, { surfaces: surfacesFor(n, state) }, state.note ?? '')
    setSaving(false)
  }

  async function saveCrown(n: number, color: 'red' | 'blue') {
    takeSnapshot()
    const current = teeth[n] ?? {}
    const isRed = color === 'red'
    const isActive = isRed ? current.crownExisting : current.crownPending
    const newState: ToothState = { note: current.note }
    if (!isActive) {
      if (isRed) newState.crownExisting = true
      else newState.crownPending = true
    }
    setTeeth(prev => ({ ...prev, [n]: newState }))
    setSaving(true)
    await onSaveTooth(n, { surfaces: surfacesFor(n, newState) }, newState.note ?? '')
    setSaving(false)
  }

  async function saveProsthetic(type: ProstheticType, color: 'red' | 'blue', teethRange: number[]) {
    takeSnapshot()
    const id = nanoid6()
    const marker = `${type}:${color}:${id}`
    setSaving(true)
    const newTeethState = { ...teeth }
    const bulkPayload: Array<{ toothNumber: number; surfaces: string; note: string }> = []
    for (let i = 0; i < teethRange.length; i++) {
      const tooth = teethRange[i]
      const isEndpoint = i === 0 || i === teethRange.length - 1
      const shouldBeMissing = type === 'removable' || !isEndpoint
      const newState: ToothState = shouldBeMissing
        ? { missing: true, note: teeth[tooth]?.note ?? '' }
        : { ...(teeth[tooth] ?? {}), note: teeth[tooth]?.note ?? '' }
      newTeethState[tooth] = newState
      const surfaces = [buildSurfaces(newState), marker].filter(Boolean).join(',')
      bulkPayload.push({ toothNumber: tooth, surfaces, note: newState.note ?? '' })
    }
    await onSaveBulk(bulkPayload)
    setTeeth(newTeethState)
    setProsthetics(prev => [...prev, { id, type, color, teeth: teethRange }])
    setSaving(false)
  }

  async function deleteProsthetic(id: string) {
    takeSnapshot()
    const p = prosthetics.find(pr => pr.id === id)
    if (!p) return
    setSaving(true)
    for (const tooth of p.teeth) {
      const state = teeth[tooth] ?? {}
      await onSaveTooth(tooth, { surfaces: buildSurfaces(state) }, state.note ?? '')
    }
    setProsthetics(prev => prev.filter(pr => pr.id !== id))
    setSaving(false)
  }

  function handleToothClick(n: number) {
    if (mode !== 'prosthetic') {
      setSelectedTooth(prev => prev === n ? null : n)
      return
    }
    if (prostheticType === 'crown') {
      saveCrown(n, prostheticColor)
      return
    }
    if (prostheticStart === null) {
      setProstheticStart(n)
    } else if (prostheticStart === n) {
      setProstheticStart(null)
    } else {
      const range = getTeethBetween(prostheticStart, n)
      if (!range || range.length < 2) { setProstheticStart(null); return }
      saveProsthetic(prostheticType, prostheticColor, range)
      setProstheticStart(null)
    }
  }

  function Quadrant({ teeth: qs, label }: { teeth: number[]; label: string }) {
    const TOOTH_W = 32, TOOTH_GAP = 2
    const localProsthetics = prosthetics.filter(p => p.teeth.some(t => qs.includes(t)))
    return (
      <div>
        <div className="text-[10px] text-app3 font-mono text-center mb-1">{label}</div>
        <div className="relative" style={{ paddingTop: '12px' }}>
          {localProsthetics.map(p => {
            const qTeeth = p.teeth.filter(t => qs.includes(t))
            if (qTeeth.length === 0) return null
            const firstIdx = qs.indexOf(qTeeth[0])
            const lastIdx = qs.indexOf(qTeeth[qTeeth.length - 1])
            const left = firstIdx * (TOOTH_W + TOOTH_GAP)
            const width = (lastIdx - firstIdx) * (TOOTH_W + TOOTH_GAP) + TOOTH_W
            const c = p.color === 'red' ? '#dc2626' : '#3b82f6'
            if (p.type === 'bridge') {
              return (
                <div key={p.id} className="absolute pointer-events-none" style={{ top: 0, left, width, height: '12px' }}>
                  <div style={{ position: 'absolute', top: '3px', left: '5px', right: '5px', height: '4px', backgroundColor: c, borderRadius: '1px' }} />
                  <div style={{ position: 'absolute', top: '3px', left: '5px', width: '4px', height: '9px', backgroundColor: c }} />
                  <div style={{ position: 'absolute', top: '3px', right: '5px', width: '4px', height: '9px', backgroundColor: c }} />
                </div>
              )
            } else {
              return (
                <div key={p.id} className="absolute pointer-events-none" style={{
                  top: '2px', left, width, height: `${10 + TOOTH_W}px`,
                  border: `2px dashed ${c}`, borderRadius: '4px', boxSizing: 'border-box',
                }} />
              )
            }
          })}
          <div className="flex gap-0.5">
            {qs.map(n => (
              <ToothSVG
                key={n}
                number={n}
                state={getState(n)}
                isSelected={mode !== 'prosthetic' && selectedTooth === n}
                isStartPoint={prostheticStart === n}
                onClick={() => handleToothClick(n)}
              />
            ))}
          </div>
        </div>
      </div>
    )
  }

  function BigToothEditor({ n }: { n: number }) {
    const state = getState(n)
    function fc(face: 'V' | 'M' | 'O' | 'D' | 'L'): string {
      if (state.missing || state.toExtract || state.crownExisting || state.crownPending) return '#111827'
      const c = state[face]
      if (c === 'red') return '#dc2626'
      if (c === 'blue') return '#2563eb'
      if (c === 'emerald') return '#2563eb'
      return 'transparent'
    }

    return (
      <svg width="110" height="110" viewBox="0 0 40 40" className="flex-shrink-0" style={{ userSelect: 'none' }}>
        <defs>
          <clipPath id="big-tooth-clip">
            <rect x="2.5" y="2.5" width="35" height="35" />
          </clipPath>
        </defs>

        <g clipPath="url(#big-tooth-clip)" pointerEvents="all">
          {!state.missing && (
            <>
              <path d="M20,20 L3,3 L37,3 Z"
                fill={fc('V')} stroke="#6b7280" strokeWidth="0.8"
                className="cursor-pointer hover:opacity-70"
                onClick={() => toggleFace(n, 'V')} />
              <path d="M20,20 L37,37 L3,37 Z"
                fill={fc('L')} stroke="#6b7280" strokeWidth="0.8"
                className="cursor-pointer hover:opacity-70"
                onClick={() => toggleFace(n, 'L')} />
              <path d="M20,20 L3,37 L3,3 Z"
                fill={fc('M')} stroke="#6b7280" strokeWidth="0.8"
                className="cursor-pointer hover:opacity-70"
                onClick={() => toggleFace(n, 'M')} />
              <path d="M20,20 L37,3 L37,37 Z"
                fill={fc('D')} stroke="#6b7280" strokeWidth="0.8"
                className="cursor-pointer hover:opacity-70"
                onClick={() => toggleFace(n, 'D')} />
              <line x1="3" y1="3" x2="37" y2="37" stroke="#6b7280" strokeWidth="0.8" pointerEvents="none" />
              <line x1="37" y1="3" x2="3" y2="37" stroke="#6b7280" strokeWidth="0.8" pointerEvents="none" />
              <rect x="13" y="13" width="14" height="14"
                fill={fc('O')} stroke="#6b7280" strokeWidth="0.8"
                className="cursor-pointer hover:opacity-70"
                onClick={() => toggleFace(n, 'O')} />
            </>
          )}
          {state.missing && (
            <>
              <line x1="3" y1="3" x2="37" y2="37" stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round" pointerEvents="none" />
              <line x1="37" y1="3" x2="3" y2="37" stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round" pointerEvents="none" />
            </>
          )}
          {state.toExtract && (
            <>
              <line x1="3" y1="3" x2="37" y2="37" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" pointerEvents="none" />
              <line x1="37" y1="3" x2="3" y2="37" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" pointerEvents="none" />
            </>
          )}
        </g>

        <rect x="2" y="2" width="36" height="36"
          fill="transparent"
          stroke={state.toExtract ? '#3b82f6' : state.missing ? '#dc2626' : '#facc15'}
          strokeWidth="1.5"
          pointerEvents="none"
        />
        {(state.crownExisting || state.crownPending) && (
          <circle cx="20" cy="20" r="19"
            fill="transparent"
            stroke={state.crownExisting ? '#dc2626' : '#3b82f6'}
            strokeWidth="2"
            pointerEvents="none"
          />
        )}
      </svg>
    )
  }

  return (
    <div>
      {/* Barra superior */}
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Selector de modo */}
          <div className="flex gap-1 bg-surface2 p-0.5 rounded-lg border border-gray-700">
            <button
              onClick={() => { setMode('paint'); setProstheticStart(null) }}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${mode === 'paint' ? 'bg-surface3 border border-gray-600 text-app' : 'text-app3 hover:text-app2'}`}
            >Normal</button>
            <button
              onClick={() => { setMode('prosthetic'); setSelectedTooth(null) }}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${mode === 'prosthetic' ? 'bg-surface3 border border-gray-600 text-app' : 'text-app3 hover:text-app2'}`}
            >Prótesis</button>
          </div>

          {mode === 'paint' && (
            <div className="flex items-center gap-2">
              <button onClick={() => setPaintColor('red')}
                className={`w-7 h-7 rounded-full transition-all active:scale-90 ring-2 ring-offset-2 ring-offset-gray-900 ${paintColor === 'red' ? 'bg-red-600 ring-red-500' : 'bg-red-900/40 ring-transparent hover:ring-red-800'}`}
                title="Realizado" />
              <button onClick={() => setPaintColor('emerald')}
                className={`w-7 h-7 rounded-full transition-all active:scale-90 ring-2 ring-offset-2 ring-offset-gray-900 ${paintColor === 'emerald' ? 'bg-blue-600 ring-blue-500' : 'bg-blue-900/40 ring-transparent hover:ring-blue-800'}`}
                title="Por realizar" />
              <span className="text-xs text-app3">Tocá para pintar · Tocá de nuevo para borrar</span>
            </div>
          )}

          {mode === 'prosthetic' && (
            <div className="flex items-center gap-2">
              <div className="flex gap-1 bg-surface2 p-0.5 rounded-lg border border-gray-700">
                <button onClick={() => { setProstheticType('bridge'); setProstheticStart(null) }}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${prostheticType === 'bridge' ? 'bg-surface3 border border-gray-600 text-app' : 'text-app3 hover:text-app2'}`}
                >Puente</button>
                <button onClick={() => { setProstheticType('removable'); setProstheticStart(null) }}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${prostheticType === 'removable' ? 'bg-surface3 border border-gray-600 text-app' : 'text-app3 hover:text-app2'}`}
                >Removible</button>
                <button onClick={() => { setProstheticType('crown'); setProstheticStart(null) }}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${prostheticType === 'crown' ? 'bg-surface3 border border-gray-600 text-app' : 'text-app3 hover:text-app2'}`}
                >Corona</button>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => setProstheticColor('red')}
                  className={`w-5 h-5 rounded-full ring-2 ring-offset-1 ring-offset-gray-900 transition-all ${prostheticColor === 'red' ? 'bg-red-600 ring-red-500' : 'bg-red-900/40 ring-transparent hover:ring-red-800'}`}
                  title="Existente (rojo)" />
                <button onClick={() => setProstheticColor('blue')}
                  className={`w-5 h-5 rounded-full ring-2 ring-offset-1 ring-offset-gray-900 transition-all ${prostheticColor === 'blue' ? 'bg-blue-600 ring-blue-500' : 'bg-blue-900/40 ring-transparent hover:ring-blue-800'}`}
                  title="A realizar (azul)" />
              </div>
              {prostheticStart && (
                <span className="text-xs text-emerald-400 font-mono">{prostheticStart} →</span>
              )}
            </div>
          )}
        </div>

        {prevSnapshot && !saving && (
          <button
            onClick={() => handleUndoRef.current()}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-surface2 border border-gray-600 text-app2 hover:border-gray-500 hover:text-app transition-all active:scale-95 shrink-0"
          >
            ↩ Deshacer
          </button>
        )}
      </div>

      {/* Grid cuadrantes */}
      <div className={`overflow-x-auto pb-2 transition-opacity ${saving ? 'opacity-50 pointer-events-none' : ''}`}>
        <div className="inline-flex flex-col gap-1 min-w-full">
          {odontogramType === 'adult' ? (
            <>
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
            </>
          ) : (
            <>
              <div className="flex gap-3 justify-center">
                <Quadrant teeth={CQ1} label="Q5" />
                <div className="w-px bg-surface3" />
                <Quadrant teeth={CQ2} label="Q6" />
              </div>
              <div className="border-t border-dashed border-app my-1" />
              <div className="flex gap-3 justify-center">
                <Quadrant teeth={CQ4} label="Q8" />
                <div className="w-px bg-surface3" />
                <Quadrant teeth={CQ3} label="Q7" />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Editor de pieza seleccionada */}
      {selectedTooth && mode !== 'prosthetic' && (
        <div className="mt-4 bg-surface2 rounded-xl border border-yellow-700/50 p-4">
          <div className="flex items-start gap-4">
            <div className="flex flex-col items-center gap-1 flex-shrink-0">
              <BigToothEditor n={selectedTooth} />
              <span className="text-xs text-yellow-400 font-mono font-bold">Pieza {selectedTooth}</span>
            </div>

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
                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] text-app3 font-mono uppercase tracking-wide">Estado de la pieza</span>
                  <div className="grid grid-cols-2 gap-1.5">
                    {([
                      { key: 'toExtract' as ToothStatus, label: 'Próx. a extraer', activeClass: 'bg-blue-900/60 border-blue-600 text-blue-300', hoverClass: 'hover:border-blue-700 hover:text-blue-400' },
                      { key: 'missing' as ToothStatus, label: 'Ausente / Extraído', activeClass: 'bg-red-900/60 border-red-600 text-red-300', hoverClass: 'hover:border-red-700 hover:text-red-400' },
                    ] as const).map(({ key, label, activeClass, hoverClass }) => {
                      const active = getToothStatus(getState(selectedTooth)) === key
                      return (
                        <button
                          key={key}
                          onClick={() => setStatus(selectedTooth, key)}
                          className={`text-xs font-semibold py-2.5 rounded-xl transition-all active:scale-95 border ${active ? activeClass : `bg-surface2 border-gray-600 text-app2 ${hoverClass}`}`}
                        >
                          {label}
                        </button>
                      )
                    })}
                  </div>
                </div>
                {(() => {
                  const tp = prosthetics.find(p => p.teeth.includes(selectedTooth))
                  if (!tp) return null
                  return (
                    <div className="flex items-center justify-between bg-surface3 rounded-lg px-3 py-2 border border-gray-700">
                      <span className="text-xs text-app2">
                        {tp.type === 'bridge' ? 'Puente fijo' : tp.type === 'removable' ? 'Prótesis removible' : 'Corona'} · {tp.color === 'red' ? 'Existente' : 'A realizar'} · piezas {tp.teeth.join(', ')}
                      </span>
                      <button onClick={() => deleteProsthetic(tp.id)} className="text-xs text-red-400 hover:text-red-300 font-semibold ml-3 shrink-0">
                        Eliminar
                      </button>
                    </div>
                  )
                })()}
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      const newState = { note: getState(selectedTooth).note }
                      setTeeth(prev => ({ ...prev, [selectedTooth]: newState }))
                      await onSaveTooth(selectedTooth, { surfaces: surfacesFor(selectedTooth, newState) }, newState.note ?? '')
                    }}
                    className="flex-1 px-4 py-2 rounded-xl text-xs font-semibold bg-surface2 border border-gray-600 text-app2 hover:border-gray-500 transition-all active:scale-95"
                  >
                    Borrar marcas
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lista de prótesis aplicadas */}
      {mode === 'prosthetic' && prosthetics.length > 0 && (
        <div className="mt-4 bg-surface2 rounded-xl border border-gray-700 overflow-hidden">
          <div className="px-3 py-2 border-b border-gray-700">
            <span className="text-xs font-semibold text-app2 uppercase tracking-wider">Prótesis aplicadas</span>
          </div>
          <div className="divide-y divide-gray-700/50">
            {prosthetics.map(p => (
              <div key={p.id} className="flex items-center justify-between px-3 py-2">
                <span className="text-xs text-app2">
                  <span className={`inline-block w-2 h-2 rounded-full mr-1.5 ${p.color === 'red' ? 'bg-red-500' : 'bg-blue-500'}`} />
                  {p.type === 'bridge' ? 'Puente fijo' : 'Removible'} · {p.color === 'red' ? 'Existente' : 'A realizar'} · piezas {p.teeth.join(', ')}
                </span>
                <button
                  onClick={() => deleteProsthetic(p.id)}
                  className="text-xs text-red-400 hover:text-red-300 font-semibold ml-3 shrink-0 active:scale-95 transition-all"
                >
                  Eliminar
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Leyenda */}
      <div className="flex flex-wrap gap-4 mt-4 text-xs text-app3">
        {mode === 'paint' ? (
          <>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-red-600 inline-block" />
              Ya realizado
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-blue-600 inline-block" />
              Por realizar
            </span>
            <span className="flex items-center gap-1.5">
              <svg width="12" height="12" viewBox="0 0 12 12" className="inline-block flex-shrink-0"><line x1="1" y1="1" x2="11" y2="11" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" /><line x1="11" y1="1" x2="1" y2="11" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" /></svg>
              Próxima a extraer
            </span>
            <span className="flex items-center gap-1.5">
              <svg width="12" height="12" viewBox="0 0 12 12" className="inline-block flex-shrink-0"><line x1="1" y1="1" x2="11" y2="11" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" /><line x1="11" y1="1" x2="1" y2="11" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" /></svg>
              Ausente / Extraído
            </span>
          </>
        ) : (
          <>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full border-2 border-red-500 inline-block" />
              Corona existente
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full border-2 border-blue-500 inline-block" />
              Corona próxima
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-5 h-2 bg-red-600 inline-block rounded-sm" />
              Puente fijo existente
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-5 h-2 bg-blue-600 inline-block rounded-sm" />
              Puente fijo a realizar
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-5 h-3 border-2 border-dashed border-red-500 inline-block" />
              Removible existente
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-5 h-3 border-2 border-dashed border-blue-500 inline-block" />
              Removible a realizar
            </span>
          </>
        )}
      </div>
    </div>
  )
}
