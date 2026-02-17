import cv2
import numpy as np
import torch
import os

# Ensure pytorch_i3d.py is in the same folder!
from pytorch_i3d import InceptionI3d

class WLASL_Predictor:
    def __init__(self, weights_path, class_list_path='wlasl_class_list.txt'):
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        print(f"Loading model on {self.device}...")
        
        # --- CHANGE 1: Set num_classes to 100 ---
        self.num_classes = 100
        self.allowed_class_count = 10
        self.model = InceptionI3d(num_classes=self.num_classes, in_channels=3)
        
        # Load Weights
        if not os.path.exists(weights_path):
            raise FileNotFoundError(f"Weights file not found: {weights_path}")
            
        checkpoint = torch.load(weights_path, map_location=self.device)
        
        # Handle state_dict keys (module. prefix or nested dict)
        if 'state_dict' in checkpoint:
            state_dict = checkpoint['state_dict']
        else:
            state_dict = checkpoint
            
        from collections import OrderedDict
        new_state_dict = OrderedDict()
        for k, v in state_dict.items():
            name = k.replace("module.", "") 
            new_state_dict[name] = v
            
        self.model.load_state_dict(new_state_dict)
        self.model.to(self.device)
        self.model.eval()
        print("Model loaded successfully.")

        # Load only the first 10 classes
        self.classes = self._load_classes(class_list_path, limit=self.allowed_class_count)

    def _load_classes(self, path, limit=None):
        """Reads the class list file."""
        if not os.path.exists(path):
            return {}
            
        idx_to_word = {}
        with open(path, 'r') as f:
            for line in f:
                parts = line.strip().split()
                if len(parts) >= 2:
                    idx = int(parts[0])
                    # --- CHANGE 2: Filter for Top 100 ---
                    if limit and idx >= limit:
                        continue
                    word = " ".join(parts[1:])
                    idx_to_word[idx] = word
        return idx_to_word

    def preprocess_frames(self, frames, target_frames=64):
        """Standard I3D Preprocessing: Resize -> Crop -> Normalize -> Pad"""
        if not frames: return None
        processed_frames = []
        for frame in frames:
            frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            
            # --- FIX STARTS HERE ---
            h, w, c = frame.shape # Unpack correctly (height, width)
            
            # Scale the smaller side to 224
            scale = 224 / min(h, w)
            
            # Calculate new dimensions (keeping aspect ratio)
            new_h, new_w = int(h * scale), int(w * scale)
            
            # Resize: cv2.resize expects (width, height)
            frame = cv2.resize(frame, (new_w, new_h)) 
            
            # Center Crop to 224x224
            # We calculate the start indices to grab the center
            start_y = (new_h - 224) // 2
            start_x = (new_w - 224) // 2
            
            # Slice the frame
            frame = frame[start_y:start_y+224, start_x:start_x+224]
            # --- FIX ENDS HERE ---

            # Normalize to [-1, 1]
            frame = (frame / 255.0) * 2 - 1 
            processed_frames.append(frame)

        video_array = np.array(processed_frames, dtype=np.float32)
        curr_frames = video_array.shape[0]

        # Pad or Sample to reach exactly 64 frames
        if curr_frames < target_frames:
            # If video is too short, repeat the last frame
            if curr_frames == 0: return None # Handle empty buffer edge case
            padding = np.tile(video_array[-1], (target_frames - curr_frames, 1, 1, 1))
            video_array = np.concatenate((video_array, padding), axis=0)
        elif curr_frames > target_frames:
            # If video is too long, sample evenly
            indices = np.linspace(0, curr_frames - 1, target_frames).astype(int)
            video_array = video_array[indices]

        # Convert to Tensor (Batch, Channel, Time, Height, Width)
        tensor = torch.from_numpy(video_array).permute(3, 0, 1, 2).unsqueeze(0)
        return tensor.to(self.device)

    def predict(self, frames):
        input_tensor = self.preprocess_frames(frames)
        if input_tensor is None: return "Error"

        with torch.no_grad():
            output = self.model(input_tensor)
            if output.shape[2] > 1:
                output = torch.max(output, dim=2)[0]
            else:
                output = output.squeeze(2)
            
            restricted_logits = output[:, :self.allowed_class_count]
            probs = torch.nn.functional.softmax(restricted_logits, dim=1)
            topk = min(self.allowed_class_count, probs.shape[1])
            top10_vals, top10_idx = torch.topk(probs, topk)

            def format_preds(idxs, vals):
                items = []
                for i, v in zip(idxs.tolist(), vals.tolist()):
                    word = self.classes.get(i, f"Unknown ({i})")
                    items.append((word, float(v)))
                return items

            top10 = format_preds(top10_idx[0], top10_vals[0])

            return {
                "top10": top10,
            }

