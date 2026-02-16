# train.py
from pathlib import Path
import argparse
import json

import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.svm import LinearSVC, SVC
from sklearn.neural_network import MLPClassifier
from sklearn.pipeline import Pipeline
from sklearn.metrics import classification_report, confusion_matrix
import joblib


DATA_PATH = Path("data/samples.csv")
MODELS_DIR = Path("models")
MODELS_DIR.mkdir(parents=True, exist_ok=True)
MODEL_PATH = MODELS_DIR / "hand_static.joblib"
CLASSES_PATH = MODELS_DIR / "class_names.json"
METRICS_PATH = MODELS_DIR / "metrics.txt"


def load_csv(path: Path):
    assert path.exists(), f"Dataset not found at {path}. Run collect_data.py first."
    raw = np.genfromtxt(path, delimiter=",", dtype=str)
    header = raw[0]
    data = raw[1:]
    labels = data[:, 0]
    X = data[:, 1:].astype(np.float32)
    return X, labels, header


def build_model(kind: str):
    if kind == "svm-linear":
        clf = Pipeline([
            ("scaler", StandardScaler(with_mean=True, with_std=True)),
            ("svm", LinearSVC(C=1.0, class_weight="balanced", random_state=42)),
        ])
    elif kind == "svm-rbf":
        clf = Pipeline([
            ("scaler", StandardScaler(with_mean=True, with_std=True)),
            ("svm", SVC(kernel="rbf", C=3.0, gamma="scale", probability=True,
                        class_weight="balanced", random_state=42)),
        ])
    elif kind == "mlp":
        clf = Pipeline([
            ("scaler", StandardScaler(with_mean=True, with_std=True)),
            ("mlp", MLPClassifier(hidden_layer_sizes=(256, 128),
                                  activation="relu",
                                  batch_size=128,
                                  learning_rate_init=1e-3,
                                  max_iter=100,
                                  early_stopping=True,
                                  random_state=42)),
        ])
    else:
        raise ValueError(f"Unknown model kind: {kind}")
    return clf


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", choices=["svm-linear", "svm-rbf", "mlp"], default="svm-linear",
                    help="Classifier to use (default: svm-linear)")
    ap.add_argument("--test-size", type=float, default=0.2, help="Validation split (default: 0.2)")
    ap.add_argument("--seed", type=int, default=42, help="Random seed")
    args = ap.parse_args()

    X, labels, header = load_csv(DATA_PATH)

    # Encode labels -> integers (sorted for stable order)
    class_names = sorted(list(set(labels.tolist())))
    cls_to_idx = {c: i for i, c in enumerate(class_names)}
    y = np.array([cls_to_idx[c] for c in labels], dtype=np.int64)

    # Train/val split (stratified)
    X_tr, X_va, y_tr, y_va = train_test_split(
        X, y, test_size=args.test_size, stratify=y, random_state=args.seed
    )

    # Build & fit
    clf = build_model(args.model)
    clf.fit(X_tr, y_tr)

    # Evaluate
    y_pred = clf.predict(X_va)
    report = classification_report(y_va, y_pred, target_names=class_names, digits=4)
    cm = confusion_matrix(y_va, y_pred)

    print("\nClasses:", class_names)
    print(f"\nModel: {args.model}")
    print("\nClassification report:\n", report)
    print("Confusion matrix:\n", cm)

    # Save artifacts
    joblib.dump(clf, MODEL_PATH)
    with open(CLASSES_PATH, "w") as f:
        json.dump(class_names, f)

    with open(METRICS_PATH, "w") as f:
        f.write(f"Model: {args.model}\n\n")
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
