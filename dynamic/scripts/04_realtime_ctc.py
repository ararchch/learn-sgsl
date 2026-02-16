# scripts/04_realtime_ctc.py
import cv2, torch, numpy as np, mediapipe as mp
from encoders import CTCModel

mp_hands = mp.solutions.hands
mp_pose  = mp.solutions.pose

def extract_frame_feats(img, hands, pose):
    rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    hres, pres = hands.process(rgb), pose.process(rgb)
    # [Same 150-D feature logic as extractor]
    # (for brevity here)
    return np.zeros(150, np.float32)

def main():
    device = "cuda" if torch.cuda.is_available() else "cpu"
    model = CTCModel(vocab_size=27).to(device)
    model.load_state_dict(torch.load("models/ctc.pt", map_location=device))
    model.eval()

    cap = cv2.VideoCapture(0)
    seq = []
    with mp_hands.Hands(max_num_hands=2) as hands, mp_pose.Pose() as pose:
        while True:
            ret, frame = cap.read()
            if not ret: break
            f = extract_frame_feats(frame, hands, pose)
            seq.append(f)
            if len(seq)>128: seq.pop(0)
            X = torch.tensor(seq, dtype=torch.float32).unsqueeze(0).to(device)
            logits = model(X)[0]
            text = "".join(["a","b"])  # placeholder decode
            cv2.putText(frame, text, (10,40), cv2.FONT_HERSHEY_SIMPLEX, 1, (255,255,255), 2)
            cv2.imshow("SgSL Realtime", frame)
            if cv2.waitKey(1) & 0xFF == ord("q"): break
    cap.release(); cv2.destroyAllWindows()

if __name__ == "__main__":
    main()
