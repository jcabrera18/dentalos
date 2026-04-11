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
    <div className="min-h-screen bg-gradient-to-br from-app via-app to-surface2 text-app flex flex-col">
      {/* Navbar */}
      <nav className="border-b border-app/20 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold">
            Dental<span className="text-blue-400">OS</span>
          </Link>
          <div className="flex items-center gap-4">
            <a href="#features" className="text-app2 hover:text-app transition-colors">
              Funcionalidades
            </a>
            <button
              onClick={() => setShowLoginModal(true)}
              className="text-app2 hover:text-app transition-colors"
            >
              Ingresar
            </button>
            <Link href="/register" className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors">
              Registrarse
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="flex items-center justify-center px-4 py-20">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-5xl sm:text-6xl font-bold mb-6">
            Gestión integral de tu consultorio odontológico
          </h1>
          <p className="text-xl text-app2 mb-8">
            Automatizá tu agenda, controlá tus finanzas, gestioná turnos y fichas clínicas con odontograma. Todo en un solo lugar.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register" className="bg-blue-500 hover:bg-blue-600 text-white font-semibold px-8 py-4 rounded-lg transition-colors">
              Probar 10 días gratis
            </Link>
            <a href="#features" className="border border-blue-500/50 text-blue-400 hover:bg-blue-500/10 font-semibold px-8 py-4 rounded-lg transition-colors">
              Ver funcionalidades ↓
            </a>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="px-4 py-20 border-t border-app/20">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl font-bold text-center mb-16">
            Todo lo que tu consultorio necesita
          </h2>
          
          <div className="grid md:grid-cols-2 gap-8 mb-12">
            {/* Feature: Agenda */}
            <div className="bg-surface border border-app/20 rounded-2xl p-8 hover:border-blue-500/50 transition-all hover:shadow-lg hover:shadow-blue-500/10">
              <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center text-2xl mb-4">
                📅
              </div>
              <h3 className="text-2xl font-bold mb-3">Agenda Automatizada</h3>
              <p className="text-app2">
                Tus pacientes se agendan solos desde cualquier dispositivo. Sin llamadas, sin WhatsApp, sin confusiones.
              </p>
            </div>

            {/* Feature: Finanzas */}
            <div className="bg-surface border border-app/20 rounded-2xl p-8 hover:border-emerald-500/50 transition-all hover:shadow-lg hover:shadow-emerald-500/10">
              <div className="w-12 h-12 bg-emerald-500/20 rounded-lg flex items-center justify-center text-2xl mb-4">
                💰
              </div>
              <h3 className="text-2xl font-bold mb-3">Control Financiero</h3>
              <p className="text-app2">
                Llevá el control de ingresos, egresos y facturación de tu consultorio de forma simple y clara.
              </p>
            </div>

            {/* Feature: Fichas */}
            <div className="bg-surface border border-app/20 rounded-2xl p-8 hover:border-purple-500/50 transition-all hover:shadow-lg hover:shadow-purple-500/10">
              <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center text-2xl mb-4">
                📋
              </div>
              <h3 className="text-2xl font-bold mb-3">Fichas y Odontograma</h3>
              <p className="text-app2">
                Fichas clínicas digitales completas con odontograma interactivo para cada paciente.
              </p>
            </div>

            {/* Feature: Gestión */}
            <div className="bg-surface border border-app/20 rounded-2xl p-8 hover:border-amber-500/50 transition-all hover:shadow-lg hover:shadow-amber-500/10">
              <div className="w-12 h-12 bg-amber-500/20 rounded-lg flex items-center justify-center text-2xl mb-4">
                👥
              </div>
              <h3 className="text-2xl font-bold mb-3">Gestión de Turnos</h3>
              <p className="text-app2">
                Organizá los turnos de todo tu equipo. Visualizá disponibilidad y evitá superposiciones.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Steps Section */}
      <section className="px-4 py-20 border-t border-app/20">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl font-bold text-center mb-16">
            Comenzá en 4 simples pasos
          </h2>

          <div className="grid md:grid-cols-4 gap-6">
            {[
              {
                num: '01',
                title: 'Registrate',
                desc: 'Creá tu cuenta y configurá tu consultorio en minutos.'
              },
              {
                num: '02',
                title: 'Personalizá',
                desc: 'Configurá tus horarios, servicios y equipo de trabajo.'
              },
              {
                num: '03',
                title: 'Compartí',
                desc: 'Compartí el link de tu agenda para que tus pacientes se agenden solos.'
              },
              {
                num: '04',
                title: 'Gestioná',
                desc: 'Controlá turnos, fichas clínicas y finanzas desde un solo panel.'
              }
            ].map((step, i) => (
              <div key={i} className="relative">
                {i < 3 && (
                  <div className="hidden md:block absolute top-12 left-1/2 w-1/2 h-0.5 bg-gradient-to-r from-blue-500/50 to-transparent" />
                )}
                <div className="bg-surface border border-app/20 rounded-2xl p-8 h-full flex flex-col">
                  <div className="flex items-end gap-3 mb-6">
                    <div className="text-4xl font-bold text-blue-400">{step.num}</div>
                    <div className="h-0.5 bg-blue-400 flex-1" />
                  </div>
                  <h3 className="text-xl font-bold mb-3">{step.title}</h3>
                  <p className="text-app2 flex-1">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-4 py-20 border-t border-app/20">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-4xl font-bold mb-6">
            Llevá tu consultorio al siguiente nivel
          </h2>
          <p className="text-xl text-app2 mb-8">
            Probalo 10 días gratis, sin suscripción ni tarjeta. <br />
            Luego decides si es para vos.
          </p>
          <Link href="/register" className="inline-block bg-blue-500 hover:bg-blue-600 text-white font-semibold px-8 py-4 rounded-lg transition-colors">
            Probar 10 días gratis
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-app/20 mt-auto">
        <div className="max-w-6xl mx-auto px-4 py-12">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <div className="text-2xl font-bold mb-4 md:mb-0">
              Dental<span className="text-blue-400">OS</span>
            </div>
            <div className="text-app2 text-sm">
              © 2026 DentalOS. Todos los derechos reservados.
            </div>
            <div className="flex gap-6 mt-4 md:mt-0">
              <Link href="/" className="text-app2 hover:text-app transition-colors">
                Inicio
              </Link>
              <a href="#features" className="text-app2 hover:text-app transition-colors">
                Funcionalidades
              </a>
              <button
                onClick={() => setShowLoginModal(true)}
                className="text-app2 hover:text-app transition-colors"
              >
                Ingresar
              </button>
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