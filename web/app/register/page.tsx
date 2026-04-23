'use client'

import Link from 'next/link'
import { ArrowRight } from "lucide-react"
import { useState, useEffect, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { apiFetch } from "@/lib/api"
import { createClient } from "@/lib/supabase"
import { useRouter } from "next/navigation"

// ── Invite banner shown when joining an existing clinic ──
function InviteBanner({ clinicName }: { clinicName: string }) {
  return (
    <div className="p-3 bg-emerald-900/30 border border-emerald-700 rounded-lg text-emerald-300 text-sm text-center">
      Fuiste invitado a unirte a <span className="font-bold">{clinicName}</span>
    </div>
  )
}

// ── Main form — separated so useSearchParams can be inside Suspense ──
function RegisterForm() {
  const router = useRouter()
  const supabase = createClient()
  const searchParams = useSearchParams()
  const inviteToken = searchParams.get('invite')

  const [inviteClinic, setInviteClinic] = useState<{ id: string; name: string } | null>(null)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [inviteLoading, setInviteLoading] = useState(!!inviteToken)

  const [form, setForm] = useState({
    clinic_name: "",
    first_name: "",
    last_name: "",
    email: "",
    password: "",
  })
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [showLoginModal, setShowLoginModal] = useState(false)
  const [loginPassword, setLoginPassword] = useState("")
  const [loginLoading, setLoginLoading] = useState(false)
  const [loginError, setLoginError] = useState("")

  // Validate invite token on mount
  useEffect(() => {
    if (!inviteToken) return
    apiFetch(`/professionals/invite/${inviteToken}`)
      .then(res => setInviteClinic(res.data.clinic))
      .catch(err => setInviteError(err.message))
      .finally(() => setInviteLoading(false))
  }, [inviteToken])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoginLoading(true)
    setLoginError("")

    const { error } = await supabase.auth.signInWithPassword({
      email: form.email,
      password: loginPassword,
    })

    if (error) {
      setLoginError(error.message)
      setLoginLoading(false)
      return
    }

    router.push('/dashboard')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const body: Record<string, string> = {
        email:      form.email,
        password:   form.password,
        first_name: form.first_name,
        last_name:  form.last_name,
      }

      if (inviteToken) {
        body.invite_token = inviteToken
      } else {
        body.clinic_name = form.clinic_name
      }

      await apiFetch('/auth/register', {
        method: 'POST',
        body: JSON.stringify(body),
      })
      setSubmitted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido")
    } finally {
      setLoading(false)
    }
  }

  // Show error if invite link is invalid/expired
  if (inviteToken && inviteError) {
    return (
      <div className="w-full max-w-md text-center space-y-4">
        <div className="bg-surface rounded-2xl p-8 border border-app space-y-4">
          <div className="text-5xl">⚠️</div>
          <h2 className="text-xl font-bold text-app">Link inválido</h2>
          <p className="text-app2 text-sm">{inviteError}</p>
          <Link href="/register" className="inline-block text-emerald-400 hover:underline text-sm">
            Crear una cuenta nueva
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-md">
      {submitted ? (
        <div className="bg-surface rounded-2xl p-8 border border-app text-center space-y-4">
          <div className="text-5xl">🎉</div>
          <h2 className="text-2xl font-bold text-app">¡Cuenta creada!</h2>
          <p className="text-app2 text-sm leading-relaxed">
            {inviteClinic
              ? `Ya sos parte de ${inviteClinic.name}. Ingresá para empezar.`
              : 'Tu cuenta está lista. Ingresá ahora para empezar a ordenar tu consultorio.'
            }
          </p>
          <button
            onClick={() => setShowLoginModal(true)}
            className="inline-flex items-center justify-center gap-2 w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-bold py-4 rounded-lg transition-all text-base"
          >
            Ingresar a mi consultorio <ArrowRight className="h-5 w-5" />
          </button>
          {!inviteClinic && (
            <p className="text-xs text-app2">Tus 10 días de prueba empezaron ahora.</p>
          )}
        </div>
      ) : (
        <>
          <div className="text-center mb-8">
            {inviteLoading ? (
              <p className="text-app2 text-sm">Verificando invitación...</p>
            ) : inviteClinic ? (
              <>
                <h1 className="text-2xl font-bold text-app mb-2">Completá tu perfil</h1>
                <p className="text-app2 text-sm">Vas a unirte a <span className="text-emerald-400 font-medium">{inviteClinic.name}</span></p>
              </>
            ) : (
              <>
                <h1 className="text-2xl font-bold text-app mb-2">Empezar 10 días gratis</h1>
                <p className="text-app2 text-sm">Sin tarjeta de crédito · Sin compromiso · Listo en 5 minutos</p>
              </>
            )}
          </div>

          <form onSubmit={handleSubmit} className="bg-surface rounded-2xl p-8 border border-app/30 space-y-4">
            {inviteClinic && <InviteBanner clinicName={inviteClinic.name} />}

            {error && (
              <div className="p-3 bg-red-900/30 border border-red-700 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-app2 mb-2">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                placeholder="dr@consultorio.com"
                required
                value={form.email}
                onChange={handleChange}
                className="w-full bg-surface2 border border-app rounded-lg px-4 py-3 text-app placeholder-app2 focus:outline-none focus:border-emerald-400"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-app2 mb-2">
                Contraseña
              </label>
              <input
                id="password"
                name="password"
                type="password"
                placeholder="Mínimo 8 caracteres"
                required
                minLength={8}
                value={form.password}
                onChange={handleChange}
                className={`w-full bg-surface2 border rounded-lg px-4 py-3 text-app placeholder-app2 focus:outline-none focus:border-emerald-400 ${
                  form.password.length > 0 && form.password.length < 8
                    ? 'border-red-500'
                    : 'border-app'
                }`}
              />
              {form.password.length > 0 && form.password.length < 8 && (
                <p className="text-red-400 text-xs mt-1">
                  La contraseña debe tener al menos 8 caracteres ({form.password.length}/8)
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="first_name" className="block text-sm font-medium text-app2 mb-2">
                  Nombre
                </label>
                <input
                  id="first_name"
                  name="first_name"
                  placeholder="Juan"
                  required
                  value={form.first_name}
                  onChange={handleChange}
                  className="w-full bg-surface2 border border-app rounded-lg px-4 py-3 text-app placeholder-app2 focus:outline-none focus:border-emerald-400"
                />
              </div>
              <div>
                <label htmlFor="last_name" className="block text-sm font-medium text-app2 mb-2">
                  Apellido
                </label>
                <input
                  id="last_name"
                  name="last_name"
                  placeholder="Pérez"
                  required
                  value={form.last_name}
                  onChange={handleChange}
                  className="w-full bg-surface2 border border-app rounded-lg px-4 py-3 text-app placeholder-app2 focus:outline-none focus:border-emerald-400"
                />
              </div>
            </div>

            {/* Only show clinic_name when NOT using an invite */}
            {!inviteToken && (
              <div>
                <label htmlFor="clinic_name" className="block text-sm font-medium text-app2 mb-2">
                  Nombre del consultorio
                </label>
                <input
                  id="clinic_name"
                  name="clinic_name"
                  placeholder="Odontología García"
                  required
                  value={form.clinic_name}
                  onChange={handleChange}
                  className="w-full bg-surface2 border border-app rounded-lg px-4 py-3 text-app placeholder-app2 focus:outline-none focus:border-emerald-400"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading || inviteLoading}
              className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 disabled:opacity-50 text-white font-bold py-4 rounded-lg transition-all flex items-center justify-center gap-2 text-base"
            >
              {loading
                ? "Creando tu cuenta..."
                : inviteClinic
                  ? "Unirme al consultorio"
                  : "Crear cuenta gratis"
              }
              {!loading && <ArrowRight className="h-5 w-5" />}
            </button>

            <p className="text-center text-xs text-app2">
              Al registrarte aceptás nuestros{' '}
              <a href="#" className="text-emerald-400 hover:underline">términos y condiciones</a>.
            </p>
          </form>

          {!inviteToken && (
            <div className="mt-6 grid grid-cols-3 gap-4 text-center">
              <div className="text-xs text-app2">
                <div className="text-lg mb-1">🔒</div>
                Datos seguros
              </div>
              <div className="text-xs text-app2">
                <div className="text-lg mb-1">💳</div>
                Sin tarjeta
              </div>
              <div className="text-xs text-app2">
                <div className="text-lg mb-1">❌</div>
                Cancelás ya
              </div>
            </div>
          )}
        </>
      )}

      {/* Login Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-app rounded-2xl w-full max-w-md p-8 relative">
            <button
              onClick={() => setShowLoginModal(false)}
              className="absolute top-4 right-4 text-app2 hover:text-app transition-colors text-xl leading-none"
            >
              ✕
            </button>

            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-app">
                Dental<span className="text-emerald-400">OS</span>
              </h1>
              <p className="text-app2 mt-2 text-sm">Ingresá a tu consultorio</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-app2 mb-2">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={() => {}}
                  className="w-full bg-surface2 border border-app rounded-lg px-4 py-3 text-app focus:outline-none focus:border-emerald-400"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-app2 mb-2">Contraseña</label>
                <input
                  type="password"
                  value={loginPassword}
                  onChange={e => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full bg-surface2 border border-app rounded-lg px-4 py-3 text-app placeholder-app2 focus:outline-none focus:border-emerald-400"
                />
              </div>

              {loginError && (
                <div className="p-3 bg-red-900/30 border border-red-700 rounded-lg text-red-400 text-sm">
                  {loginError}
                </div>
              )}

              <button
                type="submit"
                disabled={loginLoading}
                className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-bold py-4 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {loginLoading ? 'Ingresando...' : 'Entrar a mi consultorio'}
                {!loginLoading && <ArrowRight className="h-5 w-5" />}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default function RegisterPage() {
  return (
    <div className="min-h-screen bg-app flex flex-col">
      <div className="px-6 py-4 flex justify-between items-center border-b border-app/20">
        <Link href="/" className="text-xl font-bold text-app">
          Dental<span className="text-emerald-500">OS</span>
        </Link>
        <span className="text-xs text-app2">
          ¿Ya tenés cuenta?{' '}
          <button className="text-emerald-400 hover:underline" onClick={() => window.location.href = '/'}>
            Ingresar
          </button>
        </span>
      </div>

      <div className="flex-1 flex items-center justify-center p-4">
        <Suspense fallback={
          <div className="text-app2 text-sm">Cargando...</div>
        }>
          <RegisterForm />
        </Suspense>
      </div>
    </div>
  )
}
