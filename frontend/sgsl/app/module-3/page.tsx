'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import DynamicSignPractice from '@/components/DynamicSignPractice';
import ModuleNav from '@/components/ModuleNav';
import { useUserProgress } from '@/hooks/useUserProgress';
import { hasCompletedOnboarding } from '@/lib/onboarding';

type LessonType = 'teaching' | 'practice' | 'testing';

interface Lesson {
  id: string;
  title: string;
  type: LessonType;
  description: string;
}

const lessons: Lesson[] = [
  {
    id: 'intro',
    title: 'Welcome to Dynamic Vocabulary',
    type: 'teaching',
    description:
      'What changes when signs include movement, and how this module works.',
  },
  {
    id: 'learn',
    title: 'Learn: Book, Drink, Go',
    type: 'teaching',
    description:
      'Watch each sign and learn the key motion cues.',
  },
  {
    id: 'guided-practice',
    title: 'Practice: One word at a time',
    type: 'practice',
    description:
      'Build consistency with focused repetitions and AI feedback.',
  },
  {
    id: 'mixed-practice',
    title: 'Practice: Mixed recall',
    type: 'practice',
    description:
      'Switch targets quickly so you can produce each word on demand.',
  },
  {
    id: 'final-test',
    title: 'Test: 3-word mastery check',
    type: 'testing',
    description:
      'Get 3/3 correct to complete the module.',
  },
];

const MODULE_THREE_WORDS = ['book', 'drink', 'go'] as const;
type ModuleThreeWord = (typeof MODULE_THREE_WORDS)[number];

const WORD_GUIDES: Record<
  ModuleThreeWord,
  {
    label: string;
    cues: string[];
  }
> = {
  book: {
    label: 'BOOK',
    cues: ['Hands form a “book” and open like pages.', 'Keep the motion clean and centered.'],
  },
  drink: {
    label: 'DRINK',
    cues: ['Hand moves toward the mouth like taking a sip.', 'Pause briefly at the start and end.'],
  },
  go: {
    label: 'GO',
    cues: ['Movement travels forward away from the body.', 'Avoid tiny motion: make the path clear.'],
  },
};

function wordGifSrc(word: ModuleThreeWord) {
  // Assumes gifs exist at /public/images/{word}.gif (e.g. /images/book.gif).
  return `/images/${word}.gif`;
}

