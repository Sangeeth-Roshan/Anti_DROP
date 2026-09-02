"""
AntiDROP â€” Canonical Training Script
=====================================
Usage:
    python train_model.py [--data dataset.csv]

Outputs (all written to the same directory as this script):
    dropout_model.pkl          sklearn Pipeline (scaler + encoder + RF)
    causal_model.pkl           dict with fitted CausalForestDML + column lists
    schema.json                feature schema (column names, dtypes, categoricals)
    global_friction_points.png SHAP global summary plot
"""

import argparse
import json
import os
import warnings
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import shap
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, roc_auc_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

warnings.filterwarnings("ignore")

# ============================================================
# CONFIG â€” single source of truth for column roles
# ============================================================
COLS_DROP       = ["Student_ID", "Credits_Attempted"]
TARGET_COL      = "Dropout"
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

# EconML modifiers / DoWhy confounders
CAUSAL_TREATMENT = "Scholarship"          # binary treatment (Yes/No â†’ 1/0)
EFFECT_MODIFIERS  = ["CGPA_10", "Backlogs", "Attendance_%", "Average_Exam_Marks_%"]

# ============================================================
# HELPERS
# ============================================================

SCRIPT_DIR = Path(__file__).parent


def load_and_clean(data_path: str) -> pd.DataFrame:
    """Load CSV, clean, drop unused columns."""
    df = pd.read_csv(data_path)
    # Drop non-predictive columns
    df.drop(columns=[c for c in COLS_DROP if c in df.columns], inplace=True)

    # Median-fill numeric, mode-fill categorical
    for col in NUMERIC_COLS:
        if col in df.columns:
            df[col].fillna(df[col].median(), inplace=True)
    for col in CATEGORICAL_COLS + [TARGET_COL]:
        if col in df.columns:
            df[col].fillna(df[col].mode()[0], inplace=True)

    return df


def allowed_values(df: pd.DataFrame) -> dict:
    """Extract sorted unique values for each categorical column."""
    return {col: sorted(df[col].unique().tolist()) for col in CATEGORICAL_COLS if col in df.columns}


# ============================================================
# MAIN
# ============================================================

