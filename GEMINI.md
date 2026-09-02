# AntiDROP — Causal Dropout Intervention Engine

## Project Overview

**AntiDROP** is an AI-powered university student dropout prediction and intervention system built for a hackathon. It combines classical ML, explainable AI (SHAP), and causal inference (DoWhy + EconML) to help faculty identify at-risk students and simulate personalized interventions to improve retention.

The system goes beyond simple prediction — it uses causal ML to quantify *why* a student is at risk and *what actions will actually reduce that risk*, not just correlate with it.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend / Dashboard** | React.js (SPA dashboard, interactive charts & modern UI) |
| **Backend / API** | FastAPI / Flask REST API (serves predictions, SHAP friction, and causal simulations) |
| **ML Model** | scikit-learn `RandomForestClassifier` (300 trees, balanced class weights) |
| **Explainability** | SHAP `TreeExplainer` — per-student friction points |
| **Causal Inference** | DoWhy `CausalModel` — validates whether scholarship is truly causal |
| **Heterogeneous Effects** | EconML `CausalForestDML` — personalized per-student CATE estimates |
| **Data** | pandas, NumPy |
| **Serialization** | joblib |

---

## Project Structure

```
AntiDROP/
├── backend/ (or root server)
│   ├── server.py              # REST API (FastAPI / Flask serving endpoints to React)
│   ├── abhi_proto.py          # Combined ML + Causal pipeline script (full version)
│   ├── proto-1.py             # Earlier prototype of the same pipeline
│   ├── dataset.csv            # Raw student dataset
│   ├── causal_results.csv     # Precomputed output from causal pipeline (loaded by API)
│   ├── dropout_model.pkl      # Serialized trained model pipeline (loaded by API)
│   ├── X_test.csv             # Test features (saved for SHAP analysis)
│   ├── y_test.csv             # Test labels
│   ├── global_friction_points.png # SHAP global summary plot
│   └── requirements.txt       # Python dependencies
├── frontend/                  # React.js web application
│   ├── src/
│   │   ├── components/        # View components (Cohort, Student, Simulator, Roster, Upload)
│   │   ├── App.jsx            # Main dashboard shell & navigation
│   │   ├── index.css          # Modern dashboard styling system
│   │   └── main.jsx           # React entry point
│   ├── package.json           # Node / React dependencies
│   └── vite.config.js         # Build tooling / dev server
└── README.md                  # Project overview
```

---

## Dataset

**File:** `dataset.csv` / raw source: `proto.csv`

**Target variable:** `Dropout` (binary: 0 = retained, 1 = dropped out)

**Features used:**

| Feature | Type | Description |
|---|---|---|
| `Attendance_%` | Numeric | Class attendance percentage |
| `CGPA_10` | Numeric | Cumulative GPA on a 10-point scale |
| `Backlogs` | Numeric | Number of failed/pending subjects |
| `Credits_Earned` | Numeric | Total credits successfully earned |
| `Assignment_Submission_%` | Numeric | Assignment completion rate |
| `Average_Exam_Marks_%` | Numeric | Average exam score percentage |
| `Semester` | Numeric | Current semester (1–8) |
| `Previous_Academic_%` | Numeric | High school / prior academic score |
| `Fee_Status` | Categorical | `Paid` or `Pending` |
| `Scholarship` | Categorical | `Yes` or `No` |
| `Course` | Categorical | Department: `CSE`, `ECE`, `EEE`, `MECH`, `CIVIL` |

---

## Pipeline Architecture

### Backend (`abhi_proto.py` / `proto-1.py` & API Server)
1. **Data Preprocessing** — median imputation for numerics, mode for categoricals, drop `Student_ID`
2. **Train/Test Split** — 80/20, stratified on `Dropout`
3. **sklearn Pipeline** — `StandardScaler` for numeric + `OneHotEncoder` for categorical → `RandomForestClassifier`
4. **SHAP Analysis** — `TreeExplainer` to extract per-student friction points and save `global_friction_points.png`
5. **DoWhy Causal Graph** — Models `Scholarship → Dropout` with confounders (`Semester`, `Previous_Academic_%`, `Course_*`)
6. **EconML CausalForestDML** — Estimates heterogeneous treatment effects (CATE) per student
7. **Refutation Test** — Placebo treatment test to validate the causal claim
8. **Save Artifacts** — `dropout_model.pkl`, `causal_results.csv`, `X_test.csv`, `y_test.csv`
9. **API Layer** — Exposes endpoints for cohort stats, per-student SHAP drilldowns, CATE simulations, and batch upload prediction

### Frontend (React.js Application)
Consumes backend API endpoints and provides 5 interactive views:

| View | Purpose |
|---|---|
| **📊 Cohort Overview** | Batch-wide dropout stats, risk tiers, department breakdown, backlog impact charts |
| **👤 Student Risk & Friction (SHAP)** | Per-student risk score, academic profile, interactive SHAP friction factor charts |
| **🔬 Causal Policy Simulator (EconML)** | What-if intervention planner — simulate scholarship, tutoring, attendance counseling, fee waiver in real time |
| **🛡️ Causal Validation (DoWhy)** | Faculty action roster — filterable table of students with recommended actions + CSV export |
| **📤 Upload & Predict** | Batch CSV upload — instant risk inference, SHAP risk drivers, and downloadable report |

---

## Running the Project

### Step 1: Run the Backend Pipeline
```bash
# Generates dropout_model.pkl, causal_results.csv, X_test.csv, y_test.csv
python abhi_proto.py
```

### Step 2: Launch the Backend API Server
```bash
# Starts API server (e.g. FastAPI on port 8000)
python server.py
# or: uvicorn server:app --reload --port 8000
```

### Step 3: Launch the React Frontend
```bash
cd frontend
npm install
npm run dev
```

---

## Key Design Decisions

- **Causal vs. Correlational:** The system deliberately separates SHAP (correlational friction points) from EconML CATE (causal intervention effects). SHAP tells you *what* is associated with dropout; CausalForestDML tells you *what intervention will help*.
- **Balanced class weights:** Dropout is the minority class, so `class_weight="balanced"` ensures the model does not just predict everyone stays.
- **Decoupled Architecture:** The React.js frontend communicates with a Python API backend. The API loads `dropout_model.pkl` and `causal_results.csv` into memory on startup so there is zero model-loading latency for the client.
- **Confounders vs. Mediators:** Attendance, CGPA, etc. are intentionally excluded from the DoWhy confounders list because they are *mediators* (caused by or correlated with scholarship receipt), not independent confounders.

---

## Coding Conventions

- Section headings use `# ===...===` banners for visual separation in backend scripts.
- Data reconstruction from one-hot encoded columns follows the pattern: iterate `["CSE", "ECE", "EEE", "MECH"]`, fallback to `"CIVIL"`.
- Risk tiers: `< 35%` = Low 🟢, `35–65%` = Moderate 🟡, `>= 65%` = High 🔴.
- Intervention reductions are linear estimates: `4.5%` per tutoring hour, `8%` for attendance counseling fix, `6%` for fee waiver, scholarship effect sourced from per-student CATE.