export default function ModuleThreePage() {
  const router = useRouter();
  const [currentLessonId, setCurrentLessonId] = useState<string>(lessons[0].id);
  const { profile, loading, completeLesson } = useUserProgress();
  const completedLessons = profile?.completedLessons ?? [];

  const currentLesson =
    lessons.find((l) => l.id === currentLessonId) ?? lessons[0];

  const completedCount = lessons.filter((lesson) =>
    completedLessons.includes(`module3-${lesson.id}`),
  ).length;
  const moduleProgress = Math.round((completedCount / lessons.length) * 100);

  const isCompleted = completedLessons.includes(`module3-${currentLesson.id}`);

  const nextLessonId = useMemo(() => {
    const index = lessons.findIndex((lesson) => lesson.id === currentLesson.id);
    return index >= 0 ? lessons[index + 1]?.id ?? null : null;
  }, [currentLesson.id]);

  function markLessonComplete() {
    completeLesson(`module3-${currentLesson.id}`, 50);
  }

  useEffect(() => {
    if (loading) return;
    if (!profile) return;
    if (hasCompletedOnboarding(profile)) return;
    router.replace(`/onboarding?next=${encodeURIComponent('/module-3')}`);
  }, [loading, profile, router]);

  return (
    <>
      <ModuleNav currentModule={3} />
      <div className="min-h-screen bg-slate-50 text-slate-900 flex">
        <aside className="hidden md:flex w-72 flex-col border-r border-slate-200 bg-white">
        <div className="px-5 py-4 border-b border-slate-200">
          <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
            Module 3
          </p>
          <h1 className="mt-1 text-sm font-semibold">
            SgSL Simple Vocabulary
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Learn everyday vocabulary signs with short practice clips and AI feedback.
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
            const done = completedLessons.includes(`module3-${lesson.id}`);

            const badgeLabel =
              lesson.type === 'teaching'
                ? 'Teaching'
                : lesson.type === 'practice'
                  ? 'Practice'
                  : 'Testing';

            const badgeClasses =
              lesson.type === 'teaching'
                ? 'border-amber-400/50 text-amber-300'
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
              Module 3 · Simple Vocabulary
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
          {currentLesson.id === 'intro' && (
            <IntroLessonContent
              key={currentLesson.id}
              onComplete={markLessonComplete}
              isCompleted={isCompleted}
            />
          )}

          {currentLesson.id === 'learn' && (
            <LearnLessonContent
              key={currentLesson.id}
              onComplete={markLessonComplete}
              isCompleted={isCompleted}
            />
          )}

          {currentLesson.id === 'guided-practice' && (
            <GuidedPracticeContent
              key={currentLesson.id}
              onComplete={markLessonComplete}
              isCompleted={isCompleted}
            />
          )}

          {currentLesson.id === 'mixed-practice' && (
            <MixedPracticeContent
              key={currentLesson.id}
              onComplete={markLessonComplete}
              isCompleted={isCompleted}
            />
          )}

          {currentLesson.id === 'final-test' && (
            <FinalTestContent
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

function IntroLessonContent({
  onComplete,
  isCompleted,
}: {
  onComplete: () => void;
  isCompleted: boolean;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const completedRef = useRef(false);

  useEffect(() => {
    completedRef.current = false;
  }, []);

  function handleScroll() {
    const el = containerRef.current;
    if (!el) return;
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 24;
    if (atBottom && !completedRef.current && !isCompleted) {
      completedRef.current = true;
      onComplete();
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-1">
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="max-h-[72vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 md:p-6 space-y-6"
      >
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
            Before you start
          </p>
          <h3 className="mt-2 text-xl font-semibold text-slate-900">
            Dynamic signs are about motion, not just shape
          </h3>
          <p className="mt-2 text-sm text-slate-600">
            In Module 1 and 2, you could often “hold” a pose and get feedback.
            Here, the model judges a short motion sequence. Your start position,
            movement path, and end position matter.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-semibold text-slate-900">
            The recording rule
          </p>
          <p className="mt-1 text-sm text-slate-600">
            Record one clear sign per clip. Aim for a steady 3–5 seconds:
            brief pause → motion → brief pause.
          </p>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-900">
            Camera setup (for best recognition)
          </p>
          <ul className="list-disc pl-5 text-sm text-slate-600 space-y-1">
            <li>Keep your full signing hand visible (and ideally some forearm).</li>
            <li>Avoid backlighting. Face a light source, don’t sit in front of a window.</li>
            <li>Stay centered and keep a consistent distance to the camera.</li>
          </ul>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-900">
            What you’ll learn
          </p>
          <p className="text-sm text-slate-600">
            You will learn three starter words that are visually distinct:
          </p>
          <div className="flex flex-wrap gap-2">
            {MODULE_THREE_WORDS.map((w) => (
              <span
                key={w}
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700"
              >
                {WORD_GUIDES[w].label}
              </span>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-900">
            Completion logic
          </p>
          <ul className="list-disc pl-5 text-sm text-slate-600 space-y-1">
            <li>Learn lesson: open each word guide at least once.</li>
            <li>Guided practice: get multiple correct predictions per word.</li>
            <li>Mixed practice: switch targets and prove you can recall on demand.</li>
            <li>Final test: 3/3 correct.</li>
          </ul>
        </div>

        <div className="pt-4 border-t border-slate-100">
          <p className="text-xs text-slate-500">
            Scroll to the end to complete this intro.
          </p>
        </div>
      </div>
    </div>
  );
}

function LearnLessonContent({
  onComplete,
  isCompleted,
}: {
  onComplete: () => void;
  isCompleted: boolean;
}) {
  const [active, setActive] = useState<ModuleThreeWord>('book');
  const [visited, setVisited] = useState<Set<ModuleThreeWord>>(
    () => new Set(['book']),
  );
  const completedRef = useRef(false);

  useEffect(() => {
    setVisited(new Set(['book']));
    completedRef.current = false;
  }, []);

  useEffect(() => {
    if (isCompleted) return;
    if (completedRef.current) return;
    if (visited.size >= MODULE_THREE_WORDS.length) {
      completedRef.current = true;
      onComplete();
    }
  }, [visited, isCompleted, onComplete]);

  function selectWord(word: ModuleThreeWord) {
    setActive(word);
    setVisited((prev) => {
      const next = new Set(prev);
      next.add(word);
      return next;
    });
  }

  const guide = WORD_GUIDES[active];

  return (
    <div className="grid gap-6 lg:grid-cols-1">
      <div className="mx-auto w-full max-w-4xl rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
              Word guide
            </p>
            <h3 className="mt-1 text-lg font-semibold text-slate-900">
              {guide.label}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            {MODULE_THREE_WORDS.map((w) => {
              const isActive = w === active;
              const isSeen = visited.has(w);
              return (
                <button
                  key={w}
                  type="button"
                  onClick={() => selectWord(w)}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                    isActive
                      ? 'border-blue-300 bg-blue-50 text-blue-700'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                  }`}
                >
                  {WORD_GUIDES[w].label}
                  {isSeen ? ' ✓' : ''}
                </button>
              );
            })}
          </div>
        </div>

        <div className="aspect-video bg-slate-50 flex items-center justify-center p-6">
          <img
            src={wordGifSrc(active)}
            alt={`Guide for ${guide.label}`}
            className="h-full w-full max-w-3xl object-contain"
          />
        </div>

        <div className="p-4 md:p-5 text-sm text-slate-600 space-y-2">
          <p className="font-semibold text-slate-900">What to look for</p>
          <ul className="list-disc pl-5 space-y-1 text-slate-600">
            {guide.cues.map((cue) => (
              <li key={cue}>{cue}</li>
            ))}
          </ul>
          <p className="text-xs text-slate-500">
            Completion: open each of the three word guides once.
          </p>
        </div>
      </div>
    </div>
  );
}

function GuidedPracticeContent({
  onComplete,
  isCompleted,
}: {
  onComplete: () => void;
  isCompleted: boolean;
}) {
  const REQUIRED_REPS = 3;
  const MIN_SCORE = 0.55;

  const [target, setTarget] = useState<ModuleThreeWord>('book');
  const [showGuide, setShowGuide] = useState(true);
  const [counts, setCounts] = useState<Record<ModuleThreeWord, number>>({
    book: 0,
    drink: 0,
    go: 0,
  });
  const [feedback, setFeedback] = useState('Record a clip to get feedback.');
  const completedRef = useRef(false);

  useEffect(() => {
    setTarget('book');
    setShowGuide(true);
    setCounts({ book: 0, drink: 0, go: 0 });
    setFeedback('Record a clip to get feedback.');
    completedRef.current = false;
  }, []);

  useEffect(() => {
    if (isCompleted) return;
    if (completedRef.current) return;
    const allDone = MODULE_THREE_WORDS.every((w) => counts[w] >= REQUIRED_REPS);
    if (allDone) {
      completedRef.current = true;
      onComplete();
    }
  }, [counts, isCompleted, onComplete]);

  function pickNextTarget(nextCounts: Record<ModuleThreeWord, number>) {
    const remaining = MODULE_THREE_WORDS.filter(
      (w) => nextCounts[w] < REQUIRED_REPS,
    );
    if (remaining.length === 0) return;
    setTarget(remaining[0]);
  }

  function handlePrediction(result: { top10: { label: string; score: number }[] }) {
    const top1 = result.top10[0];
    if (!top1) {
      setFeedback('No prediction returned. Try again.');
      return;
    }
    const predicted = top1.label as ModuleThreeWord;
    const score = top1.score ?? 0;

    if (predicted === target && score >= MIN_SCORE) {
      setCounts((prev) => {
        const next = { ...prev, [target]: Math.min(REQUIRED_REPS, prev[target] + 1) };
        const done = next[target] >= REQUIRED_REPS;
        setFeedback(
          done
            ? `${WORD_GUIDES[target].label} mastered. Move to the next word.`
            : `Good! ${WORD_GUIDES[target].label} +1`,
        );
        if (done) pickNextTarget(next);
        return next;
      });
    } else {
      setFeedback(
        `Detected ${predicted.toUpperCase()} (${(score * 100).toFixed(1)}%). Try ${WORD_GUIDES[target].label} again.`,
      );
    }
  }

  const masteredCount = MODULE_THREE_WORDS.filter((w) => counts[w] >= REQUIRED_REPS).length;

  return (
    <div
      className={`grid gap-6 ${
        showGuide ? 'lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]' : 'grid-cols-1'
      }`}
    >
      <div className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
              Guided practice
            </p>
            <h3 className="mt-2 text-xl font-semibold text-slate-900">
              Target: {WORD_GUIDES[target].label}
            </h3>
            <p className="mt-1 text-xs text-slate-500">{feedback}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {MODULE_THREE_WORDS.map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => setTarget(w)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                  w === target
                    ? 'border-blue-300 bg-blue-50 text-blue-700'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                }`}
              >
                {WORD_GUIDES[w].label}
              </button>
            ))}
          </div>
        </div>

        {!showGuide && (
          <div className="mt-2 flex items-center justify-end">
            <button
              type="button"
              onClick={() => setShowGuide(true)}
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:border-slate-300"
            >
              Show guide
            </button>
          </div>
        )}

        <div className="mt-4">
          <DynamicSignPractice
            focusWords={[...MODULE_THREE_WORDS]}
            onPrediction={handlePrediction}
          />
        </div>
      </div>

      {showGuide && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5 text-xs text-slate-600 space-y-4">
          <div>
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                Guide: {WORD_GUIDES[target].label}
              </p>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-700 hover:border-slate-300"
              >
                Hide guide
              </button>
            </div>
            <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
              <div className="aspect-video flex items-center justify-center">
                <img
                  src={wordGifSrc(target)}
                  alt={`Guide for ${WORD_GUIDES[target].label}`}
                  className="h-full w-full object-contain"
                />
              </div>
            </div>
          </div>

          <div>
            <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
              Mastery targets
            </p>
            <div className="mt-2 space-y-2">
              {MODULE_THREE_WORDS.map((w) => {
                const count = counts[w];
                const done = count >= REQUIRED_REPS;
                return (
                  <div key={w} className="flex items-center justify-between">
                    <span className="font-semibold text-slate-900">
                      {WORD_GUIDES[w].label}
                    </span>
                    <span
                      className={`text-[11px] font-semibold ${
                        done ? 'text-emerald-600' : 'text-slate-500'
                      }`}
                    >
                      {count}/{REQUIRED_REPS}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
              Completed:{' '}
              <span className="font-semibold text-slate-900">{masteredCount}/3</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MixedPracticeContent({
  onComplete,
  isCompleted,
}: {
  onComplete: () => void;
  isCompleted: boolean;
}) {
  const REQUIRED_PER_WORD = 2;
  const MIN_SCORE = 0.55;

  const [target, setTarget] = useState<ModuleThreeWord>('book');
  const [showGuide, setShowGuide] = useState(true);
  const [counts, setCounts] = useState<Record<ModuleThreeWord, number>>({
    book: 0,
    drink: 0,
    go: 0,
  });
  const [feedback, setFeedback] = useState('Record a clip to start.');
  const completedRef = useRef(false);

  useEffect(() => {
    setTarget('book');
    setShowGuide(true);
    setCounts({ book: 0, drink: 0, go: 0 });
    setFeedback('Record a clip to start.');
    completedRef.current = false;
  }, []);

  function pickNext(nextCounts: Record<ModuleThreeWord, number>, prevTarget: ModuleThreeWord) {
    const remaining = MODULE_THREE_WORDS.filter(
      (w) => nextCounts[w] < REQUIRED_PER_WORD,
    );
    const pool = remaining.length ? remaining : [...MODULE_THREE_WORDS];
    let next = prevTarget;
    let guard = 0;
    while (next === prevTarget && guard < 10) {
      next = pool[Math.floor(Math.random() * pool.length)];
      guard += 1;
    }
    setTarget(next);
  }

  useEffect(() => {
    if (isCompleted) return;
    if (completedRef.current) return;
    const allDone = MODULE_THREE_WORDS.every((w) => counts[w] >= REQUIRED_PER_WORD);
    if (allDone) {
      completedRef.current = true;
      onComplete();
    }
  }, [counts, isCompleted, onComplete]);

  function handlePrediction(result: { top10: { label: string; score: number }[] }) {
    const top1 = result.top10[0];
    if (!top1) {
      setFeedback('No prediction returned. Try again.');
      return;
    }
    const predicted = top1.label as ModuleThreeWord;
    const score = top1.score ?? 0;

    if (predicted === target && score >= MIN_SCORE) {
      setCounts((prev) => {
        const next = { ...prev, [target]: Math.min(REQUIRED_PER_WORD, prev[target] + 1) };
        setFeedback(`Correct: ${WORD_GUIDES[target].label}`);
        pickNext(next, target);
        return next;
      });
    } else {
      setFeedback(
        `Detected ${predicted.toUpperCase()} (${(score * 100).toFixed(1)}%). Try ${WORD_GUIDES[target].label} again.`,
      );
    }
  }

  const totalDone = MODULE_THREE_WORDS.reduce((sum, w) => sum + Math.min(counts[w], REQUIRED_PER_WORD), 0);
  const totalRequired = REQUIRED_PER_WORD * MODULE_THREE_WORDS.length;

  return (
    <div
      className={`grid gap-6 ${
        showGuide ? 'lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]' : 'grid-cols-1'
      }`}
    >
      <div className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
              Mixed recall
            </p>
            <h3 className="mt-2 text-xl font-semibold text-slate-900">
              Target: {WORD_GUIDES[target].label}
            </h3>
            <p className="mt-1 text-xs text-slate-500">{feedback}</p>
          </div>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold text-slate-700">
            Progress {totalDone}/{totalRequired}
          </span>
        </div>

        {!showGuide && (
          <div className="mt-2 flex items-center justify-end">
            <button
              type="button"
              onClick={() => setShowGuide(true)}
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:border-slate-300"
            >
              Show guide
            </button>
          </div>
        )}

        <div className="mt-4">
          <DynamicSignPractice
            focusWords={[...MODULE_THREE_WORDS]}
            onPrediction={handlePrediction}
          />
        </div>
      </div>

      {showGuide && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5 text-xs text-slate-600 space-y-4">
          <div>
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                Guide: {WORD_GUIDES[target].label}
              </p>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-700 hover:border-slate-300"
              >
                Hide guide
              </button>
            </div>
            <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
              <div className="aspect-video flex items-center justify-center">
                <img
                  src={wordGifSrc(target)}
                  alt={`Guide for ${WORD_GUIDES[target].label}`}
                  className="h-full w-full object-contain"
                />
              </div>
            </div>
          </div>

          <div>
            <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
              Requirements
            </p>
            <p className="mt-1 text-sm text-slate-600">
              Get each word correct {REQUIRED_PER_WORD} times. The target changes so you
              can’t “camp” one motion.
            </p>
            <div className="mt-2 space-y-2">
              {MODULE_THREE_WORDS.map((w) => (
                <div key={w} className="flex items-center justify-between">
                  <span className="font-semibold text-slate-900">
                    {WORD_GUIDES[w].label}
                  </span>
                  <span className="text-[11px] font-semibold text-slate-600">
                    {Math.min(counts[w], REQUIRED_PER_WORD)}/{REQUIRED_PER_WORD}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FinalTestContent({
  onComplete,
  isCompleted,
}: {
  onComplete: () => void;
  isCompleted: boolean;
}) {
  const MIN_SCORE = 0.55;

  type Result = { word: ModuleThreeWord; attempts: number; passed: boolean };
  const [testState, setTestState] = useState<'idle' | 'running' | 'finished'>(
    'idle',
  );
  const [order, setOrder] = useState<ModuleThreeWord[]>([...MODULE_THREE_WORDS]);
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<Result[]>([]);
  const [feedback, setFeedback] = useState('Record a clip to answer.');
  const completedRef = useRef(false);

  function shuffle<T>(list: T[]) {
    const arr = [...list];
    for (let i = arr.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function start() {
    const nextOrder = shuffle(MODULE_THREE_WORDS);
    setOrder(nextOrder);
    setIndex(0);
    setResults(
      nextOrder.map((w) => ({ word: w, attempts: 0, passed: false })),
    );
    setFeedback('Record a clip to answer.');
    completedRef.current = false;
    setTestState('running');
  }

  const target = order[index] ?? order[0] ?? 'book';

  useEffect(() => {
    if (testState !== 'finished') return;
    if (isCompleted) return;
    if (completedRef.current) return;
    const allPassed = results.length > 0 && results.every((r) => r.passed);
    if (allPassed) {
      completedRef.current = true;
      onComplete();
    }
  }, [testState, results, isCompleted, onComplete]);

  function handlePrediction(result: { top10: { label: string; score: number }[] }) {
    if (testState !== 'running') return;
    const top1 = result.top10[0];
    if (!top1) {
      setFeedback('No prediction returned. Try again.');
      return;
    }
    const predicted = top1.label as ModuleThreeWord;
    const score = top1.score ?? 0;

    setResults((prev) => {
      const next = prev.map((r, idx) => {
        if (idx !== index) return r;
        const attempts = r.attempts + 1;
        const passed = predicted === target && score >= MIN_SCORE;
        return { ...r, attempts, passed: r.passed || passed };
      });
      const passedNow = predicted === target && score >= MIN_SCORE;
      setFeedback(
        passedNow
          ? `Correct: ${WORD_GUIDES[target].label}`
          : `Detected ${predicted.toUpperCase()} (${(score * 100).toFixed(1)}%). Try again.`,
      );

      if (passedNow) {
        window.setTimeout(() => {
          setIndex((prevIndex) => {
            const nextIndex = prevIndex + 1;
            if (nextIndex >= order.length) {
              setTestState('finished');
              return prevIndex;
            }
            setFeedback('Record a clip to answer.');
            return nextIndex;
          });
        }, 200);
      }

      return next;
    });
  }

  const passedCount = results.filter((r) => r.passed).length;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
        {testState === 'idle' ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center">
            <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
              Ready?
            </p>
            <p className="mt-3 text-3xl font-semibold text-slate-900">
              3-word mastery check
            </p>
            <p className="mt-2 text-sm text-slate-500">
              Record each prompted word until it is recognised correctly.
            </p>
            <button
              type="button"
              onClick={start}
              className="mt-4 inline-flex items-center rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
            >
              Start test
            </button>
          </div>
        ) : testState === 'running' ? (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
                  Target word
                </p>
                <h3 className="mt-2 text-3xl font-semibold tracking-[0.18em] text-slate-900">
                  {WORD_GUIDES[target].label}
                </h3>
                <p className="mt-1 text-xs text-slate-500">{feedback}</p>
              </div>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold text-slate-700">
                {index + 1}/{order.length}
              </span>
            </div>

            <div className="mt-4">
              <DynamicSignPractice
                focusWords={[...MODULE_THREE_WORDS]}
                onPrediction={handlePrediction}
              />
            </div>
          </>
        ) : (
          <div className="space-y-4">
            <p className="text-sm font-semibold text-slate-900">
              Score: {passedCount}/{results.length} words
            </p>
            <div className="flex flex-wrap gap-2">
              {results.map((r) => (
                <span
                  key={r.word}
                  className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${
                    r.passed
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'border-rose-200 bg-rose-50 text-rose-700'
                  }`}
                >
                  {WORD_GUIDES[r.word].label} {r.passed ? '✓' : '✗'} · {r.attempts} tries
                </span>
              ))}
            </div>
            <button
              type="button"
              onClick={start}
              className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:border-slate-300"
            >
              Retry test
            </button>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5 text-xs text-slate-600 space-y-3">
        <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
          Test rules
        </p>
        <ul className="list-disc pl-4 space-y-1 text-slate-500">
          <li>One sign per clip (pause → motion → pause).</li>
          <li>Keep the motion visible and centered.</li>
          <li>You must clear all three words (3/3) to complete.</li>
        </ul>
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
          Status:{' '}
          <span className="font-semibold text-slate-900">
            {isCompleted ? 'Completed' : testState === 'finished' ? 'Finished' : 'In progress'}
          </span>
        </div>
      </div>
    </div>
  );
}
