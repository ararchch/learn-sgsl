import torch
import torch.nn as nn

class SignSeqModel(nn.Module):
    def __init__(self, in_dim=63, hidden=128, num_layers=2, num_classes=10, bidirectional=True, dropout=0.2):
        super().__init__()
        self.lstm = nn.LSTM(
            input_size=in_dim,
            hidden_size=hidden,
            num_layers=num_layers,
            batch_first=True,
            bidirectional=bidirectional,
            dropout=dropout if num_layers > 1 else 0.0,
        )
        out_dim = hidden * (2 if bidirectional else 1)
        self.head = nn.Sequential(
            nn.LayerNorm(out_dim),
            nn.Linear(out_dim, 128),
            nn.ReLU(),
            nn.Dropout(0.2),
            nn.Linear(128, num_classes),
        )

    def forward(self, x):  # x: [B, T, 63]
        y, _ = self.lstm(x)
        y_last = y[:, -1, :]    # last timestep pooling
        return self.head(y_last)
