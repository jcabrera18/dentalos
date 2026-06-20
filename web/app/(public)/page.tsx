'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Plus_Jakarta_Sans } from 'next/font/google'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
})

// Número de WhatsApp de soporte (+54 9 3438 55-8913, formato internacional sin + ni espacios)
const WHATSAPP_NUMBER = '5493438558913'
const WHATSAPP_MSG = encodeURIComponent('Hola! Quiero que me muestren cómo funciona DentalOS 🙂')
const waLink = `https://wa.me/${WHATSAPP_NUMBER}?text=${WHATSAPP_MSG}`

// ── Marco de celular reutilizable ──────────────────────────
function PhoneShell({
  children,
  badge,
  badgeColor = '#00C4BC',
  className = '',
}: {
  children: React.ReactNode
  badge?: string
  badgeColor?: string
  className?: string
}) {
  return (
    <div className={`relative ${className}`}>
      {badge && (
        <span
          className="absolute -top-3 left-1/2 -translate-x-1/2 z-20 text-white text-[11px] sm:text-xs font-bold px-3.5 py-1 rounded-full shadow-lg whitespace-nowrap"
          style={{ backgroundColor: badgeColor }}
        >
          {badge}
        </span>
      )}
      <div className="rounded-[2.4rem] border-[8px] border-[#0F1720] bg-[#0F1720] shadow-2xl shadow-[#00C4BC]/25 overflow-hidden">
        {children}
      </div>
    </div>
  )
}

// Video enmarcado en celular: solo reproduce cuando está en pantalla
function PhoneVideo({ src, badge, className }: { src: string; badge?: string; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) el.play().catch(() => {})
        else el.pause()
      },
      { threshold: 0.4 }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return (
    <PhoneShell badge={badge} className={className}>
      <video ref={ref} src={src} muted loop playsInline preload="metadata" className="w-full h-auto block rounded-[1.7rem]" />
    </PhoneShell>
  )
}

// Imagen enmarcada en celular
function PhoneImage({ src, alt, badge, className }: { src: string; alt: string; badge?: string; className?: string }) {
  return (
    <PhoneShell badge={badge} className={className}>
      <Image src={src} alt={alt} width={738} height={1600} className="w-full h-auto block rounded-[1.7rem]" />
    </PhoneShell>
  )
}

