'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Plus_Jakarta_Sans } from 'next/font/google'
import { ArrowRight, Check, Shield, Smartphone, Users } from 'lucide-react'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { apiFetch } from '@/lib/api'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
})

// ── Left panel — static brand + social proof ──────────────────
function LeftPanel() {
  const [activeImage, setActiveImage] = useState(0)

  const screens = [
    { src: '/image_4.webp', label: 'Agenda', desc: 'Vista diaria y semanal sin cruces' },
    { src: '/image_3.webp', label: 'Pacientes', desc: 'Ficha completa en segundos' },
    { src: '/image_2.webp', label: 'Finanzas', desc: 'Ingresos en tiempo real' },
    { src: '/image_1.webp', label: 'Historia Clínica', desc: 'Odontograma digital' },
  ]

  useEffect(() => {
    const t = setInterval(() => setActiveImage(i => (i + 1) % screens.length), 3000)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="hidden lg:flex flex-col bg-[#0F1720] w-[480px] xl:w-[520px] flex-shrink-0 min-h-screen relative overflow-hidden">
      {/* subtle teal glow */}
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-[#00C4BC]/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-[#00C4BC]/6 rounded-full blur-[80px] pointer-events-none" />

      <div className="relative flex flex-col h-full p-10 xl:p-12">
        {/* Logo */}
        <Link href="/" className="text-2xl font-extrabold tracking-tight text-white mb-14">
          Dental<span className="text-[#00C4BC]">OS</span>
        </Link>

        {/* Headline */}
        <div className="mb-10">
          <span className="inline-flex items-center gap-2 bg-[#00C4BC]/15 border border-[#00C4BC]/30 text-[#00C4BC] text-xs font-bold px-3 py-1.5 rounded-full uppercase tracking-wider mb-5">
            <span className="w-1.5 h-1.5 bg-[#00C4BC] rounded-full animate-pulse" />
            10 días gratis · Sin tarjeta
          </span>
          <h2 className="text-3xl xl:text-4xl font-extrabold text-white leading-tight">
            Organizá tu consultorio<br />
            <span className="text-[#00C4BC]">sin papeles, sin caos.</span>
          </h2>
          <p className="text-[#6B7280] text-sm mt-4 leading-relaxed">
            Agenda, pacientes, historia clínica y finanzas — todo en un solo lugar. Listo en 5 minutos.
          </p>
        </div>

        {/* App screenshot carousel */}
        <div className="mb-8">
          {/* Main screen */}
          <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden p-4 mb-3">
            <div className="relative w-full h-52">
              {screens.map((s, i) => (
                <div
                  key={s.src}
                  className="absolute inset-0 transition-opacity duration-700"
                  style={{ opacity: activeImage === i ? 1 : 0 }}
                >
                  <Image
                    src={s.src}
                    alt={s.label}
                    fill
                    className="object-contain"
                    priority={i === 0}
                  />
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between">
              <div>
                <p className="text-white text-sm font-bold">{screens[activeImage].label}</p>
                <p className="text-[#6B7280] text-xs mt-0.5">{screens[activeImage].desc}</p>
              </div>
              <div className="flex gap-1.5">
                {screens.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveImage(i)}
                    className="w-1.5 h-1.5 rounded-full transition-all"
                    style={{ background: activeImage === i ? '#00C4BC' : 'rgba(255,255,255,0.2)' }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Thumbnail strip */}
          <div className="grid grid-cols-4 gap-2">
            {screens.map((s, i) => (
              <button
                key={s.src}
                onClick={() => setActiveImage(i)}
                className="relative rounded-xl overflow-hidden border-2 transition-all p-2 bg-white/5"
                style={{
                  borderColor: activeImage === i ? '#00C4BC' : 'rgba(255,255,255,0.08)',
                  background: activeImage === i ? 'rgba(0,196,188,0.1)' : 'rgba(255,255,255,0.03)',
                }}
              >
                <div className="relative w-full h-10">
                  <Image src={s.src} alt={s.label} fill className="object-contain" />
                </div>
                <p className="text-center text-[10px] font-semibold mt-1.5"
                  style={{ color: activeImage === i ? '#00C4BC' : 'rgba(255,255,255,0.4)' }}>
                  {s.label}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Key benefits */}
        <div className="space-y-3 mb-8">
          {[
            { icon: Check, text: 'Recordatorios automáticos por WhatsApp' },
            { icon: Smartphone, text: 'Funciona desde el celular, tablet o computadora' },
            { icon: Users, text: 'Multi-profesional con agendas separadas' },
            { icon: Shield, text: 'Tus datos seguros con respaldo en la nube' },
          ].map(({ icon: Icon, text }, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-7 h-7 bg-[#00C4BC]/15 rounded-lg flex items-center justify-center flex-shrink-0">
                <Icon className="w-3.5 h-3.5 text-[#00C4BC]" />
              </div>
              <span className="text-[#9CA3AF] text-sm">{text}</span>
            </div>
          ))}
        </div>

        {/* Testimonial */}
        <div className="mt-auto border-t border-white/8 pt-6">
          <div className="flex gap-1 mb-3">
            {[...Array(5)].map((_, i) => (
              <span key={i} className="text-amber-400 text-sm">★</span>
            ))}
          </div>
          <p className="text-[#9CA3AF] text-sm leading-relaxed italic mb-4">
            "Antes perdía 1 hora por día en administración. Ahora son 10 minutos y ya estoy atendiendo."
          </p>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[#00C4BC]/20 rounded-full flex items-center justify-center text-[#00C4BC] text-xs font-bold">
              MG
            </div>
            <div>
              <p className="text-white text-xs font-semibold">Dra. María García</p>
              <p className="text-[#6B7280] text-xs">Odontóloga general · CABA</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Error translation ──────────────────────────────────────────
function translateError(msg: string): string {
  const m = msg.toLowerCase()
  if (m.includes('invalid login credentials') || m.includes('invalid_credentials'))
    return 'Email o contraseña incorrectos.'
  if (m.includes('user already registered') || m.includes('already been registered'))
    return 'Ya existe una cuenta con ese email.'
  if (m.includes('email not confirmed'))
    return 'Confirmá tu email antes de ingresar.'
  if (m.includes('too many requests') || m.includes('rate limit'))
    return 'Demasiados intentos. Esperá unos minutos e intentá de nuevo.'
  if (m.includes('password should be at least'))
    return 'La contraseña debe tener al menos 8 caracteres.'
  if (m.includes('unable to validate email'))
    return 'El email ingresado no es válido.'
  if (m.includes('network') || m.includes('fetch'))
    return 'Error de conexión. Verificá tu internet e intentá de nuevo.'
  return msg
}

// ── Invite banner ──────────────────────────────────────────────
function InviteBanner({ clinicName }: { clinicName: string }) {
  return (
    <div className="p-3 bg-[#E6F8F1] border border-[#00C4BC]/30 rounded-xl text-[#00C4BC] text-sm text-center font-medium">
      Fuiste invitado a unirte a <span className="font-bold">{clinicName}</span>
    </div>
  )
}

// ── Register form ──────────────────────────────────────────────
function RegisterForm() {
  const router = useRouter()
  const supabase = createClient()
  const searchParams = useSearchParams()
  const inviteToken = searchParams.get('invite')

  const [inviteClinic, setInviteClinic] = useState<{ id: string; name: string } | null>(null)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [inviteLoading, setInviteLoading] = useState(!!inviteToken)

  const [form, setForm] = useState({ clinic_name: '', first_name: '', last_name: '', email: '', password: '' })
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [showLoginModal, setShowLoginModal] = useState(false)
  const [loginPassword, setLoginPassword] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)
  const [loginError, setLoginError] = useState('')

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
    setLoginError('')
    const { error } = await supabase.auth.signInWithPassword({ email: form.email, password: loginPassword })
    if (error) { setLoginError(translateError(error.message)); setLoginLoading(false); return }
    router.push('/dashboard')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const body: Record<string, string> = {
        email: form.email, password: form.password,
        first_name: form.first_name, last_name: form.last_name,
      }
      if (inviteToken) { body.invite_token = inviteToken } else { body.clinic_name = form.clinic_name }
      await apiFetch('/auth/register', { method: 'POST', body: JSON.stringify(body) })
      setSubmitted(true)
    } catch (err) {
      setError(translateError(err instanceof Error ? err.message : 'Error desconocido'))
    } finally {
      setLoading(false)
    }
  }

  // Invalid invite
  if (inviteToken && inviteError) {
    return (
      <div className="text-center space-y-4 max-w-sm mx-auto">
        <div className="text-5xl">⚠️</div>
        <h2 className="text-xl font-bold text-[#0F1720]">Link inválido</h2>
        <p className="text-[#6B7280] text-sm">{inviteError}</p>
        <Link href="/register" className="inline-block text-[#00C4BC] hover:underline text-sm">
          Crear una cuenta nueva
        </Link>
      </div>
    )
  }

  // Success state
  if (submitted) {
    return (
      <div className="text-center space-y-6 max-w-sm mx-auto">
        <div className="w-16 h-16 bg-[#E6F8F1] rounded-2xl flex items-center justify-center mx-auto">
          <Check className="w-8 h-8 text-[#00C4BC]" />
        </div>
        <div>
          <h2 className="text-2xl font-extrabold text-[#0F1720] mb-2">¡Cuenta creada!</h2>
          <p className="text-[#6B7280] text-sm leading-relaxed">
            {inviteClinic
              ? `Ya sos parte de ${inviteClinic.name}. Ingresá para empezar.`
              : 'Tu cuenta está lista. Ingresá ahora para empezar a ordenar tu consultorio.'}
          </p>
        </div>
        <button
          onClick={() => setShowLoginModal(true)}
          className="inline-flex items-center justify-center gap-2 w-full bg-[#00C4BC] hover:bg-[#00aaa3] text-white font-bold py-4 rounded-xl transition-all text-base shadow-lg shadow-[#00C4BC]/20"
        >
          Ingresar a mi consultorio <ArrowRight className="h-5 w-5" />
        </button>
        {!inviteClinic && (
          <p className="text-xs text-[#6B7280]">Tus 10 días de prueba empezaron ahora.</p>
        )}
      </div>
    )
  }

  return (
    <div className="w-full max-w-sm">
      {/* Header */}
      <div className="mb-8">
        {inviteLoading ? (
          <p className="text-[#6B7280] text-sm">Verificando invitación...</p>
        ) : inviteClinic ? (
          <>
            <h1 className="text-2xl font-extrabold text-[#0F1720] mb-1">Completá tu perfil</h1>
            <p className="text-[#6B7280] text-sm">
              Vas a unirte a <span className="text-[#00C4BC] font-semibold">{inviteClinic.name}</span>
            </p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-extrabold text-[#0F1720] mb-1">Empezar 10 días gratis</h1>
            <p className="text-[#6B7280] text-sm">Sin tarjeta · Sin compromiso · Listo en 5 minutos</p>
          </>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {inviteClinic && <InviteBanner clinicName={inviteClinic.name} />}

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
            {error}
          </div>
        )}

        {/* Email */}
        <div>
          <label htmlFor="email" className="block text-xs font-bold text-[#0F1720] uppercase tracking-wider mb-2">
            Email
          </label>
          <input
            id="email" name="email" type="email"
            placeholder="dr@consultorio.com" required
            value={form.email} onChange={handleChange}
            className="w-full border border-[#E5E7EB] bg-[#F9FAFB] rounded-xl px-4 py-3 text-[#0F1720] placeholder-[#9CA3AF] focus:outline-none focus:border-[#00C4BC] focus:bg-white transition-all text-sm"
          />
        </div>

        {/* Password */}
        <div>
          <label htmlFor="password" className="block text-xs font-bold text-[#0F1720] uppercase tracking-wider mb-2">
            Contraseña
          </label>
          <input
            id="password" name="password" type="password"
            placeholder="Mínimo 8 caracteres" required minLength={8}
            value={form.password} onChange={handleChange}
            className={`w-full border bg-[#F9FAFB] rounded-xl px-4 py-3 text-[#0F1720] placeholder-[#9CA3AF] focus:outline-none focus:bg-white transition-all text-sm ${
              form.password.length > 0 && form.password.length < 8
                ? 'border-red-400 focus:border-red-400'
                : 'border-[#E5E7EB] focus:border-[#00C4BC]'
            }`}
          />
          {form.password.length > 0 && form.password.length < 8 && (
            <p className="text-red-500 text-xs mt-1.5">
              {form.password.length}/8 caracteres
            </p>
          )}
        </div>

        {/* Name */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="first_name" className="block text-xs font-bold text-[#0F1720] uppercase tracking-wider mb-2">
              Nombre
            </label>
            <input
              id="first_name" name="first_name" placeholder="Juan" required
              value={form.first_name} onChange={handleChange}
              className="w-full border border-[#E5E7EB] bg-[#F9FAFB] rounded-xl px-4 py-3 text-[#0F1720] placeholder-[#9CA3AF] focus:outline-none focus:border-[#00C4BC] focus:bg-white transition-all text-sm"
            />
          </div>
          <div>
            <label htmlFor="last_name" className="block text-xs font-bold text-[#0F1720] uppercase tracking-wider mb-2">
              Apellido
            </label>
            <input
              id="last_name" name="last_name" placeholder="Pérez" required
              value={form.last_name} onChange={handleChange}
              className="w-full border border-[#E5E7EB] bg-[#F9FAFB] rounded-xl px-4 py-3 text-[#0F1720] placeholder-[#9CA3AF] focus:outline-none focus:border-[#00C4BC] focus:bg-white transition-all text-sm"
            />
          </div>
        </div>

        {/* Clinic name */}
        {!inviteToken && (
          <div>
            <label htmlFor="clinic_name" className="block text-xs font-bold text-[#0F1720] uppercase tracking-wider mb-2">
              Nombre del consultorio
            </label>
            <input
              id="clinic_name" name="clinic_name"
              placeholder="Odontología García" required
              value={form.clinic_name} onChange={handleChange}
              className="w-full border border-[#E5E7EB] bg-[#F9FAFB] rounded-xl px-4 py-3 text-[#0F1720] placeholder-[#9CA3AF] focus:outline-none focus:border-[#00C4BC] focus:bg-white transition-all text-sm"
            />
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={loading || inviteLoading}
          className="w-full bg-[#00C4BC] hover:bg-[#00aaa3] disabled:opacity-50 text-white font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2 text-sm shadow-lg shadow-[#00C4BC]/20 mt-2"
        >
          {loading
            ? 'Creando tu cuenta...'
            : inviteClinic
              ? 'Unirme al consultorio'
              : 'Crear cuenta gratis'}
          {!loading && <ArrowRight className="h-4 w-4" />}
        </button>

        <p className="text-center text-xs text-[#9CA3AF]">
          Al registrarte aceptás nuestros{' '}
          <a href="#" className="text-[#00C4BC] hover:underline">términos y condiciones</a>.
        </p>
      </form>

      {/* Trust badges */}
      {!inviteToken && (
        <div className="mt-8 grid grid-cols-3 gap-3">
          {[
            { icon: Shield, label: 'Datos seguros' },
            { icon: Check, label: 'Sin tarjeta' },
            { icon: ArrowRight, label: 'Cancelás ya' },
          ].map(({ icon: Icon, label }, i) => (
            <div key={i} className="flex flex-col items-center gap-1.5 p-3 bg-[#F3F4F6] rounded-xl">
              <Icon className="w-4 h-4 text-[#00C4BC]" />
              <span className="text-[10px] font-semibold text-[#6B7280] text-center">{label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Login modal */}
      {showLoginModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-8 relative shadow-2xl">
            <button
              onClick={() => setShowLoginModal(false)}
              className="absolute top-4 right-4 text-[#6B7280] hover:text-[#0F1720] transition-colors text-xl leading-none"
            >
              ✕
            </button>
            <div className="text-center mb-8">
              <h1 className="text-3xl font-extrabold text-[#0F1720]">
                Dental<span className="text-[#00C4BC]">OS</span>
              </h1>
              <p className="text-[#6B7280] mt-2 text-sm">Ingresá a tu consultorio</p>
            </div>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#0F1720] uppercase tracking-wider mb-2">Email</label>
                <input
                  type="email" value={form.email} onChange={() => {}} readOnly
                  className="w-full border border-[#E5E7EB] bg-[#F3F4F6] rounded-xl px-4 py-3 text-[#0F1720] focus:outline-none text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#0F1720] uppercase tracking-wider mb-2">Contraseña</label>
                <input
                  type="password" value={loginPassword}
                  onChange={e => setLoginPassword(e.target.value)}
                  placeholder="••••••••" required
                  className="w-full border border-[#E5E7EB] bg-[#F3F4F6] rounded-xl px-4 py-3 text-[#0F1720] placeholder-[#9CA3AF] focus:outline-none focus:border-[#00C4BC] transition-colors text-sm"
                />
              </div>
              {loginError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
                  {loginError}
                </div>
              )}
              <button
                type="submit" disabled={loginLoading}
                className="w-full bg-[#00C4BC] hover:bg-[#00aaa3] disabled:opacity-50 text-white font-bold py-4 rounded-xl transition-colors flex items-center justify-center gap-2 text-sm"
              >
                {loginLoading ? 'Ingresando...' : 'Entrar a mi consultorio'}
                {!loginLoading && <ArrowRight className="h-4 w-4" />}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────
export default function RegisterPage() {
  return (
    <div className={`${jakarta.className} flex min-h-screen bg-white`}>
      {/* Left panel */}
      <LeftPanel />

      {/* Right: form */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Top bar (mobile logo + "already have account") */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#F3F4F6]">
          <Link href="/" className="lg:hidden text-xl font-extrabold text-[#0F1720]">
            Dental<span className="text-[#00C4BC]">OS</span>
          </Link>
          <div className="lg:ml-auto text-sm text-[#6B7280]">
            ¿Ya tenés cuenta?{' '}
            <Link href="/login" className="text-[#00C4BC] font-semibold hover:underline">
              Ingresar
            </Link>
          </div>
        </div>

        {/* Form area */}
        <div className="flex-1 flex items-start justify-center px-6 py-10 overflow-y-auto">
          <Suspense fallback={<div className="text-[#6B7280] text-sm">Cargando...</div>}>
            <RegisterForm />
          </Suspense>
        </div>

        {/* Bottom mobile screenshots (only on mobile) */}
        <div className="lg:hidden px-6 pb-8">
          <div className="grid grid-cols-4 gap-2">
            {[
              { src: '/image_4.webp', label: 'Agenda' },
              { src: '/image_3.webp', label: 'Pacientes' },
              { src: '/image_2.webp', label: 'Finanzas' },
              { src: '/image_1.webp', label: 'Historia' },
            ].map((img) => (
              <div key={img.src} className="bg-[#F3F4F6] rounded-xl p-2 flex flex-col items-center gap-1">
                <div className="relative w-full h-12">
                  <Image src={img.src} alt={img.label} fill className="object-contain" />
                </div>
                <span className="text-[9px] font-bold text-[#6B7280] uppercase tracking-wide">{img.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
