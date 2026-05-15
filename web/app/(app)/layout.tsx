'use client'

import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import type { AuthChangeEvent, AuthResponse, Session } from '@supabase/supabase-js'
import { apiFetch } from '@/lib/api'
import { useAppTheme, PlansModalProvider } from '../providers'
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
  AlertTriangle,
  Clock,
  Settings,
} from 'lucide-react'
import { useSubscription, invalidateSubscriptionCache } from '@/lib/useSubscription'

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
})

const NAV_ITEMS = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Inicio' },
  { href: '/agenda', icon: CalendarDays, label: 'Agenda' },
  { href: '/patients', icon: Users, label: 'Pacientes' },
  { href: '/payments', icon: CreditCard, label: 'Estadísticas' },
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
  const { data: subscription, refetch: refetchSubscription } = useSubscription()
  const [showPlansModal, setShowPlansModal] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<'starter' | 'growth' | 'scale' | null>(null)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [qrInitPoint, setQrInitPoint] = useState<string | null>(null)
  const [qrLoading, setQrLoading] = useState(false)
  const [qrError, setQrError] = useState<string | null>(null)
  const [paymentConfirmed, setPaymentConfirmed] = useState(false)

  const PLAN_KEY_MAP: Record<string, 'starter' | 'growth' | 'scale'> = {
    basic: 'starter',
    pro: 'growth',
    clinic: 'scale',
    enterprise: 'scale',
  }

  function openRenewalModal() {
    const key = subscription?.plan ? (PLAN_KEY_MAP[subscription.plan] ?? 'growth') : 'growth'
    setSelectedPlan(key)
    setShowPlansModal(true)
  }

  const PLANS = [
    {
      key: 'starter' as const,
      name: 'Starter',
      price: '$38.000',
      description: 'Ordená tu consultorio desde el día 1',
      features: ['Agenda y turnos online', 'Historia clínica con odontograma', 'Hasta 100 pacientes', '1 profesional', 'Soporte en español'],
      highlight: false,
    },
    {
      key: 'growth' as const,
      name: 'Growth',
      price: '$58.000',
      description: 'Dejá de perder pacientes y llená tu agenda',
      features: ['Todo lo de Starter', 'Pacientes ilimitados', 'Hasta 3 profesionales', '500 recordatorios WhatsApp/mes', 'Confirmación automática de turnos', 'Soporte prioritario'],
      highlight: true,
    },
    {
      key: 'scale' as const,
      name: 'Scale',
      price: '$95.000',
      description: 'Gestioná tu clínica como una empresa',
      features: ['Todo lo de Growth', 'Profesionales ilimitados', '2.000 recordatorios WhatsApp/mes', 'Reportes avanzados', 'Onboarding personalizado', 'Soporte dedicado'],
      highlight: false,
    },
  ]

  useEffect(() => {
    setMounted(true)

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
      // Solo redirigir si la sesión realmente terminó (no durante hidratación)
      if (event === 'SIGNED_OUT' && !session) {
        setTimeout(() => router.push('/'), 100)
      }
    })

    // Refrescar token cuando el usuario vuelve de suspensión/background
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        supabase.auth.getSession().then((result: Awaited<ReturnType<typeof supabase.auth.getSession>>) => {
          const session = result.data.session
          if (!session) return
          const nowSecs = Math.floor(Date.now() / 1000)
          const expiresAt = session.expires_at ?? 0
          if (expiresAt - nowSecs < 300) {
            supabase.auth.refreshSession()
          }
        })
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      subscription.unsubscribe()
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [])

  useEffect(() => {
    if (!selectedPlan) {
      setQrDataUrl(null)
      setQrInitPoint(null)
      setQrError(null)
      setPaymentConfirmed(false)
      return
    }

    let cancelled = false
    setQrLoading(true)
    setQrDataUrl(null)
    setQrInitPoint(null)
    setQrError(null)

    async function generateQr() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) throw new Error('Sin sesión')

        const res = await apiFetch('/mercadopago/preference', {
          method: 'POST',
          token: session.access_token,
          body: JSON.stringify({ plan: selectedPlan }),
        })

        const url = process.env.NODE_ENV === 'production'
          ? res.init_point
          : (res.sandbox_init_point ?? res.init_point)

        if (!cancelled) setQrInitPoint(url)

        if (res.qr_data) {
          const QRCode = (await import('qrcode')).default
          const dataUrl = await QRCode.toDataURL(res.qr_data, { width: 208, margin: 1 })
          if (!cancelled) setQrDataUrl(dataUrl)
        }
      } catch (err) {
        if (!cancelled) setQrError('No se pudo generar el QR. Intentá de nuevo.')
      } finally {
        if (!cancelled) setQrLoading(false)
      }
    }

    generateQr()
    return () => { cancelled = true }
  }, [selectedPlan])

  // Polling: verifica cada 4s si el pago fue confirmado mientras el modal está abierto
  useEffect(() => {
    if (!qrInitPoint || paymentConfirmed) return

    const check = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return
        const res = await apiFetch('/subscription/status', { token: session.access_token })
        if (res.status === 'active' && !res.alerts?.accessBlocked) {
          invalidateSubscriptionCache()
          await refetchSubscription()
          setPaymentConfirmed(true)
        }
      } catch { /* silencioso */ }
    }

    const interval = setInterval(check, 4000)
    return () => clearInterval(interval)
  }, [qrInitPoint, paymentConfirmed])

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
    <PlansModalProvider openPlansModal={() => { setSelectedPlan(null); setShowPlansModal(true) }}>
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
            onClick={() => router.push('/settings')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
              isActive('/settings') ? 'bg-[#E6F8F1] text-[#00C4BC]' : 'text-app2 hover:bg-surface2 hover:text-app'
            }`}
          >
            <Settings size={18} strokeWidth={isActive('/settings') ? 2.2 : 1.8} />
            Configuración
          </button>

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

        {/* Banner: trial por vencer (≤7 días) */}
        {subscription?.alerts.showTrialBanner && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-amber-800 text-sm">
              <Clock size={15} className="flex-shrink-0" />
              <span>
                Tu período de prueba vence en{' '}
                <strong>{subscription.trial.daysLeft} {subscription.trial.daysLeft === 1 ? 'día' : 'días'}</strong>.
                Elegí un plan para seguir usando DentalOS.
              </span>
            </div>
            <button
              onClick={() => { setSelectedPlan(null); setShowPlansModal(true) }}
              className="text-xs font-bold text-amber-800 bg-amber-200 hover:bg-amber-300 px-3 py-1 rounded-lg transition-colors flex-shrink-0"
            >
              Ver planes
            </button>
          </div>
        )}

        {/* Banner: suscripción por vencer (≤7 días) */}
        {subscription?.alerts.showRenewalBanner && (
          <div className="bg-orange-50 border-b border-orange-200 px-4 py-2.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-orange-800 text-sm">
              <AlertTriangle size={15} className="flex-shrink-0" />
              <span>
                Tu suscripción vence en{' '}
                <strong>{subscription.subscription.daysLeft} {subscription.subscription.daysLeft === 1 ? 'día' : 'días'}</strong>.
                Renovála para no perder el acceso.
              </span>
            </div>
            <button
              onClick={openRenewalModal}
              className="text-xs font-bold text-orange-800 bg-orange-200 hover:bg-orange-300 px-3 py-1 rounded-lg transition-colors flex-shrink-0"
            >
              Renovar
            </button>
          </div>
        )}

        {/* Wall: acceso bloqueado (trial o sub vencidos) */}
        {subscription?.alerts.accessBlocked ? (
          <div className="flex items-center justify-center min-h-[calc(100vh-56px)] p-6">
            <div className="bg-white border border-[#E5E7EB] rounded-3xl max-w-md w-full p-10 text-center shadow-xl">
              <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-5">
                <AlertTriangle size={28} className="text-red-500" />
              </div>
              <h2 className="text-2xl font-extrabold text-[#0F1720] mb-2">
                {subscription.trial.expired
                  ? 'Tu período de prueba venció'
                  : 'Tu suscripción venció'}
              </h2>
              <p className="text-[#6B7280] text-sm mb-7">
                {subscription.trial.expired
                  ? 'Los 14 días de prueba terminaron. Elegí un plan para volver a acceder a tu consultorio.'
                  : 'Tu suscripción expiró. Renovála para seguir gestionando tu consultorio sin interrupciones.'}
              </p>
              <button
                onClick={() => subscription?.trial.expired
                  ? (() => { setSelectedPlan(null); setShowPlansModal(true) })()
                  : openRenewalModal()
                }
                className="block w-full bg-[#00C4BC] hover:bg-[#00aaa3] text-white font-bold py-4 rounded-xl transition-all text-center shadow-lg shadow-[#00C4BC]/20 mb-3"
              >
                {subscription?.trial.expired ? 'Ver planes y precios' : 'Renovar suscripción'}
              </button>
              <button
                onClick={handleLogout}
                className="block w-full text-[#6B7280] hover:text-[#0F1720] text-sm transition-colors py-2"
              >
                Cerrar sesión
              </button>
            </div>
          </div>
        ) : (
          children
        )}

      </main>

      {/* ── BOTTOM NAV — mobile ─────────────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-surface border-t border-app z-40">
        <div className="grid grid-cols-5">
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
          <button
            onClick={() => router.push('/settings')}
            className={`flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors ${
              isActive('/settings') ? 'text-[#00C4BC]' : 'text-app3'
            }`}
          >
            <Settings size={22} strokeWidth={isActive('/settings') ? 2.2 : 1.8} />
            <span>Config.</span>
          </button>
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

      {/* ── MODAL: Elegir plan ──────────────────────────────────── */}
      {showPlansModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl">

            {/* Header */}
            <div className="flex items-center justify-between px-8 pt-8 pb-4">
              <div>
                <h2 className="text-2xl font-extrabold text-[#0F1720]">
                  {selectedPlan ? 'Completar suscripción' : 'Elegí tu plan'}
                </h2>
                <p className="text-sm text-[#6B7280] mt-0.5">
                  {selectedPlan ? 'Escaneá el QR con tu app bancaria o de pago' : 'Con solo 1 paciente recuperado por mes, DentalOS se paga solo.'}
                </p>
              </div>
              <button
                onClick={() => { setShowPlansModal(false); setSelectedPlan(null) }}
                className="w-9 h-9 rounded-full bg-[#F3F4F6] hover:bg-[#E5E7EB] flex items-center justify-center text-[#6B7280] transition-colors flex-shrink-0"
              >
                ✕
              </button>
            </div>

            {/* Step 1: selección de plan */}
            {!selectedPlan && (
              <div className="px-8 pb-8">
                <div className="grid md:grid-cols-3 gap-4">
                  {PLANS.map(plan => (
                    <button
                      key={plan.key}
                      onClick={() => setSelectedPlan(plan.key)}
                      className={`text-left rounded-2xl p-6 border-2 transition-all hover:shadow-md ${
                        plan.highlight
                          ? 'border-[#00C4BC] shadow-lg shadow-[#00C4BC]/10'
                          : 'border-[#E5E7EB] hover:border-[#00C4BC]/40'
                      }`}
                    >
                      {plan.highlight && (
                        <span className="inline-block bg-[#00C4BC] text-white text-xs font-bold px-3 py-0.5 rounded-full mb-3">
                          Más elegido
                        </span>
                      )}
                      <p className="text-xs font-bold text-[#6B7280] uppercase tracking-widest mb-0.5">{plan.name}</p>
                      <p className="text-3xl font-extrabold text-[#0F1720] mb-0.5">{plan.price}</p>
                      <p className="text-xs text-[#6B7280] mb-4">ARS / mes</p>
                      <p className="text-xs text-[#6B7280] italic mb-4">{plan.description}</p>
                      <ul className="space-y-2">
                        {plan.features.map((f, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs text-[#0F1720]">
                            <span className="text-[#00C4BC] font-bold mt-px flex-shrink-0">✓</span>
                            {f}
                          </li>
                        ))}
                      </ul>
                      <div className={`mt-5 w-full py-2.5 rounded-xl text-sm font-bold text-center transition-colors ${
                        plan.highlight
                          ? 'bg-[#00C4BC] text-white'
                          : 'bg-[#F3F4F6] text-[#0F1720]'
                      }`}>
                        Elegir {plan.name}
                      </div>
                    </button>
                  ))}
                </div>
                <p className="text-center text-xs text-[#6B7280] mt-5">
                  Mensajes WhatsApp adicionales disponibles en packs.
                </p>
              </div>
            )}

            {/* Step 2: QR de pago */}
            {selectedPlan && (() => {
              const plan = PLANS.find(p => p.key === selectedPlan)!
              return (
                <div className="px-8 pb-8">

                  {/* Pago confirmado */}
                  {paymentConfirmed && (
                    <div className="flex flex-col items-center text-center py-8 gap-4">
                      <div className="w-16 h-16 rounded-full bg-[#00C4BC]/10 flex items-center justify-center">
                        <svg className="w-8 h-8 text-[#00C4BC]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-xl font-extrabold text-[#0F1720]">¡Pago recibido!</p>
                        <p className="text-sm text-[#6B7280] mt-1">Tu plan <span className="font-semibold text-[#0F1720]">{plan.name}</span> ya está activo.</p>
                      </div>
                      <button
                        onClick={() => { setShowPlansModal(false); setSelectedPlan(null) }}
                        className="mt-2 bg-[#00C4BC] hover:bg-[#00aaa3] text-white font-bold px-8 py-3 rounded-xl transition-colors"
                      >
                        Continuar
                      </button>
                    </div>
                  )}

                  {!paymentConfirmed && (
                  <>
                  <div className="flex flex-col md:flex-row gap-8 items-start">

                    {/* Resumen del plan elegido */}
                    <div className="flex-1 bg-[#F3F4F6] rounded-2xl p-6">
                      <p className="text-xs font-bold text-[#6B7280] uppercase tracking-widest mb-1">{plan.name}</p>
                      <p className="text-3xl font-extrabold text-[#0F1720] mb-0.5">{plan.price}</p>
                      <p className="text-xs text-[#6B7280] mb-4">ARS / mes</p>
                      <ul className="space-y-2">
                        {plan.features.map((f, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs text-[#0F1720]">
                            <span className="text-[#00C4BC] font-bold mt-px flex-shrink-0">✓</span>
                            {f}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* QR MercadoPago */}
                    <div className="flex-1 flex flex-col items-center text-center">
                      {/* QR — solo desktop, solo si hay qr_data */}
                      {(qrLoading || qrDataUrl) && (
                        <div className="hidden md:flex flex-col items-center">
                          <p className="text-sm font-semibold text-[#0F1720] mb-4">
                            Escaneá con tu app bancaria o de pago
                          </p>
                          <div className="w-52 h-52 bg-[#F3F4F6] border-2 border-[#D1D5DB] rounded-2xl flex flex-col items-center justify-center gap-2 mb-4 overflow-hidden">
                            {qrLoading && (
                              <div className="flex flex-col items-center gap-2">
                                <div className="w-8 h-8 border-2 border-[#00C4BC] border-t-transparent rounded-full animate-spin" />
                                <p className="text-xs text-[#6B7280]">Generando QR...</p>
                              </div>
                            )}
                            {qrDataUrl && !qrLoading && (
                              <img src={qrDataUrl} alt="QR de pago MercadoPago" className="w-full h-full object-contain" />
                            )}
                          </div>
                          <p className="text-xs text-[#6B7280] mb-4">
                            Cualquier billetera virtual o app bancaria
                          </p>
                        </div>
                      )}

                      {/* Mobile: título sin QR */}
                      <div className="flex md:hidden flex-col items-center mb-4">
                        <p className="text-sm font-semibold text-[#0F1720] mb-1">
                          Completá tu pago en MercadoPago
                        </p>
                        <p className="text-xs text-[#6B7280]">
                          Serás redirigido de forma segura
                        </p>
                      </div>

                      {/* Botón de redirección — siempre visible */}
                      {qrInitPoint && !qrLoading && (
                        <a
                          href={qrInitPoint}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 bg-[#009EE3] hover:bg-[#0088cc] text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-colors"
                        >
                          Pagar en MercadoPago
                        </a>
                      )}
                      {qrLoading && (
                        <div className="h-10 w-48 bg-[#F3F4F6] rounded-xl animate-pulse" />
                      )}
                    </div>

                  </div>

                  <div className="mt-6 flex items-center justify-between">
                    <button
                      onClick={() => setSelectedPlan(null)}
                      className="text-sm text-[#6B7280] hover:text-[#0F1720] transition-colors"
                    >
                      ← Cambiar plan
                    </button>
                    {selectedPlan === 'starter' && (
                      <button
                        onClick={() => setSelectedPlan('growth')}
                        className="text-sm font-semibold text-[#00C4BC] hover:text-[#00aaa3] transition-colors"
                      >
                        Pasarme a Growth →
                      </button>
                    )}
                  </div>
                  </>
                  )}
                </div>
              )
            })()}

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
    </PlansModalProvider>
  )
}
