'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import { getToken } from '@/lib/supabase'

// Fetcher autenticado: resuelve el token fresco y pega contra la API.
// Lo usan todos los hooks de query/mutation para no repetir el getToken().
export async function authedApiFetch(
  path: string,
  options: Omit<Parameters<typeof apiFetch>[1], 'token'> = {}
) {
  const token = await getToken()
  if (!token) throw new Error('No session')
  return apiFetch(path, { ...options, token })
}

// Claves de cache centralizadas — evita typos y facilita invalidar.
// Lista de pacientes va bajo ['patients','list',...] y el detalle bajo ['patient', id, ...]
// para que invalidar la lista NO toque las queries por-paciente (no son prefijo una de otra).
export const queryKeys = {
  me: ['auth', 'me'] as const,
  dashboard: ['appointments', 'dashboard'] as const,
  professionals: ['professionals'] as const,
  calendar: (from: string, to: string) => ['appointments', 'calendar', from, to] as const,
  afipConfig: ['afip-config'] as const,
  patientsList: (query: string) => ['patients', 'list', query] as const,
  patientOdontogram: (id: string) => ['patient', id, 'odontogram'] as const,
  patientDiagnostics: (id: string) => ['patient', id, 'diagnostics'] as const,
}

export type PatientSummary = {
  id: string
  first_name: string
  last_name: string
  phone: string | null
  gender: string | null
  insurance_name?: string | null
  last_appointment_at?: string | null
}

// ── Perfil del usuario ───────────────────────────────────
export function useMe() {
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: async () => (await authedApiFetch('/auth/me')).data,
    staleTime: 1000 * 60 * 10, // el perfil cambia poco
  })
}

// ── Dashboard (agenda + stats + inactivos) ───────────────
type DashboardData = {
  agenda: any[]
  stats: any
  inactive: any[]
}

export function useDashboard() {
  return useQuery({
    queryKey: queryKeys.dashboard,
    queryFn: async (): Promise<DashboardData> => {
      const res = await authedApiFetch('/appointments/dashboard')
      return {
        agenda: res.data?.agenda ?? [],
        stats: res.data?.stats ?? {},
        inactive: res.data?.inactive ?? [],
      }
    },
  })
}

// ── Profesionales de la clínica ──────────────────────────
export function useProfessionals() {
  return useQuery({
    queryKey: queryKeys.professionals,
    queryFn: async () => (await authedApiFetch('/professionals')).data ?? [],
    staleTime: 1000 * 60 * 10, // cambian poco
  })
}

// ── Calendario semanal (turnos + bloqueos) ───────────────
export type CalendarData = { appointments: any[]; blocks: any[] }

export function useCalendar(from: string, to: string) {
  return useQuery({
    queryKey: queryKeys.calendar(from, to),
    queryFn: async (): Promise<CalendarData> => {
      const res = await authedApiFetch(`/appointments/calendar?from=${from}&to=${to}`)
      return {
        appointments: res.data?.appointments ?? [],
        blocks: res.data?.blocks ?? [],
      }
    },
  })
}

// ── Búsqueda de pacientes (lista) ────────────────────────
export function usePatients(query: string) {
  const normalized = query.trim()
  return useQuery({
    queryKey: queryKeys.patientsList(normalized),
    queryFn: async (): Promise<PatientSummary[]> => {
      const params = new URLSearchParams({ limit: '10' })
      if (normalized) params.set('q', normalized)
      return (await authedApiFetch(`/patients?${params.toString()}`)).data ?? []
    },
    enabled: normalized.length >= 3, // mismo umbral que el buscador
    staleTime: 1000 * 30,
  })
}

// ── Detalle del paciente: data de solo-lectura cacheable ─
// OJO: archivos/radiografías NO van por acá (son binarios grandes) — los maneja
// PatientFilesSection aparte, fuera del cache persistido de IndexedDB.
export function usePatientOdontogram(id: string) {
  return useQuery({
    queryKey: queryKeys.patientOdontogram(id),
    queryFn: async () => (await authedApiFetch(`/treatments/odontogram/${id}`)).data ?? [],
  })
}

export function usePatientDiagnostics(id: string) {
  return useQuery({
    queryKey: queryKeys.patientDiagnostics(id),
    queryFn: async () => (await authedApiFetch(`/treatments/tooth-diagnostics/${id}`)).data ?? [],
  })
}

export function useAfipConfig() {
  return useQuery({
    queryKey: queryKeys.afipConfig,
    queryFn: async () => (await authedApiFetch('/professionals/me/afip-config').catch(() => null))?.data ?? null,
    staleTime: 1000 * 60 * 10,
  })
}

// ── Cambiar estado de un turno (optimista) ───────────────
export function useUpdateAppointmentStatus() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      authedApiFetch(`/appointments/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),

    // Update optimista: pinta el nuevo estado al instante.
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: queryKeys.dashboard })
      const prev = qc.getQueryData<DashboardData>(queryKeys.dashboard)
      if (prev) {
        qc.setQueryData<DashboardData>(queryKeys.dashboard, {
          ...prev,
          agenda: prev.agenda.map((a) => (a.id === id ? { ...a, status } : a)),
        })
      }
      return { prev }
    },

    // Si falla, revertimos al snapshot previo.
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(queryKeys.dashboard, ctx.prev)
    },

    // Siempre revalidamos contra el server al terminar.
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.dashboard })
    },
  })
}
