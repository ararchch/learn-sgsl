import argparse
import json
from pathlib import Path

import cv2
import joblib
import mediapipe as mp
import numpy as np

MODELS_DIR = Path("models")
PALM_LANDMARKS = [0, 5, 9, 13, 17]

CHECK_CONFIGS = [
    {
        "id": "vertical",
        "label": "Vertical",
        "model_path": MODELS_DIR / "r_vertical_js_svm.joblib",
        "classes_path": MODELS_DIR / "r_vertical_js_classes.json",
        "landmarks": [0, 5, 6, 7, 8, 9, 10, 11, 12, 13, 17],
        "fix": "Keep your index and middle fingers upright and vertical.",
    },
    {
        "id": "cross",
        "label": "Cross",
        "model_path": MODELS_DIR / "r_cross_js_svm.joblib",
        "classes_path": MODELS_DIR / "r_cross_js_classes.json",
        "landmarks": [0, 5, 6, 7, 8, 9, 10, 11, 12, 13, 17],
        "fix": "Hold upright and cross your index and middle fingers.",
    },
    {
        "id": "tuck",
        "label": "Tuck",
        "model_path": MODELS_DIR / "r_tuck_js_svm.joblib",
        "classes_path": MODELS_DIR / "r_tuck_js_classes.json",
        "landmarks": [0, 5, 9, 13, 14, 15, 16, 17, 18, 19, 20],
        "fix": "Curl your pinky and ring fingers into your palm.",
    },
    {
        "id": "thumb",
        "label": "Thumb",
        "model_path": MODELS_DIR / "r_thumb_js_svm.joblib",
        "classes_path": MODELS_DIR / "r_thumb_js_classes.json",
        "landmarks": [0, 1, 2, 3, 4, 5, 9, 13, 14, 15, 16, 17, 18, 19, 20],
        "fix": "Place thumb over pinky and ring finger.",
    },
]

mp_hands = mp.solutions.hands
mp_drawing = mp.solutions.drawing_utils
mp_styles = mp.solutions.drawing_styles


def open_camera(index: int):
    cap = cv2.VideoCapture(index, cv2.CAP_AVFOUNDATION)
    if cap.isOpened():
        return cap
    cap.release()
    return cv2.VideoCapture(index)


def build_subset_connections(subset_indices):
    subset = set(subset_indices)
    return [(a, b) for a, b in mp_hands.HAND_CONNECTIONS if a in subset and b in subset]


def draw_subset_highlight(frame, hand_landmarks, subset_indices, subset_connections):
    h, w = frame.shape[:2]
    for a, b in subset_connections:
        pa = hand_landmarks.landmark[a]
        pb = hand_landmarks.landmark[b]
        xa, ya = int(pa.x * w), int(pa.y * h)
        xb, yb = int(pb.x * w), int(pb.y * h)
        cv2.line(frame, (xa, ya), (xb, yb), (40, 70, 255), 3)

    for idx in subset_indices:
        lm = hand_landmarks.landmark[idx]
        x, y = int(lm.x * w), int(lm.y * h)
        cv2.circle(frame, (x, y), 5, (0, 60, 255), -1)


def extract_subset_feature(hand_landmarks, subset_indices):
    pts = np.array([[lm.x, lm.y, lm.z] for lm in hand_landmarks.landmark], dtype=np.float32)
    palm_center = pts[PALM_LANDMARKS].mean(axis=0, keepdims=True)
    pts -= palm_center

    palm_width = np.linalg.norm(pts[5] - pts[17])
    if palm_width < 1e-6:
        palm_width = np.linalg.norm(pts, axis=1).max()
    if palm_width < 1e-6:
        palm_width = 1.0
    pts /= palm_width

    return pts[subset_indices].flatten()


def sigmoid(x: float) -> float:
    if x >= 0:
        z = np.exp(-x)
        return float(1.0 / (1.0 + z))
    z = np.exp(x)
    return float(z / (1.0 + z))


def load_json_list(path: Path):
    data = json.loads(path.read_text())
    if not isinstance(data, list):
        raise ValueError(f"Expected list in {path}, got {type(data)}")
    return data


def load_checks():
    checks = []
    for cfg in CHECK_CONFIGS:
        if not cfg["model_path"].exists() or not cfg["classes_path"].exists():
            raise FileNotFoundError(
                f"Missing JS mini-model artifacts for {cfg['id']}: "
                f"{cfg['model_path']} and/or {cfg['classes_path']}. "
                "Run train_r_mini_js.py first."
            )

        model = joblib.load(cfg["model_path"])
        classes = load_json_list(cfg["classes_path"])
        if "present" not in classes or "absent" not in classes:
            raise ValueError(
                f"Classes for {cfg['id']} must contain 'absent' and 'present', found: {classes}"
            )

        checks.append(
            {
                "id": cfg["id"],
                "label": cfg["label"],
                "fix": cfg["fix"],
                "landmarks": cfg["landmarks"],
                "connections": build_subset_connections(cfg["landmarks"]),
                "model": model,
                "classes": classes,
            }
        )

    return checks


