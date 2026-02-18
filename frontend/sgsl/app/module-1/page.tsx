'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Script from 'next/script';
import { useRouter } from 'next/navigation';
import StaticLetterPractice from '@/components/StaticLetterPractice';
import ModuleNav from '@/components/ModuleNav';
import IntroLessonView from '@/components/IntroLessonView';
import { useUserProgress } from '@/hooks/useUserProgress';
import { MODULE1_LESSON_TOUR_VERSION } from '@/lib/module1Tour';
import { hasCompletedOnboarding } from '@/lib/onboarding';
import {
  MODULE_ONE_LESSONS,
  LessonConfig,
} from './LessonConfig';

type LessonStatus = 'idle' | 'detecting' | 'holding' | 'success' | 'failed';
const INTERACTIVE_LESSON_TOUR_STEPS = [
  {
    title: 'Letter strip',
    message:
      'Tap each letter here to learn it. You need to visit all letters in this row to complete this lesson.',
  },
  {
    title: 'Guide mode',
    message:
      'Switch between Video and Image to see the sign in motion or as a static handshape.',
  },
  {
    title: 'Orientation',
    message:
      'Use Normal and Mirrored to flip the guide so it matches how you prefer to copy signs.',
  },
] as const;

export default function ModuleOnePage() {
  return (
    <>
      <ModuleNav currentModule={1} />
      <Module1Container />
    </>
  );
}

