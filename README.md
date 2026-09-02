# AntiDROP — Causal Dropout Intervention Engine

AntiDROP is an AI-powered university student dropout prediction and causal intervention system. It combines a Random Forest classifier, SHAP explainability, and EconML `CausalForestDML` to help faculty identify at-risk students and simulate personalized interventions.

---

## Architecture

```
antidrop/
  backend/
    train_model.py          # Retrain script — run once to generate artifacts
    main.py                 # FastAPI REST API (port 8000)
    dataset.csv             # Training / default dataset
    dropout_model.pkl       # Trained sklearn Pipeline (generated)
    causal_model.pkl        # Fitted CausalForestDML (generated)
    schema.json             # Feature schema — single source of truth (generated)
    global_friction_points.png  # SHAP global plot (generated)
    requirements.txt
  frontend/
    src/
      pages/                # Dashboard, Students, StudentDetail, Upload, Roster
      components/           # AppShell, RiskBadge, ShapChart, SimulatorPanel
      api.ts                # Typed Axios client
      types.ts              # All TypeScript types
      context.tsx           # Active upload context
    package.json
    vite.config.ts
  README.md
```

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Python | 3.12+ | [python.org](https://python.org) |
| Node.js | 18+ LTS | [nodejs.org](https://nodejs.org) |

---

## Step 1 — Retrain the models

```bash
cd backend

# Install Python dependencies (first time only)
pip install -r requirements.txt

# Run the training script (uses dataset.csv in the same folder by default)
python train_model.py

# Or specify a custom CSV:
python train_model.py --data /path/to/your_data.csv
```

This generates:
- `dropout_model.pkl` — sklearn Pipeline (StandardScaler + OneHotEncoder + RandomForest)
- `causal_model.pkl` — fitted `CausalForestDML` + column metadata
- `schema.json` — feature schema used by the API for upload validation
- `global_friction_points.png` — SHAP global importance plot

You should see a classification report and ROC-AUC printed to the console.

---

## Step 2 — Run the FastAPI backend

```bash
cd backend
uvicorn main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`.  
Auto-generated docs: `http://localhost:8000/docs`

On startup, the backend loads the default `dataset.csv` so the app has data immediately before any upload.

---

## Step 3 — Run the React frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

All `/api` requests are proxied to `http://localhost:8000` via Vite's dev server proxy (configured in `vite.config.ts`), so no CORS issues during development.

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/api/schema` | Feature schema (columns, dtypes, allowed values) |
| `POST` | `/api/upload` | Upload a CSV → validate → score → return `upload_id` |
| `GET`  | `/api/students/{upload_id}` | Paginated/filtered student list |
| `GET`  | `/api/students/{upload_id}/{index}` | Full student detail (SHAP + CATE) |
| `POST` | `/api/students/{upload_id}/{index}/simulate` | What-if intervention simulator |
| `GET`  | `/api/cohort-stats/{upload_id}` | Dashboard aggregates |
| `GET`  | `/api/roster/{upload_id}` | Faculty action roster (`?format=csv` for download) |

---

## CSV Upload Format

The upload endpoint validates against `schema.json`. Required columns:

| Column | Type | Values |
|--------|------|--------|
| `Attendance_%` | float | 0–100 |
| `CGPA_10` | float | 0–10 |
| `Backlogs` | int | ≥ 0 |
| `Credits_Earned` | int | ≥ 0 |
| `Assignment_Submission_%` | float | 0–100 |
| `Average_Exam_Marks_%` | float | 0–100 |
| `Semester` | int | 1–8 |
| `Previous_Academic_%` | float | 0–100 |
| `Fee_Status` | categorical | `Paid`, `Pending` |
| `Scholarship` | categorical | `Yes`, `No` |
| `Course` | categorical | `CSE`, `ECE`, `EEE`, `MECH`, `CIVIL` |

**Optional columns** (ignored or used for display):
- `Student_ID` — used as a display label
- `Credits_Attempted` — dropped before scoring
- `Dropout` — if present, shown as "actual outcome" on the student detail page

---

## Intervention Simulator — Method Labels

The student detail page includes a what-if simulator. Effects are labelled by method:

| Lever | Method | Magnitude |
|-------|--------|-----------|
| Scholarship | **Causal** — EconML `CausalForestDML` CATE | Per-student estimate |
| Tutoring hours | Heuristic estimate | 4.5% per hour (capped at 10 hrs) |
| Attendance counseling | Heuristic estimate | 8% flat |
| Fee relief / waiver | Heuristic estimate | 6% flat |

Only the scholarship effect is a causal estimate. The other levers are directional heuristics — they are labeled as such in both the API response and the UI.

---

## Risk Tiers

| Tier | Threshold | Color |
|------|-----------|-------|
| 🟢 Low | < 35% | `#2e7d32` |
| 🟡 Moderate | 35–65% | `#f57c00` |
| 🔴 High | ≥ 65% | `#d32f2f` |

---

## Known Design Decisions

- **SHAP vs CATE**: SHAP (friction points) is correlational — it explains what the model sees. EconML CATE is causal — it estimates what would actually happen if a scholarship were granted. These are deliberately kept separate and labelled differently throughout the UI.
- **Preprocessing consistency**: The exact same `ColumnTransformer` (StandardScaler for numerics, `OneHotEncoder(drop="first")` for categoricals) is fitted in `train_model.py` and embedded inside `dropout_model.pkl`. The API uses this artifact directly — there is no duplicate preprocessing code.
- **Session store**: Upload results are stored in-memory on the server, keyed by UUID. They are cleared on server restart. For a hackathon demo this is fine; for production you'd want Redis or a database.
# AntiDROP
# Anti_DROP
