"""
Live inference loop using the I3D WLASL model. Keeps the same webcam/video UI
style as infer.py but runs the 3D CNN for sign recognition.

Examples:
    # Webcam: record frames, press <i> to run inference, press <q> to quit
    python infer_i3d.py
    # Video file instead of webcam
    python infer_i3d.py --video /path/to/file.mp4
    # Custom weights
    python infer_i3d.py --weights WLASL/code/I3D/archived/asl100/FINAL_nslt_100_iters=896_top1=65.89_top5=84.11_top10=89.92.pt
"""

import argparse
import sys
from collections import deque
from pathlib import Path
from typing import List, Optional, Tuple

import cv2
import numpy as np
import torch
import torch.nn.functional as F

# Make I3D code importable when running from repo root
REPO_ROOT = Path(__file__).resolve().parent
I3D_DIR = REPO_ROOT / "WLASL" / "code" / "I3D"
sys.path.append(str(I3D_DIR))

from pytorch_i3d import InceptionI3d  # noqa: E402

DEFAULT_WEIGHTS = (
    I3D_DIR
    / "archived"
    / "asl100"
    / "FINAL_nslt_100_iters=896_top1=65.89_top5=84.11_top10=89.92.pt"
)
DEFAULT_LABELS = I3D_DIR / "preprocess" / "wlasl_class_list_100.txt"
FULL_LABELS = I3D_DIR / "preprocess" / "wlasl_class_list.txt"
DEFAULT_NUM_CLASSES = 100


def open_camera(index: int) -> cv2.VideoCapture:
    """Try AVFoundation on macOS, fallback otherwise."""
    cap = cv2.VideoCapture(index, cv2.CAP_AVFOUNDATION)
    if cap.isOpened():
        return cap
    cap.release()
    return cv2.VideoCapture(index)


def load_labels(path: Path) -> List[str]:
    if not path.exists():
        raise FileNotFoundError(f"Label file not found: {path}")
    return [ln.strip() for ln in path.read_text().splitlines() if ln.strip()]


def ensure_labels(path: Path, fallback: Path, num_classes: int) -> Path:
    """Create a smaller label file from the full list if missing."""
    if path.exists():
        return path
    if not fallback.exists():
        raise FileNotFoundError(f"Fallback label file missing: {fallback}")
    labels = [ln.strip() for ln in fallback.read_text().splitlines() if ln.strip()]
    if len(labels) < num_classes:
        raise ValueError(f"Fallback labels only have {len(labels)} entries; need {num_classes}.")
    path.write_text("\n".join(labels[:num_classes]))
    return path


def build_model(
    weights: Path,
    num_classes: int,
    device: torch.device,
    imagenet_weights: Optional[Path],
) -> InceptionI3d:
    model = InceptionI3d(400, in_channels=3)
    if imagenet_weights and imagenet_weights.exists():
        model.load_state_dict(torch.load(imagenet_weights, map_location=device))
    model.replace_logits(num_classes)
    state = torch.load(weights, map_location=device)
    model.load_state_dict(state)
    model.to(device)
    model.eval()
    return model


def preprocess_clip(frames: List[np.ndarray], target_size: int = 224) -> torch.Tensor:
    """
    Convert a list of BGR frames to the tensor the I3D model expects.
    Output shape: (1, 3, T, H, W) with values in [-1, 1].
    """
    proc = []
    for f in frames:
        frame = cv2.resize(f, (target_size, target_size))
        frame = (frame.astype(np.float32) / 255.0) * 2.0 - 1.0
        proc.append(frame)

    arr = np.stack(proc)  # (T, H, W, C)
    arr = arr.transpose(3, 0, 1, 2)  # (C, T, H, W)
    return torch.from_numpy(arr).unsqueeze(0)


def predict_topk(
    model: InceptionI3d,
    clip: torch.Tensor,
    device: torch.device,
    k: int,
) -> Tuple[List[int], List[float]]:
    with torch.no_grad():
        logits = model(clip.to(device))  # (B, num_classes, T')
        preds = logits.mean(dim=2)  # (B, num_classes)
        probs = F.softmax(preds, dim=1)
        top_probs, top_idx = probs.topk(k, dim=1)
        return (
            top_idx[0].cpu().tolist(),
            top_probs[0].cpu().tolist(),
        )


