'use client';

import { useState } from 'react';
import Script from 'next/script';
import StaticLetterPractice from '@/components/StaticLetterPractice';

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
    title: 'Alphabet signing basics',
    type: 'teaching',
    description:
      'Overview of hand positioning and alphabet signing (fingerspelling)',
  },
  {
    id: 'teach-a-d',
    title: 'Teaching: Letters A–D',
    type: 'teaching',
    description:
      'Video walkthrough of handshapes and common mistakes for letters A–D.',
  },
  {
    id: 'practice-a-d',
    title: 'Practice: Letters A–D',
    type: 'practice',
    description:
      'Use the webcam and AI feedback to practise static signs A–D.',
  },
  {
    id: 'teach-e-h',
    title: 'Teaching: Letters E–F',
    type: 'teaching',
    description:
      'Video walkthrough of handshapes and common mistakes for letters E–F.',
  },
  {
    id: 'practice-e-h',
    title: 'Practice: Letters E–F',
    type: 'practice',
    description:
      'Use the webcam and AI feedback to practise static signs E–F.',
  },
  {
    id: 'quiz-a-h',
    title: 'Quiz: Letters A–F',
    type: 'testing',
    description:
      'Timed quiz where you sign random letters A–F to test recall.',
  },
];

export default function ModuleOnePage() {
  const [currentLessonId, setCurrentLessonId] = useState<string>(lessons[0].id);
  const [completed, setCompleted] = useState<string[]>([]);

  const currentLesson =
    lessons.find((l) => l.id === currentLessonId) ?? lessons[0];

  const moduleProgress = Math.round(
    (completed.length / lessons.length) * 100
  );

  const isCompleted = completed.includes(currentLesson.id);

  function markLessonComplete() {
    setCompleted((prev) =>
      prev.includes(currentLesson.id) ? prev : [...prev, currentLesson.id],
    );
  }

  return (
    <>
      {/* Load Mediapipe like index_seq.html */}
      <Script
        src="https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js"
        strategy="afterInteractive"
      />
      <Script
        src="https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js"
        strategy="afterInteractive"
      />

      <div className="min-h-screen bg-slate-50 text-slate-900 flex">
        {/* LHS: module nav + progress */}
        <aside className="hidden md:flex w-72 flex-col border-r border-slate-200 bg-white">
          <div className="px-5 py-4 border-b border-slate-200">
            <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
              Module 1
            </p>
            <h1 className="mt-1 text-sm font-semibold">
              SgSL Static Letters
            </h1>
            <p className="mt-1 text-xs text-slate-500">
              Learn static letters A to F through teaching, practice, and
              testing.
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
              const done = completed.includes(lesson.id);

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

        {/* RHS: main lesson content */}
        <main className="flex-1 flex flex-col">
          {/* Lesson header */}
          <header className="border-b border-slate-200 bg-white/80 backdrop-blur px-4 py-3 flex items-center justify-between">
            <div className="flex flex-col">
              <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                Module 1 · Static letters
              </p>
              <h2 className="mt-1 text-sm font-semibold text-slate-900">
                {currentLesson.title}
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                {currentLesson.description}
              </p>
            </div>

            <div className="hidden md:flex items-center gap-3 text-[11px]">
              <span
                className={`inline-flex items-center rounded-full border px-3 py-1 ${
                  currentLesson.type === 'teaching'
                    ? 'border-amber-400/60 text-amber-200'
                    : currentLesson.type === 'practice'
                    ? 'border-emerald-400/60 text-emerald-200'
                    : 'border-sky-400/60 text-sky-200'
                }`}
              >
                {currentLesson.type.toUpperCase()}
              </span>
              <span className="text-slate-500">
                {completed.length}/{lessons.length} lessons completed
              </span>
            </div>
          </header>

          <section className="flex-1 overflow-y-auto p-4 md:p-6">
            {currentLesson.type === 'teaching' && (
              <TeachingLessonContent
                lessonId={currentLesson.id}
                onComplete={markLessonComplete}
                isCompleted={isCompleted}
              />
            )}

            {currentLesson.type === 'practice' && (
              <PracticeLessonContent
                lessonId={currentLesson.id}
                onComplete={markLessonComplete}
                isCompleted={isCompleted}
              />
            )}

            {currentLesson.type === 'testing' && (
              <TestingLessonContent
                onComplete={markLessonComplete}
                isCompleted={isCompleted}
              />
            )}
          </section>
        </main>
      </div>
    </>
  );
}

/* ---------- Teaching content ---------- */

