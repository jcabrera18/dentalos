'use client'

import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { createClient, getToken as getSupabaseToken } from '@/lib/supabase'
import { apiFetch } from '@/lib/api'
import { useQueryClient } from '@tanstack/react-query'
import { useMe, useAfipConfig, usePatientOdontogram, queryKeys } from '@/lib/queries'
import { useRouter, useParams } from 'next/navigation'
import { Wallet, FileText, ClipboardList, Loader2, MoreVertical } from 'lucide-react'
import { PaymentModal } from '@/components/PaymentModal'
import { InvoiceModal } from '@/components/InvoiceModal'
import { downloadAccountStatementPNG, downloadReceiptPNG } from '@/components/generateReceipt'
import { PatientNotesSection } from '@/components/PatientNotesSection'
import { PatientFilesSection } from '@/components/PatientFilesSection'
import { PatientAppointmentsSection } from '@/components/PatientAppointmentsSection'

const EMPTY_ACCOUNT_SUMMARY = {
  total_billed: 0,
  total_collected: 0,
  balance_due: 0,
  payments_count: 0,
  last_payment_at: null,
}

const ACCOUNT_PAGE_SIZE = 5

function hasExplicitTotalAmount(payment: { total_amount?: number | string | null }) {
  return payment.total_amount !== null && payment.total_amount !== undefined
}

