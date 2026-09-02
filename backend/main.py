"""
AntiDROP — FastAPI Backend
===========================
Run with:
    uvicorn main:app --reload --port 8000

All endpoints are under /api/.
"""

from __future__ import annotations

import csv
import io
import json
import math
import uuid
import warnings
from pathlib import Path
from typing import Any, Dict, List, Optional

import joblib
import numpy as np
import pandas as pd
import shap

from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

warnings.filterwarnings("ignore")

# ============================================================
# CONSTANTS — must match train_model.py exactly
# ============================================================
SCRIPT_DIR      = Path(__file__).parent
NUMERIC_COLS    = [
    "Attendance_%",
    "CGPA_10",
    "Backlogs",
    "Credits_Earned",
    "Assignment_Submission_%",
    "Average_Exam_Marks_%",
    "Semester",
    "Previous_Academic_%",
]
CATEGORICAL_COLS = ["Fee_Status", "Scholarship", "Course"]
TARGET_COL       = "Dropout"
COLS_DROP        = ["Student_ID", "Credits_Attempted"]
EFFECT_MODIFIERS = ["CGPA_10", "Backlogs", "Attendance_%", "Average_Exam_Marks_%"]

# Heuristic intervention magnitudes (NOT causal — clearly labelled)
HEURISTIC_TUTORING_PER_HOUR = 0.045   # 4.5% per hour, max 10 hrs
HEURISTIC_ATTENDANCE        = 0.08    # 8% flat
HEURISTIC_FEE_RELIEF        = 0.06    # 6% flat

# Risk tier thresholds
TIER_LOW_MAX = 0.35
TIER_MOD_MAX = 0.65


def risk_tier(prob: float) -> str:
    if prob < TIER_LOW_MAX:
        return "Low"
    elif prob < TIER_MOD_MAX:
        return "Moderate"
    return "High"


def recommended_action(row: Dict) -> str:
    risk = row.get("predicted_risk", 0)
    fee  = row.get("Fee_Status", "Paid")
    cate = row.get("scholarship_effect")      # negative = scholarship helps
    backlogs = row.get("Backlogs", 0)
    attendance = row.get("Attendance_%", 100)

    actions = []
    if fee == "Pending":
        actions.append("Financial Relief")
    if cate is not None and cate < -0.05 and row.get("Scholarship", "Yes") == "No":
        actions.append("Scholarship")
    if backlogs >= 2:
        actions.append("Remedial Tutoring")
    if attendance < 65:
        actions.append("Attendance Warning")
    if not actions:
        return "Stable"
    return " + ".join(actions)


# ============================================================
# LOAD ARTIFACTS AT STARTUP
# ============================================================
print("[startup] Loading model artifacts …")
_pipeline  = joblib.load(SCRIPT_DIR / "dropout_model.pkl")
_schema    = json.loads((SCRIPT_DIR / "schema.json").read_text())

try:
    _causal    = joblib.load(SCRIPT_DIR / "causal_model.pkl")
    _causal_est = _causal["estimator"]
    _causal_mod_cols = _causal["effect_modifier_cols"]
    print("[startup] Causal model loaded ✓")
except FileNotFoundError:
    _causal_est = None
    _causal_mod_cols = EFFECT_MODIFIERS
    print("[startup] causal_model.pkl not found — scholarship CATE will be null")

# Rebuild SHAP explainer from the loaded pipeline
_preprocessor = _pipeline.named_steps["preprocessor"]
_rf           = _pipeline.named_steps["classifier"]
_explainer    = shap.TreeExplainer(_rf)

# Build feature names in the same order as the transformer
_num_feat_names = NUMERIC_COLS.copy()
_cat_feat_names = list(
    _preprocessor.named_transformers_["cat"].get_feature_names_out(CATEGORICAL_COLS)
)
_all_feat_names = _num_feat_names + _cat_feat_names

print(f"[startup] Feature count: {len(_all_feat_names)}")


# ============================================================
# IN-MEMORY SESSION STORE
# ============================================================
# upload_id → {"students": List[dict], "raw_df": pd.DataFrame}
_store: Dict[str, Dict] = {}


