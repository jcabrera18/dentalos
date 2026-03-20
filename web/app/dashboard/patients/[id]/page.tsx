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
  const [toothDiagnostics, setToothDiagnostics] = useState<any[]>([])
  const [uploading, setUploading] = useState(false)
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
      setFiles(fileList ?? [])

      setPatient(patientData.data)
      setBalance(balanceData.data)
      setOdontogram(odontogramData.data ?? [])
      setToothDiagnostics(diagData.data ?? [])
      setLoading(false)
    }
    load()
  }, [])

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

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const sb = createClient()
      const ext = file.name.split('.').pop()
      const path = `${params.id}/${Date.now()}.${ext}`
      await sb.storage.from('patient-files').upload(path, file)
      const { data: fileList } = await sb.storage.from('patient-files').list(`${params.id}/`)
      setFiles(fileList ?? [])
    } finally {
      setUploading(false)
    }
  }

  async function handleFileDelete(fileName: string) {
    const sb = createClient()
    await sb.storage.from('patient-files').remove([`${params.id}/${fileName}`])
    const { data: fileList } = await sb.storage.from('patient-files').list(`${params.id}/`)
    setFiles(fileList ?? [])
  }

  async function getFileUrl(fileName: string) {
    const sb = createClient()
    const { data } = await sb.storage
      .from('patient-files')
      .createSignedUrl(`${params.id}/${fileName}`, 3600)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-gray-400">Cargando...</div>
      </div>
    )
  }

  if (!patient) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-gray-400">Paciente no encontrado</div>
      </div>
    )
  }

  const age = patient.date_of_birth
    ? Math.floor((Date.now() - new Date(patient.date_of_birth).getTime()) / 31557600000)
    : null

  async function updateTooth(toothNumber: number, condition: string, surfaces: string[]) {
    setSavingTooth(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      await apiFetch(`/treatments/odontogram/${params.id}`, {
        method: 'PUT',
        token: session.access_token,
        body: JSON.stringify({ tooth_number: toothNumber, condition, surfaces })
      })
      const data = await apiFetch(`/treatments/odontogram/${params.id}`, { token: session.access_token })
      setOdontogram(data.data ?? [])
      setSelectedTooth(null)
    } finally {
      setSavingTooth(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">

      <main className="p-6 max-w-5xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

          {/* Columna izquierda — info del paciente */}
          <div className="space-y-4">
            {/* Avatar + nombre */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 text-center">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-emerald-400 flex items-center justify-center text-2xl font-bold mx-auto mb-3">
                {patient.first_name[0]}{patient.last_name[0]}
              </div>
              <div className="font-bold text-lg">{patient.first_name} {patient.last_name}</div>
              {age && <div className="text-gray-400 text-sm mt-1">{age} años</div>}
              {patient.document_number && (
                <div className="text-gray-500 text-sm">DNI {patient.document_number}</div>
              )}
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
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
              <div className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Contacto</div>
              <div className="text-sm">📱 {patient.phone}</div>
              {patient.email && <div className="text-sm">✉️ {patient.email}</div>}
            </div>

            {/* Obra social */}
            {patient.insurance_name && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <div className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-2">Obra Social</div>
                <div className="text-sm font-medium">{patient.insurance_name} {patient.insurance_plan}</div>
                {patient.insurance_number && (
                  <div className="text-xs text-gray-500 mt-1">Afiliado: {patient.insurance_number}</div>
                )}
              </div>
            )}

            {/* Alertas médicas */}
            {patient.allergies && (
              <div className="bg-red-950/30 border border-red-800/40 rounded-xl p-4">
                <div className="text-xs text-red-400 uppercase tracking-wider font-semibold mb-2">⚠️ Alergias</div>
                <div className="text-sm text-red-300">{patient.allergies}</div>
              </div>
            )}

            {patient.current_medications && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <div className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-2">Medicación</div>
                <div className="text-sm">{patient.current_medications}</div>
              </div>
            )}

            {/* Acciones */}
            <button
              onClick={() => router.push(`/dashboard/patients/${params.id}/appointment`)}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 rounded-xl transition-colors"
            >
              📅 Nuevo turno
            </button>
          </div>

          {/* Columna derecha — historial + tratamientos */}
          <div className="md:col-span-2 space-y-6">

            {/* Odontograma */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-800">
                <h3 className="font-semibold">Odontograma</h3>
              </div>
              <div className="p-4">
                <OdontogramView
                  odontogram={odontogram}
                  diagnostics={toothDiagnostics}
                  selectedTooth={selectedTooth}
                  onSelectTooth={setSelectedTooth}
                  onUpdateTooth={updateTooth}
                  onAddDiagnostic={addDiagnostic}
                  onDeleteDiagnostic={deleteDiagnostic}
                  saving={savingTooth}
                />
              </div>
            </div>

            {/* Archivos y radiografías */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
                <h3 className="font-semibold">Archivos y radiografías</h3>
                <label className={`cursor-pointer text-xs font-semibold px-3 py-1.5 rounded-lg transition-all active:scale-95 ${uploading
                  ? 'bg-gray-700 text-gray-500'
                  : 'bg-blue-500 hover:bg-blue-600 text-white'
                  }`}>
                  {uploading ? 'Subiendo...' : '+ Subir archivo'}
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*,.pdf,.dcm"
                    onChange={handleFileUpload}
                    disabled={uploading}
                  />
                </label>
              </div>

              {files.length === 0 ? (
                <div className="px-6 py-8 text-center">
                  <div className="text-3xl mb-2">📁</div>
                  <div className="text-gray-500 text-sm">Sin archivos adjuntos</div>
                  <div className="text-gray-600 text-xs mt-1">
                    Radiografías, fotos, documentos
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-gray-800">
                  {files.map((file: any) => {
                    const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(file.name)
                    const isPdf = /\.pdf$/i.test(file.name)
                    const icon = isImage ? '🖼️' : isPdf ? '📄' : '📁'
                    const size = file.metadata?.size
                      ? `${(file.metadata.size / 1024).toFixed(0)} KB`
                      : ''
                    const date = file.created_at
                      ? new Date(file.created_at).toLocaleDateString('es-AR', {
                        day: 'numeric', month: 'short', year: 'numeric'
                      })
                      : ''

                    return (
                      <div key={file.name} className="px-6 py-3 flex items-center gap-3">
                        <span className="text-2xl flex-shrink-0">{icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{file.name}</div>
                          <div className="text-xs text-gray-500">{date} {size}</div>
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          <button
                            onClick={() => getFileUrl(file.name)}
                            className="text-xs bg-gray-800 hover:bg-gray-700 active:scale-95 text-gray-300 px-3 py-1.5 rounded-lg transition-all"
                          >
                            Ver
                          </button>
                          <button
                            onClick={() => handleFileDelete(file.name)}
                            className="text-xs bg-red-900/30 hover:bg-red-900/50 active:scale-95 text-red-400 px-3 py-1.5 rounded-lg transition-all"
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
              <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-800">
                  <h3 className="font-semibold">📋 Tratamientos activos</h3>
                </div>
                <div className="divide-y divide-gray-800">
                  {patient.treatments
                    .filter((t: any) => t.status === 'in_progress' || t.status === 'accepted')
                    .map((t: any) => (
                      <div key={t.id} className="px-6 py-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-medium">{t.name}</div>
                          <div className="text-sm font-mono text-gray-400">
                            {t.sessions_done} / {t.sessions_planned ?? '?'} sesiones
                          </div>
                        </div>
                        {t.sessions_planned && (
                          <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-blue-500 to-emerald-400 rounded-full"
                              style={{ width: `${Math.min(100, (t.sessions_done / t.sessions_planned) * 100)}%` }}
                            />
                          </div>
                        )}
                        {t.total_quoted && (
                          <div className="flex justify-between text-xs text-gray-500 mt-2">
                            <span>Presupuesto: ${Number(t.total_quoted).toLocaleString('es-AR')}</span>
                            <span>Pagado: ${Number(t.total_paid).toLocaleString('es-AR')}</span>
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Historial de turnos */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-800">
                <h3 className="font-semibold">📖 Historial de turnos</h3>
              </div>
              {!patient.appointments?.length ? (
                <div className="px-6 py-8 text-center text-gray-500 text-sm">
                  Sin historial de turnos
                </div>
              ) : (
                <div className="divide-y divide-gray-800">
                  {[...patient.appointments]
                    .sort((a: any, b: any) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime())
                    .map((appt: any) => (
                      <div key={appt.id} className="px-6 py-4 flex items-center gap-4">
                        <div className="text-sm font-mono text-gray-400 flex-shrink-0 w-28">
                          {new Date(appt.starts_at).toLocaleDateString('es-AR', {
                            day: 'numeric', month: 'short', year: 'numeric',
                            timeZone: 'America/Argentina/Buenos_Aires'
                          })}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">
                            {appt.appointment_type ?? 'Consulta'}
                          </div>
                        </div>
                        <span className={`text-xs font-semibold px-2 py-1 rounded-full flex-shrink-0 ${appt.status === 'completed' ? 'bg-emerald-900/40 text-emerald-400' :
                          appt.status === 'absent' ? 'bg-red-900/40 text-red-400' :
                            appt.status === 'cancelled' ? 'bg-gray-800 text-gray-500' :
                              'bg-amber-900/40 text-amber-400'
                          }`}>
                          {appt.status === 'completed' ? 'Atendido' :
                            appt.status === 'absent' ? 'Ausente' :
                              appt.status === 'cancelled' ? 'Cancelado' : 'Pendiente'}
                        </span>
                      </div>
                    ))}
                </div>
              )}
            </div>

          </div>
        </div>
      </main>
    </div>
  )
}

const TOOTH_CONDITIONS = [
  // Estado actual (ROJO) — lo que ya está hecho
  { value: 'healthy', label: 'Sana', group: 'done' },
  { value: 'filled', label: 'Obturada', group: 'done' },
  { value: 'root_canal', label: 'Endodoncia', group: 'done' },
  { value: 'crown', label: 'Corona', group: 'done' },
  { value: 'missing', label: 'Ausente', group: 'done' },
  { value: 'implant', label: 'Implante', group: 'done' },
  // Plan de tratamiento (AZUL) — lo que hay que hacer
  { value: 'cavity', label: 'Caries', group: 'plan' },
  { value: 'extraction_needed', label: 'Extraer', group: 'plan' },
  { value: 'fracture', label: 'Fractura', group: 'plan' },
  { value: 'other', label: 'Otro', group: 'plan' },
]

// Colores para el SVG del diente
const CONDITION_SVG_COLOR: Record<string, string> = {
  // Estado actual → ROJO
  filled: '#7f1d1d',
  root_canal: '#7f1d1d',
  crown: '#7f1d1d',
  missing: '#111827',
  implant: '#7f1d1d',
  // Plan → AZUL
  cavity: '#1e3a5f',
  extraction_needed: '#1e3a5f',
  fracture: '#1e3a5f',
  other: '#1e3a5f',
  // Sana → gris
  healthy: '#1f2937',
}

// Colores para texto/badges
const CONDITION_TEXT: Record<string, string> = {
  filled: 'text-red-400',
  root_canal: 'text-red-400',
  crown: 'text-red-400',
  missing: 'text-gray-600',
  implant: 'text-red-400',
  cavity: 'text-blue-400',
  extraction_needed: 'text-blue-400',
  fracture: 'text-blue-400',
  other: 'text-blue-400',
  healthy: 'text-gray-500',
}

// Cuadrantes FDI
const Q1 = [18, 17, 16, 15, 14, 13, 12, 11] // Superior derecho
const Q2 = [21, 22, 23, 24, 25, 26, 27, 28] // Superior izquierdo
const Q3 = [31, 32, 33, 34, 35, 36, 37, 38] // Inferior izquierdo
const Q4 = [48, 47, 46, 45, 44, 43, 42, 41] // Inferior derecho

// Caras del diente
const FACES = [
  { key: 'V', label: 'V', title: 'Vestibular', pos: 'top' },
  { key: 'M', label: 'M', title: 'Mesial', pos: 'left' },
  { key: 'O', label: 'O', title: 'Oclusal', pos: 'center' },
  { key: 'D', label: 'D', title: 'Distal', pos: 'right' },
  { key: 'L', label: 'L', title: 'Lingual', pos: 'bottom' },
]

function ToothSVG({ condition, surfaces, onClick, isSelected, number }: {
  condition: string
  surfaces: string[]
  onClick: () => void
  isSelected: boolean
  number: number
}) {
  const condColor = CONDITION_SVG_COLOR[condition] ?? '#1f2937'

  function faceColor(face: string) {
    return surfaces.includes(face) ? condColor : '#1f2937'
  }

  return (
    <div
      className={`flex flex-col items-center gap-0.5 cursor-pointer group`}
      onClick={onClick}
    >
      <svg
        width="36" height="36" viewBox="0 0 36 36"
        className={`transition-all ${isSelected ? 'drop-shadow-[0_0_4px_rgba(96,165,250,0.8)]' : 'hover:drop-shadow-[0_0_3px_rgba(156,163,175,0.5)]'}`}
      >
        {/* Vestibular (top) */}
        <polygon points="18,2 32,12 4,12" fill={faceColor('V')} stroke="#374151" strokeWidth="0.5" />
        {/* Lingual (bottom) */}
        <polygon points="18,34 32,24 4,24" fill={faceColor('L')} stroke="#374151" strokeWidth="0.5" />
        {/* Mesial (left) */}
        <polygon points="2,18 12,4 12,32" fill={faceColor('M')} stroke="#374151" strokeWidth="0.5" />
        {/* Distal (right) */}
        <polygon points="34,18 24,4 24,32" fill={faceColor('D')} stroke="#374151" strokeWidth="0.5" />
        {/* Oclusal (center) */}
        <polygon points="12,12 24,12 24,24 12,24" fill={faceColor('O')} stroke="#374151" strokeWidth="0.5" />
        {/* Border */}
        <rect x="1" y="1" width="34" height="34" rx="4"
          fill="none"
          stroke={isSelected ? '#60a5fa' : '#4b5563'}
          strokeWidth={isSelected ? "2" : "1"}
        />
      </svg>
      <span className={`text-[9px] font-mono font-bold transition-colors ${isSelected ? 'text-blue-400' : CONDITION_TEXT[condition] ?? 'text-gray-500'
        }`}>
        {number}
      </span>
    </div>
  )
}

const DIAGNOSTICOS_COMUNES = [
  { code: 'K02.0', label: 'Caries limitada al esmalte' },
  { code: 'K02.1', label: 'Caries de la dentina' },
  { code: 'K02.3', label: 'Caries del cemento' },
  { code: 'K04.0', label: 'Pulpitis' },
  { code: 'K04.1', label: 'Necrosis de la pulpa' },
  { code: 'K04.5', label: 'Periodontitis apical crónica' },
  { code: 'K05.1', label: 'Periodontitis crónica' },
  { code: 'K08.1', label: 'Pérdida de dientes por accidente' },
  { code: 'K08.2', label: 'Atrofia del reborde alveolar' },
  { code: 'S02.5', label: 'Fractura dental' },
]

const PROCEDIMIENTOS_COMUNES = [
  'Obturación composite',
  'Obturación amalgama',
  'Endodoncia',
  'Extracción simple',
  'Extracción quirúrgica',
  'Corona metal-porcelana',
  'Corona zirconia',
  'Implante oseointegrado',
  'Tartrectomía',
  'Blanqueamiento',
  'Restauración de caries',
  'Sellante de fosas',
]

const FACES_MAP = [
  { key: 'V', title: 'Vestibular' },
  { key: 'M', title: 'Mesial' },
  { key: 'O', title: 'Oclusal' },
  { key: 'D', title: 'Distal' },
  { key: 'L', title: 'Lingual' },
]

function OdontogramView({ odontogram, diagnostics, selectedTooth, onSelectTooth, onUpdateTooth, onAddDiagnostic, onDeleteDiagnostic, saving }: {
  odontogram: any[]
  diagnostics: any[]
  selectedTooth: number | null
  onSelectTooth: (n: number | null) => void
  onUpdateTooth: (n: number, condition: string, surfaces: string[]) => void
  onAddDiagnostic: (d: any) => Promise<void>
  onDeleteDiagnostic: (id: string) => Promise<void>
  saving: boolean
}) {
  const [tab, setTab] = useState<'condition' | 'diagnostic'>('condition')
  const [selectedCondition, setSelectedCondition] = useState('cavity')
  const [selectedSurfaces, setSelectedSurfaces] = useState<string[]>([])
  const [diagFace, setDiagFace] = useState('')
  const [diagCode, setDiagCode] = useState('')
  const [diagLabel, setDiagLabel] = useState('')
  const [diagProc, setDiagProc] = useState('')
  const [addingDiag, setAddingDiag] = useState(false)

  function getToothData(n: number) {
    const t = odontogram.find(t => t.tooth_number === n)
    return { condition: t?.condition ?? 'healthy', surfaces: t?.surfaces ?? [] }
  }

  function toggleSurface(face: string) {
    setSelectedSurfaces(s =>
      s.includes(face) ? s.filter(x => x !== face) : [...s, face]
    )
  }

  function handleApplyCondition() {
    if (!selectedTooth) return
    onUpdateTooth(selectedTooth, selectedCondition, selectedSurfaces)
    setSelectedSurfaces([])
  }

  async function handleAddDiagnostic() {
    if (!selectedTooth || !diagLabel) return
    setAddingDiag(true)
    await onAddDiagnostic({
      tooth_number: selectedTooth,
      face: diagFace || undefined,
      diagnosis_code: diagCode || undefined,
      diagnosis_label: diagLabel,
      procedure: diagProc || undefined,
    })
    setDiagFace('')
    setDiagCode('')
    setDiagLabel('')
    setDiagProc('')
    setAddingDiag(false)
  }

  function selectDiagnostico(d: { code: string; label: string }) {
    setDiagCode(d.code)
    setDiagLabel(d.label)
  }

  function Quadrant({ teeth, label }: { teeth: number[]; label: string }) {
    return (
      <div>
        <div className="text-xs text-gray-600 font-mono text-center mb-1">{label}</div>
        <div className="flex gap-1">
          {teeth.map(n => {
            const { condition, surfaces } = getToothData(n)
            const hasDiag = diagnostics.some(d => d.tooth_number === n)
            return (
              <div key={n} className="flex flex-col items-center">
                <ToothSVG
                  number={n}
                  condition={condition}
                  surfaces={surfaces}
                  isSelected={selectedTooth === n}
                  onClick={() => {
                    if (selectedTooth === n) {
                      onSelectTooth(null)
                      setSelectedSurfaces([])
                    } else {
                      onSelectTooth(n)
                      const d = getToothData(n)
                      setSelectedSurfaces(d.surfaces)
                      setSelectedCondition(d.condition === 'healthy' ? 'cavity' : d.condition)
                    }
                  }}
                />
                {hasDiag && (
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-0.5" />
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // Diagnósticos del diente seleccionado
  const toothDiags = selectedTooth
    ? diagnostics.filter(d => d.tooth_number === selectedTooth)
    : []

  return (
    <div>
      {/* Grid cuadrantes */}
      <div className="overflow-x-auto pb-2">
        <div className="inline-block min-w-full">
          <div className="flex gap-2 justify-center mb-1">
            <Quadrant teeth={Q1} label="Q1 — Sup. Der." />
            <div className="w-px bg-gray-700 mx-1" />
            <Quadrant teeth={Q2} label="Q2 — Sup. Izq." />
          </div>
          <div className="border-t border-dashed border-gray-700 my-2" />
          <div className="flex gap-2 justify-center mt-1">
            <Quadrant teeth={Q4} label="Q4 — Inf. Der." />
            <div className="w-px bg-gray-700 mx-1" />
            <Quadrant teeth={Q3} label="Q3 — Inf. Izq." />
          </div>
        </div>
      </div>

      {/* Panel pieza seleccionada */}
      {selectedTooth && (
        <div className="mt-4 bg-gray-800 rounded-xl border border-blue-800/50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
            <div className="font-bold text-blue-400">Pieza {selectedTooth}</div>
            <div className="flex gap-1">
              <button onClick={() => setTab('condition')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${tab === 'condition' ? 'bg-blue-500 text-white' : 'text-gray-400 hover:text-white'
                  }`}>
                Condición
              </button>
              <button onClick={() => setTab('diagnostic')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${tab === 'diagnostic' ? 'bg-blue-500 text-white' : 'text-gray-400 hover:text-white'
                  }`}>
                Diagnóstico {toothDiags.length > 0 && `(${toothDiags.length})`}
              </button>
            </div>
            <button onClick={() => { onSelectTooth(null); setSelectedSurfaces([]) }}
              className="text-gray-500 hover:text-white text-xs">✕</button>
          </div>

          {/* Tab: Condición */}
          {tab === 'condition' && (
            <div className="p-4">
              <div className="mb-4">
                <div className="text-xs text-gray-400 uppercase tracking-wider mb-2">Caras afectadas</div>
                <div className="flex gap-2 flex-wrap">
                  {FACES_MAP.map(f => (
                    <button key={f.key}
                      onClick={() => toggleSurface(f.key)}
                      title={f.title}
                      className={`w-10 h-10 rounded-lg text-xs font-bold transition-all active:scale-90 ${selectedSurfaces.includes(f.key)
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                        }`}>
                      {f.key}
                    </button>
                  ))}
                </div>
                <div className="text-xs text-gray-600 mt-1">
                  V=Vestibular · M=Mesial · O=Oclusal · D=Distal · L=Lingual
                </div>
              </div>
              <div className="mb-4">
                <div className="text-xs text-gray-400 uppercase tracking-wider mb-2">Condición</div>
                <div className="mb-3">
                  <div className="text-xs text-red-400 font-semibold uppercase tracking-wider mb-1">
                    Rojo — Estado actual
                  </div>
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    {TOOTH_CONDITIONS.filter(c => c.group === 'done').map(c => (
                      <button key={c.value}
                        onClick={() => setSelectedCondition(c.value)}
                        className={`py-2 px-2 rounded-lg text-xs font-semibold transition-all active:scale-95 border ${selectedCondition === c.value
                          ? 'border-red-400 bg-red-900/40 text-red-300'
                          : 'border-gray-700 bg-gray-700/50 text-gray-400 hover:border-gray-500'
                          }`}>
                        {c.label}
                      </button>
                    ))}
                  </div>
                  <div className="text-xs text-blue-400 font-semibold uppercase tracking-wider mb-1">
                    Azul — Plan de tratamiento
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {TOOTH_CONDITIONS.filter(c => c.group === 'plan').map(c => (
                      <button key={c.value}
                        onClick={() => setSelectedCondition(c.value)}
                        className={`py-2 px-2 rounded-lg text-xs font-semibold transition-all active:scale-95 border ${selectedCondition === c.value
                          ? 'border-blue-400 bg-blue-900/40 text-blue-300'
                          : 'border-gray-700 bg-gray-700/50 text-gray-400 hover:border-gray-500'
                          }`}>
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <button onClick={handleApplyCondition} disabled={saving}
                className="w-full bg-blue-500 hover:bg-blue-600 disabled:opacity-50 active:scale-95 text-white font-semibold py-2.5 rounded-xl transition-all text-sm">
                {saving ? 'Guardando...' : 'Aplicar condición'}
              </button>
            </div>
          )}

          {/* Tab: Diagnóstico */}
          {tab === 'diagnostic' && (
            <div className="p-4">
              {/* Diagnósticos existentes */}
              {toothDiags.length > 0 && (
                <div className="mb-4">
                  <div className="text-xs text-gray-400 uppercase tracking-wider mb-2">Registrados</div>
                  <div className="space-y-2">
                    {toothDiags.map(d => (
                      <div key={d.id} className="bg-gray-700/50 rounded-lg p-3 flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-white">
                            {d.diagnosis_code && <span className="text-blue-400 mr-1">{d.diagnosis_code}</span>}
                            {d.diagnosis_label}
                          </div>
                          {d.face && <div className="text-xs text-gray-400">Cara: {d.face}</div>}
                          {d.procedure && <div className="text-xs text-gray-400">Proc: {d.procedure}</div>}
                        </div>
                        <button onClick={() => onDeleteDiagnostic(d.id)}
                          className="text-red-400 hover:text-red-300 text-xs flex-shrink-0 active:scale-90">
                          🗑
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Nuevo diagnóstico */}
              <div>
                <div className="text-xs text-gray-400 uppercase tracking-wider mb-3">Agregar diagnóstico</div>

                {/* Cara */}
                <div className="mb-3">
                  <div className="text-xs text-gray-500 mb-1">Cara</div>
                  <div className="flex gap-2 flex-wrap">
                    {['', ...FACES_MAP.map(f => f.key)].map(f => (
                      <button key={f || 'all'}
                        onClick={() => setDiagFace(f)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors active:scale-95 ${diagFace === f
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                          }`}>
                        {f || 'General'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Diagnósticos comunes */}
                <div className="mb-3">
                  <div className="text-xs text-gray-500 mb-1">Diagnóstico CIE-10</div>
                  <div className="grid grid-cols-1 gap-1 max-h-32 overflow-y-auto mb-2">
                    {DIAGNOSTICOS_COMUNES.map(d => (
                      <button key={d.code}
                        onClick={() => selectDiagnostico(d)}
                        className={`text-left px-3 py-1.5 rounded-lg text-xs transition-colors active:scale-95 ${diagCode === d.code
                          ? 'bg-blue-900/60 border border-blue-500 text-blue-300'
                          : 'bg-gray-700/50 hover:bg-gray-700 text-gray-300'
                          }`}>
                        <span className="text-blue-400 font-mono mr-1">{d.code}</span>
                        {d.label}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={diagLabel}
                    onChange={e => setDiagLabel(e.target.value)}
                    placeholder="O escribí un diagnóstico libre..."
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-blue-400"
                  />
                </div>

                {/* Procedimiento */}
                <div className="mb-4">
                  <div className="text-xs text-gray-500 mb-1">Procedimiento (opcional)</div>
                  <div className="grid grid-cols-2 gap-1 max-h-28 overflow-y-auto mb-2">
                    {PROCEDIMIENTOS_COMUNES.map(p => (
                      <button key={p}
                        onClick={() => setDiagProc(p)}
                        className={`text-left px-2 py-1.5 rounded-lg text-xs transition-colors active:scale-95 ${diagProc === p
                          ? 'bg-blue-900/60 border border-blue-500 text-blue-300'
                          : 'bg-gray-700/50 hover:bg-gray-700 text-gray-300'
                          }`}>
                        {p}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={diagProc}
                    onChange={e => setDiagProc(e.target.value)}
                    placeholder="O escribí un procedimiento libre..."
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-blue-400"
                  />
                </div>

                <button
                  onClick={handleAddDiagnostic}
                  disabled={!diagLabel || addingDiag}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 active:scale-95 text-white font-semibold py-2.5 rounded-xl transition-all text-sm"
                >
                  {addingDiag ? 'Guardando...' : '+ Agregar diagnóstico'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tabla de todos los diagnósticos */}
      {diagnostics.length > 0 && (
        <div className="mt-6">
          <div className="text-xs text-gray-400 uppercase tracking-wider mb-3">
            Todos los diagnósticos ({diagnostics.length})
          </div>
          <div className="bg-gray-800 rounded-xl overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left px-3 py-2 text-gray-500 font-semibold">Diagnóstico</th>
                  <th className="text-left px-3 py-2 text-gray-500 font-semibold">Procedimiento</th>
                  <th className="text-left px-3 py-2 text-gray-500 font-semibold">Pieza</th>
                  <th className="text-left px-3 py-2 text-gray-500 font-semibold">Cara</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {diagnostics.map(d => (
                  <tr key={d.id} className="hover:bg-gray-700/30 transition-colors">
                    <td className="px-3 py-2">
                      {d.diagnosis_code && (
                        <span className="text-blue-400 font-mono mr-1">{d.diagnosis_code}</span>
                      )}
                      <span className="text-gray-300">{d.diagnosis_label}</span>
                    </td>
                    <td className="px-3 py-2 text-gray-400">{d.procedure ?? '—'}</td>
                    <td className="px-3 py-2 text-gray-400 font-mono">{d.tooth_number}</td>
                    <td className="px-3 py-2 text-gray-400">{d.face ?? '—'}</td>
                    <td className="px-3 py-2 text-right">
                      <button onClick={() => onDeleteDiagnostic(d.id)}
                        className="text-red-400 hover:text-red-300 active:scale-90 transition-all">
                        🗑
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Leyenda */}
      <div className="flex flex-wrap gap-3 mt-4">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-red-800 inline-block" />
          <span className="text-xs text-gray-400">Estado actual (obturada, corona, implante...)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-blue-900 inline-block" />
          <span className="text-xs text-gray-400">Plan de tratamiento (caries, extraer, fractura...)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-gray-700 inline-block" />
          <span className="text-xs text-gray-400">Sana</span>
        </div>
      </div>
    </div>
  )
}