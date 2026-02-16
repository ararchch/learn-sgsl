'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import TimerBar from '@/components/TimerBar';

function shuffle<T>(list: T[]) {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export default function Module2DecodeLesson({
  words,
  title,
  onComplete,
}: {
  words: string[];
  title: string;
  onComplete: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<'play' | 'answer'>('play');
  const [display, setDisplay] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [status, setStatus] = useState<'running' | 'wrong' | 'timeout' | 'success'>(
    'running',
  );
  const startRef = useRef(Date.now());
  const completedRef = useRef(false);

  const currentWord = words[index] ?? words[0] ?? '';

  useEffect(() => {
    if (index >= words.length && !completedRef.current) {
      completedRef.current = true;
      onComplete();
    }
  }, [index, words.length, onComplete]);

  useEffect(() => {
    if (phase !== 'play') return;
    const letters = currentWord.split('');
    let idx = 0;
    setDisplay('');
    const interval = window.setInterval(() => {
      setDisplay(letters[idx] ?? '');
      idx += 1;
      if (idx >= letters.length) {
        window.clearInterval(interval);
        window.setTimeout(() => {
          setPhase('answer');
          setStatus('running');
          startRef.current = Date.now();
          setElapsed(0);
        }, 200);
      }
    }, 300);
    return () => window.clearInterval(interval);
  }, [phase, currentWord]);

  useEffect(() => {
    if (phase !== 'answer') return;
    const interval = window.setInterval(() => {
      const delta = Date.now() - startRef.current;
      if (delta >= 2000) {
        setStatus('timeout');
        setElapsed(2000);
        window.setTimeout(() => {
          setPhase('play');
          setStatus('running');
        }, 300);
      } else {
        setElapsed(delta);
      }
    }, 50);
    return () => window.clearInterval(interval);
  }, [phase]);

  const options = useMemo(() => {
    const pool = words.filter((w) => w !== currentWord);
    const picks = shuffle(pool).slice(0, 3);
    return shuffle([currentWord, ...picks]);
  }, [currentWord, words]);

  function handleSelect(word: string) {
    if (phase !== 'answer') return;
    if (Date.now() - startRef.current > 2000) return;
    if (word === currentWord) {
      setStatus('success');
      window.setTimeout(() => {
        setIndex((prev) => prev + 1);
        setPhase('play');
      }, 200);
    } else {
      setStatus('wrong');
      window.setTimeout(() => {
        setPhase('play');
        setStatus('running');
      }, 300);
    }
  }

  const stateLabel =
    status === 'timeout'
      ? 'Too slow — try again'
      : status === 'wrong'
        ? 'Incorrect — try again'
        : status === 'success'
          ? 'Correct'
          : phase === 'play'
            ? 'Watch the fingerspelling'
            : 'Select the word';

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)]">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">
              {title}
            </p>
            <p className="mt-1 text-xs text-slate-500">{stateLabel}</p>
          </div>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold text-slate-700">
            {Math.min(index + 1, words.length)}/{words.length}
          </span>
        </div>

        {phase === 'answer' && (
          <div className="mt-3">
            <TimerBar
              durationMs={2000}
              elapsedMs={elapsed}
              state={status === 'timeout' ? 'fail' : status === 'success' ? 'success' : 'running'}
            />
          </div>
        )}

        <div className="mt-4 flex h-40 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-5xl font-semibold tracking-[0.4em] text-slate-900">
          {display || '—'}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
        <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">
          Choose the word
        </p>
        <div className="mt-3 flex flex-col gap-2">
          {options.map((word) => (
            <button
              key={word}
              type="button"
              onClick={() => handleSelect(word)}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:border-slate-300"
            >
              {word}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
