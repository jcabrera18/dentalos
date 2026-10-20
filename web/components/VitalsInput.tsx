'use client'

// VitalsInput / VitalsDisplay — bloque de signos vitales / antropometría (P3).
// Ver docs/VITALOS_CLINICAL_HISTORIES_PLAN.md §4.3. Se maneja por VitalField[]
// (qué subconjunto muestra cada disciplina, declarado en CLINICAL_TEMPLATES).
// El IMC SIEMPRE se deriva (read-only): peso / (talla/100)^2.

import type { VitalField } from '@/lib/capabilities'

// Forma persistida de los vitales (clave estable, independiente del orden de UI).
export interface Vitals {
  systolic_bp?: number | null
  diastolic_bp?: number | null
  weight_kg?: number | null
  height_cm?: number | null
  bmi?: number | null
  heart_rate?: number | null
  resp_rate?: number | null
  temperature_c?: number | null
  spo2?: number | null
  waist_cm?: number | null
  hip_cm?: number | null
  body_fat_pct?: number | null
  muscle_mass_kg?: number | null
}

export function computeBmi(weightKg?: number | null, heightCm?: number | null): number | null {
  if (!weightKg || !heightCm) return null
  const m = heightCm / 100
  if (m <= 0) return null
  return Math.round((weightKg / (m * m)) * 10) / 10
}

// Metadatos de UI por campo (label en español + unidad). bp es doble (sist/diast).
type SimpleKey = Exclude<keyof Vitals, 'systolic_bp' | 'diastolic_bp' | 'bmi'>
const SIMPLE: Record<Exclude<VitalField, 'bp' | 'bmi'>, { key: SimpleKey; label: string; unit: string; max: number }> = {
  weight:      { key: 'weight_kg',      label: 'Peso',       unit: 'kg',  max: 400 },
  height:      { key: 'height_cm',      label: 'Talla',      unit: 'cm',  max: 260 },
  heart_rate:  { key: 'heart_rate',     label: 'FC',         unit: 'lpm', max: 300 },
  resp_rate:   { key: 'resp_rate',      label: 'FR',         unit: 'rpm', max: 120 },
  temperature: { key: 'temperature_c',  label: 'Temp.',      unit: '°C',  max: 45 },
  spo2:        { key: 'spo2',           label: 'SatO₂',      unit: '%',   max: 100 },
  waist:       { key: 'waist_cm',       label: 'Cintura',    unit: 'cm',  max: 300 },
  hip:         { key: 'hip_cm',         label: 'Cadera',     unit: 'cm',  max: 300 },
  body_fat:    { key: 'body_fat_pct',   label: 'Grasa corp.', unit: '%',  max: 100 },
  muscle_mass: { key: 'muscle_mass_kg', label: 'Masa musc.', unit: 'kg',  max: 200 },
}

function parseNum(raw: string, max: number): number | null {
  if (raw.trim() === '') return null
  const n = Number(raw.replace(',', '.'))
  if (!Number.isFinite(n) || n < 0 || n > max) return null
  return n
}

function Field({ label, unit, children }: { label: string; unit: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-app3 mb-1.5">{label}{unit ? ` (${unit})` : ''}</label>
      {children}
    </div>
  )
}

const inputCls = 'w-full bg-surface2 border border-app rounded-lg px-3 py-2 text-sm text-app focus:outline-none focus:border-[#00C4BC]'

export function VitalsInput({
  fields,
  value,
  onChange,
}: {
  fields: readonly VitalField[]
  value: Vitals
  onChange: (next: Vitals) => void
}) {
  if (!fields.length) return null
  const set = (patch: Partial<Vitals>) => {
    const next = { ...value, ...patch }
    // IMC derivado y persistido (para gráficos/listados sin recalcular).
    next.bmi = computeBmi(next.weight_kg, next.height_cm)
    onChange(next)
  }

  return (
    <section className="bg-surface border border-app rounded-2xl p-5">
      <div className="text-xs font-bold uppercase tracking-wider text-app3 mb-4">Signos vitales</div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {fields.map((f) => {
          if (f === 'bp') {
            return (
              <Field key="bp" label="Tensión arterial" unit="mmHg">
                <div className="flex items-center gap-1.5">
                  <input
                    type="number" inputMode="numeric" placeholder="Sist."
                    value={value.systolic_bp ?? ''}
                    onChange={(e) => set({ systolic_bp: parseNum(e.target.value, 300) })}
                    className={inputCls}
                  />
                  <span className="text-app3 text-sm">/</span>
                  <input
                    type="number" inputMode="numeric" placeholder="Diast."
                    value={value.diastolic_bp ?? ''}
                    onChange={(e) => set({ diastolic_bp: parseNum(e.target.value, 200) })}
                    className={inputCls}
                  />
                </div>
              </Field>
            )
          }
          if (f === 'bmi') {
            const bmi = computeBmi(value.weight_kg, value.height_cm)
            return (
              <Field key="bmi" label="IMC" unit="kg/m²">
                <div className={`${inputCls} flex items-center text-app3`} title="Calculado automáticamente">
                  {bmi ?? '—'}
                </div>
              </Field>
            )
          }
          const meta = SIMPLE[f]
          if (!meta) return null
          return (
            <Field key={f} label={meta.label} unit={meta.unit}>
              <input
                type="number" inputMode="decimal" step="any" placeholder="—"
                value={(value[meta.key] as number | null | undefined) ?? ''}
                onChange={(e) => set({ [meta.key]: parseNum(e.target.value, meta.max) } as Partial<Vitals>)}
                className={inputCls}
              />
            </Field>
          )
        })}
      </div>
    </section>
  )
}

// Vista de solo lectura (para la firma / detalle). Muestra solo lo cargado.
export function VitalsDisplay({ fields, value }: { fields: readonly VitalField[]; value: Vitals }) {
  if (!fields.length) return null
  const items: { label: string; text: string }[] = []
  for (const f of fields) {
    if (f === 'bp') {
      if (value.systolic_bp != null || value.diastolic_bp != null) {
        items.push({ label: 'TA', text: `${value.systolic_bp ?? '—'}/${value.diastolic_bp ?? '—'} mmHg` })
      }
      continue
    }
    if (f === 'bmi') {
      const bmi = computeBmi(value.weight_kg, value.height_cm)
      if (bmi != null) items.push({ label: 'IMC', text: `${bmi} kg/m²` })
      continue
    }
    const meta = SIMPLE[f]
    const v = meta ? (value[meta.key] as number | null | undefined) : null
    if (meta && v != null) items.push({ label: meta.label, text: `${v} ${meta.unit}` })
  }
  if (!items.length) return <div className="text-app3 text-xs">Sin signos vitales registrados</div>
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-app">
      {items.map((it) => (
        <span key={it.label}><span className="text-app3">{it.label}:</span> {it.text}</span>
      ))}
    </div>
  )
}
