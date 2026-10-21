'use client'

// Gráfico de evolución peso/IMC. Aislado en su propio módulo para que recharts
// (pesado) entre al bundle solo vía dynamic import cuando la disciplina lo usa.
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

export type WeightChartPoint = { date: string; peso: number | null; imc: number | null }

export default function WeightChart({ data }: { data: WeightChartPoint[] }) {
  return (
    <div style={{ width: '100%', height: 220 }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border, #e5e7eb)" opacity={0.3} />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip />
          <Line type="monotone" dataKey="peso" stroke="#00C4BC" strokeWidth={2} dot={{ r: 3 }} name="Peso (kg)" />
          <Line type="monotone" dataKey="imc" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} name="IMC" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
