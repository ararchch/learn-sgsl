'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useHandRecognition } from '@/hooks/useHandRecognition';
import TimerBar from '@/components/TimerBar';

interface InstantFingerspellingProps {
  word: string;
  onPerfect: () => void;
  minConfidence?: number;
  minConfidenceByLetter?: Record<string, number>;
  letterTimeLimitMs?: number;
}

type Status = 'running' | 'timeout' | 'wrong' | 'success';

type LetterState = 'pending' | 'success';

export default function InstantFingerspellingPractice({
  word,
  onPerfect,
  minConfidence = 0.6,
  minConfidenceByLetter,
  letterTimeLimitMs = 2000,
}: InstantFingerspellingProps) {
  const letters = useMemo(() => word.toUpperCase().split(''), [word]);
  const { videoRef, predictedLetter, confidence, error, landmarks } =
    useHandRecognition();

  const [activeIndex, setActiveIndex] = useState(0);
  const [letterStatus, setLetterStatus] = useState<LetterState[]>(
    letters.map(() => 'pending'),
  );
  const [holdProgress, setHoldProgress] = useState(0);
  const [status, setStatus] = useState<Status>('running');
  const [timeLeftMs, setTimeLeftMs] = useState(letterTimeLimitMs);
  const [message, setMessage] = useState('Hold steady');

  const holdTimerRef = useRef(0);
  const lastTickRef = useRef<number | null>(null);
  const lastProgressUpdateRef = useRef(0);
  const letterStartRef = useRef<number | null>(null);
  const mistakeLockRef = useRef(false);
  const mismatchStartRef = useRef<number | null>(null);
  const lastMismatchLetterRef = useRef<string | null>(null);
  const lastMistakeAtRef = useRef<number | null>(null);

  const targetChar = letters[activeIndex] ?? '';

  useEffect(() => {
    setActiveIndex(0);
    setLetterStatus(letters.map(() => 'pending'));
    setHoldProgress(0);
    setStatus('running');
    setMessage('Hold steady');
    setTimeLeftMs(letterTimeLimitMs);
    holdTimerRef.current = 0;
    lastTickRef.current = null;
    lastProgressUpdateRef.current = 0;
    letterStartRef.current = Date.now();
    mismatchStartRef.current = null;
    lastMismatchLetterRef.current = null;
    lastMistakeAtRef.current = null;
    mistakeLockRef.current = false;
  }, [letters.join(''), letterTimeLimitMs]);

  useEffect(() => {
    letterStartRef.current = Date.now();
    setTimeLeftMs(letterTimeLimitMs);
    setStatus('running');
    setMessage('Hold steady');
    holdTimerRef.current = 0;
    lastTickRef.current = null;
    lastProgressUpdateRef.current = 0;
  }, [activeIndex, letterTimeLimitMs]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (!letterStartRef.current) return;
      const elapsed = Date.now() - letterStartRef.current;
      const remaining = Math.max(0, letterTimeLimitMs - elapsed);
      setTimeLeftMs(remaining);
      if (remaining <= 0) {
        handleMistake('timeout');
      }
    }, 50);
    return () => window.clearInterval(interval);
  }, [letterTimeLimitMs, activeIndex]);

  function handleMistake(type: 'timeout' | 'wrong') {
    if (mistakeLockRef.current) return;
    mistakeLockRef.current = true;
    setStatus(type === 'timeout' ? 'timeout' : 'wrong');
    setMessage(type === 'timeout' ? 'Too slow — restart word' : 'Wrong letter — restart word');
    setHoldProgress(0);
    holdTimerRef.current = 0;
    lastTickRef.current = null;
    setLetterStatus(letters.map(() => 'pending'));
    setActiveIndex(0);
    window.setTimeout(() => {
      mistakeLockRef.current = false;
      setStatus('running');
      setMessage('Hold steady');
      letterStartRef.current = Date.now();
      setTimeLeftMs(letterTimeLimitMs);
    }, 400);
  }

  useEffect(() => {
    if (!predictedLetter || !targetChar) return;

    const targetMinConfidence =
      minConfidenceByLetter?.[targetChar] ?? minConfidence;

    if (predictedLetter === targetChar && confidence > targetMinConfidence) {
      const now = performance.now();
      if (!lastTickRef.current) lastTickRef.current = now;
      const delta = now - lastTickRef.current;
      holdTimerRef.current += delta;
      lastTickRef.current = now;

      if (now - lastProgressUpdateRef.current > 50) {
        const pct = Math.min(100, (holdTimerRef.current / 200) * 100);
        setHoldProgress(pct);
        lastProgressUpdateRef.current = now;
      }

      if (holdTimerRef.current >= 200) {
        setLetterStatus((prev) => {
          const next = [...prev];
          next[activeIndex] = 'success';
          return next;
        });
        setHoldProgress(0);
        holdTimerRef.current = 0;
        lastTickRef.current = null;
        const nextIndex = activeIndex + 1;
        if (nextIndex >= letters.length) {
          setStatus('success');
          setMessage('Perfect run');
          onPerfect();
        } else {
          setActiveIndex(nextIndex);
        }
      }
      return;
    }

    if (confidence > 0.85 && predictedLetter !== targetChar) {
      const now = performance.now();
      if (lastMismatchLetterRef.current !== predictedLetter) {
        mismatchStartRef.current = now;
        lastMismatchLetterRef.current = predictedLetter;
      }
      if (
        mismatchStartRef.current &&
        now - mismatchStartRef.current > 800 &&
        (!lastMistakeAtRef.current || now - lastMistakeAtRef.current > 800)
      ) {
        lastMistakeAtRef.current = now;
        mismatchStartRef.current = null;
        lastMismatchLetterRef.current = null;
        handleMistake('wrong');
      }
    } else {
      mismatchStartRef.current = null;
      lastMismatchLetterRef.current = null;
    }
  }, [predictedLetter, confidence, targetChar, activeIndex, letters.length, minConfidenceByLetter, minConfidence, onPerfect]);

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

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
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
    <div className="flex flex-col gap-5">
      <div className="space-y-1">
        <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
          Target word
        </p>
        <h3 className="text-2xl font-semibold tracking-[0.18em] text-slate-900 leading-none">
          {word}
        </h3>
        <p className="text-xs text-slate-500">{message}</p>
      </div>

      <TimerBar
        durationMs={letterTimeLimitMs}
        elapsedMs={letterTimeLimitMs - timeLeftMs}
        state={status === 'timeout' || status === 'wrong' ? 'fail' : status === 'success' ? 'success' : 'running'}
      />

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
              className={`relative flex h-14 w-14 items-center justify-center rounded-2xl border text-xl font-semibold ${
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
        </div>
        {error && <p className="mt-3 text-xs text-rose-600">Error: {error}</p>}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white/95 px-3 py-2 text-xs text-slate-600 shadow-sm backdrop-blur">
        Current prediction:{' '}
        <span className="font-semibold text-slate-900">
          {predictedLetter || '—'}
        </span>{' '}
        <span className="text-slate-400">({(confidence * 100).toFixed(1)}%)</span>
      </div>
    </div>
  );
}