def _clean_df(df: pd.DataFrame) -> pd.DataFrame:
    """Apply the same cleaning as train_model.py."""
    df = df.copy()
    df.drop(columns=[c for c in COLS_DROP if c in df.columns], inplace=True)
    # Median-fill numeric
    for col in NUMERIC_COLS:
        if col in df.columns:
            df[col].fillna(df[col].median(), inplace=True)
    # Mode-fill categorical
    for col in CATEGORICAL_COLS:
        if col in df.columns:
            if df[col].mode().empty:
                df[col].fillna(df[col].iloc[0], inplace=True)
            else:
                df[col].fillna(df[col].mode()[0], inplace=True)
    return df


def _score_df(df: pd.DataFrame, keep_dropout: bool = False) -> List[Dict]:
    """Run classifier + SHAP + causal on a cleaned dataframe. Returns list of dicts."""
    # Drop target if present
    feature_df = df.drop(columns=[TARGET_COL], errors="ignore")

    # Predict
    probs      = _pipeline.predict_proba(feature_df)[:, 1]
    X_encoded  = _preprocessor.transform(feature_df)

    # SHAP — handle both old list API and new 3D array API (SHAP >= 0.46)
    shap_vals = _explainer.shap_values(X_encoded)
    if isinstance(shap_vals, list):
        # Old API: list of [class0_vals, class1_vals], each shape (n_samples, n_features)
        shap_class1 = np.array(shap_vals[1])
    elif isinstance(shap_vals, np.ndarray) and shap_vals.ndim == 3:
        # New API: shape (n_samples, n_features, n_classes) — take class 1
        shap_class1 = shap_vals[:, :, 1]
    else:
        shap_class1 = np.array(shap_vals)

    # Causal
    cate_list: List[Optional[float]] = [None] * len(df)
    if _causal_est is not None:
        X_mod = df[_causal_mod_cols].values.astype(float)
        cate_raw = _causal_est.effect(X_mod)
        # Only give CATE to students NOT already on scholarship
        for i, row in enumerate(df.itertuples()):
            scholarship = getattr(row, "Scholarship", "No")
            cate_list[i] = float(cate_raw[i]) if scholarship == "No" else None

    records = []
    for i, (_, row) in enumerate(df.iterrows()):
        prob  = float(probs[i])
        svs   = shap_class1[i].tolist()

        # Build SHAP breakdown sorted by absolute impact
        shap_breakdown = sorted(
            [{"feature": _all_feat_names[j], "shap_value": svs[j]} for j in range(len(svs))],
            key=lambda x: abs(x["shap_value"]),
            reverse=True,
        )
        top_risk_factors = shap_breakdown[:5]

        rec = dict(row)
        rec["predicted_risk"]   = round(prob, 4)
        rec["risk_tier"]        = risk_tier(prob)
        rec["shap_breakdown"]   = shap_breakdown
        rec["top_risk_factors"] = top_risk_factors
        rec["scholarship_effect"] = round(cate_list[i], 4) if cate_list[i] is not None else None

        # Restore dropout if it was in original data
        if keep_dropout and TARGET_COL in df.columns:
            rec[TARGET_COL] = int(df.iloc[i][TARGET_COL])

        rec["recommended_action"] = recommended_action(rec)
        records.append(rec)

    return records


def _load_and_store(df_raw: pd.DataFrame, upload_id: str, has_dropout: bool = False):
    """Clean, score, and store a dataframe under upload_id."""
    # Preserve Student_ID before cleaning strips it (it's in COLS_DROP)
    student_ids = (
        df_raw["Student_ID"].astype(str).tolist()
        if "Student_ID" in df_raw.columns
        else [None] * len(df_raw)
    )
    df_clean  = _clean_df(df_raw)
    students  = _score_df(df_clean, keep_dropout=has_dropout)
    # Re-attach Student_ID to each record
    for i, sid in enumerate(student_ids):
        if sid is not None:
            students[i]["Student_ID"] = sid
    _store[upload_id] = {"students": students, "raw_df": df_raw}


# ============================================================
# LOAD DEFAULT DATASET
# ============================================================
_DEFAULT_CSV = SCRIPT_DIR / "dataset.csv"
print(f"[startup] Loading default dataset from {_DEFAULT_CSV} …")
_default_df = pd.read_csv(_DEFAULT_CSV)
_load_and_store(_default_df, "default", has_dropout=True)
print(f"[startup] Default dataset loaded: {len(_store['default']['students'])} students ✓")


