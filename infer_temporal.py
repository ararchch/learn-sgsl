import json
from pathlib import Path
import numpy as np
import torch
from temporal_model import SignSeqModel
from seq_utils import normalize_landmarks, pad_or_crop, to_tensor, softmax_np

class TemporalInfer:
    def __init__(self, ckpt_path="models/seq_model.pt"):
        self.ckpt_path = Path(ckpt_path)
        dev = "cuda" if torch.cuda.is_available() else "cpu"
        self.device = torch.device(dev)
        ckpt = torch.load(self.ckpt_path, map_location=self.device)
        self.T = int(ckpt.get("T", 24))
        self.labels = ckpt.get("labels", None)
        meta_json = self.ckpt_path.with_name("seq_labels.json")
        if meta_json.exists():
            meta = json.loads(meta_json.read_text())
            self.labels = meta.get("labels", self.labels)
            self.T = meta.get("T", self.T)
        num_classes = int(ckpt.get("num_classes", len(self.labels) if self.labels else 1))
        cfg = ckpt.get("model_cfg", {"in_dim":63,"hidden":128,"layers":2,"bidirectional":True})
        self.model = SignSeqModel(in_dim=cfg["in_dim"], hidden=cfg["hidden"],
                                  num_layers=cfg["layers"], num_classes=num_classes,
                                  bidirectional=cfg.get("bidirectional", True))
        self.model.load_state_dict(ckpt["state_dict"], strict=True)
        self.model.to(self.device).eval()

    @torch.no_grad()
    def predict(self, seq_np: np.ndarray):
        seq_np = normalize_landmarks(seq_np)
        seq_np = pad_or_crop(seq_np, self.T)
        x = to_tensor(seq_np).to(self.device)
        logits = self.model(x)[0].cpu().numpy()
        probs = softmax_np(logits)
        top = int(np.argmax(probs))
        top2 = float(np.partition(probs, -2)[-2]) if probs.size >= 2 else 0.0
        label = self.labels[top] if (self.labels and top < len(self.labels)) else str(top)
        return {"label": label, "confidence": float(probs[top]), "margin": float(probs[top]-top2)}
