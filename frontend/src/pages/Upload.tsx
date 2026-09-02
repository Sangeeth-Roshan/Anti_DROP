import React, { useCallback, useEffect, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { useNavigate } from 'react-router-dom'
import { uploadCSV, fetchSchema } from '../api'
import type { Schema, UploadResponse } from '../types'
import { useUpload } from '../context'
import { ErrorState } from '../components/AppShell'
import {
  Upload, FileText, CheckCircle, AlertCircle, Loader2,
  ChevronRight, X, Download, Copy, Check, Info, Table
} from 'lucide-react'

// Canonical sample CSV with Student_ID as the very first column
const SAMPLE_CSV_CONTENT = `Student_ID,Attendance_%,CGPA_10,Backlogs,Credits_Earned,Credits_Attempted,Assignment_Submission_%,Average_Exam_Marks_%,Semester,Fee_Status,Scholarship,Previous_Academic_%,Course,Dropout
S0001,84.0,7.91,0,12,24,95.1,61.1,4,Paid,No,84.2,CSE,0
S0002,76.3,9.09,0,18,24,88.2,93.5,2,Paid,Yes,68.1,EEE,0
S0003,85.8,5.12,2,24,24,92.1,67.8,5,Paid,No,83.5,ECE,0
S0004,62.4,5.48,3,15,24,65.0,52.3,3,Pending,No,71.0,MECH,1
S0005,91.2,8.35,0,21,24,90.5,82.4,4,Paid,Yes,89.0,CIVIL,0`

const CSV_HEADER_ROW = "Student_ID,Attendance_%,CGPA_10,Backlogs,Credits_Earned,Credits_Attempted,Assignment_Submission_%,Average_Exam_Marks_%,Semester,Fee_Status,Scholarship,Previous_Academic_%,Course,Dropout"

function parseCSVPreview(text: string, maxRows = 5): { headers: string[]; rows: string[][] } {
  const lines = text.trim().split(/\r?\n/)
  const headers = lines[0]?.split(',').map(h => h.trim().replace(/^"|"$/g, '')) ?? []
  const rows = lines.slice(1, maxRows + 1).map(l =>
    l.split(',').map(v => v.trim().replace(/^"|"$/g, ''))
  )
  return { headers, rows }
}

export function UploadPage() {
  const [file, setFile]               = useState<File | null>(null)
  const [preview, setPreview]         = useState<{ headers: string[]; rows: string[][] } | null>(null)
  const [validationErrors, setValErrs] = useState<string[]>([])
  const [uploading, setUploading]      = useState(false)
  const [result, setResult]            = useState<UploadResponse | null>(null)
  const [error, setError]              = useState<string | null>(null)
  const [copied, setCopied]            = useState(false)
  const [schema, setSchema]            = useState<Schema | null>(null)
  const { setUpload } = useUpload()
  const navigate = useNavigate()

  useEffect(() => {
    fetchSchema()
      .then(s => setSchema(s))
      .catch(() => {
        // Fallback default schema if backend isn't reachable immediately
        setSchema({
          numeric_cols: [
            "Attendance_%", "CGPA_10", "Backlogs", "Credits_Earned",
            "Assignment_Submission_%", "Average_Exam_Marks_%", "Semester", "Previous_Academic_%"
          ],
          categorical_cols: ["Fee_Status", "Scholarship", "Course"],
          target_col: "Dropout",
          allowed_values: {
            "Fee_Status": ["Paid", "Pending"],
            "Scholarship": ["No", "Yes"],
            "Course": ["CIVIL", "CSE", "ECE", "EEE", "MECH"]
          },
          dtypes: {}
        })
      })
  }, [])

  const allowedCategoricals = schema?.allowed_values ?? {
    "Fee_Status": ["Paid", "Pending"],
    "Scholarship": ["No", "Yes"],
    "Course": ["CIVIL", "CSE", "ECE", "EEE", "MECH"]
  }

  const onDrop = useCallback((accepted: File[]) => {
    const f = accepted[0]
    if (!f) return
    setFile(f)
    setResult(null)
    setError(null)
    setValErrs([])

    const reader = new FileReader()
    reader.onload = e => {
      const text = e.target?.result as string
      const p    = parseCSVPreview(text, 5)
      setPreview(p)
    }
    reader.readAsText(f)
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv'] },
    multiple: false,
  })

  function clearFile() {
    setFile(null); setPreview(null); setResult(null); setError(null); setValErrs([])
  }

  function handleCopyHeaders() {
    navigator.clipboard.writeText(CSV_HEADER_ROW)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleDownloadTemplate() {
    const blob = new Blob([SAMPLE_CSV_CONTENT], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', 'antidrop_sample_template.csv')
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Check preview cells for invalid categorical values
  function isCellInvalid(header: string, val: string): boolean {
    const allowed = allowedCategoricals[header]
    if (allowed) {
      return !allowed.map(a => a.toLowerCase()).includes(val.trim().toLowerCase())
    }
    return false
  }

  // Inspect preview for quick warnings
  const previewViolations = React.useMemo(() => {
    if (!preview) return []
    const violations: string[] = []
    preview.headers.forEach((h, colIdx) => {
      const allowed = allowedCategoricals[h]
      if (allowed) {
        preview.rows.forEach((r, rowIdx) => {
          const val = r[colIdx]
          if (val && !allowed.map(a => a.toLowerCase()).includes(val.trim().toLowerCase())) {
            const msg = `Row ${rowIdx + 1} "${h}": "${val}" is invalid. Allowed: ${allowed.join(', ')}`
            if (!violations.includes(msg) && violations.length < 5) {
              violations.push(msg)
            }
          }
        })
      }
    })
    return violations
  }, [preview, allowedCategoricals])

  async function handleUpload() {
    if (!file) return
    setUploading(true); setError(null); setValErrs([])
    try {
      const res = await uploadCSV(file)
      setResult(res)
      setUpload({
        upload_id: res.upload_id,
        label:     `Your upload (${file.name})`,
        total:     res.total,
      })
    } catch (e: any) {
      const detail = e.response?.data?.detail
      if (detail && typeof detail === 'object' && detail.validation_errors) {
        setValErrs(detail.validation_errors)
      } else if (typeof detail === 'string') {
        setError(detail)
      } else {
        setError('Upload failed. Check backend is running.')
      }
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-7 animate-fade-in max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="section-title">Upload Cohort Data</h1>
        <p className="section-sub">
          Score university cohorts, compute individual SHAP friction points, and estimate causal scholarship impacts.
        </p>
      </div>

      {/* CSV Starting column and Format Callout */}
      <div className="card bg-gradient-to-r from-surface-800 to-surface-700/60 border-primary/30 p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-white font-bold text-sm">
            <span className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-mono">1</span>
            <span>CSV Column Order — Starts with <code className="text-primary bg-primary/10 px-2 py-0.5 rounded font-mono text-sm">Student_ID</code></span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyHeaders}
              className="btn-secondary py-1.5 px-3 text-xs"
              title="Copy CSV Header Row"
            >
              {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
              {copied ? 'Copied!' : 'Copy Headers'}
            </button>
            <button
              onClick={handleDownloadTemplate}
              className="btn-primary py-1.5 px-3 text-xs"
              title="Download pre-formatted sample CSV"
            >
              <Download size={14} />
              Download CSV Template
            </button>
          </div>
        </div>

        <p className="text-xs text-surface-300 leading-relaxed">
          The dataset starts with <strong className="text-white">Student_ID</strong> as the leading column, followed by 11 academic and financial features. The <code className="text-surface-300 font-mono">Dropout</code> column is optional (used for historical comparison).
        </p>

        {/* Code snippet showing full sequence */}
        <div className="bg-surface-900/90 rounded-xl p-3 border border-surface-700/80 overflow-x-auto">
          <p className="text-[11px] font-mono text-surface-400 mb-1 font-semibold uppercase tracking-wider">Exact Header Sequence:</p>
          <code className="text-xs font-mono text-blue-300 whitespace-nowrap block selection:bg-primary/40">
            <span className="text-yellow-300 font-bold">Student_ID</span>,Attendance_%,CGPA_10,Backlogs,Credits_Earned,Credits_Attempted,Assignment_Submission_%,Average_Exam_Marks_%,Semester,<span className="text-green-300 font-bold">Fee_Status</span>,<span className="text-green-300 font-bold">Scholarship</span>,Previous_Academic_%,<span className="text-green-300 font-bold">Course</span>,<span className="text-purple-300 font-bold">Dropout</span>
          </code>
        </div>
      </div>

      {/* Allowed Values & Field Specification Guide */}
      <div className="card space-y-4">
        <div className="flex items-center gap-2 border-b border-surface-700 pb-3">
          <Info size={18} className="text-primary" />
          <h2 className="text-base font-bold text-white">Allowed Values & Field Specifications</h2>
        </div>

        {/* Categorical Strict Values Grid */}
        <div>
          <p className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-2.5">
            Categorical Columns (Strictly Enforced Allowed Values)
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Course */}
            <div className="card-sm bg-surface-900/60 border-surface-700/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-white">Course</span>
                <span className="text-[10px] text-red-400 font-semibold uppercase">Required</span>
              </div>
              <p className="text-xs text-surface-400">Must be one of the 5 engineering departments:</p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {(allowedCategoricals["Course"] || ["CIVIL", "CSE", "ECE", "EEE", "MECH"]).map(val => (
                  <span key={val} className="px-2 py-0.5 rounded bg-surface-700 text-xs font-mono text-primary font-bold border border-surface-600">
                    {val}
                  </span>
                ))}
              </div>
              <p className="text-[11px] text-surface-400 italic">
                Note: Other majors (e.g. AI-DS, Cyber) must be mapped to CSE/ECE.
              </p>
            </div>

            {/* Scholarship */}
            <div className="card-sm bg-surface-900/60 border-surface-700/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-white">Scholarship</span>
                <span className="text-[10px] text-red-400 font-semibold uppercase">Required</span>
              </div>
              <p className="text-xs text-surface-400">Binary status of current financial scholarship:</p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {(allowedCategoricals["Scholarship"] || ["No", "Yes"]).map(val => (
                  <span key={val} className={`px-2.5 py-0.5 rounded text-xs font-mono font-bold border ${val === 'Yes' ? 'bg-green-950 text-green-400 border-green-800' : 'bg-surface-700 text-surface-300 border-surface-600'}`}>
                    {val}
                  </span>
                ))}
              </div>
              <p className="text-[11px] text-surface-400 italic">
                Note: Map Merit / Need-Based to <span className="text-white font-mono">Yes</span>, and None to <span className="text-white font-mono">No</span>.
              </p>
            </div>

            {/* Fee Status */}
            <div className="card-sm bg-surface-900/60 border-surface-700/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-white">Fee_Status</span>
                <span className="text-[10px] text-red-400 font-semibold uppercase">Required</span>
              </div>
              <p className="text-xs text-surface-400">Tuition & institutional fee payment status:</p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {(allowedCategoricals["Fee_Status"] || ["Paid", "Pending"]).map(val => (
                  <span key={val} className={`px-2.5 py-0.5 rounded text-xs font-mono font-bold border ${val === 'Paid' ? 'bg-blue-950 text-blue-400 border-blue-800' : 'bg-orange-950 text-orange-400 border-orange-800'}`}>
                    {val}
                  </span>
                ))}
              </div>
              <p className="text-[11px] text-surface-400 italic">
                Used in faculty intervention logic for fee relief.
              </p>
            </div>
          </div>
        </div>

        {/* Numeric Columns Reference Table */}
        <div>
          <p className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-2">
            Numeric & Target Field Specifications
          </p>
          <div className="overflow-x-auto rounded-xl border border-surface-700">
            <table className="w-full text-xs">
              <thead className="bg-surface-900/80 text-surface-400 border-b border-surface-700">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Column</th>
                  <th className="px-3 py-2 text-left font-semibold">Role</th>
                  <th className="px-3 py-2 text-left font-semibold">Type</th>
                  <th className="px-3 py-2 text-left font-semibold">Expected Range / Format</th>
                  <th className="px-3 py-2 text-left font-semibold">Example</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-700/60 text-surface-300 font-mono">
                <tr className="bg-primary/5">
                  <td className="px-3 py-2 font-bold text-yellow-300">Student_ID</td>
                  <td className="px-3 py-2 text-xs font-sans text-yellow-200">First Column / Identifier</td>
                  <td className="px-3 py-2 text-surface-400">string</td>
                  <td className="px-3 py-2 text-surface-200">Any alphanumeric ID</td>
                  <td className="px-3 py-2 text-surface-400">S0001, STU001</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 text-white">Attendance_%</td>
                  <td className="px-3 py-2 text-xs font-sans text-surface-400">Predictive Feature</td>
                  <td className="px-3 py-2 text-surface-400">float</td>
                  <td className="px-3 py-2 text-surface-200">0.0 to 100.0</td>
                  <td className="px-3 py-2 text-surface-400">84.5</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 text-white">CGPA_10</td>
                  <td className="px-3 py-2 text-xs font-sans text-surface-400">Predictive Feature</td>
                  <td className="px-3 py-2 text-surface-400">float</td>
                  <td className="px-3 py-2 text-surface-200">0.00 to 10.00</td>
                  <td className="px-3 py-2 text-surface-400">7.91</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 text-white">Backlogs</td>
                  <td className="px-3 py-2 text-xs font-sans text-surface-400">Predictive Feature</td>
                  <td className="px-3 py-2 text-surface-400">int</td>
                  <td className="px-3 py-2 text-surface-200">≥ 0 (Active arrears)</td>
                  <td className="px-3 py-2 text-surface-400">0, 2</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 text-white">Credits_Earned</td>
                  <td className="px-3 py-2 text-xs font-sans text-surface-400">Predictive Feature</td>
                  <td className="px-3 py-2 text-surface-400">int</td>
                  <td className="px-3 py-2 text-surface-200">Completed course credits</td>
                  <td className="px-3 py-2 text-surface-400">18</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 text-white">Credits_Attempted</td>
                  <td className="px-3 py-2 text-xs font-sans text-surface-400">Optional</td>
                  <td className="px-3 py-2 text-surface-400">int</td>
                  <td className="px-3 py-2 text-surface-200">Total registered credits</td>
                  <td className="px-3 py-2 text-surface-400">24</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 text-white">Assignment_Submission_%</td>
                  <td className="px-3 py-2 text-xs font-sans text-surface-400">Predictive Feature</td>
                  <td className="px-3 py-2 text-surface-400">float</td>
                  <td className="px-3 py-2 text-surface-200">0.0 to 100.0</td>
                  <td className="px-3 py-2 text-surface-400">95.0</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 text-white">Average_Exam_Marks_%</td>
                  <td className="px-3 py-2 text-xs font-sans text-surface-400">Predictive Feature</td>
                  <td className="px-3 py-2 text-surface-400">float</td>
                  <td className="px-3 py-2 text-surface-200">0.0 to 100.0</td>
                  <td className="px-3 py-2 text-surface-400">68.4</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 text-white">Semester</td>
                  <td className="px-3 py-2 text-xs font-sans text-surface-400">Predictive Feature</td>
                  <td className="px-3 py-2 text-surface-400">int</td>
                  <td className="px-3 py-2 text-surface-200">1 to 8</td>
                  <td className="px-3 py-2 text-surface-400">4</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 text-white">Previous_Academic_%</td>
                  <td className="px-3 py-2 text-xs font-sans text-surface-400">Predictive Feature</td>
                  <td className="px-3 py-2 text-surface-400">float</td>
                  <td className="px-3 py-2 text-surface-200">0.0 to 100.0</td>
                  <td className="px-3 py-2 text-surface-400">84.2</td>
                </tr>
                <tr className="bg-purple-950/20">
                  <td className="px-3 py-2 font-bold text-purple-300">Dropout</td>
                  <td className="px-3 py-2 text-xs font-sans text-purple-200">Optional Target</td>
                  <td className="px-3 py-2 text-surface-400">int / binary</td>
                  <td className="px-3 py-2 text-surface-200">0 (Retained) or 1 (Dropout) [or No/Yes]</td>
                  <td className="px-3 py-2 text-surface-400">0, 1</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Success State */}
      {result && (
        <div className="card border border-green-800/50 space-y-4 animate-slide-up">
          <div className="flex items-center gap-3">
            <CheckCircle size={24} className="text-green-400 shrink-0" />
            <div>
              <p className="font-bold text-white text-base">Upload & Model Scoring Successful!</p>
              <p className="text-xs text-surface-400">{result.total} students processed with SHAP & CATE causal inference</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="card-sm">
              <p className="text-2xl font-bold text-red-400 font-mono">{result.high_risk}</p>
              <p className="text-xs text-surface-400">High Risk (≥ 65%)</p>
            </div>
            <div className="card-sm">
              <p className="text-2xl font-bold text-orange-400 font-mono">{result.moderate_risk}</p>
              <p className="text-xs text-surface-400">Moderate Risk (35-65%)</p>
            </div>
            <div className="card-sm">
              <p className="text-2xl font-bold text-green-400 font-mono">{result.low_risk}</p>
              <p className="text-xs text-surface-400">Low Risk (&lt; 35%)</p>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              id="go-to-dashboard-btn"
              className="btn-primary"
              onClick={() => navigate('/')}
            >
              Explore Dashboard <ChevronRight size={16} />
            </button>
            <button
              id="go-to-students-btn"
              className="btn-secondary"
              onClick={() => navigate('/students')}
            >
              Browse Student List
            </button>
            <button
              id="go-to-roster-btn"
              className="btn-secondary"
              onClick={() => navigate('/roster')}
            >
              Faculty Action Roster
            </button>
          </div>
        </div>
      )}

      {/* Drop zone */}
      {!result && (
        <div className="space-y-4">
          <div
            {...getRootProps()}
            id="dropzone"
            className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-200 ${
              isDragActive
                ? 'border-primary bg-primary/5 scale-[1.01]'
                : 'border-surface-600 hover:border-primary/50 hover:bg-surface-700/30'
            }`}
          >
            <input {...getInputProps()} id="file-input" />
            <div className="flex flex-col items-center gap-3">
              <div className={`p-4 rounded-2xl transition-colors ${isDragActive ? 'bg-primary/20' : 'bg-surface-700'}`}>
                <Upload size={28} className={isDragActive ? 'text-primary' : 'text-surface-400'} />
              </div>
              {isDragActive ? (
                <p className="text-primary font-semibold">Drop CSV file here…</p>
              ) : (
                <>
                  <p className="text-surface-200 font-semibold text-base">Drag & drop your CSV file here</p>
                  <p className="text-surface-400 text-xs">
                    or click to browse your computer (.csv files)
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Selected File Card */}
          {file && (
            <div className="card-sm flex items-center gap-3 animate-fade-in bg-surface-800">
              <FileText size={20} className="text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-surface-100 truncate">{file.name}</p>
                <p className="text-xs text-surface-400">{(file.size / 1024).toFixed(1)} KB · Ready to validate & upload</p>
              </div>
              <button id="remove-file-btn" onClick={clearFile} className="btn-ghost p-1.5" title="Remove file">
                <X size={16} />
              </button>
            </div>
          )}

          {/* In-preview warnings if invalid categorical values detected */}
          {previewViolations.length > 0 && (
            <div className="alert-warn text-xs space-y-1 animate-slide-up">
              <div className="flex items-center gap-1.5 font-bold text-yellow-300">
                <AlertCircle size={15} />
                <span>Detected Categorical Incompatibilities in Preview:</span>
              </div>
              <ul className="list-disc pl-5 space-y-0.5 text-yellow-200/90">
                {previewViolations.map((v, i) => (
                  <li key={i}>{v}</li>
                ))}
              </ul>
              <p className="text-yellow-300/70 pt-1">
                Please edit your CSV values to match the allowed categories shown above before submitting.
              </p>
            </div>
          )}

          {/* Preview Table */}
          {preview && (
            <div className="card overflow-hidden p-0 animate-fade-in space-y-0">
              <div className="px-4 py-2.5 bg-surface-800/80 border-b border-surface-700 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Table size={15} className="text-surface-400" />
                  <span className="text-xs font-semibold text-surface-300 uppercase tracking-wider">
                    CSV Preview (First {preview.rows.length} Rows)
                  </span>
                </div>
                {preview.headers[0] === "Student_ID" ? (
                  <span className="text-[11px] font-mono text-green-400 flex items-center gap-1">
                    <Check size={12} /> Starts with Student_ID
                  </span>
                ) : (
                  <span className="text-[11px] font-mono text-yellow-400">
                    Leading column: {preview.headers[0]}
                  </span>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-surface-900/60 border-b border-surface-700">
                    <tr>
                      {preview.headers.map((h, i) => (
                        <th key={i} className={`px-3 py-2 text-left whitespace-nowrap font-mono ${
                          h === "Student_ID" ? "text-yellow-300 font-bold" :
                          allowedCategoricals[h] ? "text-green-300" : "text-surface-400 font-medium"
                        }`}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((row, ri) => (
                      <tr key={ri} className="border-b border-surface-700/40 hover:bg-surface-700/20">
                        {row.map((cell, ci) => {
                          const h = preview.headers[ci]
                          const invalid = h && isCellInvalid(h, cell)
                          return (
                            <td
                              key={ci}
                              className={`px-3 py-2 whitespace-nowrap font-mono ${
                                invalid
                                  ? "bg-red-950/70 text-red-300 font-bold border border-red-800"
                                  : "text-surface-300"
                              }`}
                              title={invalid ? `Invalid ${h} value! Allowed: ${allowedCategoricals[h]?.join(', ')}` : undefined}
                            >
                              {cell}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Backend Validation Errors */}
          {validationErrors.length > 0 && (
            <div className="card border border-red-800/80 bg-red-950/40 space-y-2.5 animate-slide-up">
              <div className="flex items-center gap-2">
                <AlertCircle size={18} className="text-red-400 shrink-0" />
                <p className="font-bold text-red-200 text-sm">Upload Rejected — Schema Validation Failed</p>
              </div>
              <ul className="space-y-1.5 pl-6">
                {validationErrors.map((e, i) => (
                  <li key={i} className="text-xs text-red-300 list-disc font-mono">{e}</li>
                ))}
              </ul>
              <p className="text-xs text-surface-400 pt-1">
                Tip: Click <strong>"Download CSV Template"</strong> above to see a sample dataset matching all expected columns and valid categorical values.
              </p>
            </div>
          )}

          {error && <ErrorState message={error} />}

          {/* Submit Button */}
          {file && (
            <button
              id="upload-btn"
              onClick={handleUpload}
              disabled={uploading}
              className="btn-primary w-full justify-center py-3 text-base shadow-xl"
            >
              {uploading ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
              {uploading ? 'Validating, Scoring & Estimating Causal Effects…' : 'Upload & Score Cohort'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