# ============================================================
# FASTAPI APP
# ============================================================
app = FastAPI(
    title="AntiDROP API",
    description="Causal Dropout Intervention Engine — FastAPI backend",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Pydantic models ──────────────────────────────────────────

class SimulateRequest(BaseModel):
    scholarship: bool = False
    tutoring_hours: float = 0.0          # 0–10
    attendance_counseling: bool = False
    fee_relief: bool = False


class SimulateResponse(BaseModel):
    original_risk: float
    simulated_risk: float
    risk_change: float
    risk_tier: str
    breakdown: List[Dict[str, Any]]      # list of {lever, effect, method}
    disclaimer: str


# ── Helpers ──────────────────────────────────────────────────

def _get_students(upload_id: str) -> List[Dict]:
    if upload_id not in _store:
        raise HTTPException(404, f"Upload '{upload_id}' not found")
    return _store[upload_id]["students"]


def _get_student(upload_id: str, student_index: int) -> Dict:
    students = _get_students(upload_id)
    if student_index < 0 or student_index >= len(students):
        raise HTTPException(404, f"Student index {student_index} out of range")
    return students[student_index]


# ============================================================
# ENDPOINTS
# ============================================================

@app.get("/api/schema")
def get_schema():
    """Return the feature schema (column names, dtypes, allowed categoricals)."""
    return _schema


@app.post("/api/upload")
async def upload_csv(file: UploadFile = File(...)):
    """
    Accepts a CSV file. Validates against schema, scores students, and returns
    an upload_id + summary. Subsequent requests use that upload_id.
    """
    contents = await file.read()
    try:
        df = pd.read_csv(io.BytesIO(contents))
    except Exception as e:
        raise HTTPException(400, f"Could not parse CSV: {e}")

    # ── Validation ───────────────────────────────────────────
    errors = []
    all_expected = set(NUMERIC_COLS + CATEGORICAL_COLS)
    provided     = set(df.columns)

    missing = all_expected - provided
    if missing:
        errors.append(f"Missing required columns: {sorted(missing)}")

    extra = provided - all_expected - {TARGET_COL, "Student_ID", "Credits_Attempted"}
    if extra:
        errors.append(f"Unexpected extra columns: {sorted(extra)}")

    allowed = _schema.get("allowed_values", {})
    for col, vals in allowed.items():
        if col in df.columns:
            invalid = set(df[col].dropna().unique()) - set(vals)
            if invalid:
                errors.append(
                    f"Column '{col}' contains invalid values {sorted(invalid)}. "
                    f"Allowed: {sorted(vals)}"
                )

    if errors:
        raise HTTPException(422, {"validation_errors": errors})

    has_dropout = TARGET_COL in df.columns
    upload_id   = str(uuid.uuid4())
    _load_and_store(df, upload_id, has_dropout=has_dropout)

    students = _store[upload_id]["students"]
    high_count = sum(1 for s in students if s["risk_tier"] == "High")
    mod_count  = sum(1 for s in students if s["risk_tier"] == "Moderate")

    return {
        "upload_id":    upload_id,
        "total":        len(students),
        "high_risk":    high_count,
        "moderate_risk": mod_count,
        "low_risk":     len(students) - high_count - mod_count,
        "has_dropout_labels": has_dropout,
    }


@app.get("/api/students/{upload_id}")
def list_students(
    upload_id: str,
    page: int           = Query(1, ge=1),
    page_size: int      = Query(25, ge=1, le=200),
    risk_tier: Optional[str]   = Query(None, description="Low|Moderate|High"),
    department: Optional[str]  = Query(None),
    search: Optional[str]      = Query(None, description="Free-text search on student index"),
    sort_by: str               = Query("predicted_risk"),
    sort_dir: str              = Query("desc"),
):
    """Paginated, filterable, sortable student list."""
    students = _get_students(upload_id)

    # Apply filters
    filtered = students
    if risk_tier:
        filtered = [s for s in filtered if s.get("risk_tier") == risk_tier]
    if department:
        filtered = [s for s in filtered if s.get("Course") == department]
    if search:
        filtered = [s for s in filtered if search.lower() in str(s.get("Student_ID", "")).lower()]

    # Sort
    reverse = sort_dir.lower() == "desc"
    try:
        filtered = sorted(filtered, key=lambda s: (s.get(sort_by) is None, s.get(sort_by, 0)), reverse=reverse)
    except TypeError:
        pass

    total   = len(filtered)
    start   = (page - 1) * page_size
    end     = start + page_size
    page_data = filtered[start:end]

    # Strip heavy shap_breakdown from list view — only send top_risk_factors
    slim = []
    for i, s in enumerate(page_data):
        slim_s = {k: v for k, v in s.items() if k != "shap_breakdown"}
        slim_s["index"] = students.index(s)   # original index for detail URL
        slim.append(slim_s)

    return {
        "upload_id":  upload_id,
        "total":      total,
        "page":       page,
        "page_size":  page_size,
        "total_pages": math.ceil(total / page_size) if total > 0 else 1,
        "students":   slim,
    }


@app.get("/api/students/{upload_id}/{student_index}")
def get_student(upload_id: str, student_index: int):
    """Full detail for a single student including full SHAP breakdown + CATE."""
    s = _get_student(upload_id, student_index)
    result = dict(s)
    result["student_index"] = student_index
    return result


@app.post("/api/students/{upload_id}/{student_index}/simulate")
def simulate(
    upload_id: str,
    student_index: int,
    req: SimulateRequest,
) -> SimulateResponse:
    """
    What-if intervention simulator.
    Scholarship effect is from the causal model (CATE).
    All other effects are heuristic estimates.
    """
    s            = _get_student(upload_id, student_index)
    base_risk    = s["predicted_risk"]
    cate         = s.get("scholarship_effect")     # negative = scholarship reduces risk
    already_on   = s.get("Scholarship", "No") == "Yes"

    breakdown = []
    delta     = 0.0

    # Scholarship — causal
    if req.scholarship and not already_on and cate is not None:
        effect = float(cate)  # already negative if beneficial
        delta += effect
        breakdown.append({
            "lever":  "Scholarship",
            "effect": round(effect, 4),
            "method": "causal (EconML CausalForestDML CATE)",
        })
    elif req.scholarship and already_on:
        breakdown.append({
            "lever":  "Scholarship",
            "effect": 0.0,
            "method": "N/A — student already on scholarship",
        })

    # Tutoring — heuristic
    hours = max(0.0, min(10.0, req.tutoring_hours))
    if hours > 0:
        effect = -HEURISTIC_TUTORING_PER_HOUR * hours
        delta += effect
        breakdown.append({
            "lever":  f"Tutoring ({hours:.1f} hrs)",
            "effect": round(effect, 4),
            "method": "heuristic estimate (4.5% per hr, not causal)",
        })

    # Attendance counseling — heuristic
    if req.attendance_counseling:
        effect = -HEURISTIC_ATTENDANCE
        delta += effect
        breakdown.append({
            "lever":  "Attendance Counseling",
            "effect": round(effect, 4),
            "method": "heuristic estimate (8% flat, not causal)",
        })

    # Fee relief — heuristic
    if req.fee_relief:
        effect = -HEURISTIC_FEE_RELIEF
        delta += effect
        breakdown.append({
            "lever":  "Fee Relief",
            "effect": round(effect, 4),
            "method": "heuristic estimate (6% flat, not causal)",
        })

    sim_risk = float(np.clip(base_risk + delta, 0.0, 1.0))

    return SimulateResponse(
        original_risk = round(base_risk, 4),
        simulated_risk= round(sim_risk, 4),
        risk_change   = round(sim_risk - base_risk, 4),
        risk_tier     = risk_tier(sim_risk),
        breakdown     = breakdown,
        disclaimer    = (
            "Only the scholarship effect is a causal estimate (EconML CausalForestDML). "
            "Tutoring, attendance counseling, and fee relief are heuristic estimates — "
            "they are directionally reasonable but not causally validated."
        ),
    )


@app.get("/api/cohort-stats/{upload_id}")
def cohort_stats(upload_id: str):
    """Aggregated dashboard metrics."""
    students = _get_students(upload_id)
    df = pd.DataFrame(students)

    total     = len(df)
    high      = int((df["risk_tier"] == "High").sum())
    moderate  = int((df["risk_tier"] == "Moderate").sum())
    low       = int((df["risk_tier"] == "Low").sum())
    avg_cgpa  = round(float(df["CGPA_10"].mean()), 2)
    pending   = int((df["Fee_Status"] == "Pending").sum())
    avg_risk  = round(float(df["predicted_risk"].mean()), 4)

    # Backlogs vs dropout-rate (or avg-risk if no labels)
    has_labels = TARGET_COL in df.columns
    backlog_groups = []
    for bl, grp in df.groupby("Backlogs"):
        if has_labels:
            rate = round(float(grp[TARGET_COL].mean()), 4)
        else:
            rate = round(float(grp["predicted_risk"].mean()), 4)
        backlog_groups.append({"backlogs": int(bl), "dropout_rate": rate, "count": len(grp)})

    # Department breakdown
    dept_groups = []
    for dept, grp in df.groupby("Course"):
        if has_labels:
            rate = round(float(grp[TARGET_COL].mean()), 4)
        else:
            rate = round(float(grp["predicted_risk"].mean()), 4)
        dept_groups.append({
            "department":   dept,
            "dropout_rate": rate,
            "avg_risk":     round(float(grp["predicted_risk"].mean()), 4),
            "count":        len(grp),
            "high_risk":    int((grp["risk_tier"] == "High").sum()),
        })

    # Risk distribution by scholarship
    schol_groups = []
    for val, grp in df.groupby("Scholarship"):
        schol_groups.append({
            "scholarship":  val,
            "avg_risk":     round(float(grp["predicted_risk"].mean()), 4),
            "count":        len(grp),
        })

    return {
        "upload_id":      upload_id,
        "total":          total,
        "high_risk":      high,
        "moderate_risk":  moderate,
        "low_risk":       low,
        "avg_cgpa":       avg_cgpa,
        "pending_fees":   pending,
        "avg_risk":       avg_risk,
        "has_dropout_labels": has_labels,
        "backlog_breakdown":  sorted(backlog_groups, key=lambda x: x["backlogs"]),
        "department_breakdown": sorted(dept_groups, key=lambda x: x["department"]),
        "scholarship_breakdown": schol_groups,
    }


@app.get("/api/roster/{upload_id}")
def get_roster(
    upload_id: str,
    department: Optional[str] = Query(None),
    action_type: Optional[str] = Query(None),
    format: Optional[str]      = Query(None, description="Pass 'csv' for CSV download"),
):
    """
    Faculty action roster — filterable, with CSV export.
    Returns students with their recommended_action and key fields.
    """
    students = _get_students(upload_id)

    roster = [
        {
            "index":              students.index(s),
            "Student_ID":         s.get("Student_ID", f"#{students.index(s)}"),
            "Course":             s.get("Course"),
            "Semester":           s.get("Semester"),
            "CGPA_10":            s.get("CGPA_10"),
            "Backlogs":           s.get("Backlogs"),
            "Attendance_%":       s.get("Attendance_%"),
            "Fee_Status":         s.get("Fee_Status"),
            "Scholarship":        s.get("Scholarship"),
            "predicted_risk":     s.get("predicted_risk"),
            "risk_tier":          s.get("risk_tier"),
            "scholarship_effect": s.get("scholarship_effect"),
            "recommended_action": s.get("recommended_action"),
        }
        for s in students
    ]

    if department:
        roster = [r for r in roster if r["Course"] == department]
    if action_type:
        roster = [r for r in roster if action_type.lower() in r["recommended_action"].lower()]

    # Sort by risk descending
    roster = sorted(roster, key=lambda r: r["predicted_risk"] or 0, reverse=True)

    if format and format.lower() == "csv":
        if not roster:
            raise HTTPException(404, "No data to export")
        fieldnames = list(roster[0].keys())
        output     = io.StringIO()
        writer     = csv.DictWriter(output, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(roster)
        output.seek(0)
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=antidrop_roster.csv"},
        )

    return {"upload_id": upload_id, "total": len(roster), "roster": roster}
