'use client';

import { useEffect, useRef, useState } from 'react';
import InstantFingerspellingPractice from '@/components/InstantFingerspellingPractice';

export default function Module2InstantWordsLesson({
  words,
  title,
  helper,
  onComplete,
}: {
  words: string[];
  title: string;
  helper?: string;
  onComplete: () => void;
}) {
  const [mastered, setMastered] = useState<Set<string>>(() => new Set());
  const [currentWord, setCurrentWord] = useState(words[0] ?? '');
  const completedRef = useRef(false);

  const masteredCount = mastered.size;
  const total = words.length;

  useEffect(() => {
    setMastered(new Set());
    setCurrentWord(words[0] ?? '');
    completedRef.current = false;
  }, [words]);

  useEffect(() => {
    const next = words.find((word) => !mastered.has(word));
    if (next) setCurrentWord(next);
  }, [mastered, words]);

  useEffect(() => {
    if (masteredCount >= total && total > 0 && !completedRef.current) {
      completedRef.current = true;
      onComplete();
    }
  }, [masteredCount, total, onComplete]);

  function handlePerfect() {
    setMastered((prev) => new Set(prev).add(currentWord));
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)]">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">
              {title}
            </p>
            {helper && <p className="mt-1 text-xs text-slate-500">{helper}</p>}
          </div>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold text-slate-700">
            Mastered {masteredCount}/{total}
          </span>
        </div>

        <div className="mt-4">
          <InstantFingerspellingPractice
            word={currentWord}
            onPerfect={handlePerfect}
            minConfidence={0.6}
            minConfidenceByLetter={{ O: 0.3, S: 0.4 }}
            letterTimeLimitMs={2000}
          />
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
        <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">
          Word checklist
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {words.map((word) => {
            const isDone = mastered.has(word);
            return (
              <span
                key={word}
                className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${
                  isDone
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                    : 'border-slate-200 text-slate-500'
                }`}
              >
                {word}
              </span>
            );
          })}
        </div>
        <p className="mt-3 text-[11px] text-slate-500">
          Each word must be completed perfectly within the 2-second letter window.
        </p>
      </div>
    </div>
  );
}
