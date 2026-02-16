import numpy as np
import torch

def pad_or_crop(seq: np.ndarray, T: int) -> np.ndarray:
    t = seq.shape[0]
    if t == T:
        return seq
    if t > T:
        return seq[-T:]
    last = seq[-1:]
    pad = np.repeat(last, T - t, axis=0)
    return np.concatenate([seq, pad], axis=0)

def normalize_landmarks(seq: np.ndarray, eps: float = 1e-6) -> np.ndarray:
    assert seq.ndim == 2 and seq.shape[1] == 63, f"expected [T,63], got {seq.shape}"
    T = seq.shape[0]
    xyz = seq.reshape(T, 21, 3)
    wrist = xyz[:, 0:1, :]
    centered = xyz - wrist
    ref = centered[:, 9, :]  # middle_mcp
    scale = np.linalg.norm(ref, axis=-1, keepdims=True)
    scale = np.maximum(scale, eps)
    centered = centered / scale[:, None, :]
    return centered.reshape(T, 63)

def to_tensor(seq: np.ndarray) -> torch.Tensor:
    return torch.from_numpy(seq.astype(np.float32)).unsqueeze(0)

def softmax_np(x: np.ndarray):
    x = x - x.max()
    e = np.exp(x)
    return e / e.sum()
