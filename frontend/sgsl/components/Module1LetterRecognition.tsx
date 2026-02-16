'use client';

import { useEffect, useRef, useState } from 'react';
import TimerBar from '@/components/TimerBar';

export default function Module1LetterRecognition({
  promptLetters,
  options,
  title,
  helper,
  onComplete,
}: {
  promptLetters: string[];
  options: string[];
  title: string;
  helper?: string;
  onComplete: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [status, setStatus] = useState<'running' | 'timeout' | 'wrong' | 'success'>(
    'running',
  );
  const startRef = useRef(Date.now());
  const completedRef = useRef(false);

  const current = promptLetters[index] ?? promptLetters[0];

  useEffect(() => {
    if (index >= promptLetters.length && !completedRef.current) {
      completedRef.current = true;
      onComplete();
    }
  }, [index, promptLetters.length, onComplete]);

  useEffect(() => {
    startRef.current = Date.now();
    setElapsed(0);
    setStatus('running');
  }, [index]);

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

  function handleSelect(letter: string) {
    const now = Date.now();
    if (now - startRef.current > 2000) return;
    if (letter === current) {
      setStatus('success');
      window.setTimeout(() => setIndex((prev) => prev + 1), 200);
    } else {
      setStatus('wrong');
      startRef.current = Date.now();
      setElapsed(0);
      window.setTimeout(() => setStatus('running'), 300);
    }
  }

  const stateLabel =
    status === 'timeout'
      ? 'Too slow — try again'
      : status === 'wrong'
        ? 'Incorrect — try again'
        : status === 'success'
          ? 'Correct'
          : 'Choose the letter';

  const progressText = `${Math.min(index, promptLetters.length)}/${promptLetters.length}`;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)]">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">
              {title}
            </p>
            <p className="mt-2 text-xs text-slate-500">{stateLabel}</p>
          </div>
          <div className="text-[11px] text-slate-500">
            {progressText}
          </div>
        </div>

        <div className="mt-3">
          <TimerBar
            durationMs={2000}
            elapsedMs={elapsed}
            state={status === 'timeout' ? 'fail' : status === 'success' ? 'success' : 'running'}
          />
        </div>

        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 flex items-center justify-center">
          <img
            src={`/images/${current}.png`}
            alt={`Prompt ${current}`}
            className="h-36 w-36 object-contain"
          />
        </div>

        {helper && (
          <p className="mt-3 text-xs text-slate-500">{helper}</p>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
        <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">
          Choose the letter
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {options.map((letter) => (
            <button
              key={letter}
              type="button"
              onClick={() => handleSelect(letter)}
              className="h-10 w-10 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:border-slate-300"
            >
              {letter}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
