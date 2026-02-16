# scripts/encoders.py
import torch
import torch.nn as nn

class TemporalEncoder(nn.Module):
    def __init__(self, input_size=150, hidden_size=256, num_layers=3, dropout=0.1):
        super().__init__()
        layers = []
        for _ in range(num_layers):
            layers.append(nn.Conv1d(input_size, hidden_size, kernel_size=3, padding=1))
            layers.append(nn.ReLU())
            layers.append(nn.Dropout(dropout))
            input_size = hidden_size
        self.net = nn.Sequential(*layers)

    def forward(self, x):  # (B,T,F)
        x = x.transpose(1,2)       # (B,F,T)
        x = self.net(x)
        return x.transpose(1,2)    # (B,T,H)

class CTCModel(nn.Module):
    def __init__(self, vocab_size, input_size=150, hidden_size=256):
        super().__init__()
        self.encoder = TemporalEncoder(input_size, hidden_size)
        self.classifier = nn.Linear(hidden_size, vocab_size)

    def forward(self, x):
        x = self.encoder(x)
        return self.classifier(x)
