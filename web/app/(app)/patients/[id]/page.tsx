import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { unstable_cache } from 'next/cache'
import PatientDetailClient from './PatientDetailClient'

export default async function PatientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()

  // getUser() validates against the Supabase Auth server — authoritative app_metadata.
  // getSession() reads from cookie — only needed for the access token.
  const [{ data: { user } }, { data: { session } }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.auth.getSession(),
  ])

  if (!user || !session) redirect('/login')

  const token = session.access_token
  const userId = user.id
  const clinicId: string | undefined = user.app_metadata?.clinic_id
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? ''

  // Cache /auth/me at Next.js level — clinic/professional data is stable per session.
  // Railway already has an in-memory cache but this eliminates the Vercel→Railway network hop.
  const getCachedMe = unstable_cache(
    async () => {
      const res = await fetch(`${apiBase}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      return res.ok ? res.json() : null
    },
    ['auth-me', userId],
    { revalidate: 300 }
  )

  // Direct Supabase queries — bypasses the Railway hop entirely.
  // RLS enforces clinic isolation; explicit clinic_id filter adds defense-in-depth when available.
  const patientBaseQuery = supabase
    .from('patients')
    .select('id, first_name, last_name, document_type, document_number, date_of_birth, gender, phone, phone_alt, email, address, city, insurance_name, insurance_plan, insurance_number, allergies, current_medications, medical_notes, blood_type, referral_source, is_active, last_appointment_at, odontogram_type, notes, created_by, created_at, updated_at')
    .eq('id', id)
    .is('deleted_at', null)

  const clinicalBaseQuery = supabase
    .from('patient_clinical_histories')
    .select('*')
    .eq('patient_id', id)

  const [patientRes, clinicalHistoryRes, meData] = await Promise.all([
    (clinicId ? patientBaseQuery.eq('clinic_id', clinicId) : patientBaseQuery).single(),
    (clinicId ? clinicalBaseQuery.eq('clinic_id', clinicId) : clinicalBaseQuery).maybeSingle(),
    getCachedMe(),
  ])

  if (patientRes.error) {
    console.error('[patient-page] patient query error:', patientRes.error)
  }

  const patient = patientRes.data ?? null
  const clinicalHistory = clinicalHistoryRes.data ?? null

  // The API returns professionals.* with clinics nested — handle both shapes
  const clinicName: string =
    (meData?.data?.clinics as any)?.name ?? meData?.data?.clinic_name ?? ''
  const professionalName: string =
    meData?.data?.full_name ??
    (meData?.data?.first_name && meData?.data?.last_name
      ? `${meData.data.first_name} ${meData.data.last_name}`
      : meData?.data?.name ?? '')

  return (
    <PatientDetailClient
      initialPatient={patient}
      initialToken={token}
      patientId={id}
      initialClinicName={clinicName}
      initialProfessionalName={professionalName}
      initialClinicalHistory={clinicalHistory}
    />
  )
}
