# collect_data.py (mac-friendly)
import argparse
import cv2
import time
from pathlib import Path

import numpy as np
import mediapipe as mp

# ======= CONFIG =======
# Edit this list to your target static letters (exclude dynamic letters like J/Z).
LABELS = [
    "T", "O", "I", "N", "S", "R", "L", "C"
]
CAPTURE_EVERY_N_FRAMES = 3
DATA_DIR = Path("data"); DATA_DIR.mkdir(parents=True, exist_ok=True)
CSV_PATH = DATA_DIR / "samples.csv"

mp_hands = mp.solutions.hands
mp_drawing = mp.solutions.drawing_utils
mp_styles = mp.solutions.drawing_styles


def landmarks_to_feature(hand_landmarks):
    """
    Return a 63-D feature: (x,y,z) of 21 landmarks.
    Normalised: (1) relative to wrist, (2) scale by max distance for size invariance.
    """
    pts = np.array([[lm.x, lm.y, lm.z] for lm in hand_landmarks.landmark], dtype=np.float32)
    wrist = pts[0].copy()
    pts -= wrist
    scale = np.linalg.norm(pts, axis=1).max()
    if scale < 1e-6:
        scale = 1.0
    pts /= scale
    return pts.flatten()


def open_camera(index: int):
    """Try AVFoundation first on macOS, fall back to default backend."""
    cap = cv2.VideoCapture(index, cv2.CAP_AVFOUNDATION)
    if cap.isOpened():
        return cap
    cap.release()
    cap = cv2.VideoCapture(index)
    return cap


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--camera", type=int, default=0, help="Camera index (try 0..3)")
    args = ap.parse_args()

    cap = open_camera(args.camera)
    if not cap.isOpened():
        raise RuntimeError(
            f"Could not open webcam (index {args.camera}). "
            "Try --camera 0..3 and ensure Terminal/IDE has Camera permission in "
            "System Settings > Privacy & Security > Camera."
        )

    active_label_idx = 0
    capturing = False
    frame_idx = 0
    saved_counts = {lbl: 0 for lbl in LABELS}

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
            frame_idx += 1
            frame = cv2.flip(frame, 1)
            h, w = frame.shape[:2]

            # Inference
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            rgb.flags.writeable = False
            res = hands.process(rgb)
            rgb.flags.writeable = True

            # Draw landmarks
            if res.multi_hand_landmarks:
                mp_drawing.draw_landmarks(
                    frame,
                    res.multi_hand_landmarks[0],
                    mp_hands.HAND_CONNECTIONS,
                    mp_styles.get_default_hand_landmarks_style(),
                    mp_styles.get_default_hand_connections_style(),
                )

            # Capture logic (space toggles capturing)
            if capturing and res.multi_hand_landmarks and frame_idx % CAPTURE_EVERY_N_FRAMES == 0:
                feats = landmarks_to_feature(res.multi_hand_landmarks[0])
                label = LABELS[active_label_idx]
                row = ",".join([label] + [f"{v:.6f}" for v in feats]) + "\n"
                if not CSV_PATH.exists():
                    with open(CSV_PATH, "w") as f:
                        f.write(",".join(["label"] + [f"f{i}" for i in range(len(feats))]) + "\n")
                        f.write(row)
                else:
                    with open(CSV_PATH, "a") as f:
                        f.write(row)
                saved_counts[label] += 1

            # HUD
            cv2.rectangle(frame, (0, 0), (w, 70), (0, 0, 0), -1)
            status = "REC" if capturing else "—"
            txt = (
                f"Label: {LABELS[active_label_idx]}  |  "
                f"Saved: {saved_counts[LABELS[active_label_idx]]}  |  "
                f"[{status}]  Keys: 1..9/0=label, SPACE=toggle capture, Q=quit"
            )
            cv2.putText(frame, txt, (10, 45), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (255, 255, 255), 2)
            cv2.imshow("Collect static letters", frame)

            # Single read of keyboard per frame
            key = cv2.waitKey(1) & 0xFF
            # Digits -> label index
            if key in [ord(str(i)) for i in range(10)]:
                digit = 0 if key == ord('0') else int(chr(key))
                idx = digit - 1 if digit != 0 else 9
                if 0 <= idx < len(LABELS):
                    active_label_idx = idx
            elif key == ord(' '):
                capturing = not capturing
            elif key in (ord('q'), ord('Q')):
                break

    cap.release()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
