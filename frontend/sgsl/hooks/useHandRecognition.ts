import { useEffect, useRef, useState } from 'react';

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000';

type MPResults = {
  multiHandLandmarks?: { x: number; y: number; z?: number }[][];
};

type MediaPipeHands = {
  setOptions: (options: {
    maxNumHands: number;
    modelComplexity: number;
    minDetectionConfidence: number;
    minTrackingConfidence: number;
  }) => void;
  onResults: (callback: (results: MPResults) => void | Promise<void>) => void;
  close?: () => void;
  send: (payload: { image: HTMLVideoElement }) => Promise<void>;
};

type HandsConstructor = new (options: {
  locateFile: (file: string) => string;
}) => MediaPipeHands;

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function hasUsableVideoFrame(video: HTMLVideoElement): boolean {
  return (
    video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
    video.videoWidth > 0 &&
    video.videoHeight > 0
  );
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
    const needsSecureContext =
      typeof window !== 'undefined' &&
      window.location.protocol !== 'https:' &&
      window.location.hostname !== 'localhost' &&
      window.location.hostname !== '127.0.0.1';

    throw new Error(
      needsSecureContext
        ? 'Camera requires HTTPS (or localhost).'
        : 'Camera API not supported in this browser/environment.',
    );
  }

  if (modernGetUserMedia) {
    return modernGetUserMedia(constraints);
  }

  return new Promise((resolve, reject) => {
    legacyGetUserMedia?.call(navigator, constraints, resolve, reject);
  });
}

export function useHandRecognition() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const handsRef = useRef<MediaPipeHands | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const frameCountRef = useRef(0);
  const isFetchingRef = useRef(false);

  const [predictedLetter, setPredictedLetter] = useState<string>('');
  const [confidence, setConfidence] = useState(0);
  const [landmarks, setLandmarks] = useState<number[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

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

  async function sendStatic(flat63: number[]) {
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

  useEffect(() => {
    let cancelled = false;
    let retryTimer: number | null = null;
    let attachedVideo: HTMLVideoElement | null = null;

    async function start() {
      setError(null);
      const video = videoRef.current;
      if (!video) {
        setError('Video element not ready.');
        return;
      }
      const HandsCtor = (window as Window & { Hands?: HandsConstructor }).Hands;
      if (!HandsCtor) {
        setError('Mediapipe Hands not loaded.');
        retryTimer = window.setTimeout(() => {
          if (!cancelled) start();
        }, 300);
        return;
      }
      try {
        const stream = await getCameraStream({
          video: { width: 960, height: 720 },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        const liveVideo = videoRef.current;
        if (!liveVideo) {
          stream.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
          return;
        }
        attachedVideo = liveVideo;
        liveVideo.srcObject = stream;
        await liveVideo.play();
        if (cancelled) return;
      } catch (error: unknown) {
        if (cancelled) return;
        setError(getErrorMessage(error, 'Unable to access camera'));
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
      hands.onResults(async (results: MPResults) => {
        if (cancelled) return;
        if (!results.multiHandLandmarks || !results.multiHandLandmarks.length) {
          setLandmarks(null);
          setPredictedLetter('');
          setConfidence(0);
          return;
        }
        frameCountRef.current += 1;
        if (frameCountRef.current % 2 !== 0) return;
        if (isFetchingRef.current) return;

        const hand = results.multiHandLandmarks[0];
        const mirrored = hand.map((p) => ({
          x: 1 - p.x,
          y: p.y,
          z: p.z ?? 0.0,
        }));
        const flat = flattenLandmarks(mirrored);
        setLandmarks(flat);
        isFetchingRef.current = true;
        try {
          const res = await sendStatic(flat);
          if (cancelled) return;
          setPredictedLetter(res.letter || res.label || '');
          setConfidence(res.confidence ?? 0);
        } catch (error: unknown) {
          if (cancelled) return;
          setError(getErrorMessage(error, 'Prediction error'));
        } finally {
          isFetchingRef.current = false;
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
          if (cancelled) return;
          const message = getErrorMessage(error, 'Hand tracking error');
          if (/memory access out of bounds/i.test(message)) {
            setError(
              'Camera tracking hit an internal error. Please reload and try again.',
            );
            setRunning(false);
            h.close?.();
            handsRef.current = null;
            const stream = streamRef.current;
            if (stream) {
              stream.getTracks().forEach((track) => track.stop());
              streamRef.current = null;
            }
            const liveVideo = videoRef.current;
            if (liveVideo) {
              liveVideo.srcObject = null;
            }
            rafRef.current = null;
            return;
          }
          console.warn(`Hands send warning: ${message}`);
        }
        rafRef.current = requestAnimationFrame(loop);
      };

      rafRef.current = requestAnimationFrame(loop);
      setRunning(true);
    }

    start();

    return () => {
      cancelled = true;
      if (retryTimer) {
        window.clearTimeout(retryTimer);
      }
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
      if (attachedVideo) {
        attachedVideo.srcObject = null;
      }
      setRunning(false);
    };
  }, []);

  return {
    videoRef,
    predictedLetter,
    confidence,
    landmarks,
    error,
    running,
  };
}
