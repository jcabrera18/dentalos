'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import { getToken } from '@/lib/supabase'
import {
  hasClinicalAccess,
  normalizeRole,
  resolvePermissions,
  type Permission,
  type PermissionMap,
} from '@/lib/permissions'

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
  myPermissions: ['auth', 'permissions'] as const,
  dashboard: ['appointments', 'dashboard'] as const,
  professionals: ['professionals'] as const,
  calendar: (from: string, to: string) => ['appointments', 'calendar', from, to] as const,
  afipConfig: ['afip-config'] as const,
  patientsList: (query: string) => ['patients', 'list', query] as const,
  patientOdontogram: (id: string) => ['patient', id, 'odontogram'] as const,
  patientDiagnostics: (id: string) => ['patient', id, 'diagnostics'] as const,
  patientContact: (id: string) => ['patient', id, 'contact'] as const,
  notificationsInbox: ['notifications', 'inbox'] as const,
  notificationsUnread: ['notifications', 'unread-count'] as const,
}

// ── Notificaciones in-app (campana) ──────────────────────
export type AppNotification = {
  id: string
  type: string
  title: string
  body: string | null
  appointment_id: string | null
  patient_id: string | null
  professional_id: string | null
  metadata: Record<string, unknown>
  read_at: string | null
  created_at: string
}

// Contador de no leídas para el badge. Poll suave cada 30s; barato en el
// backend (índice parcial + head count).
export function useUnreadNotificationsCount() {
  return useQuery({
    queryKey: queryKeys.notificationsUnread,
    queryFn: async (): Promise<number> => {
      const res = await authedApiFetch('/notifications/inbox/unread-count')
      return res.count ?? 0
    },
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  })
}

// Lista del inbox. Se carga al abrir el panel (enabled controlado por el caller).
export function useNotificationsInbox(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.notificationsInbox,
    queryFn: async (): Promise<AppNotification[]> =>
      (await authedApiFetch('/notifications/inbox?limit=10')).data ?? [],
    enabled,
    staleTime: 1000 * 15,
  })
}

export function useMarkNotificationRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      // Body '{}' obligatorio: apiFetch manda Content-Type JSON y Fastify
      // rechaza el POST si el cuerpo va vacío (FST_ERR_CTP_EMPTY_JSON_BODY).
      authedApiFetch(`/notifications/inbox/${id}/read`, { method: 'POST', body: '{}' }),
    onMutate: async (id) => {
      // Cancelamos refetches en vuelo para que no pisen el update optimista.
      await qc.cancelQueries({ queryKey: queryKeys.notificationsUnread })
      const prevCount = qc.getQueryData<number>(queryKeys.notificationsUnread)
      const prevInbox = qc.getQueryData<AppNotification[]>(queryKeys.notificationsInbox)
      // Optimista: marca leída en la lista y baja el badge al instante.
      qc.setQueryData<AppNotification[]>(queryKeys.notificationsInbox, prev =>
        prev?.map(n => (n.id === id && !n.read_at ? { ...n, read_at: new Date().toISOString() } : n)))
      qc.setQueryData<number>(queryKeys.notificationsUnread, prev =>
        typeof prev === 'number' ? Math.max(0, prev - 1) : prev)
      return { prevCount, prevInbox }
    },
    // Si el server falla (ej. falta permiso UPDATE), volvemos al estado real.
    onError: (_err, _id, ctx) => {
      if (ctx?.prevCount !== undefined) qc.setQueryData(queryKeys.notificationsUnread, ctx.prevCount)
      if (ctx?.prevInbox !== undefined) qc.setQueryData(queryKeys.notificationsInbox, ctx.prevInbox)
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.notificationsUnread })
    },
  })
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => authedApiFetch('/notifications/inbox/read-all', { method: 'POST', body: '{}' }),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: queryKeys.notificationsUnread })
      const prevCount = qc.getQueryData<number>(queryKeys.notificationsUnread)
      const prevInbox = qc.getQueryData<AppNotification[]>(queryKeys.notificationsInbox)
      const now = new Date().toISOString()
      qc.setQueryData<AppNotification[]>(queryKeys.notificationsInbox, prev =>
        prev?.map(n => (n.read_at ? n : { ...n, read_at: now })))
      qc.setQueryData<number>(queryKeys.notificationsUnread, 0)
      return { prevCount, prevInbox }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prevCount !== undefined) qc.setQueryData(queryKeys.notificationsUnread, ctx.prevCount)
      if (ctx?.prevInbox !== undefined) qc.setQueryData(queryKeys.notificationsInbox, ctx.prevInbox)
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.notificationsUnread })
    },
  })
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

