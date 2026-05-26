import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import PatientDetailClient from './PatientDetailClient'

export default async function PatientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()

  // getSession() reads from the encrypted cookie — no network hop to Supabase Auth.
  // RLS enforces clinic isolation via the JWT that's already in the cookie.
  // All three run in parallel: session parse + both Supabase queries.
  const [{ data: { session } }, patientRes, clinicalHistoryRes] = await Promise.all([
    supabase.auth.getSession(),
    supabase
      .from('patients')
      .select('id, first_name, last_name, document_type, document_number, date_of_birth, gender, phone, phone_alt, email, address, city, insurance_name, insurance_plan, insurance_number, allergies, current_medications, medical_notes, blood_type, referral_source, is_active, last_appointment_at, odontogram_type, notes, created_by, created_at, updated_at')
      .eq('id', id)
      .is('deleted_at', null)
      .single(),
    supabase
      .from('patient_clinical_histories')
      .select('*')
      .eq('patient_id', id)
      .maybeSingle(),
  ])

  if (!session) redirect('/login')

  if (patientRes.error) {
    console.error('[patient-page] patient query error:', patientRes.error)
  }

  return (
    <PatientDetailClient
      initialPatient={patientRes.data ?? null}
      initialToken={session.access_token}
      patientId={id}
      initialClinicalHistory={clinicalHistoryRes.data ?? null}
    />
  )
}
