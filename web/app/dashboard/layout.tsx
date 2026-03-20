'use client'

import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

const NAV_ITEMS = [
  { href: '/dashboard',          icon: '📊', label: 'Inicio' },
  { href: '/dashboard/agenda',   icon: '📅', label: 'Agenda' },
  { href: '/dashboard/patients', icon: '👥', label: 'Pacientes' },
  { href: '/dashboard/payments', icon: '💰', label: 'Cobros' },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router   = useRouter()
  const supabase = createClient()

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
    <div className="min-h-screen bg-gray-950 flex flex-col">

      {/* TOP BAR — desktop */}
      <header className="hidden md:flex border-b border-gray-800 bg-gray-950 px-6 py-0 items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-1">
          <div className="text-xl font-bold text-white mr-6 py-4">
            Dental<span className="text-blue-400">OS</span>
          </div>
          {NAV_ITEMS.map(item => (
            <button
              key={item.href}
              onClick={() => router.push(item.href)}
              className={`flex items-center gap-2 px-4 py-4 text-sm font-medium border-b-2 transition-colors ${
                isActive(item.href)
                  ? 'border-blue-400 text-blue-400'
                  : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>
        <button
          onClick={handleLogout}
          className="text-sm text-gray-500 hover:text-white transition-colors"
        >
          Salir
        </button>
      </header>

      {/* MOBILE TOP BAR */}
      <header className="md:hidden flex border-b border-gray-800 bg-gray-950 px-4 py-3 items-center justify-between sticky top-0 z-40">
        <div className="text-lg font-bold text-white">
          Dental<span className="text-blue-400">OS</span>
        </div>
        <button
          onClick={handleLogout}
          className="text-sm text-gray-500 hover:text-white transition-colors"
        >
          Salir
        </button>
      </header>

      {/* CONTENIDO */}
      <main className="flex-1 pb-20 md:pb-0">
        {children}
      </main>

      {/* BOTTOM NAV — mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 z-40">
        <div className="grid grid-cols-4">
          {NAV_ITEMS.map(item => (
            <button
              key={item.href}
              onClick={() => router.push(item.href)}
              className={`flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors ${
                isActive(item.href)
                  ? 'text-blue-400'
                  : 'text-gray-500'
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </nav>

    </div>
  )
}