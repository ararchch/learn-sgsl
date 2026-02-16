'use client';

import { useEffect, useRef, useState } from 'react';

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000';

interface Props {
  allowedLetters?: string[];
  targetLetter?: string;
  onConfidentPrediction?: (letter: string) => void;
  hideSkeleton?: boolean;
  showDotsOnly?: boolean;
  confidenceThreshold?: number;
}

interface PredictResponse {
  letter: string;
  confidence: number;
  margin: number;
  class_names: string[];
}

type MPResults = {
  multiHandLandmarks?: { x: number; y: number; z?: number }[][];
};

function hasUsableVideoFrame(video: HTMLVideoElement): boolean {
  return (
    video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
    video.videoWidth > 0 &&
    video.videoHeight > 0
  );
}

export default function StaticLetterPractice({
  allowedLetters,
  targetLetter,
  onConfidentPrediction,
  hideSkeleton = false,
  showDotsOnly = false,
  confidenceThreshold = 0.6,
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const autoStartedRef = useRef(false);

  const handsRef = useRef<any | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  const [running, setRunning] = useState(false);
  const [prediction, setPrediction] = useState<PredictResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const frameCountRef = useRef(0);

  // 🔁 keep latest props in refs so Mediapipe callback never sees stale closures
  const allowedLettersRef = useRef<string[] | undefined>(allowedLetters);
  const targetLetterRef = useRef<string | undefined>(targetLetter);
  const confidenceThresholdRef = useRef<number>(confidenceThreshold);
  const onConfidentRef = useRef<Props['onConfidentPrediction']>(
    onConfidentPrediction,
  );
  const handleResultsRef = useRef<(results: MPResults) => void>();

  useEffect(() => {
    allowedLettersRef.current = allowedLetters;
  }, [allowedLetters]);

  useEffect(() => {
    targetLetterRef.current = targetLetter;
  }, [targetLetter]);

  useEffect(() => {
    confidenceThresholdRef.current = confidenceThreshold;
  }, [confidenceThreshold]);

  useEffect(() => {
    onConfidentRef.current = onConfidentPrediction;
  }, [onConfidentPrediction]);

  function flattenLandmarks(
    lms: { x: number; y: number; z?: number }[],
  ): number[] {
    const arr = new Array(63);
    for (let i = 0; i < 21; i++) {
      const p = lms[i];
      arr[i * 3 + 0] = p.x;
      arr[i * 3 + 1] = p.y;
      arr[i * 3 + 2] = p.z ?? 0.0;
    }
    return arr;
  }

  async function sendStatic(flat63: number[]): Promise<PredictResponse> {
    const res = await fetch(`${API_BASE}/predict_landmarks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ landmarks: flat63 }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `HTTP ${res.status}`);
    }
    return res.json();
  }

  function drawHand(results: MPResults) {
    if (hideSkeleton && !showDotsOnly) return;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = video.videoWidth || 640;
    const height = video.videoHeight || 480;
    canvas.width = width;
    canvas.height = height;

    ctx.clearRect(0, 0, width, height);

    if (!results.multiHandLandmarks || !results.multiHandLandmarks.length)
      return;

    const hand = results.multiHandLandmarks[0];

    ctx.save();
    ctx.translate(width, 0);
    ctx.scale(-1, 1); // mirror like selfie

    const DrawingUtils = (window as any).DrawingUtils;
    const HAND_CONNECTIONS = (window as any).HAND_CONNECTIONS;

    if (DrawingUtils && HAND_CONNECTIONS) {
      const DU = new DrawingUtils(ctx);
      if (!hideSkeleton) {
        DU.drawConnectors(hand, HAND_CONNECTIONS, { lineWidth: 3 });
      }
      DU.drawLandmarks(hand, { radius: 2.2, lineWidth: 1 });
    } else {
      ctx.fillStyle = 'rgba(56,189,248,0.9)';
      for (const p of hand) {
        const x = p.x * width;
        const y = p.y * height;
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, 2 * Math.PI);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  // 🔁 define the core results handler into a ref (no stale closures)
  useEffect(() => {
    handleResultsRef.current = async (results: MPResults) => {
      drawHand(results);

      const hasHand =
        !!results.multiHandLandmarks &&
        results.multiHandLandmarks.length > 0;
      if (!hasHand) return;

      const hand = results.multiHandLandmarks[0];

      // mirror in data space
      const mirroredHand = hand.map((p) => ({
        x: 1 - p.x,
        y: p.y,
        z: p.z ?? 0.0,
      }));

      // Throttle backend calls a bit
      frameCountRef.current += 1;
      if (frameCountRef.current % 2 !== 0) return;

      try {
        const flat = flattenLandmarks(mirroredHand);
        const res = await sendStatic(flat);

        // ✅ always display whatever the model predicts
        setPrediction(res);

        const currentAllowed = allowedLettersRef.current;
        const currentTarget = targetLetterRef.current;
        const matchesTarget =
          !currentTarget || res.letter === currentTarget;
        const canUseForCallback =
          matchesTarget &&
          (!currentAllowed ||
            currentAllowed.length === 0 ||
            currentAllowed.includes(res.letter));

        if (
          onConfidentRef.current &&
          canUseForCallback &&
          (res.confidence ?? 0) >= confidenceThresholdRef.current
        ) {
          // small debounce so one frame doesn't fire multiple times in dev/StrictMode
          onConfidentRef.current(res.letter);
        }
      } catch (e: any) {
        console.error(e);
        setError(e.message || 'Prediction error');
      }
    };
  }, []); // depends only on refs / helpers

  async function startPipeline() {
    setError(null);
    setPrediction(null);
    frameCountRef.current = 0;

    const video = videoRef.current;
    if (!video) {
      setError('Video element not ready.');
      return;
    }

    if (typeof navigator === 'undefined') {
      setError('Camera API not available (navigator undefined).');
      return;
    }

    const constraints: MediaStreamConstraints = {
      video: { width: 960, height: 720 },
      audio: false,
    };

    const getUserMediaModern =
      navigator.mediaDevices && navigator.mediaDevices.getUserMedia
        ? navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices)
        : null;

    const legacyGetUserMedia =
      (navigator as any).getUserMedia ||
      (navigator as any).webkitGetUserMedia ||
      (navigator as any).mozGetUserMedia ||
      (navigator as any).msGetUserMedia ||
      null;

    if (!getUserMediaModern && !legacyGetUserMedia) {
      setError('Camera API not supported in this browser/environment.');
      return;
    }

    const HandsCtor = (window as any).Hands;
    if (!HandsCtor) {
      setError('Mediapipe Hands not loaded. Check hands.js script.');
      return;
    }

    try {
      const stream: MediaStream = await new Promise((resolve, reject) => {
        if (getUserMediaModern) {
          getUserMediaModern(constraints).then(resolve).catch(reject);
        } else if (legacyGetUserMedia) {
          legacyGetUserMedia.call(
            navigator,
            constraints,
            (s: MediaStream) => resolve(s),
            (err: any) => reject(err),
          );
        } else {
          reject(new Error('No getUserMedia implementation found.'));
        }
      });

      streamRef.current = stream;
      video.srcObject = stream;
      await video.play();
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'Unable to access camera');
      return;
    }

    const hands = new HandsCtor({
      locateFile: (file: string) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
    });
    hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.6,
      minTrackingConfidence: 0.6,
    });
    hands.onResults((results: MPResults) => {
      if (handleResultsRef.current) {
        handleResultsRef.current(results);
      }
    });
    handsRef.current = hands;

    const loop = async () => {
      const v = videoRef.current;
      const h = handsRef.current;
      if (!v || !h) return;
      if (!hasUsableVideoFrame(v)) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }

      try {
        await h.send({ image: v });
      } catch (error: unknown) {
        const message =
          error instanceof Error && error.message
            ? error.message
            : 'Hand tracking error';
        if (/memory access out of bounds/i.test(message)) {
          setError(
            'Camera tracking hit an internal error. Stop and restart webcam.',
          );
          setRunning(false);
          h.close?.();
          handsRef.current = null;
          return;
        }
        console.warn(`Hands send warning: ${message}`);
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    setRunning(true);
  }

  function stopPipeline() {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    if (handsRef.current) {
      handsRef.current.close?.();
      handsRef.current = null;
    }

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
  }

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      stopPipeline();
    };
  }, []);

  function handleVideoRef(node: HTMLVideoElement | null) {
    videoRef.current = node;
    if (node && !autoStartedRef.current) {
      autoStartedRef.current = true;
      void startPipeline();
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative w-full max-w-xl mx-auto rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <video
          ref={handleVideoRef}
          autoPlay
          muted
          playsInline
          className="w-full h-auto block"
          style={{ transform: 'scaleX(-1)' }}
        />
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none"
        />
        {!running && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80">
            <p className="text-xs text-slate-600">Starting camera...</p>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-3 text-xs">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
            Live prediction
          </span>
          {prediction && (
            <span className="text-[11px] text-slate-500">
              Confidence: {(prediction.confidence * 100).toFixed(1)}% · Margin:{' '}
              {prediction.margin.toFixed(2)}
            </span>
          )}
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-semibold tracking-[0.25em] text-slate-900">
            {prediction?.letter ?? '—'}
          </span>
        </div>
        {error && (
          <p className="mt-2 text-[11px] text-red-400">Error: {error}</p>
        )}
      </div>
    </div>
  );
}
