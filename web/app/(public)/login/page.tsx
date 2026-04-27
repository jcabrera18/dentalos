'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Plus_Jakarta_Sans } from 'next/font/google'
import { ArrowRight, Calendar, TrendingUp, Users, FileText } from 'lucide-react'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
})

// ── Left panel ─────────────────────────────────────────────────
function LeftPanel() {
  const [activeImage, setActiveImage] = useState(0)

  const screens = [
    { src: '/image_4.webp', label: 'Agenda', icon: Calendar, desc: 'Tu día organizado de un vistazo' },
    { src: '/image_3.webp', label: 'Pacientes', icon: Users, desc: 'Toda la info de tus pacientes' },
    { src: '/image_2.webp', label: 'Finanzas', icon: TrendingUp, desc: 'Ingresos y cobros en tiempo real' },
    { src: '/image_1.webp', label: 'Historia Clínica', icon: FileText, desc: 'Odontograma digital completo' },
  ]

  useEffect(() => {
    const t = setInterval(() => setActiveImage(i => (i + 1) % screens.length), 3500)
    return () => clearInterval(t)
  }, [])

  const active = screens[activeImage]
  const ActiveIcon = active.icon

  return (
    <div className="hidden lg:flex flex-col bg-[#0F1720] w-[480px] xl:w-[520px] flex-shrink-0 min-h-screen relative overflow-hidden">
      {/* ambient glow */}
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-[#00C4BC]/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-[#00C4BC]/6 rounded-full blur-[80px] pointer-events-none" />

      <div className="relative flex flex-col h-full p-10 xl:p-12">
        {/* Logo */}
        <Link href="/" className="text-2xl font-extrabold tracking-tight text-white mb-14">
          Dental<span className="text-[#00C4BC]">OS</span>
        </Link>

        {/* Welcome back copy */}
        <div className="mb-10">
          <span className="inline-flex items-center gap-2 bg-[#00C4BC]/15 border border-[#00C4BC]/30 text-[#00C4BC] text-xs font-bold px-3 py-1.5 rounded-full uppercase tracking-wider mb-5">
            <span className="w-1.5 h-1.5 bg-[#00C4BC] rounded-full animate-pulse" />
            Bienvenido de vuelta
          </span>
          <h2 className="text-3xl xl:text-4xl font-extrabold text-white leading-tight">
            Tu consultorio<br />
            <span className="text-[#00C4BC]">te está esperando.</span>
          </h2>
          <p className="text-[#6B7280] text-sm mt-4 leading-relaxed">
            Agenda, pacientes, historia clínica y finanzas — todo en un solo lugar.
          </p>
        </div>

        {/* Screenshot carousel */}
        <div className="mb-8 flex-1 flex flex-col">
          {/* Main image */}
          <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden p-4 mb-3">
            <div className="relative w-full h-52">
              {screens.map((s, i) => (
                <div
                  key={s.src}
                  className="absolute inset-0 transition-opacity duration-700"
                  style={{ opacity: activeImage === i ? 1 : 0 }}
                >
                  <Image src={s.src} alt={s.label} fill className="object-contain" priority={i === 0} />
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 bg-[#00C4BC]/15 rounded-lg flex items-center justify-center">
                  <ActiveIcon className="w-3.5 h-3.5 text-[#00C4BC]" />
                </div>
                <div>
                  <p className="text-white text-sm font-bold">{active.label}</p>
                  <p className="text-[#6B7280] text-xs">{active.desc}</p>
                </div>
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
                className="rounded-xl overflow-hidden border-2 transition-all p-2"
                style={{
                  borderColor: activeImage === i ? '#00C4BC' : 'rgba(255,255,255,0.08)',
                  background: activeImage === i ? 'rgba(0,196,188,0.1)' : 'rgba(255,255,255,0.03)',
                }}
              >
                <div className="relative w-full h-10">
                  <Image src={s.src} alt={s.label} fill className="object-contain" />
                </div>
                <p
                  className="text-center text-[10px] font-semibold mt-1.5"
                  style={{ color: activeImage === i ? '#00C4BC' : 'rgba(255,255,255,0.4)' }}
                >
                  {s.label}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Stats strip */}
        <div className="mt-auto border-t border-white/8 pt-6 grid grid-cols-3 gap-4">
          {[
            { num: '10 días', label: 'Prueba gratis' },
            { num: '5 min', label: 'Para empezar' },
            { num: '24/7', label: 'Desde cualquier lugar' },
          ].map((s, i) => (
            <div key={i} className="text-center">
              <p className="text-[#00C4BC] text-lg font-extrabold">{s.num}</p>
              <p className="text-[#6B7280] text-xs mt-0.5">{s.label}</p>
            </div>
          ))}
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
  if (m.includes('email not confirmed'))
    return 'Confirmá tu email antes de ingresar.'
  if (m.includes('too many requests') || m.includes('rate limit'))
    return 'Demasiados intentos. Esperá unos minutos e intentá de nuevo.'
  if (m.includes('user not found'))
    return 'No existe una cuenta con ese email.'
  if (m.includes('network') || m.includes('fetch'))
    return 'Error de conexión. Verificá tu internet e intentá de nuevo.'
  return msg
}

// ── Login form ─────────────────────────────────────────────────
function LoginForm() {
  const router = useRouter()
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(translateError(error.message))
      setLoading(false)
      return
    }
    router.push('/dashboard')
  }

  return (
    <div className="w-full max-w-sm">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold text-[#0F1720] mb-1">Ingresá a tu consultorio</h1>
        <p className="text-[#6B7280] text-sm">Ponete al día con tu agenda de hoy.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
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
            id="email"
            type="email"
            placeholder="dr@consultorio.com"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full border border-[#E5E7EB] bg-[#F9FAFB] rounded-xl px-4 py-3 text-[#0F1720] placeholder-[#9CA3AF] focus:outline-none focus:border-[#00C4BC] focus:bg-white transition-all text-sm"
          />
        </div>

        {/* Password */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label htmlFor="password" className="block text-xs font-bold text-[#0F1720] uppercase tracking-wider">
              Contraseña
            </label>
            <a href="#" className="text-xs text-[#00C4BC] hover:underline">
              ¿Olvidaste tu contraseña?
            </a>
          </div>
          <input
            id="password"
            type="password"
            placeholder="••••••••"
            required
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full border border-[#E5E7EB] bg-[#F9FAFB] rounded-xl px-4 py-3 text-[#0F1720] placeholder-[#9CA3AF] focus:outline-none focus:border-[#00C4BC] focus:bg-white transition-all text-sm"
          />
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[#00C4BC] hover:bg-[#00aaa3] disabled:opacity-50 text-white font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2 text-sm shadow-lg shadow-[#00C4BC]/20 mt-2"
        >
          {loading ? 'Ingresando...' : 'Entrar a mi consultorio'}
          {!loading && <ArrowRight className="h-4 w-4" />}
        </button>
      </form>

      {/* Divider */}
      <div className="my-6 flex items-center gap-3">
        <div className="flex-1 h-px bg-[#E5E7EB]" />
        <span className="text-xs text-[#9CA3AF]">¿No tenés cuenta?</span>
        <div className="flex-1 h-px bg-[#E5E7EB]" />
      </div>

      {/* Register CTA */}
      <Link
        href="/register"
        className="block w-full border-2 border-[#00C4BC]/30 hover:border-[#00C4BC] hover:bg-[#E6F8F1] text-[#00C4BC] font-bold py-3.5 rounded-xl transition-all text-sm text-center"
      >
        Empezar 10 días gratis
      </Link>

      <p className="text-center text-xs text-[#9CA3AF] mt-4">
        Sin tarjeta de crédito · Cancelás cuando querés
      </p>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────
export default function LoginPage() {
  return (
    <div className={`${jakarta.className} flex min-h-screen bg-white`}>
      {/* Left panel */}
      <LeftPanel />

      {/* Right: form */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#F3F4F6]">
          <Link href="/" className="lg:hidden text-xl font-extrabold text-[#0F1720]">
            Dental<span className="text-[#00C4BC]">OS</span>
          </Link>
          <div className="lg:ml-auto text-sm text-[#6B7280]">
            ¿No tenés cuenta?{' '}
            <Link href="/register" className="text-[#00C4BC] font-semibold hover:underline">
              Empezar gratis
            </Link>
          </div>
        </div>

        {/* Form area */}
        <div className="flex-1 flex items-start justify-center px-6 py-10 overflow-y-auto">
          <LoginForm />
        </div>

        {/* Mobile screenshots */}
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
