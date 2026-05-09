'use client'

import Link from 'next/link'
import { Plus_Jakarta_Sans } from 'next/font/google'
import { ArrowLeft, ArrowRight, Mail } from 'lucide-react'
import { useState } from 'react'
import { apiFetch } from '@/lib/api'

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
})

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await apiFetch('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      })
      setSent(true)
    } catch {
      // Show generic message to avoid email enumeration from client errors
      setSent(true)
    } finally {
      setLoading(false)
    }
  }

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

          {sent ? (
            /* Success state */
            <div className="text-center space-y-5">
              <div className="w-14 h-14 bg-[#E6F8F1] rounded-2xl flex items-center justify-center mx-auto">
                <Mail className="w-7 h-7 text-[#00C4BC]" />
              </div>
              <div>
                <h1 className="text-xl font-extrabold text-[#0F1720] mb-2">Revisá tu email</h1>
                <p className="text-[#6B7280] text-sm leading-relaxed">
                  Si <span className="font-semibold text-[#0F1720]">{email}</span> tiene una cuenta en DentalOS, vas a recibir un enlace para restablecer tu contraseña en los próximos minutos.
                </p>
              </div>
              <p className="text-xs text-[#9CA3AF]">
                ¿No llegó? Revisá la carpeta de spam o{' '}
                <button
                  onClick={() => setSent(false)}
                  className="text-[#00C4BC] hover:underline"
                >
                  intentá de nuevo
                </button>
                .
              </p>
            </div>
          ) : (
            /* Form */
            <>
              <div className="mb-7">
                <h1 className="text-xl font-extrabold text-[#0F1720] mb-1">¿Olvidaste tu contraseña?</h1>
                <p className="text-[#6B7280] text-sm">
                  Ingresá tu email y te enviamos un enlace para restablecerla.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
                    {error}
                  </div>
                )}

                <div>
                  <label htmlFor="email" className="block text-xs font-bold text-[#0F1720] uppercase tracking-wider mb-2">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    placeholder="dr@consultorio.com"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full border border-[#E5E7EB] bg-[#F9FAFB] rounded-xl px-4 py-3 text-[#0F1720] placeholder-[#9CA3AF] focus:outline-none focus:border-[#00C4BC] focus:bg-white transition-all text-sm"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#00C4BC] hover:bg-[#00aaa3] disabled:opacity-50 text-white font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 text-sm shadow-lg shadow-[#00C4BC]/20"
                >
                  {loading ? 'Enviando...' : 'Enviar enlace'}
                  {!loading && <ArrowRight className="h-4 w-4" />}
                </button>
              </form>
            </>
          )}

        </div>

        {/* Back to login */}
        <div className="text-center mt-5">
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-sm text-[#6B7280] hover:text-[#0F1720] transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver al inicio de sesión
          </Link>
        </div>

      </div>
    </div>
  )
}
