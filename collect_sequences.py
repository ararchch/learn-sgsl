# collect_sequences.py — temporal clip collector (similar UX to collect_data.py)
import argparse
import time
from pathlib import Path
import cv2
import numpy as np
import mediapipe as mp

# Default static-letter list; change to your dynamic labels if you like
DEFAULT_LABELS = [
    "HELLO", "THANK_YOU", "NAME", "PLEASE", "SORRY",
    "YES", "NO", "GOOD", "BAD", "HELP"
]

def parse_args():
    p = argparse.ArgumentParser("Temporal clip collector (landmark sequences)")
    p.add_argument("--out", type=Path, default=Path("data"),
                   help="Output base directory (default: data)")
    p.add_argument("--split", type=str, default="train", choices=["train", "val"],
                   help="Destination split (train/val) folder")
    p.add_argument("--labels", type=str, nargs="*", default=DEFAULT_LABELS,
                   help="List of labels (keys 1..9,0 map to first 10)")
    p.add_argument("--camera", type=int, default=0, help="OpenCV camera index")
    p.add_argument("--capture_stride", type=int, default=2,
                   help="Keep 1 of every N frames (temporal downsample)")
    p.add_argument("--min_frames", type=int, default=5,
                   help="Minimum frames required to save a clip")
    p.add_argument("--max_frames", type=int, default=120,
                   help="Optional cap to auto-cut takes (0 disables)")
    p.add_argument("--mirror", action="store_true",
                   help="Mirror preview (helps user; landmarks remain normalized)")
    return p.parse_args()

def flatten_landmarks(hand_landmarks):
    # Returns a flat [63] = 21*(x,y,z)
    arr = np.zeros(63, dtype=np.float32)
    for i, lm in enumerate(hand_landmarks.landmark[:21]):
        j = i * 3
        arr[j + 0] = lm.x
        arr[j + 1] = lm.y
        arr[j + 2] = lm.z
    return arr

def ensure_dirs(base: Path, split: str, labels):
    root = base / f"clips_{split}"
    root.mkdir(parents=True, exist_ok=True)
    for lab in labels:
        (root / lab).mkdir(parents=True, exist_ok=True)
    return root

def draw_hud(img, label, is_capturing, frames_in_take, total_saved, stride, min_frames):
    h, w = img.shape[:2]
    panel = img.copy()
    color = (60, 165, 250) if is_capturing else (160, 160, 160)
    cv2.rectangle(panel, (10, 10), (w - 10, 110), (0, 0, 0), -1)
    cv2.addWeighted(panel, 0.35, img, 0.65, 0, img)

    txts = [
        f"Label: {label}",
        f"Capturing: {'YES' if is_capturing else 'no'}    Frames (kept): {frames_in_take}    Stride: {stride}",
        f"Saved clips this session: {total_saved}    Min frames to save: {min_frames}",
        "Keys: [1..9,0]=label  SPACE=start/stop  S=save  C=clear  Q=quit"
    ]
    y = 30
    for t in txts:
        cv2.putText(img, t, (20, y), cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2, cv2.LINE_AA)
        y += 24

def main():
    args = parse_args()
    labels = args.labels
    active_label_idx = 0
    active_label = labels[active_label_idx]
    total_saved = 0

    out_root = ensure_dirs(args.out, args.split, labels)

    mp_hands = mp.solutions.hands
    hands = mp_hands.Hands(
        static_image_mode=False,
        max_num_hands=1,
        model_complexity=1,
        min_detection_confidence=0.6,
        min_tracking_confidence=0.6
    )

    cap = cv2.VideoCapture(args.camera)
    if not cap.isOpened():
        raise RuntimeError("Cannot open camera")

    capturing = False
    frame_idx = 0
    kept_frames = []  # list of [63] rows

    win = "Temporal Collector"
    cv2.namedWindow(win, cv2.WINDOW_NORMAL)

    print("=== Temporal Collector ===")
    print(f"Output -> {out_root}")
    print(f"Labels : {labels}")
    print("Controls: [1..9,0]=label  SPACE=start/stop  S=save  C=clear  Q=quit")

    try:
        while True:
            ok, frame = cap.read()
            frame = cv2.flip(frame, 1)
            if not ok:
                break

            if args.mirror:
                frame = cv2.flip(frame, 1)

            # MediaPipe expects RGB
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            res = hands.process(rgb)

            if res.multi_hand_landmarks:
                # Draw landmarks for user feedback (on preview)
                mp.solutions.drawing_utils.draw_landmarks(
                    frame, res.multi_hand_landmarks[0], mp_hands.HAND_CONNECTIONS
                )

                if capturing:
                    frame_idx += 1
                    if frame_idx % args.capture_stride == 0:
                        flat = flatten_landmarks(res.multi_hand_landmarks[0])
                        kept_frames.append(flat)

                        # Auto-cut if max_frames reached
                        if args.max_frames > 0 and len(kept_frames) >= args.max_frames:
                            print(f"[Auto-cut] reached max_frames={args.max_frames}")
                            capturing = False

            draw_hud(frame, active_label, capturing, len(kept_frames),
                     total_saved, args.capture_stride, args.min_frames)

            cv2.imshow(win, frame)
            key = cv2.waitKey(1) & 0xFF

            if key == 255:  # no key
                continue

            # Label hotkeys 1..9,0 -> first 10 labels
            if key in [ord(str(d)) for d in range(10)]:
                d = 0 if key == ord('0') else int(chr(key))
                idx = d - 1 if d != 0 else 9
                if 0 <= idx < len(labels):
                    active_label_idx = idx
                    active_label = labels[active_label_idx]

            elif key in (ord(' '),):  # space -> toggle capture
                capturing = not capturing
                if capturing:
                    # starting a new take
                    frame_idx = 0
                    kept_frames = []
                    print(f"[Start] label={active_label}")
                else:
                    print("[Stop]")

            elif key in (ord('s'), ord('S')):  # save the take
                if len(kept_frames) < args.min_frames:
                    print(f"[Skip] not enough frames: {len(kept_frames)} < {args.min_frames}")
                else:
                    arr = np.stack(kept_frames, axis=0).astype(np.float32)  # [t,63]
                    ts = int(time.time() * 1000)
                    out_dir = out_root / active_label
                    out_dir.mkdir(parents=True, exist_ok=True)
                    out_path = out_dir / f"{active_label}_{ts}.npz"
                    # Save with string 'label' for readability; trainer accepts 'label' or 'y'
                    np.savez(out_path, x=arr, label=active_label)
                    total_saved += 1
                    print(f"[Saved] {out_path}  shape={arr.shape}")
                # after save, reset current take (not capturing)
                capturing = False
                kept_frames = []

            elif key in (ord('c'), ord('C')):  # clear current take
                kept_frames = []
                capturing = False
                print("[Clear] current take discarded")

            elif key in (ord('q'), ord('Q')):  # quit
                break

    finally:
        cap.release()
        cv2.destroyAllWindows()
        hands.close()

if __name__ == "__main__":
    main()
