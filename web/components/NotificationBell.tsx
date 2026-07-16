'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { Bell, CalendarX, CalendarCheck, CalendarPlus, CheckCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import {
  useUnreadNotificationsCount,
  useNotificationsInbox,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  queryKeys,
  type AppNotification,
} from '@/lib/queries'

// Ícono + color por tipo de notificación. Queda listo para sumar más tipos
// in-app sin tocar el resto del componente.
function visualsFor(type: string) {
  switch (type) {
    case 'appointment_cancelled':
      return { Icon: CalendarX, color: 'text-red-500' }
    case 'appointment_confirmed':
      return { Icon: CalendarCheck, color: 'text-emerald-500' }
    case 'appointment_booked':
      return { Icon: CalendarPlus, color: 'text-[#00C4BC]' }
    default:
      return { Icon: Bell, color: 'text-[#00C4BC]' }
  }
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'recién'
  if (min < 60) return `hace ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `hace ${h} h`
  const d = Math.floor(h / 24)
  return `hace ${d} d`
}

export function NotificationBell() {
  const router = useRouter()
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const { data: unread = 0 } = useUnreadNotificationsCount()
  const { data: items = [], isLoading } = useNotificationsInbox(open)
  const markRead = useMarkNotificationRead()
  const markAll = useMarkAllNotificationsRead()

  // Tiempo real: suscripción a los INSERT de la clínica en app_notifications.
  // Al llegar una notificación nueva, refrescamos el badge (y el feed si está
  // abierto) al instante, sin esperar el poll de 30s. La RLS de Supabase filtra
  // por clínica; igual acotamos el canal por clinic_id. El poll queda de fallback
  // por si el socket se cae.
  useEffect(() => {
    const supabase = createClient()
    let active = true
    let channel: ReturnType<typeof supabase.channel> | null = null

    ;(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const clinicId = session?.user?.user_metadata?.clinic_id as string | undefined
      if (!clinicId || !active) return

      channel = supabase
        .channel(`app_notifications:${clinicId}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'app_notifications', filter: `clinic_id=eq.${clinicId}` },
          () => {
            qc.invalidateQueries({ queryKey: queryKeys.notificationsUnread })
            qc.invalidateQueries({ queryKey: queryKeys.notificationsInbox })
          }
        )
        .subscribe()
    })()

    return () => {
      active = false
      if (channel) void supabase.removeChannel(channel)
    }
  }, [qc])

  // Cerrar al clickear afuera o con Escape.
  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  function handleItemClick(n: AppNotification) {
    if (!n.read_at) markRead.mutate(n.id)
    setOpen(false)
    // Deep-link: llevamos a la agenda del día del turno cancelado.
    if (n.appointment_id) router.push('/agenda')
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="Notificaciones"
        className="relative text-app3 hover:text-app transition-colors"
      >
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-[16px] px-1 flex items-center justify-center rounded-full bg-[#00C4BC] text-white text-[10px] font-bold leading-none">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] bg-surface border border-app rounded-xl shadow-lg z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-app">
            <span className="text-sm font-semibold text-app">Notificaciones</span>
            {unread > 0 && (
              <button
                onClick={() => markAll.mutate()}
                className="flex items-center gap-1 text-xs font-medium text-[#00C4BC] hover:opacity-80 transition-opacity"
              >
                <CheckCheck size={13} /> Marcar todas
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {isLoading ? (
              <p className="px-4 py-6 text-sm text-app3 text-center">Cargando…</p>
            ) : items.length === 0 ? (
              <p className="px-4 py-8 text-sm text-app3 text-center">No hay notificaciones.</p>
            ) : (
              items.map(n => {
                const { Icon, color } = visualsFor(n.type)
                return (
                  <button
                    key={n.id}
                    onClick={() => handleItemClick(n)}
                    className={`w-full text-left flex gap-3 px-4 py-3 border-b border-app/60 last:border-0 hover:bg-[#E6F8F1]/50 dark:hover:bg-[#00C4BC]/10 transition-colors ${
                      n.read_at ? '' : 'bg-[#E6F8F1]/40 dark:bg-[#00C4BC]/[0.06]'
                    }`}
                  >
                    <div className={`mt-0.5 shrink-0 ${color}`}>
                      <Icon size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-app truncate">{n.title}</p>
                        {!n.read_at && <span className="w-1.5 h-1.5 rounded-full bg-[#00C4BC] shrink-0" />}
                      </div>
                      {n.body && <p className="text-xs text-app2 mt-0.5 line-clamp-2">{n.body}</p>}
                      <p className="text-[11px] text-app3 mt-1">{timeAgo(n.created_at)}</p>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
