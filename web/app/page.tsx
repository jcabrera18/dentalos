'use client'

import Link from 'next/link'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function HomePage() {
  const router = useRouter()
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [openFaq, setOpenFaq] = useState<number | null>(null)

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
      a: 'No. DentalOS funciona 100% en el navegador y en el celular. Entrás con tu email y listo.'
    },
    {
      q: '¿Qué pasa después de los 10 días gratis?',
      a: 'Te avisamos antes de que termine el período. Si querés seguir, elegís el plan pago ($38.000 por usuario por mes). Si no, no te cobramos nada. Sin preguntas.'
    },
    {
      q: '¿Mis datos están seguros?',
      a: 'Sí. Tus datos se almacenan con respaldo automático en la nube. Vos sos el único dueño de tu información y podés exportarla cuando quieras.'
    },
    {
      q: '¿Puedo usarlo desde el celular?',
      a: 'Sí. DentalOS está optimizado para celular, tablet y computadora. Funciona desde donde estés.'
    },
    {
      q: '¿Sirve para un consultorio con varios profesionales?',
      a: 'Sí. Podés agregar más usuarios y gestionar cada agenda por separado, con permisos y roles personalizables.'
    },
    {
      q: '¿Tienen soporte si tengo dudas?',
      a: 'Sí, soporte en español por chat. No es IA ni chatbots — respondemos el mismo día.'
    }
  ]

  return (
    <div className="min-h-screen bg-app text-app flex flex-col">
      {/* Navbar */}
      <nav className="border-b border-app/20 backdrop-blur-sm sticky top-0 z-40 bg-surface/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold">
            Dental<span className="text-emerald-500">OS</span>
          </Link>
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-app2 hover:text-app transition-colors font-medium">
              Funcionalidades
            </a>
            <a href="#como-funciona" className="text-app2 hover:text-app transition-colors font-medium">
              Cómo funciona
            </a>
            <a href="#pricing" className="text-app2 hover:text-app transition-colors font-medium">
              Precios
            </a>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowLoginModal(true)}
              className="text-app2 hover:text-app transition-colors font-medium text-sm"
            >
              Ingresar
            </button>
            <Link href="/register" className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg transition-colors font-semibold text-sm">
              Empezar gratis →
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden px-4 py-20 md:py-28">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-6xl font-black mb-6 leading-tight tracking-tight">
            Organizá tu consultorio odontológico{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-emerald-600">
              sin papeles, sin caos.
            </span>
          </h1>
          <p className="text-lg md:text-xl text-app2 mb-8 max-w-2xl mx-auto leading-relaxed">
            DentalOS maneja tu agenda, pacientes, historia clínica y finanzas — todo en un solo lugar. Sin llamadas, sin planillas, sin desorden.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-6">
            <Link href="/register" className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-bold px-8 py-4 rounded-lg transition-all transform hover:scale-105 shadow-lg text-center text-lg">
              Empezar 10 días gratis
            </Link>
            <a href="#como-funciona" className="border-2 border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/10 font-semibold px-8 py-4 rounded-lg transition-all text-center">
              Ver cómo funciona ↓
            </a>
          </div>
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-app2">
            <span>✓ Sin tarjeta de crédito</span>
            <span>✓ Listo en 5 minutos</span>
            <span>✓ Cancelás cuando querés</span>
            <span>✓ Soporte en español</span>
          </div>
        </div>
      </section>

      {/* Pain Section */}
      <section className="px-4 py-16 bg-surface border-y border-app/20">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-8">
            ¿Te suena familiar?
          </h2>
          <ul className="text-left space-y-3 text-app2 mb-8 max-w-lg mx-auto">
            <li className="flex gap-3 items-start">
              <span className="text-red-400 font-bold mt-0.5 flex-shrink-0">✗</span>
              <span>Perdés turnos porque los anotás en papel o en WhatsApp</span>
            </li>
            <li className="flex gap-3 items-start">
              <span className="text-red-400 font-bold mt-0.5 flex-shrink-0">✗</span>
              <span>No sabés cuánto facturaste este mes hasta que lo sumás a mano</span>
            </li>
            <li className="flex gap-3 items-start">
              <span className="text-red-400 font-bold mt-0.5 flex-shrink-0">✗</span>
              <span>Los pacientes te piden la historia clínica y tardás 10 minutos en encontrarla</span>
            </li>
            <li className="flex gap-3 items-start">
              <span className="text-red-400 font-bold mt-0.5 flex-shrink-0">✗</span>
              <span>Usás 3 apps distintas para lo que debería hacer una sola</span>
            </li>
            <li className="flex gap-3 items-start">
              <span className="text-red-400 font-bold mt-0.5 flex-shrink-0">✗</span>
              <span>Salís del consultorio y seguís pensando en lo administrativo</span>
            </li>
          </ul>
          <p className="text-app font-semibold text-lg">
            No es falta de organización. Es que no tenés la herramienta correcta.
          </p>
        </div>
      </section>

      {/* Stats Section */}
      <section className="px-4 py-14 border-b border-app/20">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="text-4xl font-bold text-emerald-500 mb-1">📅</div>
              <p className="text-app font-semibold text-sm">Agenda online 24/7</p>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-emerald-500 mb-1">🦷</div>
              <p className="text-app font-semibold text-sm">Historia clínica digital</p>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-purple-500 mb-1">💰</div>
              <p className="text-app font-semibold text-sm">Finanzas en tiempo real</p>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-amber-500 mb-1">👥</div>
              <p className="text-app font-semibold text-sm">Gestión de pacientes</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="px-4 py-24 border-b border-app/20">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-4">
              Todo lo que necesita tu consultorio.
              <span className="text-app2 block text-2xl md:text-3xl font-normal mt-2">Nada de lo que no necesitás.</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Feature 1 */}
            <div className="bg-surface border border-app/20 rounded-2xl p-8 hover:border-emerald-500/50 transition-all hover:shadow-lg hover:shadow-emerald-500/10">
              <div className="w-14 h-14 bg-emerald-500/20 rounded-lg flex items-center justify-center text-3xl mb-6">
                📅
              </div>
              <h3 className="text-xl font-bold mb-3">Agenda que trabaja por vos</h3>
              <ul className="text-app2 space-y-2 text-sm">
                <li>✓ Tus pacientes se agendan desde cualquier dispositivo, a cualquier hora</li>
                <li>✓ Recordatorios automáticos — menos no-shows sin que hagas nada</li>
                <li>✓ Vista semanal/diaria clara, sin cruces ni dobles turnos</li>
                <li>✓ Accesible desde el celular en segundos</li>
              </ul>
            </div>

            {/* Feature 2 */}
            <div className="bg-surface border border-app/20 rounded-2xl p-8 hover:border-purple-500/50 transition-all hover:shadow-lg hover:shadow-purple-500/10">
              <div className="w-14 h-14 bg-purple-500/20 rounded-lg flex items-center justify-center text-3xl mb-6">
                🦷
              </div>
              <h3 className="text-xl font-bold mb-3">Historia clínica sin papeles</h3>
              <ul className="text-app2 space-y-2 text-sm">
                <li>✓ Odontograma interactivo y digital</li>
                <li>✓ Historial completo de cada paciente en un clic</li>
                <li>✓ Evoluciones, tratamientos e imágenes adjuntas</li>
                <li>✓ Accedés desde donde estés, en segundos</li>
              </ul>
            </div>

            {/* Feature 3 */}
            <div className="bg-surface border border-app/20 rounded-2xl p-8 hover:border-emerald-500/50 transition-all hover:shadow-lg hover:shadow-emerald-500/10">
              <div className="w-14 h-14 bg-emerald-500/20 rounded-lg flex items-center justify-center text-3xl mb-6">
                💰
              </div>
              <h3 className="text-xl font-bold mb-3">Finanzas sin sorpresas</h3>
              <ul className="text-app2 space-y-2 text-sm">
                <li>✓ Ingresos y cobros pendientes en tiempo real</li>
                <li>✓ Sabés exactamente cuánto facturaste cada mes</li>
                <li>✓ Alertas de pagos pendientes automáticas</li>
                <li>✓ Sin planillas, sin Excel, sin dolores de cabeza</li>
              </ul>
            </div>

            {/* Feature 4 */}
            <div className="bg-surface border border-app/20 rounded-2xl p-8 hover:border-amber-500/50 transition-all hover:shadow-lg hover:shadow-amber-500/10">
              <div className="w-14 h-14 bg-amber-500/20 rounded-lg flex items-center justify-center text-3xl mb-6">
                👥
              </div>
              <h3 className="text-xl font-bold mb-3">Gestión de pacientes centralizada</h3>
              <ul className="text-app2 space-y-2 text-sm">
                <li>✓ Ficha completa de cada paciente con historial de visitas</li>
                <li>✓ Seguimiento de tratamientos en curso</li>
                <li>✓ Múltiples profesionales con agendas separadas</li>
                <li>✓ Permisos y roles por usuario</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="como-funciona" className="px-4 py-24 bg-surface border-b border-app/20">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl md:text-5xl font-bold text-center mb-4">
            Tres pasos para tener tu consultorio ordenado hoy.
          </h2>
          <p className="text-center text-app2 mb-16">Sin instalaciones. Sin capacitación. Sin vueltas.</p>

          <div className="grid md:grid-cols-3 gap-8 mb-12">
            {[
              {
                num: '1',
                title: 'Creá tu cuenta',
                desc: 'Solo email y contraseña. Listo en menos de 2 minutos. Sin tarjeta de crédito.'
              },
              {
                num: '2',
                title: 'Configurá tu consultorio',
                desc: 'Cargá tus horarios, servicios y pacientes. Es intuitivo — no necesitás capacitación.'
              },
              {
                num: '3',
                title: 'Manejá todo desde un lugar',
                desc: 'Turnos, historias clínicas, cobros y reportes. Desde el consultorio o desde tu celular.'
              }
            ].map((step, i) => (
              <div key={i} className="relative group">
                <div className="bg-app border border-app/20 rounded-2xl p-8 h-full flex flex-col group-hover:border-emerald-500/50 transition-all">
                  <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-full flex items-center justify-center text-white font-bold text-lg mb-6">
                    {step.num}
                  </div>
                  <h3 className="text-xl font-bold mb-3">{step.title}</h3>
                  <p className="text-app2 text-sm flex-1">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center">
            <Link href="/register" className="inline-block bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-bold px-8 py-4 rounded-lg transition-all transform hover:scale-105 shadow-lg">
              Empezar gratis ahora
            </Link>
            <p className="text-sm text-app2 mt-3">Sin tarjeta · Listo en 5 minutos · Cancelás cuando querés</p>
          </div>
        </div>
      </section>

      {/* Testimonials Section - BEFORE pricing */}
      <section className="px-4 py-24 border-b border-app/20">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
            Lo que dicen los odontólogos que ya lo usan
          </h2>
          <p className="text-center text-app2 mb-12">Resultados reales de consultorios reales.</p>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-surface border border-app/20 rounded-2xl p-8">
              <div className="flex gap-1 mb-4">
                {[...Array(5)].map((_, i) => (
                  <span key={i} className="text-amber-400 text-lg">★</span>
                ))}
              </div>
              <p className="text-app mb-6 leading-relaxed">
                "Antes perdía 1 hora por día en administración. Ahora son 10 minutos y ya estoy atendiendo."
              </p>
              <p className="font-bold text-sm">Dra. María García</p>
              <p className="text-xs text-app2">Odontóloga general · CABA</p>
            </div>

            <div className="bg-surface border border-app/20 rounded-2xl p-8">
              <div className="flex gap-1 mb-4">
                {[...Array(5)].map((_, i) => (
                  <span key={i} className="text-amber-400 text-lg">★</span>
                ))}
              </div>
              <p className="text-app mb-6 leading-relaxed">
                "Los recordatorios automáticos solos ya justificaron el costo. Los turnos no confirmados bajaron un montón."
              </p>
              <p className="font-bold text-sm">Dr. Carlos López</p>
              <p className="text-xs text-app2">Ortodoncista · Córdoba</p>
            </div>

            <div className="bg-surface border border-app/20 rounded-2xl p-8">
              <div className="flex gap-1 mb-4">
                {[...Array(5)].map((_, i) => (
                  <span key={i} className="text-amber-400 text-lg">★</span>
                ))}
              </div>
              <p className="text-app mb-6 leading-relaxed">
                "Por fin tengo las historias clínicas en orden. La ficha de cada paciente en segundos, desde el celular."
              </p>
              <p className="font-bold text-sm">Dra. Silvina Rodríguez</p>
              <p className="text-xs text-app2">Odontopediatra · Rosario</p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="px-4 py-24 bg-surface border-b border-app/20">
        <div className="max-w-lg mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-3">
            Un precio. Todo incluido.
          </h2>
          <p className="text-app2 mb-10">
            Probá 10 días completos sin pagar nada. Sin tarjeta. Sin sorpresas.
          </p>

          <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/10 border-2 border-emerald-500/40 rounded-3xl p-10">
            <p className="text-sm font-semibold text-emerald-400 uppercase tracking-widest mb-4">Plan todo incluido</p>
            <div className="mb-2">
              <span className="text-6xl font-black text-emerald-500">$38.000</span>
            </div>
            <p className="text-app2 text-sm mb-8">ARS por usuario / mes · <strong className="text-emerald-400">Primeros 10 días gratis</strong></p>

            <div className="bg-white/5 rounded-xl p-6 mb-8 text-left space-y-3">
              {[
                'Agenda online con recordatorios automáticos',
                'Historia clínica con odontograma digital',
                'Control de finanzas y cobros pendientes',
                'Gestión de pacientes ilimitados',
                'Multi-usuario con permisos personalizables',
                'Acceso desde celular, tablet o computadora',
                'Soporte en español incluido',
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-emerald-500 font-bold flex-shrink-0">✓</span>
                  <span className="text-app text-sm">{item}</span>
                </div>
              ))}
            </div>

            <Link href="/register" className="inline-block w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-bold px-8 py-4 rounded-lg transition-all transform hover:scale-105 shadow-lg mb-3 text-center">
              Empezar 10 días gratis
            </Link>
            <p className="text-xs text-app2">Sin tarjeta · Cancelás cuando querés · Sin preguntas</p>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="px-4 py-24 border-b border-app/20">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
            Preguntas frecuentes
          </h2>

          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <div key={i} className="bg-surface border border-app/20 rounded-xl overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full px-6 py-5 text-left flex items-center justify-between gap-4 hover:bg-white/5 transition-colors"
                >
                  <span className="font-semibold text-app">{faq.q}</span>
                  <span className="text-emerald-500 flex-shrink-0 text-lg font-bold transition-transform" style={{ transform: openFaq === i ? 'rotate(45deg)' : 'none' }}>
                    +
                  </span>
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-5 text-app2 text-sm leading-relaxed border-t border-app/10 pt-4">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="px-4 py-24 bg-gradient-to-r from-emerald-500/15 to-emerald-600/15 border-b border-app/20">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl md:text-5xl font-bold mb-5">
            Tu consultorio más ordenado empieza hoy.
          </h2>
          <p className="text-lg text-app2 mb-8">
            Probá DentalOS 10 días gratis. Sin tarjeta, sin instalación, sin burocracia.
          </p>
          <Link href="/register" className="inline-block bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-bold px-10 py-5 rounded-lg transition-all transform hover:scale-105 shadow-lg text-lg">
            Empezar gratis ahora
          </Link>
          <p className="text-sm text-app2 mt-5">
            Sin tarjeta · Se tarda menos de 5 minutos · Cancelás cuando querés
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-app/20">
        <div className="max-w-6xl mx-auto px-4 py-16">
          <div className="grid md:grid-cols-4 gap-12 mb-8">
            <div>
              <h3 className="text-2xl font-bold mb-3">
                Dental<span className="text-emerald-500">OS</span>
              </h3>
              <p className="text-app2 text-sm">La gestión de tu consultorio, simplificada.</p>
            </div>
            <div>
              <h4 className="font-bold text-sm mb-4 uppercase tracking-wide">Producto</h4>
              <ul className="space-y-2 text-sm text-app2">
                <li><a href="#features" className="hover:text-app transition-colors">Funcionalidades</a></li>
                <li><a href="#como-funciona" className="hover:text-app transition-colors">Cómo funciona</a></li>
                <li><a href="#pricing" className="hover:text-app transition-colors">Precios</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-sm mb-4 uppercase tracking-wide">Compañía</h4>
              <ul className="space-y-2 text-sm text-app2">
                <li><a href="#" className="hover:text-app transition-colors">Sobre Nosotros</a></li>
                <li><a href="#" className="hover:text-app transition-colors">Blog</a></li>
                <li><a href="#" className="hover:text-app transition-colors">Contacto</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-sm mb-4 uppercase tracking-wide">Legal</h4>
              <ul className="space-y-2 text-sm text-app2">
                <li><a href="#" className="hover:text-app transition-colors">Privacidad</a></li>
                <li><a href="#" className="hover:text-app transition-colors">Términos</a></li>
                <li><a href="#" className="hover:text-app transition-colors">Seguridad</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-app/20 pt-8 flex flex-col md:flex-row items-center justify-between">
            <p className="text-app2 text-sm">© 2026 DentalOS. Todos los derechos reservados.</p>
            <div className="flex gap-6 mt-4 md:mt-0">
              <a href="#" className="text-app2 hover:text-app transition-colors text-sm">Instagram</a>
              <a href="#" className="text-app2 hover:text-app transition-colors text-sm">LinkedIn</a>
            </div>
          </div>
        </div>
      </footer>

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
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full bg-surface2 border border-app rounded-lg px-4 py-3 text-app focus:outline-none focus:border-emerald-400"
                  placeholder="dr@consultorio.com"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-app2 mb-2">Contraseña</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full bg-surface2 border border-app rounded-lg px-4 py-3 text-app focus:outline-none focus:border-emerald-400"
                  placeholder="••••••••"
                  required
                />
              </div>

              {error && (
                <div className="p-3 bg-red-900/30 border border-red-700 rounded-lg text-red-400 text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition-colors"
              >
                {loading ? 'Ingresando...' : 'Ingresar'}
              </button>

              <div className="text-center">
                <p className="text-app2 text-sm">
                  ¿No tenés cuenta?{' '}
                  <Link href="/register" className="text-emerald-400 hover:text-emerald-300 transition-colors" onClick={() => setShowLoginModal(false)}>
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
