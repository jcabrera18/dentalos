'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { getLocalPatients, syncPatients, type LocalPatient } from './patientsLocalDb'

type UseLocalPatientsResult = {
  patients: LocalPatient[]
  ready: boolean      // ya leímos IndexedDB (aunque esté vacío)
  syncing: boolean    // hay un sync contra el server en curso
  resync: () => Promise<void>
}

// Espeja la cartera en IndexedDB y la mantiene fresca. La búsqueda se hace local
// sobre `patients` (ver filterLocalPatients). El sync corre al montar y on-demand.
export function useLocalPatients(): UseLocalPatientsResult {
  const [patients, setPatients] = useState<LocalPatient[]>([])
  const [ready, setReady] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const syncingRef = useRef(false)

  const resync = useCallback(async () => {
    if (syncingRef.current) return
    syncingRef.current = true
    setSyncing(true)
    try {
      const fresh = await syncPatients()
      setPatients(fresh)
    } catch {
      // Offline o error de red: nos quedamos con lo que ya hay en IndexedDB.
    } finally {
      syncingRef.current = false
      setSyncing(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      // 1) Pinta lo persistido al instante.
      const local = await getLocalPatients()
      if (cancelled) return
      setPatients(local)
      setReady(true)
      // 2) Sincroniza (full la 1ª vez, delta después) en background.
      await resync()
    })()
    return () => { cancelled = true }
  }, [resync])

  return { patients, ready, syncing, resync }
}
