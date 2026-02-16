# server.py
from pathlib import Path
from typing import List, Optional, Tuple, Dict

import base64
import json
import io
import sys
import numpy as np
from PIL import Image

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import joblib

# Optional: run MediaPipe Hands server-side for image inputs
try:
    import mediapipe as mp
    MP_AVAILABLE = True
    mp_hands = mp.solutions.hands
except Exception:
    MP_AVAILABLE = False

# ---------------------------
# Paths & Loading
# ---------------------------
MODELS_DIR = Path("models")
MODEL_PATH = MODELS_DIR / "hand_static.joblib"
CLASSES_PATH = MODELS_DIR / "class_names.json"

if not MODEL_PATH.exists() or not CLASSES_PATH.exists():
    raise RuntimeError("Model files not found. Run train.py first.")

clf = joblib.load(MODEL_PATH)
class_names: List[str] = json.loads(CLASSES_PATH.read_text())

# ---------------------------
# FastAPI app
# ---------------------------
app = FastAPI(title="SgSL Static Letter API", version="1.0.0")

# CORS (adjust origins as needed)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],           # tighten in prod
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------
# Utils
# ---------------------------
def landmarks_to_feature_np(landmarks: np.ndarray) -> np.ndarray:
    """
    landmarks: shape (21, 3) array with [x, y, z] in normalized coords (0..1),
               like MediaPipe Hands outputs.
    Returns 1 x 63 normalized feature vector (wrist-centered, scale-invariant).
    """
    if landmarks.shape != (21, 3):
        raise ValueError("Expected landmarks of shape (21, 3).")
    pts = landmarks.astype(np.float32).copy()
    wrist = pts[0].copy()
    pts -= wrist
    scale = np.linalg.norm(pts, axis=1).max()
    if scale < 1e-6:
        scale = 1.0
    pts /= scale
    return pts.reshape(1, -1)  # (1, 63)


def decision_margin_from_scores(scores: np.ndarray) -> float:
    """scores: 1D array of per-class decision_function or probs."""
    if scores.ndim != 1 or scores.size < 2:
        return 0.0
    top2 = np.sort(scores)[-2:]
    return float(top2[-1] - top2[-2])


def predict_from_feature(x: np.ndarray) -> Tuple[str, float, float]:
    """
    x: (1, 63). Returns (letter, confidence, margin)
    confidence is a softmax over decision_function if available; else max prob.
    margin is top2 difference (higher = more separation).
    """
    if hasattr(clf, "decision_function"):
        dec = clf.decision_function(x).ravel()
        margin = decision_margin_from_scores(dec)
        # Convert decision_function to pseudo-prob via softmax for readability
        exps = np.exp(dec - dec.max())
        probs = exps / exps.sum()
        pred_idx = int(np.argmax(dec))
        conf = float(probs[pred_idx])
    else:
        probs = clf.predict_proba(x).ravel()
        margin = decision_margin_from_scores(probs)
        pred_idx = int(np.argmax(probs))
        conf = float(probs[pred_idx])

    letter = class_names[pred_idx]
    return letter, conf, margin


def run_mediapipe_on_image(pil_img: Image.Image) -> Optional[np.ndarray]:
    """
    Runs MediaPipe Hands on an RGB image and returns (21,3) landmarks if found, else None.
    Requires mediapipe to be installed.
    """
    if not MP_AVAILABLE:
        raise RuntimeError("MediaPipe is not installed server-side. Use /predict_landmarks or install mediapipe.")

    img = np.array(pil_img.convert("RGB"))
    with mp_hands.Hands(
        model_complexity=1,
        max_num_hands=1,
        min_detection_confidence=0.6,
        min_tracking_confidence=0.6,
        static_image_mode=True,  # important for single images
    ) as hands:
        res = hands.process(img)
        if not res.multi_hand_landmarks:
            return None
        lm = res.multi_hand_landmarks[0]
        pts = np.array([[p.x, p.y, p.z] for p in lm.landmark], dtype=np.float32)
        return pts  # (21, 3)

# ---------------------------
# Schemas
# ---------------------------
class LandmarksPayload(BaseModel):
    # Flattened list length 63, or nested list [[x,y,z] * 21]
    landmarks: List[float] | List[List[float]]

class PredictResponse(BaseModel):
    letter: str
    confidence: float
    margin: float
    class_names: List[str]

# ---------------------------
# Routes
# ---------------------------
@app.get("/health")
def health():
    return {"status": "ok", "model_loaded": True, "num_classes": len(class_names)}

@app.get("/labels")
def labels():
    return {"class_names": class_names}

@app.post("/predict_landmarks", response_model=PredictResponse)
def predict_landmarks(payload: LandmarksPayload):
    # Normalize input to (21, 3)
    lms = payload.landmarks
    arr = np.array(lms, dtype=np.float32)
    if arr.size == 63:
        arr = arr.reshape(21, 3)
    if arr.shape != (21, 3):
        raise HTTPException(status_code=400, detail="Expected landmarks shape (21,3) or length 63.")
    x = landmarks_to_feature_np(arr)
    letter, conf, margin = predict_from_feature(x)
    return PredictResponse(letter=letter, confidence=conf, margin=margin, class_names=class_names)

