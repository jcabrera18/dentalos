import { createBrowserClient } from '@supabase/ssr'

let client: ReturnType<typeof createBrowserClient> | null = null

export function createClient() {
  if (!client) {
    client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }
  return client
}

// Returns a fresh access token, proactively refreshing if it's within 60s of expiry.
// Prefer this over reading session.access_token directly from state.
export async function getToken(): Promise<string | null> {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return null

  const nowSecs = Math.floor(Date.now() / 1000)
  const expiresAt = session.expires_at ?? 0

  if (expiresAt - nowSecs < 60) {
    const { data } = await supabase.auth.refreshSession()
    return data.session?.access_token ?? null
  }

  return session.access_token
}