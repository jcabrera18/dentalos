'use client'

import Link from 'next/link'
import { Plus_Jakarta_Sans } from 'next/font/google'
import { ArrowRight, CheckCircle, XCircle } from 'lucide-react'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
})

function translateError(msg: string): string {
  const m = msg.toLowerCase()
  if (m.includes('new password should be different'))
    return 'La nueva contraseña debe ser diferente a la anterior.'
  if (m.includes('password should be at least'))
    return 'La contraseña debe tener al menos 8 caracteres.'
  if (m.includes('expired') || m.includes('invalid') || m.includes('already used'))
    return 'El enlace expiró o ya fue utilizado. Solicitá uno nuevo.'
  if (m.includes('network') || m.includes('fetch'))
    return 'Error de conexión. Verificá tu internet e intentá de nuevo.'
  return msg
}

function ResetPasswordForm() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const supabase = createClient()

  const [status, setStatus] = useState<'loading' | 'ready' | 'success' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState('')

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  // Exchange the code from the URL for an active session
  useEffect(() => {
    async function init() {
    const code = searchParams.get('code')

    // ── PKCE flow: ?code=... ─────────────────────────────────
    if (code) {
      supabase.auth.exchangeCodeForSession(code)
        .then(({ error }: { error: Error | null }) => {
          if (error) {
            setErrorMsg('El enlace expiró o ya fue utilizado. Solicitá uno nuevo.')
            setStatus('error')
          } else {
            setStatus('ready')
          }
        })
      return
    }

    // ── Implicit flow: #access_token=...&type=recovery ───────
    const hash = window.location.hash
    if (hash.includes('access_token') && hash.includes('type=recovery')) {
      const params = new URLSearchParams(hash.slice(1))
      const access_token = params.get('access_token')
      const refresh_token = params.get('refresh_token')

      if (!access_token || !refresh_token) {
        setErrorMsg('El enlace no es válido o ya fue utilizado.')
        setStatus('error')
        return
      }

      const { error } = await supabase.auth.setSession({ access_token, refresh_token })
      if (error) {
        setErrorMsg('El enlace expiró o ya fue utilizado. Solicitá uno nuevo.')
        setStatus('error')
      } else {
        setStatus('ready')
      }
      return
    }

    setErrorMsg('El enlace no es válido o ya fue utilizado.')
    setStatus('error')
    }
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaveError('')

    if (password !== confirm) {
      setSaveError('Las contraseñas no coinciden.')
      return
    }
    if (password.length < 8) {
      setSaveError('La contraseña debe tener al menos 8 caracteres.')
      return
    }

    setSaving(true)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setSaveError(translateError(error.message))
      setSaving(false)
      return
    }
    setStatus('success')
  }

  // ── Loading ──────────────────────────────────
  if (status === 'loading') {
    return (
      <div className="text-center space-y-3 py-4">
        <div className="w-8 h-8 border-2 border-[#00C4BC] border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-[#6B7280] text-sm">Verificando enlace...</p>
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
          <h2 className="text-lg font-extrabold text-[#0F1720] mb-2">Enlace inválido</h2>
          <p className="text-[#6B7280] text-sm leading-relaxed">{errorMsg}</p>
        </div>
        <Link
          href="/auth/forgot-password"
          className="inline-flex items-center justify-center gap-2 w-full bg-[#00C4BC] hover:bg-[#00aaa3] text-white font-bold py-3.5 rounded-xl transition-all text-sm"
        >
          Solicitar nuevo enlace
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    )
  }

  // ── Success ──────────────────────────────────
  if (status === 'success') {
    return (
      <div className="text-center space-y-5">
        <div className="w-14 h-14 bg-[#E6F8F1] rounded-2xl flex items-center justify-center mx-auto">
          <CheckCircle className="w-7 h-7 text-[#00C4BC]" />
        </div>
        <div>
          <h2 className="text-lg font-extrabold text-[#0F1720] mb-2">Contraseña actualizada</h2>
          <p className="text-[#6B7280] text-sm">Ya podés ingresar con tu nueva contraseña.</p>
        </div>
        <button
          onClick={() => router.push('/login')}
          className="inline-flex items-center justify-center gap-2 w-full bg-[#00C4BC] hover:bg-[#00aaa3] text-white font-bold py-3.5 rounded-xl transition-all text-sm"
        >
          Ir al inicio de sesión
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    )
  }

  // ── Form ─────────────────────────────────────
  return (
    <>
      <div className="mb-7">
        <h1 className="text-xl font-extrabold text-[#0F1720] mb-1">Nueva contraseña</h1>
        <p className="text-[#6B7280] text-sm">Elegí una contraseña segura para tu cuenta.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {saveError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
            {saveError}
          </div>
        )}

        <div>
          <label htmlFor="password" className="block text-xs font-bold text-[#0F1720] uppercase tracking-wider mb-2">
            Nueva contraseña
          </label>
          <input
            id="password"
            type="password"
            placeholder="Mínimo 8 caracteres"
            required
            minLength={8}
            value={password}
            onChange={e => setPassword(e.target.value)}
            className={`w-full border bg-[#F9FAFB] rounded-xl px-4 py-3 text-[#0F1720] placeholder-[#9CA3AF] focus:outline-none focus:bg-white transition-all text-sm ${
              password.length > 0 && password.length < 8
                ? 'border-red-400 focus:border-red-400'
                : 'border-[#E5E7EB] focus:border-[#00C4BC]'
            }`}
          />
          {password.length > 0 && password.length < 8 && (
            <p className="text-red-500 text-xs mt-1.5">{password.length}/8 caracteres</p>
          )}
        </div>

        <div>
          <label htmlFor="confirm" className="block text-xs font-bold text-[#0F1720] uppercase tracking-wider mb-2">
            Confirmá la contraseña
          </label>
          <input
            id="confirm"
            type="password"
            placeholder="Repetí tu contraseña"
            required
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            className={`w-full border bg-[#F9FAFB] rounded-xl px-4 py-3 text-[#0F1720] placeholder-[#9CA3AF] focus:outline-none focus:bg-white transition-all text-sm ${
              confirm.length > 0 && confirm !== password
                ? 'border-red-400 focus:border-red-400'
                : 'border-[#E5E7EB] focus:border-[#00C4BC]'
            }`}
          />
          {confirm.length > 0 && confirm !== password && (
            <p className="text-red-500 text-xs mt-1.5">Las contraseñas no coinciden.</p>
          )}
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-[#00C4BC] hover:bg-[#00aaa3] disabled:opacity-50 text-white font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 text-sm shadow-lg shadow-[#00C4BC]/20"
        >
          {saving ? 'Guardando...' : 'Guardar nueva contraseña'}
          {!saving && <ArrowRight className="h-4 w-4" />}
        </button>
      </form>
    </>
  )
}

export default function ResetPasswordPage() {
  return (
    <div className={`${jakarta.className} min-h-screen bg-[#F9FAFB] flex items-center justify-center px-4`}>
      <div className="w-full max-w-md">

        {/* Logo */}
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
            <ResetPasswordForm />
          </Suspense>
        </div>

      </div>
    </div>
  )
}
