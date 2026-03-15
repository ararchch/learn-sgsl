'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import MediaPipeScripts from '@/components/MediaPipeScripts';
import { useRouter } from 'next/navigation';
import ModuleNav from '@/components/ModuleNav';
import Module2IntroLessonView from '@/components/Module2IntroLessonView';
import FingerspellingPractice from '@/components/FingerSpellingPractice';
import LessonCompletionModal from '@/components/LessonCompletionModal';
import { useUserProgress } from '@/hooks/useUserProgress';
import { MODULE2_PRACTICE_TOUR_VERSION } from '@/lib/module1Tour';

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
  const [currentLessonId, setCurrentLessonId] = useState<string>(lessons[0].id);
  const [lessonRunKey, setLessonRunKey] = useState(0);
  const [suppressedLessonId, setSuppressedLessonId] = useState<string | null>(
    null,
  );
  const router = useRouter();
  const {
    profile,
    loading,
    completeLesson,
    completeModule2PracticeTour,
  } = useUserProgress();
  const completedLessons = profile?.completedLessons ?? [];

  const currentLesson =
    lessons.find((l) => l.id === currentLessonId) ?? lessons[0];

  const completedCount = lessons.filter((lesson) =>
    completedLessons.includes(`module2-${lesson.id}`),
  ).length;
  const moduleProgress = Math.round((completedCount / lessons.length) * 100);

  const isCompleted = completedLessons.includes(`module2-${currentLesson.id}`);

  const nextLessonId = useMemo(() => {
    const index = lessons.findIndex((lesson) => lesson.id === currentLesson.id);
    return index >= 0 ? lessons[index + 1]?.id ?? null : null;
  }, [currentLesson.id]);
  const completionModalOpen =
    isCompleted && suppressedLessonId !== currentLesson.id;

  const repeatLabel =
    currentLesson.type === 'practice'
      ? 'Repeat current practice'
      : currentLesson.type === 'testing'
        ? 'Repeat current test'
        : 'Repeat current lesson';
  const isFinalLesson = currentLesson.id === 'quiz-words';
  const completionTitle = isFinalLesson
    ? 'Module 2 complete'
    : `${currentLesson.title} complete`;
  const completionMessage = isFinalLesson
    ? 'Great work. Continue to Module 3 to start simple vocabulary.'
    : 'You can repeat this step or continue to the next one.';
  const moveOnLabel = isFinalLesson ? 'Go to Module 3' : 'Move on to next';

  function markLessonComplete() {
    completeLesson(`module2-${currentLesson.id}`, 50);
  }

  function openLesson(lessonId: string) {
    setSuppressedLessonId(null);
    setCurrentLessonId(lessonId);
  }

  function handleRepeatCurrent() {
    setSuppressedLessonId(currentLesson.id);
    setLessonRunKey((prev) => prev + 1);
  }

  function handleMoveOn() {
    setSuppressedLessonId(null);
    if (nextLessonId) {
      openLesson(nextLessonId);
      return;
    }
    if (isFinalLesson) {
      router.push('/module-3');
    }
  }

  return (
    <>
      <MediaPipeScripts />

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
                  onClick={() => openLesson(lesson.id)}
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
                key={`${currentLesson.id}-${lessonRunKey}`}
                onComplete={markLessonComplete}
              />
            )}

            {currentLesson.id === 'practice-short' && (
              <PracticeLessonContent
                key={`${currentLesson.id}-${lessonRunKey}`}
                words={SHORT_WORDS}
                onComplete={markLessonComplete}
                isCompleted={isCompleted}
                practiceTourVersionCompleted={
                  loading || !profile
                    ? null
                    : profile.module2practice
                }
                onCompletePracticeTour={completeModule2PracticeTour}
              />
            )}

            {currentLesson.id === 'practice-long' && (
              <PracticeLessonContent
                key={`${currentLesson.id}-${lessonRunKey}`}
                words={LONG_WORDS}
                onComplete={markLessonComplete}
                isCompleted={isCompleted}
                practiceTourVersionCompleted={
                  loading || !profile
                    ? null
                    : profile.module2practice
                }
                onCompletePracticeTour={completeModule2PracticeTour}
              />
            )}

            {currentLesson.type === 'testing' && (
              <TestingLessonContent
                key={`${currentLesson.id}-${lessonRunKey}`}
                onComplete={markLessonComplete}
                isCompleted={isCompleted}
              />
            )}
          </section>
        </main>
      </div>

      <LessonCompletionModal
        open={completionModalOpen}
        title={completionTitle}
        message={completionMessage}
        repeatLabel={repeatLabel}
        moveOnLabel={moveOnLabel}
        onRepeat={handleRepeatCurrent}
        onMoveOn={handleMoveOn}
      />
    </>
  );
}

