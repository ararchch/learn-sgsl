from pathlib import Path
import argparse
import json
import sys

import joblib
import numpy as np
from sklearn.metrics import classification_report, confusion_matrix
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.svm import LinearSVC


FEATURE_SPECS = {
    "cross": {
        "data_path": Path("data/samples_r_cross_js.csv"),
        "model_path": Path("models/r_cross_js_svm.joblib"),
        "classes_path": Path("models/r_cross_js_classes.json"),
        "metrics_path": Path("models/r_cross_js_metrics.txt"),
        "browser_model_path": Path("models/r_cross_js_browser.json"),
        "frontend_browser_model_path": Path("frontend/sgsl/public/models/r_cross_js_browser.json"),
    },
    "tuck": {
        "data_path": Path("data/samples_r_tuck_js.csv"),
        "model_path": Path("models/r_tuck_js_svm.joblib"),
        "classes_path": Path("models/r_tuck_js_classes.json"),
        "metrics_path": Path("models/r_tuck_js_metrics.txt"),
        "browser_model_path": Path("models/r_tuck_js_browser.json"),
        "frontend_browser_model_path": Path("frontend/sgsl/public/models/r_tuck_js_browser.json"),
    },
    "thumb": {
        "data_path": Path("data/samples_r_thumb_js.csv"),
        "model_path": Path("models/r_thumb_js_svm.joblib"),
        "classes_path": Path("models/r_thumb_js_classes.json"),
        "metrics_path": Path("models/r_thumb_js_metrics.txt"),
        "browser_model_path": Path("models/r_thumb_js_browser.json"),
        "frontend_browser_model_path": Path("frontend/sgsl/public/models/r_thumb_js_browser.json"),
    },
    "vertical": {
        "data_path": Path("data/samples_r_vertical_js.csv"),
        "model_path": Path("models/r_vertical_js_svm.joblib"),
        "classes_path": Path("models/r_vertical_js_classes.json"),
        "metrics_path": Path("models/r_vertical_js_metrics.txt"),
        "browser_model_path": Path("models/r_vertical_js_browser.json"),
        "frontend_browser_model_path": Path("frontend/sgsl/public/models/r_vertical_js_browser.json"),
    },
}


def load_csv(path: Path):
    if not path.exists():
        raise FileNotFoundError(f"Dataset not found: {path}")

    raw = np.genfromtxt(path, delimiter=",", dtype=str)
    if raw.size == 0:
        raise ValueError(f"Dataset is empty: {path}")
    if raw.ndim == 1:
        raw = raw.reshape(1, -1)
    if raw.shape[0] < 2:
        raise ValueError(f"Dataset must include header + at least one row: {path}")

    data = raw[1:]
    if data.ndim == 1:
        data = data.reshape(1, -1)
    if data.shape[1] < 2:
        raise ValueError(f"Expected at least 2 columns (label + features): {path}")

    labels = data[:, 0]
    X = data[:, 1:].astype(np.float32)
    return X, labels


def build_model(c_value: float):
    return Pipeline(
        [
            ("scaler", StandardScaler(with_mean=True, with_std=True)),
            ("svm", LinearSVC(C=c_value, class_weight="balanced", random_state=42)),
        ]
    )


def export_browser_model(clf: Pipeline, class_names, feature: str, out_path: Path):
    if not isinstance(clf, Pipeline):
        raise TypeError("Expected sklearn Pipeline with scaler + svm.")
    if "scaler" not in clf.named_steps or "svm" not in clf.named_steps:
        raise ValueError("Pipeline must contain 'scaler' and 'svm' named steps.")

    scaler = clf.named_steps["scaler"]
    svm = clf.named_steps["svm"]

    if not hasattr(scaler, "mean_") or not hasattr(scaler, "scale_"):
        raise ValueError("Scaler is missing mean_/scale_.")
    if not hasattr(svm, "coef_") or not hasattr(svm, "intercept_"):
        raise ValueError("SVM is missing coef_/intercept_.")

    coef = np.asarray(svm.coef_, dtype=np.float64)
    intercept = np.asarray(svm.intercept_, dtype=np.float64)
    mean = np.asarray(scaler.mean_, dtype=np.float64)
    scale = np.asarray(scaler.scale_, dtype=np.float64)

    if coef.ndim == 2:
        if coef.shape[0] != 1:
            raise ValueError("Expected binary LinearSVC (coef shape [1, n_features]).")
        coef = coef[0]
    if intercept.size != 1:
        raise ValueError("Expected binary LinearSVC intercept shape [1].")

    if len(class_names) != 2:
        raise ValueError(f"Expected binary classes, got {class_names}")

    if "present" not in class_names or "absent" not in class_names:
        raise ValueError(f"Classes must include 'absent' and 'present', got {class_names}")

    model_json = {
        "format": "linear_svc_binary_v1",
        "feature": feature,
        "class_names": class_names,
        # sklearn binary decision_function > 0 corresponds to class index 1
        "positive_class_index": 1,
        "negative_class_index": 0,
        "present_index": int(class_names.index("present")),
        "absent_index": int(class_names.index("absent")),
        "feature_dim": int(coef.shape[0]),
        "scaler": {
            "mean": mean.tolist(),
            "scale": scale.tolist(),
        },
        "svm": {
            "coef": coef.tolist(),
            "intercept": float(intercept[0]),
        },
    }

    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w") as f:
        json.dump(model_json, f)


