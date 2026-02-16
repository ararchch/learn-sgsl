'use client';

import { useEffect, useRef, useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000';

interface DynamicPrediction {
  label: string;
  score: number;
}

interface DynamicPredictResponse {
  top10: DynamicPrediction[];
  raw_frames: number;
  used_frames: number;
}

interface Props {
  focusWords?: string[];
  onPrediction?: (result: DynamicPredictResponse) => void;
}

type LegacyGetUserMedia = (
  constraints: MediaStreamConstraints,
  success: (stream: MediaStream) => void,
  failure: (error: unknown) => void,
) => void;

async function getCameraStream(
  constraints: MediaStreamConstraints,
): Promise<MediaStream> {
  if (typeof navigator === 'undefined') {
    throw new Error('Camera API not available in this environment.');
  }

  const modernGetUserMedia =
    navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices) ?? null;

  const legacyGetUserMedia =
    ((navigator as Navigator & { getUserMedia?: LegacyGetUserMedia })
      .getUserMedia ||
      (
        navigator as Navigator & { webkitGetUserMedia?: LegacyGetUserMedia }
      ).webkitGetUserMedia ||
      (navigator as Navigator & { mozGetUserMedia?: LegacyGetUserMedia })
        .mozGetUserMedia ||
      (navigator as Navigator & { msGetUserMedia?: LegacyGetUserMedia })
        .msGetUserMedia ||
      null) as LegacyGetUserMedia | null;

  if (!modernGetUserMedia && !legacyGetUserMedia) {
    throw new Error('Camera API not supported in this browser/environment.');
  }

  if (modernGetUserMedia) {
    return modernGetUserMedia(constraints);
  }

  return new Promise((resolve, reject) => {
    legacyGetUserMedia?.call(navigator, constraints, resolve, reject);
  });
}