function normalizePatientTextField(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function buildPatientUpdatePayload(editForm: Record<string, unknown>) {
  const payload: Record<string, string | null> = {
    first_name: normalizePatientTextField(editForm.first_name),
    last_name: normalizePatientTextField(editForm.last_name),
    phone: normalizePatientTextField(editForm.phone),
    email: normalizePatientTextField(editForm.email),
    address: normalizePatientTextField(editForm.address),
    document_number: normalizePatientTextField(editForm.document_number),
    gender: typeof editForm.gender === 'string' && editForm.gender ? editForm.gender : null,
    insurance_name: normalizePatientTextField(editForm.insurance_name),
    insurance_plan: normalizePatientTextField(editForm.insurance_plan),
    insurance_number: normalizePatientTextField(editForm.insurance_number),
    allergies: normalizePatientTextField(editForm.allergies),
    current_medications: normalizePatientTextField(editForm.current_medications),
  }

  const dateOfBirth = normalizePatientTextField(editForm.date_of_birth)

  // The API expects a real YYYY-MM-DD value for DATE columns; empty strings break the PATCH.
  if (dateOfBirth) {
    payload.date_of_birth = dateOfBirth
  }

  return payload
}

export default function PatientDetailClient({
  initialPatient,
  initialToken,
  patientId,
  initialClinicalHistory = null,
}: {
  initialPatient: any
  initialToken: string
  patientId: string
  initialClinicalHistory?: any
}) {
  const [patient, setPatient] = useState<any>(initialPatient)
  const [accountSummary, setAccountSummary] = useState(EMPTY_ACCOUNT_SUMMARY)
  const [selectedTooth, setSelectedTooth] = useState<number | null>(null)
  const [savingTooth, setSavingTooth] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [editForm, setEditForm] = useState<any>({})
  const [editErrors, setEditErrors] = useState<Record<string, string>>({})
  const [editSubmitError, setEditSubmitError] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showAccountModal, setShowAccountModal] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [editingPayment, setEditingPayment] = useState<any>(null)
  const [paymentPrefillAmount, setPaymentPrefillAmount] = useState<number | null>(null)
  const [token] = useState(initialToken)
  const [accountPayments, setAccountPayments] = useState<any[]>([])
  const [accountPage, setAccountPage] = useState(0)
  const [accountTotal, setAccountTotal] = useState(0)
  const [accountLoading, setAccountLoading] = useState(false)
  const [accountPageLoading, setAccountPageLoading] = useState(false)
  // Menú por cobro dentro de la cuenta corriente (Editar / Facturar / Recibo / Eliminar)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [menuOpenUp, setMenuOpenUp] = useState(false)
  const [invoicesMap, setInvoicesMap] = useState<Record<string, any>>({})
  const [invoiceModalPayment, setInvoiceModalPayment] = useState<any>(null)
  const [downloadingPdfId, setDownloadingPdfId] = useState<string | null>(null)
  const [paymentToDelete, setPaymentToDelete] = useState<any>(null)
  const [deletingPayment, setDeletingPayment] = useState(false)
  const [deletePaymentError, setDeletePaymentError] = useState('')
  const [odontogramActiveType, setOdontogramActiveType] = useState<'adult' | 'child'>(
    (initialPatient?.odontogram_type as 'adult' | 'child') ?? 'adult'
  )
  const [clinicalHistory, setClinicalHistory] = useState<any>(initialClinicalHistory)
  const [clinicalHistoryLoaded, setClinicalHistoryLoaded] = useState(initialClinicalHistory !== null)

  // Data de solo-lectura via React Query: cachea en IndexedDB por paciente → revisitar es instantáneo.
  // (Los archivos/radiografías NO van por acá; los maneja PatientFilesSection aparte.)
  const odontogramQuery = usePatientOdontogram(patientId)
  const { data: me } = useMe()
  const { data: afip } = useAfipConfig()

  const odontogram: any[] = odontogramQuery.data ?? []
  const odontogramLoading = odontogramQuery.isPending

  const clinicName = (me?.clinics as any)?.name ?? me?.clinic_name ?? ''
  const myProfessionalName =
    me?.full_name ??
    (me?.first_name && me?.last_name ? `${me.first_name} ${me.last_name}` : me?.name ?? '')
  const myAfipIvaCondition = afip?.iva_condition || 'MO'
  const myAfipConfigured = !!(afip?.cuit && afip?.has_cert && afip?.has_key && afip?.afip_punto_venta)

  // --- Consentimientos ---
  const [showConsentModal, setShowConsentModal] = useState(false)
  const [consentView, setConsentView] = useState<'list' | 'select' | 'sign' | 'view'>('list')
  const [viewingConsent, setViewingConsent] = useState<any>(null)
  const [viewingConsentLoading, setViewingConsentLoading] = useState(false)
  const [consentTemplates, setConsentTemplates] = useState<any[]>([])
  const [existingConsents, setExistingConsents] = useState<any[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null)
  const [consentLoading, setConsentLoading] = useState(false)
  const [consentSaving, setConsentSaving] = useState(false)
  const [consentSaved, setConsentSaved] = useState(false)
  const [professionalName, setProfessionalName] = useState('')
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasSignature, setHasSignature] = useState(false)
  const signatureCanvasRef = useRef<HTMLCanvasElement>(null)

  const [navLoading, setNavLoading] = useState<string | null>(null)

  function navigateTo(path: string, key: string) {
    setNavLoading(key)
    window.dispatchEvent(new Event('navigation-start'))
    router.push(path)
  }

  const router = useRouter()
  const params = useParams()
  const supabase = createClient()
  const qc = useQueryClient()
  const accountDataLoadedRef = useRef(false)
  // Espejo de accountPage para leer la página actual desde callbacks con closures estables
  // (p. ej. el handler de focus/visibility, que tiene deps vacías).
  const accountPageRef = useRef(0)
  useEffect(() => { accountPageRef.current = accountPage }, [accountPage])

  async function refreshAccountSummary(accessToken: string) {
    const summaryData = await apiFetch(`/patients/${params.id}/account-summary`, {
      token: accessToken,
    })
    setAccountSummary(summaryData.data ?? EMPTY_ACCOUNT_SUMMARY)
  }

  // Paginación del lado del servidor: traemos solo la página visible (5 por vez).
  async function loadAccountPaymentsPage(accessToken: string, page: number) {
    const offset = page * ACCOUNT_PAGE_SIZE
    const paymentsData = await apiFetch(
      `/payments?patient_id=${params.id}&limit=${ACCOUNT_PAGE_SIZE}&offset=${offset}`,
      { token: accessToken },
    )
    const rows: any[] = paymentsData.data ?? []
    const total: number = paymentsData.meta?.total ?? rows.length
    // Si la página quedó fuera de rango (p. ej. tras eliminar el último cobro), retrocedemos.
    const lastPage = Math.max(0, Math.ceil(total / ACCOUNT_PAGE_SIZE) - 1)
    if (page > lastPage) {
      return loadAccountPaymentsPage(accessToken, lastPage)
    }
    setAccountPayments(rows)
    setAccountTotal(total)
    setAccountPage(page)
    const paymentIds = rows.map((r) => r.id)
    if (paymentIds.length > 0) {
      fetchInvoicesForPayments(paymentIds, accessToken)
    } else {
      setInvoicesMap({})
    }
  }

  async function goToAccountPage(page: number) {
    if (page < 0) return
    setAccountPageLoading(true)
    try {
      const t = await getSupabaseToken()
      if (!t) return
      await loadAccountPaymentsPage(t, page)
    } finally {
      setAccountPageLoading(false)
    }
  }

  async function fetchInvoicesForPayments(paymentIds: string[], accessToken: string) {
    try {
      const data = await apiFetch(`/invoices?payment_ids=${paymentIds.join(',')}`, { token: accessToken })
      const map: Record<string, any> = {}
      for (const inv of (data.data ?? [])) {
        if (inv.payment_id) map[inv.payment_id] = inv
      }
      setInvoicesMap(map)
    } catch {}
  }

  async function downloadInvoicePdf(invoiceId: string, invoiceType: string, numero: number) {
    setDownloadingPdfId(invoiceId)
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? ''
      const res = await fetch(`${apiUrl}/invoices/${invoiceId}/pdf`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('No se pudo generar el PDF')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `factura-${invoiceType}-${String(numero).padStart(8, '0')}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err: any) {
      alert(err.message ?? 'Error al descargar PDF')
    } finally {
      setDownloadingPdfId(null)
    }
  }

  async function confirmDeletePayment() {
    if (!paymentToDelete) return
    const t = await getSupabaseToken()
    if (!t) return
    setDeletingPayment(true)
    setDeletePaymentError('')
    try {
      await apiFetch(`/payments/${paymentToDelete.id}`, { method: 'DELETE', token: t })
      await refreshAccountState(t)
      setPaymentToDelete(null)
    } catch (err) {
      setDeletePaymentError(err instanceof Error ? err.message : 'No se pudo eliminar el cobro')
    } finally {
      setDeletingPayment(false)
    }
  }

  async function refreshAccountState(accessToken: string, page: number = accountPageRef.current) {
    await Promise.all([
      refreshAccountSummary(accessToken),
      loadAccountPaymentsPage(accessToken, page),
    ])
  }

  async function handleGenerateStatement() {
    // El estado de cuenta siempre muestra los 5 cobros más recientes. Como la lista
    // ahora pagina del lado del servidor, traemos la primera página fresca si hace falta.
    let recent = accountPayments
    if (accountPage !== 0) {
      const t = await getSupabaseToken()
      if (!t) return
      const data = await apiFetch(`/payments?patient_id=${params.id}&limit=${ACCOUNT_PAGE_SIZE}&offset=0`, { token: t })
      recent = data.data ?? []
    }
    const sorted = [...recent].sort((a, b) => new Date(b.paid_at).getTime() - new Date(a.paid_at).getTime())
    downloadAccountStatementPNG({
      patientName: `${patient.first_name} ${patient.last_name}`,
      clinicName: clinicName || null,
      professionalName: myProfessionalName || null,
      totalBilled: Number(accountSummary.total_billed),
      totalCollected: Number(accountSummary.total_collected),
      balanceDue: Number(accountSummary.balance_due),
      recentPayments: sorted.slice(0, 5),
    })
  }

  // Realtime: si otro dispositivo edita este paciente mientras la ficha está abierta,
  // parcheamos el cache directo desde el payload (sin re-fetch → esquiva el Redis cache
  // de 2 min de la API). El refetchOnReconnect/Focus de React Query cubre lo perdido offline.
  useEffect(() => {
    const channel = supabase
      .channel(`patient-${patientId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'odontogram', filter: `patient_id=eq.${patientId}` },
        (payload: any) => {
          qc.setQueryData<any[]>(queryKeys.patientOdontogram(patientId), (prev) => {
            const rows = prev ?? []
            if (payload.eventType === 'DELETE') {
              return rows.filter((r) => r.id !== payload.old?.id)
            }
            const row = payload.new
            if (!row?.id) return rows
            const idx = rows.findIndex((r) => r.id === row.id)
            if (idx === -1) return [...rows, row]
            const copy = rows.slice()
            copy[idx] = { ...copy[idx], ...row }
            return copy
          })
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'patients', filter: `id=eq.${patientId}` },
        (payload: any) => {
          const row = payload.new
          if (!row?.id) return
          // Spread sobre prev: conserva `treatments` (viene aparte, no en la fila de patients).
          setPatient((prev: any) => ({ ...prev, ...row }))
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [patientId, qc, supabase])

  useEffect(() => {
    async function syncAccountState() {
      // Solo sincronizar si el modal fue abierto al menos una vez
      if (!accountDataLoadedRef.current) return
      const token = await getSupabaseToken()
      if (!token) return
      await refreshAccountState(token)
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

  useEffect(() => {
    if (consentView !== 'sign') return
    requestAnimationFrame(() => {
      const canvas = signatureCanvasRef.current
      if (!canvas) return
      canvas.width = canvas.offsetWidth || 400
      canvas.height = 160
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.strokeStyle = '#1a1a1a'
        ctx.lineWidth = 2.5
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
      }
      setHasSignature(false)
    })
  }, [consentView])

  async function openConsentModal() {
    setShowConsentModal(true)
    setConsentView('list')
    setConsentLoading(true)
    try {
      const [templatesRes, consentsRes] = await Promise.all([
        apiFetch('/consents/templates', { token }),
        apiFetch(`/consents?patient_id=${params.id}`, { token }),
      ])
      setConsentTemplates(templatesRes.data ?? [])
      setExistingConsents(consentsRes.data ?? [])
      setProfessionalName(myProfessionalName)
    } finally {
      setConsentLoading(false)
    }
  }

  async function openConsentDetail(consentId: string) {
    setConsentView('view')
    setViewingConsent(null)
    setViewingConsentLoading(true)
    try {
      const res = await apiFetch(`/consents/${consentId}`, { token })
      setViewingConsent(res.data)
    } finally {
      setViewingConsentLoading(false)
    }
  }

  function escapeHtml(s: string) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;')
  }

  function renderConsentHtml(html: string) {
    return html
      .replace(/\{\{patient_name\}\}/g, escapeHtml(`${patient.first_name} ${patient.last_name}`))
      .replace(/\{\{patient_document\}\}/g, escapeHtml(patient.document_number ?? ''))
      .replace(/\{\{professional_name\}\}/g, escapeHtml(professionalName))
  }

  function onSignPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = signatureCanvasRef.current
    if (!canvas) return
    canvas.setPointerCapture(e.pointerId)
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.beginPath()
    ctx.moveTo((e.clientX - rect.left) * scaleX, (e.clientY - rect.top) * scaleY)
    setIsDrawing(true)
  }

  function onSignPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!isDrawing) return
    const canvas = signatureCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    ctx.lineTo((e.clientX - rect.left) * scaleX, (e.clientY - rect.top) * scaleY)
    ctx.stroke()
    setHasSignature(true)
  }

  function onSignPointerUp() {
    setIsDrawing(false)
  }

  function clearSignature() {
    const canvas = signatureCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasSignature(false)
  }

  async function handleSaveConsent() {
    if (!selectedTemplate || !hasSignature || !signatureCanvasRef.current) return
    setConsentSaving(true)
    try {
      const signatureData = signatureCanvasRef.current.toDataURL('image/png')
      const renderedHtml = renderConsentHtml(selectedTemplate.content_html)
      await apiFetch('/consents', {
        method: 'POST',
        token,
        body: JSON.stringify({
          patient_id:     params.id,
          template_id:    selectedTemplate.id,
          content_html:   renderedHtml,
          signature_data: signatureData,
        }),
      })
      const updated = await apiFetch(`/consents?patient_id=${params.id}`, { token })
      setExistingConsents(updated.data ?? [])
      setConsentSaved(true)
      setTimeout(() => {
        setConsentSaved(false)
        setConsentView('list')
        setSelectedTemplate(null)
        setHasSignature(false)
      }, 1800)
    } finally {
      setConsentSaving(false)
    }
  }

  async function openAccountModal() {
    setShowAccountModal(true)
    setAccountPage(0)
    accountDataLoadedRef.current = true
    setAccountLoading(true)
    try {
      const token = await getSupabaseToken()
      if (!token) return
      await refreshAccountState(token, 0)
    } finally {
      setAccountLoading(false)
    }
  }

  async function addDiagnostic(diag: {
    tooth_number: number
    face?: string
    diagnosis_code?: string
    diagnosis_label: string
    procedure?: string
  }) {
    await apiFetch('/treatments/tooth-diagnostics', {
      method: 'POST',
      token,
      body: JSON.stringify({ ...diag, patient_id: params.id })
    })
    await qc.invalidateQueries({ queryKey: queryKeys.patientDiagnostics(patientId) })
  }

  async function deleteDiagnostic(id: string) {
    await apiFetch(`/treatments/tooth-diagnostics/${id}`, {
      method: 'DELETE',
      token,
    })
    // Update optimista en el cache de React Query.
    qc.setQueryData<any[]>(queryKeys.patientDiagnostics(patientId), (d) =>
      (d ?? []).filter((x) => x.id !== id))
  }

  async function handleDeletePatient() {
    setDeleting(true)
    await apiFetch(`/patients/${params.id}`, {
      method: 'DELETE',
      token,
    })
    router.push('/patients')
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
    setEditSubmitError('')

    setSavingEdit(true)

    try {
      const { data: updatedPatient } = await apiFetch(`/patients/${params.id}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify(buildPatientUpdatePayload(editForm))
      })
      setPatient((prev: any) => ({ treatments: prev.treatments, ...updatedPatient }))
      setEditMode(false)
      setDeleteConfirm(false)
    } catch (err: unknown) {
      setEditSubmitError(err instanceof Error ? err.message : 'No se pudo guardar el paciente')
    } finally {
      setSavingEdit(false)
    }
  }

  const updateTeethBulk = useCallback(async (teeth: Array<{ toothNumber: number; surfaces: string; note: string }>) => {
    setSavingTooth(true)
    try {
      await apiFetch(`/treatments/odontogram/${params.id}/bulk`, {
        method: 'PUT',
        token,
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
      await qc.invalidateQueries({ queryKey: queryKeys.patientOdontogram(patientId) })
    } finally {
      setSavingTooth(false)
    }
  }, [token, params.id, qc, patientId])

  const updateTooth = useCallback(async (toothNumber: number, surfaces: Record<string, string>, note: string) => {
    setSavingTooth(true)
    try {
      const surfacesArray = surfaces.surfaces
        ? surfaces.surfaces.split(',').filter(Boolean)
        : []
      await apiFetch(`/treatments/odontogram/${params.id}`, {
        method: 'PUT',
        token,
        body: JSON.stringify({
          tooth_number: toothNumber,
          condition: surfacesArray.length > 0 ? 'other' : 'healthy',
          surfaces: surfacesArray,
          notes: note || undefined,
        })
      })
      await qc.invalidateQueries({ queryKey: queryKeys.patientOdontogram(patientId) })
      setSelectedTooth(null)
    } finally {
      setSavingTooth(false)
    }
  }, [token, params.id])

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

  return (
    <div className="min-h-screen bg-app text-app">

      <main className="p-6 max-w-5xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

          {/* Columna izquierda — info del paciente */}
          <div className="space-y-4 animate-fade-in-up" style={{ animationDelay: '0ms' }}>
            {/* Avatar + nombre */}
            <div className="bg-surface border border-app rounded-xl p-6 text-center relative">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-3 ${
                patient.gender === 'F'
                  ? 'bg-pink-500/20 text-pink-400'
                  : patient.gender === 'M'
                  ? 'bg-blue-500/20 text-blue-400'
                  : 'bg-surface3 text-app2'
              }`}>
                {patient.first_name[0]}{patient.last_name[0]}
              </div>
              <div className="font-bold text-lg">{patient.first_name} {patient.last_name}</div>
              {age && <div className="text-app2 text-sm mt-1">{age} años</div>}
              {patient.document_number && (
                <div className="text-app3 text-sm">DNI {patient.document_number}</div>
              )}
              {patient.phone && (
                <div className="text-app3 text-sm">📱 {patient.phone}</div>
              )}
              {patient.email && (
                <div className="text-app3 text-sm truncate">✉️ {patient.email}</div>
              )}
              {patient.address && (
                <div className="text-app3 text-sm">📍 {patient.address}</div>
              )}
              <button
                onClick={() => {
                  setEditMode(true); setEditForm({
                    first_name: patient.first_name,
                    last_name: patient.last_name,
                    phone: patient.phone ?? '',
                    email: patient.email ?? '',
                    address: patient.address ?? '',
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
                className="mt-3 text-xs text-app3 hover:text-[#00C4BC] transition-colors cursor-pointer"
              >
                Editar datos
              </button>
            </div>

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

            {/* Badges de alertas clínicas activas */}
            {clinicalHistory?.alerts && (() => {
              const a = clinicalHistory.alerts
              const active = [
                a.aspirin && 'Aspirina',
                a.anticoagulants && 'Anticoagulantes',
                a.pregnancy && 'Embarazo',
                a.cardiac && 'Cardíaco',
                a.hypertension && 'Presión alta',
                a.seizures && 'Epilepsia',
                a.diabetes?.active && `Diabetes${!a.diabetes.controlled ? ' (no controlada)' : ''}`,
                a.infectious_disease?.active && (a.infectious_disease.detail || 'Enf. infectocontagiosa'),
              ].filter(Boolean) as string[]
              return active.length > 0 ? (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
                  <div className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-wider mb-2">⚠️ Alertas clínicas</div>
                  <div className="flex flex-wrap gap-1.5">
                    {active.map(label => (
                      <span key={label} className="text-xs font-semibold text-red-700 dark:text-red-300 bg-red-500/15 border border-red-500/20 px-2 py-0.5 rounded-md">
                        {label}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null
            })()}

            {patient.current_medications && (
              <div className="bg-surface border border-app rounded-xl p-4">
                <div className="text-xs text-app3 uppercase tracking-wider font-semibold mb-2">Medicación</div>
                <div className="text-sm">{patient.current_medications}</div>
              </div>
            )}

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

            {/* Historia clínica */}
            <button
              onClick={() => navigateTo(`/patients/${params.id}/clinical-history`, 'clinical-history')}
              className="w-full flex items-center justify-between gap-2 bg-surface border-2 border-app hover:border-[#00C4BC] hover:bg-[#E6F8F1] dark:hover:bg-[#00C4BC]/10 text-app hover:text-[#00C4BC] font-bold text-sm px-4 py-2.5 rounded-xl transition-all active:scale-95 cursor-pointer"
            >
              <span className="flex items-center gap-2">🩺  Historia clínica</span>
              {navLoading === 'clinical-history'
                ? <Loader2 size={14} className="animate-spin text-[#00C4BC]" />
                : clinicalHistory?.risk_level === 'high'
                ? <span className="text-xs font-bold text-red-400 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded-md">Alto riesgo</span>
                : clinicalHistory?.risk_level === 'medium'
                ? <span className="text-xs font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-md">Riesgo medio</span>
                : <span className="text-app3">›</span>
              }
            </button>

            <button
              onClick={openAccountModal}
              className="w-full flex items-center justify-between gap-2 bg-surface border-2 border-app hover:border-[#00C4BC] hover:bg-[#E6F8F1] dark:hover:bg-[#00C4BC]/10 text-app hover:text-[#00C4BC] font-bold text-sm px-4 py-2.5 rounded-xl transition-all active:scale-95 cursor-pointer"
            >
              <span className="flex items-center gap-2"><Wallet size={15} strokeWidth={2} /> Ver cuenta corriente</span>
              <span className="text-app3">›</span>
            </button>

            <button
              onClick={() => navigateTo(`/patients/${params.id}/consents`, 'consents')}
              className="w-full flex items-center justify-between gap-2 bg-surface border-2 border-app hover:border-[#00C4BC] hover:bg-[#E6F8F1] dark:hover:bg-[#00C4BC]/10 text-app hover:text-[#00C4BC] font-bold text-sm px-4 py-2.5 rounded-xl transition-all active:scale-95 cursor-pointer"
            >
              <span className="flex items-center gap-2"><FileText size={15} strokeWidth={2} /> Consentimientos</span>
              {navLoading === 'consents'
                ? <Loader2 size={14} className="animate-spin text-[#00C4BC]" />
                : existingConsents.length > 0
                ? <span className="text-xs font-bold text-[#00C4BC] bg-[#E6F8F1] px-2 py-0.5 rounded-md">{existingConsents.length}</span>
                : <span className="text-app3">›</span>
              }
            </button>

            <button
              onClick={() => navigateTo(`/patients/${params.id}/quotes`, 'quotes')}
              className="w-full flex items-center justify-between gap-2 bg-surface border-2 border-app hover:border-[#00C4BC] hover:bg-[#E6F8F1] dark:hover:bg-[#00C4BC]/10 text-app hover:text-[#00C4BC] font-bold text-sm px-4 py-2.5 rounded-xl transition-all active:scale-95 cursor-pointer"
            >
              <span className="flex items-center gap-2"><ClipboardList size={15} strokeWidth={2} /> Presupuestos</span>
              {navLoading === 'quotes'
                ? <Loader2 size={14} className="animate-spin text-[#00C4BC]" />
                : <span className="text-app3">›</span>
              }
            </button>

            {/* Notas del paciente */}
            <PatientNotesSection
              patientId={params.id as string}
              token={token}
              initialNotes={patient?.notes ?? ''}
            />

          </div>

          {/* Columna derecha — historial + tratamientos */}
          <div className="md:col-span-2 space-y-6 animate-fade-in-up" style={{ animationDelay: '80ms' }}>

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
                          const newType = odontogramActiveType === 'adult' ? 'child' : 'adult'
                          setOdontogramActiveType(newType)
                          await apiFetch(`/patients/${params.id}`, {
                            method: 'PATCH', token,
                            body: JSON.stringify({ odontogram_type: newType }),
                          })
                          setPatient((p: any) => ({ ...p, odontogram_type: newType }))
                        }}
                        className={`px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${odontogramActiveType === t ? 'bg-[#00C4BC]/15 border border-[#00C4BC]/40 text-[#00C4BC]' : 'text-app3 hover:text-app2'}`}
                      >{t === 'adult' ? 'Adulto' : 'Niño'}</button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="p-4">
                {odontogramLoading ? (
                  <div className="animate-pulse space-y-3 py-4">
                    <div className="h-3 bg-surface2 rounded w-full" />
                    <div className="h-3 bg-surface2 rounded w-5/6" />
                    <div className="h-3 bg-surface2 rounded w-4/6" />
                  </div>
                ) : (
                  <OdontogramView
                    odontogram={odontogram}
                    onSaveTooth={updateTooth}
                    onSaveBulk={updateTeethBulk}
                    odontogramType={odontogramActiveType}
                  />
                )}
              </div>
            </div>

            {/* Archivos y radiografías */}
            <PatientFilesSection patientId={params.id as string} />

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
                              className="h-full bg-gradient-to-r from-[#00C4BC] to-[#00aaa3] rounded-full"
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
            <PatientAppointmentsSection patientId={params.id as string} token={token} />

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
                {accountLoading ? (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="bg-surface2 rounded-xl p-3 text-center animate-pulse">
                        <div className="h-3 w-20 mx-auto mb-2 rounded bg-surface3" />
                        <div className="h-5 w-24 mx-auto rounded bg-surface3" />
                      </div>
                    ))}
                  </div>
                ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="bg-surface2 rounded-xl p-3 text-center">
                    <div className="text-xs text-app3 mb-1">Total de servicios</div>
                    <div className="text-base font-bold text-app">${Number(accountSummary.total_billed).toLocaleString('es-AR')}</div>
                  </div>
                  <div className="bg-surface2 rounded-xl p-3 text-center">
                    <div className="text-xs text-app3 mb-1">Total cobrado</div>
                    <div className="text-base font-bold text-[#00C4BC]">${Number(accountSummary.total_collected).toLocaleString('es-AR')}</div>
                  </div>
                  {(() => {
                    const due = Number(accountSummary.balance_due)
                    if (due < 0) {
                      return (
                        <div className="rounded-xl p-3 text-center bg-[#E6F8F1] border border-[#00C4BC]/30">
                          <div className="text-xs mb-1 text-[#00C4BC]">Saldo a favor</div>
                          <div className="text-base font-bold text-[#00C4BC]">
                            ${Math.abs(due).toLocaleString('es-AR')}
                          </div>
                        </div>
                      )
                    }
                    if (due > 0) {
                      return (
                        <button
                          type="button"
                          onClick={() => { setEditingPayment(null); setPaymentPrefillAmount(due); setShowPaymentModal(true) }}
                          className="group rounded-xl p-3 text-center bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/50 hover:border-red-400 dark:hover:border-red-600 active:scale-95 transition-all cursor-pointer"
                        >
                          <div className="text-xs mb-1 text-red-700 dark:text-red-400">Saldo pendiente</div>
                          <div className="text-base font-bold text-red-800 dark:text-red-400">
                            ${due.toLocaleString('es-AR')}
                          </div>
                          <div className="text-[10px] font-semibold text-red-600/80 dark:text-red-400/80 mt-0.5 opacity-80 group-hover:opacity-100 transition-opacity">
                            Tocá para saldar →
                          </div>
                        </button>
                      )
                    }
                    return (
                      <div className="rounded-xl p-3 text-center bg-surface2">
                        <div className="text-xs mb-1 text-app3">Saldo pendiente</div>
                        <div className="text-base font-bold text-app3">
                          ${due.toLocaleString('es-AR')}
                        </div>
                      </div>
                    )
                  })()}
                </div>
                )}
              </div>

              {/* Historial */}
              <div className="flex-1 overflow-y-auto">
                {(accountLoading || accountPageLoading) ? (
                  <div className="divide-y divide-app">
                    {Array.from({ length: ACCOUNT_PAGE_SIZE }).map((_, i) => (
                      <div key={i} className="px-6 py-4 animate-pulse">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 space-y-2">
                            <div className="h-3 w-24 rounded bg-surface3" />
                            <div className="h-4 w-28 rounded bg-surface3" />
                          </div>
                          <div className="h-4 w-16 rounded bg-surface3" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : accountPayments.length === 0 ? (
                  <div className="px-6 py-12 text-center text-app3 text-sm">Sin cobros registrados</div>
                ) : (
                  <div className="divide-y divide-app">
                    {(() => {
                      const totalPages = Math.max(1, Math.ceil(accountTotal / ACCOUNT_PAGE_SIZE))
                      const paginated = accountPayments
                      return (<>
                        {paginated.map((p: any) => {
                      const servicio = hasExplicitTotalAmount(p) ? Number(p.total_amount) : 0
                      const pagado = Number(p.amount)
                      const debe = servicio > 0 ? Math.max(servicio - pagado, 0) : 0
                      const aFavor = servicio > 0 && pagado > servicio ? pagado - servicio : 0
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
                              <div className="text-sm font-bold text-[#00C4BC]">
                                +${pagado.toLocaleString('es-AR')}
                              </div>
                              {debe > 0 && (
                                <div className="text-xs font-semibold text-amber-500">
                                  Debe: ${debe.toLocaleString('es-AR')}
                                </div>
                              )}
                              {aFavor > 0 && (
                                <div className="text-xs font-semibold text-[#00C4BC]">
                                  A favor: ${aFavor.toLocaleString('es-AR')}
                                </div>
                              )}
                            </div>
                            <div className="relative shrink-0">
                              <button
                                onClick={(e) => {
                                  if (openMenuId === p.id) { setOpenMenuId(null); return }
                                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                                  setMenuOpenUp(window.innerHeight - rect.bottom < 200)
                                  setOpenMenuId(p.id)
                                }}
                                className="p-1.5 rounded-lg text-app3 hover:text-app hover:bg-surface2 transition-all cursor-pointer"
                              >
                                <MoreVertical size={16} />
                              </button>
                              {openMenuId === p.id && (
                                <>
                                  <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} />
                                  <div className={`absolute right-0 z-20 bg-surface border border-app rounded-xl shadow-lg py-1 min-w-[150px] ${menuOpenUp ? 'bottom-8' : 'top-8'}`}>
                                    <button
                                      onClick={() => { setOpenMenuId(null); setEditingPayment(p); setShowPaymentModal(true) }}
                                      className="w-full text-left px-4 py-2 text-sm text-app hover:bg-surface2 transition-colors cursor-pointer"
                                    >
                                      Editar
                                    </button>
                                    {invoicesMap[p.id] ? (
                                      <button
                                        onClick={() => { setOpenMenuId(null); const inv = invoicesMap[p.id]; downloadInvoicePdf(inv.id, inv.invoice_type, inv.afip_numero ?? inv.numero) }}
                                        disabled={downloadingPdfId === invoicesMap[p.id]?.id}
                                        className="w-full text-left px-4 py-2 text-sm text-emerald-500 hover:bg-surface2 transition-colors disabled:opacity-50 cursor-pointer"
                                      >
                                        {downloadingPdfId === invoicesMap[p.id]?.id ? 'Generando...' : 'Descargar factura'}
                                      </button>
                                    ) : myAfipConfigured ? (
                                      <button
                                        onClick={() => { setOpenMenuId(null); setInvoiceModalPayment({ ...p, patient_name: `${patient.first_name} ${patient.last_name}` }) }}
                                        className="w-full text-left px-4 py-2 text-sm text-amber-500 hover:bg-surface2 transition-colors cursor-pointer"
                                      >
                                        Facturar
                                      </button>
                                    ) : (
                                      <div className="px-4 py-2">
                                        <p className="text-sm text-app3 opacity-50 cursor-not-allowed">Facturar</p>
                                        <p className="text-xs text-app3 mt-0.5">Configurá tus datos AFIP en <span className="text-[#00C4BC]">Configuración</span></p>
                                      </div>
                                    )}
                                    <button
                                      onClick={() => {
                                        setOpenMenuId(null)
                                        downloadReceiptPNG({
                                          patientName: `${patient.first_name} ${patient.last_name}`,
                                          date: p.paid_at,
                                          concept: p.concept ?? null,
                                          method: p.method,
                                          amount: pagado,
                                          totalAmount: hasExplicitTotalAmount(p) ? servicio : null,
                                          notes: p.notes ?? null,
                                          installments: p.installments ?? null,
                                          professionalName: myProfessionalName || null,
                                          clinicName: clinicName || null,
                                          balance: Number(accountSummary.balance_due),
                                        })
                                      }}
                                      className="w-full text-left px-4 py-2 text-sm text-app hover:bg-surface2 transition-colors cursor-pointer"
                                    >
                                      Descargar recibo
                                    </button>
                                    <div className="my-1 border-t border-app" />
                                    <button
                                      onClick={() => { setOpenMenuId(null); setDeletePaymentError(''); setPaymentToDelete(p) }}
                                      className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-surface2 transition-colors cursor-pointer"
                                    >
                                      Eliminar
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        )
                        })}
                        {totalPages > 1 && (
                          <div className="px-6 py-3 flex items-center justify-between">
                            <button
                              disabled={accountPage === 0 || accountPageLoading}
                              onClick={() => goToAccountPage(accountPage - 1)}
                              className="text-sm text-app2 hover:text-app disabled:opacity-30 disabled:cursor-not-allowed px-2 py-1 rounded-lg hover:bg-surface2 transition-colors"
                            >
                              ← Anterior
                            </button>
                            <span className="text-xs text-app3">{accountPage + 1} / {totalPages}</span>
                            <button
                              disabled={accountPage >= totalPages - 1 || accountPageLoading}
                              onClick={() => goToAccountPage(accountPage + 1)}
                              className="text-sm text-app2 hover:text-app disabled:opacity-30 disabled:cursor-not-allowed px-2 py-1 rounded-lg hover:bg-surface2 transition-colors"
                            >
                              Siguiente →
                            </button>
                          </div>
                        )}
                      </>)
                    })()}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-app shrink-0 space-y-2">
                <button
                  onClick={handleGenerateStatement}
                  disabled={accountLoading || accountPayments.length === 0}
                  className="w-full flex items-center justify-center gap-2 bg-surface2 hover:bg-surface3 border border-app active:scale-95 text-app2 font-semibold py-2.5 rounded-xl transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  Generar estado de cuenta
                </button>
                <button
                  onClick={() => { setEditingPayment(null); setPaymentPrefillAmount(null); setShowPaymentModal(true) }}
                  className="w-full bg-[#00C4BC] hover:bg-[#00aaa3] active:scale-95 text-white font-bold py-3 rounded-xl transition-all text-sm shadow-sm shadow-[#00C4BC]/20"
                >
                  💰 Registrar nuevo cobro
                </button>
              </div>
            </>
          </div>
        </div>
      )}

      {/* Modal registro de cobro */}
      {showPaymentModal && token && (
        <PaymentModal
          token={token}
          patients={patient ? [patient] : []}
          professionals={[]}
          payment={editingPayment}
          preselectedPatientId={params.id as string}
          prefillAmount={paymentPrefillAmount}
          clinicName={clinicName || undefined}
          myProfessionalName={myProfessionalName || undefined}
          profesionalIvaCondition={myAfipIvaCondition}
          hasAfipConfig={myAfipConfigured}
          onClose={() => { setShowPaymentModal(false); setEditingPayment(null); setPaymentPrefillAmount(null) }}
          onSaved={async () => {
            const wasEditing = Boolean(editingPayment)
            setShowPaymentModal(false)
            setEditingPayment(null)
            setPaymentPrefillAmount(null)
            // Un cobro nuevo aparece primero → saltamos a la página 0; una edición conserva la página.
            await refreshAccountState(token, wasEditing ? accountPageRef.current : 0)
          }}
        />
      )}

      {invoiceModalPayment && (
        <InvoiceModal
          payment={invoiceModalPayment}
          profesionalIvaCondition={myAfipIvaCondition}
          token={token}
          onClose={() => setInvoiceModalPayment(null)}
          onSuccess={(inv) => setInvoicesMap(prev => ({ ...prev, [inv.payment_id]: inv }))}
        />
      )}

      {paymentToDelete && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4" onClick={() => setPaymentToDelete(null)}>
          <div className="bg-surface border border-app rounded-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-app">
              <h2 className="text-lg font-semibold">Confirmar eliminación</h2>
              <p className="text-sm text-app3 mt-1">¿Eliminar este cobro de forma definitiva?</p>
            </div>
            <div className="px-6 py-4 space-y-2">
              {deletePaymentError && <div className="px-3 py-2 rounded-lg bg-red-600/10 text-xs text-red-500">{deletePaymentError}</div>}
              <div className="flex gap-2">
                <button onClick={() => setPaymentToDelete(null)} className="flex-1 bg-surface2 hover:bg-surface3 border border-app rounded-xl text-sm font-semibold py-3 transition-all active:scale-95">
                  Cancelar
                </button>
                <button onClick={confirmDeletePayment} disabled={deletingPayment} className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-semibold py-3 transition-all active:scale-95 disabled:opacity-50">
                  {deletingPayment ? 'Eliminando...' : 'Eliminar'}
                </button>
              </div>
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
                <button onClick={() => { setEditMode(false); setDeleteConfirm(false); setEditSubmitError('') }}
                  className="text-app3 hover:text-app transition-colors p-1 rounded-lg hover:bg-surface2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-app2 uppercase tracking-wider mb-1">Nombre</label>
                    <input value={editForm.first_name} onChange={e => setEditForm((f: any) => ({ ...f, first_name: e.target.value }))}
                      className={`w-full bg-surface2 border rounded-lg px-3 py-2.5 text-app text-sm focus:outline-none ${editErrors.first_name ? 'border-red-500' : 'border-app focus:border-[#00C4BC]'
                        }`} />
                    {editErrors.first_name && <p className="text-red-400 text-xs mt-1">{editErrors.first_name}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-app2 uppercase tracking-wider mb-1">Apellido</label>
                    <input value={editForm.last_name} onChange={e => setEditForm((f: any) => ({ ...f, last_name: e.target.value }))}
                      className={`w-full bg-surface2 border rounded-lg px-3 py-2.5 text-app text-sm focus:outline-none ${editErrors.last_name ? 'border-red-500' : 'border-app focus:border-[#00C4BC]'
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
                      className={`w-full bg-surface2 border rounded-lg px-3 py-2.5 text-app text-sm focus:outline-none ${editErrors.phone ? 'border-red-500' : 'border-app focus:border-[#00C4BC]'
                        }`}
                    />
                    {editErrors.phone && <p className="text-red-400 text-xs mt-1">Requerido</p>}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-app2 uppercase tracking-wider mb-1">Email</label>
                    <input value={editForm.email} onChange={e => setEditForm((f: any) => ({ ...f, email: e.target.value }))}
                      type="email"
                      className="w-full bg-surface2 border border-app rounded-lg px-3 py-2.5 text-app text-sm focus:outline-none focus:border-[#00C4BC]" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-app2 uppercase tracking-wider mb-1">Domicilio</label>
                  <input value={editForm.address ?? ''} onChange={e => setEditForm((f: any) => ({ ...f, address: e.target.value }))}
                    placeholder="Calle, número, piso, depto..."
                    className="w-full bg-surface2 border border-app rounded-lg px-3 py-2.5 text-app text-sm focus:outline-none focus:border-[#00C4BC]" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-app2 uppercase tracking-wider mb-1">DNI</label>
                    <input value={editForm.document_number} onChange={e => setEditForm((f: any) => ({ ...f, document_number: e.target.value }))}
                      className="w-full bg-surface2 border border-app rounded-lg px-3 py-2.5 text-app text-sm focus:outline-none focus:border-[#00C4BC]" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-app2 uppercase tracking-wider mb-1">Fecha de nacimiento</label>
                    <input value={editForm.date_of_birth} onChange={e => setEditForm((f: any) => ({ ...f, date_of_birth: e.target.value }))}
                      type="date"
                      className="w-full bg-surface2 border border-app rounded-lg px-3 py-2.5 text-app text-sm focus:outline-none focus:border-[#00C4BC]" />
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

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-app2 uppercase tracking-wider mb-1">Obra social</label>
                    <input value={editForm.insurance_name} onChange={e => setEditForm((f: any) => ({ ...f, insurance_name: e.target.value }))}
                      placeholder="OSDE, PAMI..."
                      className="w-full bg-surface2 border border-app rounded-lg px-3 py-2.5 text-app text-sm focus:outline-none focus:border-[#00C4BC]" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-app2 uppercase tracking-wider mb-1">Plan</label>
                    <input value={editForm.insurance_plan} onChange={e => setEditForm((f: any) => ({ ...f, insurance_plan: e.target.value }))}
                      className="w-full bg-surface2 border border-app rounded-lg px-3 py-2.5 text-app text-sm focus:outline-none focus:border-[#00C4BC]" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-app2 uppercase tracking-wider mb-1">Nro afiliado</label>
                    <input value={editForm.insurance_number} onChange={e => setEditForm((f: any) => ({ ...f, insurance_number: e.target.value }))}
                      placeholder="12345678"
                      className="w-full bg-surface2 border border-app rounded-lg px-3 py-2.5 text-app text-sm focus:outline-none focus:border-[#00C4BC]" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-app2 uppercase tracking-wider mb-1">Alergias</label>
                    <input value={editForm.allergies} onChange={e => setEditForm((f: any) => ({ ...f, allergies: e.target.value }))}
                      placeholder="Penicilina, látex..."
                      className="w-full bg-surface2 border border-app rounded-lg px-3 py-2.5 text-app text-sm focus:outline-none focus:border-[#00C4BC]" />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-app2 uppercase tracking-wider mb-1">Medicación actual</label>
                    <input value={editForm.current_medications} onChange={e => setEditForm((f: any) => ({ ...f, current_medications: e.target.value }))}
                      className="w-full bg-surface2 border border-app rounded-lg px-3 py-2.5 text-app text-sm focus:outline-none focus:border-[#00C4BC]" />
                  </div>
                </div>
              </div>

              {editSubmitError && (
                <div className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                  {editSubmitError}
                </div>
              )}

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
                <button onClick={() => { setEditMode(false); setDeleteConfirm(false); setEditSubmitError('') }}
                  disabled={savingEdit}
                  className="flex-1 bg-surface2 hover:bg-surface3 text-app font-semibold py-3 rounded-xl transition-colors disabled:opacity-60">
                  Cancelar
                </button>
                <button onClick={handleSaveEdit}
                  disabled={savingEdit}
                  className="flex-1 bg-[#00C4BC] hover:bg-[#00aaa3] active:scale-95 text-white font-bold py-3 rounded-xl transition-all disabled:opacity-60 shadow-sm shadow-[#00C4BC]/20">
                  {savingEdit ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal consentimientos */}
      {showConsentModal && patient && (
        <div className="fixed inset-0 z-50 flex flex-col bg-surface">

          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-app shrink-0">
            {consentView !== 'list' ? (
              <button
                onClick={() => {
                  if (consentView === 'sign') { setConsentView('select'); setHasSignature(false) }
                  else { setConsentView('list'); setViewingConsent(null) }
                }}
                className="w-9 h-9 rounded-xl bg-surface2 flex items-center justify-center text-app hover:bg-surface3 transition-colors text-lg font-medium"
              >
                ←
              </button>
            ) : (
              <button
                onClick={() => setShowConsentModal(false)}
                className="w-9 h-9 rounded-xl bg-surface2 flex items-center justify-center text-app hover:bg-surface3 transition-colors"
              >
                ✕
              </button>
            )}
            <div className="flex-1 min-w-0">
              <h2 className="font-bold text-base text-app">
                {consentView === 'list' && 'Consentimientos'}
                {consentView === 'select' && 'Nuevo consentimiento'}
                {consentView === 'sign' && selectedTemplate?.name}
                {consentView === 'view' && ((viewingConsent?.consent_templates as any)?.name ?? 'Consentimiento')}
              </h2>
              <p className="text-xs text-app3 truncate">{patient.first_name} {patient.last_name}</p>
            </div>
            {consentView === 'list' && !consentLoading && (
              <button
                onClick={() => setConsentView('select')}
                className="flex items-center gap-1.5 bg-[#00C4BC] hover:bg-[#00aaa3] text-white text-sm font-bold px-3 py-2 rounded-xl transition-colors active:scale-95"
              >
                + Nuevo
              </button>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-h-0">

            {/* LIST VIEW */}
            {consentView === 'list' && (
              <div className="h-full overflow-y-auto p-4">
                {consentLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map(i => <div key={i} className="bg-surface2 rounded-xl h-16 animate-pulse" />)}
                  </div>
                ) : existingConsents.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="w-16 h-16 rounded-full bg-surface2 flex items-center justify-center mb-4">
                      <FileText size={28} className="text-app3" />
                    </div>
                    <p className="font-semibold text-app mb-1">Sin consentimientos</p>
                    <p className="text-sm text-app3 mb-6">No hay consentimientos firmados para este paciente.</p>
                    <button
                      onClick={() => setConsentView('select')}
                      className="bg-[#00C4BC] hover:bg-[#00aaa3] text-white font-bold px-6 py-3 rounded-xl transition-colors active:scale-95"
                    >
                      + Nuevo consentimiento
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2 max-w-2xl mx-auto">
                    {existingConsents.map((c: any) => {
                      const templateName = (c.consent_templates as any)?.name ?? 'Consentimiento'
                      const date = c.signed_at
                        ? new Date(c.signed_at).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })
                        : new Date(c.created_at).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })
                      return (
                        <button
                          key={c.id}
                          onClick={() => openConsentDetail(c.id)}
                          className="w-full text-left bg-surface border border-app hover:border-[#00C4BC] hover:bg-[#E6F8F1] dark:hover:bg-[#00C4BC]/10 rounded-xl px-4 py-3 flex items-center justify-between gap-3 transition-all active:scale-[0.99]"
                        >
                          <div className="min-w-0">
                            <p className="font-semibold text-sm text-app truncate">{templateName}</p>
                            <p className="text-xs text-app3">{date}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${
                              c.status === 'signed' ? 'bg-[#E6F8F1] text-[#00C4BC]' : 'bg-surface2 text-app3'
                            }`}>
                              {c.status === 'signed' ? '✓ Firmado' : c.status}
                            </span>
                            <span className="text-app3 text-lg">›</span>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* SELECT TEMPLATE VIEW */}
            {consentView === 'select' && (
              <div className="h-full overflow-y-auto p-4">
                {consentLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map(i => <div key={i} className="bg-surface2 rounded-xl h-20 animate-pulse" />)}
                  </div>
                ) : consentTemplates.length === 0 ? (
                  <div className="text-center py-12 text-app3 text-sm">No hay plantillas disponibles.</div>
                ) : (
                  <div className="space-y-3 max-w-2xl mx-auto">
                    <p className="text-sm text-app3 mb-4">Seleccioná el tipo de consentimiento:</p>
                    {consentTemplates.map((t: any) => (
                      <button
                        key={t.id}
                        onClick={() => { setSelectedTemplate(t); setConsentView('sign') }}
                        className="w-full text-left bg-surface border border-app hover:border-[#00C4BC] hover:bg-[#E6F8F1] dark:hover:bg-[#00C4BC]/10 rounded-xl px-4 py-4 transition-all active:scale-[0.99] group"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-semibold text-app group-hover:text-[#00C4BC] transition-colors">{t.name}</p>
                          <span className="text-app3 group-hover:text-[#00C4BC] transition-colors text-lg">›</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* VIEW (detail) */}
            {consentView === 'view' && (
              <div className="h-full overflow-y-auto">
                {viewingConsentLoading ? (
                  <div className="flex items-center justify-center py-20">
                    <div className="w-8 h-8 border-2 border-[#00C4BC] border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : viewingConsent ? (
                  <>
                    {/* Documento */}
                    <div className="bg-white">
                      <div
                        className="max-w-2xl mx-auto px-6 py-8 text-gray-800 text-sm leading-relaxed [&_h2]:text-lg [&_h2]:font-bold [&_h2]:mb-3 [&_h2]:mt-0 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:mb-2 [&_h3]:mt-4 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-2 [&_li]:mb-1 [&_p]:mb-3 [&_strong]:font-semibold"
                        dangerouslySetInnerHTML={{ __html: viewingConsent.content_html }}
                      />
                    </div>

                    {/* Firma */}
                    <div className="border-t-2 border-app px-6 py-6 max-w-2xl mx-auto">
                      <p className="text-xs font-semibold text-app2 uppercase tracking-wider mb-3">Firma del paciente</p>
                      {viewingConsent.signature_data ? (
                        <div className="border-2 border-app rounded-xl overflow-hidden bg-white">
                          <img
                            src={viewingConsent.signature_data}
                            alt="Firma del paciente"
                            className="w-full object-contain"
                            style={{ maxHeight: 160 }}
                          />
                        </div>
                      ) : (
                        <p className="text-sm text-app3 italic">Sin firma registrada</p>
                      )}
                      {viewingConsent.signed_at && (
                        <p className="text-xs text-app3 mt-2">
                          Firmado el {new Date(viewingConsent.signed_at).toLocaleDateString('es-AR', {
                            day: 'numeric', month: 'long', year: 'numeric',
                            hour: '2-digit', minute: '2-digit',
                          })}
                        </p>
                      )}
                    </div>
                  </>
                ) : null}
              </div>
            )}

            {/* SIGN VIEW */}
            {consentView === 'sign' && selectedTemplate && (
              <div className="h-full overflow-y-auto">

                {/* Document preview */}
                <div className="bg-white">
                  <div
                    className="max-w-2xl mx-auto px-6 py-8 text-gray-800 text-sm leading-relaxed [&_h2]:text-lg [&_h2]:font-bold [&_h2]:mb-3 [&_h2]:mt-0 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:mb-2 [&_h3]:mt-4 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-2 [&_li]:mb-1 [&_p]:mb-3 [&_strong]:font-semibold"
                    dangerouslySetInnerHTML={{ __html: renderConsentHtml(selectedTemplate.content_html) }}
                  />
                </div>

                {/* Signature area */}
                <div className="bg-surface border-t-2 border-app px-4 pt-4" style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}>
                  {consentSaved ? (
                    <div className="flex flex-col items-center justify-center py-6 gap-3">
                      <div className="w-14 h-14 rounded-full bg-[#E6F8F1] flex items-center justify-center">
                        <svg className="w-7 h-7 text-[#00C4BC]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <p className="font-bold text-app text-base">Consentimiento guardado</p>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-semibold text-app2 uppercase tracking-wider">Firma del paciente</p>
                        <button onClick={clearSignature} className="text-xs text-app3 hover:text-app transition-colors">
                          Limpiar
                        </button>
                      </div>
                      <div className="relative rounded-xl border-2 border-dashed border-app overflow-hidden bg-white">
                        {!hasSignature && (
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
                            <p className="text-gray-300 text-sm">Firme aquí</p>
                          </div>
                        )}
                        <canvas
                          ref={signatureCanvasRef}
                          className="w-full block"
                          style={{ height: 160, touchAction: 'none' }}
                          onPointerDown={onSignPointerDown}
                          onPointerMove={onSignPointerMove}
                          onPointerUp={onSignPointerUp}
                          onPointerLeave={onSignPointerUp}
                        />
                      </div>
                      <button
                        onClick={handleSaveConsent}
                        disabled={!hasSignature || consentSaving}
                        className="mt-3 w-full bg-[#00C4BC] hover:bg-[#00aaa3] disabled:opacity-40 active:scale-[0.98] text-white font-bold py-3.5 rounded-xl transition-all shadow-sm shadow-[#00C4BC]/20 text-sm"
                      >
                        {consentSaving ? 'Guardando...' : 'Firmar y guardar'}
                      </button>
                    </>
                  )}
                </div>

              </div>
            )}

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

const OdontogramView = memo(function OdontogramView({ odontogram, onSaveTooth, onSaveBulk, odontogramType }: {
  odontogram: any[]
  onSaveTooth: (toothNumber: number, surfaces: Record<string, string>, note: string) => Promise<void>
  onSaveBulk: (teeth: Array<{ toothNumber: number; surfaces: string; note: string }>) => Promise<void>
  odontogramType: 'adult' | 'child'
}) {
  const [selectedTooth, setSelectedTooth] = useState<number | null>(null)
  const [paintColor, setPaintColor] = useState<'red' | 'blue' | 'emerald'>('red')
  const [saving, setSaving] = useState(false)
  const savingCountRef = useRef(0)
  const [mode, setMode] = useState<'paint' | 'prosthetic'>('paint')
  const [prostheticType, setProstheticType] = useState<ProstheticType>('bridge')
  const [prostheticColor, setProstheticColor] = useState<'red' | 'blue'>('red')
  const [prostheticStart, setProstheticStart] = useState<number | null>(null)
  type Snapshot = { teeth: Record<number, ToothState>; prosthetics: Prosthetic[] }
  const [history, setHistory] = useState<Snapshot[]>([])
  const initialSnapshotRef = useRef<Snapshot | null>(null)
  const handleUndoRef = useRef<() => Promise<void>>(async () => {})
  const handleResetRef = useRef<() => Promise<void>>(async () => {})

  function startSaving() {
    savingCountRef.current++
    setSaving(true)
  }
  function doneSaving() {
    savingCountRef.current--
    if (savingCountRef.current <= 0) {
      savingCountRef.current = 0
      setSaving(false)
    }
  }

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

  function makeSnapshot(): Snapshot {
    const teethCopy: Record<number, ToothState> = {}
    Object.keys(teeth).forEach(k => { teethCopy[Number(k)] = { ...teeth[Number(k)] } })
    return { teeth: teethCopy, prosthetics: prosthetics.map(p => ({ ...p, teeth: [...p.teeth] })) }
  }

  function takeSnapshot() {
    const snap = makeSnapshot()
    if (!initialSnapshotRef.current) initialSnapshotRef.current = snap
    setHistory(h => [...h.slice(-19), snap])
  }

  async function applySnapshot(snap: Snapshot) {
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
      startSaving()
      await onSaveBulk(bulkPayload)
      doneSaving()
    }
  }

  async function handleUndo() {
    if (history.length === 0) return
    const snap = history[history.length - 1]
    setHistory(h => h.slice(0, -1))
    await applySnapshot(snap)
  }

  async function handleReset() {
    if (!initialSnapshotRef.current) return
    setHistory([])
    await applySnapshot(initialSnapshotRef.current)
  }

  handleUndoRef.current = handleUndo
  handleResetRef.current = handleReset

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
    startSaving()
    onSaveTooth(n, { surfaces: surfacesFor(n, newState) }, newState.note ?? '').finally(doneSaving)
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
    startSaving()
    onSaveTooth(n, { surfaces: surfacesFor(n, newState) }, newState.note ?? '').finally(doneSaving)
  }

  async function saveNote(n: number) {
    const state = teeth[n] ?? {}
    startSaving()
    onSaveTooth(n, { surfaces: surfacesFor(n, state) }, state.note ?? '').finally(doneSaving)
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
    startSaving()
    onSaveTooth(n, { surfaces: surfacesFor(n, newState) }, newState.note ?? '').finally(doneSaving)
  }

  async function saveProsthetic(type: ProstheticType, color: 'red' | 'blue', teethRange: number[]) {
    takeSnapshot()
    const id = nanoid6()
    const marker = `${type}:${color}:${id}`
    startSaving()
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
    setTeeth(newTeethState)
    setProsthetics(prev => [...prev, { id, type, color, teeth: teethRange }])
    onSaveBulk(bulkPayload).finally(doneSaving)
  }

  async function deleteProsthetic(id: string) {
    takeSnapshot()
    const p = prosthetics.find(pr => pr.id === id)
    if (!p) return
    startSaving()
    Promise.all(p.teeth.map(tooth => {
      const state = teeth[tooth] ?? {}
      return onSaveTooth(tooth, { surfaces: buildSurfaces(state) }, state.note ?? '')
    })).finally(() => {
      setProsthetics(prev => prev.filter(pr => pr.id !== id))
      doneSaving()
    })
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
      <div className="flex items-center mb-4 gap-3 flex-wrap">
        {/* Selector de modo */}
        <div className="flex gap-1 bg-surface2 p-0.5 rounded-lg border border-gray-700">
          <button
            onClick={() => { setMode('paint'); setProstheticStart(null) }}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${mode === 'paint' ? 'bg-surface3 border border-gray-600 text-app' : 'text-app3 hover:text-app2'}`}
          >Normal</button>
          <button
            onClick={() => { setMode('prosthetic'); setSelectedTooth(null) }}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${mode === 'prosthetic' ? 'bg-surface3 border border-gray-600 text-app' : 'text-app3 hover:text-app2'}`}
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
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${prostheticType === 'bridge' ? 'bg-surface3 border border-gray-600 text-app' : 'text-app3 hover:text-app2'}`}
              >Puente</button>
              <button onClick={() => { setProstheticType('removable'); setProstheticStart(null) }}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${prostheticType === 'removable' ? 'bg-surface3 border border-gray-600 text-app' : 'text-app3 hover:text-app2'}`}
              >Removible</button>
              <button onClick={() => { setProstheticType('crown'); setProstheticStart(null) }}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${prostheticType === 'crown' ? 'bg-surface3 border border-gray-600 text-app' : 'text-app3 hover:text-app2'}`}
              >Corona</button>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setProstheticColor('red')}
                className={`w-5 h-5 rounded-full ring-2 ring-offset-1 ring-offset-gray-900 transition-all cursor-pointer ${prostheticColor === 'red' ? 'bg-red-600 ring-red-500' : 'bg-red-900/40 ring-transparent hover:ring-red-800'}`}
                title="Existente (rojo)" />
              <button onClick={() => setProstheticColor('blue')}
                className={`w-5 h-5 rounded-full ring-2 ring-offset-1 ring-offset-gray-900 transition-all cursor-pointer ${prostheticColor === 'blue' ? 'bg-blue-600 ring-blue-500' : 'bg-blue-900/40 ring-transparent hover:ring-blue-800'}`}
                title="A realizar (azul)" />
            </div>
            {prostheticStart && (
              <span className="text-xs text-emerald-400 font-mono">{prostheticStart} →</span>
            )}
          </div>
        )}

        <div className="flex items-center gap-2">
          <button
            onClick={() => !saving && handleUndoRef.current()}
            title={`Deshacer${history.length > 1 ? ` (${history.length} pasos)` : ''}`}
            className={`w-7 h-7 flex items-center justify-center rounded-lg bg-surface2 border text-sm transition-all active:scale-95 cursor-pointer border-gray-600 text-app2 hover:border-gray-500 hover:text-app ${!saving && history.length > 0 ? '' : 'invisible'}`}
          >↩</button>
          <button
            onClick={() => !saving && handleResetRef.current()}
            title="Resetear todo"
            className={`w-7 h-7 flex items-center justify-center rounded-lg bg-surface2 border text-xs transition-all active:scale-95 cursor-pointer border-gray-700 text-app3 hover:border-red-800 hover:text-red-400 ${!saving && history.length > 0 ? '' : 'invisible'}`}
          >✕</button>
        </div>
      </div>

      {/* Grid cuadrantes */}
      <div className="overflow-x-auto pb-2">
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
})
