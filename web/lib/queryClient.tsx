'use client'

import { useEffect, useState } from 'react'
import { QueryClient } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import { get, set, del, createStore, type UseStore } from 'idb-keyval'
import { createClient } from '@/lib/supabase'

// Subí este número si cambia la forma de los datos cacheados (invalida todo lo persistido).
const CACHE_BUSTER = 'v1'

// Cuánto tiempo sobrevive el cache en IndexedDB entre sesiones.
const PERSIST_MAX_AGE = 1000 * 60 * 60 * 24 // 24h

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Pinta al instante desde cache y revalida en background.
        staleTime: 1000 * 30, // 30s "fresco" — evita refetch en navegaciones rápidas
        gcTime: PERSIST_MAX_AGE, // debe ser >= maxAge del persister
        refetchOnWindowFocus: true, // reemplaza los visibilitychange manuales
        refetchOnReconnect: true,
        retry: 2,
        // offlineFirst: si hay cache lo usa aunque no haya red; cuando vuelve, revalida.
        networkMode: 'offlineFirst',
      },
      mutations: {
        networkMode: 'offlineFirst',
      },
    },
  })
}

// Store de IndexedDB dedicado (no choca con el resto de la app).
let idbStore: UseStore | null = null
function getStore() {
  if (!idbStore) idbStore = createStore('dentalos-cache', 'react-query')
  return idbStore
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(makeQueryClient)

  const [persister] = useState(() =>
    createAsyncStoragePersister({
      storage: {
        getItem: (key) => get(key, getStore()),
        setItem: (key, value) => set(key, value, getStore()),
        removeItem: (key) => del(key, getStore()),
      },
      key: 'dentalos-rq',
    })
  )

  // Limpia el cache persistido al cerrar sesión para no filtrar datos entre usuarios.
  useEffect(() => {
    const supabase = createClient()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: string) => {
      if (event === 'SIGNED_OUT') {
        queryClient.clear()
        void persister.removeClient()
      }
    })
    return () => subscription.unsubscribe()
  }, [queryClient, persister])

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: PERSIST_MAX_AGE,
        buster: CACHE_BUSTER,
        dehydrateOptions: {
          // No persistir queries en error — solo data buena.
          shouldDehydrateQuery: (query) => query.state.status === 'success',
        },
      }}
    >
      {children}
    </PersistQueryClientProvider>
  )
}