function Module1Container() {
  const router = useRouter();
  const lessons = MODULE_ONE_LESSONS;
  const [currentLessonId, setCurrentLessonId] = useState<string>(lessons[0].id);
  const {
    profile,
    loading,
    completeLesson,
    unlockModule,
    completeModule1LessonTour,
  } = useUserProgress();
  const completedLessons = profile?.completedLessons ?? [];

  const currentLesson =
    lessons.find((lesson) => lesson.id === currentLessonId) ?? lessons[0];

  const completedCount = lessons.filter((lesson) =>
    completedLessons.includes(`module1-${lesson.id}`),
  ).length;
  const moduleProgress = Math.round((completedCount / lessons.length) * 100);
  const moduleOneComplete = completedCount === lessons.length;

  const isCompleted = completedLessons.includes(`module1-${currentLesson.id}`);

  const nextLessonId = useMemo(() => {
    const index = lessons.findIndex((lesson) => lesson.id === currentLesson.id);
    return index >= 0 ? lessons[index + 1]?.id ?? null : null;
  }, [currentLesson.id, lessons]);

  function markLessonComplete() {
    completeLesson(`module1-${currentLesson.id}`, 50);
  }

  useEffect(() => {
    if (loading) return;
    if (!profile) return;
    if (hasCompletedOnboarding(profile)) return;
    router.replace(`/onboarding?next=${encodeURIComponent('/module-1')}`);
  }, [loading, profile, router]);

  useEffect(() => {
    if (moduleOneComplete) {
      unlockModule(2);
    }
  }, [moduleOneComplete, unlockModule]);

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

      <div className="min-h-screen bg-slate-50 text-slate-900 flex">
        <aside className="hidden md:flex w-72 flex-col border-r border-slate-200 bg-white">
          <div className="px-5 py-4 border-b border-slate-200">
            <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
              Module 1
            </p>
            <h1 className="mt-1 text-sm font-semibold">SgSL Static Letters</h1>
            <p className="mt-1 text-xs text-slate-500">
              Learn the alphabet with a learn-do-repeat flow.
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
              const done = completedLessons.includes(`module1-${lesson.id}`);

              const badgeLabel =
                lesson.type === 'intro'
                  ? 'Intro'
                  : lesson.type === 'interactive'
                    ? 'Learn'
                    : lesson.type === 'gym'
                      ? 'Practice'
                      : 'Test';

              const badgeClasses =
                lesson.type === 'intro'
                  ? 'border-slate-300 text-slate-500'
                  : lesson.type === 'interactive'
                    ? 'border-amber-400/50 text-amber-400'
                    : lesson.type === 'gym'
                      ? 'border-emerald-400/50 text-emerald-500'
                      : 'border-sky-400/50 text-sky-500';

              return (
                <button
                  key={lesson.id}
                  onClick={() => setCurrentLessonId(lesson.id)}
                  className={`w-full text-left rounded-xl px-3 py-2.5 text-xs mb-1 flex items-start gap-3 border ${
                    active
                      ? 'bg-slate-100 border-blue-300'
                      : done
                      ? 'bg-emerald-50 border-emerald-200'
                      : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div
                    className={`mt-0.5 flex h-5 w-5 items-center justify-center rounded-full border text-[11px] ${
                      done
                        ? 'border-emerald-200 bg-emerald-100 text-emerald-700'
                        : 'border-slate-200 text-slate-600'
                    }`}
                  >
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
                Module 1 · Static letters
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
            <div className="mx-auto w-full max-w-[1280px]">
              {currentLesson.type === 'interactive' && (
                <InteractiveLessonView
                  key={currentLesson.id}
                  lesson={currentLesson}
                  isCompleted={isCompleted}
                  onComplete={markLessonComplete}
                  tourVersionCompleted={
                    loading || !profile
                      ? null
                      : profile.module1LessonTourVersionCompleted
                  }
                  onCompleteLessonTour={completeModule1LessonTour}
                />
              )}

              {currentLesson.type === 'intro' && (
                <IntroLessonView
                  key={currentLesson.id}
                  onComplete={markLessonComplete}
                />
              )}

              {currentLesson.type === 'gym' && (
                <PracticeGymView
                  key={currentLesson.id}
                  letters={currentLesson.letters}
                  isCompleted={isCompleted}
                  onComplete={markLessonComplete}
                />
              )}

              {currentLesson.type === 'test' && (
                <FinalTestView
                  key={currentLesson.id}
                  letters={currentLesson.letters}
                  isCompleted={isCompleted}
                  onComplete={markLessonComplete}
                  onUnlockModule={unlockModule}
                />
              )}
            </div>
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

function InteractiveLessonView({
  lesson,
  isCompleted,
  onComplete,
  tourVersionCompleted,
  onCompleteLessonTour,
}: {
  lesson: LessonConfig;
  isCompleted: boolean;
  onComplete: () => void;
  tourVersionCompleted: number | null;
  onCompleteLessonTour: (version?: number) => Promise<void>;
}) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [view, setView] = useState<'video' | 'image'>('image');
  const [guideOrientation, setGuideOrientation] = useState<'normal' | 'mirrored'>(
    'mirrored',
  );
  const [guideSpeed, setGuideSpeed] = useState<0.5 | 0.75 | 1>(1);
  const [guidePlaying, setGuidePlaying] = useState(true);
  const [status, setStatus] = useState<LessonStatus>('detecting');
  const [visitedLetters, setVisitedLetters] = useState<Set<string>>(
    () => new Set([lesson.letters[0]]),
  );
  const [tourOpen, setTourOpen] = useState(false);
  const [tourStep, setTourStep] = useState(0);
  const [tourDismissedThisMount, setTourDismissedThisMount] = useState(false);

  const holdStartRef = useRef<number | null>(null);
  const lastHitRef = useRef<number | null>(null);
  const completedRef = useRef(false);
  const guideVideoRef = useRef<HTMLVideoElement | null>(null);
  const letterStripRef = useRef<HTMLDivElement | null>(null);
  const guideModeToggleRef = useRef<HTMLDivElement | null>(null);
  const guideOrientationToggleRef = useRef<HTMLDivElement | null>(null);

  const holdMs = 2000;
  const targetLetter = lesson.letters[currentIdx];
  const letterNote = lesson.notes?.[targetLetter];
  const guideTransform =
    guideOrientation === 'mirrored' ? 'scaleX(-1)' : undefined;
  const feedbackMessage =
    status === 'holding'
      ? `“${targetLetter}” is being recognized. Keep the same shape and position.`
      : status === 'success'
        ? `“${targetLetter}” confirmed. Move to the next letter when ready.`
        : `Recognition only works when your hand clearly matches “${targetLetter}” and stays steady for about 2 seconds.`;
  const autoOpenTour =
    tourVersionCompleted != null &&
    tourVersionCompleted < MODULE1_LESSON_TOUR_VERSION &&
    !tourDismissedThisMount;
  const isTourVisible = tourOpen || autoOpenTour;
  const tourLastStep = INTERACTIVE_LESSON_TOUR_STEPS.length - 1;
  const currentTourStep =
    INTERACTIVE_LESSON_TOUR_STEPS[tourStep] ??
    INTERACTIVE_LESSON_TOUR_STEPS[INTERACTIVE_LESSON_TOUR_STEPS.length - 1];
  const isLetterTourStep = isTourVisible && tourStep === 0;
  const isGuideModeTourStep = isTourVisible && tourStep === 1;
  const isGuideOrientationTourStep = isTourVisible && tourStep === 2;
  const tourCardHighlightClass =
    'ring-4 ring-amber-400 ring-offset-4 ring-offset-slate-50 border-amber-300 bg-amber-50 shadow-lg shadow-amber-300/60 animate-pulse';
  const tourControlHighlightClass =
    'ring-4 ring-amber-400 ring-offset-2 ring-offset-white border-amber-300 bg-amber-100 shadow-md shadow-amber-300/60 animate-pulse';

  useEffect(() => {
    setCurrentIdx(0);
    setVisitedLetters(new Set([lesson.letters[0]]));
    setGuideOrientation('mirrored');
    setGuideSpeed(1);
    setGuidePlaying(true);
    setStatus('detecting');
    holdStartRef.current = null;
    lastHitRef.current = null;
    completedRef.current = false;
    setTourOpen(false);
    setTourStep(0);
    setTourDismissedThisMount(false);
  }, [lesson.id, lesson.letters]);

  useEffect(() => {
    setStatus('detecting');
    holdStartRef.current = null;
    lastHitRef.current = null;
    completedRef.current = false;
    setVisitedLetters((prev) => new Set(prev).add(targetLetter));
  }, [currentIdx, targetLetter]);

  useEffect(() => {
    if (
      visitedLetters.size >= lesson.letters.length &&
      !isCompleted &&
      !completedRef.current
    ) {
      completedRef.current = true;
      onComplete();
    }
  }, [visitedLetters, lesson.letters.length, isCompleted, onComplete]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (status !== 'holding') return;
      const now = Date.now();
      if (!lastHitRef.current || now - lastHitRef.current > 1000) {
        holdStartRef.current = null;
        setStatus('detecting');
        return;
      }
      if (holdStartRef.current) {
        const progress = Math.min(1, (now - holdStartRef.current) / holdMs);
        if (progress >= 1) {
          setStatus('success');
        }
      }
    }, 100);

    return () => window.clearInterval(interval);
  }, [status]);

  useEffect(() => {
    if (status !== 'success') return;
    const timeout = window.setTimeout(() => {
      setStatus('detecting');
      holdStartRef.current = null;
      lastHitRef.current = null;
    }, 800);
    return () => window.clearTimeout(timeout);
  }, [status]);

  useEffect(() => {
    if (view !== 'video') return;
    const guideVideo = guideVideoRef.current;
    if (!guideVideo) return;
    guideVideo.playbackRate = guideSpeed;
    if (guidePlaying) {
      const playPromise = guideVideo.play();
      if (playPromise) {
        void playPromise.catch(() => {});
      }
      return;
    }
    guideVideo.pause();
  }, [view, guideSpeed, guidePlaying, targetLetter]);

  useEffect(() => {
    if (!isTourVisible) return;
    const targetRefs = [
      letterStripRef.current,
      guideModeToggleRef.current,
      guideOrientationToggleRef.current,
    ];
    const target = targetRefs[tourStep];
    target?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
      inline: 'nearest',
    });
  }, [isTourVisible, tourStep]);

  function handlePrediction(letter: string) {
    if (letter !== targetLetter) return;
    const now = Date.now();
    lastHitRef.current = now;
    if (!holdStartRef.current) {
      holdStartRef.current = now;
    }
    if (status !== 'holding' && status !== 'success') {
      setStatus('holding');
    }
  }

  async function dismissTour() {
    setTourOpen(false);
    setTourDismissedThisMount(true);
    try {
      await onCompleteLessonTour(MODULE1_LESSON_TOUR_VERSION);
    } catch (error) {
      console.error('Module 1 lesson tour completion failed', error);
    }
  }

  function handleReplayTour() {
    setTourStep(0);
    setTourOpen(true);
  }

  return (
    <div className="grid gap-6">
      <div
        ref={letterStripRef}
        className={`rounded-2xl border border-slate-200 bg-white p-4 md:p-5 ${
          isLetterTourStep ? tourCardHighlightClass : ''
        }`}
      >
        <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
          Tap every letter in this row to complete this lesson
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {lesson.letters.map((letter, idx) => {
            const isActive = idx === currentIdx;
            const isVisited = visitedLetters.has(letter);
            return (
              <button
                key={letter}
                type="button"
                onClick={() => setCurrentIdx(idx)}
                className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold transition ${
                  isVisited
                    ? 'border-emerald-200 bg-emerald-100 text-emerald-700'
                    : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                } ${isActive ? 'ring-2 ring-blue-200 ring-offset-2 ring-offset-white' : ''}`}
              >
                {letter}
              </button>
            );
          })}
        </div>

      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Your Mirror</h3>
            <span className="text-[11px] text-slate-500">
              Webcam feedback is the main practice area
            </span>
          </div>

          <div className="relative mt-4">
            <StaticLetterPractice
              allowedLetters={lesson.letters}
              targetLetter={targetLetter}
              onConfidentPrediction={handlePrediction}
              confidenceThreshold={0.85}
            />
          </div>
        </div>

        <aside className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Guide</h3>
                <div
                  ref={guideModeToggleRef}
                  className={`inline-flex rounded-full border border-slate-200 bg-slate-50 p-1 text-[11px] ${
                    isGuideModeTourStep ? tourControlHighlightClass : ''
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setView('video')}
                    className={`rounded-full px-3 py-1 font-semibold ${
                      view === 'video'
                        ? 'bg-white text-slate-900'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Video
                  </button>
                  <button
                    type="button"
                    onClick={() => setView('image')}
                    className={`rounded-full px-3 py-1 font-semibold ${
                      view === 'image'
                        ? 'bg-white text-slate-900'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Image
                  </button>
                </div>
              </div>
              <p className="text-[11px] text-slate-500">
                Use Video or Image to learn each sign, then use Normal or Mirrored
                to flip the guide orientation.
              </p>

              <div
                ref={guideOrientationToggleRef}
                className={`inline-flex rounded-full border border-slate-200 bg-slate-50 p-1 text-[11px] ${
                  isGuideOrientationTourStep ? tourControlHighlightClass : ''
                }`}
              >
                <button
                  type="button"
                  onClick={() => setGuideOrientation('normal')}
                  className={`rounded-full px-3 py-1 font-semibold ${
                    guideOrientation === 'normal'
                      ? 'bg-white text-slate-900'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Normal
                </button>
                <button
                  type="button"
                  onClick={() => setGuideOrientation('mirrored')}
                  className={`rounded-full px-3 py-1 font-semibold ${
                    guideOrientation === 'mirrored'
                      ? 'bg-white text-slate-900'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Mirrored
                </button>
              </div>

              {view === 'video' && (
                <div className="flex flex-wrap items-center gap-2 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setGuidePlaying((prev) => !prev)}
                    className="rounded-full border border-slate-200 px-3 py-1 font-semibold text-slate-600 hover:border-slate-300 hover:text-slate-800"
                  >
                    {guidePlaying ? 'Pause' : 'Play'}
                  </button>
                  {[0.5, 0.75, 1].map((speed) => (
                    <button
                      key={speed}
                      type="button"
                      onClick={() => setGuideSpeed(speed as 0.5 | 0.75 | 1)}
                      className={`rounded-full border px-3 py-1 font-semibold ${
                        guideSpeed === speed
                          ? 'border-blue-200 bg-blue-50 text-blue-700'
                          : 'border-slate-200 text-slate-500 hover:border-slate-300'
                      }`}
                    >
                      {speed.toFixed(2).replace('.00', '')}x
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div
              className={`mt-4 overflow-hidden rounded-xl border border-slate-200 bg-slate-100 ${
                view === 'image' ? 'mx-auto w-1/2 min-w-[160px] max-w-[320px]' : ''
              }`}
            >
              {view === 'video' ? (
                <video
                  key={targetLetter}
                  ref={guideVideoRef}
                  src={`/videos/${targetLetter}.mp4`}
                  className="w-full h-auto block"
                  style={{ transform: guideTransform }}
                  autoPlay
                  loop
                  muted
                  playsInline
                />
              ) : (
                <img
                  src={`/images/${targetLetter}.png`}
                  alt={`${targetLetter} guide`}
                  className="w-full h-auto block"
                  style={{ transform: guideTransform }}
                />
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5 text-xs text-slate-600 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                Instructions and feedback
              </p>
              <button
                type="button"
                onClick={handleReplayTour}
                className="rounded-full border border-slate-200 px-3 py-1 text-[11px] font-semibold text-slate-600 hover:border-slate-300 hover:text-slate-800"
              >
                How to use
              </button>
            </div>
            <p>1. Match the guide handshape for the target letter.</p>
            <p>2. Keep your hand steady so confidence stays high.</p>
            <p>3. Recognition only works when your handshape is clear and stable.</p>
            <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-700">
              {feedbackMessage}
            </p>
            {letterNote && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-amber-700">
                {letterNote}
              </div>
            )}
          </div>
        </aside>
      </div>

      {isTourVisible && (
        <div className="pointer-events-none fixed inset-x-4 bottom-4 z-40 flex justify-center">
          <div className="pointer-events-auto w-full max-w-md rounded-2xl border border-blue-200 bg-white p-4 shadow-xl">
            <p className="text-[11px] uppercase tracking-[0.2em] text-blue-600">
              How to use · Step {tourStep + 1}/{INTERACTIVE_LESSON_TOUR_STEPS.length}
            </p>
            <p className="mt-2 text-sm font-semibold text-slate-900">
              {currentTourStep.title}
            </p>
            <p className="mt-1 text-xs text-slate-600">
              {currentTourStep.message}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  void dismissTour();
                }}
                className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:border-slate-300 hover:text-slate-800"
              >
                Skip
              </button>
              {tourStep > 0 && (
                <button
                  type="button"
                  onClick={() => setTourStep((prev) => Math.max(0, prev - 1))}
                  className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:border-slate-300 hover:text-slate-800"
                >
                  Back
                </button>
              )}
              {tourStep < tourLastStep ? (
                <button
                  type="button"
                  onClick={() =>
                    setTourStep((prev) => Math.min(tourLastStep, prev + 1))
                  }
                  className="rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-500"
                >
                  Next
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    void dismissTour();
                  }}
                  className="rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-500"
                >
                  Done
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PracticeGymView({
  letters,
  isCompleted,
  onComplete,
}: {
  letters: string[];
  isCompleted: boolean;
  onComplete: () => void;
}) {
  const [targetLetter, setTargetLetter] = useState<string>(letters[0]);
  const [practiceMode, setPracticeMode] = useState<'sequential' | 'random'>(
    'sequential',
  );
  const [showHint, setShowHint] = useState(true);
  const [successFlash, setSuccessFlash] = useState(false);
  const [isHolding, setIsHolding] = useState(false);
  const [totalSuccessCount, setTotalSuccessCount] = useState(0);
  const holdStartRef = useRef<number | null>(null);
  const lastHitRef = useRef<number | null>(null);
  const successLockRef = useRef(false);
  const flashTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isCompleted && totalSuccessCount >= 10) {
      onComplete();
    }
  }, [totalSuccessCount, isCompleted, onComplete]);

  useEffect(() => {
    setTargetLetter(letters[0]);
  }, [letters]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (!lastHitRef.current) return;
      if (Date.now() - lastHitRef.current > 350) {
        holdStartRef.current = null;
        setIsHolding(false);
      }
    }, 120);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    return () => {
      if (flashTimeoutRef.current) {
        window.clearTimeout(flashTimeoutRef.current);
      }
    };
  }, []);

  function pickNextLetter(current: string) {
    if (!letters.length) return current;
    if (practiceMode === 'random') {
      if (letters.length === 1) return letters[0];
      let next = current;
      while (next === current) {
        next = letters[Math.floor(Math.random() * letters.length)];
      }
      return next;
    }
    const idx = letters.indexOf(current);
    if (idx === -1) return letters[0];
    return letters[(idx + 1) % letters.length];
  }

  function handleSuccess() {
    if (successLockRef.current) return;
    successLockRef.current = true;
    setTotalSuccessCount((prev) => prev + 1);
    setSuccessFlash(true);
    if (flashTimeoutRef.current) {
      window.clearTimeout(flashTimeoutRef.current);
    }
    flashTimeoutRef.current = window.setTimeout(() => {
      setSuccessFlash(false);
    }, 450);
    const next = pickNextLetter(targetLetter);
    holdStartRef.current = null;
    lastHitRef.current = null;
    setIsHolding(false);
    setTargetLetter(next);
    window.setTimeout(() => {
      successLockRef.current = false;
    }, 300);
  }

  function handlePrediction(letter: string) {
    if (letter !== targetLetter) {
      holdStartRef.current = null;
      setIsHolding(false);
      return;
    }
    const now = Date.now();
    lastHitRef.current = now;
    if (!holdStartRef.current) {
      holdStartRef.current = now;
      setIsHolding(true);
    }
    if (now - holdStartRef.current >= 1000) {
      handleSuccess();
    }
  }

  function setTargetFromControl(letter: string) {
    setTargetLetter(letter);
    holdStartRef.current = null;
    lastHitRef.current = null;
    setIsHolding(false);
  }

  const practiceConfidenceThreshold =
    targetLetter === 'S' ||
    targetLetter === 'N' ||
    targetLetter === 'O' ||
    targetLetter === 'C'
      ? targetLetter === 'O'
        ? 0.3
        : targetLetter === 'S'
          ? 0.4
          : 0.45
      : 0.5;

  return (
    <div className="relative">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
        <div className="flex flex-col gap-3 border-b border-slate-100 pb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-[11px] uppercase tracking-[0.16em] text-slate-400">
                Mode
              </span>
              <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 p-1">
                {(['sequential', 'random'] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setPracticeMode(option)}
                    className={`rounded-full px-3 py-1 text-[11px] font-semibold transition ${
                      practiceMode === option
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {option === 'sequential' ? 'Sequential' : 'Random'}
                  </button>
                ))}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowHint((prev) => !prev)}
              className="rounded-full border border-slate-200 px-3 py-1 text-[11px] font-semibold text-slate-600 transition hover:border-slate-300"
            >
              {showHint ? 'Hide guide' : 'Show guide'}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap gap-2">
              {letters.map((letter) => {
                const active = letter === targetLetter;
                return (
                  <button
                    key={letter}
                    type="button"
                    onClick={() => setTargetFromControl(letter)}
                    className={`h-9 w-9 rounded-lg border text-xs font-semibold transition ${
                      active
                        ? 'border-blue-300 bg-blue-50 text-blue-700'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    {letter}
                  </button>
                );
              })}
            </div>
            <span className="text-[11px] text-slate-400">
              {Math.min(totalSuccessCount, 10)}/10 signs completed
            </span>
          </div>
        </div>
      </div>

      <div
        className={`mt-6 grid gap-6 ${
          showHint ? 'lg:grid-cols-3' : 'grid-cols-1'
        }`}
      >
        <div className={showHint ? 'lg:col-span-2' : ''}>
          <div className="space-y-2">
            <p className="text-xs text-slate-500">
              Hold the target letter for 1 second to advance. Finish 10 signs to
              complete the lesson.
            </p>
          </div>
          <div className="mt-4 relative">
            <div
              className={`relative rounded-2xl ${
                isHolding
                  ? 'ring-4 ring-blue-400/50 ring-offset-2 ring-offset-white'
                  : ''
              }`}
            >
              <StaticLetterPractice
                allowedLetters={letters}
                targetLetter={targetLetter}
                onConfidentPrediction={handlePrediction}
                confidenceThreshold={practiceConfidenceThreshold}
              />
              <div className="pointer-events-none absolute left-1/2 top-4 w-48 -translate-x-1/2 rounded-2xl border border-slate-200 bg-white/70 px-3 py-2 text-center shadow-sm backdrop-blur">
                <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">
                  Target Letter
                </p>
                <p className="text-2xl font-semibold text-slate-900">
                  {targetLetter}
                </p>
              </div>
              {isHolding && (
                <div className="pointer-events-none absolute inset-0 rounded-2xl bg-blue-200/10" />
              )}
            </div>
            {successFlash && (
              <div className="pointer-events-none absolute inset-0 rounded-2xl bg-emerald-300/10">
                <div className="absolute left-6 top-6 h-10 w-10 rounded-full bg-emerald-400/30 animate-ping" />
              </div>
            )}
          </div>
        </div>

        {showHint && (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
            <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">
              Guide: Sign {targetLetter}
            </p>
            <img
              src={`/images/${targetLetter}.png`}
              alt="Guide"
              className="mt-3 w-full rounded-lg"
              style={{ transform: 'scaleX(-1)' }}
            />
            <div className="mt-4 text-xs text-slate-500">
              Keep your wrist relaxed and fingers visible.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function FinalTestView({
  letters,
  isCompleted,
  onComplete,
  onUnlockModule,
}: {
  letters: string[];
  isCompleted: boolean;
  onComplete: () => void;
  onUnlockModule: (moduleId: number) => void;
}) {
  type Result = { letter: string; status: 'pass' | 'fail' };
  const [targetIndex, setTargetIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [finalScore, setFinalScore] = useState<number | null>(null);
  const [status, setStatus] = useState<LessonStatus>('detecting');
  const [timeLeft, setTimeLeft] = useState(10);
  const [testState, setTestState] = useState<'idle' | 'running' | 'finished'>(
    'idle',
  );
  const [results, setResults] = useState<Result[]>([]);
  const [showModuleTwoPrompt, setShowModuleTwoPrompt] = useState(false);
  const router = useRouter();

  const holdStartRef = useRef<number | null>(null);
  const lastHitRef = useRef<number | null>(null);

  const targetLetter = letters[targetIndex];
  const testConfidenceThreshold =
    targetLetter === 'I'
      ? 0.4
      : targetLetter === 'N'
        ? 0.35
        : targetLetter === 'S'
          ? 0.4
        : targetLetter === 'O'
          ? 0.3
        : 0.5;

  useEffect(() => {
    if (testState !== 'running') return;
    setStatus('detecting');
    setTimeLeft(10);
    holdStartRef.current = null;
    lastHitRef.current = null;
  }, [targetIndex, testState]);

  useEffect(() => {
    if (testState !== 'running' || status === 'success' || status === 'failed')
      return;
    const startTime = Date.now();
    const durationMs = 10000;
    const interval = window.setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remainingMs = Math.max(0, durationMs - elapsed);
      const remaining = remainingMs / 1000;
      setTimeLeft(remaining);
      if (remainingMs <= 0) {
        setStatus('failed');
        window.setTimeout(() => moveNext(false), 150);
      }
    }, 100);
    return () => window.clearInterval(interval);
  }, [testState, status, targetIndex]);

  function moveNext(correct: boolean) {
    setResults((prev) => [
      ...prev,
      { letter: targetLetter, status: correct ? 'pass' : 'fail' },
    ]);
    if (correct) {
      setScore((prev) => prev + 1);
    }
    setTargetIndex((prev) => {
      const next = prev + 1;
      if (next >= letters.length) {
        const final = correct ? score + 1 : score;
        setScore(final);
        setFinalScore(final);
        setTestState('finished');
        return prev;
      }
      return next;
    });
  }

  useEffect(() => {
    if (testState !== 'finished' || finalScore == null) return;
    if (!isCompleted && finalScore / letters.length >= 0.9) {
      onComplete();
      onUnlockModule(2);
      setShowModuleTwoPrompt(true);
    }
  }, [
    testState,
    finalScore,
    isCompleted,
    letters.length,
    onComplete,
    onUnlockModule,
  ]);

  function handlePrediction(letter: string) {
    if (testState !== 'running' || status === 'success' || letter !== targetLetter)
      return;
    const now = Date.now();
    lastHitRef.current = now;
    if (!holdStartRef.current) {
      holdStartRef.current = now;
    }
    if (status !== 'holding') {
      setStatus('holding');
    }
    if (holdStartRef.current && now - holdStartRef.current >= 750) {
      setStatus('success');
      window.setTimeout(() => moveNext(true), 120);
    }
  }

  const progressPercent = Math.round((score / letters.length) * 100);
  const failedLetters = results
    .filter((item) => item.status === 'fail')
    .map((item) => item.letter);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
        {testState === 'idle' ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center">
            <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
              Ready?
            </p>
            <p className="mt-3 text-3xl font-semibold text-slate-900">
              Final Test
            </p>
            <p className="mt-2 text-sm text-slate-500">
              {letters.length} Questions · 10 Seconds per letter
            </p>
            <button
              type="button"
              onClick={() => {
                setShowModuleTwoPrompt(false);
                setTestState('running');
                setTargetIndex(0);
                setScore(0);
                setFinalScore(null);
                setResults([]);
              }}
              className="mt-4 inline-flex items-center rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
            >
              Start Test
            </button>
          </div>
        ) : testState === 'running' ? (
          <>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold">Final test</h3>
                <p className="text-xs text-slate-500">
                  Hold each letter for 0.75 seconds. You have 10 seconds per letter.
                </p>
              </div>
              <span className="text-xs text-slate-500">
                {targetIndex + 1}/{letters.length}
              </span>
            </div>

            <div className="mt-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
                  Target
                </p>
                <p className="text-3xl font-semibold text-slate-900">
                  {targetLetter}
                </p>
              </div>
            </div>

            <div className="mt-4 h-2 w-full rounded-full bg-slate-100 overflow-hidden">
              <div
                className={`h-full transition-all ${
                  status === 'failed'
                    ? 'bg-rose-500'
                    : status === 'success'
                    ? 'bg-emerald-500'
                    : 'bg-blue-500'
                }`}
                style={{ width: `${(timeLeft / 10) * 100}%` }}
              />
            </div>

            <div className="mt-4 relative">
              <StaticLetterPractice
                allowedLetters={letters}
                targetLetter={targetLetter}
                onConfidentPrediction={handlePrediction}
                hideSkeleton
                showDotsOnly
                confidenceThreshold={testConfidenceThreshold}
              />
              {status === 'success' && (
                <div className="pointer-events-none absolute inset-0 rounded-2xl bg-emerald-200/60 flex items-center justify-center text-sm font-semibold text-emerald-800">
                  Success
                </div>
              )}
              {status === 'failed' && (
                <div className="pointer-events-none absolute inset-0 rounded-2xl bg-rose-200/60 flex items-center justify-center text-sm font-semibold text-rose-700">
                  Missed
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center">
            <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
              Final score
            </p>
            <p className="mt-3 text-4xl font-semibold text-slate-900">
              {(finalScore ?? score)}/{letters.length}
            </p>
            <p className="mt-2 text-sm text-slate-500">
              {progressPercent >= 90
                ? 'Great work! You passed.'
                : 'Score below 90%. Return to practice and try again.'}
            </p>
            <div className="mt-5 grid grid-cols-3 gap-2 text-xs">
              {results.map((result, idx) => (
                <div
                  key={`${result.letter}-${idx}`}
                  className={`rounded-full border px-3 py-1 font-semibold ${
                    result.status === 'pass'
                      ? 'border-emerald-200 bg-emerald-100 text-emerald-700'
                      : 'border-rose-200 bg-rose-100 text-rose-700'
                  }`}
                >
                  {result.letter} {result.status === 'pass' ? '✓' : '✗'}
                </div>
              ))}
            </div>
            {failedLetters.length > 0 && (
              <p className="mt-4 text-xs text-slate-500">
                Focus on: {failedLetters.join(', ')}
              </p>
            )}
            <button
              type="button"
              onClick={() => {
                setShowModuleTwoPrompt(false);
                setTargetIndex(0);
                setScore(0);
                setFinalScore(null);
                setResults([]);
                setTestState('running');
              }}
              className="mt-4 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
            >
              Retry test
            </button>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5 text-xs text-slate-600 space-y-3">
        <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">
          Test tips
        </p>
        <ul className="list-disc pl-4 space-y-1">
          <li>Focus on accuracy over speed; the timer keeps you moving.</li>
          <li>Keep your hand centered and fully visible.</li>
          <li>If you miss a letter, reset and try again.</li>
        </ul>
        {isCompleted && (
          <button
            disabled
            className="mt-2 inline-flex items-center justify-center rounded-lg bg-emerald-100 px-4 py-2 text-xs font-semibold text-emerald-700"
          >
            Lesson completed ✓
          </button>
        )}
      </div>

      {showModuleTwoPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 px-4">
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md rounded-2xl border border-emerald-200 bg-white p-5 shadow-xl"
          >
            <p className="text-[11px] uppercase tracking-[0.2em] text-emerald-600">
              Module 1 complete
            </p>
            <h3 className="mt-2 text-lg font-semibold text-slate-900">
              Great work. Proceed to Module 2.
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              You have unlocked Module 2: Fingerspelling.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowModuleTwoPrompt(false);
                  router.push('/module-2');
                }}
                className="inline-flex items-center rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-400"
              >
                Go to Module 2
              </button>
              <button
                type="button"
                onClick={() => setShowModuleTwoPrompt(false)}
                className="inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:border-slate-300 hover:text-slate-800"
              >
                Stay here
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