@app.post("/predict_image", response_model=PredictResponse)
async def predict_image(file: UploadFile = File(...)):
    # Decode image
    try:
        content = await file.read()
        pil = Image.open(io.BytesIO(content)).convert("RGB")
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid image file")

    # Run MediaPipe server-side
    pts = run_mediapipe_on_image(pil)
    if pts is None:
        raise HTTPException(status_code=422, detail="No hand detected in the image")

    x = landmarks_to_feature_np(pts)
    letter, conf, margin = predict_from_feature(x)
    return PredictResponse(letter=letter, confidence=conf, margin=margin, class_names=class_names)

_TEMPORAL = {"loaded": False, "runner": None}

class SeqIn(BaseModel):
    sequence: list[list[float]]  # T' x 63

def get_temporal_runner():
    if not _TEMPORAL["loaded"]:
        from infer_temporal import TemporalInfer
        _TEMPORAL["runner"] = TemporalInfer("models/seq_model.pt")
        _TEMPORAL["loaded"] = True
    return _TEMPORAL["runner"]

@app.post("/predict_sequence")
def predict_sequence(inp: SeqIn):
    seq = np.asarray(inp.sequence, dtype=np.float32)  # [t,63]
    if seq.ndim != 2 or seq.shape[1] != 63:
        return {"error": f"Expected [t,63], got {list(seq.shape)}"}
    runner = get_temporal_runner()
    out = runner.predict(seq)
    return {"letter": out["label"], "confidence": out["confidence"], "margin": out["margin"]}


SEQ_LABELS_JSON = Path("models/seq_labels.json")

@app.get("/seq_labels")
def seq_labels():
    if not SEQ_LABELS_JSON.exists():
        # Fallback: try to read labels from temporal checkpoint
        try:
            from infer_temporal import TemporalInfer
            runner = TemporalInfer("models/seq_model.pt")
            labels = runner.labels or []
        except Exception:
            labels = []
    else:
        meta = json.loads(SEQ_LABELS_JSON.read_text())
        labels = meta.get("labels", [])

    return {"class_names": labels, "num_classes": len(labels)}

# ---------------------------
# Dynamic sign inference (I3D / WLASL)
# ---------------------------
_DYNAMIC = {"loaded": False, "runner": None}

class DynamicFramesIn(BaseModel):
    frames: List[str]  # base64 JPEGs, optional data URL prefix
    labels: Optional[List[str]] = None  # optional allowlist of labels to score against

class DynamicPredItem(BaseModel):
    label: str
    score: float

class DynamicPredictResponse(BaseModel):
    top10: List[DynamicPredItem]
    raw_frames: int
    used_frames: int

def decode_base64_frame(b64: str) -> np.ndarray:
    if "," in b64:
        b64 = b64.split(",", 1)[1]
    data = base64.b64decode(b64)
    pil = Image.open(io.BytesIO(data)).convert("RGB")
    return np.array(pil)

