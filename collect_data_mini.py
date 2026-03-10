import argparse
from pathlib import Path

import cv2
import mediapipe as mp
import numpy as np

CAPTURE_EVERY_N_FRAMES = 3
DATA_DIR = Path("data")
DATA_DIR.mkdir(parents=True, exist_ok=True)

PALM_LANDMARKS = [0, 5, 9, 13, 17]

FEATURE_CONFIG = {
    "cross": {
        "csv_path": DATA_DIR / "samples_r_cross.csv",
        "instruction": "Cross and keep upright your index + middle fingers",
        "landmarks": [0, 5, 6, 7, 8, 9, 10, 11, 12, 13, 17],
    },
    "tuck": {
        "csv_path": DATA_DIR / "samples_r_tuck.csv",
        "instruction": "Curl ring + pinky fingers down into your palm",
        "landmarks": [0, 5, 9, 13, 14, 15, 16, 17, 18, 19, 20],
    },
    "thumb": {
        "csv_path": DATA_DIR / "samples_r_thumb.csv",
        "instruction": "Place thumb over the ring + pinky fingers",
        "landmarks": [0, 1, 2, 3, 4, 5, 9, 13, 14, 15, 16, 17, 18, 19, 20],
    },
    "vertical": {
        "csv_path": DATA_DIR / "samples_r_vertical.csv",
        "instruction": "Keep index + middle fingers vertical and upright",
        "landmarks": [0, 5, 6, 7, 8, 9, 10, 11, 12, 13, 17],
    },
}

LABELS = ["absent", "present"]

mp_hands = mp.solutions.hands


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
    """
    Extract only relevant hand landmarks for a binary mini-model.
    Normalization:
    1) center all points by palm center
    2) scale by palm width (index MCP to pinky MCP) for size invariance
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


def open_camera(index: int):
    cap = cv2.VideoCapture(index, cv2.CAP_AVFOUNDATION)
    if cap.isOpened():
        return cap
    cap.release()
    return cv2.VideoCapture(index)


def append_row(csv_path: Path, label: str, feats: np.ndarray):
    row = ",".join([label] + [f"{v:.6f}" for v in feats]) + "\n"
    if not csv_path.exists():
        with open(csv_path, "w") as f:
            header = ",".join(["label"] + [f"f{i}" for i in range(len(feats))]) + "\n"
            f.write(header)
            f.write(row)
    else:
        with open(csv_path, "a") as f:
            f.write(row)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--camera", type=int, default=0, help="Camera index (try 0..3)")
    ap.add_argument(
        "--feature",
        choices=sorted(FEATURE_CONFIG.keys()),
        required=True,
        help="Which R-sign characteristic to collect data for",
    )
    args = ap.parse_args()

    feature_cfg = FEATURE_CONFIG[args.feature]
    csv_path = feature_cfg["csv_path"]
    subset_indices = feature_cfg["landmarks"]
    subset_connections = build_subset_connections(subset_indices)

    cap = open_camera(args.camera)
    if not cap.isOpened():
        raise RuntimeError(
            f"Could not open webcam (index {args.camera}). "
            "Try --camera 0..3 and ensure Terminal/IDE has Camera permission in "
            "System Settings > Privacy & Security > Camera."
        )

    active_label_idx = 1
    capturing = False
    frame_idx = 0
    saved_counts = {lbl: 0 for lbl in LABELS}

    print(f"[INFO] Collecting feature: {args.feature}")
    print(f"[INFO] Writing to: {csv_path}")
    print(f"[INFO] Landmarks used: {subset_indices}")
    print("[INFO] Labels: 1=absent, 2=present")

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

            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            rgb.flags.writeable = False
            res = hands.process(rgb)
            rgb.flags.writeable = True

            if res.multi_hand_landmarks:
                draw_feature_landmarks(
                    frame,
                    res.multi_hand_landmarks[0],
                    subset_indices,
                    subset_connections,
                )

            if capturing and res.multi_hand_landmarks and frame_idx % CAPTURE_EVERY_N_FRAMES == 0:
                feats = extract_feature_subset(res.multi_hand_landmarks[0], subset_indices)
                label = LABELS[active_label_idx]
                append_row(csv_path, label, feats)
                saved_counts[label] += 1

            cv2.rectangle(frame, (0, 0), (w, 110), (0, 0, 0), -1)
            status = "REC" if capturing else "PAUSE"
            txt1 = f"Feature: {args.feature} | Label: {LABELS[active_label_idx]} | [{status}]"
            txt2 = (
                f"Saved absent={saved_counts['absent']} present={saved_counts['present']} | "
                "Keys: 1=absent 2=present SPACE=toggle Q=quit"
            )
            txt3 = f"Prompt: {feature_cfg['instruction']}"
            cv2.putText(frame, txt1, (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.58, (255, 255, 255), 2)
            cv2.putText(frame, txt2, (10, 60), cv2.FONT_HERSHEY_SIMPLEX, 0.52, (255, 255, 255), 1)
            cv2.putText(frame, txt3, (10, 90), cv2.FONT_HERSHEY_SIMPLEX, 0.52, (130, 230, 255), 1)
            cv2.imshow("Collect R mini features", frame)

            key = cv2.waitKey(1) & 0xFF
            if key == ord("1"):
                active_label_idx = 0
            elif key == ord("2"):
                active_label_idx = 1
            elif key == ord(" "):
                capturing = not capturing
            elif key in (ord("q"), ord("Q")):
                break

    cap.release()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
