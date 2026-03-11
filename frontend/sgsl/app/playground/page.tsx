'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Script from 'next/script';
import { useRouter } from 'next/navigation';
import StaticLetterPractice, {
  type PredictResponse,
  type RMiniFeedback,
} from '@/components/StaticLetterPractice';
import { useUserProgress } from '@/hooks/useUserProgress';
import {
  MODULE_ONE_SIGNS,
  type ModuleOneLetter,
} from '@/lib/moduleOneSigns';
import { hasCompletedOnboarding } from '@/lib/onboarding';
import { PLAYGROUND_TOUR_VERSION } from '@/lib/module1Tour';

const PLAYGROUND_TOUR_STEPS = [
  {
    target: 'picker' as const,
    title: 'Choose a sign',
    message:
      'Pick any of the 10 Module 1 signs here. The playground is free practice, so you can jump straight to the sign you want.',
  },
  {
    target: 'practice' as const,
    title: 'Practice live',
    message:
      'Copy the selected sign in the camera panel. The model updates the current prediction live while you hold the handshape steady.',
  },
  {
    target: 'guide' as const,
    title: 'Use the guide',
    message:
      'Switch between video and image references, then flip between normal and mirrored views to match how you prefer to copy the sign.',
  },
] as const;

type TourTarget = (typeof PLAYGROUND_TOUR_STEPS)[number]['target'];
type GuideView = 'video' | 'image';
type GuideOrientation = 'normal' | 'mirrored';
type FeedbackState = 'idle' | 'correct' | 'incorrect';

function getFeedbackState(
  prediction: PredictResponse | null,
  targetLetter: ModuleOneLetter,
  rMiniFeedback: RMiniFeedback | null,
): FeedbackState {
  if (targetLetter === 'R') {
    if (!rMiniFeedback || rMiniFeedback.status === 'loading') return 'idle';
    return rMiniFeedback.status === 'pass' ? 'correct' : 'incorrect';
  }
  if (!prediction) return 'idle';
  return prediction.letter === targetLetter ? 'correct' : 'incorrect';
}

function summarizeRMiniChecks(feedback: RMiniFeedback | null): string {
  if (!feedback || feedback.checks.length === 0) return '--';
  return feedback.checks
    .map((check) => `${check.id}:${check.passed ? 'ok' : 'x'}(${check.margin.toFixed(2)})`)
    .join(' ');
}

