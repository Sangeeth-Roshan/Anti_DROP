import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { fetchStudent } from '../api'
import type { Student } from '../types'
import { useUpload } from '../context'
import { RiskBadge, RiskBar } from '../components/RiskBadge'
import { ShapChart } from '../components/ShapChart'
import { SimulatorPanel } from '../components/SimulatorPanel'
import { SkeletonCard, ErrorState } from '../components/AppShell'
import { ArrowLeft, User, BookOpen, TrendingDown, Activity } from 'lucide-react'

function ProfileRow({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-surface-700 last:border-0">
      <span className="text-xs text-surface-400">{label}</span>
      <span className={`text-sm font-medium ${highlight ? 'text-red-400' : 'text-surface-100'}`}>
        {value}
      </span>
    </div>
  )
}

export function StudentDetail() {
  const { id } = useParams<{ id: string }>()
  const { upload } = useUpload()
  const navigate    = useNavigate()
  const [student, setStudent] = useState<Student | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  const studentIndex = parseInt(id ?? '0', 10)

  useEffect(() => {
    if (isNaN(studentIndex)) return
    setLoading(true); setError(null)
    fetchStudent(upload.upload_id, studentIndex)
      .then(setStudent)
      .catch(e => setError(e.response?.data?.detail ?? e.message))
      .finally(() => setLoading(false))
  }, [upload.upload_id, studentIndex])

  if (loading) return (
    <div className="space-y-6">
      <SkeletonCard rows={4} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SkeletonCard rows={8} />
        <SkeletonCard rows={8} />
      </div>
    </div>
  )

  if (error) return <ErrorState message={error} />
  if (!student) return null

  const pct = Math.round(student.predicted_risk * 100)
  const riskColor =
    student.risk_tier === 'High'     ? '#d32f2f' :
    student.risk_tier === 'Moderate' ? '#f57c00' :
                                       '#2e7d32'

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Back + breadcrumb */}
      <button
        id="back-to-students-btn"
        onClick={() => navigate('/students')}
        className="btn-ghost -ml-2"
      >
        <ArrowLeft size={16} /> Back to Students
      </button>

      {/* Hero risk display */}
      <div className="card bg-gradient-to-br from-surface-800 to-surface-700/60">
        <div className="flex flex-col md:flex-row md:items-center gap-6">
          {/* Risk donut-style */}
          <div className="shrink-0 flex flex-col items-center gap-2">
            <div
              className="w-28 h-28 rounded-full flex flex-col items-center justify-center border-4 shadow-xl"
              style={{ borderColor: riskColor, boxShadow: `0 0 30px ${riskColor}30` }}
              id="risk-circle"
            >
              <span className="text-3xl font-black font-mono text-white">{pct}%</span>
              <span className="text-xs text-surface-400">risk</span>
            </div>
            <RiskBadge tier={student.risk_tier} />
          </div>

          {/* Student info */}
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-white">
              {student.Student_ID ?? `Student #${studentIndex}`}
            </h1>
            <p className="text-surface-400 text-sm mt-1">
              {student.Course} · Semester {student.Semester} · {student.Scholarship === 'Yes' ? '🎓 Scholarship' : 'No Scholarship'}
            </p>
            {student.Dropout !== undefined && (
              <p className={`text-sm mt-2 font-semibold ${student.Dropout ? 'text-red-400' : 'text-green-400'}`}>
                {student.Dropout ? '⚠️ Actual outcome: Dropped out' : '✅ Actual outcome: Retained'}
              </p>
            )}
            <div className="mt-4">
              <div className="flex items-center justify-between text-xs text-surface-400 mb-1.5">
                <span>Dropout probability</span>
                <span className="font-mono font-semibold" style={{ color: riskColor }}>{pct}%</span>
              </div>
              <RiskBar value={student.predicted_risk} />
            </div>
            <p className="text-xs text-surface-400 mt-3">
              <span className="font-semibold text-surface-200">Recommended action:</span> {student.recommended_action}
            </p>
          </div>
        </div>
      </div>

      {/* Two-column body */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Academic profile + SHAP */}
        <div className="space-y-4">
          {/* Academic profile */}
          <div className="card">
            <div className="flex items-center gap-2 mb-3">
              <BookOpen size={16} className="text-primary" />
              <h2 className="font-bold text-white text-sm">Academic Profile</h2>
            </div>
            <ProfileRow label="CGPA" value={`${student.CGPA_10}/10`} highlight={student.CGPA_10 < 5} />
            <ProfileRow label="Backlogs" value={student.Backlogs} highlight={student.Backlogs >= 2} />
            <ProfileRow label="Attendance" value={`${student['Attendance_%']}%`} highlight={student['Attendance_%'] < 65} />
            <ProfileRow label="Assignment Submission" value={`${student['Assignment_Submission_%']}%`} />
            <ProfileRow label="Avg Exam Marks" value={`${student['Average_Exam_Marks_%']}%`} />
            <ProfileRow label="Credits Earned" value={student.Credits_Earned} />
            <ProfileRow label="Previous Academic %" value={`${student['Previous_Academic_%']}%`} />
          </div>

          {/* Financial profile */}
          <div className="card">
            <div className="flex items-center gap-2 mb-3">
              <Activity size={16} className="text-primary" />
              <h2 className="font-bold text-white text-sm">Financial & Aid Status</h2>
            </div>
            <ProfileRow label="Fee Status" value={student.Fee_Status} highlight={student.Fee_Status === 'Pending'} />
            <ProfileRow label="Scholarship" value={student.Scholarship} />
            {student.scholarship_effect !== null && student.scholarship_effect !== undefined ? (
              <ProfileRow
                label="Causal scholarship effect"
                value={`${(student.scholarship_effect * 100).toFixed(1)}% risk change`}
                highlight={student.scholarship_effect > 0}
              />
            ) : (
              <ProfileRow label="Causal scholarship effect" value="N/A (already on scholarship)" />
            )}
          </div>
        </div>

        {/* Right: SHAP chart + Simulator */}
        <div className="space-y-4">
          {/* SHAP friction points */}
          <div className="card">
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown size={16} className="text-primary" />
              <h2 className="font-bold text-white text-sm">Friction Points (SHAP)</h2>
            </div>
            <p className="text-xs text-surface-400 mb-3">
              Red = increases dropout risk · Green = reduces it. Based on SHAP TreeExplainer — correlational, not causal.
            </p>
            <ShapChart
              data={student.shap_breakdown ?? student.top_risk_factors}
              maxItems={12}
              height={300}
            />
          </div>

          {/* Simulator */}
          <SimulatorPanel
            uploadId={upload.upload_id}
            studentIndex={studentIndex}
            baseRisk={student.predicted_risk}
            scholarship={student.Scholarship}
            cate={student.scholarship_effect}
          />
        </div>
      </div>
    </div>
  )
}