function PracticeLessonContent({
  words,
  onComplete,
  isCompleted,
  practiceTourVersionCompleted,
  onCompletePracticeTour,
}: {
  words: string[];
  onComplete: () => void;
  isCompleted: boolean;
  practiceTourVersionCompleted: number | null;
  onCompletePracticeTour: (version?: number) => Promise<void>;
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
  const [practiceTourOpen, setPracticeTourOpen] = useState(false);
  const [practiceTourStep, setPracticeTourStep] = useState(0);
  const [practiceTourDismissedThisMount, setPracticeTourDismissedThisMount] =
    useState(false);
  const [practiceTourPopoverPosition, setPracticeTourPopoverPosition] =
    useState<{
      top: number;
      left: number;
    } | null>(null);
  const [practiceTourPopoverPlacement, setPracticeTourPopoverPlacement] =
    useState<'above' | 'below'>('below');
  const practiceMainCardRef = useRef<HTMLDivElement | null>(null);
  const practiceProgressBadgeRef = useRef<HTMLSpanElement | null>(null);
  const practiceWorkspaceRef = useRef<HTMLDivElement | null>(null);
  const practiceCurrentWordRef = useRef<HTMLDivElement | null>(null);
  const practiceTourPopoverRef = useRef<HTMLDivElement | null>(null);

  const MODULE2_PRACTICE_TOUR_STEPS = [
    {
      target: 'workspace',
      title: 'Practice workspace',
      message:
        'This is the main fingerspelling practice area. Follow the target word, sign each letter in sequence, and pause/reset cleanly between letters.',
    },
    {
      target: 'progress',
      title: 'Lesson progress',
      message:
        'This badge tracks how many words you have completed in this lesson. Finish all words to complete the practice section.',
    },
    {
      target: 'current-word',
      title: 'Current word info',
      message:
        'This area shows the current target word, your last run stats, and the How to use button for replaying this tour.',
    },
  ] as const;
  const module2PracticeTourCardHighlightClass =
    'relative z-40 ring-4 ring-amber-400 ring-offset-4 ring-offset-slate-50 border-amber-300 bg-amber-50 shadow-lg shadow-amber-300/60 animate-pulse';
  const module2PracticeTourInlineHighlightClass =
    'relative z-40 ring-4 ring-amber-400 ring-offset-2 ring-offset-white rounded-xl shadow-md shadow-amber-300/60 animate-pulse';

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

  const autoOpenPracticeTour =
    practiceTourVersionCompleted != null &&
    practiceTourVersionCompleted < MODULE2_PRACTICE_TOUR_VERSION &&
    !practiceTourDismissedThisMount;
  const isPracticeTourVisible = practiceTourOpen || autoOpenPracticeTour;
  const practiceTourLastStep = MODULE2_PRACTICE_TOUR_STEPS.length - 1;
  const currentPracticeTourStep =
    MODULE2_PRACTICE_TOUR_STEPS[practiceTourStep] ??
    MODULE2_PRACTICE_TOUR_STEPS[MODULE2_PRACTICE_TOUR_STEPS.length - 1];
  const currentPracticeTourTarget = currentPracticeTourStep.target;

  const isWorkspaceTourStep =
    isPracticeTourVisible && currentPracticeTourTarget === 'workspace';
  const isProgressTourStep =
    isPracticeTourVisible && currentPracticeTourTarget === 'progress';
  const isCurrentWordTourStep =
    isPracticeTourVisible && currentPracticeTourTarget === 'current-word';

  useEffect(() => {
    if (!isPracticeTourVisible) return;
    const targetElement =
      currentPracticeTourTarget === 'workspace'
        ? practiceWorkspaceRef.current
        : currentPracticeTourTarget === 'progress'
          ? practiceProgressBadgeRef.current
          : currentPracticeTourTarget === 'current-word'
            ? practiceCurrentWordRef.current
            : null;
    targetElement?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
      inline: 'nearest',
    });
  }, [isPracticeTourVisible, practiceTourStep, currentPracticeTourTarget]);

  useEffect(() => {
    if (!isPracticeTourVisible) return;

    let frameId: number | null = null;

    const schedulePositionUpdate = () => {
      if (frameId != null) {
        cancelAnimationFrame(frameId);
      }

      frameId = requestAnimationFrame(() => {
        const target =
          currentPracticeTourTarget === 'workspace'
            ? practiceWorkspaceRef.current
            : currentPracticeTourTarget === 'progress'
              ? practiceProgressBadgeRef.current
              : currentPracticeTourTarget === 'current-word'
                ? practiceCurrentWordRef.current
                : null;
        const popover = practiceTourPopoverRef.current;
        if (!target || !popover) return;

        const margin = 12;
        const targetRect = target.getBoundingClientRect();
        const popoverRect = popover.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        let placement: 'above' | 'below' = 'below';
        let top = targetRect.bottom + margin;

        if (top + popoverRect.height + margin > viewportHeight) {
          placement = 'above';
          top = targetRect.top - popoverRect.height - margin;
        }

        if (top < margin) {
          placement = 'below';
          top = Math.max(margin, targetRect.bottom + margin);
        }

        const centeredLeft =
          targetRect.left + targetRect.width / 2 - popoverRect.width / 2;
        const left = Math.min(
          Math.max(margin, centeredLeft),
          viewportWidth - popoverRect.width - margin,
        );

        setPracticeTourPopoverPlacement(placement);
        setPracticeTourPopoverPosition({ top, left });
      });
    };

    schedulePositionUpdate();
    window.addEventListener('resize', schedulePositionUpdate);
    document.addEventListener('scroll', schedulePositionUpdate, true);

    return () => {
      if (frameId != null) {
        cancelAnimationFrame(frameId);
      }
      window.removeEventListener('resize', schedulePositionUpdate);
      document.removeEventListener('scroll', schedulePositionUpdate, true);
    };
  }, [
    isPracticeTourVisible,
    practiceTourStep,
    currentPracticeTourTarget,
  ]);

  async function dismissPracticeTour() {
    setPracticeTourOpen(false);
    setPracticeTourDismissedThisMount(true);
    try {
      await onCompletePracticeTour(MODULE2_PRACTICE_TOUR_VERSION);
    } catch (error) {
      console.error('Module 2 practice tour completion failed', error);
    }
  }

  function openPracticeTour() {
    setPracticeTourStep(0);
    setPracticeTourOpen(true);
  }

  return (
    <div className="grid gap-6">
      <div
        ref={practiceMainCardRef}
        className={`relative mx-auto w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-4 md:p-5 ${
          isWorkspaceTourStep ? module2PracticeTourCardHighlightClass : ''
        }`}
      >
        <span
          ref={practiceProgressBadgeRef}
          className={`absolute right-4 top-4 md:right-5 md:top-5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold text-slate-700 ${
            isProgressTourStep ? module2PracticeTourInlineHighlightClass : ''
          }`}
        >
          Progress {Math.min(completedWordIndices.size, totalPracticeWords)}/
          {totalPracticeWords}
        </span>
        <div
          ref={practiceCurrentWordRef}
          className={`mb-4 flex flex-wrap items-start justify-between gap-3 pr-24 md:pr-28 ${
            isCurrentWordTourStep ? module2PracticeTourInlineHighlightClass : ''
          }`}
        >
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
            <span className="text-slate-500">Current word:</span>
            <span className="font-semibold text-slate-900">{currentWord}</span>
            {lastMetrics && (
              <>
                <span className="text-slate-300">•</span>
                <span>
                  Last run: {(lastMetrics.timeTakenMs / 1000).toFixed(1)}s ·{' '}
                  {lastMetrics.mistakes} mistakes
                </span>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={openPracticeTour}
            className="rounded-full border border-slate-200 px-3 py-1 text-[11px] font-semibold text-slate-600 hover:border-slate-300 hover:text-slate-800"
          >
            How to use
          </button>
        </div>
        <div ref={practiceWorkspaceRef}>
          <FingerspellingPractice
            mode="practice"
            word={currentWord}
            minConfidence={0.4}
            minConfidenceByLetter={{ O: 0.3, S: 0.4 }}
            onComplete={handleComplete}
          />
        </div>
      </div>

      {isPracticeTourVisible && (
        <>
          <div
            aria-hidden="true"
            className="pointer-events-none fixed inset-0 z-30 bg-slate-900/45"
          />
          <div
            ref={practiceTourPopoverRef}
            className="pointer-events-auto fixed z-50 w-[min(24rem,calc(100vw-2rem))] rounded-2xl border border-amber-200 bg-white p-4 shadow-xl shadow-slate-900/25"
            style={
              practiceTourPopoverPosition
                ? {
                    top: practiceTourPopoverPosition.top,
                    left: practiceTourPopoverPosition.left,
                  }
                : { top: 16, left: 16 }
            }
          >
            <div
              aria-hidden="true"
              className={`absolute left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border border-amber-200 bg-white ${
                practiceTourPopoverPlacement === 'below'
                  ? '-top-1.5 border-r-0 border-b-0'
                  : '-bottom-1.5 border-l-0 border-t-0'
              }`}
            />
            <p className="text-[11px] uppercase tracking-[0.2em] text-amber-700">
              Practice tour · Step {practiceTourStep + 1}/
              {MODULE2_PRACTICE_TOUR_STEPS.length}
            </p>
            <p className="mt-2 text-sm font-semibold text-slate-900">
              {currentPracticeTourStep.title}
            </p>
            <p className="mt-1 text-xs text-slate-600">
              {currentPracticeTourStep.message}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  void dismissPracticeTour();
                }}
                className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:border-slate-300 hover:text-slate-800"
              >
                Skip
              </button>
              {practiceTourStep > 0 && (
                <button
                  type="button"
                  onClick={() => setPracticeTourStep((prev) => Math.max(0, prev - 1))}
                  className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:border-slate-300 hover:text-slate-800"
                >
                  Back
                </button>
              )}
              {practiceTourStep < practiceTourLastStep ? (
                <button
                  type="button"
                  onClick={() =>
                    setPracticeTourStep((prev) => Math.min(practiceTourLastStep, prev + 1))
                  }
                  className="rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-500"
                >
                  Next
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    void dismissPracticeTour();
                  }}
                  className="rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-500"
                >
                  Done
                </button>
              )}
            </div>
          </div>
        </>
      )}
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
              but predictions are hidden. Each word ends when you complete it
              or the timer runs out.
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
          stay visible, but predictions stay hidden. The sprint continues until
          all 5 words are scored.
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
