// src/lib/supabase.ts
// Two clients:
//   - supabaseAnon  → uses JWT from request (respects RLS)
//   - supabaseAdmin → uses service_role (bypasses RLS, for internal ops)

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../types/database.js'

const url  = process.env.SUPABASE_URL!
const anon = process.env.SUPABASE_ANON_KEY!
const svc  = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!url || !anon || !svc) {
  throw new Error('Missing Supabase env vars. Check .env.example')
}

// ── Public client (RLS enforced) ──────────────
// Used in route handlers — pass user JWT via auth header
export const supabaseAnon = createClient<Database>(url, anon, {
  auth: { persistSession: false, autoRefreshToken: false }
})

// ── Admin client (bypasses RLS) ───────────────
// Used for: migrations, background workers, onboarding
// NEVER expose to client or use in route handlers directly
export const supabaseAdmin = createClient<Database>(url, svc, {
  auth: { persistSession: false, autoRefreshToken: false }
})

// ── Per-request client factory ────────────────
// Creates a client that acts as the authenticated user
// Usage: const db = supabaseForUser(request.headers.authorization)
export function supabaseForUser(authHeader?: string): SupabaseClient<Database> {
  const token = authHeader?.replace('Bearer ', '')
  return createClient<Database>(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    }
  })
}
