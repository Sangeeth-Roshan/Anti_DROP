import React, { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { useNavigate } from 'react-router-dom'
import { uploadCSV, fetchSchema } from '../api'
import type { Schema, UploadResponse } from '../types'
import { useUpload } from '../context'
import { ErrorState } from '../components/AppShell'
import { Upload, FileText, CheckCircle, AlertCircle, Loader2, ChevronRight, X } from 'lucide-react'
import Papa from 'papaparse'

// We need papaparse for CSV preview — it's not in our package.json yet, but we handle fallback
// Actually we'll parse client-side with a simple approach

function parseCSVPreview(text: string, maxRows = 5): { headers: string[]; rows: string[][] } {
  const lines = text.trim().split('\n')
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
  const { setUpload } = useUpload()
  const navigate = useNavigate()

  const onDrop = useCallback((accepted: File[]) => {
    const f = accepted[0]
    if (!f) return
    setFile(f)
    setResult(null)
    setError(null)
    setValErrs([])

    // Read and preview
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
    <div className="space-y-6 animate-fade-in max-w-3xl mx-auto">
      <div>
        <h1 className="section-title">Upload CSV</h1>
        <p className="section-sub">
          Upload a student dataset for instant risk scoring, SHAP analysis, and causal intervention estimates.
        </p>
      </div>

      {/* Required columns info */}
      <div className="alert-info">
        <FileText size={16} className="shrink-0 mt-0.5" />
        <div className="text-xs space-y-1">
          <p className="font-semibold text-blue-200">Required CSV columns</p>
          <p className="text-blue-300/80 font-mono">
            Attendance_%, CGPA_10, Backlogs, Credits_Earned, Assignment_Submission_%,
            Average_Exam_Marks_%, Semester, Fee_Status (Paid/Pending),
            Scholarship (Yes/No), Previous_Academic_%, Course (CSE/ECE/EEE/MECH/CIVIL)
          </p>
          <p className="text-blue-300/70">Optional: Student_ID, Credits_Attempted, Dropout (0/1)</p>
        </div>
      </div>

      {/* Success state */}
      {result && (
        <div className="card border border-green-800/50 space-y-4 animate-slide-up">
          <div className="flex items-center gap-3">
            <CheckCircle size={22} className="text-green-400 shrink-0" />
            <div>
              <p className="font-bold text-white">Upload successful!</p>
              <p className="text-xs text-surface-400">{result.total} students scored</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="card-sm">
              <p className="text-2xl font-bold text-red-400 font-mono">{result.high_risk}</p>
              <p className="text-xs text-surface-400">High Risk</p>
            </div>
            <div className="card-sm">
              <p className="text-2xl font-bold text-orange-400 font-mono">{result.moderate_risk}</p>
              <p className="text-xs text-surface-400">Moderate Risk</p>
            </div>
            <div className="card-sm">
              <p className="text-2xl font-bold text-green-400 font-mono">{result.low_risk}</p>
              <p className="text-xs text-surface-400">Low Risk</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              id="go-to-dashboard-btn"
              className="btn-primary"
              onClick={() => navigate('/')}
            >
              View Dashboard <ChevronRight size={16} />
            </button>
            <button
              id="go-to-students-btn"
              className="btn-secondary"
              onClick={() => navigate('/students')}
            >
              View Students
            </button>
          </div>
        </div>
      )}

      {/* Drop zone */}
      {!result && (
        <>
          <div
            {...getRootProps()}
            id="dropzone"
            className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-200 ${
              isDragActive
                ? 'border-primary bg-primary/5 scale-[1.01]'
                : 'border-surface-600 hover:border-primary/50 hover:bg-surface-700/30'
            }`}
          >
            <input {...getInputProps()} id="file-input" />
            <div className="flex flex-col items-center gap-4">
              <div className={`p-4 rounded-2xl transition-colors ${isDragActive ? 'bg-primary/20' : 'bg-surface-700'}`}>
                <Upload size={28} className={isDragActive ? 'text-primary' : 'text-surface-400'} />
              </div>
              {isDragActive ? (
                <p className="text-primary font-semibold">Drop it here…</p>
              ) : (
                <>
                  <div>
                    <p className="text-surface-200 font-semibold">Drag & drop a CSV file</p>
                    <p className="text-surface-400 text-sm mt-1">or click to browse</p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* File selected */}
          {file && (
            <div className="card-sm flex items-center gap-3 animate-fade-in">
              <FileText size={18} className="text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-surface-100 truncate">{file.name}</p>
                <p className="text-xs text-surface-400">{(file.size / 1024).toFixed(1)} KB</p>
              </div>
              <button id="remove-file-btn" onClick={clearFile} className="btn-ghost p-1">
                <X size={16} />
              </button>
            </div>
          )}

          {/* Preview table */}
          {preview && (
            <div className="card overflow-hidden p-0 animate-fade-in">
              <p className="px-4 py-2.5 text-xs font-semibold text-surface-400 uppercase tracking-wider border-b border-surface-700">
                Preview (first 5 rows)
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-surface-800/60 border-b border-surface-700">
                    <tr>
                      {preview.headers.map((h, i) => (
                        <th key={i} className="px-3 py-2 text-left text-surface-400 font-medium whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((row, ri) => (
                      <tr key={ri} className="border-b border-surface-700/50">
                        {row.map((cell, ci) => (
                          <td key={ci} className="px-3 py-2 text-surface-300 whitespace-nowrap font-mono">{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Validation errors */}
          {validationErrors.length > 0 && (
            <div className="card border border-red-800/50 space-y-2 animate-slide-up">
              <div className="flex items-center gap-2">
                <AlertCircle size={16} className="text-red-400 shrink-0" />
                <p className="font-semibold text-red-300 text-sm">Validation failed — fix these before uploading:</p>
              </div>
              <ul className="space-y-1 pl-6">
                {validationErrors.map((e, i) => (
                  <li key={i} className="text-xs text-red-400 list-disc">{e}</li>
                ))}
              </ul>
            </div>
          )}

          {error && <ErrorState message={error} />}

          {file && (
            <button
              id="upload-btn"
              onClick={handleUpload}
              disabled={uploading}
              className="btn-primary w-full justify-center"
            >
              {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              {uploading ? 'Uploading & scoring…' : 'Upload & Score Students'}
            </button>
          )}
        </>
      )}
    </div>
  )
}