def predict_binary_check(model, class_names, x):
    pred_idx = int(model.predict(x)[0])
    pred_label = class_names[pred_idx]

    present_idx = class_names.index("present")
    margin = 0.0
    present_score = 0.0

    if hasattr(model, "decision_function"):
        dec = np.asarray(model.decision_function(x))
        if dec.ndim == 1 and dec.size == 1:
            score = float(dec[0])
            margin = abs(score)
            present_score = sigmoid(score) if present_idx == 1 else (1.0 - sigmoid(score))
        else:
            dec = dec.ravel()
            if dec.size >= 2:
                top2 = np.sort(dec)[-2:]
                margin = float(top2[-1] - top2[-2])
                exps = np.exp(dec - np.max(dec))
                probs = exps / np.sum(exps)
                present_score = float(probs[present_idx])
            else:
                margin = abs(float(dec[0]))
                present_score = float(dec[0])
    elif hasattr(model, "predict_proba"):
        probs = model.predict_proba(x).ravel()
        present_score = float(probs[present_idx])
        if probs.size >= 2:
            top2 = np.sort(probs)[-2:]
            margin = float(top2[-1] - top2[-2])
        else:
            margin = float(probs[0])

    return pred_label, margin, present_score


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--camera", type=int, default=0, help="Camera index")
    ap.add_argument("--mini-margin", type=float, default=0.1, help="Mini-check margin threshold")
    ap.add_argument("--min-det", type=float, default=0.6, help="MediaPipe min_detection_confidence")
    ap.add_argument("--min-track", type=float, default=0.6, help="MediaPipe min_tracking_confidence")
    args = ap.parse_args()

    checks = load_checks()

    cap = open_camera(args.camera)
    if not cap.isOpened():
        raise RuntimeError(
            f"Could not open webcam (index {args.camera}). "
            "Try --camera 0..3 and check camera permissions."
        )

    with mp_hands.Hands(
        model_complexity=1,
        max_num_hands=1,
        min_detection_confidence=args.min_det,
        min_tracking_confidence=args.min_track,
    ) as hands:
        while True:
            ok, frame = cap.read()
            if not ok:
                print("[WARN] Empty frame from camera.")
                break

            frame = cv2.flip(frame, 1)
            h, w = frame.shape[:2]

            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            rgb.flags.writeable = False
            res = hands.process(rgb)
            rgb.flags.writeable = True

            status_text = "No hand detected"
            stage_text = "-"
            fix_text = "Show one hand clearly in frame."
            details_text = "vertical:- cross:- tuck:- thumb:-"
            failing_check = None

            if res.multi_hand_landmarks:
                hand_lms = res.multi_hand_landmarks[0]
                mp_drawing.draw_landmarks(
                    frame,
                    hand_lms,
                    mp_hands.HAND_CONNECTIONS,
                    mp_styles.get_default_hand_landmarks_style(),
                    mp_styles.get_default_hand_connections_style(),
                )

                details = []
                for check in checks:
                    x = extract_subset_feature(hand_lms, check["landmarks"]).reshape(1, -1)
                    pred_label, margin, present_score = predict_binary_check(
                        check["model"], check["classes"], x
                    )
                    passed = pred_label == "present" and margin >= args.mini_margin
                    details.append(f"{check['id']}:{'ok' if passed else 'x'}")

                    if not passed and failing_check is None:
                        failing_check = check
                        stage_text = check["label"]
                        fix_text = check["fix"]

                details_text = " ".join(details)

                if failing_check is None:
                    status_text = "R correct (all 4 JS mini checks pass)"
                    stage_text = "Pass"
                    fix_text = "Good job. Hold steady."
                else:
                    status_text = "R needs correction"
                    draw_subset_highlight(
                        frame,
                        hand_lms,
                        failing_check["landmarks"],
                        failing_check["connections"],
                    )

            cv2.rectangle(frame, (0, 0), (w, 135), (0, 0, 0), -1)
            cv2.putText(
                frame,
                f"Status: {status_text}",
                (10, 28),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.66,
                (120, 255, 120) if "correct" in status_text.lower() else (255, 255, 255),
                2,
            )
            cv2.putText(
                frame,
                f"Current stage: {stage_text}",
                (10, 58),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.60,
                (140, 220, 255),
                2,
            )
            cv2.putText(
                frame,
                f"Fix: {fix_text}",
                (10, 88),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.52,
                (255, 210, 140),
                1,
            )
            cv2.putText(
                frame,
                f"Checks: {details_text}",
                (10, 116),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.50,
                (255, 255, 255),
                1,
            )

            cv2.imshow("Infer with Feedback - R (JS mini checks)", frame)
            key = cv2.waitKey(1) & 0xFF
            if key in (ord("q"), ord("Q"), 27):
                break

    cap.release()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
