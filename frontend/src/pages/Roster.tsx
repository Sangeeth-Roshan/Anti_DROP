import React, { useEffect, useState, useCallback } from 'react'
import { fetchRoster, rosterCsvUrl } from '../api'
import type { RosterStudent } from '../types'
import { useUpload } from '../context'
import { RiskBadge } from '../components/RiskBadge'
import { SkeletonTable, ErrorState } from '../components/AppShell'
import { Download, Filter } from 'lucide-react'

const DEPARTMENTS  = ['CSE', 'ECE', 'EEE', 'MECH', 'CIVIL']
const ACTION_TYPES = ['Scholarship', 'Financial Relief', 'Remedial Tutoring', 'Attendance Warning', 'Stable']

function ActionChip({ action }: { action: string }) {
  const parts = action.split(' + ')
  return (
    <div className="flex flex-wrap gap-1">
      {parts.map((p, i) => {
        const color =
          p === 'Stable'             ? 'bg-green-950 text-green-400 border-green-800' :
          p === 'Scholarship'        ? 'bg-blue-950 text-blue-400 border-blue-800' :
          p === 'Financial Relief'   ? 'bg-purple-950 text-purple-400 border-purple-800' :
          p === 'Remedial Tutoring'  ? 'bg-yellow-950 text-yellow-400 border-yellow-800' :
          p === 'Attendance Warning' ? 'bg-orange-950 text-orange-400 border-orange-800' :
                                       'bg-surface-700 text-surface-300 border-surface-600'
        return (
          <span key={i} className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${color}`}>
            {p}
          </span>
        )
      })}
    </div>
  )
}

export function Roster() {
  const { upload } = useUpload()
  const [roster, setRoster]       = useState<RosterStudent[]>([])
  const [total, setTotal]         = useState(0)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [deptFilter, setDeptFilter] = useState('')
  const [actionFilter, setActionFilter] = useState('')

  const load = useCallback(() => {
    setLoading(true); setError(null)
    fetchRoster(upload.upload_id, {
      department:  deptFilter  || undefined,
      action_type: actionFilter || undefined,
    })
      .then(res => { setRoster(res.roster); setTotal(res.total) })
      .catch(e => setError(e.response?.data?.detail ?? e.message))
      .finally(() => setLoading(false))
  }, [upload.upload_id, deptFilter, actionFilter])

  useEffect(() => { load() }, [load])

  const csvUrl = rosterCsvUrl(upload.upload_id, {
    department:  deptFilter  || undefined,
    action_type: actionFilter || undefined,
  })

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="section-title">Faculty Action Roster</h1>
          <p className="section-sub">
            {total} students · sorted by dropout risk · intervention recommendations
          </p>
        </div>
        <a
          id="export-csv-btn"
          href={csvUrl}
          download="antidrop_roster.csv"
          className="btn-secondary"
        >
          <Download size={16} />
          Export CSV
        </a>
      </div>

      {/* Filters */}
      <div className="card-sm flex flex-wrap gap-3 items-center">
        <Filter size={15} className="text-surface-400" />
        <select
          id="roster-dept-filter"
          className="select w-36"
          value={deptFilter}
          onChange={e => setDeptFilter(e.target.value)}
        >
          <option value="">All Departments</option>
          {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <select
          id="roster-action-filter"
          className="select w-48"
          value={actionFilter}
          onChange={e => setActionFilter(e.target.value)}
        >
          <option value="">All Actions</option>
          {ACTION_TYPES.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        {(deptFilter || actionFilter) && (
          <button
            id="roster-clear-btn"
            className="btn-ghost"
            onClick={() => { setDeptFilter(''); setActionFilter('') }}
          >
            Clear
          </button>
        )}
      </div>

      {error && <ErrorState message={error} />}

      {loading ? (
        <SkeletonTable rows={8} />
      ) : (
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-surface-700 bg-surface-800/60">
                <tr>
                  <th className="table-header">Student ID</th>
                  <th className="table-header">Dept</th>
                  <th className="table-header">Sem</th>
                  <th className="table-header">CGPA</th>
                  <th className="table-header">Backlogs</th>
                  <th className="table-header">Attendance</th>
                  <th className="table-header">Fee</th>
                  <th className="table-header">Scholarship</th>
                  <th className="table-header">Risk</th>
                  <th className="table-header">Tier</th>
                  <th className="table-header">Causal Effect</th>
                  <th className="table-header">Actions</th>
                </tr>
              </thead>
              <tbody>
                {roster.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="text-center py-10 text-surface-400">
                      No students match the current filters.
                    </td>
                  </tr>
                ) : roster.map((s, i) => (
                  <tr key={i} className="table-row" id={`roster-row-${s.index}`}>
                    <td className="table-cell font-medium">{s.Student_ID}</td>
                    <td className="table-cell">
                      <span className="px-2 py-0.5 rounded-md bg-surface-700 text-xs font-mono text-surface-300">
                        {s.Course}
                      </span>
                    </td>
                    <td className="table-cell font-mono">{s.Semester}</td>
                    <td className={`table-cell font-mono ${s.CGPA_10 < 5 ? 'text-red-400' : ''}`}>
                      {s.CGPA_10?.toFixed(2)}
                    </td>
                    <td className={`table-cell font-mono ${s.Backlogs >= 2 ? 'text-red-400 font-semibold' : ''}`}>
                      {s.Backlogs}
                    </td>
                    <td className={`table-cell font-mono ${s['Attendance_%'] < 65 ? 'text-orange-400' : ''}`}>
                      {s['Attendance_%']}%
                    </td>
                    <td className={`table-cell text-xs ${s.Fee_Status === 'Pending' ? 'text-orange-400 font-semibold' : 'text-surface-400'}`}>
                      {s.Fee_Status}
                    </td>
                    <td className={`table-cell text-xs ${s.Scholarship === 'Yes' ? 'text-green-400' : 'text-surface-400'}`}>
                      {s.Scholarship}
                    </td>
                    <td className="table-cell font-mono text-xs">
                      {(s.predicted_risk * 100).toFixed(1)}%
                    </td>
                    <td className="table-cell">
                      <RiskBadge tier={s.risk_tier} />
                    </td>
                    <td className="table-cell text-xs font-mono">
                      {s.scholarship_effect !== null && s.scholarship_effect !== undefined ? (
                        <span className={s.scholarship_effect < 0 ? 'text-green-400' : 'text-red-400'}>
                          {s.scholarship_effect >= 0 ? '+' : ''}{(s.scholarship_effect * 100).toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-surface-500">—</span>
                      )}
                    </td>
                    <td className="table-cell min-w-[180px]">
                      <ActionChip action={s.recommended_action} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
