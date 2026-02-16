'use client';

import { useEffect, useRef, useState } from 'react';
import StaticLetterPractice from '@/components/StaticLetterPractice';
import TimerBar from '@/components/TimerBar';

export default function Module1InstantProduction({
  letters,
  onComplete,
}: {
  letters: string[];
  onComplete: () => void;
}) {
  const [mastered, setMastered] = useState<Set<string>>(() => new Set());
  const [targetLetter, setTargetLetter] = useState(letters[0] ?? '');
  const [elapsed, setElapsed] = useState(0);
  const [status, setStatus] = useState<'running' | 'timeout' | 'success'>(
    'running',
  );
  const startRef = useRef<number>(Date.now());
  const completedRef = useRef(false);

  const masteredCount = mastered.size;
  const total = letters.length;

  useEffect(() => {
    const next = letters.find((letter) => !mastered.has(letter));
    if (next && next !== targetLetter) {
      setTargetLetter(next);
    }
  }, [letters, mastered, targetLetter]);

  useEffect(() => {
    startRef.current = Date.now();
    setElapsed(0);
    setStatus('running');
  }, [targetLetter]);

  useEffect(() => {
    if (masteredCount >= total && !completedRef.current) {
      completedRef.current = true;
      onComplete();
    }
  }, [masteredCount, total, onComplete]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (status === 'success') return;
      const now = Date.now();
      const delta = now - startRef.current;
      if (delta >= 2000) {
        setStatus('timeout');
        startRef.current = Date.now();
        setElapsed(0);
        window.setTimeout(() => setStatus('running'), 300);
      } else {
        setElapsed(delta);
      }
    }, 50);
    return () => window.clearInterval(interval);
  }, [status, targetLetter]);

  function handlePrediction(letter: string) {
    if (letter !== targetLetter) return;
    const now = Date.now();
    if (now - startRef.current > 2000) return;
    setStatus('success');
    setElapsed(2000);
    setMastered((prev) => new Set(prev).add(targetLetter));
    window.setTimeout(() => setStatus('running'), 200);
  }

  const stateLabel =
    status === 'timeout'
      ? 'Too slow — try again'
      : status === 'success'
        ? 'Nice!'
        : 'Hold steady';

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)]">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">
              Instant production
            </p>
            <h3 className="mt-2 text-3xl font-semibold tracking-[0.2em] text-slate-900">
              {targetLetter}
            </h3>
            <p className="mt-2 text-xs text-slate-500">{stateLabel}</p>
          </div>
          <div className="text-right text-[11px] text-slate-500">
            <span className="font-semibold text-slate-900">
              {masteredCount}/{total}
            </span>{' '}
            mastered
          </div>
        </div>

        <div className="mt-4">
          <TimerBar durationMs={2000} elapsedMs={elapsed} state={
            status === 'timeout' ? 'fail' : status === 'success' ? 'success' : 'running'
          } />
        </div>

        <div className="mt-4">
          <StaticLetterPractice
            allowedLetters={letters}
            targetLetter={targetLetter}
            onConfidentPrediction={handlePrediction}
            confidenceThreshold={0.6}
          />
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
        <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">
          Mastery checklist
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {letters.map((letter) => {
            const isDone = mastered.has(letter);
            return (
              <span
                key={letter}
                className={`flex h-9 w-9 items-center justify-center rounded-lg border text-xs font-semibold ${
                  isDone
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                    : 'border-slate-200 text-slate-400'
                }`}
              >
                {letter}
              </span>
            );
          })}
        </div>
        <p className="mt-3 text-[11px] text-slate-500">
          Each letter must be confirmed within 2 seconds.
        </p>
      </div>
    </div>
  );
}
