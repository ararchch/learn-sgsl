# scripts/03_train_ctc.py
import torch, torch.nn as nn, torch.optim as optim
from torch.utils.data import DataLoader, Dataset
import numpy as np, os, editdistance
from encoders import CTCModel

VOCAB = " " + "".join([chr(i) for i in range(97,123)])  # " abcdef..."
IDX2CHAR = list(VOCAB)
CHAR2IDX = {c:i for i,c in enumerate(IDX2CHAR)}

class SignDataset(Dataset):
    def __init__(self, path):
        files = [os.path.join(path,f) for f in os.listdir(path) if f.endswith(".npz")]
        self.samples = files
    def __len__(self): return len(self.samples)
    def __getitem__(self, i):
        d = np.load(self.samples[i], allow_pickle=True)
        x = torch.tensor(d["x"], dtype=torch.float32)
        y = torch.tensor([CHAR2IDX[c] for c in str(d["y"])], dtype=torch.long)
        return x, y

def collate_fn(batch):
    xs, ys, lx, ly = [], [], [], []
    for x,y in batch:
        xs.append(x); ys.append(y)
        lx.append(len(x)); ly.append(len(y))
    X = nn.utils.rnn.pad_sequence(xs, batch_first=True)
    Y = torch.cat(ys)
    return X, Y, lx, ly

def greedy_decode(logits):
    probs = torch.argmax(logits, dim=-1)
    seq = []
    prev = None
    for p in probs:
        if p != prev and p != 0:
            seq.append(IDX2CHAR[p])
        prev = p
    return "".join(seq)

def main():
    device = "cuda" if torch.cuda.is_available() else "cpu"
    model = CTCModel(vocab_size=len(VOCAB)).to(device)
    criterion = nn.CTCLoss(blank=0, zero_infinity=True)
    optimizer = optim.Adam(model.parameters(), lr=1e-3)

    train = DataLoader(SignDataset("features/train"), batch_size=32, shuffle=True, collate_fn=collate_fn)
    val = DataLoader(SignDataset("features/val"), batch_size=16, shuffle=False, collate_fn=collate_fn)

    for epoch in range(10):
        model.train(); tloss=0
        for X,Y,lx,ly in train:
            X,Y = X.to(device),Y.to(device)
            logits = model(X)
            logp = nn.functional.log_softmax(logits, dim=-1).transpose(0,1)
            loss = criterion(logp, Y, torch.tensor(lx), torch.tensor(ly))
            optimizer.zero_grad(); loss.backward(); optimizer.step()
            tloss += loss.item()
        print(f"Epoch {epoch+1}: train_loss {tloss/len(train):.3f}")
    torch.save(model.state_dict(), "models/ctc.pt")

if __name__ == "__main__":
    main()
