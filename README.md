# SgSL FYP

This folder contains the Final Year Project codebase for an SgSL learning app with:

- Module 1: static letter recognition
- Module 2: fingerspelling (word-level)
- Module 3: dynamic vocabulary signs

The project combines a Next.js frontend, a FastAPI backend, and local inference models.

## Project Layout

- `frontend/sgsl/` - main Next.js application (all user-facing modules and onboarding)
- `server.py` - FastAPI backend used by the frontend
- `models/` - static + sequence inference artifacts loaded by `server.py`
- `WLASL/wlasl_model_test/` - dynamic sign model assets used by `/predict_dynamic`
- `infer.py`, `infer_i3d.py` - standalone local inference scripts (optional)

## Runtime Endpoints

The backend in `server.py` exposes:

- `GET /health`
- `POST /predict_landmarks` (Module 1 / static letters)
- `POST /predict_sequence` (sequence model)
- `POST /predict_dynamic` (Module 3 / dynamic signs)

Default backend URL expected by frontend:

- `NEXT_PUBLIC_API_BASE=http://localhost:8000`

## Local Setup

### 1) Backend (Python)

From repo root:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install fastapi uvicorn numpy pillow joblib pydantic python-multipart mediapipe opencv-python torch
uvicorn server:app --reload --host 0.0.0.0 --port 8000
```

### 2) Frontend (Next.js)

In a second terminal:

```bash
cd frontend/sgsl
npm install
NEXT_PUBLIC_API_BASE=http://localhost:8000 npm run dev
```

Then open:

- `http://localhost:3000`

Quick backend check:

- `http://localhost:8000/health`

## Git Tracking Policy (First Commit)

The root `.gitignore` intentionally excludes:

- generated files (`node_modules`, `.next`, `__pycache__`, build caches)
- local runtime state (`frontend/sgsl/data/users.json`)
- large raw training data/features (`data/`, `dynamic/frames/`, `dynamic/features/`)
- embedded repo metadata (`WLASL/.git`, `frontend/sgsl/.git`)
- legacy/unused prototype files and module files not used by the current Module 1/2/3 runtime path

## First Commit Commands

When ready:

```bash
git init
git add .
git status
git commit -m "Initial commit: SgSL FYP (frontend + backend + inference)"
```
