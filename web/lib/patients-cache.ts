export type PatientSummary = {
  id: string
  first_name: string
  last_name: string
  phone: string | null
  gender: string | null
  insurance_name?: string | null
  last_appointment_at?: string | null
}

type PatientCacheEntry = {
  data: PatientSummary[]
  expiresAt: number
}

const PATIENTS_CACHE_TTL_MS = 30_000

const patientsCache = new Map<string, PatientCacheEntry>()
const patientsInFlight = new Map<string, Promise<PatientSummary[]>>()

function buildCacheKey(token: string, query: string) {
  return `${token}:${query.trim().toLowerCase()}`
}

export function getCachedPatients(token: string, query: string) {
  const key = buildCacheKey(token, query)
  const entry = patientsCache.get(key)

  if (!entry) return null

  if (entry.expiresAt <= Date.now()) {
    patientsCache.delete(key)
    return null
  }

  return entry.data
}

export function cachePatients(token: string, query: string, data: PatientSummary[]) {
  const key = buildCacheKey(token, query)

  patientsCache.set(key, {
    data,
    expiresAt: Date.now() + PATIENTS_CACHE_TTL_MS,
  })
}

export function getPatientsInFlight(token: string, query: string) {
  return patientsInFlight.get(buildCacheKey(token, query)) ?? null
}

export function setPatientsInFlight(token: string, query: string, request: Promise<PatientSummary[]>) {
  patientsInFlight.set(buildCacheKey(token, query), request)
}

export function clearPatientsInFlight(token: string, query: string) {
  patientsInFlight.delete(buildCacheKey(token, query))
}

export function invalidatePatientsCache() {
  patientsCache.clear()
  patientsInFlight.clear()
}