export default function PlaygroundPage() {
  const router = useRouter();
  const {
    profile,
    loading,
    completePlaygroundTour,
  } = useUserProgress();
  const [activeIndex, setActiveIndex] = useState(0);
  const [guideView, setGuideView] = useState<GuideView>('image');
  const [guideOrientation, setGuideOrientation] =
    useState<GuideOrientation>('mirrored');
  const [guideSpeed, setGuideSpeed] = useState<0.5 | 0.75 | 1>(1);
  const [guidePlaying, setGuidePlaying] = useState(true);
  const [showGuide, setShowGuide] = useState(true);
  const [currentPrediction, setCurrentPrediction] =
    useState<PredictResponse | null>(null);
  const [currentRMiniFeedback, setCurrentRMiniFeedback] =
    useState<RMiniFeedback | null>(null);
  const [tourOpen, setTourOpen] = useState(false);
  const [tourStep, setTourStep] = useState(0);
  const [tourDismissedThisMount, setTourDismissedThisMount] = useState(false);
  const [tourPopoverPosition, setTourPopoverPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const [tourPopoverPlacement, setTourPopoverPlacement] = useState<
    'above' | 'below'
  >('below');

  const guideVideoRef = useRef<HTMLVideoElement | null>(null);
  const signPickerRef = useRef<HTMLDivElement | null>(null);
  const practicePanelRef = useRef<HTMLDivElement | null>(null);
  const guidePanelRef = useRef<HTMLDivElement | null>(null);
  const tourPopoverRef = useRef<HTMLDivElement | null>(null);

  const activeSign = MODULE_ONE_SIGNS[activeIndex] ?? MODULE_ONE_SIGNS[0];
  const isRTarget = activeSign.letter === 'R';
  const feedbackState = getFeedbackState(
    currentPrediction,
    activeSign.letter,
    currentRMiniFeedback,
  );
  const confidenceLabel = currentPrediction
    ? `${(currentPrediction.confidence * 100).toFixed(1)}%`
    : '--';
  const rMiniChecksSummary = summarizeRMiniChecks(currentRMiniFeedback);
  const hasGuideVideo = Boolean(activeSign.videoSrc);
  const guideTransform =
    guideOrientation === 'mirrored' ? 'scaleX(-1)' : undefined;
  const isVideoUnavailable = guideView === 'video' && !hasGuideVideo;
  const tourVersionCompleted =
    loading || !profile ? null : profile.playgroundTourVersionCompleted;
  const autoOpenTour =
    tourVersionCompleted != null &&
    tourVersionCompleted < PLAYGROUND_TOUR_VERSION &&
    !tourDismissedThisMount;
  const isTourVisible = tourOpen || autoOpenTour;
  const currentTourStep =
    PLAYGROUND_TOUR_STEPS[tourStep] ??
    PLAYGROUND_TOUR_STEPS[PLAYGROUND_TOUR_STEPS.length - 1];
  const tourLastStep = PLAYGROUND_TOUR_STEPS.length - 1;
  const cardHighlightClass =
    'relative z-40 ring-4 ring-amber-400 ring-offset-4 ring-offset-slate-50 border-amber-300 bg-amber-50 shadow-lg shadow-amber-300/60 animate-pulse';
  const controlHighlightClass =
    'relative z-40 ring-4 ring-amber-400 ring-offset-2 ring-offset-white border-amber-300 bg-amber-100 shadow-md shadow-amber-300/60 animate-pulse';

  useEffect(() => {
    if (loading) return;
    if (!profile) {
      router.replace('/login');
      return;
    }
    if (hasCompletedOnboarding(profile)) return;
    router.replace(`/onboarding?next=${encodeURIComponent('/playground')}`);
  }, [loading, profile, router]);

  useEffect(() => {
    if (guideView !== 'video' || !hasGuideVideo) return;
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
  }, [guideView, guidePlaying, guideSpeed, activeSign.letter, hasGuideVideo]);

  function getTourTargetElement(target: TourTarget) {
    if (target === 'picker') return signPickerRef.current;
    if (target === 'practice') return practicePanelRef.current;
    return guidePanelRef.current;
  }

  useEffect(() => {
    if (!isTourVisible) return;
    getTourTargetElement(currentTourStep.target)?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
      inline: 'nearest',
    });
  }, [isTourVisible, currentTourStep.target]);

  useEffect(() => {
    if (!isTourVisible) return;

    let frameId: number | null = null;

    const schedulePositionUpdate = () => {
      if (frameId != null) {
        cancelAnimationFrame(frameId);
      }

      frameId = requestAnimationFrame(() => {
        const target = getTourTargetElement(currentTourStep.target);
        const popover = tourPopoverRef.current;
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

        setTourPopoverPlacement(placement);
        setTourPopoverPosition({ top, left });
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
  }, [isTourVisible, currentTourStep.target, tourStep]);

  async function dismissTour() {
    setTourOpen(false);
    setTourDismissedThisMount(true);
    try {
      await completePlaygroundTour(PLAYGROUND_TOUR_VERSION);
    } catch (error) {
      console.error('Playground tour completion failed', error);
    }
  }

  function openTour() {
    setShowGuide(true);
    setTourOpen(true);
    setTourStep(0);
  }

  function resetPracticeView() {
    setCurrentPrediction(null);
    setCurrentRMiniFeedback(null);
    setGuidePlaying(true);
  }

  function selectSign(index: number) {
    resetPracticeView();
    setActiveIndex(index);
  }

  const feedbackAccentClasses =
    feedbackState === 'correct'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : feedbackState === 'incorrect'
        ? 'border-amber-200 bg-amber-50 text-amber-700'
        : 'border-slate-200 bg-white text-slate-600';

  let feedbackTitle: string;
  let feedbackBody: string;

  if (feedbackState === 'idle') {
    feedbackTitle = 'No sign detected';
    feedbackBody = `Hold the ${activeSign.label} handshape in frame to get live recognition feedback.`;
  } else if (!isRTarget) {
    feedbackTitle = feedbackState === 'correct' ? 'Correct' : 'Try again';
    feedbackBody =
      feedbackState === 'correct'
        ? `The model currently matches ${activeSign.label}. Keep that handshape steady if you want to reinforce it.`
        : `The model is reading ${currentPrediction?.letter ?? '--'} instead of ${activeSign.label}. Compare against the guide and try again.`;
  } else if (!currentRMiniFeedback || currentRMiniFeedback.status === 'loading') {
    feedbackTitle = 'Checking R details';
    feedbackBody = 'Evaluating vertical/cross/tuck/thumb mini checks...';
  } else if (currentRMiniFeedback.status === 'models_missing') {
    feedbackTitle = 'R mini model missing';
    feedbackBody =
      currentRMiniFeedback.missingChecks.length > 0
        ? `Missing JS mini model(s): ${currentRMiniFeedback.missingChecks.join(', ')}. Train/export them and place in frontend/sgsl/public/models.`
        : 'Some JS mini models are missing. Train/export them and place in frontend/sgsl/public/models.';
  } else if (currentRMiniFeedback.status === 'fail') {
    feedbackTitle = `Adjust ${currentRMiniFeedback.failingLabel ?? 'R'}`;
    feedbackBody =
      currentRMiniFeedback.fix ??
      'R was detected, but one mini check failed. Compare against the guide and adjust.';
  } else {
    feedbackTitle = 'Correct';
    feedbackBody =
      'R is detected and all JS mini checks pass at margin ≥ 0.20. Keep the handshape steady.';
  }

  if (loading || !profile || !hasCompletedOnboarding(profile)) {
    return (
      <div className="min-h-screen bg-slate-50 px-6 py-10 text-slate-900">
        <div className="mx-auto max-w-6xl rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          Loading playground...
        </div>
      </div>
    );
  }

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

      <div className="min-h-screen bg-slate-50 text-slate-900">
        <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-3">
                <div>
                  <h1 className="text-3xl font-semibold text-slate-900">
                    Static Sign Playground
                  </h1>
                  <p className="mt-2 max-w-2xl text-sm text-slate-500">
                    Practice any sign you want!
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={openTour}
                className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
              >
                How to use
              </button>
            </div>
          </section>

          <section
            ref={signPickerRef}
            className={`rounded-2xl border border-slate-200 bg-white p-5 ${
              isTourVisible && currentTourStep.target === 'picker'
                ? cardHighlightClass
                : ''
            }`}
          >
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">
                    Choose a sign to practice
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {MODULE_ONE_SIGNS.map((sign, index) => {
                  const isActive = index === activeIndex;
                  return (
                    <button
                      key={sign.letter}
                      type="button"
                      onClick={() => selectSign(index)}
                      className={`h-11 w-11 rounded-xl border text-sm font-semibold transition ${
                        isActive
                          ? 'border-blue-300 bg-blue-50 text-blue-700'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900'
                      }`}
                    >
                      {sign.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.9fr)]">
            <div className="space-y-6">
              <div
                ref={practicePanelRef}
                className={`rounded-2xl border border-slate-200 bg-white p-5 ${
                  isTourVisible && currentTourStep.target === 'practice'
                    ? cardHighlightClass
                    : ''
                }`}
              >
                <div className="mb-4 flex flex-col gap-2">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">
                    Practice the sign with live feedback
                  </p>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                  </div>
                </div>

                <div
                  className={`rounded-2xl ${
                    isTourVisible && currentTourStep.target === 'practice'
                      ? controlHighlightClass
                      : ''
                  }`}
                >
                  <StaticLetterPractice
                    targetLetter={activeSign.letter}
                    onPredictionChange={setCurrentPrediction}
                    onRMiniFeedbackChange={setCurrentRMiniFeedback}
                    showPredictionPanel={false}
                    enableRMiniChecks={isRTarget}
                    disableStaticModel={isRTarget}
                    rMiniMargin={0.2}
                  />
                </div>
              </div>

              <div
                className={`rounded-2xl border p-5 ${feedbackAccentClasses}`}
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.16em] opacity-70">
                      Feedback
                    </p>
                    <h2 className="mt-1 text-sm font-semibold">{feedbackTitle}</h2>
                    <p className="mt-2 max-w-xl text-sm opacity-90">
                      {feedbackBody}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs md:min-w-[240px]">
                    <div className="rounded-2xl border border-current/15 bg-white/60 p-3">
                      <p className="uppercase tracking-[0.16em] opacity-70">
                        Target
                      </p>
                      <p className="mt-2 text-2xl font-semibold tracking-[0.2em]">
                        {activeSign.label}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-current/15 bg-white/60 p-3">
                      <p className="uppercase tracking-[0.16em] opacity-70">
                        Prediction
                      </p>
                      <p className="mt-2 text-2xl font-semibold tracking-[0.2em]">
                        {currentPrediction?.letter ?? '--'}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-current/15 bg-white/60 p-3 col-span-2">
                      <p className="uppercase tracking-[0.16em] opacity-70">
                        Confidence
                      </p>
                      <p className="mt-2 text-2xl font-semibold">
                        {confidenceLabel}
                      </p>
                    </div>
                    {isRTarget && (
                      <div className="rounded-2xl border border-current/15 bg-white/60 p-3 col-span-2">
                        <p className="uppercase tracking-[0.16em] opacity-70">
                          R Mini Checks (margin 0.20)
                        </p>
                        <p className="mt-2 text-sm font-semibold tracking-wide">
                          {rMiniChecksSummary}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <aside
              ref={guidePanelRef}
              className={`rounded-2xl border p-5 ${
                isTourVisible && currentTourStep.target === 'guide'
                  ? cardHighlightClass
                  : showGuide
                    ? 'border-slate-200 bg-white'
                    : 'border-slate-300 bg-slate-100'
              }`}
            >
              {showGuide ? (
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">
                      Guide
                    </p>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h2 className="text-sm font-semibold text-slate-900">
                        Reference for sign {activeSign.label}
                      </h2>
                      <button
                        type="button"
                        onClick={() => setShowGuide(false)}
                        className="rounded-full border border-slate-200 px-3 py-1 text-[11px] font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                      >
                        Hide guide
                      </button>
                    </div>
                    <p className="text-sm text-slate-500">{activeSign.tip}</p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 p-1 text-[11px]">
                      <button
                        type="button"
                        onClick={() => setGuideView('video')}
                        className={`rounded-full px-3 py-1 font-semibold ${
                          guideView === 'video'
                            ? 'bg-white text-slate-900'
                            : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        Video
                      </button>
                      <button
                        type="button"
                        onClick={() => setGuideView('image')}
                        className={`rounded-full px-3 py-1 font-semibold ${
                          guideView === 'image'
                            ? 'bg-white text-slate-900'
                            : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        Image
                      </button>
                    </div>

                    <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 p-1 text-[11px]">
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
                  </div>

                  {guideView === 'video' && hasGuideVideo && (
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

                  {isVideoUnavailable && (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
                      Video guidance is not available yet for {activeSign.label}.
                      Use the saved image reference below for this sign.
                    </div>
                  )}

                  <div
                    className={`overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 ${
                      guideView === 'image' || isVideoUnavailable
                        ? 'mx-auto w-full max-w-sm'
                        : ''
                    }`}
                  >
                    {guideView === 'video' && hasGuideVideo ? (
                      <video
                        key={activeSign.letter}
                        ref={guideVideoRef}
                        src={activeSign.videoSrc ?? undefined}
                        className="w-full h-auto block"
                        style={{ transform: guideTransform }}
                        autoPlay
                        loop
                        muted
                        playsInline
                      />
                    ) : (
                      <Image
                        src={activeSign.imageSrc}
                        alt={`${activeSign.label} guide`}
                        width={640}
                        height={640}
                        className="block h-auto w-full"
                        style={{ transform: guideTransform }}
                      />
                    )}
                  </div>

                  <p className="text-xs text-slate-500">
                    Use mirrored mode if you want the guide to match your selfie
                    camera view more directly.
                  </p>
                </div>
              ) : (
                <div className="flex min-h-[520px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-200/70 px-6 py-8 text-center">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                    Guide hidden
                  </p>
                  <p className="mt-3 max-w-xs text-sm text-slate-600">
                    Show the guide again whenever you want the reference image
                    or video for sign {activeSign.label}.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowGuide(true)}
                    className="mt-6 rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    Show guide
                  </button>
                </div>
              )}
            </aside>
          </section>
        </main>

        {isTourVisible && (
          <>
            <div
              aria-hidden="true"
              className="pointer-events-none fixed inset-0 z-30 bg-slate-900/45"
            />
            <div
              ref={tourPopoverRef}
              className="pointer-events-auto fixed z-50 w-[min(24rem,calc(100vw-2rem))] rounded-2xl border border-amber-200 bg-white p-4 shadow-xl shadow-slate-900/25"
              style={
                tourPopoverPosition
                  ? {
                      top: tourPopoverPosition.top,
                      left: tourPopoverPosition.left,
                    }
                  : { top: 16, left: 16 }
              }
            >
              <div
                aria-hidden="true"
                className={`absolute left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border border-amber-200 bg-white ${
                  tourPopoverPlacement === 'below'
                    ? '-top-1.5 border-r-0 border-b-0'
                    : '-bottom-1.5 border-l-0 border-t-0'
                }`}
              />
              <p className="text-[11px] uppercase tracking-[0.2em] text-amber-700">
                Playground tour · Step {tourStep + 1}/{PLAYGROUND_TOUR_STEPS.length}
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
          </>
        )}
      </div>
    </>
  );
}
