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

  return (
    <div className="min-h-screen bg-app text-app flex flex-col">
      {/* Navbar */}
      <nav className="border-b border-app/20 backdrop-blur-sm sticky top-0 z-40 bg-surface/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold">
            Dental<span className="text-blue-500">OS</span>
          </Link>
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-app2 hover:text-app transition-colors font-medium">
              Funcionalidades
            </a>
            <a href="#benefits" className="text-app2 hover:text-app transition-colors font-medium">
              Beneficios
            </a>
            <a href="#pricing" className="text-app2 hover:text-app transition-colors font-medium">
              Plan
            </a>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowLoginModal(true)}
              className="text-app2 hover:text-app transition-colors font-medium hidden sm:block"
            >
              Ingresar
            </button>
            <Link href="/register" className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors font-semibold text-sm">
              Registrarse
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden px-4 py-24 md:py-32">
        <div className="max-w-5xl mx-auto text-center">
          <div className="mb-6 flex justify-center">
            <span className="text-xs font-semibold uppercase tracking-widest text-blue-500 bg-blue-500/10 px-4 py-2 rounded-full">
              ✨ La solución que odontólogos como vos necesitaban
            </span>
          </div>
          <h1 className="text-5xl md:text-7xl font-black mb-8 leading-tight">
            Consultorio odontológico <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-blue-600">en piloto automático</span>
          </h1>
          <p className="text-lg md:text-xl text-app2 mb-8 max-w-3xl mx-auto leading-relaxed">
            Administrá tu consultorio sin estrés. Agenda automática, fichas digitales con odontograma, finanzas claras y equipo organizado. Desde hoy mismo.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Link href="/register" className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-bold px-8 py-4 rounded-lg transition-all transform hover:scale-105 shadow-lg text-center">
              Probar 10 días gratis
            </Link>
            <a href="#features" className="border-2 border-blue-500 text-blue-500 hover:bg-blue-500/10 font-bold px-8 py-4 rounded-lg transition-all">
              Ver en detalle ↓
            </a>
          </div>
          <p className="text-sm text-app2">💳 Sin tarjeta de crédito • 🔒 Datos seguros • ⚡ Configuración en 5 minutos</p>
        </div>
      </section>

      {/* Stats Section */}
      <section className="px-4 py-16 bg-surface border-y border-app/20">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="text-4xl font-bold text-blue-500 mb-2">3x</div>
              <p className="text-app2 font-medium">Más eficiencia en agenda</p>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-emerald-500 mb-2">80%</div>
              <p className="text-app2 font-medium">Menos tiempo administrativo</p>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-purple-500 mb-2">100%</div>
              <p className="text-app2 font-medium">Control de pacientes</p>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-amber-500 mb-2">24/7</div>
              <p className="text-app2 font-medium">Agendamiento automático</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="px-4 py-24 border-b border-app/20">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              Todas las herramientas que necesitás
            </h2>
            <p className="text-xl text-app2 max-w-2xl mx-auto">
              Diseñadas específicamente para odontólogos. Intuitivo, poderoso y hecho para crecer con tu negocio.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-8 mb-8">
            {/* Feature 1 */}
            <div className="bg-surface border border-app/20 rounded-2xl p-8 hover:border-blue-500/50 transition-all hover:shadow-lg hover:shadow-blue-500/10">
              <div className="w-14 h-14 bg-blue-500/20 rounded-lg flex items-center justify-center text-3xl mb-6">
                📅
              </div>
              <h3 className="text-2xl font-bold mb-3">Agenda que trabaja por vos</h3>
              <ul className="text-app2 space-y-2">
                <li>✓ Tus pacientes se agendan 24/7 desde cualquier dispositivo</li>
                <li>✓ Recordatorios automáticos por email y SMS</li>
                <li>✓ Prevención de cancelaciones y no-shows</li>
                <li>✓ Integración con Google Calendar y Outlook</li>
              </ul>
            </div>

            {/* Feature 2 */}
            <div className="bg-surface border border-app/20 rounded-2xl p-8 hover:border-emerald-500/50 transition-all hover:shadow-lg hover:shadow-emerald-500/10">
              <div className="w-14 h-14 bg-emerald-500/20 rounded-lg flex items-center justify-center text-3xl mb-6">
                💰
              </div>
              <h3 className="text-2xl font-bold mb-3">Finanzas al dedal</h3>
              <ul className="text-app2 space-y-2">
                <li>✓ Facturación automática y seguimiento de pagos</li>
                <li>✓ Reportes de ingresos y egresos en tiempo real</li>
                <li>✓ Alertas de morosidad automáticas</li>
                <li>✓ Integración con métodos de pago</li>
              </ul>
            </div>

            {/* Feature 3 */}
            <div className="bg-surface border border-app/20 rounded-2xl p-8 hover:border-purple-500/50 transition-all hover:shadow-lg hover:shadow-purple-500/10">
              <div className="w-14 h-14 bg-purple-500/20 rounded-lg flex items-center justify-center text-3xl mb-6">
                📋
              </div>
              <h3 className="text-2xl font-bold mb-3">Fichas clínicas modernas</h3>
              <ul className="text-app2 space-y-2">
                <li>✓ Odontograma interactivo y digital</li>
                <li>✓ Historial completo de cada paciente</li>
                <li>✓ Formularios personalizables por especialidad</li>
                <li>✓ Acceso desde cualquier dispositivo</li>
              </ul>
            </div>

            {/* Feature 4 */}
            <div className="bg-surface border border-app/20 rounded-2xl p-8 hover:border-amber-500/50 transition-all hover:shadow-lg hover:shadow-amber-500/10">
              <div className="w-14 h-14 bg-amber-500/20 rounded-lg flex items-center justify-center text-3xl mb-6">
                👥
              </div>
              <h3 className="text-2xl font-bold mb-3">Equipo coordinado</h3>
              <ul className="text-app2 space-y-2">
                <li>✓ Gestión de higienistas y asistentes</li>
                <li>✓ Calendarios compartidos por profesional</li>
                <li>✓ Permisos y roles personalizables</li>
                <li>✓ Comunicación interna integrada</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section id="benefits" className="px-4 py-24 bg-surface border-b border-app/20">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold text-center mb-16">
            ¿Por qué elegir DentalOS?
          </h2>
          
          <div className="space-y-6">
            <div className="flex gap-4 md:gap-6">
              <div className="flex-shrink-0 w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center">
                <span className="text-lg font-bold text-blue-500">⚡</span>
              </div>
              <div>
                <h3 className="text-xl font-bold mb-2">Implementación en minutos</h3>
                <p className="text-app2">No necesitas ser experto en tecnología. En 5 minutos estás operativo. Migramos tu información antigua si lo necesitás.</p>
              </div>
            </div>

            <div className="flex gap-4 md:gap-6">
              <div className="flex-shrink-0 w-12 h-12 bg-emerald-500/20 rounded-lg flex items-center justify-center">
                <span className="text-lg font-bold text-emerald-500">🛡️</span>
              </div>
              <div>
                <h3 className="text-xl font-bold mb-2">Seguridad de nivel médico</h3>
                <p className="text-app2">Cumplimos con todas las normativas de protección de datos. Encriptación de punta a punta. Tus datos son sagrados.</p>
              </div>
            </div>

            <div className="flex gap-4 md:gap-6">
              <div className="flex-shrink-0 w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center">
                <span className="text-lg font-bold text-purple-500">📱</span>
              </div>
              <div>
                <h3 className="text-xl font-bold mb-2">Funciona en cualquier dispositivo</h3>
                <p className="text-app2">Web, tablet, celular. Diseñado para trabajar desde la clínica, desde tu consultorio privado o desde donde estés.</p>
              </div>
            </div>

            <div className="flex gap-4 md:gap-6">
              <div className="flex-shrink-0 w-12 h-12 bg-amber-500/20 rounded-lg flex items-center justify-center">
                <span className="text-lg font-bold text-amber-500">🎯</span>
              </div>
              <div>
                <h3 className="text-xl font-bold mb-2">Soporte humano dedicado</h3>
                <p className="text-app2">No es IA ni chatbots. Nuestro equipo está aquí para ayudarte. Respuesta en menos de 2 horas, siempre.</p>
              </div>
            </div>

            <div className="flex gap-4 md:gap-6">
              <div className="flex-shrink-0 w-12 h-12 bg-pink-500/20 rounded-lg flex items-center justify-center">
                <span className="text-lg font-bold text-pink-500">💡</span>
              </div>
              <div>
                <h3 className="text-xl font-bold mb-2">Siempre en evolución</h3>
                <p className="text-app2">Escuchamos a nuestros usuarios. Las nuevas features salen cada mes según tus necesidades reales.</p>
              </div>
            </div>

            <div className="flex gap-4 md:gap-6">
              <div className="flex-shrink-0 w-12 h-12 bg-cyan-500/20 rounded-lg flex items-center justify-center">
                <span className="text-lg font-bold text-cyan-500">🌱</span>
              </div>
              <div>
                <h3 className="text-xl font-bold mb-2">Crece con tu consultorio</h3>
                <p className="text-app2">Desde consultorio solo hasta clínica con 20 profesionales. La plataforma escala contigo sin problemas.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="px-4 py-24 border-b border-app/20">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold text-center mb-16">
            Comenzá en 10 minutos
          </h2>

          <div className="grid md:grid-cols-4 gap-6">
            {[
              {
                num: '1',
                title: 'Registrate',
                desc: 'Creá tu cuenta con tu email. Es gratis y no te pide tarjeta.'
              },
              {
                num: '2',
                title: 'Configurá tu clínica',
                desc: 'Horarios, servicios, profesionales. Todo personalizable en minutos.'
              },
              {
                num: '3',
                title: 'Tu agenda automática',
                desc: 'Tus pacientes se agendan 24/7 sin que vos tengas que responder.'
              },
              {
                num: '4',
                title: 'Controlá ingresos y ausentismo',
                desc: 'Ve tus ganancias, gastos y métricas de pacientes. Identifica quiénes faltan y evita pérdidas.'
              }
            ].map((step, i) => (
              <div key={i} className="relative group">
                <div className="bg-surface2 border border-app/20 rounded-2xl p-8 h-full flex flex-col group-hover:border-blue-500/50 transition-all">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                      {step.num}
                    </div>
                  </div>
                  <h3 className="text-xl font-bold mb-3">{step.title}</h3>
                  <p className="text-app2 flex-1">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="px-4 py-24 bg-surface border-b border-app/20">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            Precios que tiene sentido
          </h2>
          <p className="text-xl text-app2 mb-16">
            Prueba gratis 10 días completos. Sin sorpresas, sin trampas, sin tarjeta.
          </p>

          <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/10 border-2 border-blue-500/30 rounded-3xl p-12">
            <h3 className="text-3xl font-bold mb-4">Plan todo incluido</h3>
            <p className="text-app2 mb-8">Acceso completo a todas las herramientas</p>
            <p className="text-6xl font-black text-blue-500 mb-2">$0</p>
            <p className="text-app2 mb-8">Primeros 10 días • Después, el mejor precio del mercado.</p>
            
            <div className="bg-white/50 dark:bg-white/10 rounded-xl p-6 mb-8 text-left space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-blue-500 font-bold">✓</span>
                <span className="text-app font-medium">Agenda automática 24/7</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-blue-500 font-bold">✓</span>
                <span className="text-app font-medium">Fichas clínicas digitales con odontograma</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-blue-500 font-bold">✓</span>
                <span className="text-app font-medium">Control de finanzas y facturación</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-blue-500 font-bold">✓</span>
                <span className="text-app font-medium">Gestión de equipo sin límites</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-blue-500 font-bold">✓</span>
                <span className="text-app font-medium">Soporte humano dedicado</span>
              </div>
            </div>

            <Link href="/register" className="inline-block bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-bold px-8 py-4 rounded-lg transition-all transform hover:scale-105 shadow-lg mb-4">
              Comienza tu período gratis ahora
            </Link>
            <p className="text-xs text-app2">No se requiere tarjeta de crédito</p>
          </div>
        </div>
      </section>

      {/* Social Proof / Testimonials Section */}
      <section className="px-4 py-24 border-b border-app/20">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold text-center mb-16">
            Confían en nosotros
          </h2>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-surface border border-app/20 rounded-2xl p-8">
              <div className="flex gap-1 mb-4">
                {[...Array(5)].map((_, i) => (
                  <span key={i} className="text-lg">⭐</span>
                ))}
              </div>
              <p className="text-app2 mb-6">
                "Cambió completamente cómo trabajo. Ya no me llaman por teléfono, mis pacientes se autoagiendan. Una maravilla."
              </p>
              <p className="font-bold">Dra. María García</p>
              <p className="text-sm text-app2">Clínica Privada, CABA</p>
            </div>

            <div className="bg-surface border border-app/20 rounded-2xl p-8">
              <div className="flex gap-1 mb-4">
                {[...Array(5)].map((_, i) => (
                  <span key={i} className="text-lg">⭐</span>
                ))}
              </div>
              <p className="text-app2 mb-6">
                "Las fichas digitales con odontograma son exactamente lo que necesitaba. Muy profesional y fácil de usar."
              </p>
              <p className="font-bold">Dr. Carlos López</p>
              <p className="text-sm text-app2">Consultorio en Flores</p>
            </div>

            <div className="bg-surface border border-app/20 rounded-2xl p-8">
              <div className="flex gap-1 mb-4">
                {[...Array(5)].map((_, i) => (
                  <span key={i} className="text-lg">⭐</span>
                ))}
              </div>
              <p className="text-app2 mb-6">
                "El control de finanzas es clarito. Sé exactamente cuánto gano, cuánto gasté y quién no pagó. Imprescindible."
              </p>
              <p className="font-bold">Dra. Silvina Rodríguez</p>
              <p className="text-sm text-app2">Centro Odontológico</p>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="px-4 py-24 bg-gradient-to-r from-blue-500/20 to-blue-600/20 border-b border-app/20">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            ¿Listo para dejar de complicarte la vida?
          </h2>
          <p className="text-xl text-app2 mb-8 leading-relaxed">
            Cientos de odontólogos ya están gestionando sus consultorios de forma más inteligente. 
            Tu turno es ahora. Prueba gratis, sin compromisos. Si no te gusta, simplemente no pagas nada.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register" className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-bold px-8 py-4 rounded-lg transition-all transform hover:scale-105 shadow-lg">
              ¡Quiero mis 10 días gratis!
            </Link>
            <a href="#features" className="border-2 border-blue-500 text-blue-500 hover:bg-blue-500/10 font-bold px-8 py-4 rounded-lg transition-all">
              Ver más detalles
            </a>
          </div>
          <p className="text-sm text-app2 mt-8">💡 Tip: Los que empiezan hoy están 30 días adelante a fin de año</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-app/20">
        <div className="max-w-6xl mx-auto px-4 py-16">
          <div className="grid md:grid-cols-4 gap-12 mb-8">
            <div>
              <h3 className="text-2xl font-bold mb-4">
                Dental<span className="text-blue-500">OS</span>
              </h3>
              <p className="text-app2 text-sm">La gestión de tu consultorio, simplificada.</p>
            </div>
            <div>
              <h4 className="font-bold text-sm mb-4 uppercase tracking-wide">Producto</h4>
              <ul className="space-y-2 text-sm text-app2">
                <li><a href="#features" className="hover:text-app transition-colors">Funcionalidades</a></li>
                <li><a href="#benefits" className="hover:text-app transition-colors">Beneficios</a></li>
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
              <a href="#" className="text-app2 hover:text-app transition-colors text-sm">Twitter</a>
              <a href="#" className="text-app2 hover:text-app transition-colors text-sm">LinkedIn</a>
              <a href="#" className="text-app2 hover:text-app transition-colors text-sm">Instagram</a>
            </div>
          </div>
        </div>
      </footer>

      {/* Login Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-app rounded-2xl w-full max-w-md p-8">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-app">
                Dental<span className="text-blue-400">OS</span>
              </h1>
              <p className="text-app2 mt-2">Ingresá a tu consultorio</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-app2 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full bg-surface2 border border-app rounded-lg px-4 py-3 text-app focus:outline-none focus:border-blue-400"
                  placeholder="dr@consultorio.com"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-app2 mb-2">
                  Contraseña
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full bg-surface2 border border-app rounded-lg px-4 py-3 text-app focus:outline-none focus:border-blue-400"
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
                className="w-full bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition-colors"
              >
                {loading ? 'Ingresando...' : 'Ingresar'}
              </button>

              <div className="text-center">
                <p className="text-app2 text-sm">
                  ¿No tenés cuenta?{' '}
                  <Link href="/register" className="text-blue-400 hover:text-blue-300 transition-colors">
                    Registrate aquí
                  </Link>
                </p>
              </div>
            </form>

            <button
              onClick={() => setShowLoginModal(false)}
              className="absolute top-4 right-4 text-app2 hover:text-app transition-colors"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  )
}