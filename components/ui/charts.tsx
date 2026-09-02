'use client'

import { PieChart, Pie, Cell } from 'recharts'

/** Тултип в стиле дизайн-системы — общий для всех графиков. */
export function ChartTooltip({
  active, payload, label, labels,
}: {
  active?: boolean
  payload?: { value: number; name: string; color: string; dataKey?: string }[]
  label?: string
  labels?: Record<string, string>
}) {
  if (!active || !payload?.length) return null
  const total = payload.reduce((s, p) => s + (p.value ?? 0), 0)
  return (
    <div
      style={{
        background: 'var(--card2)',
        border: '1px solid var(--border-strong)',
        borderRadius: 'var(--r-md)',
        padding: '10px 13px',
        fontSize: 12,
        boxShadow: 'var(--sh-2)',
        minWidth: 130,
      }}
    >
      <div style={{ color: 'var(--text-muted)', marginBottom: 7, fontWeight: 600 }}>{label}</div>
      {payload.map(p => (
        <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
          <span style={{ width: 7, height: 7, borderRadius: 2, background: p.color, display: 'inline-block' }} />
          <span style={{ color: 'var(--text-dim)', flex: 1 }}>
            {labels?.[p.name] ?? p.name}
          </span>
          <span className="mono" style={{ fontWeight: 700, color: 'var(--text)' }}>{p.value}</span>
        </div>
      ))}
      {payload.length > 1 && (
        <div style={{
          display: 'flex', justifyContent: 'space-between', gap: 10,
          marginTop: 7, paddingTop: 7, borderTop: '1px solid var(--border)',
          color: 'var(--text-muted)',
        }}>
          <span>Всего</span>
          <span className="mono" style={{ fontWeight: 700, color: 'var(--mint)' }}>{total}</span>
        </div>
      )}
    </div>
  )
}

export type DonutSlice = { name: string; value: number; color: string }

/** Кольцевая диаграмма с общим числом в центре и легендой-списком. */
export function Donut({
  data, size = 116, centerLabel,
}: {
  data: DonutSlice[]
  size?: number
  centerLabel?: string
}) {
  const total = data.reduce((s, d) => s + d.value, 0)

  return (
    <div className="row" style={{ gap: 18, alignItems: 'center' }}>
      <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
        <PieChart width={size} height={size}>
          <Pie
            data={data}
            dataKey="value"
            cx={size / 2 - 5}
            cy={size / 2 - 5}
            innerRadius={size * 0.31}
            outerRadius={size * 0.48}
            paddingAngle={data.length > 1 ? 2 : 0}
            strokeWidth={0}
            startAngle={90}
            endAngle={-270}
            isAnimationActive
          >
            {data.map((d, i) => <Cell key={i} fill={d.color} />)}
          </Pie>
        </PieChart>
        <div
          style={{
            position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
            pointerEvents: 'none', textAlign: 'center',
          }}
        >
          <div>
            <div className="mono" style={{ fontSize: 17, fontWeight: 700, lineHeight: 1 }}>{total}</div>
            {centerLabel && (
              <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 3 }}>
                {centerLabel}
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        {data.map(d => (
          <div key={d.name} className="row" style={{ gap: 9, marginBottom: 9 }}>
            <span className="dot" style={{ background: d.color, width: 8, height: 8 }} />
            <span className="truncate" style={{ fontSize: 12.5, color: 'var(--text-dim)', flex: 1 }}>{d.name}</span>
            <span className="mono" style={{ fontSize: 12, fontWeight: 650 }}>{d.value}</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 34, textAlign: 'right' }}>
              {total > 0 ? Math.round((d.value / total) * 100) : 0}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Легенда «NFC / QR» под графиками. */
export function ChartLegend({ items }: { items: { color: string; label: string }[] }) {
  return (
    <div className="row" style={{ gap: 18, marginTop: 12, flexWrap: 'wrap' }}>
      {items.map(l => (
        <div key={l.label} className="row" style={{ gap: 6 }}>
          <span style={{ width: 14, height: 3, borderRadius: 2, background: l.color, display: 'inline-block' }} />
          <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{l.label}</span>
        </div>
      ))}
    </div>
  )
}