def format_topk(
    idxs: List[int], probs: List[float], labels: List[str]
) -> List[str]:
    lines = []
    for i, p in zip(idxs, probs):
        name = labels[i] if i < len(labels) else f"class_{i}"
        lines.append(f"{name} ({p:.2f})")
    return lines


def run(
    weights: Path,
    labels_path: Path,
    camera: int,
    video_path: Optional[Path],
    clip_len: int,
    topk: int,
    use_cpu: bool,
    imagenet_weights: Optional[Path],
) -> None:
    if not weights.exists():
        raise FileNotFoundError(f"Weights file not found: {weights}")
    labels_path = ensure_labels(labels_path, FULL_LABELS, DEFAULT_NUM_CLASSES)
    labels = load_labels(labels_path)
    device = torch.device("cpu" if use_cpu or not torch.cuda.is_available() else "cuda")
    model = build_model(weights, num_classes=len(labels), device=device, imagenet_weights=imagenet_weights)

    if video_path:
        cap = cv2.VideoCapture(str(video_path))
    else:
        cap = open_camera(camera)
    if not cap.isOpened():
        raise RuntimeError(
            f"Could not open {'video' if video_path else 'webcam'}."
        )

    frame_buf: deque[np.ndarray] = deque(maxlen=clip_len)
    last_topk: List[str] = []

    window_name = "I3D Inference"
    while True:
        ok, frame = cap.read()
        if not ok:
            print("[WARN] Empty frame from source.")
            break

        frame_buf.append(frame.copy())

        # Overlay predictions
        h, w = frame.shape[:2]
        cv2.rectangle(frame, (0, 0), (w, 25 + 25 * max(1, len(last_topk))), (0, 0, 0), -1)
        if last_topk:
            cv2.putText(
                frame,
                f"Top-1: {last_topk[0]}",
                (10, 30),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.8,
                (255, 255, 255),
                2,
            )
            for i, line in enumerate(last_topk[1:3], start=1):
                cv2.putText(
                    frame,
                    line,
                    (10, 30 + 25 * i),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.7,
                    (200, 200, 200),
                    2,
                )
        else:
            cv2.putText(
                frame,
                f"Buffered {len(frame_buf)}/{clip_len} frames",
                (10, 30),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.8,
                (255, 255, 255),
                2,
            )

        cv2.putText(
            frame,
            "Press 'I' to infer, 'Q' to quit",
            (10, h - 10),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.6,
            (255, 255, 255),
            1,
        )

        cv2.imshow(window_name, frame)
        key = cv2.waitKey(1) & 0xFF
        if key in (ord("q"), ord("Q")):
            break
        if key in (ord("i"), ord("I")):
            if len(frame_buf) < clip_len:
                print(f"[WARN] Need at least {clip_len} frames before inference (have {len(frame_buf)}).")
                continue
            clip = preprocess_clip(list(frame_buf))
            idxs, probs = predict_topk(model, clip, device, k=topk)
            last_topk = format_topk(idxs, probs, labels)
            frame_buf.clear()  # start fresh for the next recording

    cap.release()
    cv2.destroyAllWindows()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="I3D webcam/video inference.")
    parser.add_argument(
        "--weights",
        type=Path,
        default=DEFAULT_WEIGHTS,
        help="Path to fine-tuned I3D weights.",
    )
    parser.add_argument(
        "--imagenet-weights",
        type=Path,
        default=None,
        help="Optional: RGB ImageNet weights to load before fine-tuned state.",
    )
    parser.add_argument(
        "--labels",
        type=Path,
        default=DEFAULT_LABELS,
        help="Path to label file (one class per line).",
    )
    parser.add_argument(
        "--camera",
        type=int,
        default=0,
        help="Webcam index (ignored if --video is provided).",
    )
    parser.add_argument(
        "--video",
        type=Path,
        default=None,
        help="If set, run inference on this video file instead of webcam.",
    )
    parser.add_argument(
        "--clip-len",
        type=int,
        default=64,
        help="Number of frames per clip fed to I3D.",
    )
    parser.add_argument(
        "--topk",
        type=int,
        default=5,
        help="How many top predictions to display.",
    )
    parser.add_argument(
        "--cpu",
        action="store_true",
        help="Force CPU even if CUDA is available.",
    )
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    run(
        weights=args.weights,
        labels_path=args.labels,
        camera=args.camera,
        video_path=args.video,
        clip_len=args.clip_len,
        topk=args.topk,
        use_cpu=args.cpu,
        imagenet_weights=args.imagenet_weights,
    )
