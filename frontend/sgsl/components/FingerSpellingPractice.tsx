'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useHandRecognition } from '@/hooks/useHandRecognition';

interface FingerspellingPracticeProps {
  mode?: 'practice' | 'test';
  word: string;
  minConfidence?: number;
  minConfidenceByLetter?: Record<string, number>;
  timeLimit?: number;
  onComplete: (metrics: { timeTakenMs: number; mistakes: number }) => void;
  onTimeOut?: () => void;
  onExit: () => void;
}

type LetterState = 'pending' | 'success';

export default function FingerspellingPractice({
  mode = 'practice',
  word,
  minConfidence = 0.75,
  minConfidenceByLetter,
  timeLimit = 30,
  onComplete,
  onTimeOut,
  onExit,
}: FingerspellingPracticeProps) {
  const letters = useMemo(() => word.toUpperCase().split(''), [word]);
  const { videoRef, predictedLetter, confidence, error, running, landmarks } =
    useHandRecognition();

  const [activeIndex, setActiveIndex] = useState(0);
  const [letterStatus, setLetterStatus] = useState<LetterState[]>(
    letters.map(() => 'pending'),
  );
  const [inputBlocked, setInputBlocked] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [releaseRequired, setReleaseRequired] = useState(false);
  const [timeLeftMs, setTimeLeftMs] = useState(timeLimit * 1000);

  const holdTimerRef = useRef(0);
  const lastTickRef = useRef<number | null>(null);
  const lastProgressUpdateRef = useRef(0);
  const blockTimerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const lastCorrectRef = useRef<number | null>(null);
  const activeLetterStartedAtRef = useRef<number | null>(null);
  const mismatchStartRef = useRef<number | null>(null);
  const lastMismatchLetterRef = useRef<string | null>(null);
  const lastMistakeAtRef = useRef<number | null>(null);
  const completedRef = useRef(false);
  const requireNeutralRef = useRef(false);
  const timeoutFiredRef = useRef(false);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    setActiveIndex(0);
    setLetterStatus(letters.map(() => 'pending'));
    setInputBlocked(false);
    setHoldProgress(0);
    setMistakes(0);
    setShowHint(false);
    setReleaseRequired(false);
    setTimeLeftMs(timeLimit * 1000);
    holdTimerRef.current = 0;
    lastTickRef.current = null;
    lastCorrectRef.current = null;
    activeLetterStartedAtRef.current = Date.now();
    mismatchStartRef.current = null;
    lastMismatchLetterRef.current = null;
    lastMistakeAtRef.current = null;
    completedRef.current = false;
    requireNeutralRef.current = false;
    timeoutFiredRef.current = false;
    startTimeRef.current = Date.now();
  }, [letters.join(''), timeLimit]);

  useEffect(() => {
    if (activeIndex >= letters.length) return;
    holdTimerRef.current = 0;
    lastTickRef.current = null;
    lastCorrectRef.current = null;
    activeLetterStartedAtRef.current = Date.now();
  }, [activeIndex, letters.length]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onExit();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onExit]);

  useEffect(() => {
    if (mode !== 'test') return;
    const totalMs = timeLimit * 1000;
    const startedAt = Date.now();
    setTimeLeftMs(totalMs);
    timeoutFiredRef.current = false;

    const interval = window.setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const remaining = Math.max(0, totalMs - elapsed);
      setTimeLeftMs(remaining);
      if (remaining <= 0 && !timeoutFiredRef.current) {
        timeoutFiredRef.current = true;
        onTimeOut?.();
      }
    }, 100);

    return () => window.clearInterval(interval);
  }, [mode, timeLimit, letters.join(''), onTimeOut]);


  useEffect(() => {
    if (activeIndex < letters.length) return;
    if (completedRef.current) return;
    completedRef.current = true;
    const timeTakenMs = Date.now() - (startTimeRef.current ?? Date.now());
    // Parent components should memoize `onComplete` with useCallback.
    onCompleteRef.current({ timeTakenMs, mistakes });
  }, [activeIndex, letters.length, mistakes]);

  useEffect(() => {
    if (!predictedLetter || activeIndex >= letters.length) return;
    if (inputBlocked) return;

    const targetChar = letters[activeIndex];
    const now = Date.now();

    if (requireNeutralRef.current) {
      if (confidence < 0.4 || predictedLetter !== targetChar) {
        requireNeutralRef.current = false;
        setReleaseRequired(false);
      } else {
        return;
      }
    }

    const effectiveMinConfidence =
      minConfidenceByLetter?.[targetChar] ?? minConfidence;

    if (predictedLetter === targetChar && confidence > effectiveMinConfidence) {
      lastCorrectRef.current = now;
      if (mode !== 'test') setShowHint(false);
      mismatchStartRef.current = null;
      lastMismatchLetterRef.current = null;

      if (!lastTickRef.current) lastTickRef.current = now;
      const delta = now - lastTickRef.current;
      holdTimerRef.current += delta;
      lastTickRef.current = now;

      if (now - lastProgressUpdateRef.current > 50) {
        const pct = Math.min(100, (holdTimerRef.current / 150) * 100);
        setHoldProgress(pct);
        lastProgressUpdateRef.current = now;
      }

      if (holdTimerRef.current >= 150) {
        setLetterStatus((prev) => {
          const next = [...prev];
          next[activeIndex] = 'success';
          return next;
        });
        setHoldProgress(0);
        holdTimerRef.current = 0;
        lastTickRef.current = null;
        setInputBlocked(true);
        if (blockTimerRef.current) {
          window.clearTimeout(blockTimerRef.current);
        }
        const nextIndex = Math.min(activeIndex + 1, letters.length);
        const nextLetter = letters[nextIndex];
        if (nextLetter && nextLetter === targetChar) {
          requireNeutralRef.current = true;
          setReleaseRequired(true);
        }
        blockTimerRef.current = window.setTimeout(() => {
          setInputBlocked(false);
        }, 500);
        setActiveIndex((prev) => Math.min(prev + 1, letters.length));
      }
      return;
    }

    const hintAnchor = lastCorrectRef.current ?? activeLetterStartedAtRef.current;
    if (hintAnchor && now - hintAnchor > 5000 && mode !== 'test') {
      setShowHint(true);
    }

    if (!lastTickRef.current) lastTickRef.current = now;
    const decayDelta = now - lastTickRef.current;
    holdTimerRef.current = Math.max(0, holdTimerRef.current - decayDelta * 2);
    lastTickRef.current = now;
    if (now - lastProgressUpdateRef.current > 50) {
      const pct = Math.min(100, (holdTimerRef.current / 150) * 100);
      setHoldProgress(pct);
      lastProgressUpdateRef.current = now;
    }

    if (predictedLetter !== targetChar && confidence > 0.85) {
      if (lastMismatchLetterRef.current !== predictedLetter) {
        mismatchStartRef.current = now;
        lastMismatchLetterRef.current = predictedLetter;
      }
      if (
        mismatchStartRef.current &&
        now - mismatchStartRef.current > 1000 &&
        (!lastMistakeAtRef.current || now - lastMistakeAtRef.current > 1000)
      ) {
        setMistakes((prev) => prev + 1);
        lastMistakeAtRef.current = now;
        mismatchStartRef.current = null;
        lastMismatchLetterRef.current = null;
      }
    } else {
      mismatchStartRef.current = null;
      lastMismatchLetterRef.current = null;
    }
  }, [predictedLetter, confidence, inputBlocked, activeIndex, letters]);

  const targetChar = letters[activeIndex] ?? '';
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const landmarkPoints = useMemo(() => {
    if (!landmarks) return [];
    const points: { x: number; y: number; z?: number }[] = [];
    for (let i = 0; i < 21; i += 1) {
      const x = landmarks[i * 3];
      const y = landmarks[i * 3 + 1];
      const z = landmarks[i * 3 + 2];
      if (typeof x !== 'number' || typeof y !== 'number') continue;
      points.push({ x, y, z });
    }
    return points;
  }, [landmarks]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;
    const width = video.videoWidth || 640;
    const height = video.videoHeight || 480;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    if (!landmarkPoints.length) return;

    const DrawingUtils = (window as any).DrawingUtils;
    if (DrawingUtils) {
      const DU = new DrawingUtils(ctx);
      DU.drawLandmarks(landmarkPoints, { radius: 2.2, lineWidth: 1 });
      return;
    }

    ctx.fillStyle = 'rgba(56,189,248,0.9)';
    for (const point of landmarkPoints) {
      const x = point.x * width;
      const y = point.y * height;
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, 2 * Math.PI);
      ctx.fill();
    }
  }, [landmarkPoints, videoRef]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
            Target word
          </p>
          <h3 className="text-2xl font-semibold tracking-[0.18em] text-slate-900 leading-none">
            {word}
          </h3>
        </div>
        <div className="flex flex-col items-end gap-1">
          <button
            type="button"
            onClick={onExit}
            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-600 hover:border-slate-300 hover:text-slate-800"
          >
            Exit
          </button>
          <p className="text-[10px] text-slate-400">Press Esc on desktop</p>
        </div>
      </div>
      {mode === 'test' && (
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-amber-400 transition-[width] duration-100"
            style={{
              width: `${Math.max(
                0,
                Math.min(100, (timeLeftMs / (timeLimit * 1000)) * 100),
              )}%`,
            }}
          />
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        {letters.map((letter, idx) => {
          const state = letterStatus[idx];
          const isActive = idx === activeIndex;
          return (
            <motion.div
              key={`${letter}-${idx}`}
              layout
              initial={{ scale: 0.95, opacity: 0.8 }}
              animate={{
                scale: isActive ? 1.1 : 1,
                opacity: 1,
              }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              className={`relative flex h-16 w-16 items-center justify-center rounded-2xl border text-2xl font-semibold ${
                state === 'success'
                  ? 'border-emerald-300 bg-emerald-400 text-white'
                  : isActive
                  ? 'border-blue-400 text-blue-600'
                  : 'border-slate-200 text-slate-400'
              }`}
            >
              {isActive && (
                <motion.div
                  key={`progress-${letter}-${holdProgress}`}
                  className="absolute inset-0 rounded-2xl bg-blue-100"
                  initial={{ width: '0%' }}
                  animate={{ width: `${holdProgress}%` }}
                  transition={{ duration: 0.05, ease: 'linear' }}
                  style={{ left: 0, right: 'auto' }}
                />
              )}
              <span className="relative z-10">{letter}</span>
            </motion.div>
          );
        })}
      </div>

      <div className="relative rounded-2xl border border-slate-200 bg-white p-4">
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-slate-100">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="h-full w-full object-cover"
            style={{ transform: 'scaleX(-1)' }}
          />
          <canvas
            ref={canvasRef}
            className="pointer-events-none absolute inset-0 h-full w-full"
          />
          <div className="pointer-events-none absolute inset-10 rounded-xl border-2 border-dashed border-blue-200/80" />

          <AnimatePresence>
            {showHint && targetChar && mode !== 'test' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="absolute inset-0 flex items-center justify-center"
              >
                <img
                  src={`/images/${targetChar}.png`}
                  alt={`${targetChar} ghost hint`}
                  className="h-40 w-40 object-contain opacity-30"
                  style={{ transform: 'scaleX(-1)' }}
                />
              </motion.div>
            )}
          </AnimatePresence>
          {releaseRequired && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] text-amber-700">
              Release between letters
            </div>
          )}
        </div>
        {error && (
          <p className="mt-3 text-xs text-rose-600">Error: {error}</p>
        )}
        {!running && !error && (
          <p className="mt-3 text-xs text-slate-500">Starting camera…</p>
        )}
      </div>

      {mode !== 'test' && (
        <div className="sticky bottom-4 rounded-xl border border-slate-200 bg-white/95 px-3 py-2 text-xs text-slate-600 shadow-sm backdrop-blur">
          Current prediction:{' '}
          <span className="font-semibold text-slate-900">
            {predictedLetter || '—'}
          </span>{' '}
          <span className="text-slate-400">({(confidence * 100).toFixed(1)}%)</span>
        </div>
      )}
    </div>
  );
}
