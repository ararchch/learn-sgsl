FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Needed by opencv-python-headless / torch in slim images.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    libgomp1 \
  && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Backend code + model assets
COPY server.py infer_temporal.py temporal_model.py seq_utils.py ./
COPY models ./models
COPY WLASL/wlasl_model_test ./WLASL/wlasl_model_test

EXPOSE 8000

# Platforms like Render/Cloud Run set $PORT.
CMD ["sh", "-c", "uvicorn server:app --host 0.0.0.0 --port ${PORT:-8000} --workers ${WEB_CONCURRENCY:-1}"]
