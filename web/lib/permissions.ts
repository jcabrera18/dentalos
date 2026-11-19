// permissions.ts — Roles y permisos por usuario (rol "Administrativo")
//
// FUENTE DE VERDAD DUPLICADA: este archivo existe idéntico en
//   - web/lib/permissions.ts                 (frontend)
//   - dentalos-api/src/lib/permissions.ts    (backend)
// La región entre los marcadores <SYNC:permissions> debe ser IDÉNTICA en ambos.
// El test dentalos-api/src/lib/__tests__/permissions.test.ts falla si divergen.
//
// Modelo:
//   - El ROL define una base. owner/admin/professional tienen todo (comportamiento
//     histórico). `receptionist` ("Administrativo/a") arranca con DEFAULT_PERMISSIONS
//     y el owner/admin puede prender/apagar cada permiso (professionals.permissions).
//   - El acceso CLÍNICO (historia clínica, encounters, odontograma, archivos médicos,
//     consentimientos, PHI del paciente) NO es un permiso: depende solo del rol y no
//     se puede habilitar desde la UI. Ver hasClinicalAccess().
//   - Esto es autorización de UX en el frontend; la barrera real es la API
//     (src/lib/accessPolicy.ts) + RLS (migración 077).

// <SYNC:permissions> START — mantener idéntico entre web/ y dentalos-api/
export const ROLES = ['owner', 'admin', 'professional', 'receptionist'] as const
export type Role = (typeof ROLES)[number]

export const ROLE_LABELS: Record<Role, string> = {
  owner: 'Dueño/a',
  admin: 'Admin',
  professional: 'Profesional',
  receptionist: 'Administrativo/a',
}

// Roles sin acceso a información clínica de pacientes.
export const NON_CLINICAL_ROLES: readonly Role[] = ['receptionist']

// Roles cuyos permisos el owner/admin puede configurar uno por uno.
export const CONFIGURABLE_ROLES: readonly Role[] = ['receptionist']

export const PERMISSIONS = [
  'agenda.manage',
  'patients.manage',
  'payments.manage',
  'quotes.manage',
  'invoices.issue',
  'notifications.manage',
  'finance.view',
  'expenses.manage',
] as const

export type Permission = (typeof PERMISSIONS)[number]
export type PermissionMap = Record<Permission, boolean>

export const PERMISSION_LABELS: Record<Permission, { label: string; description: string }> = {
  'agenda.manage': {
    label: 'Agenda',
    description: 'Ver y gestionar turnos y bloqueos de todos los profesionales.',
  },
  'patients.manage': {
    label: 'Datos de pacientes',
    description: 'Alta y edición de datos de contacto (nombre, DNI, teléfono, obra social). Nunca incluye información clínica.',
  },
  'payments.manage': {
    label: 'Cobros',
    description: 'Registrar cobros, ver la caja del día y la cuenta corriente de los pacientes.',
  },
  'quotes.manage': {
    label: 'Presupuestos',
    description: 'Crear y editar presupuestos.',
  },
  'invoices.issue': {
    label: 'Facturación AFIP',
    description: 'Emitir facturas electrónicas a nombre del profesional del cobro.',
  },
  'notifications.manage': {
    label: 'Recordatorios',
    description: 'Enviar recordatorios y mensajes de WhatsApp a pacientes.',
  },
  'finance.view': {
    label: 'Estadísticas y finanzas',
    description: 'Ver KPIs, estadísticas, movimientos y resúmenes de facturación de la clínica.',
  },
  'expenses.manage': {
    label: 'Gastos',
    description: 'Ver y registrar gastos de la clínica.',
  },
}

export const DEFAULT_PERMISSIONS: Record<Role, PermissionMap> = {
  owner: allPermissions(true),
  admin: allPermissions(true),
  professional: allPermissions(true),
  receptionist: {
    'agenda.manage': true,
    'patients.manage': true,
    'payments.manage': true,
    'quotes.manage': true,
    'invoices.issue': true,
    'notifications.manage': true,
    'finance.view': false,
    'expenses.manage': false,
  },
}

function allPermissions(value: boolean): PermissionMap {
  return Object.fromEntries(PERMISSIONS.map((p) => [p, value])) as PermissionMap
}

export function isPermission(value: unknown): value is Permission {
  return typeof value === 'string' && (PERMISSIONS as readonly string[]).includes(value)
}

// Rol desconocido/ausente ⇒ 'professional' (compat: usuarios previos sin rol
// conservan el comportamiento histórico). La API además resuelve el rol desde la
// base, así que este fallback solo aplica a tokens legacy.
export function normalizeRole(role: unknown): Role {
  return typeof role === 'string' && (ROLES as readonly string[]).includes(role)
    ? (role as Role)
    : 'professional'
}

export function hasClinicalAccess(role: unknown): boolean {
  return !NON_CLINICAL_ROLES.includes(normalizeRole(role))
}

export function isConfigurableRole(role: unknown): boolean {
  return CONFIGURABLE_ROLES.includes(normalizeRole(role))
}

// Permisos efectivos = defaults del rol + overrides guardados (solo para roles
// configurables; claves desconocidas o valores no booleanos se ignoran).
export function resolvePermissions(role: unknown, overrides?: unknown): PermissionMap {
  const r = normalizeRole(role)
  const result: PermissionMap = { ...DEFAULT_PERMISSIONS[r] }
  if (!isConfigurableRole(r) || !overrides || typeof overrides !== 'object') return result
  for (const [key, value] of Object.entries(overrides as Record<string, unknown>)) {
    if (isPermission(key) && typeof value === 'boolean') result[key] = value
  }
  return result
}
// <SYNC:permissions> END
