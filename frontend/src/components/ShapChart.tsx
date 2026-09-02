import React from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts'
import type { ShapEntry } from '../types'

interface Props {
  data:    ShapEntry[]
  maxItems?: number
  height?: number
}

function shapColor(v: number) {
  return v > 0 ? '#d32f2f' : '#2e7d32'
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload?.length) {
    const { feature, shap_value } = payload[0].payload
    const direction = shap_value > 0 ? 'increases dropout risk' : 'reduces dropout risk'
    return (
      <div className="glass rounded-xl p-3 text-xs shadow-xl border border-surface-600">
        <p className="font-semibold text-surface-100 mb-1">{feature}</p>
        <p className={shap_value > 0 ? 'text-red-400' : 'text-green-400'}>
          SHAP: {shap_value.toFixed(4)} — {direction}
        </p>
      </div>
    )
  }
  return null
}

export function ShapChart({ data, maxItems = 12, height = 300 }: Props) {
  const sorted = [...data]
    .sort((a, b) => Math.abs(b.shap_value) - Math.abs(a.shap_value))
    .slice(0, maxItems)
    .reverse()   // bottom-up for horizontal bar

  const chartData = sorted.map(d => ({
    ...d,
    abs_value: Math.abs(d.shap_value),
    // Shorten feature name for readability
    label: d.feature.replace('num__', '').replace('cat__', '').replace('_', ' '),
  }))

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{ top: 5, right: 30, left: 8, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,0.15)" horizontal={false} />
        <XAxis
          type="number"
          domain={['auto', 'auto']}
          tick={{ fill: '#94A3B8', fontSize: 11 }}
          axisLine={{ stroke: '#334155' }}
          tickLine={false}
          tickFormatter={v => v.toFixed(2)}
        />
        <YAxis
          type="category"
          dataKey="label"
          width={160}
          tick={{ fill: '#CBD5E1', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <ReferenceLine x={0} stroke="#475569" strokeWidth={1.5} />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(100,116,139,0.1)' }} />
        <Bar dataKey="shap_value" radius={[0, 4, 4, 0]}>
          {chartData.map((entry, idx) => (
            <Cell key={idx} fill={shapColor(entry.shap_value)} fillOpacity={0.85} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