function TeachingLessonContent({
  lessonId,
  onComplete,
  isCompleted,
}: {
  lessonId: string;
  onComplete: () => void;
  isCompleted: boolean;
}) {
  // Swap these with your real SgSL teaching videos
  const videoId =
    lessonId === 'intro'
      ? 'DBQINq0SsAw?si=1Oftfvtm3qn3w-Ut&amp;clip=UgkxaON_0Wj5d8piCVI2q6dDPfTPiH9JO2W2&amp;clipt=EPCrARiEyQM' // placeholder
      : lessonId === 'teach-a-d'
      ? 'DBQINq0SsAw?si=tZllQiiMEZYEVmOU&amp;clip=Ugkx7cEKO3ZTTo27qlsNN9NcvNklbA2ALyfg&amp;clipt=EOj7Axjo8gY' // placeholder for A–D
      : 'DBQINq0SsAw?si=PoE9uRT9NVfcjMsS&amp;clip=UgkxQuAYnAGRo1WBv9OVv7IR-csWlPmu6x_F&amp;clipt=END6BhiY3Qg'; // placeholder for E–H

  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <div className="aspect-video bg-white/80">
          <iframe
            src={`https://www.youtube.com/embed/${videoId}`}
            title="SgSL teaching video"
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          />
        </div>
        <div className="p-4 md:p-5 text-xs md:text-sm text-slate-600 space-y-2">
          <p className="font-semibold text-slate-900">
            Watch this short video before moving on.
          </p>
          <p>
            Focus on posture, hand orientation, and facial expressions. For
            letters A–H, pay attention to thumb position and finger curl.
          </p>
          <ul className="list-disc pl-4 space-y-1 text-slate-500">
            <li>Pause the video and copy each sign slowly.</li>
            <li>Practise in front of your webcam or a mirror.</li>
            <li>When comfortable, move on to the practice lesson.</li>
          </ul>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3 text-xs text-slate-600">
        <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
          Lesson notes
        </p>
        <p>
          This teaching segment ensures you know what the correct handshapes
          look like before the AI starts judging you.
        </p>
        <p>
          Spend 5–10 minutes watching and copying the signs. When you’re done,
          mark this lesson as complete.
        </p>
        <button
          onClick={onComplete}
          className="mt-2 inline-flex items-center justify-center rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400 transition"
        >
          {isCompleted ? 'Lesson completed ✓' : 'Mark lesson as complete'}
        </button>
      </div>
    </div>
  );
}

/* ---------- Practice content ---------- */

function PracticeLessonContent({
  lessonId,
  onComplete,
  isCompleted,
}: {
  lessonId: string;
  onComplete: () => void;
  isCompleted: boolean;
}) {
  const letters =
    lessonId === 'practice-a-d' ? ['A', 'B', 'C', 'D'] : ['E', 'F'];

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
        <h3 className="text-sm font-semibold mb-2">
          Webcam practice · Letters {letters[0]}–{letters[letters.length - 1]}
        </h3>
        <p className="text-xs text-slate-500 mb-3">
          Position your dominant hand within the frame and slowly sign the
          letters {letters.join(', ')}. 
          The AI model predicts the letter in real time based on hand landmarks.
        </p>
        <StaticLetterPractice allowedLetters={letters} />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5 text-xs text-slate-600 space-y-3">
        <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
          Practice tips
        </p>
        <ul className="list-disc pl-4 space-y-1 text-slate-500">
          <li>Keep your hand roughly in the centre of the frame.</li>
          <li>Ensure good lighting; avoid heavy backlighting.</li>
          <li>Hold each sign steady for 1–2 seconds.</li>
          <li>Try not to hide fingers behind your palm.</li>
        </ul>
        <p>
          Once you can consistently produce each letter in this range and see it
          predicted correctly by the model, mark this lesson as complete.
        </p>
        <button
          onClick={onComplete}
          className="mt-2 inline-flex items-center justify-center rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400 transition"
        >
          {isCompleted ? 'Lesson completed ✓' : 'Mark lesson as complete'}
        </button>
      </div>
    </div>
  );
}

/* ---------- Testing content (quiz) ---------- */

/* ---------- Testing content (quiz) ---------- */

/* ---------- Testing content (quiz) ---------- */

