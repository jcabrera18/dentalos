'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { apiFetch } from '@/lib/api'

export type SubscriptionStatus = {
  plan: string
  planName: string
  status: string

  trial: {
    active: boolean
    endsAt: string | null
    daysLeft: number | null
    expired: boolean
  }

  subscription: {
    endsAt: string | null
    daysLeft: number | null
    expired: boolean
  }

  features: {
    whatsapp: boolean
    maxPatients: number | null
    maxProfessionals: number | null
    waMsgMonthlyQuota: number | null
  }

  usage: {
    patients: number
    professionals: number
    waMsgUsedThisMonth: number
    waMsgMonthResetsAt: string
  }

  alerts: {
    accessBlocked: boolean
    showTrialBanner: boolean
    showRenewalBanner: boolean
    waMsgQuotaExceeded: boolean
    waMsgQuotaWarning: boolean
    patientsLimitReached: boolean
    professionalsLimitReached: boolean
  }
}

type UseSubscriptionResult = {
  data: SubscriptionStatus | null
  loading: boolean
  error: string | null
  refetch: () => void
}

// Module-level cache so the data survives re-renders without extra fetches
let cache: { data: SubscriptionStatus; fetchedAt: number } | null = null
const CACHE_TTL_MS = 2 * 60 * 1000 // 2 minutes

export function useSubscription(): UseSubscriptionResult {
  const [data, setData] = useState<SubscriptionStatus | null>(cache?.data ?? null)
  const [loading, setLoading] = useState(!cache)
  const [error, setError] = useState<string | null>(null)
  const fetchCountRef = useRef(0)

  async function fetch() {
    // Use cache if fresh
    if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
      setData(cache.data)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    const currentFetch = ++fetchCountRef.current

    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()

      let activeSession = session
      if (!activeSession) {
        const { data: { session: refreshed } } = await supabase.auth.refreshSession()
        activeSession = refreshed
      }

      if (!activeSession) {
        setError('No session')
        setLoading(false)
        return
      }

      const res = await apiFetch('/subscription/status', {
        token: activeSession.access_token,
      })

      // Ignore stale responses if refetch was called again
      if (currentFetch !== fetchCountRef.current) return

      cache = { data: res, fetchedAt: Date.now() }
      setData(res)
    } catch (err) {
      if (currentFetch !== fetchCountRef.current) return
      setError(err instanceof Error ? err.message : 'Error al cargar suscripción')
    } finally {
      if (currentFetch === fetchCountRef.current) {
        setLoading(false)
      }
    }
  }

  useEffect(() => {
    fetch()
  }, [])

  return { data, loading, error, refetch: fetch }
}

// Call this when the user upgrades / changes plan to bust the cache
export function invalidateSubscriptionCache() {
  cache = null
}
