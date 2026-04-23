'use client'

import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { apiFetch } from '@/lib/api'
import { useAppTheme } from '../providers'
import { useState, useEffect } from 'react'

const NAV_ITEMS = [
  { href: '/dashboard', icon: '📊', label: 'Inicio' },
  { href: '/dashboard/agenda', icon: '📅', label: 'Agenda' },
  { href: '/dashboard/patients', icon: '👥', label: 'Pacientes' },
  { href: '/dashboard/payments', icon: '💰', label: 'Finanzas' },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const { theme, setTheme } = useAppTheme()
  const [mounted, setMounted] = useState(false)
  const [showLogoutModal, setShowLogoutModal] = useState(false)
  const [copyState, setCopyState] = useState<'idle' | 'loading' | 'copied' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [showInviteSuccess, setShowInviteSuccess] = useState(false)

  useEffect(() => {
    setMounted(true)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        router.push('/')
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  async function handleCopyInviteLink() {
    setCopyState('loading')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('No session')
      const res = await apiFetch('/professionals/invite', {
        method: 'POST',
        token: session.access_token,
        body: JSON.stringify({ role: 'professional' }),
      })
      await navigator.clipboard.writeText(res.data.link)
      setShowInviteSuccess(true)
      setCopyState('idle')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al generar el link'
      setErrorMessage(msg)
      setCopyState('idle')
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/')
  }

  // Determinar ítem activo
  function isActive(href: string) {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname.startsWith(href)
  }

  return (
    <div className="min-h-screen bg-app flex flex-col">

      {/* TOP BAR — desktop */}
      <header className="hidden md:flex border-b border-app bg-app px-6 py-0 items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-1">
          <div className="text-xl font-bold text-app mr-6 py-4">
            Dental<span className="text-emerald-400">OS</span>
          </div>
          {NAV_ITEMS.map(item => (
            <button
              key={item.href}
              onClick={() => router.push(item.href)}
              className={`flex items-center gap-2 px-4 py-4 text-sm font-medium border-b-2 transition-colors ${isActive(item.href)
                ? 'border-emerald-400 text-emerald-400'
                : 'border-transparent text-app2 hover:text-app'
                }`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleCopyInviteLink}
            disabled={copyState === 'loading'}
            className="text-xs font-medium px-3 py-1.5 rounded-lg border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-50 transition-colors"
          >
            {copyState === 'loading' && 'Generando...'}
            {copyState === 'copied'  && '¡Link copiado!'}
            {copyState === 'error'   && 'Error, reintentá'}
            {copyState === 'idle'    && '🔗 Invitar profesional'}
          </button>
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="text-sm text-app3 hover:text-app transition-colors"
          >
            {mounted ? (theme === 'dark' ? '☀️' : '🌙') : '☀️'}
          </button>
          <button
            onClick={() => setShowLogoutModal(true)}
            className="text-sm text-app3 hover:text-app transition-colors"
          >
            Salir
          </button>
        </div>
      </header>

      {/* MOBILE TOP BAR */}
      <header className="md:hidden flex border-b border-app bg-app px-4 py-3 items-center justify-between sticky top-0 z-40">
        <div className="text-lg font-bold text-app">
          Dental<span className="text-emerald-400">OS</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleCopyInviteLink}
            disabled={copyState === 'loading'}
            className="text-xs font-medium px-2 py-1.5 rounded-lg border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-50 transition-colors"
          >
            {copyState === 'copied' ? '¡Copiado!' : copyState === 'error' ? 'Error' : '🔗'}
          </button>
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="text-sm text-app3 hover:text-app transition-colors"
          >
            {mounted ? (theme === 'dark' ? '☀️' : '🌙') : '☀️'}
          </button>
          <button
            onClick={() => setShowLogoutModal(true)}
            className="text-sm text-app3 hover:text-app transition-colors"
          >
            Salir
          </button>
        </div>
      </header>

      {/* CONTENIDO */}
      <main className="flex-1 pb-20 md:pb-0">
        {children}
      </main>

      {/* BOTTOM NAV — mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-surface border-t border-app z-40">
        <div className="grid grid-cols-4">
          {NAV_ITEMS.map(item => (
            <button
              key={item.href}
              onClick={() => router.push(item.href)}
              className={`flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors ${isActive(item.href)
                ? 'text-emerald-400'
                : 'text-app3'
                }`}
            >
              <span className="text-xl">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </nav>

      {showInviteSuccess && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-app rounded-2xl w-full max-w-sm p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">🔗</span>
            </div>
            <h3 className="font-bold text-lg text-app mb-2">¡Link copiado!</h3>
            <p className="text-app3 text-sm mb-4">
              Compartí este link con el profesional que querés invitar. Una vez que se una a tu clínica, podrá:
            </p>
            <ul className="text-left text-sm text-app3 space-y-2 mb-6">
              <li className="flex items-center gap-2"><span className="text-emerald-400">📅</span> Ver y gestionar la agenda</li>
              <li className="flex items-center gap-2"><span className="text-emerald-400">👥</span> Compartir y acceder a los pacientes</li>
              <li className="flex items-center gap-2"><span className="text-emerald-400">💰</span> Ver las finanzas de la clínica</li>
            </ul>
            <button
              onClick={() => setShowInviteSuccess(false)}
              className="w-full bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-white font-semibold py-3 rounded-xl transition-all"
            >
              Entendido
            </button>
          </div>
        </div>
      )}

      {errorMessage && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-app rounded-2xl w-full max-w-sm p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">⚠️</span>
            </div>
            <h3 className="font-bold text-lg text-app mb-2">Sin permiso</h3>
            <p className="text-app3 text-sm mb-6">
              {errorMessage === 'Only owner or admin can generate invite links'
                ? 'Solo el dueño o un administrador pueden generar links de invitación.'
                : errorMessage}
            </p>
            <button
              onClick={() => setErrorMessage(null)}
              className="w-full bg-surface2 hover:bg-surface3 active:scale-95 text-app font-semibold py-3 rounded-xl transition-all"
            >
              Entendido
            </button>
          </div>
        </div>
      )}

      {showLogoutModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-app rounded-2xl w-full max-w-sm p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-surface2 flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">👋</span>
            </div>
            <h3 className="font-bold text-lg text-app mb-2">¿Cerrar sesión?</h3>
            <p className="text-app3 text-sm mb-6">
              Vas a salir de DentalOS. Podés volver a entrar cuando quieras.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowLogoutModal(false)}
                className="flex-1 bg-surface2 hover:bg-surface3 active:scale-95 text-app font-semibold py-3 rounded-xl transition-all">
                Cancelar
              </button>
              <button
                onClick={handleLogout}
                className="flex-1 bg-red-600 hover:bg-red-500 active:scale-95 text-white font-bold py-3 rounded-xl transition-all">
                Salir
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}