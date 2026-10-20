'use client'

// Renderers declarativos compartidos por la historia clínica por especialidad
// (anamnesis base + notas de evolución). Manejados por ClinicalField/ClinicalSection
// de lib/capabilities.ts. Ver docs/VITALOS_CLINICAL_HISTORIES_PLAN.md.

import { useState } from 'react'
import type { ClinicalField, ClinicalSection } from '@/lib/capabilities'

export const inputCls =
  'w-full bg-surface2 border border-app rounded-lg px-3 py-2 text-sm text-app focus:outline-none focus:border-[#00C4BC]'

export function Toggle({ value, onChange }: { value: boolean; onChange: () => void }) {
  return (
    <div
      onClick={onChange}
      className="relative w-10 h-5 rounded-full transition-colors cursor-pointer shrink-0"
      style={{ backgroundColor: value ? '#00C4BC' : undefined }}
      data-active={value}
    >
      <div className={`absolute inset-0 rounded-full border border-app2 bg-surface3 transition-opacity ${value ? 'opacity-0' : 'opacity-100'}`} />
      <div className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white shadow transition-all ${value ? 'left-[22px]' : 'left-[2px]'}`} />
    </div>
  )
}

export function FieldInput({
  field,
  value,
  onChange,
}: {
  field: ClinicalField
  value: unknown
  onChange: (v: unknown) => void
}) {
  switch (field.type) {
    case 'bool':
      return (
        <label className="flex items-center justify-between py-1 cursor-pointer select-none">
          <span className="text-sm text-app">{field.label}</span>
          <Toggle value={Boolean(value)} onChange={() => onChange(!value)} />
        </label>
      )
    case 'textarea':
      return (
        <div className="py-1">
          <label className="block text-xs text-app3 mb-1.5">{field.label}</label>
          <textarea
            rows={3}
            maxLength={field.max}
            value={(value as string) ?? ''}
            placeholder={field.placeholder}
            onChange={(e) => onChange(e.target.value)}
            className={`${inputCls} resize-none`}
          />
        </div>
      )
    case 'number':
      return (
        <div className="py-1">
          <label className="block text-xs text-app3 mb-1.5">{field.label}</label>
          <input
            type="number" inputMode="numeric" max={field.max}
            value={(value as number | string) ?? ''}
            onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
            className={inputCls}
          />
        </div>
      )
    case 'date':
      return (
        <div className="py-1">
          <label className="block text-xs text-app3 mb-1.5">{field.label}</label>
          <input
            type="date"
            value={(value as string) ?? ''}
            onChange={(e) => onChange(e.target.value || null)}
            className={inputCls}
          />
        </div>
      )
    case 'select':
      return (
        <div className="py-1">
          <label className="block text-xs text-app3 mb-1.5">{field.label}</label>
          <select
            value={(value as string) ?? ''}
            onChange={(e) => onChange(e.target.value || null)}
            className={inputCls}
          >
            <option value="">—</option>
            {field.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      )
    case 'text':
    default:
      return (
        <div className="py-1">
          <label className="block text-xs text-app3 mb-1.5">{field.label}</label>
          <input
            type="text" maxLength={field.max}
            value={(value as string) ?? ''}
            placeholder={field.placeholder}
            onChange={(e) => onChange(e.target.value)}
            className={inputCls}
          />
        </div>
      )
  }
}

export function SectionCard({
  section,
  values,
  onField,
}: {
  section: ClinicalSection
  values: Record<string, unknown>
  onField: (key: string, v: unknown) => void
}) {
  const [open, setOpen] = useState(!section.collapsible)
  return (
    <section className="bg-surface border border-app rounded-2xl p-5">
      <button
        type="button"
        onClick={() => section.collapsible && setOpen((o) => !o)}
        className={`w-full flex items-center justify-between text-xs font-bold uppercase tracking-wider text-app3 ${open ? 'mb-4' : ''} ${section.collapsible ? 'cursor-pointer' : 'cursor-default'}`}
      >
        <span>{section.label}</span>
        {section.collapsible && <span className="text-app3 normal-case">{open ? '−' : '+'}</span>}
      </button>
      {open && (
        <div className="space-y-2">
          {section.fields.map((f) => (
            <FieldInput key={f.key} field={f} value={values?.[f.key]} onChange={(v) => onField(f.key, v)} />
          ))}
        </div>
      )}
    </section>
  )
}

// Lectura compacta de un conjunto de campos (para detalle/firma). Omite vacíos.
export function FieldsReadout({ fields, values }: { fields: readonly ClinicalField[]; values: Record<string, unknown> }) {
  const items = fields.filter((f) => {
    const v = values?.[f.key]
    return v !== undefined && v !== null && v !== '' && v !== false
  })
  if (!items.length) return <div className="text-app3 text-xs">Sin datos</div>
  return (
    <div className="space-y-1">
      {items.map((f) => {
        const v = values[f.key]
        const text = f.type === 'bool'
          ? 'Sí'
          : f.type === 'select'
            ? (f.options?.find((o) => o.value === v)?.label ?? String(v))
            : String(v)
        return (
          <div key={f.key} className="text-sm text-app">
            <span className="text-app3">{f.label}:</span> {text}
          </div>
        )
      })}
    </div>
  )
}