function TestingLessonContent({
  onComplete,
  isCompleted,
}: {
  onComplete: () => void;
  isCompleted: boolean;
}) {
  const allLetters = ['A', 'B', 'C', 'D', 'E', 'F'];

  const [target, setTarget] = useState<string>(
    allLetters[Math.floor(Math.random() * allLetters.length)],
  );
  const [lastLetter, setLastLetter] = useState<string | null>(null);

  const [clearedLetters, setClearedLetters] = useState<Set<string>>(
    () => new Set(),
  );
  const [correctFrames, setCorrectFrames] = useState(0);
  const [targetSinceTs, setTargetSinceTs] = useState<number>(() => Date.now());

  // knobs – tweak these if needed
  const REQUIRED_FRAMES = 8; // how many consecutive "correct" frames to pass a letter
  const MIN_DELAY_AFTER_TARGET_MS = 500; // ignore hits in the first 0.5s after target appears

  function pickNextTarget(prevTarget: string, cleared: Set<string>): string {
    const remaining = allLetters.filter((L) => !cleared.has(L));
    const pool = remaining.length > 0 ? remaining : allLetters;

    let next = prevTarget;
    let guard = 0;
    while (next === prevTarget && guard < 10) {
      next = pool[Math.floor(Math.random() * pool.length)];
      guard += 1;
    }
    return next;
  }

function handlePrediction(letter: string) {
  const now = Date.now();
  setLastLetter(letter || null);

  // 🔍 Debug every prediction
  console.log(
    `[QUIZ DEBUG] predicted="${letter}", target="${target}", ` +
      `correctFrames=${correctFrames}, cleared=[${[...clearedLetters].join(',')}], ` +
      `dtTarget=${now - targetSinceTs}ms`
  );

  if (!letter) {
    console.log('[QUIZ DEBUG] → empty prediction, resetting streak');
    setCorrectFrames(0);
    return;
  }

  if (letter !== target) {
    console.log(
      `[QUIZ DEBUG] → mismatch (pred=${letter}, target=${target}), resetting streak`
    );
    setCorrectFrames(0);
    return;
  }

  if (now - targetSinceTs < MIN_DELAY_AFTER_TARGET_MS) {
    console.log(
      `[QUIZ DEBUG] → stale frame ignored (${now - targetSinceTs}ms < ${MIN_DELAY_AFTER_TARGET_MS}ms)`
    );
    return;
  }

  setCorrectFrames((prev) => {
    const next = prev + 1;
    console.log(`[QUIZ DEBUG] → correct frame! streak ${prev} → ${next}`);

    if (next < REQUIRED_FRAMES) return next;

    // passed the letter
    console.log(`[QUIZ DEBUG] → letter ${target} CLEARED`);

    setClearedLetters((prevCleared) => {
      const newSet = new Set(prevCleared);
      newSet.add(target);

      const allDone = newSet.size >= allLetters.length;
      if (allDone) {
        console.log('[QUIZ DEBUG] → ALL LETTERS CLEARED! Calling onComplete()');
        onComplete();
      }

      const nextTarget = pickNextTarget(target, newSet);
      console.log(`[QUIZ DEBUG] → next target = ${nextTarget}`);

      setTarget(nextTarget);
      setTargetSinceTs(Date.now());
      return newSet;
    });

    return 0;
  });
}


  const progressFraction = clearedLetters.size / allLetters.length;
  const progressPercent = Math.round(progressFraction * 100);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
        <h3 className="text-sm font-semibold mb-2">
          Quiz: Sign the prompted letter
        </h3>
        <p className="text-xs text-slate-500 mb-3">
          You will see a random letter between A and H. Sign it clearly and hold
          it steady. When the model recognises it correctly for a short burst of
          frames, a new letter will appear. Aim to clear all letters at least once.
        </p>

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/80 px-4 py-3">
            <span className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
              Current target
            </span>
            <span className="text-3xl font-semibold tracking-[0.3em] text-slate-900">
              {target}
            </span>
          </div>

          <div className="flex flex-col text-[11px] text-slate-500">
            <span>
              Consecutive correct frames:{' '}
              <span className="font-semibold text-emerald-300">
                {correctFrames}/{REQUIRED_FRAMES}
              </span>
            </span>
            <span>
              Letters cleared:{' '}
              <span className="font-semibold text-emerald-300">
                {clearedLetters.size}/{allLetters.length}
              </span>
            </span>
          </div>
        </div>

        <StaticLetterPractice
          allowedLetters={allLetters}
          onConfidentPrediction={handlePrediction}
        />

        <p className="mt-3 text-[11px] text-slate-500">
          Latest recognised:{' '}
          <span className="font-semibold">{lastLetter ?? '—'}</span>
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5 text-xs text-slate-600 space-y-3">
        <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
          Finishing Module 1
        </p>
        <p>
          This quiz focuses on quick, stable recall. You’ll need to hold each
          prompted letter steadily for a short burst of frames before it counts.
          One continuous sign cannot clear multiple letters in a row.
        </p>
        <p>
          Try to clear all letters from A to F at least once. When you have done
          so, this lesson will automatically be marked as complete, or you can
          confirm manually below.
        </p>

        <div className="mt-2">
          <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
            <span>Quiz coverage</span>
            <span className="font-semibold text-slate-900">
              {progressPercent}% · {clearedLetters.size}/{allLetters.length} letters
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-sky-400 transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        <button
          onClick={onComplete}
          className="mt-3 inline-flex items-center justify-center rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400 transition"
        >
          {isCompleted ? 'Lesson completed ✓' : 'Mark lesson as complete'}
        </button>
      </div>
    </div>
  );
}
