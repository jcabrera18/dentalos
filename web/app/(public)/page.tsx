'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Plus_Jakarta_Sans } from 'next/font/google'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import {
  CalendarCheck, MessageCircle, Clock, Headphones, Smartphone, Bell,
  TrendingDown, Wallet, Monitor, Search, FileText, Check, X, Star,
  ArrowRight, Play, FolderOpen, Calculator,
  Phone, Signature, NotebookPen, HeartPulse,
} from 'lucide-react'

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
})

// Número de WhatsApp de soporte (+54 9 3438 55-8913, formato internacional sin + ni espacios)
const WHATSAPP_NUMBER = '5493438558913'
const WHATSAPP_MSG = encodeURIComponent('Hola! Quiero que me muestren cómo funciona VitalOS 🙂')
const waLink = `https://wa.me/${WHATSAPP_NUMBER}?text=${WHATSAPP_MSG}`

// ── Scroll reveal: fade-up al entrar en viewport ────────────
function Reveal({
  children,
  className = '',
  delay = 0,
}: {
  children: React.ReactNode
  className?: string
  delay?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [shown, setShown] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true)
          io.disconnect()
        }
      },
      { threshold: 0.12 }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={`transition-all duration-700 ease-out ${shown ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'} ${className}`}
    >
      {children}
    </div>
  )
}

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

// ── Tarjeta de feature para el bento de resultados ─────────
type FeatureMedia =
  | { type: 'video'; src: string; badge: string }
  | { type: 'image'; src: string; alt: string; badge: string }

type Feature = {
  tag: string
  Icon: typeof CalendarCheck
  title: string
  desc: string
  bullets: string[]
  media: FeatureMedia
  layout: 'split' | 'stack'
  span: string
  bg: string
}

function FeatureMediaView({ media, size }: { media: FeatureMedia; size: string }) {
  if (media.type === 'video') {
    return <PhoneVideo src={media.src} badge={media.badge} className={size} />
  }
  return <PhoneImage src={media.src} alt={media.alt} badge={media.badge} className={size} />
}

function TagChip({ Icon, children }: { Icon: typeof CalendarCheck; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 text-[#00C4BC] text-xs font-bold uppercase tracking-widest bg-white border border-[#00C4BC]/20 px-3 py-1.5 rounded-full mb-4">
      <Icon className="w-3.5 h-3.5" strokeWidth={2.5} />
      {children}
    </span>
  )
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="space-y-3">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-3 text-[15px] text-[#0F1720] leading-snug">
          <span className="w-5 h-5 bg-[#E6F8F1] rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
            <Check className="w-3 h-3 text-[#00C4BC]" strokeWidth={3} />
          </span>
          {item}
        </li>
      ))}
    </ul>
  )
}

