import React from 'react'

interface Props {
  tier: 'Low' | 'Moderate' | 'High' | string
}

const config: Record<string, { cls: string; dot: string; label: string }> = {
  High:     { cls: 'badge-high',     dot: 'bg-red-400',    label: '🔴 High' },
  Moderate: { cls: 'badge-moderate', dot: 'bg-orange-400', label: '🟡 Moderate' },
  Low:      { cls: 'badge-low',      dot: 'bg-green-400',  label: '🟢 Low' },
}

export function RiskBadge({ tier }: Props) {
  const c = config[tier] ?? { cls: 'badge-low', dot: 'bg-gray-400', label: tier }
  return (
    <span className={c.cls}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  )
}

// Risk percentage bar
export function RiskBar({ value }: { value: number }) {
  const pct = Math.round(value * 100)
  const color =
    value >= 0.65 ? '#d32f2f' :
    value >= 0.35 ? '#f57c00' :
                    '#2e7d32'
  return (
    <div className="risk-bar w-full">
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
    </div>
  )
}
