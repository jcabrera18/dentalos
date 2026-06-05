// Cartera de pacientes espejada en IndexedDB para búsqueda 100% local (instantánea + offline).
// Store DEDICADO (no es el cache de React Query) porque el patrón de acceso es distinto:
// se filtra en memoria y tiene su propio cursor de delta sync.
// OJO: solo metadata liviana — NADA de archivos/radiografías ni data clínica.

import { get, set, createStore, type UseStore } from 'idb-keyval'
import { authedApiFetch, type PatientSummary } from './queries'

export type LocalPatient = PatientSummary & {
  document_number?: string | null
  is_active?: boolean
  updated_at?: string
  deleted_at?: string | null
}

let store: UseStore | null = null
function getStore() {
  if (!store) store = createStore('dentalos-patients', 'kv')
  return store
}

const PAGE_SIZE = 1000
const KEY_PATIENTS = 'patients'
const KEY_CURSOR = 'cursor'

async function fetchPage(offset: number, since?: string): Promise<LocalPatient[]> {
  const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) })
  if (since) params.set('since', since)
  const res = await authedApiFetch(`/patients/sync?${params.toString()}`)
  return res.data ?? []
}

export async function getLocalPatients(): Promise<LocalPatient[]> {
  return (await get(KEY_PATIENTS, getStore())) ?? []
}

// Dedupe de concurrencia: si el layout y la página /patients disparan el sync a la vez,
// comparten una sola promesa (evita doble descarga y carreras escribiendo IndexedDB).
let inFlight: Promise<LocalPatient[]> | null = null

// Sincroniza la cartera a IndexedDB. Full si no hay cursor; delta (?since) si lo hay.
// Pagina secuencialmente (1000) hasta una página incompleta. Devuelve la lista activa.
export function syncPatients(): Promise<LocalPatient[]> {
  if (inFlight) return inFlight
  inFlight = doSync().finally(() => { inFlight = null })
  return inFlight
}

async function doSync(): Promise<LocalPatient[]> {
  const s = getStore()
  const existing: LocalPatient[] = (await get(KEY_PATIENTS, s)) ?? []
  const cursor: string | undefined = await get(KEY_CURSOR, s)

  const byId = new Map<string, LocalPatient>(existing.map((p) => [p.id, p]))
  let maxUpdated = cursor ?? ''
  let offset = 0

  for (;;) {
    const page = await fetchPage(offset, cursor)
    for (const p of page) {
      if (p.updated_at && p.updated_at > maxUpdated) maxUpdated = p.updated_at
      if (p.deleted_at) byId.delete(p.id)
      else byId.set(p.id, p)
    }
    if (page.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }

  const merged = Array.from(byId.values())
  await set(KEY_PATIENTS, merged, s)
  if (maxUpdated) await set(KEY_CURSOR, maxUpdated, s)
  return merged
}

function normalize(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
}

// Filtro local: nombre/apellido (substring) + teléfono/DNI (por dígitos). Cap a 50 resultados.
export function filterLocalPatients(patients: LocalPatient[], query: string, limit = 50): LocalPatient[] {
  const q = normalize(query.trim())
  if (q.length < 3) return []
  const digits = q.replace(/\D/g, '')

  const out: LocalPatient[] = []
  for (const p of patients) {
    const name = normalize(`${p.first_name} ${p.last_name}`)
    const matchName = name.includes(q)
    const matchPhone = digits.length > 0 && (p.phone ?? '').replace(/\D/g, '').includes(digits)
    const matchDoc = digits.length > 0 && (p.document_number ?? '').replace(/\D/g, '').includes(digits)
    if (matchName || matchPhone || matchDoc) out.push(p)
  }
  // Mismo orden que la lista original (por apellido), y cap.
  out.sort((a, b) => `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`, 'es'))
  return out.slice(0, limit)
}