function FeatureCard({ feature }: { feature: Feature }) {
  const { tag, Icon, title, desc, bullets, media, layout, span, bg } = feature

  if (layout === 'split') {
    return (
      <Reveal className={`${span} col-span-1`}>
        <div
          className="h-full rounded-3xl border border-[#00C4BC]/12 shadow-lg shadow-[#00C4BC]/5 p-8 lg:p-10 flex flex-col lg:flex-row items-center gap-8 lg:gap-10 hover:shadow-xl hover:shadow-[#00C4BC]/10 hover:border-[#00C4BC]/25 transition-all"
          style={{ background: bg }}
        >
          <div className="flex-1 w-full">
            <TagChip Icon={Icon}>{tag}</TagChip>
            <h3 className="text-2xl lg:text-4xl font-extrabold text-[#0F1720] leading-tight mb-4">{title}</h3>
            <p className="text-[#4B5563] text-base lg:text-lg leading-relaxed mb-6">{desc}</p>
            <Bullets items={bullets} />
          </div>
          <div className="flex justify-center flex-shrink-0 pt-4 lg:pt-0">
            <FeatureMediaView media={media} size="w-[230px] sm:w-[250px]" />
          </div>
        </div>
      </Reveal>
    )
  }

  return (
    <Reveal className={`${span} col-span-1`}>
      <div
        className="h-full rounded-3xl border border-[#00C4BC]/12 shadow-lg shadow-[#00C4BC]/5 p-8 flex flex-col hover:shadow-xl hover:shadow-[#00C4BC]/10 hover:border-[#00C4BC]/25 transition-all"
        style={{ background: bg }}
      >
        <TagChip Icon={Icon}>{tag}</TagChip>
        <h3 className="text-2xl font-extrabold text-[#0F1720] leading-tight mb-3">{title}</h3>
        <p className="text-[#4B5563] text-[15px] leading-relaxed mb-6">{desc}</p>
        <Bullets items={bullets} />
        <div className="flex justify-center mt-auto pt-8">
          <FeatureMediaView media={media} size="w-[215px] sm:w-[235px]" />
        </div>
      </div>
    </Reveal>
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
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

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

  // total facturado al año cuando se paga anual (= 10 meses del precio mensual)
  function annualTotal(plan: keyof typeof PRICES) {
    return (PRICES[plan].monthly * 10).toLocaleString('es-AR')
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

  // ── Resultados en bento grid (6 columnas; mezcla de tarjetas anchas y angostas) ──
  const features: Feature[] = [
    {
      tag: 'Agenda',
      Icon: CalendarCheck,
      title: 'Dejá de perder turnos',
      desc: 'Tus pacientes reciben el recordatorio solos. Vos llegás al consultorio con el día ya armado y nadie se olvida del turno.',
      bullets: [
        'Recordatorios automáticos por WhatsApp',
        'Se agendan solos desde el celular',
        'Nunca más dos pacientes a la misma hora',
      ],
      media: { type: 'video', src: '/demo-turno.mp4', badge: 'Un turno en 15 seg ⚡' },
      layout: 'split',
      span: 'lg:col-span-4',
      bg: 'linear-gradient(135deg, #ffffff 0%, #F2FCF9 100%)',
    },
    {
      tag: 'Pacientes',
      Icon: Search,
      title: 'Encontrá cualquier ficha en segundos',
      desc: 'Buscás por nombre o teléfono y ahí está todo: visitas, tratamientos y pagos. Sin revolver carpetas.',
      bullets: [
        'Toda la info en un solo lugar',
        'Historial siempre a mano',
        'Lo abrís desde el celular',
      ],
      media: { type: 'video', src: '/demo-ficha.mp4', badge: 'Toda la ficha, a un toque' },
      layout: 'stack',
      span: 'lg:col-span-2',
      bg: '#E6F8F1',
    },
    {
      tag: 'Plata',
      Icon: Wallet,
      title: 'Sabé cuánto ganaste este mes',
      desc: 'Sin calculadora ni planillas. Lo que entró, lo que falta cobrar y los gastos, siempre al día.',
      bullets: [
        'Lo que ganaste, de un vistazo',
        'Quién te debe y cuánto',
        'El reporte se arma solo',
      ],
      media: { type: 'video', src: '/demo-finanzas.mp4', badge: 'Tus números, al día' },
      layout: 'stack',
      span: 'lg:col-span-2',
      bg: '#E6F8F1',
    },
    {
      tag: 'Presupuestos',
      Icon: FileText,
      title: 'Pasá presupuestos en 10 segundos',
      desc: 'Armás el presupuesto y se lo mandás por WhatsApp al toque. El paciente lo recibe al instante y vos no perdés tiempo.',
      bullets: [
        'Lo enviás por WhatsApp en un clic',
        'El paciente lo recibe al instante',
        'Queda guardado en su ficha',
      ],
      media: { type: 'video', src: '/demo-presupuesto.mp4', badge: 'Presupuesto en 10 seg → WhatsApp' },
      layout: 'split',
      span: 'lg:col-span-4',
      bg: 'linear-gradient(135deg, #ffffff 0%, #F2FCF9 100%)',
    },
    {
      tag: 'Cuenta corriente',
      Icon: Calculator,
      title: 'Sabé quién te debe y cuánto',
      desc: 'Cada paciente tiene su cuenta corriente: lo que pagó, lo que debe y todos los cobros registrados. Nunca más perdés de vista una deuda.',
      bullets: [
        'El saldo pendiente, siempre claro',
        'Registrás cada pago en segundos',
        'Generás el estado de cuenta para mandárselo',
      ],
      media: { type: 'image', src: '/cuenta-corriente.png', alt: 'Cuenta corriente de un paciente', badge: 'Cuenta corriente del paciente' },
      layout: 'split',
      span: 'lg:col-span-4',
      bg: 'linear-gradient(135deg, #ffffff 0%, #F2FCF9 100%)',
    },
    {
      tag: 'Consentimientos',
      Icon: Signature,
      title: 'Quedás cubierto en cada tratamiento',
      desc: 'El paciente firma en la pantalla en 5 segundos y queda guardado en su ficha. Con respaldo legal de todo lo que hacés.',
      bullets: [
        'Firma digital en 5 segundos',
        'Respaldo legal de cada tratamiento',
        'Archivado junto a la ficha',
      ],
      media: { type: 'video', src: '/demo-consentimiento.mp4', badge: 'Firmado en 5 seg' },
      layout: 'stack',
      span: 'lg:col-span-2',
      bg: '#E6F8F1',
    },
  ]

  const faqs = [
    {
      q: '¿Es difícil de aprender?',
      a: 'No. Está pensado para que lo entiendas solo, sin manuales. La mayoría lo está usando el primer día sin que nadie le explique nada. Si sabés mandar un WhatsApp, sabés usar VitalOS.',
    },
    {
      q: 'Nunca usé un sistema, siempre trabajé con papel. ¿Voy a poder?',
      a: 'Sí, y sos exactamente para quien lo hicimos. No necesitás saber de computación. Y si en algún momento te trabás, nos escribís por WhatsApp y te ayudamos en el momento.',
    },
    {
      q: '¿Lo puedo usar desde el celular?',
      a: 'Sí. Funciona igual de bien en el celular que en la computadora o la tablet. Muchos profesionales lo manejan solo desde el teléfono.',
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
    {
      q: '¿Los datos de mis pacientes están encriptados?',
      a: 'Sí. Toda la información viaja cifrada (HTTPS) y se almacena cifrada en reposo en servidores con estándares de la industria. Además, cada clínica queda completamente aislada de las demás: solo vos y tu equipo pueden ver los datos de tus pacientes.',
    },
  ]

  return (
    <div className={`${jakarta.className} bg-white text-[#0F1720]`}>
      <style>{`
        @keyframes vos-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-14px); } }
        @keyframes vos-float-sm { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-9px); } }
      `}</style>

      {/* ── NAVBAR flotante (pill) ─────────────────────────────── */}
      <nav className="fixed top-3 sm:top-4 left-0 right-0 z-50 px-4">
        <div
          className={`max-w-6xl mx-auto flex items-center justify-between rounded-full border backdrop-blur-xl transition-all duration-300 ${
            scrolled
              ? 'bg-white/85 border-[#E6F8F1] shadow-lg shadow-[#00C4BC]/8 px-3 sm:px-4 py-2'
              : 'bg-white/70 border-white/70 shadow-md shadow-black/[0.04] px-4 sm:px-5 py-2.5'
          }`}
        >
          <Link href="/" className="text-xl sm:text-2xl font-extrabold tracking-tight text-[#0F1720] pl-2">
            Vital<span className="text-[#00C4BC]">OS</span>
          </Link>
          <div className="hidden md:flex items-center gap-8 absolute left-1/2 -translate-x-1/2">
            <a href="#resultados" className="text-[#4B5563] hover:text-[#0F1720] transition-colors text-sm font-medium">
              Cómo se usa
            </a>
            <a href="#pricing" className="text-[#4B5563] hover:text-[#0F1720] transition-colors text-sm font-medium">
              Precios
            </a>
          </div>
          <div className="flex items-center gap-2 sm:gap-2.5">
            <Link
              href="/register"
              className="inline-flex items-center gap-1.5 bg-[#00C4BC] hover:bg-[#00aaa3] text-white pl-4 pr-4 sm:pr-5 py-2.5 rounded-full text-sm font-semibold transition-all shadow-md shadow-[#00C4BC]/25 hover:-translate-y-0.5"
            >
              <Play className="w-4 h-4 fill-current" />
              Probar gratis
            </Link>
            <Link
              href="/login"
              className="group inline-flex items-center gap-1.5 bg-[#0F1720] hover:bg-[#1c2733] text-white pl-4 pr-4 sm:pr-5 py-2.5 rounded-full text-sm font-semibold transition-all"
            >
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" strokeWidth={2.5} />
              Ingresar
            </Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ───────────────────────────────────────────────── */}
      <section className="pt-32 pb-16 bg-white overflow-hidden relative">
        {/* mesh gradient claro */}
        <div className="absolute top-[-10%] right-[-5%] w-[650px] h-[650px] bg-[#00C4BC]/12 rounded-full blur-[130px] pointer-events-none" />
        <div className="absolute top-[20%] left-[-10%] w-[420px] h-[420px] bg-[#34D399]/10 rounded-full blur-[110px] pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-[300px] h-[300px] bg-[#38BDF8]/8 rounded-full blur-[90px] pointer-events-none" />
        {/* grid sutil */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.4]"
          style={{
            backgroundImage:
              'linear-gradient(#0F172008 1px, transparent 1px), linear-gradient(90deg, #0F172008 1px, transparent 1px)',
            backgroundSize: '44px 44px',
            maskImage: 'radial-gradient(ellipse 80% 50% at 50% 0%, black 40%, transparent 75%)',
            WebkitMaskImage: 'radial-gradient(ellipse 80% 50% at 50% 0%, black 40%, transparent 75%)',
          }}
        />

        <div className="max-w-5xl mx-auto px-6 relative">
          {/* badge */}
          <div className="flex justify-center mb-8">
            <span className="inline-flex items-center gap-2 bg-[#E6F8F1] border border-[#00C4BC]/30 text-[#00C4BC] text-xs font-bold px-4 py-1.5 rounded-full uppercase tracking-wider text-center">
              <span className="w-1.5 h-1.5 bg-[#00C4BC] rounded-full animate-pulse" />
              Hecho para consultorios que todavía usan papel
            </span>
          </div>

          {/* headline — centrado en el problema */}
          <h1 className="text-[2.6rem] leading-[1.05] md:text-7xl font-extrabold text-[#0F1720] text-center tracking-tighter mb-6 max-w-3xl mx-auto">
            ¿Todavía anotás los turnos{' '}
            en <span className="text-[#00C4BC]">papel o por WhatsApp?</span>
          </h1>

          <p className="text-[#4B5563] text-lg md:text-2xl text-center leading-relaxed mb-9 max-w-2xl mx-auto">
            VitalOS ordena tu agenda, tus pacientes y tu plata en un solo lugar.
            <span className="block mt-2 font-semibold text-[#0F1720]">
              Si sabés usar WhatsApp, ya sabés usar VitalOS.
            </span>
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-7">
            <Link
              href="/register"
              className="group inline-flex items-center justify-center gap-2 bg-[#00C4BC] hover:bg-[#00aaa3] text-white font-bold px-9 py-4 rounded-xl transition-all text-base md:text-lg shadow-lg shadow-[#00C4BC]/25 hover:shadow-xl hover:shadow-[#00C4BC]/30 hover:-translate-y-0.5"
            >
              Probar gratis 14 días
              <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" strokeWidth={2.5} />
            </Link>
            <a
              href="#resultados"
              className="inline-flex items-center justify-center gap-2 border-2 border-[#00C4BC]/30 text-[#00C4BC] hover:bg-[#E6F8F1] font-semibold px-9 py-4 rounded-xl transition-all text-base md:text-lg"
            >
              <Play className="w-4 h-4 fill-current" /> Ver cómo se usa
            </a>
          </div>

          {/* trust chips */}
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm md:text-base text-[#6B7280] mb-14">
            {['Sin instalar nada', 'Sin tarjeta', 'Listo hoy mismo', 'Soporte por WhatsApp'].map((t, i) => (
              <span key={i} className="flex items-center gap-1.5">
                <Check className="w-4 h-4 text-[#00C4BC]" strokeWidth={3} /> {t}
              </span>
            ))}
          </div>

          {/* hero visual — funciona en la computadora y en el celular */}
          <div className="max-w-5xl mx-auto">
            <div className="relative md:pr-28 lg:pr-40" style={{ animation: 'vos-float 7s ease-in-out infinite' }}>
              {/* Desktop con barra de navegador */}
              <div className="bg-white border border-[#E6F8F1] rounded-2xl overflow-hidden shadow-2xl shadow-[#00C4BC]/15">
                <div className="flex items-center gap-1.5 px-4 py-2.5 bg-[#F3F4F6] border-b border-[#E6F8F1]">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]" />
                  <span className="w-2.5 h-2.5 rounded-full bg-[#FEBC2E]" />
                  <span className="w-2.5 h-2.5 rounded-full bg-[#28C840]" />
                  <span className="ml-3 text-[11px] text-[#9CA3AF] font-medium">vitalos.com.ar</span>
                </div>
                <Image
                  src="/hero-desktop.png"
                  alt="VitalOS en la computadora"
                  width={2000}
                  height={1403}
                  className="w-full h-auto"
                  priority
                />
              </div>

              {/* Celular flotante — video en vivo: un turno en 15s */}
              <div
                className="hidden md:block absolute -bottom-10 -right-2 lg:right-0 w-[210px] lg:w-[250px]"
                style={{ animation: 'vos-float-sm 5.5s ease-in-out infinite' }}
              >
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 z-20 bg-[#00C4BC] text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full shadow-lg whitespace-nowrap">
                  Un turno en 15 seg ⚡
                </span>
                <div className="rounded-[2.2rem] border-[8px] border-[#0F1720] bg-[#0F1720] shadow-2xl shadow-[#00C4BC]/30 overflow-hidden">
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
          <Reveal>
            <h2 className="text-2xl md:text-3xl font-extrabold text-[#0F1720] text-center mb-3">
              Tranquilo. Es más fácil de lo que pensás.
            </h2>
            <p className="text-center text-[#6B7280] mb-12 max-w-xl mx-auto">
              No tenés que volverte experto en computadoras para ordenar tu consultorio.
            </p>
          </Reveal>
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-6">
            {[
              { Icon: Monitor, t: 'No instalás nada', d: 'Funciona en el navegador y en el celular' },
              { Icon: MessageCircle, t: 'No necesitás saber de computación', d: 'Si usás WhatsApp, podés con esto' },
              { Icon: Clock, t: 'Lo empezás a usar hoy', d: 'Listo en 5 minutos, sin capacitación' },
              { Icon: Headphones, t: 'Soporte por WhatsApp', d: 'Te responde una persona, el mismo día' },
              { Icon: Smartphone, t: 'Entrás desde donde quieras', d: 'Celular, tablet o computadora' },
            ].map((item, i) => (
              <Reveal key={i} delay={i * 70}>
                <div className="bg-white rounded-2xl p-6 text-center border border-[#00C4BC]/10 h-full hover:border-[#00C4BC]/30 hover:shadow-md hover:shadow-[#00C4BC]/10 hover:-translate-y-1 transition-all">
                  <div className="w-12 h-12 rounded-xl bg-[#E6F8F1] flex items-center justify-center mx-auto mb-3">
                    <item.Icon className="w-6 h-6 text-[#00C4BC]" strokeWidth={2} />
                  </div>
                  <p className="font-bold text-[#0F1720] text-sm mb-1.5 leading-snug">{item.t}</p>
                  <p className="text-xs text-[#6B7280] leading-relaxed">{item.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── RESULTADOS (bento) ─────────────────────────────────── */}
      <section id="resultados" className="py-20 md:py-28 bg-white relative overflow-hidden">
        <div className="absolute top-1/4 right-0 w-[400px] h-[400px] bg-[#00C4BC]/5 rounded-full blur-[120px] pointer-events-none" />
        <div className="max-w-7xl mx-auto px-6 relative">
          <Reveal>
            <div className="text-center mb-14 max-w-2xl mx-auto">
              <span className="inline-block text-[#00C4BC] text-xs font-bold uppercase tracking-widest bg-[#E6F8F1] px-3 py-1 rounded-full mb-4">
                Todo en un lugar
              </span>
              <h2 className="text-3xl md:text-5xl font-extrabold text-[#0F1720] leading-tight tracking-tight">
                Lo que antes te llevaba horas, ahora en segundos
              </h2>
              <p className="text-[#6B7280] mt-4 text-lg">Igual de fácil en la computadora y en el celular. Sin manuales.</p>
            </div>
          </Reveal>

          <div className="grid grid-cols-1 lg:grid-cols-6 gap-5 lg:gap-6">
            {features.map((f, i) => (
              <FeatureCard key={i} feature={f} />
            ))}
          </div>
        </div>
      </section>

      {/* ── DOLOR ──────────────────────────────────────────────── */}
      <section className="py-20 bg-white border-b border-[#F3F4F6]">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <Reveal>
            <h2 className="text-3xl md:text-4xl font-extrabold text-[#0F1720] mb-8">
              ¿Te suena familiar?
            </h2>
          </Reveal>
          <div className="grid md:grid-cols-2 gap-4 text-left mb-8">
            {[
              'Perdés turnos porque los anotás en papel o en WhatsApp',
              'No sabés cuánto facturaste hasta que lo sumás a mano',
              'Los pacientes piden la ficha y tardás 10 minutos en encontrarla',
              'Usás 3 apps distintas para lo que debería hacer una sola',
              'Salís del consultorio y seguís pensando en lo administrativo',
              'Los turnos cancelados te agarran desprevenido',
            ].map((item, i) => (
              <Reveal key={i} delay={i * 50}>
                <div className="flex items-start gap-3 bg-red-50 border border-red-100 rounded-xl p-4 h-full">
                  <span className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <X className="w-3 h-3 text-red-500" strokeWidth={3} />
                  </span>
                  <span className="text-sm text-[#0F1720]">{item}</span>
                </div>
              </Reveal>
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
          <Reveal>
            <div className="text-center mb-14">
              <span className="inline-block text-[#00C4BC] text-xs font-bold uppercase tracking-widest bg-white border border-[#00C4BC]/20 px-4 py-1.5 rounded-full mb-4">
                ¿Venís del papel?
              </span>
              <h2 className="text-3xl md:text-4xl font-extrabold text-[#0F1720]">
                Lo mismo que ya hacés, pero ordenado
              </h2>
            </div>
          </Reveal>

          <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {/* ANTES */}
            <Reveal>
              <div className="bg-[#EDEDED] border border-[#D1D5DB] rounded-2xl p-7 opacity-90 h-full">
                <p className="text-xs font-bold text-[#6B7280] uppercase tracking-widest mb-5">Hoy</p>
                <ul className="space-y-4">
                  {[
                    [NotebookPen, 'Agenda de papel'],
                    [FolderOpen, 'Carpetas y fichas'],
                    [MessageCircle, 'Recordás los turnos a mano'],
                    [Calculator, 'Excel y sumas a mano'],
                    [Phone, '“¿A qué hora era?”'],
                  ].map(([Ic, t], i) => {
                    const IcC = Ic as typeof CalendarCheck
                    return (
                      <li key={i} className="flex items-center gap-3 text-[#4B5563] text-sm">
                        <IcC className="w-4 h-4 text-[#9CA3AF] flex-shrink-0" strokeWidth={2} />
                        <span className="line-through decoration-[#9CA3AF]/60">{t as string}</span>
                      </li>
                    )
                  })}
                </ul>
              </div>
            </Reveal>

            {/* DESPUÉS */}
            <Reveal delay={120}>
              <div className="bg-white border-2 border-[#00C4BC] rounded-2xl p-7 shadow-lg shadow-[#00C4BC]/10 h-full">
                <p className="text-xs font-bold text-[#00C4BC] uppercase tracking-widest mb-5">Con VitalOS</p>
                <ul className="space-y-4">
                  {[
                    [CalendarCheck, 'Agenda en el celular'],
                    [HeartPulse, 'Historia clínica online'],
                    [Bell, 'Recordatorios automáticos'],
                    [TrendingDown, 'Reportes que se hacen solos'],
                    [Check, 'Todo confirmado por WhatsApp'],
                  ].map(([Ic, t], i) => {
                    const IcC = Ic as typeof CalendarCheck
                    return (
                      <li key={i} className="flex items-center gap-3 text-[#0F1720] text-sm font-medium">
                        <span className="w-6 h-6 rounded-lg bg-[#E6F8F1] flex items-center justify-center flex-shrink-0">
                          <IcC className="w-3.5 h-3.5 text-[#00C4BC]" strokeWidth={2.5} />
                        </span>
                        <span>{t as string}</span>
                      </li>
                    )
                  })}
                </ul>
              </div>
            </Reveal>
          </div>

          <div className="text-center mt-12">
            <p className="text-lg font-bold text-[#0F1720] mb-5">No tirás nada de lo que ya tenés. Lo pasamos junto.</p>
            <a
              href="#resultados"
              className="inline-flex items-center gap-2 border-2 border-[#00C4BC]/40 text-[#00C4BC] hover:bg-[#E6F8F1] font-bold px-8 py-3.5 rounded-xl transition-all"
            >
              Quiero ver cómo se ve <ArrowRight className="w-4 h-4" strokeWidth={2.5} />
            </a>
          </div>
        </div>
      </section>

      {/* ── MIGRACIÓN (acento oscuro) ──────────────────────────── */}
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
              <Reveal key={i} delay={i * 100}>
                <div className="bg-white/5 border border-white/10 rounded-2xl p-7 h-full">
                  <div className="w-10 h-10 rounded-full bg-[#00C4BC] text-white font-bold flex items-center justify-center mb-4">{s.n}</div>
                  <p className="font-bold mb-2">{s.t}</p>
                  <p className="text-white/60 text-sm leading-relaxed">{s.d}</p>
                </div>
              </Reveal>
            ))}
          </div>

          <p className="text-white/80 italic mb-7">No necesitás conocimientos técnicos. Para eso estamos nosotros.</p>
          <a
            href={waLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-[#25D366] hover:bg-[#1ebe5a] text-white font-bold px-8 py-4 rounded-xl transition-all shadow-lg hover:-translate-y-0.5"
          >
            <MessageCircle className="w-5 h-5" strokeWidth={2.5} /> Quiero que me ayuden a migrar
          </a>
        </div>
      </section>

      {/* ── CÓMO FUNCIONA ──────────────────────────────────────── */}
      <section id="como-funciona" className="bg-[#E6F8F1] py-24">
        <div className="max-w-5xl mx-auto px-6">
          <Reveal>
            <div className="text-center mb-16">
              <span className="inline-block text-[#00C4BC] text-xs font-bold uppercase tracking-widest bg-white border border-[#00C4BC]/20 px-4 py-1.5 rounded-full mb-4">
                Proceso simple
              </span>
              <h2 className="text-3xl md:text-5xl font-extrabold text-[#0F1720] leading-tight">
                Tres pasos para empezar hoy
              </h2>
              <p className="text-[#6B7280] mt-3">Sin instalaciones. Sin capacitación. Sin vueltas.</p>
            </div>
          </Reveal>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              { n: '01', title: 'Creá tu cuenta', desc: 'Solo email y contraseña. Listo en menos de 2 minutos. Sin tarjeta de crédito.' },
              { n: '02', title: 'Cargá tus datos (o te ayudamos)', desc: 'Tus horarios y pacientes. Y si no querés hacerlo solo, lo hacemos juntos por WhatsApp.' },
              { n: '03', title: 'Manejá todo desde un lugar', desc: 'Turnos, historias clínicas, cobros y reportes. Desde el consultorio o desde tu celular.' },
            ].map((step, i) => (
              <Reveal key={i} delay={i * 100}>
                <div className="bg-white border border-[#00C4BC]/15 rounded-2xl p-8 hover:border-[#00C4BC]/40 hover:shadow-lg hover:shadow-[#00C4BC]/10 hover:-translate-y-1 transition-all h-full">
                  <div className="text-7xl font-extrabold text-[#00C4BC]/20 leading-none mb-4 select-none">{step.n}</div>
                  <h3 className="text-xl font-bold text-[#0F1720] mb-3">{step.title}</h3>
                  <p className="text-[#6B7280] text-sm leading-relaxed">{step.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>

          <div className="text-center mt-12">
            <Link
              href="/register"
              className="inline-block bg-[#00C4BC] hover:bg-[#00aaa3] text-white font-bold px-10 py-4 rounded-xl transition-all shadow-lg shadow-[#00C4BC]/20 hover:-translate-y-0.5"
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
          <Reveal>
            <div className="text-center mb-14">
              <span className="inline-block text-[#00C4BC] text-xs font-bold uppercase tracking-widest bg-[#E6F8F1] px-3 py-1 rounded-full mb-4">
                Testimonios
              </span>
              <h2 className="text-3xl md:text-4xl font-extrabold text-[#0F1720]">
                Profesionales de la salud que dejaron el papel
              </h2>
              <p className="text-[#6B7280] mt-3">Y no quieren volver.</p>
            </div>
          </Reveal>

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
                name: 'Lic. Rubén Acosta',
                role: 'Kinesiología · Mar del Plata',
                initials: 'RA',
              },
              {
                quote: '"Trabajo sola hace 22 años. Por fin tengo cada ficha en el celular, sin revolver carpetas."',
                name: 'Dra. Silvina Ferreyra',
                role: 'Nutrición · Rosario',
                initials: 'SF',
              },
            ].map((t, i) => (
              <Reveal key={i} delay={i * 100}>
                <div className="border border-[#E6F8F1] rounded-2xl p-8 flex flex-col h-full hover:border-[#00C4BC]/30 hover:shadow-md hover:shadow-[#00C4BC]/8 hover:-translate-y-1 transition-all">
                  <div className="flex gap-1 mb-5">
                    {[...Array(5)].map((_, j) => (
                      <Star key={j} className="w-4 h-4 text-amber-400 fill-amber-400" />
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
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── ANCLA DE VALOR (acento oscuro) ─────────────────────── */}
      <section className="bg-[#0F1720] text-white py-20 md:py-24 relative overflow-hidden">
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[600px] h-[420px] bg-[#00C4BC]/15 rounded-full blur-[130px] pointer-events-none" />
        <div className="max-w-4xl mx-auto px-6 text-center relative">
          <span className="inline-block text-[#00C4BC] text-xs font-bold uppercase tracking-widest bg-white/10 px-4 py-1.5 rounded-full mb-6">
            Hagamos números
          </span>
          <h2 className="text-3xl md:text-5xl font-extrabold leading-[1.15] mb-6">
            Con recuperar <span className="text-[#00C4BC]">2 pacientes al mes</span> gracias a los recordatorios, VitalOS ya se pagó solo.
          </h2>
          <p className="text-white/70 text-lg md:text-xl max-w-2xl mx-auto mb-12">
            Los recordatorios automáticos por WhatsApp reducen las ausencias y los turnos que se caen. Cada paciente que no se te pierde paga varias veces lo que cuesta el sistema.
          </p>

          <div className="grid sm:grid-cols-3 gap-4 max-w-3xl mx-auto mb-12">
            {[
              { Ic: Bell, t: 'Mandás recordatorios', d: 'Automáticos, sin que hagas nada' },
              { Ic: TrendingDown, t: 'Bajan las ausencias', d: 'Menos turnos que se caen' },
              { Ic: Wallet, t: 'Se paga solo', d: 'Recuperás más de lo que cuesta' },
            ].map((s, i) => (
              <Reveal key={i} delay={i * 100}>
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 h-full">
                  <div className="w-12 h-12 rounded-xl bg-[#00C4BC]/15 flex items-center justify-center mx-auto mb-3">
                    <s.Ic className="w-6 h-6 text-[#00C4BC]" strokeWidth={2} />
                  </div>
                  <p className="font-bold mb-1">{s.t}</p>
                  <p className="text-white/60 text-sm leading-relaxed">{s.d}</p>
                </div>
              </Reveal>
            ))}
          </div>

          <Link
            href="/register"
            className="group inline-flex items-center gap-2 bg-[#00C4BC] hover:bg-[#00aaa3] text-white font-bold px-10 py-4 rounded-xl transition-all shadow-lg shadow-[#00C4BC]/30 hover:-translate-y-0.5"
          >
            Empezar 14 días gratis
            <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" strokeWidth={2.5} />
          </Link>
        </div>
      </section>

      {/* ── PRICING ────────────────────────────────────────────── */}
      <section id="pricing" className="bg-[#F3F4F6] py-24">
        <div className="max-w-6xl mx-auto px-6">

          <Reveal>
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
                <span className="bg-[#00C4BC] text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-md shadow-[#00C4BC]/30">
                  20% OFF
                </span>
              </div>
            </div>
          </Reveal>

          <div className="grid md:grid-cols-3 gap-6 items-start">

            {/* Starter */}
            <Reveal>
              <div className="bg-white border border-[#E5E7EB] rounded-3xl p-8 flex flex-col h-full">
                <div className="mb-6">
                  <p className="text-xs font-bold text-[#6B7280] uppercase tracking-widest mb-1">Starter</p>
                  <p className="text-sm text-[#6B7280]">Ordená tu consultorio desde el día 1</p>
                </div>
                <div className="mb-1">
                  <span className="text-5xl font-extrabold text-[#0F1720]">${price('starter')}</span>
                </div>
                <p className={`text-[#6B7280] text-xs ${annualBilling ? 'mb-1' : 'mb-7'}`}>
                  ARS / mes{annualBilling && ' · facturado anualmente'} · <strong className="text-[#00C4BC]">14 días gratis</strong>
                </p>
                {annualBilling && (
                  <p className="text-[#6B7280] text-xs mb-7">${annualTotal('starter')} ARS / año</p>
                )}

                <div className="space-y-3 mb-5 flex-1">
                  {[
                    'Agenda y turnos online',
                    'Historia clínica con odontograma',
                    'Hasta 100 pacientes activos',
                    '1 profesional',
                    'Soporte en español',
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <Check className="w-4 h-4 text-[#00C4BC] flex-shrink-0 mt-0.5" strokeWidth={3} />
                      <span className="text-[#0F1720] text-sm">{item}</span>
                    </div>
                  ))}
                  <div className="flex items-start gap-3 opacity-40 pt-1">
                    <X className="w-4 h-4 flex-shrink-0 mt-0.5" strokeWidth={3} />
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
            </Reveal>

            {/* Growth — destacado */}
            <Reveal delay={100}>
              <div className="bg-white border-2 border-[#00C4BC] rounded-3xl p-8 shadow-xl shadow-[#00C4BC]/10 relative flex flex-col h-full md:-translate-y-2">
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                  <span className="bg-[#00C4BC] text-white text-xs font-bold px-4 py-1 rounded-full uppercase tracking-wider shadow-md shadow-[#00C4BC]/30">
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
                <p className={`text-[#6B7280] text-xs ${annualBilling ? 'mb-1' : 'mb-7'}`}>
                  ARS / mes{annualBilling && ' · facturado anualmente'} · <strong className="text-[#00C4BC]">14 días gratis</strong>
                </p>
                {annualBilling && (
                  <p className="text-[#6B7280] text-xs mb-7">${annualTotal('growth')} ARS / año</p>
                )}

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
                      <Check className="w-4 h-4 text-[#00C4BC] flex-shrink-0 mt-0.5" strokeWidth={3} />
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
            </Reveal>

            {/* Scale */}
            <Reveal delay={200}>
              <div className="bg-white border border-[#E5E7EB] rounded-3xl p-8 flex flex-col h-full">
                <div className="mb-6">
                  <p className="text-xs font-bold text-[#6B7280] uppercase tracking-widest mb-1">Scale</p>
                  <p className="text-sm text-[#6B7280]">Gestioná tu clínica como una empresa</p>
                </div>
                <div className="mb-1">
                  <span className="text-5xl font-extrabold text-[#0F1720]">${price('scale')}</span>
                </div>
                <p className={`text-[#6B7280] text-xs ${annualBilling ? 'mb-1' : 'mb-7'}`}>
                  ARS / mes{annualBilling && ' · facturado anualmente'} · <strong className="text-[#00C4BC]">14 días gratis</strong>
                </p>
                {annualBilling && (
                  <p className="text-[#6B7280] text-xs mb-7">${annualTotal('scale')} ARS / año</p>
                )}

                <div className="space-y-3 mb-5 flex-1">
                  {[
                    'Todo lo del plan Growth',
                    'Hasta 10 profesionales',
                    '1.000 recordatorios WhatsApp/mes',
                    'Reportes avanzados (ocupación, cancelaciones, rendimiento)',
                    'Onboarding personalizado',
                    'Soporte dedicado',
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <Check className="w-4 h-4 text-[#00C4BC] flex-shrink-0 mt-0.5" strokeWidth={3} />
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
            </Reveal>

          </div>

        </div>
      </section>

      {/* ── FAQ ────────────────────────────────────────────────── */}
      <section className="py-24 bg-white">
        <div className="max-w-2xl mx-auto px-6">
          <Reveal>
            <div className="text-center mb-12">
              <span className="inline-block text-[#00C4BC] text-xs font-bold uppercase tracking-widest bg-[#E6F8F1] px-3 py-1 rounded-full mb-4">
                Dudas frecuentes
              </span>
              <h2 className="text-3xl md:text-4xl font-extrabold text-[#0F1720]">Lo que más nos preguntan</h2>
            </div>
          </Reveal>

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
              <MessageCircle className="w-4 h-4" strokeWidth={2.5} /> Preguntá por WhatsApp
            </a>
          </div>
        </div>
      </section>

      {/* ── CTA FINAL ──────────────────────────────────────────── */}
      <section className="bg-[#E6F8F1] py-24 relative overflow-hidden">
        <div className="absolute top-0 right-1/4 w-[400px] h-[400px] bg-[#00C4BC]/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="max-w-2xl mx-auto px-6 text-center relative">
          <h2 className="text-3xl md:text-5xl font-extrabold text-[#0F1720] mb-5 leading-tight tracking-tight">
            Probalo sin compromiso.<br />Si no te gusta, no pasa nada.
          </h2>
          <p className="text-[#6B7280] text-lg mb-9">
            14 días gratis. Sin tarjeta. Sin instalar nada. Y si tenés dudas, te ayudamos por WhatsApp.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/register"
              className="inline-flex items-center justify-center bg-[#00C4BC] hover:bg-[#00aaa3] text-white font-bold px-7 py-3.5 rounded-xl transition-all shadow-lg shadow-[#00C4BC]/20 text-base whitespace-nowrap leading-none hover:-translate-y-0.5"
            >
              Quiero probarlo gratis
            </Link>
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 bg-white border-2 border-[#25D366]/40 text-[#128C7E] hover:bg-[#25D366]/10 font-bold px-7 py-3.5 rounded-xl transition-all text-base whitespace-nowrap leading-none"
            >
              <MessageCircle className="w-5 h-5" strokeWidth={2.5} /> Prefiero que me lo muestren
            </a>
          </div>
          <p className="text-sm text-[#6B7280] mt-5">
            Sin tarjeta · Listo en menos de 5 minutos · Cancelás cuando querés
          </p>
        </div>
      </section>

      {/* ── FOOTER (acento oscuro) ─────────────────────────────── */}
      <footer className="bg-[#0F1720] border-t border-white/10 py-14">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-10 mb-10">
            <div>
              <h3 className="text-2xl font-extrabold text-white mb-3">
                Vital<span className="text-[#00C4BC]">OS</span>
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
                <li><Link href="/privacy" className="hover:text-white transition-colors">Privacidad</Link></li>
                <li><Link href="/terms" className="hover:text-white transition-colors">Términos</Link></li>
                <li><Link href="/dpa" className="hover:text-white transition-colors">DPA</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-white/10 pt-6 flex flex-col md:flex-row items-center justify-between">
            <p className="text-[#6B7280] text-sm">© 2026 VitalOS. Todos los derechos reservados.</p>
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
        <MessageCircle className="w-5 h-5" strokeWidth={2.5} />
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
                Vital<span className="text-[#00C4BC]">OS</span>
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
