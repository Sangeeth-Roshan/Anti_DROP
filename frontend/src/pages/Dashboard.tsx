import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, LineChart, Line, Legend,
} from 'recharts'
import { fetchCohortStats } from '../api'
import type { CohortStats } from '../types'
import { useUpload } from '../context'
import { SkeletonCard, ErrorState } from '../components/AppShell'
import {
  Users, TrendingUp, GraduationCap, AlertTriangle,
  BookOpen, DollarSign,
} from 'lucide-react'

const DEPT_COLORS = ['#1E88E5', '#43A047', '#FB8C00', '#E53935', '#8E24AA']

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload?.length) {
    return (
      <div className="glass rounded-xl p-3 text-xs shadow-xl border border-surface-600">
        <p className="font-semibold text-surface-100 mb-1">{label}</p>
        {payload.map((p: any) => (
          <p key={p.dataKey} style={{ color: p.color }}>
            {p.name}: {typeof p.value === 'number' && p.value < 1 ? `${(p.value * 100).toFixed(1)}%` : p.value}
          </p>
        ))}
      </div>
    )
  }
  return null
}

export function Dashboard() {
  const { upload } = useUpload()
  const [stats, setStats]   = useState<CohortStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState<string | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    setLoading(true); setError(null)
    fetchCohortStats(upload.upload_id)
      .then(setStats)
      .catch(e => setError(e.response?.data?.detail ?? e.message))
      .finally(() => setLoading(false))
  }, [upload.upload_id])

  if (loading) return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[0,1,2,3].map(i => <SkeletonCard key={i} rows={2} />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SkeletonCard rows={6} />
        <SkeletonCard rows={6} />
      </div>
    </div>
  )

  if (error) return <ErrorState message={error} />
  if (!stats) return null

  const tierData = [
    { name: 'High Risk',     value: stats.high_risk,     color: '#d32f2f' },
    { name: 'Moderate Risk', value: stats.moderate_risk, color: '#f57c00' },
    { name: 'Low Risk',      value: stats.low_risk,      color: '#2e7d32' },
  ]

  const atRisk = stats.high_risk + stats.moderate_risk

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Page header */}
      <div>
        <h1 className="section-title">Cohort Overview</h1>
        <p className="section-sub">
          {stats.total} students · {stats.has_dropout_labels ? 'Actual dropout labels available' : 'Predicted risk only'}
        </p>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          id="metric-total"
          icon={<Users size={20} className="text-primary" />}
          label="Total Students"
          value={stats.total.toLocaleString()}
          sub="in current dataset"
          accent="border-primary/30"
        />
        <MetricCard
          id="metric-atrisk"
          icon={<AlertTriangle size={20} className="text-red-400" />}
          label="At-Risk Students"
          value={atRisk.toLocaleString()}
          sub={`${((atRisk / stats.total) * 100).toFixed(1)}% of cohort`}
          accent="border-red-800/50"
        />
        <MetricCard
          id="metric-cgpa"
          icon={<GraduationCap size={20} className="text-green-400" />}
          label="Avg CGPA"
          value={stats.avg_cgpa.toFixed(2)}
          sub="out of 10.0"
          accent="border-green-800/30"
        />
        <MetricCard
          id="metric-fees"
          icon={<DollarSign size={20} className="text-orange-400" />}
          label="Pending Fees"
          value={stats.pending_fees.toLocaleString()}
          sub={`${((stats.pending_fees / stats.total) * 100).toFixed(1)}% of cohort`}
          accent="border-orange-800/30"
        />
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Risk tier bar */}
        <div className="card">
          <h2 className="font-bold text-white mb-1">Risk Tier Distribution</h2>
          <p className="text-xs text-surface-400 mb-4">Students bucketed by predicted dropout probability</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={tierData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,0.15)" />
              <XAxis dataKey="name" tick={{ fill: '#94A3B8', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#94A3B8', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(100,116,139,0.08)' }} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {tierData.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Backlogs vs dropout rate */}
        <div className="card">
          <h2 className="font-bold text-white mb-1">Backlogs vs Dropout Rate</h2>
          <p className="text-xs text-surface-400 mb-4">
            {stats.has_dropout_labels ? 'Actual dropout rate' : 'Avg predicted risk'} by backlog count
          </p>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={stats.backlog_breakdown} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,0.15)" />
              <XAxis dataKey="backlogs" label={{ value: 'Backlogs', position: 'insideBottom', offset: -2, fill: '#64748b', fontSize: 11 }} tick={{ fill: '#94A3B8', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={v => `${(v * 100).toFixed(0)}%`} tick={{ fill: '#94A3B8', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="dropout_rate"
                name={stats.has_dropout_labels ? 'Dropout Rate' : 'Avg Risk'}
                stroke="#1E88E5"
                strokeWidth={2.5}
                dot={{ fill: '#1E88E5', r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Department comparison */}
        <div className="card">
          <h2 className="font-bold text-white mb-1">Department Breakdown</h2>
          <p className="text-xs text-surface-400 mb-4">Avg predicted risk & high-risk count by department</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={stats.department_breakdown} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,0.15)" />
              <XAxis dataKey="department" tick={{ fill: '#94A3B8', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="left" tickFormatter={v => `${(v*100).toFixed(0)}%`} tick={{ fill: '#94A3B8', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="right" orientation="right" tick={{ fill: '#94A3B8', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(100,116,139,0.08)' }} />
              <Legend wrapperStyle={{ color: '#94A3B8', fontSize: 11 }} />
              <Bar yAxisId="left" dataKey="avg_risk" name="Avg Risk" fill="#1E88E5" fillOpacity={0.8} radius={[4,4,0,0]}>
                {stats.department_breakdown.map((_, i) => (
                  <Cell key={i} fill={DEPT_COLORS[i % DEPT_COLORS.length]} fillOpacity={0.8} />
                ))}
              </Bar>
              <Bar yAxisId="right" dataKey="high_risk" name="High Risk Count" fill="#d32f2f" fillOpacity={0.5} radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Scholarship effect */}
        <div className="card">
          <h2 className="font-bold text-white mb-1">Scholarship vs Avg Risk</h2>
          <p className="text-xs text-surface-400 mb-4">Correlational comparison — causal CATE available per-student</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={stats.scholarship_breakdown} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,0.15)" />
              <XAxis dataKey="scholarship" tick={{ fill: '#94A3B8', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={v => `${(v * 100).toFixed(0)}%`} tick={{ fill: '#94A3B8', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(100,116,139,0.08)' }} />
              <Bar dataKey="avg_risk" name="Avg Risk" radius={[6,6,0,0]}>
                {stats.scholarship_breakdown.map((d, i) => (
                  <Cell key={i} fill={d.scholarship === 'Yes' ? '#2e7d32' : '#d32f2f'} fillOpacity={0.8} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Quick action */}
      <div className="flex justify-end">
        <button
          id="view-all-students-btn"
          onClick={() => navigate('/students')}
          className="btn-primary"
        >
          <Users size={16} />
          View All Students
        </button>
      </div>
    </div>
  )
}

function MetricCard({
  id, icon, label, value, sub, accent,
}: {
  id: string; icon: React.ReactNode; label: string
  value: string; sub: string; accent: string
}) {
  return (
    <div className={`metric-card border-l-2 ${accent}`} id={id}>
      <div className="flex items-center gap-2">
        <div className="p-2 rounded-lg bg-surface-700">{icon}</div>
        <p className="text-xs text-surface-400 font-medium">{label}</p>
      </div>
      <p className="text-3xl font-bold text-white font-mono tracking-tight">{value}</p>
      <p className="text-xs text-surface-400">{sub}</p>
    </div>
  )
}
