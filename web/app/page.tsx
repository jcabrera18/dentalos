'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Plus_Jakarta_Sans } from 'next/font/google'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
})

export default function HomePage() {
  const router = useRouter()
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [annualBilling, setAnnualBilling] = useState(false)

  const PRICES = {
    starter: { monthly: 38000, annual: Math.round(38000 * 0.8) },
    growth:  { monthly: 58000, annual: Math.round(58000 * 0.8) },
    scale:   { monthly: 95000, annual: Math.round(95000 * 0.8) },
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
      q: '¿Necesito instalar algo?',
      a: 'No. DentalOS funciona 100% en el navegador y en el celular. Entrás con tu email y listo.',
    },
    {
      q: '¿Qué pasa después de los 14 días gratis?',
      a: 'Te avisamos con anticipación antes de que termine el período. Si querés seguir, elegís el plan que mejor se adapta a tu consultorio. Si no, no te cobramos nada. Sin preguntas.',
    },
    {
      q: '¿Mis datos están seguros?',
      a: 'Sí. Tus datos se almacenan con respaldo automático en la nube. Vos sos el único dueño de tu información y podés exportarla cuando quieras.',
    },
    {
      q: '¿Puedo usarlo desde el celular?',
      a: 'Sí. DentalOS está optimizado para celular, tablet y computadora. Funciona desde donde estés.',
    },
    {
      q: '¿Sirve para un consultorio con varios profesionales?',
      a: 'Sí. Podés agregar más usuarios y gestionar cada agenda por separado, con permisos y roles personalizables.',
    },
    {
      q: '¿Tienen soporte si tengo dudas?',
      a: 'Sí, soporte en español por chat. No es IA ni chatbots — respondemos el mismo día.',
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
            <a href="#features" className="text-[#6B7280] hover:text-[#0F1720] transition-colors text-sm font-medium">
              Funcionalidades
            </a>
            <a href="#como-funciona" className="text-[#6B7280] hover:text-[#0F1720] transition-colors text-sm font-medium">
              Cómo funciona
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
              Empezar gratis →
            </Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ───────────────────────────────────────────────── */}
      <section className="pt-32 pb-20 bg-white overflow-hidden relative">
        {/* subtle teal glow top-right */}
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-[#00C4BC]/8 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-[#00C4BC]/5 rounded-full blur-[80px] pointer-events-none" />

        <div className="max-w-7xl mx-auto px-6 relative">
          {/* badge */}
          <div className="flex justify-center mb-8">
            <span className="inline-flex items-center gap-2 bg-[#E6F8F1] border border-[#00C4BC]/30 text-[#00C4BC] text-xs font-bold px-4 py-1.5 rounded-full uppercase tracking-wider">
              <span className="w-1.5 h-1.5 bg-[#00C4BC] rounded-full animate-pulse" />
              Sistema de gestión para clínicas dentales
            </span>
          </div>

          {/* headline */}
          <h1 className="text-5xl md:text-7xl font-extrabold text-[#0F1720] text-center leading-[1.05] tracking-tight mb-6 max-w-4xl mx-auto">
            Organizá tu consultorio<br />
            <span className="text-[#00C4BC]">sin papeles, sin caos.</span>
          </h1>

          <p className="text-[#6B7280] text-lg md:text-xl text-center leading-relaxed mb-10 max-w-2xl mx-auto">
            DentalOS maneja tu agenda, pacientes, historia clínica y finanzas — todo en un solo lugar. Sin llamadas, sin planillas, sin desorden.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-10">
            <Link
              href="/register"
              className="bg-[#00C4BC] hover:bg-[#00aaa3] text-white font-bold px-9 py-4 rounded-xl transition-all text-center text-base shadow-lg shadow-[#00C4BC]/20"
            >
              Empezar 14 días gratis
            </Link>
            <a
              href="#como-funciona"
              className="border-2 border-[#00C4BC]/30 text-[#00C4BC] hover:bg-[#E6F8F1] font-semibold px-9 py-4 rounded-xl transition-all text-center text-base"
            >
              Ver cómo funciona ↓
            </a>
          </div>

          {/* trust */}
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-[#6B7280]">
            <span className="flex items-center gap-1.5"><span className="text-[#00C4BC] font-bold">✓</span> Sin tarjeta de crédito</span>
            <span className="flex items-center gap-1.5"><span className="text-[#00C4BC] font-bold">✓</span> Listo en 5 minutos</span>
            <span className="flex items-center gap-1.5"><span className="text-[#00C4BC] font-bold">✓</span> Cancelás cuando querés</span>
            <span className="flex items-center gap-1.5"><span className="text-[#00C4BC] font-bold">✓</span> Soporte en español</span>
          </div>

          {/* hero image grid */}
          <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-5xl mx-auto">
            {[
              { src: '/image_4.webp', label: 'Agenda' },
              { src: '/image_3.webp', label: 'Pacientes' },
              { src: '/image_2.webp', label: 'Finanzas' },
              { src: '/image_1.webp', label: 'Historia Clínica' },
            ].map((img) => (
              <div
                key={img.src}
                className="bg-[#F3F4F6] border border-[#E6F8F1] rounded-2xl overflow-hidden p-4 flex flex-col items-center gap-3 hover:border-[#00C4BC]/40 hover:shadow-md hover:shadow-[#00C4BC]/10 transition-all"
              >
                <div className="relative w-full h-40">
                  <Image
                    src={img.src}
                    alt={img.label}
                    fill
                    className="object-contain"
                    priority
                  />
                </div>
                <span className="text-xs font-bold text-[#6B7280] uppercase tracking-wider">{img.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── STATS BAR ──────────────────────────────────────────── */}
      <section className="bg-[#E6F8F1] border-y border-[#00C4BC]/20 py-10">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { num: '14 días', label: 'Prueba completamente gratis' },
              { num: '5 min', label: 'Para tener todo listo' },
              { num: '1 lugar', label: 'Toda la gestión centralizada' },
              { num: '24/7', label: 'Acceso desde cualquier dispositivo' },
            ].map((s, i) => (
              <div key={i}>
                <div className="text-3xl font-extrabold text-[#00C4BC]">{s.num}</div>
                <div className="text-sm text-[#6B7280] mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PAIN SECTION ───────────────────────────────────────── */}
      <section className="py-20 bg-white border-b border-[#F3F4F6]">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-extrabold text-[#0F1720] mb-8">
            ¿Te suena familiar?
          </h2>
          <div className="grid md:grid-cols-2 gap-4 text-left mb-8">
            {[
              'Perdés turnos porque los anotás en papel o en WhatsApp',
              'No sabés cuánto facturaste hasta que lo sumás a mano',
              'Los pacientes piden la historia y tardás 10 minutos en encontrarla',
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
            No es falta de organización.{' '}
            <span className="text-[#00C4BC]">Es que no tenés la herramienta correcta.</span>
          </p>
        </div>
      </section>

      {/* ── FEATURES ───────────────────────────────────────────── */}
      <section id="features">

        {/* Feature 1: Agenda */}
        <div className="py-20 md:py-28 bg-white">
          <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-2 gap-16 items-center">
            <div>
              <span className="inline-block text-[#00C4BC] text-xs font-bold uppercase tracking-widest bg-[#E6F8F1] px-3 py-1 rounded-full mb-4">
                Agenda online
              </span>
              <h2 className="text-4xl md:text-5xl font-extrabold text-[#0F1720] leading-tight mb-5">
                La agenda que trabaja mientras vos atendés
              </h2>
              <p className="text-[#6B7280] text-base leading-relaxed mb-7">
                Tus pacientes se agendan solos desde cualquier dispositivo. Reciben recordatorios automáticos y vos llegás al consultorio con el día organizado.
              </p>
              <ul className="space-y-3.5">
                {[
                  'Vista diaria y semanal, sin cruces ni dobles turnos',
                  'Recordatorios automáticos por WhatsApp',
                  'Booking online para tus pacientes',
                  'Acceso desde el celular en segundos',
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm text-[#0F1720]">
                    <span className="w-5 h-5 bg-[#E6F8F1] rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-[#00C4BC] text-xs font-bold">✓</span>
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex justify-center">
              <Image src="/image_4.webp" alt="Gestión de agenda" width={500} height={500} className="w-full max-w-md object-contain" />
            </div>
          </div>
        </div>

        {/* Feature 2: Pacientes */}
        <div className="py-20 md:py-28 bg-[#F3F4F6]">
          <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-2 gap-16 items-center">
            <div className="flex justify-center order-2 md:order-1">
              <Image src="/image_3.webp" alt="Gestión de pacientes" width={500} height={500} className="w-full max-w-md object-contain" />
            </div>
            <div className="order-1 md:order-2">
              <span className="inline-block text-[#00C4BC] text-xs font-bold uppercase tracking-widest bg-[#E6F8F1] px-3 py-1 rounded-full mb-4">
                Gestión de pacientes
              </span>
              <h2 className="text-4xl md:text-5xl font-extrabold text-[#0F1720] leading-tight mb-5">
                Todos tus pacientes, siempre a mano
              </h2>
              <p className="text-[#6B7280] text-base leading-relaxed mb-7">
                Ficha completa, historial de visitas y tratamientos en curso. Encontrás al paciente que buscás en segundos, desde cualquier dispositivo.
              </p>
              <ul className="space-y-3.5">
                {[
                  'Búsqueda instantánea por nombre o teléfono',
                  'Historial completo de visitas y pagos',
                  'Tratamientos activos siempre visibles',
                  'Gestión de múltiples profesionales',
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm text-[#0F1720]">
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

        {/* Feature 3: Finanzas */}
        <div className="py-20 md:py-28 bg-[#E6F8F1] relative overflow-hidden">
          <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-2 gap-16 items-center relative">
            <div>
              <span className="inline-block text-[#00C4BC] text-xs font-bold uppercase tracking-widest bg-white border border-[#00C4BC]/20 px-3 py-1 rounded-full mb-4">
                Finanzas
              </span>
              <h2 className="text-4xl md:text-5xl font-extrabold text-[#0F1720] leading-tight mb-5">
                Sabés cuánto ganás en tiempo real
              </h2>
              <p className="text-[#6B7280] text-base leading-relaxed mb-7">
                Sin planillas, sin Excel. Los ingresos del mes, cobros pendientes y gastos siempre actualizados. Tomás decisiones con información real.
              </p>
              <ul className="space-y-3.5">
                {[
                  'Ingresos y cobros pendientes al instante',
                  'Alertas de pagos vencidos automáticas',
                  'Reporte mensual en un clic',
                  'Control de gastos del consultorio',
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm text-[#0F1720]">
                    <span className="w-5 h-5 bg-white rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-[#00C4BC] text-xs font-bold">✓</span>
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex justify-center">
              <Image src="/image_2.webp" alt="Control financiero" width={700} height={700} className="w-full object-contain" />
            </div>
          </div>
        </div>

        {/* Feature 4: Historia Clínica */}
        <div className="py-20 md:py-28 bg-white">
          <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-2 gap-16 items-center">
            <div className="flex justify-center">
              <Image src="/image_1.webp" alt="Historia clínica digital" width={500} height={500} className="w-full max-w-md object-contain" />
            </div>
            <div>
              <span className="inline-block text-[#00C4BC] text-xs font-bold uppercase tracking-widest bg-[#E6F8F1] px-3 py-1 rounded-full mb-4">
                Historia clínica
              </span>
              <h2 className="text-4xl md:text-5xl font-extrabold text-[#0F1720] leading-tight mb-5">
                El historial de cada paciente, en segundos
              </h2>
              <p className="text-[#6B7280] text-base leading-relaxed mb-7">
                Odontograma digital, evoluciones e imágenes en un solo lugar. Sin papeles, sin archivos perdidos, sin demoras.
              </p>
              <ul className="space-y-3.5">
                {[
                  'Odontograma interactivo y digital',
                  'Evoluciones y notas clínicas por visita',
                  'Imágenes y estudios adjuntos',
                  'Accesible desde cualquier dispositivo',
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm text-[#0F1720]">
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
      </section>

      {/* ── HOW IT WORKS ───────────────────────────────────────── */}
      <section id="como-funciona" className="bg-[#E6F8F1] py-24">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-16">
            <span className="inline-block text-[#00C4BC] text-xs font-bold uppercase tracking-widest bg-white border border-[#00C4BC]/20 px-4 py-1.5 rounded-full mb-4">
              Proceso simple
            </span>
            <h2 className="text-4xl md:text-5xl font-extrabold text-[#0F1720] leading-tight">
              Tres pasos para empezar hoy
            </h2>
            <p className="text-[#6B7280] mt-3">Sin instalaciones. Sin capacitación. Sin vueltas.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                n: '01',
                title: 'Creá tu cuenta',
                desc: 'Solo email y contraseña. Listo en menos de 2 minutos. Sin tarjeta de crédito.',
              },
              {
                n: '02',
                title: 'Configurá tu consultorio',
                desc: 'Cargá tus horarios, servicios y pacientes. Es intuitivo — no necesitás capacitación.',
              },
              {
                n: '03',
                title: 'Manejá todo desde un lugar',
                desc: 'Turnos, historias clínicas, cobros y reportes. Desde el consultorio o desde tu celular.',
              },
            ].map((step, i) => (
              <div key={i} className="bg-white border border-[#00C4BC]/15 rounded-2xl p-8 hover:border-[#00C4BC]/40 hover:shadow-lg hover:shadow-[#00C4BC]/10 transition-all">
                <div className="text-7xl font-extrabold text-[#00C4BC]/20 leading-none mb-4 select-none">
                  {step.n}
                </div>
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

      {/* ── TESTIMONIALS ───────────────────────────────────────── */}
      <section className="py-24 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <span className="inline-block text-[#00C4BC] text-xs font-bold uppercase tracking-widest bg-[#E6F8F1] px-3 py-1 rounded-full mb-4">
              Testimonios
            </span>
            <h2 className="text-4xl font-extrabold text-[#0F1720]">
              Lo que dicen los odontólogos que ya lo usan
            </h2>
            <p className="text-[#6B7280] mt-3">Resultados reales de consultorios reales.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                quote: '"Antes perdía 1 hora por día en administración. Ahora son 10 minutos y ya estoy atendiendo."',
                name: 'Dra. María García',
                role: 'Odontóloga general · CABA',
              },
              {
                quote: '"Los recordatorios automáticos solos ya justificaron el costo. Los turnos no confirmados bajaron un montón."',
                name: 'Dr. Carlos López',
                role: 'Ortodoncista · Córdoba',
              },
              {
                quote: '"Por fin tengo las historias clínicas en orden. La ficha de cada paciente en segundos, desde el celular."',
                name: 'Dra. Silvina Rodríguez',
                role: 'Odontopediatra · Rosario',
              },
            ].map((t, i) => (
              <div key={i} className="border border-[#E6F8F1] rounded-2xl p-8 flex flex-col hover:border-[#00C4BC]/30 hover:shadow-md hover:shadow-[#00C4BC]/8 transition-all">
                <div className="flex gap-1 mb-5">
                  {[...Array(5)].map((_, j) => (
                    <span key={j} className="text-amber-400 text-lg">★</span>
                  ))}
                </div>
                <p className="text-[#0F1720] text-base leading-relaxed flex-1 mb-6">{t.quote}</p>
                <div className="border-t border-[#F3F4F6] pt-5">
                  <p className="font-bold text-sm text-[#0F1720]">{t.name}</p>
                  <p className="text-xs text-[#6B7280] mt-0.5">{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ────────────────────────────────────────────── */}
      <section id="pricing" className="bg-[#F3F4F6] py-24">
        <div className="max-w-6xl mx-auto px-6">

          {/* Ancla de valor — bloque clave */}
          <div className="text-center mb-14">
            <span className="inline-block text-[#00C4BC] text-xs font-bold uppercase tracking-widest bg-white border border-[#00C4BC]/20 px-3 py-1 rounded-full mb-5">
              Precios
            </span>
            <h2 className="text-4xl font-extrabold text-[#0F1720] mb-4">El plan que se adapta a tu consultorio</h2>
            <div className="inline-block bg-[#00C4BC]/10 border border-[#00C4BC]/25 rounded-2xl px-7 py-3 mb-4">
              <p className="text-[#0F1720] font-bold text-lg">
                Con solo 1 paciente recuperado por mes, DentalOS se paga solo.
              </p>
            </div>
            <p className="text-[#6B7280] text-sm">
              Probá 14 días completos sin pagar nada. Sin tarjeta. Sin sorpresas.
            </p>

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
                Escalar mi clínica
              </Link>
            </div>

          </div>

          {/* Packs WhatsApp adicionales */}
          <div className="mt-10 bg-white border border-[#E5E7EB] rounded-2xl px-8 py-6 flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <p className="text-sm font-bold text-[#0F1720] mb-1">¿Necesitás más recordatorios WhatsApp?</p>
              <p className="text-xs text-[#6B7280]">Sumá mensajes sin cambiar de plan. Te avisamos antes de llegar al límite.</p>
            </div>
            <div className="flex items-center gap-6 flex-shrink-0">
              <div className="text-center">
                <p className="text-xs text-[#6B7280] mb-0.5">Pack 100 mensajes</p>
                <p className="text-lg font-extrabold text-[#0F1720]">$5.000</p>
              </div>
              <div className="w-px h-10 bg-[#E5E7EB]" />
              <div className="text-center">
                <p className="text-xs text-[#6B7280] mb-0.5">Pack 500 mensajes</p>
                <div className="flex items-baseline gap-1.5 justify-center">
                  <p className="text-lg font-extrabold text-[#0F1720]">$18.000</p>
                  <span className="text-xs font-bold text-[#00C4BC] bg-[#E6F8F1] px-1.5 py-0.5 rounded-md">mejor precio</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ── FAQ ────────────────────────────────────────────────── */}
      <section className="py-24 bg-white">
        <div className="max-w-2xl mx-auto px-6">
          <div className="text-center mb-12">
            <span className="inline-block text-[#00C4BC] text-xs font-bold uppercase tracking-widest bg-[#E6F8F1] px-3 py-1 rounded-full mb-4">
              FAQ
            </span>
            <h2 className="text-4xl font-extrabold text-[#0F1720]">Preguntas frecuentes</h2>
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
        </div>
      </section>

      {/* ── FINAL CTA ──────────────────────────────────────────── */}
      <section className="bg-[#E6F8F1] py-24 relative overflow-hidden">
        <div className="max-w-2xl mx-auto px-6 text-center relative">
          <h2 className="text-4xl md:text-5xl font-extrabold text-[#0F1720] mb-5 leading-tight">
            Tu consultorio más ordenado<br />empieza hoy.
          </h2>
          <p className="text-[#6B7280] text-lg mb-8">
            Probá DentalOS 14 días gratis. Sin tarjeta, sin instalación, sin burocracia.
          </p>
          <Link
            href="/register"
            className="inline-block bg-[#00C4BC] hover:bg-[#00aaa3] text-white font-bold px-12 py-5 rounded-xl transition-all shadow-lg shadow-[#00C4BC]/20 text-lg"
          >
            Empezar gratis ahora
          </Link>
          <p className="text-sm text-[#6B7280] mt-5">
            Sin tarjeta · Se tarda menos de 5 minutos · Cancelás cuando querés
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
                <li><a href="#features" className="hover:text-white transition-colors">Funcionalidades</a></li>
                <li><a href="#como-funciona" className="hover:text-white transition-colors">Cómo funciona</a></li>
                <li><a href="#pricing" className="hover:text-white transition-colors">Precios</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-xs text-white mb-4 uppercase tracking-widest">Compañía</h4>
              <ul className="space-y-2 text-sm text-[#6B7280]">
                <li><a href="#" className="hover:text-white transition-colors">Sobre Nosotros</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Blog</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Contacto</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-xs text-white mb-4 uppercase tracking-widest">Legal</h4>
              <ul className="space-y-2 text-sm text-[#6B7280]">
                <li><a href="#" className="hover:text-white transition-colors">Privacidad</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Términos</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Seguridad</a></li>
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