def run_webcam_inference():
    # --- CHANGE 3: Update this filename to your downloaded 100-class weights ---
    WEIGHTS_FILE = "nslt_100.pt" 
    
    if not os.path.exists(WEIGHTS_FILE):
        print(f"Error: Please download the 100-class weights and rename them to '{WEIGHTS_FILE}'")
        return

    try:
        predictor = WLASL_Predictor(weights_path=WEIGHTS_FILE)
    except Exception as e:
        print(f"Error: {e}")
        return

    CAMERA_INDEX = 1  # Prefer a non-Continuity Camera device on macOS
    MAX_CAMERA_INDEX = 4

    def open_camera(preferred_index: int, max_index: int):
        """Try AVFoundation indices, preferring non-default devices."""
        candidates = [preferred_index] + [i for i in range(max_index + 1) if i != preferred_index]
        for idx in candidates:
            cap = cv2.VideoCapture(idx, cv2.CAP_AVFOUNDATION)
            if cap.isOpened():
                print(f"Using camera index {idx}")
                return cap
            cap.release()
        cap = cv2.VideoCapture(preferred_index)
        if cap.isOpened():
            print(f"Using camera index {preferred_index}")
            return cap
        cap.release()
        raise RuntimeError("Could not open any camera. Try a different CAMERA_INDEX.")

    cap = open_camera(CAMERA_INDEX, MAX_CAMERA_INDEX)
    print("Controls: [SPACE] Record | [Q] Quit")

    recording = False
    frames_buffer = []
    prediction_text = "Press SPACE"
    prediction_top10 = []

    while True:
        ret, frame = cap.read()
        if not ret: break
        display_frame = frame.copy()

        if recording:
            frames_buffer.append(frame)
            cv2.circle(display_frame, (30, 30), 20, (0, 0, 255), -1)
            cv2.putText(display_frame, "Recording...", (60, 40), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0,0,255), 2)
        else:
            cv2.circle(display_frame, (30, 30), 20, (0, 255, 0), -1)
            cv2.putText(display_frame, "Idle", (60, 40), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0,255,0), 2)

        h, w = display_frame.shape[:2]
        base_y = max(30, h - (len(prediction_top10) + 1) * 22 - 10)
        cv2.putText(display_frame, prediction_text, (20, base_y), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (255, 255, 0), 2)
        for i, line in enumerate(prediction_top10):
            cv2.putText(display_frame, line, (20, base_y + 22 * (i + 1)), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (200, 200, 0), 2)
        cv2.imshow('WLASL-100 Inference', display_frame)

        key = cv2.waitKey(1) & 0xFF
        if key == ord('q'): break
        elif key == ord(' '):
            if not recording:
                recording = True
                frames_buffer = []
                prediction_text = "Recording..."
                prediction_top10 = []
            else:
                recording = False
                if len(frames_buffer) > 10:
                    preds = predictor.predict(frames_buffer)
                    if isinstance(preds, dict):
                        prediction_text = "Top-10 (restricted) predictions:"
                        prediction_top10 = [f"{i+1}. {word} ({score:.2f})" for i, (word, score) in enumerate(preds["top10"])]
                        print("Top-10:")
                        for word, score in preds["top10"]:
                            print(f"  {word} ({score:.2f})")
                    else:
                        prediction_text = preds
                        prediction_top10 = []
                        print(f"Result: {prediction_text}")
                else:
                    prediction_text = "Video too short"
                    prediction_top10 = []

    cap.release()
    cv2.destroyAllWindows()

if __name__ == "__main__":
    run_webcam_inference()
