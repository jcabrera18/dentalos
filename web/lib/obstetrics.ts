// Cálculos obstétricos derivados de la FUM (regla de Naegele).
// Ver docs/VITALOS_CLINICAL_HISTORIES_PLAN.md §6.3. Todo en cliente; no se persiste
// (EG/FPP se recalculan siempre desde la FUM para no guardar datos inconsistentes).

function parseISODate(d: string | null | undefined): Date | null {
  if (!d) return null
  const dt = new Date(d + 'T00:00:00')
  return isNaN(dt.getTime()) ? null : dt
}

// Fecha probable de parto = FUM + 280 días.
export function computeFpp(fum: string | null | undefined): string | null {
  const d = parseISODate(fum)
  if (!d) return null
  d.setDate(d.getDate() + 280)
  return d.toISOString().slice(0, 10)
}

// Edad gestacional a una fecha dada (default hoy): semanas + días desde la FUM.
export function computeEg(
  fum: string | null | undefined,
  at?: string | null,
): { weeks: number; days: number } | null {
  const start = parseISODate(fum)
  if (!start) return null
  const end = at ? parseISODate(at) : new Date()
  if (!end) return null
  const diffDays = Math.floor((end.getTime() - start.getTime()) / 86_400_000)
  if (diffDays < 0 || diffDays > 320) return null // fuera de rango razonable
  return { weeks: Math.floor(diffDays / 7), days: diffDays % 7 }
}

export function formatEg(eg: { weeks: number; days: number } | null): string {
  return eg ? `${eg.weeks}s ${eg.days}d` : '—'
}

export function formatDateAR(d: string | null | undefined): string {
  const dt = parseISODate(d)
  return dt ? dt.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'
}
