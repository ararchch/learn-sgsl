import argparse
import json
from collections import Counter, deque
from pathlib import Path

import cv2
import joblib
import mediapipe as mp
import numpy as np

MODELS_DIR = Path("models")

PRIMARY_MODEL_PATH = MODELS_DIR / "hand_static.joblib"
PRIMARY_CLASSES_PATH = MODELS_DIR / "class_names.json"

PALM_LANDMARKS = [0, 5, 9, 13, 17]

CHECK_CONFIGS = [
    {
        "id": "vertical",
        "label": "Vertical",
        "model_path": MODELS_DIR / "r_vertical_svm.joblib",
        "classes_path": MODELS_DIR / "r_vertical_classes.json",
        "landmarks": [0, 5, 6, 7, 8, 9, 10, 11, 12, 13, 17],
        "fix": "Keep your index and middle fingers upright and vertical.",
    },
    {
        "id": "cross",
        "label": "Cross",
        "model_path": MODELS_DIR / "r_cross_svm.joblib",
        "classes_path": MODELS_DIR / "r_cross_classes.json",
        "landmarks": [0, 5, 6, 7, 8, 9, 10, 11, 12, 13, 17],
        "fix": "Hold upright and cross your index and middle fingers.",
    },
    {
        "id": "tuck",
        "label": "Tuck",
        "model_path": MODELS_DIR / "r_tuck_svm.joblib",
        "classes_path": MODELS_DIR / "r_tuck_classes.json",
        "landmarks": [0, 5, 9, 13, 14, 15, 16, 17, 18, 19, 20],
        "fix": "Curl your pinky and ring fingers into your palm.",
    },
    {
        "id": "thumb",
        "label": "Thumb",
        "model_path": MODELS_DIR / "r_thumb_svm.joblib",
        "classes_path": MODELS_DIR / "r_thumb_classes.json",
        "landmarks": [0, 1, 2, 3, 4, 5, 9, 13, 14, 15, 16, 17, 18, 19, 20],
        "fix": "Place thumb over pinky and ring finger.",
    },
]

FALLBACK_FIX = "Adjust overall R handshape and hold steady."

mp_hands = mp.solutions.hands
mp_drawing = mp.solutions.drawing_utils
mp_styles = mp.solutions.drawing_styles


def open_camera(index: int):
    cap = cv2.VideoCapture(index, cv2.CAP_AVFOUNDATION)
    if cap.isOpened():
        return cap
    cap.release()
    return cv2.VideoCapture(index)


def softmax_np(x: np.ndarray) -> np.ndarray:
    exps = np.exp(x - np.max(x))
    return exps / np.sum(exps)


def sigmoid(x: float) -> float:
    if x >= 0:
        z = np.exp(-x)
        return float(1.0 / (1.0 + z))
    z = np.exp(x)
    return float(z / (1.0 + z))


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


def landmarks_to_primary_feature(hand_landmarks):
    """
    Primary static model feature format from infer.py:
    63-D (21x3), wrist-centered and max-distance scaled.
    """
    pts = np.array([[lm.x, lm.y, lm.z] for lm in hand_landmarks.landmark], dtype=np.float32)
    wrist = pts[0].copy()
    pts -= wrist
    scale = np.linalg.norm(pts, axis=1).max()
    if scale < 1e-6:
        scale = 1.0
    pts /= scale
    return pts.flatten()


def extract_subset_feature(hand_landmarks, subset_indices):
    """
    Mini-model feature format:
    subset 3D landmarks, palm-centered and palm-width scaled.
    """
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


def predict_with_margin(model, x: np.ndarray):
    """
    Returns (pred_idx, confidence, margin, probs).
    Works for both binary and multiclass classifiers.
    """
    if hasattr(model, "decision_function"):
        dec = np.asarray(model.decision_function(x))
        if dec.ndim == 1 and dec.size == 1:
            score = float(dec[0])
            probs = np.array([1.0 - sigmoid(score), sigmoid(score)], dtype=np.float32)
            pred_idx = int(score >= 0.0)
            margin = abs(score)
            conf = float(probs[pred_idx])
            return pred_idx, conf, margin, probs

        dec = dec.ravel()
        probs = softmax_np(dec)
        pred_idx = int(np.argmax(dec))
        if dec.size >= 2:
            top2 = np.sort(dec)[-2:]
            margin = float(top2[-1] - top2[-2])
        else:
            margin = abs(float(dec[0]))
        conf = float(probs[pred_idx])
        return pred_idx, conf, margin, probs

    probs = model.predict_proba(x).ravel()
    pred_idx = int(np.argmax(probs))
    if probs.size >= 2:
        top2 = np.sort(probs)[-2:]
        margin = float(top2[-1] - top2[-2])
    else:
        margin = float(probs[0])
    conf = float(probs[pred_idx])
    return pred_idx, conf, margin, probs


