'use client'

import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { apiFetch } from '@/lib/api'
import { useAppTheme } from '../providers'
import { useState, useEffect } from 'react'
import { Plus_Jakarta_Sans } from 'next/font/google'
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  CreditCard,
  UserPlus,
  Sun,
  Moon,
  LogOut,
} from 'lucide-react'

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
})

const NAV_ITEMS = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Inicio' },
  { href: '/dashboard/agenda', icon: CalendarDays, label: 'Agenda' },
  { href: '/dashboard/patients', icon: Users, label: 'Pacientes' },
  { href: '/dashboard/payments', icon: CreditCard, label: 'Estadísticas' },
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
  const [inviteLink, setInviteLink] = useState<string | null>(null)
  const [linkCopied, setLinkCopied] = useState(false)

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
      const link: string = res.data.link
      setInviteLink(link)
      try {
        await navigator.clipboard.writeText(link)
        setLinkCopied(true)
      } catch {
        setLinkCopied(false)
      }
      setShowInviteSuccess(true)
      setCopyState('idle')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al generar el link'
      setErrorMessage(msg)
      setCopyState('idle')
    }
  }

  async function handleCopyLinkManual() {
    if (!inviteLink) return
    try {
      await navigator.clipboard.writeText(inviteLink)
      setLinkCopied(true)
    } catch {
      // si aún falla, el usuario puede seleccionar el texto manualmente
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/')
  }

  function isActive(href: string) {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname.startsWith(href)
  }

  return (
    <div className={`${jakarta.className} min-h-screen bg-app flex`}>

      {/* ── SIDEBAR — desktop ───────────────────────────────────── */}
      <aside className="hidden md:flex flex-col w-56 flex-shrink-0 bg-surface border-r border-app sticky top-0 h-screen">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-app">
          <span className="text-xl font-extrabold tracking-tight text-app">
            Dental<span className="text-[#00C4BC]">OS</span>
          </span>
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV_ITEMS.map(item => {
            const Icon = item.icon
            const active = isActive(item.href)
            return (
              <button
                key={item.href}
                onClick={() => router.push(item.href)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  active
                    ? 'bg-[#E6F8F1] text-[#00C4BC]'
                    : 'text-app2 hover:bg-surface2 hover:text-app'
                }`}
              >
                <Icon size={18} strokeWidth={active ? 2.2 : 1.8} />
                {item.label}
              </button>
            )
          })}
        </nav>

        {/* Bottom actions */}
        <div className="px-3 py-4 border-t border-app space-y-1">
          <button
            onClick={handleCopyInviteLink}
            disabled={copyState === 'loading'}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-app2 hover:bg-surface2 hover:text-app disabled:opacity-50 transition-all"
          >
            <UserPlus size={18} strokeWidth={1.8} />
            {copyState === 'loading' ? 'Generando...' : 'Invitar profesional'}
          </button>

          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-app2 hover:bg-surface2 hover:text-app transition-all"
          >
            {mounted
              ? theme === 'dark'
                ? <Sun size={18} strokeWidth={1.8} />
                : <Moon size={18} strokeWidth={1.8} />
              : <Sun size={18} strokeWidth={1.8} />
            }
            {mounted ? (theme === 'dark' ? 'Modo claro' : 'Modo oscuro') : 'Modo claro'}
          </button>

          <button
            onClick={() => setShowLogoutModal(true)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-app2 hover:bg-surface2 hover:text-app transition-all"
          >
            <LogOut size={18} strokeWidth={1.8} />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* ── MOBILE TOP BAR ──────────────────────────────────────── */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 flex border-b border-app bg-surface px-4 py-3 items-center justify-between">
        <span className="text-lg font-extrabold tracking-tight text-app">
          Dental<span className="text-[#00C4BC]">OS</span>
        </span>
        <div className="flex items-center gap-3">
          <button
            onClick={handleCopyInviteLink}
            disabled={copyState === 'loading'}
            className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-[#00C4BC]/40 text-[#00C4BC] hover:bg-[#E6F8F1] disabled:opacity-50 transition-colors"
          >
            <UserPlus size={14} strokeWidth={1.8} />
            {copyState === 'loading' ? '...' : copyState === 'copied' ? '¡Copiado!' : ''}
          </button>
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="text-app3 hover:text-app transition-colors"
          >
            {mounted
              ? theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />
              : <Sun size={18} />
            }
          </button>
          <button
            onClick={() => setShowLogoutModal(true)}
            className="text-app3 hover:text-app transition-colors"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>

      {/* ── CONTENIDO ───────────────────────────────────────────── */}
      <main className="flex-1 min-w-0 pb-20 md:pb-0 pt-14 md:pt-0">
        {children}
      </main>

      {/* ── BOTTOM NAV — mobile ─────────────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-surface border-t border-app z-40">
        <div className="grid grid-cols-4">
          {NAV_ITEMS.map(item => {
            const Icon = item.icon
            const active = isActive(item.href)
            return (
              <button
                key={item.href}
                onClick={() => router.push(item.href)}
                className={`flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors ${
                  active ? 'text-[#00C4BC]' : 'text-app3'
                }`}
              >
                <Icon size={22} strokeWidth={active ? 2.2 : 1.8} />
                <span>{item.label}</span>
              </button>
            )
          })}
        </div>
      </nav>

      {showInviteSuccess && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-app rounded-2xl w-full max-w-sm p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-[#E6F8F1] flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">🔗</span>
            </div>
            <h3 className="font-bold text-lg text-app mb-2">
              {linkCopied ? '¡Link copiado!' : 'Link generado'}
            </h3>
            <p className="text-app3 text-sm mb-4">
              Compartí este link con el profesional que querés invitar. Una vez que se una a tu clínica, podrá:
            </p>
            <ul className="text-left text-sm text-app3 space-y-2 mb-4">
              <li className="flex items-center gap-2"><span className="text-[#00C4BC]">📅</span> Ver y gestionar la agenda</li>
              <li className="flex items-center gap-2"><span className="text-[#00C4BC]">👥</span> Compartir y acceder a los pacientes</li>
              <li className="flex items-center gap-2"><span className="text-[#00C4BC]">💰</span> Ver las finanzas de la clínica</li>
            </ul>
            {inviteLink && (
              <div className="mb-4">
                <div className="flex items-center gap-2 bg-surface2 rounded-xl px-3 py-2 text-left">
                  <span className="text-xs text-app3 truncate flex-1 font-mono select-all">{inviteLink}</span>
                  <button
                    onClick={handleCopyLinkManual}
                    className="shrink-0 text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
                  >
                    {linkCopied ? '✓' : 'Copiar'}
                  </button>
                </div>
              </div>
            )}
            <button
              onClick={() => { setShowInviteSuccess(false); setInviteLink(null); setLinkCopied(false) }}
              className="w-full bg-[#00C4BC] hover:bg-[#00aaa3] active:scale-95 text-white font-semibold py-3 rounded-xl transition-all"
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