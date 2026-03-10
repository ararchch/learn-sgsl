import argparse
import json
from collections import Counter, deque
from pathlib import Path

import cv2
import joblib
import mediapipe as mp
import numpy as np

MODELS_DIR = Path("models")
MODEL_PATH = MODELS_DIR / "r_tuck_svm.joblib"
CLASSES_PATH = MODELS_DIR / "r_tuck_classes.json"

PALM_LANDMARKS = [0, 5, 9, 13, 17]
TUCK_LANDMARKS = [0, 5, 9, 13, 14, 15, 16, 17, 18, 19, 20]

mp_hands = mp.solutions.hands


def open_camera(index: int):
    cap = cv2.VideoCapture(index, cv2.CAP_AVFOUNDATION)
    if cap.isOpened():
        return cap
    cap.release()
    return cv2.VideoCapture(index)


def build_subset_connections(subset_indices):
    subset = set(subset_indices)
    return [(a, b) for a, b in mp_hands.HAND_CONNECTIONS if a in subset and b in subset]


def draw_feature_landmarks(frame, hand_landmarks, subset_indices, subset_connections):
    h, w = frame.shape[:2]
    for a, b in subset_connections:
        pa = hand_landmarks.landmark[a]
        pb = hand_landmarks.landmark[b]
        xa, ya = int(pa.x * w), int(pa.y * h)
        xb, yb = int(pb.x * w), int(pb.y * h)
        cv2.line(frame, (xa, ya), (xb, yb), (120, 220, 120), 2)

    for idx in subset_indices:
        lm = hand_landmarks.landmark[idx]
        x, y = int(lm.x * w), int(lm.y * h)
        color = (0, 255, 255) if idx in PALM_LANDMARKS else (0, 180, 255)
        cv2.circle(frame, (x, y), 4, color, -1)


def extract_feature_subset(hand_landmarks, subset_indices):
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


def softmax_np(x: np.ndarray) -> np.ndarray:
    exps = np.exp(x - np.max(x))
    return exps / np.sum(exps)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--camera", type=int, default=0, help="Camera index")
    ap.add_argument("--window", type=int, default=7, help="Smoothing window (majority vote)")
    ap.add_argument(
        "--margin",
        type=float,
        default=0.25,
        help="Minimum decision margin to show stable prediction",
    )
    ap.add_argument("--min-det", type=float, default=0.6, help="MediaPipe min_detection_confidence")
    ap.add_argument("--min-track", type=float, default=0.6, help="MediaPipe min_tracking_confidence")
    args = ap.parse_args()

    assert MODEL_PATH.exists() and CLASSES_PATH.exists(), (
        "Missing model artifacts. Run train_r_tuck.py first."
    )

    clf = joblib.load(MODEL_PATH)
    class_names = json.loads(CLASSES_PATH.read_text())
    assert len(class_names) == 2, f"Expected binary classes, found {class_names}"

    subset_connections = build_subset_connections(TUCK_LANDMARKS)
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

            stable_pred = "-"
            current_pred = "-"
            conf_val = 0.0
            margin_val = 0.0
            present_score = 0.0

            if res.multi_hand_landmarks:
                hand_lms = res.multi_hand_landmarks[0]
                draw_feature_landmarks(frame, hand_lms, TUCK_LANDMARKS, subset_connections)

                x = extract_feature_subset(hand_lms, TUCK_LANDMARKS).reshape(1, -1)

                if hasattr(clf, "decision_function"):
                    dec = np.asarray(clf.decision_function(x))
                    if dec.ndim == 1:
                        score = float(dec[0])
                        probs = np.array([1.0 - sigmoid(score), sigmoid(score)], dtype=np.float32)
                        pred_idx = int(score >= 0.0)
                        margin_val = abs(score)
                    else:
                        dec = dec.ravel()
                        probs = softmax_np(dec)
                        pred_idx = int(np.argmax(dec))
                        top2 = np.sort(dec)[-2:]
                        margin_val = float(top2[-1] - top2[-2])
                else:
                    probs = clf.predict_proba(x).ravel()
                    pred_idx = int(np.argmax(probs))
                    top2 = np.sort(probs)[-2:]
                    margin_val = float(top2[-1] - top2[-2])

                current_pred = class_names[pred_idx]
                conf_val = float(probs[pred_idx])
                present_idx = class_names.index("present") if "present" in class_names else 1
                present_score = float(probs[present_idx])

                vote_buf.append(current_pred)
                if len(vote_buf) == vote_buf.maxlen and margin_val >= args.margin:
                    stable_pred = Counter(vote_buf).most_common(1)[0][0]

            cv2.rectangle(frame, (0, 0), (w, 125), (0, 0, 0), -1)
            cv2.putText(
                frame,
                f"R-tuck stable: {stable_pred}",
                (10, 30),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.8,
                (255, 255, 255),
                2,
            )
            cv2.putText(
                frame,
                f"Current: {current_pred} | Conf: {conf_val*100:.1f}%",
                (10, 60),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.62,
                (255, 255, 255),
                1,
            )
            cv2.putText(
                frame,
                f"Present score: {present_score:.3f} | Margin: {margin_val:.3f}",
                (10, 88),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.62,
                (255, 255, 255),
                1,
            )
            cv2.putText(
                frame,
                "Press Q to quit",
                (10, 114),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.55,
                (255, 255, 255),
                1,
            )

            cv2.imshow("Infer R Tuck", frame)
            if (cv2.waitKey(1) & 0xFF) in (ord("q"), ord("Q")):
                break

    cap.release()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