def main():
    parser = argparse.ArgumentParser(description="Train AntiDROP models")
    parser.add_argument("--data", default="dataset.csv", help="Path to CSV dataset")
    args = parser.parse_args()

    data_path = Path(args.data) if os.path.isabs(args.data) else SCRIPT_DIR / args.data
    print(f"[1/7] Loading data from {data_path} ...")
    df = load_and_clean(str(data_path))
    print(f"      Loaded {len(df)} rows, {df.shape[1]} columns (after dropping non-predictive cols)")

    # â”€â”€ Save schema â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    schema = {
        "numeric_cols": NUMERIC_COLS,
        "categorical_cols": CATEGORICAL_COLS,
        "target_col": TARGET_COL,
        "allowed_values": allowed_values(df),
        "dtypes": {col: str(df[col].dtype) for col in NUMERIC_COLS + CATEGORICAL_COLS if col in df.columns},
    }
    schema_path = SCRIPT_DIR / "schema.json"
    with open(schema_path, "w") as f:
        json.dump(schema, f, indent=2)
    print(f"      Schema saved â†’ {schema_path}")

    # â”€â”€ Train / test split â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    X = df.drop(columns=[TARGET_COL])
    y = df[TARGET_COL]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, stratify=y, random_state=42
    )
    print(f"[2/7] Split: {len(X_train)} train / {len(X_test)} test")

    # â”€â”€ Build sklearn Pipeline â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    print("[3/7] Training RandomForest pipeline ...")
    preprocessor = ColumnTransformer(
        transformers=[
            ("num", StandardScaler(), NUMERIC_COLS),
            (
                "cat",
                OneHotEncoder(drop="first", sparse_output=False, handle_unknown="ignore"),
                CATEGORICAL_COLS,
            ),
        ],
        remainder="drop",
    )

    pipeline = Pipeline(
        steps=[
            ("preprocessor", preprocessor),
            ("classifier", RandomForestClassifier(
                n_estimators=300,
                class_weight="balanced",
                random_state=42,
                n_jobs=-1,
            )),
        ]
    )

    pipeline.fit(X_train, y_train)
    y_pred = pipeline.predict(X_test)
    y_prob = pipeline.predict_proba(X_test)[:, 1]

    print("\nâ”€â”€ Classification Report â”€â”€")
    print(classification_report(y_test, y_pred))
    print(f"ROC-AUC: {roc_auc_score(y_test, y_prob):.4f}\n")

    model_path = SCRIPT_DIR / "dropout_model.pkl"
    joblib.dump(pipeline, model_path)
    print(f"      Classifier saved â†’ {model_path}")

    # â”€â”€ SHAP â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    print("[4/7] Computing SHAP values on test set ...")
    # Extract the fitted preprocessor and transform X_test
    preprocessor_fitted = pipeline.named_steps["preprocessor"]
    rf = pipeline.named_steps["classifier"]
    X_test_transformed = preprocessor_fitted.transform(X_test)

    # Build feature names after one-hot encoding
    num_feature_names = NUMERIC_COLS.copy()
    cat_feature_names = list(
        preprocessor_fitted.named_transformers_["cat"].get_feature_names_out(CATEGORICAL_COLS)
    )
    all_feature_names = num_feature_names + cat_feature_names

    explainer = shap.TreeExplainer(rf)
    shap_values = explainer.shap_values(X_test_transformed)

    # shap_values shape varies by SHAP version:
    # Old API: list [class0_arr, class1_arr] — each (n_samples, n_features)
    # New API (>= 0.46): ndarray shape (n_samples, n_features, n_classes)
    if isinstance(shap_values, list):
        shap_vals_class1 = np.array(shap_values[1])
    elif isinstance(shap_values, np.ndarray) and shap_values.ndim == 3:
        shap_vals_class1 = shap_values[:, :, 1]
    else:
        shap_vals_class1 = np.array(shap_values)

    # Save global SHAP summary plot
    plt.figure(figsize=(10, 7))
    shap.summary_plot(
        shap_vals_class1,
        X_test_transformed,
        feature_names=all_feature_names,
        plot_type="bar",
        show=False,
    )
    plt.tight_layout()
    shap_plot_path = SCRIPT_DIR / "global_friction_points.png"
    plt.savefig(shap_plot_path, dpi=150, bbox_inches="tight")
    plt.close()
    print(f"      SHAP summary plot saved â†’ {shap_plot_path}")

    # â”€â”€ DoWhy + EconML Causal Model â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    print("[5/7] Running causal model (DoWhy + EconML CausalForestDML) ...")
    try:
        from econml.dml import CausalForestDML
        from sklearn.linear_model import LogisticRegression
        from sklearn.ensemble import GradientBoostingRegressor
        import dowhy
        from dowhy import CausalModel

        # Build a post-encoded feature frame for the causal model
        # We work on the full training data here (pre-encoded raw columns)
        df_causal = df.copy()

        # Binary-encode treatment: Scholarship Yes=1, No=0
        df_causal["treatment"] = (df_causal["Scholarship"] == "Yes").astype(int)
        df_causal["fee_pending"] = (df_causal["Fee_Status"] == "Pending").astype(int)

        # One-hot encode Course for the causal model's confounder frame.
        # Reference category = CIVIL because it is alphabetically first (sorted order:
        # CIVIL < CSE < ECE < EEE < MECH), consistent with OneHotEncoder(drop='first')
        # used in the main sklearn pipeline. Resulting dummies: Course_CSE, Course_ECE,
        # Course_EEE, Course_MECH.
        course_dummies = pd.get_dummies(df_causal["Course"], prefix="Course", drop_first=False)
        for c in ["Course_CSE", "Course_ECE", "Course_EEE", "Course_MECH", "Course_CIVIL"]:
            if c not in course_dummies.columns:
                course_dummies[c] = 0
        # Drop CIVIL — it is the reference category (alphabetically first, same as drop='first')
        course_dummies.drop(columns=["Course_CIVIL"], inplace=True)

        # Confounder columns: Semester, Previous_Academic_%, fee_pending,
        # + Course_CSE, Course_ECE, Course_EEE, Course_MECH (CIVIL is the omitted reference)
        course_cols = [c for c in ["Course_CSE", "Course_ECE", "Course_EEE", "Course_MECH"] if c in course_dummies.columns]
        CONFOUNDER_COLS = ["Semester", "Previous_Academic_%", "fee_pending"] + course_cols

        df_causal = pd.concat([df_causal, course_dummies], axis=1)

        # DoWhy â€” quick validation of the causal DAG
        dowhy_df = df_causal[EFFECT_MODIFIERS + CONFOUNDER_COLS + ["treatment", TARGET_COL]].dropna()
        causal_model = CausalModel(
            data=dowhy_df,
            treatment="treatment",
            outcome=TARGET_COL,
            common_causes=CONFOUNDER_COLS,
            effect_modifiers=EFFECT_MODIFIERS,
        )
        identified_estimand = causal_model.identify_effect(proceed_when_unidentifiable=True)
        print("      DoWhy identified estimand:", identified_estimand.estimands.get("backdoor", "N/A"))

        # EconML â€” CausalForestDML
        X_causal = df_causal[EFFECT_MODIFIERS].values
        W_causal  = df_causal[CONFOUNDER_COLS].values
        T_causal  = df_causal["treatment"].values
        Y_causal  = df_causal[TARGET_COL].values

        from sklearn.ensemble import GradientBoostingClassifier
        est = CausalForestDML(
            model_y=GradientBoostingRegressor(n_estimators=100, random_state=42),
            model_t=GradientBoostingClassifier(n_estimators=100, random_state=42),
            n_estimators=200,
            random_state=42,
            discrete_treatment=True,
            inference=True,
        )
        est.fit(Y_causal, T_causal, X=X_causal, W=W_causal)

        # Quick check â€” mean CATE
        cate_all = est.effect(X_causal)
        print(f"      Mean CATE (scholarship on dropout): {cate_all.mean():.4f} "
              f"(negative = scholarship reduces dropout risk)")

        print("[6/7] Running placebo refutation test ...")
        placebo_estimand = causal_model.identify_effect(proceed_when_unidentifiable=True)
        try:
            # Use DoWhy's built-in refutation with econml estimator indirectly
            # We estimate via DoWhy's EconML plugin for the refutation
            from sklearn.ensemble import GradientBoostingClassifier
            dowhy_estimate = causal_model.estimate_effect(
                identified_estimand,
                method_name="backdoor.econml.dml.CausalForestDML",
                method_params={
                    "init_params": {
                        "model_y": GradientBoostingRegressor(n_estimators=50, random_state=42),
                        "model_t": GradientBoostingClassifier(n_estimators=50, random_state=42),
                        "n_estimators": 100,
                        "random_state": 42,
                        "discrete_treatment": True,
                        "inference": True,
                    },
                    "fit_params": {},
                },
                target_units="ate",
            )
            refutation = causal_model.refute_estimate(
                identified_estimand,
                dowhy_estimate,
                method_name="placebo_treatment_refuter",
                placebo_type="permute",
                num_simulations=10,
            )
            print("      Placebo refutation result:")
            print(refutation)
        except Exception as ref_err:
            print(f"      Placebo refutation skipped (non-critical): {ref_err}")

        # Save causal artifact â€” everything needed to call est.effect(X_new) later
        causal_artifact = {
            "estimator": est,
            "effect_modifier_cols": EFFECT_MODIFIERS,
            "confounder_cols": CONFOUNDER_COLS,
            "treatment_col": "Scholarship",   # original raw column name
        }
        causal_path = SCRIPT_DIR / "causal_model.pkl"
        joblib.dump(causal_artifact, causal_path)
        print(f"      Causal model saved â†’ {causal_path}")

    except ImportError as e:
        print(f"[WARN] Causal model skipped â€” missing dependency: {e}")
        print("       Install: pip install dowhy econml")
        causal_artifact = None

    # â”€â”€ Done â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    print("\n[7/7] Done! Artifacts written to", SCRIPT_DIR)
    print("  dropout_model.pkl            âœ“")
    print("  causal_model.pkl             âœ“" if causal_artifact else "  causal_model.pkl             âœ— (skipped)")
    print("  schema.json                  âœ“")
    print("  global_friction_points.png   âœ“")


if __name__ == "__main__":
    main()