export default function HomePage() {
  const router = useRouter()
  const supabase = createClient()

  // Supabase implicit flow: redirect auth callbacks that land on the home page
  useEffect(() => {
    const hash = window.location.hash
    if (hash.includes('type=recovery')) {
      router.replace('/auth/reset-password' + hash)
    } else if (hash.includes('type=signup') || hash.includes('type=email_change')) {
      router.replace('/auth/confirm' + hash)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [annualBilling, setAnnualBilling] = useState(true)

  // annual = precio mensual equivalente cuando se factura anual (total = monthly × 10, ÷12 = ~2 meses gratis)
  const PRICES = {
    starter: { monthly: 38000, annual: Math.round(38000 * 10 / 12) },
    growth:  { monthly: 58000, annual: Math.round(58000 * 10 / 12) },
    scale:   { monthly: 95000, annual: Math.round(95000 * 10 / 12) },
  }

  function price(plan: keyof typeof PRICES) {
    const p = PRICES[plan]
    return (annualBilling ? p.annual : p.monthly).toLocaleString('es-AR')
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }
    router.push('/dashboard')
  }

  const faqs = [
    {
      q: '¿Es difícil de aprender?',
      a: 'No. Está pensado para que lo entiendas solo, sin manuales. La mayoría lo está usando el primer día sin que nadie le explique nada. Si sabés mandar un WhatsApp, sabés usar DentalOS.',
    },
    {
      q: 'Nunca usé un sistema, siempre trabajé con papel. ¿Voy a poder?',
      a: 'Sí, y sos exactamente para quien lo hicimos. No necesitás saber de computación. Y si en algún momento te trabás, nos escribís por WhatsApp y te ayudamos en el momento.',
    },
    {
      q: '¿Lo puedo usar desde el celular?',
      a: 'Sí. Funciona igual de bien en el celular que en la computadora o la tablet. Muchos odontólogos lo manejan solo desde el teléfono.',
    },
    {
      q: '¿Tengo que instalar o descargar algo?',
      a: 'No. Entrás con tu email desde el navegador y listo. Nada que instalar, nada que actualizar. Funciona desde donde estés.',
    },
    {
      q: '¿Qué pasa con los pacientes que ya tengo en papel o Excel?',
      a: 'Los pasamos juntos. Te ayudamos a cargarlos —incluso lo hacemos por vos— así no empezás de cero. No perdés nada de lo que ya tenés.',
    },
    {
      q: '¿Cuánto tardo en tener todo andando?',
      a: 'Crear la cuenta te lleva 5 minutos. Para tener tu agenda y tus pacientes funcionando, unos pocos días si querés que te acompañemos en la migración.',
    },
    {
      q: '¿Mis datos están seguros?',
      a: 'Sí. Tus datos se guardan con respaldo automático en la nube. Vos sos el único dueño de tu información y podés exportarla cuando quieras.',
    },
  ]

  return (
    <div className={`${jakarta.className} bg-white text-[#0F1720]`}>

      {/* ── NAVBAR ─────────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-b border-[#E6F8F1]">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="text-2xl font-extrabold tracking-tight text-[#0F1720]">
            Dental<span className="text-[#00C4BC]">OS</span>
          </Link>
          <div className="hidden md:flex items-center gap-8">
            <a href="#resultados" className="text-[#6B7280] hover:text-[#0F1720] transition-colors text-sm font-medium">
              Cómo se usa
            </a>
            <a href="#pricing" className="text-[#6B7280] hover:text-[#0F1720] transition-colors text-sm font-medium">
              Precios
            </a>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-[#6B7280] hover:text-[#0F1720] transition-colors text-sm font-medium"
            >
              Ingresar
            </Link>
            <Link
              href="/register"
              className="bg-[#00C4BC] hover:bg-[#00aaa3] text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors"
            >
              Probar gratis →
            </Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ───────────────────────────────────────────────── */}
      <section className="pt-32 pb-16 bg-white overflow-hidden relative">
        {/* subtle teal glow */}
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-[#00C4BC]/8 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-[#00C4BC]/5 rounded-full blur-[80px] pointer-events-none" />

        <div className="max-w-5xl mx-auto px-6 relative">
          {/* badge */}
          <div className="flex justify-center mb-8">
            <span className="inline-flex items-center gap-2 bg-[#E6F8F1] border border-[#00C4BC]/30 text-[#00C4BC] text-xs font-bold px-4 py-1.5 rounded-full uppercase tracking-wider text-center">
              <span className="w-1.5 h-1.5 bg-[#00C4BC] rounded-full animate-pulse" />
              Hecho para consultorios que todavía usan papel
            </span>
          </div>

          {/* headline — centrado en el problema */}
          <h1 className="text-4xl md:text-6xl font-extrabold text-[#0F1720] text-center leading-[1.08] tracking-tight mb-6 max-w-3xl mx-auto">
            ¿Todavía anotás los turnos<br className="hidden md:block" />{' '}
            en <span className="text-[#00C4BC]">papel o por WhatsApp?</span>
          </h1>

          <p className="text-[#4B5563] text-lg md:text-2xl text-center leading-relaxed mb-9 max-w-2xl mx-auto">
            DentalOS ordena tu agenda, tus pacientes y tu plata en un solo lugar.
            <span className="block mt-2 font-semibold text-[#0F1720]">
              Si sabés usar WhatsApp, ya sabés usar DentalOS.
            </span>
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-7">
            <Link
              href="/register"
              className="bg-[#00C4BC] hover:bg-[#00aaa3] text-white font-bold px-9 py-4 rounded-xl transition-all text-center text-base md:text-lg shadow-lg shadow-[#00C4BC]/20"
            >
              Probar gratis 14 días →
            </Link>
            <a
              href="#resultados"
              className="border-2 border-[#00C4BC]/30 text-[#00C4BC] hover:bg-[#E6F8F1] font-semibold px-9 py-4 rounded-xl transition-all text-center text-base md:text-lg flex items-center justify-center gap-2"
            >
              ▶ Ver cómo se usa
            </a>
          </div>

          {/* trust chips */}
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm md:text-base text-[#6B7280] mb-14">
            <span className="flex items-center gap-1.5"><span className="text-[#00C4BC] font-bold">✓</span> Sin instalar nada</span>
            <span className="flex items-center gap-1.5"><span className="text-[#00C4BC] font-bold">✓</span> Sin tarjeta</span>
            <span className="flex items-center gap-1.5"><span className="text-[#00C4BC] font-bold">✓</span> Listo hoy mismo</span>
            <span className="flex items-center gap-1.5"><span className="text-[#00C4BC] font-bold">✓</span> Soporte por WhatsApp</span>
          </div>

          {/* hero visual — funciona en la computadora y en el celular */}
          <div className="max-w-5xl mx-auto">
            <div className="relative md:pr-28 lg:pr-40">
              {/* Desktop con barra de navegador */}
              <div className="bg-white border border-[#E6F8F1] rounded-2xl overflow-hidden shadow-2xl shadow-[#00C4BC]/10">
                <div className="flex items-center gap-1.5 px-4 py-2.5 bg-[#F3F4F6] border-b border-[#E6F8F1]">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]" />
                  <span className="w-2.5 h-2.5 rounded-full bg-[#FEBC2E]" />
                  <span className="w-2.5 h-2.5 rounded-full bg-[#28C840]" />
                  <span className="ml-3 text-[11px] text-[#9CA3AF] font-medium">dentalos.pro</span>
                </div>
                <Image
                  src="/hero-desktop.png"
                  alt="DentalOS en la computadora"
                  width={2000}
                  height={1584}
                  className="w-full h-auto"
                  priority
                />
              </div>

              {/* Celular flotante — video en vivo: un turno en 15s */}
              <div className="hidden md:block absolute -bottom-10 -right-2 lg:right-0 w-[210px] lg:w-[250px]">
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 z-20 bg-[#00C4BC] text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full shadow-lg whitespace-nowrap">
                  Un turno en 15 seg ⚡
                </span>
                <div className="rounded-[2.2rem] border-[8px] border-[#0F1720] bg-[#0F1720] shadow-2xl overflow-hidden">
                  <video
                    src="/demo-turno.mp4"
                    autoPlay
                    muted
                    loop
                    playsInline
                    className="w-full h-auto rounded-[1.6rem] block"
                  />
                </div>
              </div>
            </div>

            {/* En mobile, mostramos el celular con el video debajo del desktop */}
            <div className="md:hidden flex justify-center mt-6">
              <div className="relative w-[240px]">
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 z-20 bg-[#00C4BC] text-white text-[11px] font-bold px-3 py-0.5 rounded-full shadow-lg whitespace-nowrap">
                  Un turno en 15 seg ⚡
                </span>
                <div className="rounded-[2rem] border-[7px] border-[#0F1720] bg-[#0F1720] shadow-2xl overflow-hidden">
                  <video
                    src="/demo-turno.mp4"
                    autoPlay
                    muted
                    loop
                    playsInline
                    className="w-full h-auto rounded-[1.5rem] block"
                  />
                </div>
              </div>
            </div>

            <p className="text-center text-sm text-[#6B7280] mt-12 md:mt-14">
              <span className="font-semibold text-[#0F1720]">Lo mismo en la computadora y en el celular.</span> Entrás desde donde estés.
            </p>
          </div>
        </div>
      </section>

      {/* ── BLOQUE DE CONFIANZA ────────────────────────────────── */}
      <section className="bg-[#E6F8F1] border-y border-[#00C4BC]/20 py-16">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-2xl md:text-3xl font-extrabold text-[#0F1720] text-center mb-3">
            Tranquilo. Es más fácil de lo que pensás.
          </h2>
          <p className="text-center text-[#6B7280] mb-12 max-w-xl mx-auto">
            No tenés que volverte experto en computadoras para ordenar tu consultorio.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-6">
            {[
              { icon: '🖥️', t: 'No instalás nada', d: 'Funciona en el navegador y en el celular' },
              { icon: '💬', t: 'No necesitás saber de computación', d: 'Si usás WhatsApp, podés con esto' },
              { icon: '⏱️', t: 'Lo empezás a usar hoy', d: 'Listo en 5 minutos, sin capacitación' },
              { icon: '🤝', t: 'Soporte por WhatsApp', d: 'Te responde una persona, el mismo día' },
              { icon: '📱', t: 'Entrás desde donde quieras', d: 'Celular, tablet o computadora' },
            ].map((item, i) => (
              <div key={i} className="bg-white rounded-2xl p-6 text-center border border-[#00C4BC]/10">
                <div className="text-3xl mb-3">{item.icon}</div>
                <p className="font-bold text-[#0F1720] text-sm mb-1.5 leading-snug">{item.t}</p>
                <p className="text-xs text-[#6B7280] leading-relaxed">{item.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── RESULTADOS (no features) ───────────────────────────── */}
      <section id="resultados">

        {/* Resultado 1: Agenda → dejá de perder turnos */}
        <div className="py-20 md:py-28 bg-white">
          <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-2 gap-16 items-center">
            <div>
              <span className="inline-block text-[#00C4BC] text-xs font-bold uppercase tracking-widest bg-[#E6F8F1] px-3 py-1 rounded-full mb-4">
                Agenda
              </span>
              <h2 className="text-3xl md:text-5xl font-extrabold text-[#0F1720] leading-tight mb-5">
                Dejá de perder turnos
              </h2>
              <p className="text-[#4B5563] text-lg leading-relaxed mb-7">
                Tus pacientes reciben el recordatorio solos. Vos llegás al consultorio con el día ya armado y nadie se olvida del turno.
              </p>
              <ul className="space-y-3.5">
                {[
                  'Recordatorios automáticos por WhatsApp',
                  'Se agendan solos desde el celular',
                  'Nunca más dos pacientes a la misma hora',
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-base text-[#0F1720]">
                    <span className="w-5 h-5 bg-[#E6F8F1] rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-[#00C4BC] text-xs font-bold">✓</span>
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            {/* Celular (video) protagonista al frente + desktop (imagen) detrás como contexto */}
            <div className="flex flex-col items-center">
              <div className="relative flex justify-center w-full pt-6">
                {/* Desktop más chico, asomando detrás a la izquierda */}
                <div className="hidden sm:block absolute top-2 -left-2 lg:-left-6 w-[62%] z-0">
                  <div className="bg-white border border-[#E6F8F1] rounded-lg overflow-hidden shadow-xl shadow-[#00C4BC]/5">
                    <div className="flex items-center gap-1 px-2.5 py-1.5 bg-[#F3F4F6] border-b border-[#E6F8F1]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#FF5F57]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-[#FEBC2E]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-[#28C840]" />
                      <span className="ml-1.5 text-[9px] text-[#9CA3AF] font-medium">dentalos.pro</span>
                    </div>
                    <Image
                      src="/agenda-desktop.png"
                      alt="Agendar un turno en la computadora"
                      width={2000}
                      height={1121}
                      className="w-full h-auto"
                    />
                  </div>
                </div>

                {/* Celular grande con el video — el foco */}
                <PhoneVideo
                  src="/demo-turno.mp4"
                  badge="Un turno en 15 segundos ⚡"
                  className="relative z-10 w-[280px] sm:w-[300px] sm:ml-32"
                />
              </div>
              <p className="text-sm text-[#6B7280] mt-12 text-center">Igual de fácil en la computadora y en el celular. Sin manuales.</p>
            </div>
          </div>
        </div>

        {/* Resultado 2: Pacientes → encontrá cualquier ficha */}
        <div className="py-20 md:py-28 bg-[#F3F4F6]">
          <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-2 gap-16 items-center">
            <div className="flex justify-center order-2 md:order-1 pt-6">
              <PhoneVideo src="/demo-ficha.mp4" badge="Toda la ficha, a un toque" className="w-[260px] sm:w-[285px]" />
            </div>
            <div className="order-1 md:order-2">
              <span className="inline-block text-[#00C4BC] text-xs font-bold uppercase tracking-widest bg-[#E6F8F1] px-3 py-1 rounded-full mb-4">
                Pacientes
              </span>
              <h2 className="text-3xl md:text-5xl font-extrabold text-[#0F1720] leading-tight mb-5">
                Encontrá cualquier ficha en segundos
              </h2>
              <p className="text-[#4B5563] text-lg leading-relaxed mb-7">
                Buscás por nombre o teléfono y ahí está todo: visitas, tratamientos y pagos. Sin revolver carpetas.
              </p>
              <ul className="space-y-3.5">
                {[
                  'Toda la info del paciente en un solo lugar',
                  'Historial de visitas y pagos siempre a mano',
                  'Lo abrís desde el celular en cualquier momento',
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-base text-[#0F1720]">
                    <span className="w-5 h-5 bg-[#E6F8F1] rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-[#00C4BC] text-xs font-bold">✓</span>
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Resultado 3: Finanzas → sabé cuánto ganaste */}
        <div className="py-20 md:py-28 bg-[#E6F8F1] relative overflow-hidden">
          <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-2 gap-16 items-center relative">
            <div>
              <span className="inline-block text-[#00C4BC] text-xs font-bold uppercase tracking-widest bg-white border border-[#00C4BC]/20 px-3 py-1 rounded-full mb-4">
                Plata
              </span>
              <h2 className="text-3xl md:text-5xl font-extrabold text-[#0F1720] leading-tight mb-5">
                Sabé cuánto ganaste este mes
              </h2>
              <p className="text-[#4B5563] text-lg leading-relaxed mb-7">
                Sin sacar la calculadora ni armar planillas. Lo que entró, lo que falta cobrar y los gastos, siempre al día.
              </p>
              <ul className="space-y-3.5">
                {[
                  'Lo que ganaste, de un vistazo',
                  'Quién te debe y cuánto, sin perseguir a nadie',
                  'El reporte del mes se arma solo',
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-base text-[#0F1720]">
                    <span className="w-5 h-5 bg-white rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-[#00C4BC] text-xs font-bold">✓</span>
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex justify-center pt-6">
              <PhoneVideo src="/demo-finanzas.mp4" badge="Tus números, al día" className="w-[260px] sm:w-[285px]" />
            </div>
          </div>
        </div>

        {/* Resultado 4: Cuenta corriente → lo que le deben y los pagos del paciente */}
        <div className="py-20 md:py-28 bg-[#F3F4F6]">
          <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-2 gap-16 items-center">
            <div className="flex justify-center order-2 md:order-1 pt-6">
              <PhoneImage src="/cuenta-corriente.png" alt="Cuenta corriente de un paciente" badge="Cuenta corriente del paciente" className="w-[260px] sm:w-[285px]" />
            </div>
            <div className="order-1 md:order-2">
              <span className="inline-block text-[#00C4BC] text-xs font-bold uppercase tracking-widest bg-[#E6F8F1] px-3 py-1 rounded-full mb-4">
                Cuenta corriente
              </span>
              <h2 className="text-3xl md:text-5xl font-extrabold text-[#0F1720] leading-tight mb-5">
                Sabé quién te debe y cuánto
              </h2>
              <p className="text-[#4B5563] text-lg leading-relaxed mb-7">
                Cada paciente tiene su cuenta corriente: lo que pagó, lo que debe y todos los cobros registrados. Nunca más perdés de vista una deuda.
              </p>
              <ul className="space-y-3.5">
                {[
                  'El saldo pendiente de cada paciente, siempre claro',
                  'Registrás cada pago en segundos',
                  'Generás el estado de cuenta para mandárselo',
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-base text-[#0F1720]">
                    <span className="w-5 h-5 bg-white rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-[#00C4BC] text-xs font-bold">✓</span>
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Resultado 5: Presupuestos → pasalos en 10s y mandalos por WhatsApp */}
        <div className="py-20 md:py-28 bg-white">
          <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-2 gap-16 items-center">
            <div>
              <span className="inline-block text-[#00C4BC] text-xs font-bold uppercase tracking-widest bg-[#E6F8F1] px-3 py-1 rounded-full mb-4">
                Presupuestos
              </span>
              <h2 className="text-3xl md:text-5xl font-extrabold text-[#0F1720] leading-tight mb-5">
                Pasá presupuestos en 10 segundos
              </h2>
              <p className="text-[#4B5563] text-lg leading-relaxed mb-7">
                Armás el presupuesto y se lo mandás por WhatsApp al toque. El paciente lo recibe al instante y vos no perdés tiempo.
              </p>
              <ul className="space-y-3.5">
                {[
                  'Lo enviás por WhatsApp en un clic',
                  'El paciente lo recibe al instante',
                  'Queda guardado en su ficha',
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-base text-[#0F1720]">
                    <span className="w-5 h-5 bg-[#E6F8F1] rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-[#00C4BC] text-xs font-bold">✓</span>
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex justify-center pt-6">
              <PhoneVideo src="/demo-presupuesto.mp4" badge="Presupuesto en 10 seg → WhatsApp" className="w-[260px] sm:w-[285px]" />
            </div>
          </div>
        </div>

        {/* Resultado 6: Historia clínica → todo en un lugar */}
        <div className="py-20 md:py-28 bg-[#F3F4F6]">
          <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-2 gap-16 items-center">
            <div className="flex justify-center order-2 md:order-1 pt-6">
              <PhoneVideo src="/demo-consentimiento.mp4" badge="Consentimiento firmado en 5 seg" className="w-[260px] sm:w-[285px]" />
            </div>
            <div className="order-1 md:order-2">
              <span className="inline-block text-[#00C4BC] text-xs font-bold uppercase tracking-widest bg-[#E6F8F1] px-3 py-1 rounded-full mb-4">
                Consentimientos
              </span>
              <h2 className="text-3xl md:text-5xl font-extrabold text-[#0F1720] leading-tight mb-5">
                Quedás cubierto en cada tratamiento
              </h2>
              <p className="text-[#4B5563] text-lg leading-relaxed mb-7">
                El paciente firma el consentimiento en la pantalla en 5 segundos y queda guardado en su ficha. Sin formularios impresos, sin papeles que se pierden, con respaldo legal de todo lo que hacés.
              </p>
              <ul className="space-y-3.5">
                {[
                  'Firma digital en 5 segundos, desde el celular',
                  'Respaldo legal de cada tratamiento',
                  'Queda archivado en la ficha, junto al odontograma y las imágenes',
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-base text-[#0F1720]">
                    <span className="w-5 h-5 bg-white rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-[#00C4BC] text-xs font-bold">✓</span>
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── DOLOR ──────────────────────────────────────────────── */}
      <section className="py-20 bg-white border-b border-[#F3F4F6]">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-extrabold text-[#0F1720] mb-8">
            ¿Te suena familiar?
          </h2>
          <div className="grid md:grid-cols-2 gap-4 text-left mb-8">
            {[
              'Perdés turnos porque los anotás en papel o en WhatsApp',
              'No sabés cuánto facturaste hasta que lo sumás a mano',
              'Los pacientes piden la ficha y tardás 10 minutos en encontrarla',
              'Usás 3 apps distintas para lo que debería hacer una sola',
              'Salís del consultorio y seguís pensando en lo administrativo',
              'Los turnos cancelados te agarran desprevenido',
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3 bg-red-50 border border-red-100 rounded-xl p-4">
                <span className="text-red-400 font-bold mt-0.5 flex-shrink-0">✗</span>
                <span className="text-sm text-[#0F1720]">{item}</span>
              </div>
            ))}
          </div>
          <p className="text-lg font-bold text-[#0F1720]">
            No es que seas desorganizado.{' '}
            <span className="text-[#00C4BC]">Es que el papel ya no da más.</span>
          </p>
          <p className="text-[#6B7280] mt-2">Y cambiar es mucho más fácil de lo que te imaginás. ↓</p>
        </div>
      </section>

      {/* ── ¿VENÍS DEL PAPEL? (Antes / Después) ────────────────── */}
      <section className="py-20 md:py-24 bg-[#F3F4F6]">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-14">
            <span className="inline-block text-[#00C4BC] text-xs font-bold uppercase tracking-widest bg-white border border-[#00C4BC]/20 px-4 py-1.5 rounded-full mb-4">
              ¿Venís del papel?
            </span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-[#0F1720]">
              Lo mismo que ya hacés, pero ordenado
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {/* ANTES */}
            <div className="bg-[#EDEDED] border border-[#D1D5DB] rounded-2xl p-7 opacity-90">
              <p className="text-xs font-bold text-[#6B7280] uppercase tracking-widest mb-5">Hoy</p>
              <ul className="space-y-4">
                {[
                  ['📒', 'Agenda de papel'],
                  ['🗂️', 'Carpetas y fichas'],
                  ['💬', 'Recordás los turnos a mano'],
                  ['🧮', 'Excel y sumas a mano'],
                  ['📞', '“¿A qué hora era?”'],
                ].map(([ic, t], i) => (
                  <li key={i} className="flex items-center gap-3 text-[#4B5563] text-sm">
                    <span className="text-lg grayscale opacity-70">{ic}</span>
                    <span className="line-through decoration-[#9CA3AF]/60">{t}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* DESPUÉS */}
            <div className="bg-white border-2 border-[#00C4BC] rounded-2xl p-7 shadow-lg shadow-[#00C4BC]/10">
              <p className="text-xs font-bold text-[#00C4BC] uppercase tracking-widest mb-5">Con DentalOS</p>
              <ul className="space-y-4">
                {[
                  ['📅', 'Agenda en el celular'],
                  ['🦷', 'Historia clínica online'],
                  ['🔔', 'Recordatorios automáticos'],
                  ['📊', 'Reportes que se hacen solos'],
                  ['✅', 'Todo confirmado por WhatsApp'],
                ].map(([ic, t], i) => (
                  <li key={i} className="flex items-center gap-3 text-[#0F1720] text-sm font-medium">
                    <span className="text-lg">{ic}</span>
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="text-center mt-12">
            <p className="text-lg font-bold text-[#0F1720] mb-5">No tirás nada de lo que ya tenés. Lo pasamos junto.</p>
            <a
              href="#resultados"
              className="inline-block border-2 border-[#00C4BC]/40 text-[#00C4BC] hover:bg-[#E6F8F1] font-bold px-8 py-3.5 rounded-xl transition-all"
            >
              Quiero ver cómo se ve →
            </a>
          </div>
        </div>
      </section>

      {/* ── MIGRACIÓN ──────────────────────────────────────────── */}
      <section className="py-20 md:py-24 bg-[#0F1720] text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#00C4BC]/15 rounded-full blur-[120px] pointer-events-none" />
        <div className="max-w-4xl mx-auto px-6 relative text-center">
          <span className="inline-block text-[#00C4BC] text-xs font-bold uppercase tracking-widest bg-white/10 px-4 py-1.5 rounded-full mb-5">
            No empezás de cero
          </span>
          <h2 className="text-3xl md:text-5xl font-extrabold leading-tight mb-5">
            Te acompañamos a pasarte
          </h2>
          <p className="text-white/70 text-lg max-w-2xl mx-auto mb-12">
            Tengas tus pacientes en carpetas, en una agenda de papel o en un Excel,
            nosotros te ayudamos a cargarlos. No te dejamos solo con el sistema vacío.
          </p>

          <div className="grid md:grid-cols-3 gap-6 mb-12 text-left">
            {[
              { n: '1', t: 'Nos contás cómo tenés todo hoy', d: 'Papel, Excel u otro sistema. Lo que sea.' },
              { n: '2', t: 'Te ayudamos a pasar tus pacientes', d: 'Incluso lo hacemos por vos.' },
              { n: '3', t: 'En pocos días estás funcionando', d: 'Sin estrés y sin perder información.' },
            ].map((s, i) => (
              <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-7">
                <div className="w-10 h-10 rounded-full bg-[#00C4BC] text-white font-bold flex items-center justify-center mb-4">{s.n}</div>
                <p className="font-bold mb-2">{s.t}</p>
                <p className="text-white/60 text-sm leading-relaxed">{s.d}</p>
              </div>
            ))}
          </div>

          <p className="text-white/80 italic mb-7">No necesitás conocimientos técnicos. Para eso estamos nosotros.</p>
          <a
            href={waLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-[#25D366] hover:bg-[#1ebe5a] text-white font-bold px-8 py-4 rounded-xl transition-all shadow-lg"
          >
            💬 Quiero que me ayuden a migrar
          </a>
        </div>
      </section>

      {/* ── CÓMO FUNCIONA ──────────────────────────────────────── */}
      <section id="como-funciona" className="bg-[#E6F8F1] py-24">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-16">
            <span className="inline-block text-[#00C4BC] text-xs font-bold uppercase tracking-widest bg-white border border-[#00C4BC]/20 px-4 py-1.5 rounded-full mb-4">
              Proceso simple
            </span>
            <h2 className="text-3xl md:text-5xl font-extrabold text-[#0F1720] leading-tight">
              Tres pasos para empezar hoy
            </h2>
            <p className="text-[#6B7280] mt-3">Sin instalaciones. Sin capacitación. Sin vueltas.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              { n: '01', title: 'Creá tu cuenta', desc: 'Solo email y contraseña. Listo en menos de 2 minutos. Sin tarjeta de crédito.' },
              { n: '02', title: 'Cargá tus datos (o te ayudamos)', desc: 'Tus horarios y pacientes. Y si no querés hacerlo solo, lo hacemos juntos por WhatsApp.' },
              { n: '03', title: 'Manejá todo desde un lugar', desc: 'Turnos, historias clínicas, cobros y reportes. Desde el consultorio o desde tu celular.' },
            ].map((step, i) => (
              <div key={i} className="bg-white border border-[#00C4BC]/15 rounded-2xl p-8 hover:border-[#00C4BC]/40 hover:shadow-lg hover:shadow-[#00C4BC]/10 transition-all">
                <div className="text-7xl font-extrabold text-[#00C4BC]/20 leading-none mb-4 select-none">{step.n}</div>
                <h3 className="text-xl font-bold text-[#0F1720] mb-3">{step.title}</h3>
                <p className="text-[#6B7280] text-sm leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>

          <div className="text-center mt-12">
            <Link
              href="/register"
              className="inline-block bg-[#00C4BC] hover:bg-[#00aaa3] text-white font-bold px-10 py-4 rounded-xl transition-all shadow-lg shadow-[#00C4BC]/20"
            >
              Empezar gratis ahora
            </Link>
            <p className="text-sm text-[#6B7280] mt-3">Sin tarjeta · Listo en 5 minutos · Cancelás cuando querés</p>
          </div>
        </div>
      </section>

      {/* ── TESTIMONIOS ────────────────────────────────────────── */}
      <section className="py-24 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <span className="inline-block text-[#00C4BC] text-xs font-bold uppercase tracking-widest bg-[#E6F8F1] px-3 py-1 rounded-full mb-4">
              Testimonios
            </span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-[#0F1720]">
              Odontólogos que dejaron el papel
            </h2>
            <p className="text-[#6B7280] mt-3">Y no quieren volver.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                quote: '"Pensé que no iba a entender nada. A la semana ya no usaba más la agenda de papel."',
                name: 'Dra. Mónica Sosa',
                role: 'Consultorio propio · San Miguel de Tucumán',
                initials: 'MS',
              },
              {
                quote: '"Los recordatorios por WhatsApp solos ya lo justifican. Casi no tengo más turnos perdidos."',
                name: 'Dr. Rubén Acosta',
                role: 'Ortodoncia · Mar del Plata',
                initials: 'RA',
              },
              {
                quote: '"Trabajo sola hace 22 años. Por fin tengo cada ficha en el celular, sin revolver carpetas."',
                name: 'Dra. Silvina Ferreyra',
                role: 'Odontopediatría · Rosario',
                initials: 'SF',
              },
            ].map((t, i) => (
              <div key={i} className="border border-[#E6F8F1] rounded-2xl p-8 flex flex-col hover:border-[#00C4BC]/30 hover:shadow-md hover:shadow-[#00C4BC]/8 transition-all">
                <div className="flex gap-1 mb-5">
                  {[...Array(5)].map((_, j) => (
                    <span key={j} className="text-amber-400 text-lg">★</span>
                  ))}
                </div>
                <p className="text-[#0F1720] text-base leading-relaxed flex-1 mb-6">{t.quote}</p>
                <div className="border-t border-[#F3F4F6] pt-5 flex items-center gap-3">
                  {/* ⚠️ Reemplazar por foto real <Image .../> cuando la tengas */}
                  <div className="w-11 h-11 rounded-full bg-[#E6F8F1] text-[#00C4BC] font-bold flex items-center justify-center text-sm flex-shrink-0">
                    {t.initials}
                  </div>
                  <div>
                    <p className="font-bold text-sm text-[#0F1720]">{t.name}</p>
                    <p className="text-xs text-[#6B7280] mt-0.5">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── ANCLA DE VALOR ─────────────────────────────────────── */}
      <section className="bg-[#0F1720] text-white py-20 md:py-24 relative overflow-hidden">
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[600px] h-[420px] bg-[#00C4BC]/15 rounded-full blur-[130px] pointer-events-none" />
        <div className="max-w-4xl mx-auto px-6 text-center relative">
          <span className="inline-block text-[#00C4BC] text-xs font-bold uppercase tracking-widest bg-white/10 px-4 py-1.5 rounded-full mb-6">
            Hagamos números
          </span>
          <h2 className="text-3xl md:text-5xl font-extrabold leading-[1.15] mb-6">
            Con recuperar <span className="text-[#00C4BC]">2 pacientes al mes</span> gracias a los recordatorios,<br className="hidden md:block" /> DentalOS ya se pagó solo.
          </h2>
          <p className="text-white/70 text-lg md:text-xl max-w-2xl mx-auto mb-12">
            Los recordatorios automáticos por WhatsApp reducen las ausencias y los turnos que se caen. Cada paciente que no se te pierde paga varias veces lo que cuesta el sistema.
          </p>

          <div className="grid sm:grid-cols-3 gap-4 max-w-3xl mx-auto mb-12">
            {[
              { ic: '🔔', t: 'Mandás recordatorios', d: 'Automáticos, sin que hagas nada' },
              { ic: '📉', t: 'Bajan las ausencias', d: 'Menos turnos que se caen' },
              { ic: '💰', t: 'Se paga solo', d: 'Recuperás más de lo que cuesta' },
            ].map((s, i) => (
              <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-6">
                <div className="text-3xl mb-3">{s.ic}</div>
                <p className="font-bold mb-1">{s.t}</p>
                <p className="text-white/60 text-sm leading-relaxed">{s.d}</p>
              </div>
            ))}
          </div>

          <Link
            href="/register"
            className="inline-block bg-[#00C4BC] hover:bg-[#00aaa3] text-white font-bold px-10 py-4 rounded-xl transition-all shadow-lg shadow-[#00C4BC]/30"
          >
            Empezar 14 días gratis →
          </Link>
        </div>
      </section>

      {/* ── PRICING ────────────────────────────────────────────── */}
      <section id="pricing" className="bg-[#F3F4F6] py-24">
        <div className="max-w-6xl mx-auto px-6">

          <div className="text-center mb-14">
            <span className="inline-block text-[#00C4BC] text-xs font-bold uppercase tracking-widest bg-white border border-[#00C4BC]/20 px-3 py-1 rounded-full mb-5">
              Precios
            </span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-[#0F1720] mb-4">El plan que se adapta a tu consultorio</h2>
            <div className="inline-block bg-[#00C4BC]/10 border border-[#00C4BC]/25 rounded-2xl px-7 py-3 mb-4">
              <p className="text-[#0F1720] font-bold text-lg">
                Probás 14 días completos antes de poner un peso. Si no te sirve, no pagás nada.
              </p>
            </div>

            {/* Toggle mensual / anual */}
            <div className="flex items-center justify-center gap-3 mt-8">
              <span className={`text-sm font-semibold transition-colors ${!annualBilling ? 'text-[#0F1720]' : 'text-[#6B7280]'}`}>
                Mensual
              </span>
              <div
                role="switch"
                aria-checked={annualBilling}
                tabIndex={0}
                onClick={() => setAnnualBilling(b => !b)}
                onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && setAnnualBilling(b => !b)}
                className={`relative w-12 h-6 rounded-full cursor-pointer flex-shrink-0 transition-colors duration-200 ${annualBilling ? 'bg-[#00C4BC]' : 'bg-[#D1D5DB]'}`}
              >
                <span
                  className={`absolute top-[3px] left-[3px] w-[18px] h-[18px] bg-white rounded-full shadow-sm transition-transform duration-200 ${annualBilling ? 'translate-x-6' : 'translate-x-0'}`}
                />
              </div>
              <span className={`text-sm font-semibold transition-colors ${annualBilling ? 'text-[#0F1720]' : 'text-[#6B7280]'}`}>
                Anual
              </span>
              <span className="bg-[#00C4BC] text-white text-xs font-bold px-2.5 py-1 rounded-full">
                20% OFF
              </span>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-6 items-start">

            {/* Starter */}
            <div className="bg-white border border-[#E5E7EB] rounded-3xl p-8 flex flex-col">
              <div className="mb-6">
                <p className="text-xs font-bold text-[#6B7280] uppercase tracking-widest mb-1">Starter</p>
                <p className="text-sm text-[#6B7280]">Ordená tu consultorio desde el día 1</p>
              </div>
              <div className="mb-1">
                <span className="text-5xl font-extrabold text-[#0F1720]">${price('starter')}</span>
              </div>
              <p className="text-[#6B7280] text-xs mb-7">
                ARS / mes{annualBilling && ' · facturado anualmente'} · <strong className="text-[#00C4BC]">14 días gratis</strong>
              </p>

              <div className="space-y-3 mb-5 flex-1">
                {[
                  'Agenda y turnos online',
                  'Historia clínica con odontograma',
                  'Hasta 100 pacientes activos',
                  '1 profesional',
                  'Soporte en español',
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className="text-[#00C4BC] font-bold flex-shrink-0 text-sm mt-px">✓</span>
                    <span className="text-[#0F1720] text-sm">{item}</span>
                  </div>
                ))}
                <div className="flex items-start gap-3 opacity-40 pt-1">
                  <span className="font-bold flex-shrink-0 text-sm mt-px">✗</span>
                  <span className="text-[#0F1720] text-sm line-through">Recordatorios automáticos</span>
                </div>
              </div>

              <p className="text-xs text-[#6B7280] italic mb-6">Ideal para dejar el Excel y empezar a ordenar</p>

              <Link
                href="/register"
                className="block w-full border-2 border-[#00C4BC]/40 text-[#00C4BC] hover:bg-[#E6F8F1] font-bold py-3.5 rounded-xl transition-all text-center text-sm"
              >
                Probar gratis 14 días
              </Link>
            </div>

            {/* Growth — destacado */}
            <div className="bg-white border-2 border-[#00C4BC] rounded-3xl p-8 shadow-xl shadow-[#00C4BC]/10 relative flex flex-col">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                <span className="bg-[#00C4BC] text-white text-xs font-bold px-4 py-1 rounded-full uppercase tracking-wider">
                  Más elegido
                </span>
              </div>
              <div className="mb-6">
                <p className="text-xs font-bold text-[#00C4BC] uppercase tracking-widest mb-1">Growth</p>
                <p className="text-sm text-[#6B7280]">Dejá de perder pacientes y llená tu agenda</p>
              </div>
              <div className="mb-1">
                <span className="text-5xl font-extrabold text-[#0F1720]">${price('growth')}</span>
              </div>
              <p className="text-[#6B7280] text-xs mb-7">
                ARS / mes{annualBilling && ' · facturado anualmente'} · <strong className="text-[#00C4BC]">14 días gratis</strong>
              </p>

              <div className="space-y-3 mb-5 flex-1">
                {[
                  'Todo lo del plan Starter',
                  'Pacientes ilimitados',
                  'Hasta 3 profesionales',
                  'Recordatorios automáticos por WhatsApp (500/mes)',
                  'Confirmación automática de turnos',
                  'Soporte prioritario',
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className="text-[#00C4BC] font-bold flex-shrink-0 text-sm mt-px">✓</span>
                    <span className="text-[#0F1720] text-sm">{item}</span>
                  </div>
                ))}
              </div>

              <div className="bg-[#E6F8F1] rounded-xl px-4 py-3 mb-6">
                <p className="text-xs text-[#00C4BC] font-semibold">Reducí ausencias y recuperá pacientes automáticamente. Este es el plan que se paga solo.</p>
              </div>

              <Link
                href="/register"
                className="block w-full bg-[#00C4BC] hover:bg-[#00aaa3] text-white font-bold py-3.5 rounded-xl transition-all text-center text-sm shadow-lg shadow-[#00C4BC]/20"
              >
                Empezar a automatizar
              </Link>
            </div>

            {/* Scale */}
            <div className="bg-white border border-[#E5E7EB] rounded-3xl p-8 flex flex-col">
              <div className="mb-6">
                <p className="text-xs font-bold text-[#6B7280] uppercase tracking-widest mb-1">Scale</p>
                <p className="text-sm text-[#6B7280]">Gestioná tu clínica como una empresa</p>
              </div>
              <div className="mb-1">
                <span className="text-5xl font-extrabold text-[#0F1720]">${price('scale')}</span>
              </div>
              <p className="text-[#6B7280] text-xs mb-7">
                ARS / mes{annualBilling && ' · facturado anualmente'} · <strong className="text-[#00C4BC]">14 días gratis</strong>
              </p>

              <div className="space-y-3 mb-5 flex-1">
                {[
                  'Todo lo del plan Growth',
                  'Hasta 10 profesionales',
                  '2.000 recordatorios WhatsApp/mes',
                  'Reportes avanzados (ocupación, cancelaciones, rendimiento)',
                  'Onboarding personalizado',
                  'Soporte dedicado',
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className="text-[#00C4BC] font-bold flex-shrink-0 text-sm mt-px">✓</span>
                    <span className="text-[#0F1720] text-sm">{item}</span>
                  </div>
                ))}
              </div>

              <p className="text-xs text-[#6B7280] italic mb-6">Tomá decisiones con datos, no con intuición</p>

              <Link
                href="/register"
                className="block w-full border-2 border-[#00C4BC]/40 text-[#00C4BC] hover:bg-[#E6F8F1] font-bold py-3.5 rounded-xl transition-all text-center text-sm"
              >
                Probar gratis 14 días
              </Link>
            </div>

          </div>

        </div>
      </section>

      {/* ── FAQ ────────────────────────────────────────────────── */}
      <section className="py-24 bg-white">
        <div className="max-w-2xl mx-auto px-6">
          <div className="text-center mb-12">
            <span className="inline-block text-[#00C4BC] text-xs font-bold uppercase tracking-widest bg-[#E6F8F1] px-3 py-1 rounded-full mb-4">
              Dudas frecuentes
            </span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-[#0F1720]">Lo que más nos preguntan</h2>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <div key={i} className="border border-[#F3F4F6] rounded-xl overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full px-6 py-5 text-left flex items-center justify-between gap-4 hover:bg-[#F3F4F6] transition-colors"
                >
                  <span className="font-semibold text-[#0F1720] text-sm">{faq.q}</span>
                  <span
                    className="text-[#00C4BC] flex-shrink-0 text-xl font-bold transition-transform duration-200"
                    style={{ transform: openFaq === i ? 'rotate(45deg)' : 'none' }}
                  >
                    +
                  </span>
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-5 text-[#6B7280] text-sm leading-relaxed border-t border-[#F3F4F6] pt-4">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="text-center mt-10">
            <p className="text-[#6B7280] text-sm mb-3">¿Te quedó alguna duda?</p>
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-[#128C7E] font-bold hover:underline"
            >
              💬 Preguntá por WhatsApp
            </a>
          </div>
        </div>
      </section>

      {/* ── CTA FINAL ──────────────────────────────────────────── */}
      <section className="bg-[#E6F8F1] py-24 relative overflow-hidden">
        <div className="max-w-2xl mx-auto px-6 text-center relative">
          <h2 className="text-3xl md:text-5xl font-extrabold text-[#0F1720] mb-5 leading-tight">
            Probalo sin compromiso.<br />Si no te gusta, no pasa nada.
          </h2>
          <p className="text-[#6B7280] text-lg mb-9">
            14 días gratis. Sin tarjeta. Sin instalar nada. Y si tenés dudas, te ayudamos por WhatsApp.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/register"
              className="inline-block bg-[#00C4BC] hover:bg-[#00aaa3] text-white font-bold px-7 py-3.5 rounded-xl transition-all shadow-lg shadow-[#00C4BC]/20 text-base whitespace-nowrap"
            >
              Quiero probarlo gratis
            </Link>
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 bg-white border-2 border-[#25D366]/40 text-[#128C7E] hover:bg-[#25D366]/10 font-bold px-7 py-3.5 rounded-xl transition-all text-base whitespace-nowrap"
            >
              💬 Prefiero que me lo muestren
            </a>
          </div>
          <p className="text-sm text-[#6B7280] mt-5">
            Sin tarjeta · Listo en menos de 5 minutos · Cancelás cuando querés
          </p>
        </div>
      </section>

      {/* ── FOOTER ─────────────────────────────────────────────── */}
      <footer className="bg-[#0F1720] border-t border-white/10 py-14">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-10 mb-10">
            <div>
              <h3 className="text-2xl font-extrabold text-white mb-3">
                Dental<span className="text-[#00C4BC]">OS</span>
              </h3>
              <p className="text-[#6B7280] text-sm">La gestión de tu consultorio, simplificada.</p>
            </div>
            <div>
              <h4 className="font-bold text-xs text-white mb-4 uppercase tracking-widest">Producto</h4>
              <ul className="space-y-2 text-sm text-[#6B7280]">
                <li><a href="#resultados" className="hover:text-white transition-colors">Cómo se usa</a></li>
                <li><a href="#resultados" className="hover:text-white transition-colors">Para qué sirve</a></li>
                <li><a href="#pricing" className="hover:text-white transition-colors">Precios</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-xs text-white mb-4 uppercase tracking-widest">Ayuda</h4>
              <ul className="space-y-2 text-sm text-[#6B7280]">
                <li><a href={waLink} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Soporte por WhatsApp</a></li>
                <li><Link href="/login" className="hover:text-white transition-colors">Ingresar</Link></li>
                <li><Link href="/register" className="hover:text-white transition-colors">Crear cuenta</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-xs text-white mb-4 uppercase tracking-widest">Legal</h4>
              <ul className="space-y-2 text-sm text-[#6B7280]">
                <li><a href="#" className="hover:text-white transition-colors">Privacidad</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Términos</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-white/10 pt-6 flex flex-col md:flex-row items-center justify-between">
            <p className="text-[#6B7280] text-sm">© 2026 DentalOS. Todos los derechos reservados.</p>
            <div className="flex gap-6 mt-4 md:mt-0">
              <a href="#" className="text-[#6B7280] hover:text-white transition-colors text-sm">Instagram</a>
              <a href="#" className="text-[#6B7280] hover:text-white transition-colors text-sm">LinkedIn</a>
            </div>
          </div>
        </div>
      </footer>

      {/* ── BOTÓN FLOTANTE WHATSAPP ────────────────────────────── */}
      <a
        href={waLink}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Hablar por WhatsApp"
        className="fixed bottom-5 right-5 z-40 flex items-center gap-2 bg-[#25D366] hover:bg-[#1ebe5a] text-white font-bold pl-4 pr-5 py-3.5 rounded-full shadow-xl shadow-[#25D366]/30 transition-all hover:scale-105"
      >
        <span className="text-xl">💬</span>
        <span className="hidden sm:inline text-sm">¿Hablamos?</span>
      </a>

      {/* ── LOGIN MODAL ────────────────────────────────────────── */}
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
                <label className="block text-sm font-semibold text-[#0F1720] mb-2">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full border border-[#E5E7EB] bg-[#F3F4F6] rounded-lg px-4 py-3 text-[#0F1720] focus:outline-none focus:border-[#00C4BC] transition-colors"
                  placeholder="dr@consultorio.com"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#0F1720] mb-2">Contraseña</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full border border-[#E5E7EB] bg-[#F3F4F6] rounded-lg px-4 py-3 text-[#0F1720] focus:outline-none focus:border-[#00C4BC] transition-colors"
                  placeholder="••••••••"
                  required
                />
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#00C4BC] hover:bg-[#00aaa3] disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition-colors"
              >
                {loading ? 'Ingresando...' : 'Ingresar'}
              </button>

              <div className="text-center">
                <p className="text-[#6B7280] text-sm">
                  ¿No tenés cuenta?{' '}
                  <Link
                    href="/register"
                    className="text-[#00C4BC] hover:text-[#00aaa3] transition-colors font-semibold"
                    onClick={() => setShowLoginModal(false)}
                  >
                    Empezar gratis
                  </Link>
                </p>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
