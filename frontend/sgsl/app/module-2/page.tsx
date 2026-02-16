'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Script from 'next/script';
import { useRouter } from 'next/navigation';
import ModuleNav from '@/components/ModuleNav';
import Module2IntroLessonView from '@/components/Module2IntroLessonView';
import FingerspellingPractice from '@/components/FingerSpellingPractice';
import { useUserProgress } from '@/hooks/useUserProgress';
import { hasCompletedOnboarding } from '@/lib/onboarding';

type LessonType = 'intro' | 'practice' | 'testing';

interface Lesson {
  id: string;
  title: string;
  type: LessonType;
  description: string;
}

const lessons: Lesson[] = [
  {
    id: 'intro',
    title: 'Lesson 1: From letters to words',
    type: 'intro',
    description:
      'Learn how fingerspelling differs from static letters and how to practice effectively.',
  },
  {
    id: 'practice-short',
    title: 'Lesson 2: Practice (Short words)',
    type: 'practice',
    description:
      'Get comfortable spelling 3-4 letter words with clean pauses and resets.',
  },
  {
    id: 'practice-long',
    title: 'Lesson 3: Practice (Longer words)',
    type: 'practice',
    description:
      'Build fluency with longer, more challenging words.',
  },
  {
    id: 'quiz-words',
    title: 'Lesson 4: Testing (Word recognition)',
    type: 'testing',
    description:
      'Spell the target word. The chain is evaluated after you pause.',
  },
];

const SHORT_WORDS = [
  'TEN',
  'LATE',
  'COIN',
  'RAIN',
  'TONE',
  'NOON',
  'TALL',
  'TEEN',
  'COOL',
  'TREE',
  'SEEN',
  'LOON',
  'REEL',
];

const LONG_WORDS = [
  'ALONE',
  'CLEAN',
  'TRACE',
  'NOISE',
  'STONE',
  'TRAIN',
  'SCARE',
  'SASS',
];

const spellingWords = [
  'TEN',
  'LATE',
  'COIN',
  'RAIN',
  'TONE',
  'ALONE',
  'CLEAN',
  'TRACE',
  'NOISE',
  'STONE',
  'TRAIN',
  'SCARE',
  'NOON',
  'TALL',
  'TEEN',
  'COOL',
  'TREE',
  'SEEN',
  'LOON',
  'SASS',
  'REEL',
];

