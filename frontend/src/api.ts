import axios from 'axios'
import type {
  CohortStats,
  RosterResponse,
  Schema,
  SimulateRequest,
  SimulateResponse,
  Student,
  StudentListResponse,
  UploadResponse,
} from './types'

const api = axios.create({
  baseURL: '/api',
  timeout: 60_000,
})

// ─── Schema ──────────────────────────────────────────────────────────────────
export const fetchSchema = (): Promise<Schema> =>
  api.get('/schema').then(r => r.data)

// ─── Upload ───────────────────────────────────────────────────────────────────
export const uploadCSV = (file: File): Promise<UploadResponse> => {
  const form = new FormData()
  form.append('file', file)
  return api.post('/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data)
}

// ─── Students ─────────────────────────────────────────────────────────────────
export const fetchStudents = (
  uploadId: string,
  params: {
    page?: number
    page_size?: number
    risk_tier?: string
    department?: string
    search?: string
    sort_by?: string
    sort_dir?: string
  } = {}
): Promise<StudentListResponse> =>
  api.get(`/students/${uploadId}`, { params }).then(r => r.data)

export const fetchStudent = (uploadId: string, index: number): Promise<Student> =>
  api.get(`/students/${uploadId}/${index}`).then(r => r.data)

// ─── Simulator ────────────────────────────────────────────────────────────────
export const simulate = (
  uploadId: string,
  index: number,
  req: SimulateRequest
): Promise<SimulateResponse> =>
  api.post(`/students/${uploadId}/${index}/simulate`, req).then(r => r.data)

// ─── Cohort Stats ─────────────────────────────────────────────────────────────
export const fetchCohortStats = (uploadId: string): Promise<CohortStats> =>
  api.get(`/cohort-stats/${uploadId}`).then(r => r.data)

// ─── Roster ──────────────────────────────────────────────────────────────────
export const fetchRoster = (
  uploadId: string,
  params: { department?: string; action_type?: string } = {}
): Promise<RosterResponse> =>
  api.get(`/roster/${uploadId}`, { params }).then(r => r.data)

export const rosterCsvUrl = (uploadId: string, params: { department?: string; action_type?: string } = {}) => {
  const qs = new URLSearchParams({ format: 'csv', ...params }).toString()
  return `/api/roster/${uploadId}?${qs}`
}
