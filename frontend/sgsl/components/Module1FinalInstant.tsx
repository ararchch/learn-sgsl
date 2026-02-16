'use client';

import { useEffect, useRef, useState } from 'react';
import StaticLetterPractice from '@/components/StaticLetterPractice';
import TimerBar from '@/components/TimerBar';

function shuffle(list: string[]) {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export default function Module1FinalInstant({
  letters,
  onComplete,
}: {
  letters: string[];
  onComplete: () => void;
}) {
  const [order, setOrder] = useState<string[]>(() => shuffle(letters));
  const [index, setIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [status, setStatus] = useState<'running' | 'timeout' | 'success'>('running');
  const startRef = useRef(Date.now());
  const completedRef = useRef(false);

  const targetLetter = order[index];

  useEffect(() => {
    setOrder(shuffle(letters));
    setIndex(0);
  }, [letters]);

  useEffect(() => {
    startRef.current = Date.now();
    setElapsed(0);
    setStatus('running');
  }, [index]);

  useEffect(() => {
    if (index >= order.length && !completedRef.current) {
      completedRef.current = true;
      onComplete();
    }
  }, [index, order.length, onComplete]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (status === 'success') return;
      const delta = Date.now() - startRef.current;
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
  }, [status, index]);

  function handlePrediction(letter: string) {
    if (letter !== targetLetter) return;
    if (Date.now() - startRef.current > 2000) return;
    setStatus('success');
    setElapsed(2000);
    window.setTimeout(() => setIndex((prev) => prev + 1), 200);
  }

  const stateLabel =
    status === 'timeout'
      ? 'Too slow — try again'
      : status === 'success'
        ? 'Correct'
        : 'Hold steady';

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)]">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">
              Final instant exam
            </p>
            <h3 className="mt-2 text-3xl font-semibold tracking-[0.2em] text-slate-900">
              {targetLetter}
            </h3>
            <p className="mt-2 text-xs text-slate-500">{stateLabel}</p>
          </div>
          <div className="text-[11px] text-slate-500">
            {Math.min(index + 1, order.length)}/{order.length}
          </div>
        </div>

        <div className="mt-4">
          <TimerBar
            durationMs={2000}
            elapsedMs={elapsed}
            state={status === 'timeout' ? 'fail' : status === 'success' ? 'success' : 'running'}
          />
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
          Rules
        </p>
        <ul className="mt-3 text-xs text-slate-600 space-y-2">
          <li>Each letter must be confirmed within 2 seconds.</li>
          <li>Missed letters must be retried until correct.</li>
          <li>10/10 correct to complete the exam.</li>
        </ul>
      </div>
    </div>
  );
}
