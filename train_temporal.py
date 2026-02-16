from pathlib import Path
import argparse
import glob, json
import numpy as np
import torch
from torch.utils.data import Dataset, DataLoader
import torch.nn as nn
import torch.optim as optim

from temporal_model import SignSeqModel
from seq_utils import normalize_landmarks, pad_or_crop

def discover_labels(train_root: Path, val_root: Path):
    labs = set()
    if train_root.exists():
        for p in train_root.iterdir():
            if p.is_dir():
                labs.add(p.name)
    if val_root.exists():
        for p in val_root.iterdir():
            if p.is_dir():
                labs.add(p.name)
    if not labs:
        raise RuntimeError(f"No label folders found under {train_root} or {val_root}")
    return sorted(labs)

class ClipFolderDS(Dataset):
    def __init__(self, root: Path, labels, T=24):
        self.files = []
        self.labels = labels
        self.L2I = {s:i for i,s in enumerate(labels)}
        self.T = T
        if root.exists():
            for lab in labels:
                self.files += sorted(glob.glob(str(root / lab / "*.npz")))
        if not self.files:
            raise RuntimeError(f"No .npz clips found under {root}")
    def __len__(self): return len(self.files)
    def __getitem__(self, i):
        path = self.files[i]
        d = np.load(path, allow_pickle=True)
        seq = d["x"]
        if "label" in d:
            y = self.L2I[str(d["label"])]
        elif "y" in d:
            y = int(d["y"])
        else:
            lab = Path(path).parent.name
            y = self.L2I[lab]
        seq = normalize_landmarks(seq)
        seq = pad_or_crop(seq, self.T)
        return seq.astype(np.float32), y

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data_dir", type=Path, default=Path("data"))
    ap.add_argument("--train_subdir", type=str, default="clips_train")
    ap.add_argument("--val_subdir", type=str, default="clips_val")
    ap.add_argument("--T", type=int, default=24)
    ap.add_argument("--batch", type=int, default=64)
    ap.add_argument("--epochs", type=int, default=20)
    ap.add_argument("--lr", type=float, default=2e-3)
    ap.add_argument("--wd", type=float, default=1e-4)
    ap.add_argument("--hidden", type=int, default=128)
    ap.add_argument("--layers", type=int, default=2)
    ap.add_argument("--bidirectional", action="store_true")
    ap.add_argument("--save_dir", type=Path, default=Path("models"))
    args = ap.parse_args()

    train_root = args.data_dir / args.train_subdir
    val_root = args.data_dir / args.val_subdir
    labels = discover_labels(train_root, val_root)
    num_classes = len(labels)
    print(f"Discovered labels ({num_classes}): {labels}")

    ds_tr = ClipFolderDS(train_root, labels, T=args.T)
    dl_tr = DataLoader(ds_tr, batch_size=args.batch, shuffle=True, num_workers=2, drop_last=True)

    dl_val = None
    if val_root.exists():
        try:
            ds_val = ClipFolderDS(val_root, labels, T=args.T)
            dl_val = DataLoader(ds_val, batch_size=args.batch, shuffle=False, num_workers=2)
        except Exception as e:
            print(f"[warn] validation not available: {e}")

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = SignSeqModel(in_dim=63, hidden=args.hidden, num_classes=num_classes,
                         num_layers=args.layers, bidirectional=args.bidirectional).to(device)
    opt = optim.AdamW(model.parameters(), lr=args.lr, weight_decay=args.wd)
    crit = nn.CrossEntropyLoss(label_smoothing=0.05)

    def run_epoch(dl, train=True):
        if train: model.train()
        else: model.eval()
        total, correct, tot_loss = 0, 0, 0.0
        for x,y in dl:
            x = x.to(device); y = y.to(device)
            with torch.set_grad_enabled(train):
                logits = model(x)
                loss = crit(logits, y)
                if train:
                    opt.zero_grad(); loss.backward(); opt.step()
            tot_loss += float(loss.item()) * x.size(0)
            pred = logits.argmax(dim=-1)
            correct += int((pred == y).sum().item())
            total += x.size(0)
        return tot_loss / max(1,total), correct / max(1,total)

    best_val = -1.0
    for ep in range(1, args.epochs+1):
        tr_loss, tr_acc = run_epoch(dl_tr, train=True)
        msg = f"epoch {ep:02d} | train loss {tr_loss:.4f} acc {tr_acc:.3f}"
        if dl_val is not None:
            val_loss, val_acc = run_epoch(dl_val, train=False)
            msg += f" | val loss {val_loss:.4f} acc {val_acc:.3f}"
            if val_acc > best_val: best_val = val_acc
        print(msg)

    args.save_dir.mkdir(parents=True, exist_ok=True)
    ckpt_path = args.save_dir / "seq_model.pt"
    torch.save({
        "state_dict": model.state_dict(),
        "T": args.T,
        "num_classes": num_classes,
        "labels": labels,
        "model_cfg": {"in_dim":63,"hidden":args.hidden,"layers":args.layers,"bidirectional":args.bidirectional}
    }, ckpt_path)

    (args.save_dir / "seq_labels.json").write_text(json.dumps({
        "labels": labels, "T": args.T, "num_classes": num_classes
    }, indent=2))

    print(f"Saved {ckpt_path}")
    print(f"Saved {(args.save_dir / 'seq_labels.json')}")
    
if __name__ == "__main__":
    main()
