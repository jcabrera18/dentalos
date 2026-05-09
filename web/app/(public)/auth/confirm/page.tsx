'use client'

import Link from 'next/link'
import { Plus_Jakarta_Sans } from 'next/font/google'
import { ArrowRight, CheckCircle, XCircle } from 'lucide-react'
import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
})

function ConfirmContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const supabase = createClient()

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    async function confirm() {
      // ── PKCE flow: ?token_hash=...&type=... ─────────────────
      const token_hash = searchParams.get('token_hash')
      const type = searchParams.get('type') as 'signup' | 'email_change' | null

      if (token_hash && type) {
        const { error } = await supabase.auth.verifyOtp({ token_hash, type })
        if (error) {
          setErrorMsg('El enlace expiró o ya fue utilizado.')
          setStatus('error')
        } else {
          setStatus('success')
          setTimeout(() => router.push('/dashboard'), 2000)
        }
        return
      }

      // ── Implicit flow: #access_token=...&type=signup ─────────
      const hash = window.location.hash
      if (hash.includes('access_token')) {
        const params = new URLSearchParams(hash.slice(1))
        const access_token = params.get('access_token')
        const refresh_token = params.get('refresh_token')

        if (!access_token || !refresh_token) {
          setErrorMsg('El enlace de confirmación no es válido.')
          setStatus('error')
          return
        }

        const { error } = await supabase.auth.setSession({ access_token, refresh_token })
        if (error) {
          setErrorMsg('El enlace expiró o ya fue utilizado.')
          setStatus('error')
        } else {
          setStatus('success')
          setTimeout(() => router.push('/dashboard'), 2000)
        }
        return
      }

      // No token found at all
      setErrorMsg('El enlace de confirmación no es válido.')
      setStatus('error')
    }

    confirm()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Loading ──────────────────────────────────
  if (status === 'loading') {
    return (
      <div className="text-center space-y-3 py-4">
        <div className="w-8 h-8 border-2 border-[#00C4BC] border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-[#6B7280] text-sm">Confirmando tu cuenta...</p>
      </div>
    )
  }

  // ── Error ────────────────────────────────────
  if (status === 'error') {
    return (
      <div className="text-center space-y-5">
        <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mx-auto">
          <XCircle className="w-7 h-7 text-red-500" />
        </div>
        <div>
          <h2 className="text-lg font-extrabold text-[#0F1720] mb-2">No se pudo confirmar</h2>
          <p className="text-[#6B7280] text-sm leading-relaxed">{errorMsg}</p>
        </div>
        <Link
          href="/login"
          className="inline-flex items-center justify-center gap-2 w-full border-2 border-[#00C4BC]/30 hover:border-[#00C4BC] text-[#00C4BC] font-bold py-3.5 rounded-xl transition-all text-sm"
        >
          Ir al inicio de sesión
        </Link>
        <p className="text-xs text-[#9CA3AF]">
          ¿Necesitás un nuevo enlace?{' '}
          <Link href="/login" className="text-[#00C4BC] hover:underline">
            Ingresá y te lo reenviamos
          </Link>
        </p>
      </div>
    )
  }

  // ── Success ──────────────────────────────────
  return (
    <div className="text-center space-y-5">
      <div className="w-14 h-14 bg-[#E6F8F1] rounded-2xl flex items-center justify-center mx-auto">
        <CheckCircle className="w-7 h-7 text-[#00C4BC]" />
      </div>
      <div>
        <h2 className="text-lg font-extrabold text-[#0F1720] mb-2">Email confirmado</h2>
        <p className="text-[#6B7280] text-sm leading-relaxed">
          Tu cuenta está activa. Te redirigimos a tu consultorio en instantes...
        </p>
      </div>
      <button
        onClick={() => router.push('/dashboard')}
        className="inline-flex items-center justify-center gap-2 w-full bg-[#00C4BC] hover:bg-[#00aaa3] text-white font-bold py-3.5 rounded-xl transition-all text-sm shadow-lg shadow-[#00C4BC]/20"
      >
        Ir a mi consultorio
        <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  )
}

export default function ConfirmPage() {
  return (
    <div className={`${jakarta.className} min-h-screen bg-[#F9FAFB] flex items-center justify-center px-4`}>
      <div className="w-full max-w-md">

        <div className="text-center mb-8">
          <Link href="/" className="inline-block text-2xl font-extrabold text-[#0F1720]">
            Dental<span className="text-[#00C4BC]">OS</span>
          </Link>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-[#E5E7EB] p-8">
          <Suspense fallback={
            <div className="text-center py-4">
              <div className="w-8 h-8 border-2 border-[#00C4BC] border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          }>
            <ConfirmContent />
          </Suspense>
        </div>

      </div>
    </div>
  )
}