def train_feature(feature: str, test_size: float, seed: int, c_value: float):
    spec = FEATURE_SPECS[feature]
    spec["model_path"].parent.mkdir(parents=True, exist_ok=True)

    X, labels = load_csv(spec["data_path"])
    class_names = sorted(list(set(labels.tolist())))
    if len(class_names) != 2:
        raise ValueError(
            f"[{feature}] Expected binary labels, found: {class_names}. "
            "CSV should contain 'absent' and 'present'."
        )

    cls_to_idx = {c: i for i, c in enumerate(class_names)}
    y = np.array([cls_to_idx[c] for c in labels], dtype=np.int64)

    X_tr, X_va, y_tr, y_va = train_test_split(
        X, y, test_size=test_size, stratify=y, random_state=seed
    )

    clf = build_model(c_value)
    clf.fit(X_tr, y_tr)

    y_pred = clf.predict(X_va)
    report = classification_report(y_va, y_pred, target_names=class_names, digits=4)
    cm = confusion_matrix(y_va, y_pred)

    joblib.dump(clf, spec["model_path"])
    with open(spec["classes_path"], "w") as f:
        json.dump(class_names, f)
    with open(spec["metrics_path"], "w") as f:
        f.write(f"Feature: {feature}\n")
        f.write(f"Dataset: {spec['data_path']}\n")
        f.write("Model: linear svm\n\n")
        f.write("Classes:\n")
        f.write(json.dumps(class_names) + "\n\n")
        f.write("Classification report:\n")
        f.write(report + "\n")
        f.write("Confusion matrix:\n")
        np.savetxt(f, cm, fmt="%d")

    export_browser_model(clf, class_names, feature, spec["browser_model_path"])
    export_browser_model(clf, class_names, feature, spec["frontend_browser_model_path"])

    print(f"\n[{feature}] classes: {class_names}")
    print(f"[{feature}] dataset: {spec['data_path']}")
    print(f"[{feature}] model:   {spec['model_path']}")
    print(f"[{feature}] classes: {spec['classes_path']}")
    print(f"[{feature}] metrics: {spec['metrics_path']}")
    print(f"[{feature}] browser: {spec['browser_model_path']}")
    print(f"[{feature}] browser(frontend): {spec['frontend_browser_model_path']}")
    print(f"[{feature}] report:\n{report}")
    print(f"[{feature}] confusion matrix:\n{cm}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--feature",
        choices=["all"] + sorted(FEATURE_SPECS.keys()),
        default="all",
        help="Train one mini-model, or all available mini-models",
    )
    ap.add_argument("--test-size", type=float, default=0.2, help="Validation split (default: 0.2)")
    ap.add_argument("--seed", type=int, default=42, help="Random seed")
    ap.add_argument("--c", type=float, default=1.0, help="LinearSVC C value")
    args = ap.parse_args()

    if args.feature == "all":
        targets = sorted(FEATURE_SPECS.keys())
    else:
        targets = [args.feature]

    trained = []
    skipped = []

    for feature in targets:
        spec = FEATURE_SPECS[feature]
        if not spec["data_path"].exists():
            msg = (
                f"[{feature}] Skipping because dataset not found: {spec['data_path']}"
                if args.feature == "all"
                else f"[{feature}] Dataset not found: {spec['data_path']}"
            )
            if args.feature == "all":
                print(msg)
                skipped.append(feature)
                continue
            raise FileNotFoundError(msg)

        try:
            train_feature(feature, args.test_size, args.seed, args.c)
            trained.append(feature)
        except Exception as exc:
            if args.feature == "all":
                print(f"[{feature}] Failed: {exc}")
                skipped.append(feature)
                continue
            raise

    print("\nSummary")
    print(f"Trained: {trained if trained else 'none'}")
    print(f"Skipped/failed: {skipped if skipped else 'none'}")

    if not trained:
        sys.exit(1)


if __name__ == "__main__":
    main()
