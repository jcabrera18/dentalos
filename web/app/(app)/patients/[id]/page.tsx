import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import PatientDetailClient from './PatientDetailClient'

const API_URL = process.env.NEXT_PUBLIC_API_URL!

// F2: la carga inicial pasa por Fastify (no lee Supabase directo) para que el PHI
// cifrado se descifre en la API. La sesión sigue leyéndose del cookie (sin hop de red).
export default async function PatientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')

  const headers = { Authorization: `Bearer ${session.access_token}` }
  const [patientRes, clinicalHistoryRes] = await Promise.all([
    fetch(`${API_URL}/patients/${id}`, { headers, cache: 'no-store' }),
    fetch(`${API_URL}/patients/${id}/clinical-history`, { headers, cache: 'no-store' }),
  ])

  let initialPatient = null
  if (patientRes.ok) {
    initialPatient = (await patientRes.json()).data ?? null
  } else if (patientRes.status === 404) {
    // El paciente no existe o es de otra clínica: dejamos que el cliente maneje el estado.
  } else {
    console.error('[patient-page] patient fetch failed:', patientRes.status)
  }

  const initialClinicalHistory = clinicalHistoryRes.ok
    ? (await clinicalHistoryRes.json()).data ?? null
    : null

  return (
    <PatientDetailClient
      initialPatient={initialPatient}
      initialToken={session.access_token}
      patientId={id}
      initialClinicalHistory={initialClinicalHistory}
    />
  )
}
