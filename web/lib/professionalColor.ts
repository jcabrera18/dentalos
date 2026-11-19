// Identidad visual de cada profesional en agenda y dashboard (vista de toda la
// clínica del Administrativo): color + iniciales.
//
// `professionals.color` se asigna al crear el profesional (hex) y la API lo
// devuelve como `professional_color` en turnos. Si falta o es inválido, se
// deriva un color estable del id para que cada profesional se distinga igual.

const FALLBACK_PALETTE = [
  '#2563EB', '#DB2777', '#059669', '#D97706', '#7C3AED',
  '#DC2626', '#0891B2', '#65A30D', '#C026D3', '#EA580C',
]

const HEX_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i

function hashIndex(seed: string, mod: number): number {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return h % mod
}

/** Color del profesional (hex). Acepta un profesional o un turno. */
export function professionalColor(src: { id?: string; professional_id?: string; color?: string | null; professional_color?: string | null } | null | undefined): string {
  const raw = src?.professional_color ?? src?.color
  if (raw && HEX_RE.test(raw)) return raw
  const seed = src?.professional_id ?? src?.id ?? ''
  return FALLBACK_PALETTE[hashIndex(seed, FALLBACK_PALETTE.length)]
}

/** Iniciales a partir de "Nombre Apellido" (máx. 2 letras). */
export function professionalInitials(name: string | null | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  const first = parts[0][0] ?? ''
  const last = parts.length > 1 ? parts[parts.length - 1][0] : ''
  return (first + last).toUpperCase()
}

/** Nombre corto para chips/columnas: "Ana P." */
export function professionalShortName(name: string | null | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return ''
  if (parts.length === 1) return parts[0]
  return `${parts[0]} ${parts[parts.length - 1][0]}.`
}
