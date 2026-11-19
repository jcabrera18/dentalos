'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ChevronDown, ChevronRight, Lock, Users } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { queryKeys } from '@/lib/queries'
import {
  PERMISSIONS,
  PERMISSION_LABELS,
  ROLE_LABELS,
  isConfigurableRole,
  normalizeRole,
  resolvePermissions,
  type Permission,
  type PermissionMap,
} from '@/lib/permissions'

type TeamMember = {
  id: string
  first_name: string
  last_name: string
  email?: string | null
  role: string
  permissions?: Record<string, boolean> | null
  is_active?: boolean
}

// Equipo de la clínica + permisos del rol Administrativo. Solo se muestra a
// owner/admin. La API (PATCH /professionals/:id/permissions) vuelve a validar.
export function TeamPermissionsSection({
  token,
  members,
  myId,
  onMemberUpdated,
}: {
  token: string
  members: TeamMember[]
  myId: string
  onMemberUpdated: (id: string, permissions: Record<string, boolean>) => void
}) {
  const [openId, setOpenId] = useState<string | null>(null)
  const active = members.filter(m => m.is_active !== false)

  return (
    <div className="bg-surface border border-app rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-app">
        <h2 className="font-semibold text-app flex items-center gap-2">
          <Users size={16} className="text-app3" /> Equipo
        </h2>
        <p className="text-xs text-app3 mt-0.5">
          Usuarios de la clínica. Para los Administrativos podés elegir a qué secciones acceden.
        </p>
      </div>

      <div className="divide-y divide-app">
        {active.map(m => {
          const role = normalizeRole(m.role)
          const configurable = isConfigurableRole(role)
          const open = openId === m.id
          return (
            <div key={m.id}>
              <button
                type="button"
                disabled={!configurable}
                onClick={() => setOpenId(open ? null : m.id)}
                className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-surface2/60 disabled:hover:bg-transparent disabled:cursor-default transition-colors"
              >
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-medium text-app truncate">
                    {m.first_name} {m.last_name}{m.id === myId ? ' (vos)' : ''}
                  </span>
                  {m.email && <span className="block text-xs text-app3 truncate">{m.email}</span>}
                </span>
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                    configurable
                      ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
                      : 'bg-[#E6F8F1] text-[#00A39C] dark:bg-[#00C4BC]/15 dark:text-[#00C4BC]'
                  }`}
                >
                  {ROLE_LABELS[role]}
                </span>
                {configurable && (open
                  ? <ChevronDown size={16} className="text-app3 shrink-0" />
                  : <ChevronRight size={16} className="text-app3 shrink-0" />)}
              </button>

              {configurable && open && (
                <PermissionEditor
                  token={token}
                  member={m}
                  onSaved={perms => onMemberUpdated(m.id, perms)}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function PermissionEditor({
  token,
  member,
  onSaved,
}: {
  token: string
  member: TeamMember
  onSaved: (permissions: Record<string, boolean>) => void
}) {
  const qc = useQueryClient()
  const [perms, setPerms] = useState<PermissionMap>(() => resolvePermissions(member.role, member.permissions))
  const [saving, setSaving] = useState<Permission | null>(null)
  const [error, setError] = useState('')

  async function toggle(p: Permission) {
    const next = !perms[p]
    setError('')
    setSaving(p)
    setPerms(prev => ({ ...prev, [p]: next })) // optimista
    try {
      const res = await apiFetch(`/professionals/${member.id}/permissions`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({ permissions: { [p]: next } }),
      })
      const saved: PermissionMap = res.data?.permissions ?? { ...perms, [p]: next }
      setPerms(saved)
      onSaved({ ...(member.permissions ?? {}), [p]: next })
      void qc.invalidateQueries({ queryKey: queryKeys.professionals })
    } catch (err) {
      setPerms(prev => ({ ...prev, [p]: !next }))
      setError(err instanceof Error ? err.message : 'No se pudo guardar el permiso')
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="px-5 pb-4 pt-1 bg-surface2/30">
      <div className="divide-y divide-app border border-app rounded-xl bg-surface">
        {PERMISSIONS.map(p => (
          <div key={p} className="flex items-start gap-3 px-4 py-3">
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-medium text-app">{PERMISSION_LABELS[p].label}</span>
              <span className="block text-xs text-app3 mt-0.5">{PERMISSION_LABELS[p].description}</span>
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={perms[p]}
              aria-label={PERMISSION_LABELS[p].label}
              disabled={saving !== null}
              onClick={() => toggle(p)}
              className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 mt-0.5 disabled:opacity-60 ${
                perms[p] ? 'bg-[#00C4BC]' : 'bg-surface3'
              }`}
            >
              <span
                className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${
                  perms[p] ? 'left-5' : 'left-0.5'
                }`}
              />
            </button>
          </div>
        ))}
        <div className="flex items-start gap-3 px-4 py-3 opacity-80">
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-medium text-app">Información clínica</span>
            <span className="block text-xs text-app3 mt-0.5">
              Historia clínica, evoluciones, odontograma, archivos médicos y consentimientos. Nunca disponible para Administrativos.
            </span>
          </span>
          <Lock size={16} className="text-app3 shrink-0 mt-0.5" />
        </div>
      </div>
      {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
      <p className="text-xs text-app3 mt-2">Los cambios se aplican en menos de un minuto.</p>
    </div>
  )
}
