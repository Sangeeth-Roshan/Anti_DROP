// ─── Student & Upload Types ─────────────────────────────────────────────────

export interface ShapEntry {
  feature:    string
  shap_value: number
}

export interface Student {
  // Raw features
  Student_ID?:               string
  'Attendance_%':            number
  CGPA_10:                   number
  Backlogs:                  number
  Credits_Earned:            number
  'Assignment_Submission_%': number
  'Average_Exam_Marks_%':    number
  Semester:                  number
  Fee_Status:                'Paid' | 'Pending'
  Scholarship:               'Yes' | 'No'
  'Previous_Academic_%':     number
  Course:                    string
  Dropout?:                  number
  // Scored fields
  predicted_risk:            number
  risk_tier:                 'Low' | 'Moderate' | 'High'
  top_risk_factors:          ShapEntry[]
  shap_breakdown?:           ShapEntry[]
  scholarship_effect:        number | null
  recommended_action:        string
  index?:                    number
}

export interface UploadResponse {
  upload_id:          string
  total:              number
  high_risk:          number
  moderate_risk:      number
  low_risk:           number
  has_dropout_labels: boolean
}

export interface StudentListResponse {
  upload_id:   string
  total:       number
  page:        number
  page_size:   number
  total_pages: number
  students:    Student[]
}

// ─── Cohort Stats Types ──────────────────────────────────────────────────────

export interface BacklogBucket {
  backlogs:     number
  dropout_rate: number
  count:        number
}

export interface DeptBucket {
  department:   string
  dropout_rate: number
  avg_risk:     number
  count:        number
  high_risk:    number
}

export interface ScholarshipBucket {
  scholarship: string
  avg_risk:    number
  count:       number
}

export interface CohortStats {
  upload_id:              string
  total:                  number
  high_risk:              number
  moderate_risk:          number
  low_risk:               number
  avg_cgpa:               number
  pending_fees:           number
  avg_risk:               number
  has_dropout_labels:     boolean
  backlog_breakdown:      BacklogBucket[]
  department_breakdown:   DeptBucket[]
  scholarship_breakdown:  ScholarshipBucket[]
}

// ─── Roster Types ────────────────────────────────────────────────────────────

export interface RosterStudent {
  index:              number
  Student_ID:         string
  Course:             string
  Semester:           number
  CGPA_10:            number
  Backlogs:           number
  'Attendance_%':     number
  Fee_Status:         string
  Scholarship:        string
  predicted_risk:     number
  risk_tier:          string
  scholarship_effect: number | null
  recommended_action: string
}

export interface RosterResponse {
  upload_id: string
  total:     number
  roster:    RosterStudent[]
}

// ─── Simulator Types ─────────────────────────────────────────────────────────

export interface SimulateRequest {
  scholarship:           boolean
  tutoring_hours:        number
  attendance_counseling: boolean
  fee_relief:            boolean
}

export interface SimulateLever {
  lever:  string
  effect: number
  method: string
}

export interface SimulateResponse {
  original_risk:   number
  simulated_risk:  number
  risk_change:     number
  risk_tier:       string
  breakdown:       SimulateLever[]
  disclaimer:      string
}

// ─── Schema Types ────────────────────────────────────────────────────────────

export interface Schema {
  numeric_cols:    string[]
  categorical_cols: string[]
  target_col:      string
  allowed_values:  Record<string, string[]>
  dtypes:          Record<string, string>
}

// ─── Upload Context ──────────────────────────────────────────────────────────

export interface UploadContext {
  upload_id:  string
  label:      string
  total:      number
}
