import os, re, glob, argparse, numpy as np, pandas as pd, cv2
import mediapipe as mp

# --- labels: convert <sp> to real space, keep a–z + space ---
ALLOWED = set("abcdefghijklmnopqrstuvwxyz ")
def clean_label(s: str) -> str:
    s = (s or "").strip().lower()
    s = s.replace("<sp>", " ")
    s = re.sub(r"\s+", " ", s)
    return "".join(ch for ch in s if ch in ALLOWED).strip()

# --- numeric sort: 0001.jpg, 0002.jpg, ... ---
import re as _re
NUM_RE = _re.compile(r'(\d+)')
def natural_key(p):
    parts = NUM_RE.split(os.path.basename(p))
    parts[1::2] = [int(x) for x in parts[1::2]]
    return parts

# --- mediapipe setup (2 hands + small pose) -> 150-D per frame ---
mp_hands = mp.solutions.hands
mp_pose  = mp.solutions.pose

def _hands_vec(hres):
    if not getattr(hres, "multi_hand_landmarks", None):
        return [np.zeros(63, np.float32), np.zeros(63, np.float32)]
    ordered = sorted(hres.multi_hand_landmarks,
                     key=lambda hl: np.mean([lm.x for lm in hl.landmark]))
    chunks = []
    for hl in ordered[:2]:
        arr = np.array([(l.x,l.y,getattr(l,'z',0.0)) for l in hl.landmark], np.float32)
        chunks.append(arr.flatten())  # 21*3=63
    while len(chunks) < 2:
        chunks.append(np.zeros(63, np.float32))
    return chunks

def _pose_vec(pres):
    if pres.pose_landmarks is None:
        return np.zeros((8,3), np.float32)
    pts = np.array([(l.x,l.y,getattr(l,'z',0.0)) for l in pres.pose_landmarks.landmark], np.float32)
    keep = [11,12,13,14,15,16,23,24]  # shoulders, elbows, wrists, hips
    return pts[keep]

def frame_feat(img_bgr, hands, pose):
    rgb  = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
    hres = hands.process(rgb); pres = pose.process(rgb)
    h0, h1 = _hands_vec(hres)
    P = _pose_vec(pres).flatten()  # 24
    return np.concatenate([h0, h1, P], axis=0)  # 63+63+24 = 150

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--csv", required=True, help="ChicagoFSWild.csv")
    ap.add_argument("--frames_root", required=True, help="Root that contains the relative paths in `filename`")
    ap.add_argument("--out_dir", default="features")
    # CSV columns
    ap.add_argument("--col_filename", default="filename")
    ap.add_argument("--col_label",    default="label_proc")
    ap.add_argument("--col_nframes",  default="number_of_frames")
    ap.add_argument("--col_partition",default="partition")
    # sequence shaping
    ap.add_argument("--max_frames", type=int, default=128)
    ap.add_argument("--min_frames", type=int, default=6)
    # debug
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--verbose", action="store_true")
    args = ap.parse_args()

    os.makedirs(args.out_dir, exist_ok=True)
    df = pd.read_csv(args.csv)
    if args.limit > 0:
        df = df.head(args.limit)

    # Small report
    print("Frames root:", os.path.abspath(args.frames_root))
    print("Rows to process:", len(df))

    saved, skips = 0, {"empty_label":0, "no_folder":0, "no_images":0, "too_short":0}

    with mp_hands.Hands(model_complexity=1, max_num_hands=2) as hands, \
         mp_pose.Pose(model_complexity=0) as pose:

        for ridx, row in df.iterrows():
            rel_path = str(row[args.col_filename]).strip()          # e.g. "aslized/elsie_stecker_0001"
            folder   = os.path.normpath(os.path.join(args.frames_root, rel_path))
            print(folder)
            fname_base = os.path.basename(rel_path)                  # "elsie_stecker_0001"

            raw_label = str(row.get(args.col_label, ""))
            label = clean_label(raw_label)
            if not label:
                skips["empty_label"] += 1
                if args.verbose: print(f"[{ridx}] skip empty_label | raw={repr(raw_label)}")
                continue

            split = str(row.get(args.col_partition, "train")).lower()
            if split == "dev": split = "val"
            if split not in {"train","val","test"}: split = "train"

            if not os.path.isdir(folder):
                skips["no_folder"] += 1
                if args.verbose: print(f"[{ridx}] skip no_folder | folder={folder}")
                continue

            frames = (glob.glob(os.path.join(folder, "*.jpg")) +
                      glob.glob(os.path.join(folder, "*.JPG")) +
                      glob.glob(os.path.join(folder, "*.jpeg")) +
                      glob.glob(os.path.join(folder, "*.JPEG")) +
                      glob.glob(os.path.join(folder, "*.png")) +
                      glob.glob(os.path.join(folder, "*.PNG")))
            frames.sort(key=natural_key)
            if not frames:
                skips["no_images"] += 1
                if args.verbose: print(f"[{ridx}] skip no_images | folder={folder}")
                continue

            n_csv = row.get(args.col_nframes)
            if pd.notna(n_csv):
                try:
                    n_csv = int(n_csv)
                    frames = frames[:min(n_csv, len(frames))]
                except Exception:
                    pass

            idxs = list(range(len(frames)))
            if len(idxs) > args.max_frames:
                picks = np.linspace(0, len(idxs)-1, args.max_frames).astype(int)
                idxs = [idxs[i] for i in picks]

            seq = []
            for i in idxs:
                img = cv2.imread(frames[i])
                if img is None: continue
                seq.append(frame_feat(img, hands, pose))

            if len(seq) < args.min_frames:
                skips["too_short"] += 1
                if args.verbose: print(f"[{ridx}] skip too_short | got={len(seq)} < {args.min_frames} | folder={folder}")
                continue

            X = np.stack(seq, 0).astype(np.float32)

            out_split = os.path.join(args.out_dir, split)
            os.makedirs(out_split, exist_ok=True)
            # sanitize name (replace slashes) so we don't create nested dirs in features/
            safe_name = rel_path.replace("/", "_")
            out_path  = os.path.join(out_split, f"{safe_name}_{len(idxs)}.npz")
            if args.verbose: print(f"[{ridx}] save -> {out_path}")
            np.savez_compressed(out_path, x=X, y=label, meta=dict(filename=rel_path, n_frames=len(idxs)))
            saved += 1

    print(f"Saved: {saved}")
    print("Skips:", skips)

if __name__ == "__main__":
    main()
