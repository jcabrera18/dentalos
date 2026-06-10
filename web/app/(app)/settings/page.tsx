'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { apiFetch } from '@/lib/api'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import { useSubscription } from '@/lib/useSubscription'
import { usePlansModal } from '@/app/providers'
import { Upload, CheckCircle2, AlertCircle, ArrowRight, MessageCircle, Users, Infinity, Plus, X, ChevronDown } from 'lucide-react'

const DAYS = [
  { key: 0, label: 'Lunes' },
  { key: 1, label: 'Martes' },
  { key: 2, label: 'Miércoles' },
  { key: 3, label: 'Jueves' },
  { key: 4, label: 'Viernes' },
  { key: 5, label: 'Sábado' },
  { key: 6, label: 'Domingo' },
]

export type TimeBlock   = { start: string; end: string }
export type DayHours    = { enabled: boolean; blocks: TimeBlock[] }
export type WorkingHours = Record<number, DayHours>

export const DEFAULT_WORKING_HOURS: WorkingHours = {
  0: { enabled: true,  blocks: [{ start: '09:00', end: '18:00' }] },
  1: { enabled: true,  blocks: [{ start: '09:00', end: '18:00' }] },
  2: { enabled: true,  blocks: [{ start: '09:00', end: '18:00' }] },
  3: { enabled: true,  blocks: [{ start: '09:00', end: '18:00' }] },
  4: { enabled: true,  blocks: [{ start: '09:00', end: '18:00' }] },
  5: { enabled: false, blocks: [{ start: '09:00', end: '13:00' }] },
  6: { enabled: false, blocks: [{ start: '09:00', end: '13:00' }] },
}

const TIME_SLOTS = Array.from({ length: 96 }, (_, i) => {
  const h = Math.floor(i / 4)
  const m = (i % 4) * 15
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
})

function TimeSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const selectedRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (open) selectedRef.current?.scrollIntoView({ block: 'center' })
  }, [open])

  const slots = TIME_SLOTS.includes(value) ? TIME_SLOTS : [...TIME_SLOTS, value].sort()

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-[86px] flex items-center justify-between gap-1.5 bg-surface2 border border-app rounded-xl px-3 py-2.5 text-app text-sm hover:border-[#00C4BC] transition-colors cursor-pointer"
      >
        <span>{value}</span>
        <ChevronDown size={14} className="text-app3 shrink-0" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 bg-surface border border-app rounded-xl shadow-xl z-50 overflow-hidden w-28 max-h-60 overflow-y-auto">
            {slots.map(t => {
              const selected = value === t
              return (
                <button
                  key={t}
                  type="button"
                  ref={selected ? selectedRef : undefined}
                  onClick={() => { onChange(t); setOpen(false) }}
                  className={`w-full px-4 py-2.5 text-sm text-left transition-colors cursor-pointer ${
                    selected ? 'bg-[#00C4BC]/10 text-[#00C4BC] font-semibold' : 'text-app hover:bg-surface2'
                  }`}
                >
                  {t}
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

function toMinutes(time: string) {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

function fromMinutes(total: number) {
  const rounded = Math.round(total / 15) * 15
  return `${String(Math.floor(rounded / 60)).padStart(2, '0')}:${String(rounded % 60).padStart(2, '0')}`
}

function migrateDay(raw: any): DayHours {
  if (raw && Array.isArray(raw.blocks)) return raw as DayHours
  return {
    enabled: raw?.enabled ?? false,
    blocks:  [{ start: raw?.start ?? '09:00', end: raw?.end ?? '18:00' }],
  }
}

function hasOverlap(blocks: TimeBlock[]): boolean {
  if (blocks.length < 2) return false
  const sorted = [...blocks].sort((a, b) => toMinutes(a.start) - toMinutes(b.start))
  for (let i = 0; i < sorted.length - 1; i++) {
    if (toMinutes(sorted[i].end) > toMinutes(sorted[i + 1].start)) return true
  }
  return false
}

function nextBlockDefault(blocks: TimeBlock[], duration: number): TimeBlock {
  if (blocks.length === 0) return { start: '09:00', end: '18:00' }
  const maxEnd = blocks.reduce((m, b) => toMinutes(b.end) > toMinutes(m) ? b.end : m, '00:00')
  const start  = Math.min(toMinutes(maxEnd), 22 * 60)
  const end    = Math.min(start + duration, 23 * 60)
  return { start: fromMinutes(start), end: fromMinutes(end) }
}

const PLAN_LABELS: Record<string, string> = {
  trial:      'Prueba gratuita',
  basic:      'Starter',
  pro:        'Growth',
  clinic:     'Scale',
  enterprise: 'Enterprise',
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  trialing:  { label: 'En prueba',  color: 'text-blue-500' },
  active:    { label: 'Activo',     color: 'text-[#00C4BC]' },
  past_due:  { label: 'Vencido',    color: 'text-red-500' },
  canceled:  { label: 'Cancelado',  color: 'text-red-500' },
  expired:   { label: 'Expirado',   color: 'text-red-500' },
}

function PlanCard() {
  const { data: sub, loading } = useSubscription()
  const { openPlansModal } = usePlansModal()

  if (loading) {
    return (
      <div className="bg-surface border border-app rounded-2xl p-5 mb-8 animate-pulse">
        <div className="h-5 bg-surface2 rounded w-32 mb-3" />
        <div className="h-3 bg-surface2 rounded w-48 mb-4" />
        <div className="h-2 bg-surface2 rounded-full w-full" />
      </div>
    )
  }

  if (!sub) return null

  const planLabel = PLAN_LABELS[sub.plan] ?? sub.planName ?? sub.plan
  const statusInfo = STATUS_LABELS[sub.status] ?? { label: sub.status, color: 'text-app3' }

  // Determine which countdown to show: trial first, then subscription
  let daysLeft: number | null = null
  let totalDays: number | null = null
  let endsAt: string | null = null
  let countdownLabel = ''

  if (sub.trial.active && sub.trial.daysLeft !== null) {
    daysLeft = sub.trial.daysLeft
    totalDays = 14
    endsAt = sub.trial.endsAt
    countdownLabel = 'Prueba gratuita'
  } else if (sub.subscription.daysLeft !== null && !sub.subscription.expired) {
    daysLeft = sub.subscription.daysLeft
    totalDays = 30
    endsAt = sub.subscription.endsAt
    countdownLabel = 'Suscripción activa'
  }

  const progress = daysLeft !== null && totalDays !== null
    ? Math.max(0, Math.min(100, Math.round((daysLeft / totalDays) * 100)))
    : null

  const barColor = daysLeft !== null && daysLeft <= 3
    ? 'bg-red-500'
    : daysLeft !== null && daysLeft <= 7
    ? 'bg-yellow-400'
    : 'bg-[#00C4BC]'

  const formattedDate = endsAt
    ? new Date(endsAt).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })
    : null

  return (
    <div className="bg-surface border border-app rounded-2xl p-5">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-base font-semibold text-app">{planLabel}</span>
            <span className={`text-xs font-medium ${statusInfo.color}`}>· {statusInfo.label}</span>
          </div>
          {formattedDate && (
            <p className="text-xs text-app3">
              {sub.trial.expired || sub.subscription.expired
                ? 'Venció el '
                : 'Vence el '}{formattedDate}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-1 text-right shrink-0 ml-auto">
          <div className="flex gap-6 justify-end">
            {sub.features.maxPatients !== null && (
              <div>
                <p className="text-xs text-app3">Pacientes</p>
                <p className="text-sm font-semibold text-app">
                  {sub.usage.patients} / {sub.features.maxPatients}
                </p>
              </div>
            )}
            {sub.features.maxProfessionals !== null && (
              <div>
                <p className="text-xs text-app3">Profesionales</p>
                <p className="text-sm font-semibold text-app">
                  {sub.usage.professionals} / {sub.features.maxProfessionals}
                </p>
              </div>
            )}
          </div>
          {sub.features.whatsapp && sub.features.waMsgMonthlyQuota !== null && (
            <div>
              <p className="text-xs text-app3">WhatsApp este mes</p>
              <p className="text-sm font-semibold text-app">
                {sub.usage.waMsgUsedThisMonth} / {sub.features.waMsgMonthlyQuota}
              </p>
            </div>
          )}
        </div>
      </div>

      {progress !== null && daysLeft !== null && (
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-app3">{countdownLabel}</span>
            <span className={`text-xs font-semibold ${daysLeft <= 3 ? 'text-red-500' : daysLeft <= 7 ? 'text-yellow-500' : 'text-app'}`}>
              {daysLeft === 0 ? 'Vence hoy' : `${daysLeft} día${daysLeft !== 1 ? 's' : ''} restante${daysLeft !== 1 ? 's' : ''}`}
            </span>
          </div>
          <div className="h-2 bg-surface2 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${barColor}`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {(sub.trial.expired || sub.subscription.expired) && (
        <div className="mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-600 dark:text-red-400 text-xs">
          Tu plan ha vencido. Renovalo para seguir usando todas las funcionalidades.
        </div>
      )}

      {sub.plan === 'basic' && !sub.trial.expired && !sub.subscription.expired && (
        <div className="mt-4 rounded-xl border border-[#00C4BC]/25 bg-[#00C4BC]/5 p-4">
          <p className="text-xs font-bold text-[#00C4BC] uppercase tracking-wider mb-3">
            Pasate a Growth y desbloqueá todo
          </p>
          <div className="space-y-2 mb-4">
            {[
              { icon: Infinity, text: 'Pacientes ilimitados — sin el techo de 100' },
              { icon: MessageCircle, text: 'Recordatorios automáticos por WhatsApp — reducí ausentismo hasta un 40%' },
              { icon: Users, text: 'Hasta 3 profesionales con agenda propia' },
              { icon: CheckCircle2, text: 'Confirmación automática de turnos' },
            ].map(({ icon: Icon, text }, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <Icon size={13} className="text-[#00C4BC] flex-shrink-0 mt-0.5" />
                <span className="text-xs text-app2">{text}</span>
              </div>
            ))}
          </div>
          <button
            onClick={openPlansModal}
            className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold bg-[#00C4BC] hover:bg-[#00aaa3] text-white transition-colors active:scale-95"
          >
            Ver planes <ArrowRight size={14} />
          </button>
        </div>
      )}

      {sub.plan === 'pro' && !sub.trial.expired && !sub.subscription.expired && (() => {
        const waWarning  = sub.alerts.waMsgQuotaWarning || sub.alerts.waMsgQuotaExceeded
        const profLimit  = sub.alerts.professionalsLimitReached

        const heading = waWarning
          ? 'Te estás quedando sin mensajes WhatsApp'
          : profLimit
          ? 'Llegaste al límite de profesionales'
          : 'Llevá tu clínica al siguiente nivel con Scale'

        const items = [
          waWarning && {
            icon: MessageCircle,
            text: '2.000 recordatorios WhatsApp/mes — 4× más que en Growth',
            highlight: true,
          },
          profLimit && {
            icon: Users,
            text: 'Hasta 10 profesionales con agenda y permisos propios',
            highlight: true,
          },
          !waWarning && {
            icon: MessageCircle,
            text: '2.000 recordatorios WhatsApp/mes — enviá más sin pensar en el límite',
            highlight: false,
          },
          !profLimit && {
            icon: Users,
            text: 'Hasta 10 profesionales — sumá todo el equipo',
            highlight: false,
          },
          { icon: ArrowRight, text: 'Reportes avanzados de ocupación, cancelaciones y rendimiento', highlight: false },
        ].filter(Boolean) as { icon: React.ElementType; text: string; highlight: boolean }[]

        return (
          <div className="mt-4 rounded-xl border border-[#00C4BC]/25 bg-[#00C4BC]/5 p-4">
            <p className="text-xs font-bold text-[#00C4BC] uppercase tracking-wider mb-3">
              {heading}
            </p>
            <div className="space-y-2 mb-4">
              {items.map(({ icon: Icon, text, highlight }, i) => (
                <div key={i} className={`flex items-start gap-2.5 ${highlight ? 'font-semibold' : ''}`}>
                  <Icon size={13} className="text-[#00C4BC] flex-shrink-0 mt-0.5" />
                  <span className={`text-xs ${highlight ? 'text-app font-medium' : 'text-app2'}`}>{text}</span>
                </div>
              ))}
            </div>
            <button
              onClick={openPlansModal}
              className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold bg-[#00C4BC] hover:bg-[#00aaa3] text-white transition-colors active:scale-95"
            >
              Ver plan Scale <ArrowRight size={14} />
            </button>
          </div>
        )
      })()}

      {(sub.plan !== 'basic' && sub.plan !== 'pro') && (
        <div className="mt-4 flex justify-end">
          <button
            onClick={openPlansModal}
            className="px-4 py-2 rounded-xl text-sm font-semibold bg-[#00C4BC] hover:bg-[#00aaa3] text-white transition-colors active:scale-95"
          >
            {sub.trial.active || sub.status === 'trialing' ? 'Ver planes' : 'Cambiar plan'}
          </button>
        </div>
      )}
    </div>
  )
}

const IVA_CONDITIONS = [
  { value: 'RI', label: 'Responsable Inscripto' },
  { value: 'MO', label: 'Monotributista' },
  { value: 'EX', label: 'Exento' },
]

const AFIP_ENVIRONMENTS = [
  { value: 'homo', label: 'Homologación (pruebas)' },
  { value: 'prod', label: 'Producción' },
]

function AfipConfigSection({ token }: { token: string }) {
  const [config, setConfig]     = useState<any>(null)
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)
  const [error, setError]       = useState('')
  const [cuit, setCuit]         = useState('')
  const [address, setAddress]   = useState('')
  const [ivaCondition, setIvaCondition] = useState('MO')
  const [puntoVenta, setPuntoVenta]     = useState('')
  const [environment, setEnvironment]   = useState('homo')
  const [certFile, setCertFile]         = useState<File | null>(null)
  const [keyFile, setKeyFile]           = useState<File | null>(null)
  const certInputRef = useRef<HTMLInputElement>(null)
  const keyInputRef  = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!token) return
    setLoading(true)
    apiFetch('/professionals/me/afip-config', { token })
      .then(res => {
        const d = res.data
        setConfig(d)
        setCuit(d.cuit ?? '')
        setAddress(d.address ?? '')
        setIvaCondition(d.iva_condition ?? 'MO')
        setPuntoVenta(d.afip_punto_venta ? String(d.afip_punto_venta) : '')
        setEnvironment(d.afip_environment ?? 'homo')
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [token])

  async function readFileAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = e => resolve(e.target?.result as string)
      reader.onerror = reject
      reader.readAsText(file)
    })
  }

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      const body: any = {}
      if (cuit)         body.cuit             = cuit.replace(/\D/g, '')
      body.address      = address.trim()
      if (ivaCondition) body.iva_condition     = ivaCondition
      if (puntoVenta)   body.afip_punto_venta  = Number(puntoVenta)
      if (environment)  body.afip_environment  = environment
      if (certFile)     body.afip_cert         = await readFileAsText(certFile)
      if (keyFile)      body.afip_key          = await readFileAsText(keyFile)

      const res = await apiFetch('/professionals/me/afip-config', { method: 'PUT', body: JSON.stringify(body), token })
      setConfig((prev: any) => ({ ...prev, ...res.data, has_cert: certFile ? true : prev?.has_cert, has_key: keyFile ? true : prev?.has_key }))
      setCertFile(null)
      setKeyFile(null)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (err: any) {
      setError(err.message ?? 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-surface border border-app rounded-2xl overflow-hidden animate-pulse">
        <div className="px-5 py-4 border-b border-app">
          <div className="h-5 bg-surface2 rounded w-40 mb-1" />
          <div className="h-3 bg-surface2 rounded w-64" />
        </div>
        <div className="p-5 space-y-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-10 bg-surface2 rounded-xl" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-surface border border-app rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-app">
        <h2 className="font-semibold text-app">Facturación electrónica AFIP</h2>
        <p className="text-xs text-app3 mt-0.5">
          Configurá tus datos fiscales para emitir facturas electrónicas A, B o C.
        </p>
      </div>

      <div className="p-5 space-y-4">
        {/* CUIT */}
        <div>
          <label className="block text-xs font-semibold text-app3 uppercase tracking-wider mb-1.5">CUIT</label>
          <input
            type="text"
            value={cuit}
            onChange={e => setCuit(e.target.value.replace(/\D/g, '').slice(0, 11))}
            placeholder="20123456789"
            maxLength={11}
            className="bg-surface2 border border-app rounded-xl px-3 py-2.5 text-app text-sm focus:outline-none focus:border-[#00C4BC] w-full max-w-xs"
          />
          <p className="text-xs text-app3 mt-1">11 dígitos sin guiones</p>
        </div>

        {/* Address */}
        <div>
          <label className="block text-xs font-semibold text-app3 uppercase tracking-wider mb-1.5">Domicilio fiscal</label>
          <input
            type="text"
            value={address}
            onChange={e => setAddress(e.target.value)}
            placeholder="Av. Corrientes 1234, CABA"
            className="bg-surface2 border border-app rounded-xl px-3 py-2.5 text-app text-sm focus:outline-none focus:border-[#00C4BC] w-full"
          />
        </div>

        {/* IVA Condition */}
        <div>
          <label className="block text-xs font-semibold text-app3 uppercase tracking-wider mb-1.5">Condición frente al IVA</label>
          <div className="flex flex-wrap gap-2">
            {IVA_CONDITIONS.map(c => (
              <button
                key={c.value}
                type="button"
                onClick={() => setIvaCondition(c.value)}
                className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
                  ivaCondition === c.value
                    ? 'bg-[#00C4BC] text-white border-[#00C4BC]'
                    : 'bg-surface2 text-app2 border-app hover:border-[#00C4BC]/50'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
          {ivaCondition === 'MO' && <p className="text-xs text-app3 mt-1">Emitirás Facturas C (sin IVA desglosado)</p>}
          {ivaCondition === 'RI' && <p className="text-xs text-app3 mt-1">Emitirás Facturas A (para RI) o B (para CF/Monotributista)</p>}
          {ivaCondition === 'EX' && <p className="text-xs text-app3 mt-1">Emitirás Facturas B</p>}
        </div>

        {/* Punto de Venta + Ambiente */}
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="block text-xs font-semibold text-app3 uppercase tracking-wider mb-1.5">Punto de Venta</label>
            <input
              type="number"
              value={puntoVenta}
              onChange={e => setPuntoVenta(e.target.value)}
              placeholder="1"
              min={1}
              max={99999}
              className="bg-surface2 border border-app rounded-xl px-3 py-2.5 text-app text-sm focus:outline-none focus:border-[#00C4BC] w-32"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-app3 uppercase tracking-wider mb-1.5">Ambiente</label>
            <select
              value={environment}
              onChange={e => setEnvironment(e.target.value)}
              className="bg-surface2 border border-app rounded-xl px-3 py-2.5 text-app text-sm focus:outline-none focus:border-[#00C4BC]"
            >
              {AFIP_ENVIRONMENTS.map(e => (
                <option key={e.value} value={e.value}>{e.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Certificate */}
        <div>
          <label className="block text-xs font-semibold text-app3 uppercase tracking-wider mb-1.5">Certificado AFIP</label>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => certInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface2 border border-app hover:border-[#00C4BC]/50 text-sm text-app2 transition-all"
            >
              <Upload size={14} />
              {certFile ? certFile.name : 'Subir .crt o .pem'}
            </button>
            {config?.has_cert && !certFile && (
              <span className="flex items-center gap-1 text-xs text-emerald-500">
                <CheckCircle2 size={13} /> Configurado
              </span>
            )}
            <input ref={certInputRef} type="file" accept=".crt,.pem,.cer" className="hidden" onChange={e => setCertFile(e.target.files?.[0] ?? null)} />
          </div>
          <p className="text-xs text-app3 mt-1">Certificado que obtuviste en el portal AFIP (formato PEM)</p>
        </div>

        {/* Private Key */}
        <div>
          <label className="block text-xs font-semibold text-app3 uppercase tracking-wider mb-1.5">Clave Privada</label>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => keyInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface2 border border-app hover:border-[#00C4BC]/50 text-sm text-app2 transition-all"
            >
              <Upload size={14} />
              {keyFile ? keyFile.name : 'Subir .key o .pem'}
            </button>
            {config?.has_key && !keyFile && (
              <span className="flex items-center gap-1 text-xs text-emerald-500">
                <CheckCircle2 size={13} /> Configurado
              </span>
            )}
            <input ref={keyInputRef} type="file" accept=".key,.pem" className="hidden" onChange={e => setKeyFile(e.target.files?.[0] ?? null)} />
          </div>
          <p className="text-xs text-app3 mt-1">Clave privada correspondiente al certificado (formato PEM)</p>
        </div>

        {/* Help message when cert/key not yet configured */}
        {!loading && !config?.has_cert && !config?.has_key && (
          <div className="flex items-start gap-3 p-4 bg-surface2 border border-app rounded-xl">
            <AlertCircle size={15} className="mt-0.5 flex-shrink-0 text-app3" />
            <div className="text-sm text-app3">
              ¿No sabés cómo obtener el certificado AFIP?{' '}
              Escribinos a{' '}
              <a
                href="mailto:soporte.dentalos@gmail.com"
                className="text-[#00C4BC] font-medium hover:underline"
              >
                soporte.dentalos@gmail.com
              </a>{' '}
              y te ayudamos a configurarlo.
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-600 dark:text-red-400 text-sm">
            <AlertCircle size={15} className="mt-0.5 flex-shrink-0" />
            {error}
          </div>
        )}

        <div className="flex justify-end pt-1">
          <button
            onClick={handleSave}
            disabled={saving}
            className={`px-6 py-3 rounded-xl font-semibold text-sm transition-all active:scale-95 disabled:opacity-50 ${
              saved
                ? 'bg-[#E6F8F1] text-[#00C4BC] border border-[#00C4BC]/30'
                : 'bg-[#00C4BC] hover:bg-[#00aaa3] text-white'
            }`}
          >
            {saving ? 'Guardando...' : saved ? '✓ Guardado' : 'Guardar configuración AFIP'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function SettingsPage() {
  const [token, setToken]               = useState('')
  const [professionals, setProfessionals] = useState<any[]>([])
  const [myId, setMyId]                 = useState('')
  const [workingHours, setWorkingHours] = useState<WorkingHours>(DEFAULT_WORKING_HOURS)
  const [defaultDuration, setDefaultDuration] = useState(45)
  const [loading, setLoading]           = useState(true)
  const [saving, setSaving]             = useState(false)
  const [saved, setSaved]               = useState(false)
  const [error, setError]               = useState('')
  const supabase = createClient()

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_e: AuthChangeEvent, session: Session | null) => {
        if (session) setToken(session.access_token)
      }
    )
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!token) return
    void loadData()
  }, [token])

  async function loadData() {
    setLoading(true)
    try {
      const [meData, profData] = await Promise.all([
        apiFetch('/auth/me', { token }),
        apiFetch('/professionals', { token }),
      ])
      const myUserId = meData.data.id
      setMyId(myUserId)

      const profs: any[] = profData.data ?? []
      setProfessionals(profs)

      const self = profs.find(p => p.id === myUserId) ?? profs[0]
      if (!self) return

      loadScheduleConfig(self.id, profs)
    } finally {
      setLoading(false)
    }
  }

  function loadScheduleConfig(profId: string, profs = professionals) {
    const prof = profs.find((p: any) => p.id === profId)
    const raw  = prof?.schedule_config?.working_hours
    const migrated: WorkingHours = raw
      ? Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, migrateDay(v)]))
      : { ...DEFAULT_WORKING_HOURS }
    setWorkingHours(migrated)
    setDefaultDuration(prof?.default_duration_minutes ?? 45)
  }

  function toggleDay(day: number) {
    setWorkingHours(prev => ({ ...prev, [day]: { ...prev[day], enabled: !prev[day].enabled } }))
  }

  function updateBlock(day: number, index: number, field: keyof TimeBlock, value: string) {
    setWorkingHours(prev => {
      const blocks = prev[day].blocks.map((b, i) => i === index ? { ...b, [field]: value } : b)
      return { ...prev, [day]: { ...prev[day], blocks } }
    })
  }

  function addBlock(day: number) {
    setWorkingHours(prev => {
      const blocks = [...prev[day].blocks, nextBlockDefault(prev[day].blocks, defaultDuration)]
      return { ...prev, [day]: { ...prev[day], blocks } }
    })
  }

  function removeBlock(day: number, index: number) {
    setWorkingHours(prev => {
      const blocks = prev[day].blocks.filter((_, i) => i !== index)
      return { ...prev, [day]: { ...prev[day], blocks } }
    })
  }

  async function handleSave() {
    setSaving(true)
    setError('')

    const overlapErrors: string[] = []
    DAYS.forEach(({ key, label }) => {
      const day = workingHours[key]
      if (!day?.enabled) return
      if (day.blocks.some(b => toMinutes(b.start) >= toMinutes(b.end)))
        overlapErrors.push(`${label}: el inicio debe ser anterior al fin`)
      else if (hasOverlap(day.blocks))
        overlapErrors.push(`${label}: los bloques se superponen`)
    })
    if (overlapErrors.length > 0) {
      setError(overlapErrors.join(' · '))
      setSaving(false)
      return
    }

    try {
      const current = professionals.find((p: any) => p.id === myId)
      const updatedConfig = { ...(current?.schedule_config ?? {}), working_hours: workingHours }

      await apiFetch(`/professionals/${myId}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({ schedule_config: updatedConfig, default_duration_minutes: defaultDuration }),
      })

      setProfessionals((prev: any[]) =>
        prev.map(p => p.id === myId ? { ...p, schedule_config: updatedConfig, default_duration_minutes: defaultDuration } : p)
      )

      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (err: any) {
      setError(err.message ?? 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="px-6 py-8 animate-pulse">
        <div className="h-7 bg-surface2 rounded-lg w-40 mb-2" />
        <div className="h-4 bg-surface2 rounded w-64 mb-8" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          <div className="space-y-6">
            <div className="bg-surface border border-app rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-app">
                <div className="h-5 bg-surface2 rounded w-48 mb-2" />
                <div className="h-3 bg-surface2 rounded w-80" />
              </div>
              <div className="divide-y divide-app">
                {[...Array(7)].map((_, i) => (
                  <div key={i} className="flex items-center gap-4 px-5 py-4">
                    <div className="w-10 h-5 bg-surface2 rounded-full flex-shrink-0" />
                    <div className="w-24 h-4 bg-surface2 rounded" />
                    <div className="flex items-center gap-2 flex-1">
                      <div className="w-36 h-8 bg-surface2 rounded-lg" />
                      <div className="w-3 h-3 bg-surface2 rounded" />
                      <div className="w-36 h-8 bg-surface2 rounded-lg" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-end">
              <div className="w-36 h-11 bg-surface2 rounded-xl" />
            </div>
          </div>
          <div className="space-y-6">
            <div className="bg-surface border border-app rounded-2xl p-5">
              <div className="h-5 bg-surface2 rounded w-32 mb-3" />
              <div className="h-3 bg-surface2 rounded w-48 mb-4" />
              <div className="h-2 bg-surface2 rounded-full w-full" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="px-6 py-8">
      <h1 className="text-2xl font-bold text-app mb-1">Configuración</h1>
      <p className="text-app3 text-sm mb-8">Gestioná los horarios y la facturación de tu clínica.</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

        {/* Left column: account & billing */}
        <div className="space-y-4">
          <h2 className="text-base font-semibold text-app">Cuenta y facturación</h2>
          <PlanCard />
          {token && <AfipConfigSection token={token} />}
        </div>

        {/* Right column: agenda */}
        <div className="space-y-4">
          <h2 className="text-base font-semibold text-app">Agenda</h2>

          {/* Unified agenda card: duration + working hours + save */}
          <div className="bg-surface border border-app rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-app">
              <h3 className="font-semibold text-app">Horarios de atención</h3>
              <p className="text-xs text-app3 mt-0.5">
                Configurá la duración de los turnos y los días y horarios de trabajo.
              </p>
            </div>

            {/* Duration */}
            <div className="px-5 py-4 border-b border-app">
              <p className="text-xs font-semibold text-app3 uppercase tracking-wider mb-3">Duración por defecto del turno</p>
              <div className="flex flex-wrap gap-2">
                {[15, 20, 30, 45, 60, 90].map(min => (
                  <button
                    key={min}
                    type="button"
                    onClick={() => setDefaultDuration(min)}
                    className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
                      defaultDuration === min
                        ? 'bg-[#00C4BC] text-white border-[#00C4BC]'
                        : 'bg-surface2 text-app2 border-app hover:border-[#00C4BC]/50'
                    }`}
                  >
                    {min} min
                  </button>
                ))}
              </div>
            </div>

            {/* Days */}
            <div className="divide-y divide-app">
              {DAYS.map(({ key, label }) => {
                const day = workingHours[key] ?? DEFAULT_WORKING_HOURS[key]
                return (
                  <div
                    key={key}
                    className={`flex items-start gap-4 px-5 py-4 transition-colors ${!day.enabled ? 'bg-surface2/40' : ''}`}
                  >
                    <button
                      type="button"
                      onClick={() => toggleDay(key)}
                      className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 mt-0.5 ${
                        day.enabled ? 'bg-[#00C4BC]' : 'bg-surface3'
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${
                          day.enabled ? 'left-5' : 'left-0.5'
                        }`}
                      />
                    </button>

                    <span className={`w-20 text-sm font-medium flex-shrink-0 mt-0.5 ${day.enabled ? 'text-app' : 'text-app3'}`}>
                      {label}
                    </span>

                    {day.enabled ? (
                      <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                        {day.blocks.map((block, bi) => (
                          <div key={bi} className="flex items-center gap-2 flex-wrap">
                            <TimeSelect
                              value={block.start}
                              onChange={v => updateBlock(key, bi, 'start', v)}
                            />
                            <span className="text-app3 text-sm">–</span>
                            <TimeSelect
                              value={block.end}
                              onChange={v => updateBlock(key, bi, 'end', v)}
                            />
                            {day.blocks.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeBlock(key, bi)}
                                className="p-1 rounded-lg text-app3 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                              >
                                <X size={14} />
                              </button>
                            )}
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => addBlock(key)}
                          className="flex items-center gap-1 text-xs font-medium text-[#00C4BC] hover:text-[#00aaa3] transition-colors w-fit mt-0.5"
                        >
                          <Plus size={12} /> Agregar bloque
                        </button>
                      </div>
                    ) : (
                      <span className="text-app3 text-sm italic mt-0.5">No trabaja</span>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Footer: error + save */}
            {error && (
              <div className="px-5 pt-4">
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-600 dark:text-red-400 text-sm">
                  {error}
                </div>
              </div>
            )}
            <div className="px-5 py-4 border-t border-app flex items-center justify-between gap-4">
              <p className="text-xs text-app3">
                Los cambios se reflejarán en la agenda y en el link de booking online.
              </p>
              <button
                onClick={handleSave}
                disabled={saving || !myId}
                className={`shrink-0 px-6 py-2.5 rounded-xl font-semibold text-sm transition-all active:scale-95 disabled:opacity-50 ${
                  saved
                    ? 'bg-[#E6F8F1] text-[#00C4BC] border border-[#00C4BC]/30'
                    : 'bg-[#00C4BC] hover:bg-[#00aaa3] text-white'
                }`}
              >
                {saving ? 'Guardando...' : saved ? '✓ Guardado' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </div>


      </div>
    </div>
  )
}