class WLASLDynamicPredictor:
    def __init__(self, weights_path: Path, class_list_path: Path):
        try:
            import cv2  # noqa: F401
            import torch  # noqa: F401
            from collections import OrderedDict  # noqa: F401
        except Exception as e:
            raise RuntimeError(f"Missing dynamic inference deps: {e}")

        import cv2
        import torch
        from collections import OrderedDict

        repo_root = Path(__file__).resolve().parent
        i3d_dir = repo_root / "WLASL" / "wlasl_model_test"
        sys.path.append(str(i3d_dir))
        from pytorch_i3d import InceptionI3d  # type: ignore

        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.num_classes = 100
        # Default to the full WLASL-100 head. Callers can still request an allowlist at inference time.
        self.allowed_class_count = self.num_classes
        self.model = InceptionI3d(num_classes=self.num_classes, in_channels=3)

        if not weights_path.exists():
            raise FileNotFoundError(f"Weights file not found: {weights_path}")

        checkpoint = torch.load(weights_path, map_location=self.device)
        state_dict = checkpoint["state_dict"] if "state_dict" in checkpoint else checkpoint

        new_state_dict = OrderedDict()
        for k, v in state_dict.items():
            name = k.replace("module.", "")
            new_state_dict[name] = v

        self.model.load_state_dict(new_state_dict)
        self.model.to(self.device)
        self.model.eval()

        self.classes = self._load_classes(class_list_path, limit=self.allowed_class_count)
        # Case-insensitive lookup for allowlisting.
        self.word_to_idx: Dict[str, int] = {}
        for idx, word in self.classes.items():
            key = word.strip().lower()
            if key and key not in self.word_to_idx:
                self.word_to_idx[key] = idx
        self._cv2 = cv2
        self._torch = torch

    def _load_classes(self, path: Path, limit: Optional[int] = None) -> dict:
        if not path.exists():
            return {}
        idx_to_word = {}
        for line in path.read_text().splitlines():
            parts = line.strip().split()
            if len(parts) < 2:
                continue
            idx = int(parts[0])
            if limit and idx >= limit:
                continue
            idx_to_word[idx] = " ".join(parts[1:])
        return idx_to_word

    def preprocess_frames(self, frames: List[np.ndarray], target_frames: int = 64):
        if not frames:
            return None
        processed = []
        for frame in frames:
            h, w = frame.shape[:2]
            scale = 224 / min(h, w)
            new_h, new_w = int(h * scale), int(w * scale)
            resized = self._cv2.resize(frame, (new_w, new_h))
            start_y = (new_h - 224) // 2
            start_x = (new_w - 224) // 2
            crop = resized[start_y : start_y + 224, start_x : start_x + 224]
            crop = (crop.astype(np.float32) / 255.0) * 2 - 1
            processed.append(crop)

        video_array = np.array(processed, dtype=np.float32)
        curr_frames = video_array.shape[0]
        if curr_frames < target_frames:
            if curr_frames == 0:
                return None
            padding = np.tile(video_array[-1], (target_frames - curr_frames, 1, 1, 1))
            video_array = np.concatenate((video_array, padding), axis=0)
        elif curr_frames > target_frames:
            indices = np.linspace(0, curr_frames - 1, target_frames).astype(int)
            video_array = video_array[indices]

        tensor = self._torch.from_numpy(video_array).permute(3, 0, 1, 2).unsqueeze(0)
        return tensor.to(self.device)

    def predict(self, frames: List[np.ndarray], focus_labels: Optional[List[str]] = None) -> dict:
        input_tensor = self.preprocess_frames(frames)
        if input_tensor is None:
            return {"error": "No frames to process."}

        with self._torch.no_grad():
            output = self.model(input_tensor)
            if output.shape[2] > 1:
                output = self._torch.max(output, dim=2)[0]
            else:
                output = output.squeeze(2)

            restricted_logits = output[:, : self.allowed_class_count]

            # If the client passes an allowlist of labels, score only those classes (softmax over the subset).
            allowed_indices: Optional[List[int]] = None
            if focus_labels:
                allowed_indices = []
                for label in focus_labels:
                    if not label:
                        continue
                    idx = self.word_to_idx.get(label.strip().lower())
                    if idx is not None and idx < self.allowed_class_count:
                        allowed_indices.append(idx)
                allowed_indices = sorted(set(allowed_indices))
                if not allowed_indices:
                    allowed_indices = None

            if allowed_indices:
                subset_logits = restricted_logits[:, allowed_indices]
                probs = self._torch.nn.functional.softmax(subset_logits, dim=1)
                topk = min(10, probs.shape[1])
                vals, sub_idxs = self._torch.topk(probs, topk)
                idxs = self._torch.tensor([[allowed_indices[i] for i in sub_idxs[0].tolist()]], device=restricted_logits.device)
            else:
                probs = self._torch.nn.functional.softmax(restricted_logits, dim=1)
                topk = min(10, probs.shape[1])
                vals, idxs = self._torch.topk(probs, topk)

            top10 = []
            for i, v in zip(idxs[0].tolist(), vals[0].tolist()):
                label = self.classes.get(i, f"Unknown ({i})")
                top10.append({"label": label, "score": float(v)})

        return {"top10": top10, "used_frames": int(input_tensor.shape[2])}

def get_dynamic_runner():
    if not _DYNAMIC["loaded"]:
        repo_root = Path(__file__).resolve().parent
        weights = repo_root / "WLASL" / "wlasl_model_test" / "nslt_100.pt"
        labels = repo_root / "WLASL" / "wlasl_model_test" / "wlasl_class_list_100.txt"
        _DYNAMIC["runner"] = WLASLDynamicPredictor(weights_path=weights, class_list_path=labels)
        _DYNAMIC["loaded"] = True
    return _DYNAMIC["runner"]

@app.post("/predict_dynamic", response_model=DynamicPredictResponse)
def predict_dynamic(payload: DynamicFramesIn):
    if not payload.frames:
        raise HTTPException(status_code=400, detail="No frames provided.")
    try:
        frames = [decode_base64_frame(f) for f in payload.frames]
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid frame data: {e}")

    try:
        runner = get_dynamic_runner()
        out = runner.predict(frames, focus_labels=payload.labels)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Dynamic inference failed: {e}")

    if "error" in out:
        raise HTTPException(status_code=400, detail=out["error"])

    return DynamicPredictResponse(
        top10=[DynamicPredItem(**item) for item in out["top10"]],
        raw_frames=len(frames),
        used_frames=out.get("used_frames", 64),
    )
