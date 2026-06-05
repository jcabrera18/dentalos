import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // getSession() lee de la cookie SIN hop de red. Solo pegamos a Auth (refreshSession)
  // cuando el token está por vencer — evita ~800ms en CADA navegación RSC.
  // El gating de auth no depende de esto: lo hacen las páginas (getSession), RLS y la API (JWKS).
  const { data: { session } } = await supabase.auth.getSession()
  if (session) {
    const now = Math.floor(Date.now() / 1000)
    const expiresAt = session.expires_at ?? 0
    if (expiresAt - now < 120) {
      await supabase.auth.refreshSession()
    }
  }
  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