export default function DynamicSignPractice({ focusWords, onPrediction }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const captureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const captureRafRef = useRef<number | null>(null);
  const framesRef = useRef<string[]>([]);
  const lastCaptureRef = useRef<number>(0);
  const recordingRef = useRef(false);

  const [running, setRunning] = useState(false);
  const [recording, setRecording] = useState(false);
  const [prediction, setPrediction] = useState<DynamicPredictResponse | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('Idle');
  const [frameCount, setFrameCount] = useState(0);
  const [inferenceRunning, setInferenceRunning] = useState(false);

  const CAPTURE_FPS = 12;
  const MAX_CAPTURE_FRAMES = 96;
  const MIN_CAPTURE_FRAMES = 12;

  useEffect(() => {
    void startCamera();
    return () => {
      stopCamera();
    };
  }, []);

  async function startCamera() {
    if (streamRef.current) return;
    setError(null);
    setPrediction(null);
    setFrameCount(0);

    const video = videoRef.current;
    if (!video) {
      setError('Video element not ready.');
      return;
    }

    try {
      const stream = await getCameraStream({
        video: { width: 960, height: 720 },
        audio: false,
      });
      streamRef.current = stream;
      video.srcObject = stream;
      await video.play();
      setRunning(true);
      setStatus('Camera ready.');
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'Unable to access camera');
      setStatus('Camera error.');
    }
  }

  function stopCamera() {
    if (captureRafRef.current != null) {
      cancelAnimationFrame(captureRafRef.current);
      captureRafRef.current = null;
    }
    recordingRef.current = false;
    setRecording(false);
    setInferenceRunning(false);

    const stream = streamRef.current;
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    const video = videoRef.current;
    if (video) {
      video.srcObject = null;
    }

    setRunning(false);
    setStatus('Idle');
  }

  function captureLoop(ts: number) {
    if (!recordingRef.current) return;
    const video = videoRef.current;
    const canvas = captureCanvasRef.current;
    if (!video || !canvas) return;

    const interval = 1000 / CAPTURE_FPS;
    if (ts - lastCaptureRef.current < interval) {
      captureRafRef.current = requestAnimationFrame(captureLoop);
      return;
    }
    lastCaptureRef.current = ts;

    const width = video.videoWidth || 640;
    const height = video.videoHeight || 480;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, width, height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.72);
    const payload = dataUrl.split(',', 2)[1] || '';
    if (payload && framesRef.current.length < MAX_CAPTURE_FRAMES) {
      framesRef.current.push(payload);
      setFrameCount(framesRef.current.length);
    }

    if (framesRef.current.length >= MAX_CAPTURE_FRAMES) {
      stopRecording();
      return;
    }

    captureRafRef.current = requestAnimationFrame(captureLoop);
  }

  function beginRecording() {
    setPrediction(null);
    setError(null);
    framesRef.current = [];
    setFrameCount(0);
    setStatus('Recording...');

    recordingRef.current = true;
    setRecording(true);
    lastCaptureRef.current = 0;
    captureRafRef.current = requestAnimationFrame(captureLoop);
  }

  async function stopRecording() {
    if (captureRafRef.current != null) {
      cancelAnimationFrame(captureRafRef.current);
      captureRafRef.current = null;
    }
    recordingRef.current = false;
    setRecording(false);
    setStatus('Processing...');
    setInferenceRunning(true);

    const frames = framesRef.current.slice();
    if (frames.length < MIN_CAPTURE_FRAMES) {
      setStatus('Clip too short. Record a longer sign.');
      setError(
        `Need at least ${MIN_CAPTURE_FRAMES} frames; captured ${frames.length}.`,
      );
      setInferenceRunning(false);
      return;
    }

    try {
      const labels =
        focusWords && focusWords.length > 0 ? focusWords : undefined;
      const res = await fetch(`${API_BASE}/predict_dynamic`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ frames, labels }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }
      const json = (await res.json()) as DynamicPredictResponse;
      setPrediction(json);
      onPrediction?.(json);
      setStatus('Prediction ready.');
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'Prediction error');
      setStatus('Prediction failed.');
    } finally {
      setInferenceRunning(false);
    }
  }

  async function handleRecordClick() {
    if (!running) {
      await startCamera();
    }
    if (!videoRef.current) return;
    if (inferenceRunning) {
      setStatus('Inference running. Please wait.');
      return;
    }
    beginRecording();
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative w-full max-w-2xl mx-auto rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="w-full h-auto block"
          style={{ transform: 'scaleX(-1)' }}
        />
        {!running && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80">
            <p className="text-xs text-slate-600">Starting camera...</p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
        {running && (
          <button
            type="button"
            onClick={stopCamera}
            className="inline-flex items-center rounded-lg bg-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-300"
          >
            Stop camera
          </button>
        )}
        {!running && !!error && (
          <button
            type="button"
            onClick={startCamera}
            className="inline-flex items-center rounded-lg bg-blue-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-blue-400"
          >
            Retry camera
          </button>
        )}
        <button
          type="button"
          onClick={recording ? stopRecording : handleRecordClick}
          className={`inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-semibold ${
            recording
              ? 'bg-red-500 text-slate-950 hover:bg-red-400'
              : inferenceRunning
                ? 'bg-slate-200 text-slate-600'
                : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
          }`}
          disabled={inferenceRunning}
        >
          {recording ? 'Stop & predict' : 'Record sign'}
        </button>
        {inferenceRunning && (
          <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-600">
            Running inference...
          </span>
        )}
        <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1">
          {status}
        </span>
        <span className="text-slate-500">Frames: {frameCount}</span>
        <span className="text-slate-500">
          Backend:{' '}
          <code className="text-slate-700 truncate max-w-[160px] inline-block align-middle">
            {API_BASE}
          </code>
        </span>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-3 text-xs">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
            Dynamic prediction
          </span>
          {prediction && (
            <span className="text-[11px] text-slate-500">
              {prediction.raw_frames} captured - {prediction.used_frames} used
            </span>
          )}
        </div>

        {focusWords && focusWords.length > 0 && (
          <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
            <span className="uppercase tracking-[0.2em] text-slate-400">
              Focus:
            </span>
            {focusWords.map((w) => (
              <span
                key={w}
                className="rounded-full border border-slate-200 bg-white px-2.5 py-1"
              >
                {w}
              </span>
            ))}
          </div>
        )}

        {prediction ? (
          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-semibold tracking-[0.08em] text-slate-900">
                {prediction.top10[0]?.label ?? '-'}
              </span>
              <span className="text-xs text-slate-500">
                {(prediction.top10[0]?.score ?? 0) * 100 > 0
                  ? `${((prediction.top10[0]?.score ?? 0) * 100).toFixed(1)}%`
                  : ''}
              </span>
            </div>
            <div className="space-y-1 text-[11px] text-slate-500">
              {prediction.top10.slice(1, 3).map((item, idx) => (
                <div key={`${item.label}-${idx}`} className="flex justify-between">
                  <span>
                    {idx + 2}. {item.label}
                  </span>
                  <span>{(item.score * 100).toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-[11px] text-slate-500">
            Record a short clip (3-5 seconds) and stop to run inference.
          </p>
        )}

        {error && <p className="mt-2 text-[11px] text-red-400">Error: {error}</p>}
      </div>

      <canvas ref={captureCanvasRef} className="hidden" />
    </div>
  );
}
