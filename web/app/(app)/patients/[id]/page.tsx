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

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')

  const token = session.access_token

  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? ''

  const [patientRes, meRes] = await Promise.all([
    fetch(`${apiBase}/patients/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    }),
    fetch(`${apiBase}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    }),
  ])

  const patientData = patientRes.ok ? await patientRes.json() : null
  const meData = meRes.ok ? await meRes.json() : null

  const patient = patientData?.data ?? null
  const clinicName: string = meData?.data?.clinic_name ?? ''
  const professionalName: string =
    meData?.data?.full_name ?? meData?.data?.name ?? ''

  return (
    <PatientDetailClient
      initialPatient={patient}
      initialToken={token}
      patientId={id}
      initialClinicName={clinicName}
      initialProfessionalName={professionalName}
    />
  )
}
