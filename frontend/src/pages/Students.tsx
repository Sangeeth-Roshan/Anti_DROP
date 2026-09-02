import React, { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchStudents } from '../api'
import type { Student } from '../types'
import { useUpload } from '../context'
import { RiskBadge, RiskBar } from '../components/RiskBadge'
import { SkeletonTable, ErrorState } from '../components/AppShell'
import { Search, ChevronLeft, ChevronRight, Filter, ArrowUpDown } from 'lucide-react'

const DEPARTMENTS = ['CSE', 'ECE', 'EEE', 'MECH', 'CIVIL']
const TIERS       = ['High', 'Moderate', 'Low']

export function Students() {
  const { upload } = useUpload()
  const navigate    = useNavigate()
  const [students, setStudents] = useState<Student[]>([])
  const [total, setTotal]       = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [page, setPage]         = useState(1)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)

  // Filters
  const [search, setSearch]         = useState('')
  const [tierFilter, setTierFilter]   = useState('')
  const [deptFilter, setDeptFilter]   = useState('')
  const [sortBy, setSortBy]           = useState('predicted_risk')
  const [sortDir, setSortDir]         = useState('desc')

  const load = useCallback(() => {
    setLoading(true); setError(null)
    fetchStudents(upload.upload_id, {
      page,
      page_size: 25,
      risk_tier:  tierFilter || undefined,
      department: deptFilter || undefined,
      search:     search || undefined,
      sort_by:    sortBy,
      sort_dir:   sortDir,
    })
      .then(res => {
        setStudents(res.students)
        setTotal(res.total)
        setTotalPages(res.total_pages)
      })
      .catch(e => setError(e.response?.data?.detail ?? e.message))
      .finally(() => setLoading(false))
  }, [upload.upload_id, page, tierFilter, deptFilter, search, sortBy, sortDir])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [tierFilter, deptFilter, search, sortBy, sortDir, upload.upload_id])

  function toggleSort(col: string) {
    if (sortBy === col) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    } else {
      setSortBy(col); setSortDir('desc')
    }
  }

  const SortIcon = ({ col }: { col: string }) => (
    <ArrowUpDown size={12} className={`ml-1 inline ${sortBy === col ? 'text-primary' : 'text-surface-500'}`} />
  )

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="section-title">Students</h1>
          <p className="section-sub">{total} students · page {page} of {totalPages}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="card-sm flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
          <input
            id="student-search"
            type="text"
            placeholder="Search student ID…"
            className="input pl-9"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          id="tier-filter"
          className="select w-36"
          value={tierFilter}
          onChange={e => setTierFilter(e.target.value)}
        >
          <option value="">All Tiers</option>
          {TIERS.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select
          id="dept-filter"
          className="select w-32"
          value={deptFilter}
          onChange={e => setDeptFilter(e.target.value)}
        >
          <option value="">All Depts</option>
          {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        {(tierFilter || deptFilter || search) && (
          <button
            id="clear-filters-btn"
            className="btn-ghost"
            onClick={() => { setTierFilter(''); setDeptFilter(''); setSearch('') }}
          >
            Clear filters
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
                  <th className="table-header">#</th>
                  <th className="table-header">Student ID</th>
                  <th className="table-header cursor-pointer hover:text-surface-200" onClick={() => toggleSort('Course')}>
                    Dept <SortIcon col="Course" />
                  </th>
                  <th className="table-header cursor-pointer hover:text-surface-200" onClick={() => toggleSort('CGPA_10')}>
                    CGPA <SortIcon col="CGPA_10" />
                  </th>
                  <th className="table-header cursor-pointer hover:text-surface-200" onClick={() => toggleSort('Backlogs')}>
                    Backlogs <SortIcon col="Backlogs" />
                  </th>
                  <th className="table-header cursor-pointer hover:text-surface-200" onClick={() => toggleSort('predicted_risk')}>
                    Risk <SortIcon col="predicted_risk" />
                  </th>
                  <th className="table-header">Tier</th>
                  <th className="table-header">Action</th>
                </tr>
              </thead>
              <tbody>
                {students.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-surface-400">
                      No students match the current filters.
                    </td>
                  </tr>
                ) : students.map((s, i) => {
                  const idx = s.index ?? ((page - 1) * 25 + i)
                  return (
                    <tr
                      key={idx}
                      className="table-row"
                      id={`student-row-${idx}`}
                      onClick={() => navigate(`/students/${idx}`)}
                    >
                      <td className="table-cell text-surface-500 font-mono text-xs">{idx}</td>
                      <td className="table-cell font-medium">{s.Student_ID ?? `#${idx}`}</td>
                      <td className="table-cell">
                        <span className="px-2 py-0.5 rounded-md bg-surface-700 text-xs font-mono text-surface-300">
                          {s.Course}
                        </span>
                      </td>
                      <td className="table-cell font-mono">{(s.CGPA_10 as number)?.toFixed(2)}</td>
                      <td className="table-cell font-mono">
                        <span className={s.Backlogs > 2 ? 'text-red-400 font-semibold' : 'text-surface-200'}>
                          {s.Backlogs}
                        </span>
                      </td>
                      <td className="table-cell min-w-[120px]">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs w-9 shrink-0">{(s.predicted_risk * 100).toFixed(1)}%</span>
                          <RiskBar value={s.predicted_risk} />
                        </div>
                      </td>
                      <td className="table-cell">
                        <RiskBadge tier={s.risk_tier} />
                      </td>
                      <td className="table-cell text-xs text-surface-400 max-w-[140px] truncate">
                        {s.recommended_action}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-surface-700">
            <p className="text-xs text-surface-400">{total} results</p>
            <div className="flex items-center gap-2">
              <button
                id="prev-page-btn"
                className="btn-ghost px-2 py-1.5"
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-xs text-surface-300 font-mono">
                {page} / {totalPages}
              </span>
              <button
                id="next-page-btn"
                className="btn-ghost px-2 py-1.5"
                disabled={page === totalPages}
                onClick={() => setPage(p => p + 1)}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