export default function ModuleTwoPage() {
  const router = useRouter();
  const [currentLessonId, setCurrentLessonId] = useState<string>(lessons[0].id);
  const { profile, loading, completeLesson, unlockModule } = useUserProgress();
  const completedLessons = profile?.completedLessons ?? [];

  const currentLesson =
    lessons.find((l) => l.id === currentLessonId) ?? lessons[0];

  const completedCount = lessons.filter((lesson) =>
    completedLessons.includes(`module2-${lesson.id}`),
  ).length;
  const moduleProgress = Math.round((completedCount / lessons.length) * 100);

  const isCompleted = completedLessons.includes(`module2-${currentLesson.id}`);
  const moduleTwoComplete = completedCount === lessons.length;

  const nextLessonId = useMemo(() => {
    const index = lessons.findIndex((lesson) => lesson.id === currentLesson.id);
    return index >= 0 ? lessons[index + 1]?.id ?? null : null;
  }, [currentLesson.id]);

  function markLessonComplete() {
    completeLesson(`module2-${currentLesson.id}`, 50);
  }

  useEffect(() => {
    if (loading) return;
    if (!profile) return;
    if (hasCompletedOnboarding(profile)) return;
    router.replace(`/onboarding?next=${encodeURIComponent('/module-2')}`);
  }, [loading, profile, router]);

  useEffect(() => {
    if (moduleTwoComplete) {
      unlockModule(3);
    }
  }, [moduleTwoComplete, unlockModule]);

  return (
    <>
      <Script
        src="https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js"
        strategy="afterInteractive"
      />
      <Script
        src="https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js"
        strategy="afterInteractive"
      />

      <ModuleNav currentModule={2} />
      <div className="min-h-screen bg-slate-50 text-slate-900 flex">
        <aside className="hidden md:flex w-72 flex-col border-r border-slate-200 bg-white">
          <div className="px-5 py-4 border-b border-slate-200">
            <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
              Module 2
            </p>
            <h1 className="mt-1 text-sm font-semibold">
              SgSL Fingerspelling - Words & Fluency
            </h1>
            <p className="mt-1 text-xs text-slate-500">
              Chain letters together to spell words with consistent pacing.
            </p>

            <div className="mt-4">
              <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                <span>Module progress</span>
                <span className="font-medium text-slate-900">
                  {moduleProgress}%
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-blue-500 transition-all"
                  style={{ width: `${moduleProgress}%` }}
                />
              </div>
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-1">
            {lessons.map((lesson, idx) => {
              const active = lesson.id === currentLessonId;
              const done = completedLessons.includes(`module2-${lesson.id}`);

              const badgeLabel =
                lesson.type === 'intro'
                  ? 'Intro'
                  : lesson.type === 'practice'
                    ? 'Practice'
                    : 'Testing';

              const badgeClasses =
                lesson.type === 'intro'
                  ? 'border-slate-300 text-slate-500'
                  : lesson.type === 'practice'
                    ? 'border-emerald-400/50 text-emerald-300'
                    : 'border-sky-400/50 text-sky-300';

              return (
                <button
                  key={lesson.id}
                  onClick={() => setCurrentLessonId(lesson.id)}
                  className={`w-full text-left rounded-xl px-3 py-2.5 text-xs mb-1 flex items-start gap-3 border ${
                    active
                      ? 'bg-white border-blue-500/70'
                      : 'bg-white border-slate-200 hover:border-slate-200 hover:bg-white'
                  }`}
                >
                  <div className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full border border-slate-200 text-[11px]">
                    {done ? '✓' : idx + 1}
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[11px] rounded-full px-2 py-[2px] border ${badgeClasses}`}
                      >
                        {badgeLabel}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        Lesson {idx + 1}
                      </span>
                    </div>
                    <p className="text-xs font-medium text-slate-900">
                      {lesson.title}
                    </p>
                    <p className="text-[11px] text-slate-500 line-clamp-2">
                      {lesson.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </nav>
        </aside>

        <main className="flex-1 flex flex-col">
          <header className="border-b border-slate-200 bg-white/80 backdrop-blur px-4 py-3 flex items-center justify-between">
            <div className="flex flex-col">
              <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                Module 2 · Fingerspelling
              </p>
              <h2 className="mt-1 text-sm font-semibold text-slate-900">
                {currentLesson.title}
              </h2>
            </div>

            <div className="hidden md:flex items-center gap-3 text-[11px]">
              <span className="text-slate-500">
                {completedCount}/{lessons.length} lessons completed
              </span>
            </div>
          </header>

          <section className="flex-1 overflow-y-auto p-4 md:p-6">
            {currentLesson.type === 'intro' && (
              <Module2IntroLessonView
                key={currentLesson.id}
                onComplete={markLessonComplete}
              />
            )}

            {currentLesson.id === 'practice-short' && (
              <PracticeLessonContent
                key={currentLesson.id}
                words={SHORT_WORDS}
                onComplete={markLessonComplete}
                isCompleted={isCompleted}
              />
            )}

            {currentLesson.id === 'practice-long' && (
              <PracticeLessonContent
                key={currentLesson.id}
                words={LONG_WORDS}
                onComplete={markLessonComplete}
                isCompleted={isCompleted}
              />
            )}

            {currentLesson.type === 'testing' && (
              <TestingLessonContent
                key={currentLesson.id}
                onComplete={markLessonComplete}
                isCompleted={isCompleted}
              />
            )}
          </section>
        </main>
      </div>

      {isCompleted && nextLessonId && (
        <div className="fixed bottom-4 left-0 right-0 flex justify-center animate-in slide-in-from-bottom">
          <div className="flex items-center gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 shadow-lg">
            <span className="font-semibold">Lesson Complete! +50 XP</span>
            <button
              type="button"
              onClick={() => setCurrentLessonId(nextLessonId)}
              className="rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-400"
            >
              Continue to next lesson →
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function PracticeLessonContent({
  words,
  onComplete,
  isCompleted,
}: {
  words: string[];
  onComplete: () => void;
  isCompleted: boolean;
}) {
  const [wordIndex, setWordIndex] = useState(0);
  const [completedWordIndices, setCompletedWordIndices] = useState<Set<number>>(
    () => new Set(),
  );
  const [lastMetrics, setLastMetrics] = useState<{
    timeTakenMs: number;
    mistakes: number;
  } | null>(null);
  const completedRef = useRef(false);

  const currentWord = words[wordIndex] ?? words[0] ?? 'MRT';
  const totalPracticeWords = words.length;

  useEffect(() => {
    if (isCompleted) return;
    if (completedRef.current) return;
    if (totalPracticeWords > 0 && completedWordIndices.size >= totalPracticeWords) {
      completedRef.current = true;
      onComplete();
    }
  }, [completedWordIndices, totalPracticeWords, isCompleted, onComplete]);

  useEffect(() => {
    setWordIndex(0);
    setCompletedWordIndices(new Set());
    setLastMetrics(null);
    completedRef.current = false;
  }, [words]);

  function handleComplete(metrics: { timeTakenMs: number; mistakes: number }) {
    setLastMetrics(metrics);
    setCompletedWordIndices((prev) => {
      const next = new Set(prev);
      next.add(wordIndex);
      return next;
    });
    setWordIndex((prev) => {
      const next = prev + 1;
      return totalPracticeWords > 0 ? next % totalPracticeWords : 0;
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div className="relative rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
        <span className="absolute right-4 top-4 md:right-5 md:top-5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold text-slate-700">
          Progress {Math.min(completedWordIndices.size, totalPracticeWords)}/
          {totalPracticeWords}
        </span>
        <FingerspellingPractice
          mode="practice"
          word={currentWord}
          minConfidence={0.4}
          minConfidenceByLetter={{ O: 0.3, S: 0.4 }}
          onComplete={handleComplete}
          onExit={() => {
            setWordIndex((prev) => {
              const next = prev + 1;
              return totalPracticeWords > 0 ? next % totalPracticeWords : 0;
            });
            setLastMetrics(null);
          }}
        />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5 text-xs text-slate-600 space-y-3">
        <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
          Practice tips
        </p>
        <ul className="list-disc pl-4 space-y-1 text-slate-500">
          <li>Keep your hand centered inside the target box.</li>
          <li>Relax your hand between letters to avoid double counts.</li>
          <li>Use the hint card if you miss a letter for too long.</li>
          <li>Use Exit to skip the current attempt and move on.</li>
        </ul>
        {lastMetrics && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
            Last run: {(lastMetrics.timeTakenMs / 1000).toFixed(1)}s ·{' '}
            {lastMetrics.mistakes} mistakes
          </div>
        )}
        <p className="text-[11px] text-slate-500">
          Current word: <span className="font-semibold">{currentWord}</span>
        </p>
      </div>
    </div>
  );
}

function TestingLessonContent({
  onComplete,
  isCompleted,
}: {
  onComplete: () => void;
  isCompleted: boolean;
}) {
  const [status, setStatus] = useState<'idle' | 'running' | 'summary'>('idle');
  const [queue, setQueue] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [results, setResults] = useState<
    { word: string; time: number; mistakes: number; passed: boolean }[]
  >([]);

  function buildQueue() {
    const available = [...spellingWords];
    const picks: string[] = [];
    while (picks.length < 5 && available.length > 0) {
      const idx = Math.floor(Math.random() * available.length);
      picks.push(available[idx]);
      available.splice(idx, 1);
    }
    while (picks.length < 5) {
      const fallback =
        spellingWords[Math.floor(Math.random() * spellingWords.length)] ??
        'MRT';
      picks.push(fallback);
    }
    return picks;
  }

  function startTest() {
    const nextQueue = buildQueue();
    setQueue(nextQueue);
    setCurrentIndex(0);
    setResults([]);
    setStatus('running');
  }

  function finishTest(nextResults: typeof results) {
    setResults(nextResults);
    setStatus('summary');
    const passedCount = nextResults.filter((item) => item.passed).length;
    if (passedCount >= 4 && !isCompleted) onComplete();
  }

  function handleWordComplete(metrics: { timeTakenMs: number; mistakes: number }) {
    const nextResults = [
      ...results,
      {
        word: queue[currentIndex] ?? 'MRT',
        time: metrics.timeTakenMs,
        mistakes: metrics.mistakes,
        passed: true,
      },
    ];
    const nextIndex = currentIndex + 1;
    if (nextIndex >= queue.length) {
      finishTest(nextResults);
    } else {
      setResults(nextResults);
      setCurrentIndex(nextIndex);
    }
  }

  function handleTimeOut() {
    const nextResults = [
      ...results,
      {
        word: queue[currentIndex] ?? 'MRT',
        time: 20000,
        mistakes: 0,
        passed: false,
      },
    ];
    const nextIndex = currentIndex + 1;
    if (nextIndex >= queue.length) {
      finishTest(nextResults);
    } else {
      setResults(nextResults);
      setCurrentIndex(nextIndex);
    }
  }

  const totalTimeMs = results.reduce((sum, item) => sum + item.time, 0);
  const totalChars = results.reduce((sum, item) => sum + item.word.length, 0);
  const totalMinutes = totalTimeMs / 60000;
  const avgWpm =
    totalMinutes > 0 ? Math.round((totalChars / 5 / totalMinutes) * 10) / 10 : 0;
  const missedWords = results.filter((item) => !item.passed).map((item) => item.word);
  const totalQueueCount = queue.length || 5;
  const runningIndex = Math.min(currentIndex + 1, totalQueueCount);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div className="rounded-2xl border border-amber-200 bg-white p-4 md:p-5">
        <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
          <p className="text-[11px] uppercase tracking-[0.2em] text-amber-600">
            Exam sprint
          </p>
          <h3 className="text-sm font-semibold text-amber-900">
            5-word fingerspelling test
          </h3>
        </div>

        {status === 'idle' && (
          <div className="space-y-4">
            <p className="text-xs text-slate-500">
              You have 5 words. Speed and accuracy count. Landmarks are visible,
              but predictions are hidden. Use Exit to stop early and review your
              current results.
            </p>
            <button
              type="button"
              onClick={startTest}
              className="inline-flex items-center justify-center rounded-lg bg-amber-500 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-400 transition"
            >
              Start test
            </button>
          </div>
        )}

        {status === 'running' && (
          <div className="space-y-4">
            <div className="inline-flex items-center rounded-2xl border border-slate-200 bg-white/80 px-4 py-3">
              <span className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
                Word {runningIndex} of {totalQueueCount}
              </span>
            </div>

            <FingerspellingPractice
              mode="test"
              timeLimit={20}
              word={queue[currentIndex] ?? 'MRT'}
              minConfidence={0.5}
              minConfidenceByLetter={{ O: 0.3, S: 0.4 }}
              onComplete={handleWordComplete}
              onTimeOut={handleTimeOut}
              onExit={() => {
                setStatus('summary');
              }}
            />
          </div>
        )}

        {status === 'summary' && (
          <div className="space-y-4">
            <p className="text-sm font-semibold text-slate-900">
              Score: {results.filter((item) => item.passed).length}/{totalQueueCount}{' '}
              words
            </p>
            <div className="text-xs text-slate-600">
              Total time: {(totalTimeMs / 1000).toFixed(1)}s · Avg WPM:{' '}
              {avgWpm}
            </div>
            {missedWords.length > 0 ? (
              <p className="text-xs text-slate-500">
                Missed: <span className="font-semibold">{missedWords.join(', ')}</span>
              </p>
            ) : (
              <p className="text-xs text-emerald-600">All words passed.</p>
            )}
            <button
              type="button"
              onClick={startTest}
              className="inline-flex items-center justify-center rounded-lg border border-amber-200 bg-white px-4 py-2 text-xs font-semibold text-amber-700 hover:border-amber-300"
            >
              Retry test
            </button>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5 text-xs text-slate-600 space-y-3">
        <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
          Finishing Module 2
        </p>
        <p>
          Pass at least 4 out of 5 words to complete the test lesson. Landmarks
          stay visible, but predictions stay hidden. Exit ends the current run
          and opens the summary.
        </p>
        {status === 'summary' ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-700">
            Completed {results.filter((item) => item.passed).length}/{totalQueueCount} words ·{' '}
            {(totalTimeMs / 1000).toFixed(1)}s total
          </div>
        ) : (
          <p className="text-[11px] text-slate-500">
            Start the sprint to see your score summary.
          </p>
        )}
      </div>
    </div>
  );
}