// ── Rol y permisos efectivos (rol Administrativo) ────────
// Query propia (no /auth/me, que tiene staleTime de 10 min): si el owner apaga
// un permiso, la UI del Administrativo tiene que enterarse al refrescar, al
// volver a la pestaña o como mucho en 60s. Pinta desde el cache persistido y
// revalida siempre (la API vuelve a validar cada endpoint igual).
type MyPermissions = { role: string; clinical_access: boolean; permissions: PermissionMap }

export function useMyPermissions() {
  return useQuery({
    queryKey: queryKeys.myPermissions,
    queryFn: async (): Promise<MyPermissions> => (await authedApiFetch('/professionals/me/permissions')).data,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: 'always',
    refetchInterval: 60_000,
  })
}

// Solo para mostrar/ocultar UI. Mientras no hay datos, `ready` es false: no
// muestres ni ocultes nada sensible basándote en los defaults.
export function usePermissions() {
  const { data: me, isLoading: meLoading } = useMe()
  const { data: mine, isLoading: permsLoading } = useMyPermissions()
  const role = normalizeRole(mine?.role ?? me?.role)
  const permissions: PermissionMap =
    mine?.permissions ?? me?.effective_permissions ?? resolvePermissions(role, me?.permissions)
  const clinicalAccess: boolean = mine?.clinical_access ?? me?.clinical_access ?? hasClinicalAccess(role)
  return {
    ready: !!mine || (!meLoading && !permsLoading && !!me),
    role,
    isOwnerOrAdmin: role === 'owner' || role === 'admin',
    clinicalAccess,
    permissions,
    can: (p: Permission) => permissions[p] === true,
  }
}

// ── Emisor de factura de un cobro ────────────────────────
// Profesional: factura con su propia config AFIP. Administrativo: no tiene CUIT
// ni certificado → la API factura a nombre del profesional del cobro, así que
// la UI chequea la config de ESE profesional (flag `afip_ready` del listado).
export function useInvoiceIssuer() {
  const access = usePermissions()
  const { data: ownAfip } = useAfipConfig()
  const { data: professionals = [] } = useProfessionals()
  return (paymentProfessionalId?: string | null): { configured: boolean; ivaCondition: string } => {
    if (!access.can('invoices.issue')) return { configured: false, ivaCondition: 'MO' }
    if (access.clinicalAccess) {
      return {
        configured: !!(ownAfip?.cuit && ownAfip?.has_cert && ownAfip?.has_key && ownAfip?.afip_punto_venta),
        ivaCondition: ownAfip?.iva_condition || 'MO',
      }
    }
    const prof = (professionals as any[]).find((p: any) => p.id === paymentProfessionalId)
    return { configured: !!prof?.afip_ready, ivaCondition: prof?.iva_condition || 'MO' }
  }
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
// Por defecto excluye a los Administrativos: no atienden, así que no son columnas
// de agenda ni opciones de "profesional" en turnos, cobros o presupuestos.
export function useProfessionals(opts: { includeAdministrative?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.professionals,
    queryFn: async () => (await authedApiFetch('/professionals')).data ?? [],
    select: opts.includeAdministrative
      ? undefined
      : (rows: any[]) => rows.filter((p: any) => hasClinicalAccess(p.role)),
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
export function usePatientOdontogram(id: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.patientOdontogram(id),
    queryFn: async () => (await authedApiFetch(`/treatments/odontogram/${id}`)).data ?? [],
    enabled,
  })
}

export function usePatientDiagnostics(id: string) {
  return useQuery({
    queryKey: queryKeys.patientDiagnostics(id),
    queryFn: async () => (await authedApiFetch(`/treatments/tooth-diagnostics/${id}`)).data ?? [],
  })
}

// Identidad + contacto/responsable (sin PHI clínico). La usan agenda, facturación
// y consentimientos. Invalidar con queryKeys.patientContact(id) al editar el paciente.
export type PatientContactInfo = {
  id: string
  first_name: string
  last_name: string
  document_type: string | null
  document_number: string | null
  date_of_birth: string | null
  address: string | null
  age: number | null
  is_minor: boolean
  contact_name: string | null
  contact_relationship: string | null
  contact_phone: string | null
  contact_email: string | null
  contact_document_type: string | null
  contact_document_number: string | null
  contact_is_legal_guardian: boolean
  contact_receives_reminders: boolean
  contact_notes: string | null
  contact_reminders_authorized_at: string | null
  // Si los WhatsApp del turno van hoy al contacto (lo resuelve la API: menor de 16 o autorizado).
  reminders_to_contact: boolean
}

export function usePatientContact(id: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.patientContact(id ?? ''),
    queryFn: async (): Promise<PatientContactInfo | null> =>
      (await authedApiFetch(`/patients/${id}/contact`)).data ?? null,
    enabled: Boolean(id),
    staleTime: 1000 * 60 * 5,
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
