'use client'

import { apiFetch } from './api'

type ProfileData = {
  id?: string
  first_name?: string
  last_name?: string
  clinics?: { id?: string; name?: string; slug?: string }
  [key: string]: any
}

let cache: { data: ProfileData; fetchedAt: number } | null = null
const CACHE_TTL_MS = 5 * 60 * 1000

export async function fetchProfile(token: string): Promise<ProfileData> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.data
  }
  const res = await apiFetch('/auth/me', { token })
  const data = res.data ?? res
  cache = { data, fetchedAt: Date.now() }
  return data
}

export function invalidateProfileCache() {
  cache = null
}