def load_json_list(path: Path):
    data = json.loads(path.read_text())
    if not isinstance(data, list):
        raise ValueError(f"Expected list in {path}, got {type(data)}")
    return data


def load_artifacts():
    required_paths = [PRIMARY_MODEL_PATH, PRIMARY_CLASSES_PATH]
    for cfg in CHECK_CONFIGS:
        required_paths.extend([cfg["model_path"], cfg["classes_path"]])

    for p in required_paths:
        if not p.exists():
            raise FileNotFoundError(f"Missing artifact: {p}")

    primary_model = joblib.load(PRIMARY_MODEL_PATH)
    primary_classes = load_json_list(PRIMARY_CLASSES_PATH)
    if "R" not in primary_classes:
        raise ValueError(f"Primary classes missing 'R': {primary_classes}")

    checks = []
    for cfg in CHECK_CONFIGS:
        model = joblib.load(cfg["model_path"])
        classes = load_json_list(cfg["classes_path"])
        if "present" not in classes or "absent" not in classes:
            raise ValueError(
                f"Mini model classes for {cfg['id']} must contain "
                f"'absent' and 'present', found: {classes}"
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

    return primary_model, primary_classes, checks


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--camera", type=int, default=0, help="Camera index")
    ap.add_argument("--window", type=int, default=7, help="Primary smoothing window")
    ap.add_argument("--margin", type=float, default=0.25, help="Primary margin threshold")
    ap.add_argument("--mini-margin", type=float, default=0.25, help="Mini-check margin threshold")
    ap.add_argument("--min-det", type=float, default=0.6, help="MediaPipe min_detection_confidence")
    ap.add_argument("--min-track", type=float, default=0.6, help="MediaPipe min_tracking_confidence")
    args = ap.parse_args()

    primary_model, primary_classes, checks = load_artifacts()
    vote_buf = deque(maxlen=max(1, args.window))

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

            primary_current = "-"
            primary_stable = "-"
            primary_conf = 0.0
            primary_margin = 0.0

            status_text = "No hand detected"
            stage_text = "-"
            fix_text = "Show one hand clearly in frame."
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

                # 1) Primary model first
                x_primary = landmarks_to_primary_feature(hand_lms).reshape(1, -1)
                p_idx, p_conf, p_margin, _ = predict_with_margin(primary_model, x_primary)
                primary_current = primary_classes[p_idx]
                primary_conf = p_conf
                primary_margin = p_margin

                vote_buf.append(primary_current)
                if len(vote_buf) == vote_buf.maxlen and primary_margin >= args.margin:
                    primary_stable = Counter(vote_buf).most_common(1)[0][0]

                primary_is_r = (
                    (primary_current == "R" and primary_margin >= args.margin)
                    or primary_stable == "R"
                )

                if primary_is_r:
                    status_text = "R correct"
                    stage_text = "Pass"
                    fix_text = "Good job. Hold steady."
                else:
                    # 2) Ordered mini checks: vertical -> cross -> tuck -> thumb
                    status_text = "R needs correction"
                    stage_text = "All checks pass"
                    fix_text = FALLBACK_FIX

                    for check in checks:
                        x_mini = extract_subset_feature(hand_lms, check["landmarks"]).reshape(1, -1)
                        m_idx, _, m_margin, _ = predict_with_margin(check["model"], x_mini)
                        m_pred = check["classes"][m_idx]
                        passed = m_pred == "present" and m_margin >= args.mini_margin

                        if not passed:
                            stage_text = check["label"]
                            fix_text = check["fix"]
                            failing_check = check
                            break

                if failing_check is not None:
                    draw_subset_highlight(
                        frame,
                        hand_lms,
                        failing_check["landmarks"],
                        failing_check["connections"],
                    )

            cv2.rectangle(frame, (0, 0), (w, 155), (0, 0, 0), -1)
            cv2.putText(
                frame,
                f"Primary current: {primary_current} | stable: {primary_stable}",
                (10, 28),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.62,
                (255, 255, 255),
                1,
            )
            cv2.putText(
                frame,
                f"Primary conf: {primary_conf*100:.1f}% | margin: {primary_margin:.3f}",
                (10, 54),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.62,
                (255, 255, 255),
                1,
            )
            cv2.putText(
                frame,
                f"Status: {status_text}",
                (10, 82),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.68,
                (120, 255, 120) if status_text == "R correct" else (255, 255, 255),
                2,
            )
            cv2.putText(
                frame,
                f"Stage: {stage_text}",
                (10, 108),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.62,
                (255, 220, 130),
                1,
            )
            cv2.putText(
                frame,
                f"Fix: {fix_text}",
                (10, 134),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.62,
                (255, 255, 255),
                1,
            )
            cv2.putText(
                frame,
                "Press Q to quit",
                (10, h - 10),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.58,
                (255, 255, 255),
                1,
            )

            cv2.imshow("Infer with Feedback - R", frame)
            if (cv2.waitKey(1) & 0xFF) in (ord("q"), ord("Q")):
                break

    cap.release()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
