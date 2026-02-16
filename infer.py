# infer.py
import cv2
import json
from pathlib import Path
from collections import deque, Counter

import numpy as np
import mediapipe as mp
import joblib

# ======= PATHS =======
MODELS_DIR = Path("models")
MODEL_PATH = MODELS_DIR / "hand_static.joblib"
CLASSES_PATH = MODELS_DIR / "class_names.json"

assert MODEL_PATH.exists() and CLASSES_PATH.exists(), (
    "Run train.py first to create model and class files."
)

# ======= LOAD MODEL =======
clf = joblib.load(MODEL_PATH)
class_names = json.loads(Path(CLASSES_PATH).read_text())

# ======= MEDIAPIPE SETUP =======
mp_hands = mp.solutions.hands
mp_drawing = mp.solutions.drawing_utils
mp_styles = mp.solutions.drawing_styles

# ======= SETTINGS =======
PRED_WINDOW = 7            # number of frames to smooth over
CONF_MARGIN = 0.25         # minimum margin between top-2 scores to display
CAMERA_INDEX = 0           # change if wrong webcam is used


def landmarks_to_feature(hand_landmarks):
    """Convert MediaPipe hand landmarks to normalized 63D feature vector."""
    pts = np.array([[lm.x, lm.y, lm.z] for lm in hand_landmarks.landmark], dtype=np.float32)
    wrist = pts[0].copy()
    pts -= wrist
    scale = np.linalg.norm(pts, axis=1).max()
    if scale < 1e-6:
        scale = 1.0
    pts /= scale
    return pts.flatten()


def decision_margin(dec):
    """Compute margin between top-2 decision_function values."""
    top2 = np.sort(dec)[-2:]
    return top2[-1] - top2[-2]


def open_camera(index: int):
    """Try AVFoundation on macOS, fallback otherwise."""
    cap = cv2.VideoCapture(index, cv2.CAP_AVFOUNDATION)
    if cap.isOpened():
        return cap
    cap.release()
    cap = cv2.VideoCapture(index)
    return cap


def main():
    cap = open_camera(CAMERA_INDEX)
    if not cap.isOpened():
        raise RuntimeError(
            f"Could not open webcam (index {CAMERA_INDEX}). "
            "Try changing CAMERA_INDEX or granting camera permissions."
        )

    vote_buf = deque(maxlen=PRED_WINDOW)

    with mp_hands.Hands(
        model_complexity=1,
        max_num_hands=1,
        min_detection_confidence=0.6,
        min_tracking_confidence=0.6,
    ) as hands:
        while True:
            ok, frame = cap.read()
            if not ok:
                print("[WARN] Empty frame from camera.")
                break

            frame = cv2.flip(frame, 1)
            h, w = frame.shape[:2]

            # Detect hands
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            rgb.flags.writeable = False
            res = hands.process(rgb)
            rgb.flags.writeable = True

            pred_text = "—"
            margin_val = 0.0

            if res.multi_hand_landmarks:
                hand_lms = res.multi_hand_landmarks[0]
                mp_drawing.draw_landmarks(
                    frame,
                    hand_lms,
                    mp_hands.HAND_CONNECTIONS,
                    mp_styles.get_default_hand_landmarks_style(),
                    mp_styles.get_default_hand_connections_style(),
                )

                x = landmarks_to_feature(hand_lms).reshape(1, -1)

                # Prediction & margin
                if hasattr(clf, "decision_function"):
                    dec = clf.decision_function(x).ravel()
                    margin_val = decision_margin(dec)
                    pred_idx = int(np.argmax(dec))
                else:
                    probs = clf.predict_proba(x).ravel()
                    top2 = np.sort(probs)[-2:]
                    margin_val = float(top2[-1] - top2[-2])
                    pred_idx = int(np.argmax(probs))

                vote_buf.append(class_names[pred_idx])

                if len(vote_buf) == PRED_WINDOW:
                    vote = Counter(vote_buf).most_common(1)[0][0]
                    if margin_val >= CONF_MARGIN:
                        pred_text = vote

            # UI overlay
            cv2.rectangle(frame, (0, 0), (w, 70), (0, 0, 0), -1)
            cv2.putText(
                frame, f"Pred: {pred_text}", (10, 45),
                cv2.FONT_HERSHEY_SIMPLEX, 1.1, (255, 255, 255), 2
            )
            cv2.putText(
                frame, "Press 'Q' to quit", (10, h - 10),
                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 1
            )

            cv2.imshow("Static Letter Inference", frame)
            if (cv2.waitKey(1) & 0xFF) in (ord('q'), ord('Q')):
                break

    cap.release()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
