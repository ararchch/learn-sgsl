from pathlib import Path
import argparse
import json

import joblib
import numpy as np
from sklearn.metrics import classification_report, confusion_matrix
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.svm import LinearSVC


DATA_PATH = Path("data/samples_r_tuck.csv")
MODELS_DIR = Path("models")
MODELS_DIR.mkdir(parents=True, exist_ok=True)
MODEL_PATH = MODELS_DIR / "r_tuck_svm.joblib"
CLASSES_PATH = MODELS_DIR / "r_tuck_classes.json"
METRICS_PATH = MODELS_DIR / "r_tuck_metrics.txt"


def load_csv(path: Path):
    assert path.exists(), f"Dataset not found at {path}. Run collect_data_mini.py --feature tuck first."
    raw = np.genfromtxt(path, delimiter=",", dtype=str)
    data = raw[1:]
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


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--test-size", type=float, default=0.2, help="Validation split (default: 0.2)")
    ap.add_argument("--seed", type=int, default=42, help="Random seed")
    ap.add_argument("--c", type=float, default=1.0, help="LinearSVC C value")
    args = ap.parse_args()

    X, labels = load_csv(DATA_PATH)

    class_names = sorted(list(set(labels.tolist())))
    if len(class_names) != 2:
        raise ValueError(f"Expected binary labels, found: {class_names}")
    cls_to_idx = {c: i for i, c in enumerate(class_names)}
    y = np.array([cls_to_idx[c] for c in labels], dtype=np.int64)

    X_tr, X_va, y_tr, y_va = train_test_split(
        X, y, test_size=args.test_size, stratify=y, random_state=args.seed
    )

    clf = build_model(args.c)
    clf.fit(X_tr, y_tr)

    y_pred = clf.predict(X_va)
    report = classification_report(y_va, y_pred, target_names=class_names, digits=4)
    cm = confusion_matrix(y_va, y_pred)

    print("\nClasses:", class_names)
    print("\nModel: linear svm")
    print("\nClassification report:\n", report)
    print("Confusion matrix:\n", cm)

    joblib.dump(clf, MODEL_PATH)
    with open(CLASSES_PATH, "w") as f:
        json.dump(class_names, f)

    with open(METRICS_PATH, "w") as f:
        f.write("Model: linear svm\n\n")
        f.write("Classes:\n")
        f.write(json.dumps(class_names) + "\n\n")
        f.write("Classification report:\n")
        f.write(report + "\n")
        f.write("Confusion matrix:\n")
        np.savetxt(f, cm, fmt="%d")

    print(f"\nSaved model to {MODEL_PATH}")
    print(f"Saved classes to {CLASSES_PATH}")
    print(f"Saved metrics to {METRICS_PATH}")


if __name__ == "__main__":
    main()
