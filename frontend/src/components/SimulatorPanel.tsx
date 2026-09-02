import React, { useState } from 'react'
import { simulate } from '../api'
import type { SimulateRequest, SimulateResponse } from '../types'
import { RiskBadge, RiskBar } from './RiskBadge'
import { AlertCircle, Info, Loader2, Zap } from 'lucide-react'

interface Props {
  uploadId:    string
  studentIndex: number
  baseRisk:    number
  scholarship: string   // 'Yes' | 'No'
  cate:        number | null
}

export function SimulatorPanel({ uploadId, studentIndex, baseRisk, scholarship, cate }: Props) {
  const [form, setForm] = useState<SimulateRequest>({
    scholarship:           false,
    tutoring_hours:        0,
    attendance_counseling: false,
    fee_relief:            false,
  })
  const [result, setResult]   = useState<SimulateResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const alreadyOnScholarship = scholarship === 'Yes'

  async function runSim() {
    setLoading(true); setError(null)
    try {
      const res = await simulate(uploadId, studentIndex, form)
      setResult(res)
    } catch (e: any) {
      setError(e.response?.data?.detail ?? 'Simulation failed')
    } finally {
      setLoading(false)
    }
  }

  const riskChange = result ? result.risk_change : 0

  return (
    <div className="card space-y-5 animate-slide-up">
      <div className="flex items-center gap-2">
        <Zap className="text-primary" size={18} />
        <h3 className="font-bold text-white text-base">What-If Intervention Simulator</h3>
      </div>

      {/* Levers */}
      <div className="space-y-4">
        {/* Scholarship */}
        <div className={`flex items-start gap-3 p-3 rounded-xl transition-colors ${
          alreadyOnScholarship ? 'bg-surface-700/40 opacity-60' : 'bg-surface-700/60 hover:bg-surface-700'
        }`}>
          <input
            id="sim-scholarship"
            type="checkbox"
            className="mt-0.5 accent-primary w-4 h-4 cursor-pointer"
            checked={form.scholarship}
            disabled={alreadyOnScholarship}
            onChange={e => setForm(f => ({ ...f, scholarship: e.target.checked }))}
          />
          <div className="flex-1 min-w-0">
            <label htmlFor="sim-scholarship" className={`text-sm font-medium block ${alreadyOnScholarship ? 'text-surface-400' : 'text-surface-100 cursor-pointer'}`}>
              Grant Scholarship
            </label>
            <p className="text-xs text-surface-400 mt-0.5">
              {alreadyOnScholarship
                ? 'Already receiving scholarship'
                : cate !== null
                  ? `Causal estimate: ${(cate * 100).toFixed(1)}% risk change (EconML CATE)`
                  : 'Causal estimate unavailable'}
            </p>
          </div>
          <span className="text-xs text-blue-400 font-mono bg-blue-950/50 px-2 py-0.5 rounded">causal</span>
        </div>

        {/* Tutoring */}
        <div className="bg-surface-700/60 hover:bg-surface-700 p-3 rounded-xl transition-colors">
          <div className="flex items-center gap-3 mb-2">
            <input
              id="sim-tutoring"
              type="checkbox"
              className="accent-primary w-4 h-4 cursor-pointer"
              checked={form.tutoring_hours > 0}
              onChange={e => setForm(f => ({ ...f, tutoring_hours: e.target.checked ? 5 : 0 }))}
            />
            <label htmlFor="sim-tutoring" className="text-sm font-medium text-surface-100 flex-1 cursor-pointer">
              Remedial Tutoring
            </label>
            <span className="text-xs text-yellow-400 font-mono bg-yellow-950/50 px-2 py-0.5 rounded">heuristic</span>
          </div>
          {form.tutoring_hours > 0 && (
            <div className="pl-7 space-y-1">
              <div className="flex items-center justify-between text-xs text-surface-400">
                <span>Hours / week</span>
                <span className="font-mono text-surface-200">{form.tutoring_hours.toFixed(0)} hr</span>
              </div>
              <input
                type="range"
                min={1} max={10} step={1}
                value={form.tutoring_hours}
                onChange={e => setForm(f => ({ ...f, tutoring_hours: Number(e.target.value) }))}
                className="w-full accent-primary cursor-pointer"
              />
              <p className="text-xs text-surface-400">
                ~{(form.tutoring_hours * 4.5).toFixed(0)}% reduction (4.5%/hr — heuristic)
              </p>
            </div>
          )}
        </div>

        {/* Attendance counseling */}
        <div className="flex items-start gap-3 bg-surface-700/60 hover:bg-surface-700 p-3 rounded-xl transition-colors">
          <input
            id="sim-attendance"
            type="checkbox"
            className="mt-0.5 accent-primary w-4 h-4 cursor-pointer"
            checked={form.attendance_counseling}
            onChange={e => setForm(f => ({ ...f, attendance_counseling: e.target.checked }))}
          />
          <div className="flex-1">
            <label htmlFor="sim-attendance" className="text-sm font-medium text-surface-100 cursor-pointer block">
              Attendance Counseling
            </label>
            <p className="text-xs text-surface-400 mt-0.5">~8% flat reduction — heuristic estimate</p>
          </div>
          <span className="text-xs text-yellow-400 font-mono bg-yellow-950/50 px-2 py-0.5 rounded">heuristic</span>
        </div>

        {/* Fee relief */}
        <div className="flex items-start gap-3 bg-surface-700/60 hover:bg-surface-700 p-3 rounded-xl transition-colors">
          <input
            id="sim-fee"
            type="checkbox"
            className="mt-0.5 accent-primary w-4 h-4 cursor-pointer"
            checked={form.fee_relief}
            onChange={e => setForm(f => ({ ...f, fee_relief: e.target.checked }))}
          />
          <div className="flex-1">
            <label htmlFor="sim-fee" className="text-sm font-medium text-surface-100 cursor-pointer block">
              Fee Relief / Waiver
            </label>
            <p className="text-xs text-surface-400 mt-0.5">~6% flat reduction — heuristic estimate</p>
          </div>
          <span className="text-xs text-yellow-400 font-mono bg-yellow-950/50 px-2 py-0.5 rounded">heuristic</span>
        </div>
      </div>

      <button
        id="simulate-btn"
        onClick={runSim}
        disabled={loading}
        className="btn-primary w-full justify-center"
      >
        {loading ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
        {loading ? 'Simulating…' : 'Simulate Interventions'}
      </button>

      {error && (
        <div className="alert-error">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-4 pt-2 border-t border-surface-700 animate-slide-up">
          <div className="grid grid-cols-2 gap-4">
            <div className="card-sm text-center">
              <p className="text-xs text-surface-400 mb-1">Original Risk</p>
              <p className="text-2xl font-bold text-white font-mono">
                {(result.original_risk * 100).toFixed(1)}%
              </p>
              <RiskBar value={result.original_risk} />
            </div>
            <div className="card-sm text-center">
              <p className="text-xs text-surface-400 mb-1">Simulated Risk</p>
              <p className={`text-2xl font-bold font-mono ${riskChange < 0 ? 'text-green-400' : riskChange > 0 ? 'text-red-400' : 'text-white'}`}>
                {(result.simulated_risk * 100).toFixed(1)}%
              </p>
              <RiskBar value={result.simulated_risk} />
            </div>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-surface-400">Net change</span>
            <span className={`font-semibold font-mono ${riskChange < 0 ? 'text-green-400' : riskChange > 0 ? 'text-red-400' : 'text-surface-200'}`}>
              {riskChange >= 0 ? '+' : ''}{(riskChange * 100).toFixed(1)}%
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-surface-400">New tier</span>
            <RiskBadge tier={result.risk_tier} />
          </div>

          {/* Breakdown */}
          {result.breakdown.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-surface-400 uppercase tracking-wider">Effect Breakdown</p>
              {result.breakdown.map((b, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <span className={`shrink-0 mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono ${
                    b.method.includes('causal') ? 'bg-blue-950/70 text-blue-400' : 'bg-yellow-950/70 text-yellow-400'
                  }`}>
                    {b.method.includes('causal') ? 'causal' : 'heuristic'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className="text-surface-200">{b.lever}: </span>
                    <span className={b.effect < 0 ? 'text-green-400' : 'text-red-400'}>
                      {b.effect >= 0 ? '+' : ''}{(b.effect * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="alert-info text-xs">
            <Info size={14} className="shrink-0 mt-0.5" />
            <span>{result.disclaimer}</span>
          </div>
        </div>
      )}
    </div>
  )
}
