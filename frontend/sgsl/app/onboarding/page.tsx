'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import Script from 'next/script';
import { useRouter, useSearchParams } from 'next/navigation';
import FingerspellingPractice from '@/components/FingerSpellingPractice';
import StaticLetterPractice from '@/components/StaticLetterPractice';
import { useHandRecognition } from '@/hooks/useHandRecognition';
import { useUserProgress } from '@/hooks/useUserProgress';
import {
  ONBOARDING_VERSION,
  hasCompletedOnboarding,
  type OnboardingStepId,
} from '@/lib/onboarding';

const STEP_META: Array<{
  id: OnboardingStepId;
  title: string;
  description: string;
}> = [
  {
    id: 'welcome',
    title: 'Welcome',
    description: 'Overview.',
  },
  {
    id: 'camera-check',
    title: 'Camera Check',
    description: 'Confirm your hand stays inside the capture zone.',
  },
  {
    id: 'hold-check',
    title: 'Hold Mechanic',
    description: 'Learn how to sign static letters into the camera',
  },
  {
    id: 'fingerspelling-check',
    title: 'Fingerspelling Drill',
    description: 'Learn how to fingerspell into the camera',
  },
  {
    id: 'module-previews',
    title: 'Wrap-Up',
    description: 'Review and tips.',
  },
];

const MODULE_PREVIEWS = [
  {
    id: 'module-1',
    title: 'Module 1 · Static letters',
    cue: 'Stable handshape + hold',
    details:
      'You will learn the appropriate gesture for basic alphabets in Singapore Sign Language',
  },
  {
    id: 'module-2',
    title: 'Module 2 · Fingerspelling',
    cue: 'Pause + reset between letters',
    details:
      'You will learn how to chain letters into words via fingerspelling',
  },
] as const;

const FRAMING_ZONE = {
  minX: 0.2,
  maxX: 0.8,
  minY: 0.16,
  maxY: 0.84,
} as const;

// Stable hooks for future onboarding tutorial overlay/highlight targeting.
const ONBOARDING_TUTORIAL_TARGETS = {
  pageHeader: 'onboarding-header',
  stepsNav: 'onboarding-steps-nav',
  stepNavItemPrefix: 'onboarding-step-nav-',
  activeStepPanel: 'onboarding-active-step-panel',
  welcomePanel: 'onboarding-step-welcome',
  welcomeStartButton: 'onboarding-step-welcome-start',
  cameraCheckPanel: 'onboarding-step-camera-check',
  cameraCheckCameraCard: 'onboarding-camera-check-card',
  cameraCheckCaptureZone: 'onboarding-camera-check-capture-zone',
  cameraCheckContinueButton: 'onboarding-camera-check-continue',
  holdCheckPanel: 'onboarding-step-hold-check',
  holdCheckPracticeCard: 'onboarding-hold-check-practice',
  holdCheckGuideCard: 'onboarding-hold-check-guide',
  holdCheckProgressCard: 'onboarding-hold-check-progress',
  fingerspellingCheckPanel: 'onboarding-step-fingerspelling-check',
  fingerspellingCheckPracticeCard: 'onboarding-fingerspelling-check-practice',
  modulePreviewsPanel: 'onboarding-step-module-previews',
  modulePreviewGrid: 'onboarding-module-preview-grid',
  modulePreviewCardPrefix: 'onboarding-module-preview-',
  modulePreviewsFinishButton: 'onboarding-module-previews-finish',
} as const;

function getHandBounds(landmarks: number[] | null) {
  if (!landmarks || landmarks.length < 63) return null;
  let minX = 1;
  let maxX = 0;
  let minY = 1;
  let maxY = 0;
  let seen = 0;
  for (let i = 0; i < 21; i += 1) {
    const x = landmarks[i * 3];
    const y = landmarks[i * 3 + 1];
    if (typeof x !== 'number' || typeof y !== 'number') continue;
    seen += 1;
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  if (seen === 0) return null;
  return {
    minX,
    maxX,
    minY,
    maxY,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
  };
}

function sanitizeNextPath(nextValue: string | null): string {
  if (!nextValue) return '/module-1';
  if (!nextValue.startsWith('/')) return '/module-1';
  if (nextValue.startsWith('//')) return '/module-1';
  return nextValue;
}

function OnboardingPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    profile,
    loading,
    startOnboarding,
    completeOnboardingStep,
    completeOnboarding,
  } = useUserProgress();

  const nextPath = useMemo(
    () => sanitizeNextPath(searchParams.get('next')),
    [searchParams],
  );

  const completedSteps = useMemo(
    () => new Set<OnboardingStepId>(profile?.onboardingStepsCompleted ?? []),
    [profile?.onboardingStepsCompleted],
  );
  const firstIncompleteStep = useMemo(
    () => STEP_META.find((step) => !completedSteps.has(step.id))?.id ?? null,
    [completedSteps],
  );

  const [requestedStep, setRequestedStep] = useState<OnboardingStepId | null>(null);
  const [savingStep, setSavingStep] = useState<OnboardingStepId | null>(null);
  const [finishing, setFinishing] = useState(false);

  const firstIncompleteIndex = useMemo(
    () =>
      firstIncompleteStep
        ? STEP_META.findIndex((step) => step.id === firstIncompleteStep)
        : -1,
    [firstIncompleteStep],
  );
  const maxUnlockedIndex =
    firstIncompleteIndex >= 0 ? firstIncompleteIndex : STEP_META.length - 1;
  const requestedStepIndex =
    requestedStep == null
      ? maxUnlockedIndex
      : STEP_META.findIndex((step) => step.id === requestedStep);
  const currentStepIndex = Math.min(
    requestedStepIndex >= 0 ? requestedStepIndex : maxUnlockedIndex,
    maxUnlockedIndex,
  );
  const currentStep = STEP_META[currentStepIndex]?.id ?? 'welcome';
  const completedCount = STEP_META.filter((step) =>
    completedSteps.has(step.id),
  ).length;
  const progressPercent = Math.round((completedCount / STEP_META.length) * 100);

  useEffect(() => {
    if (loading) return;
    if (!profile) {
      router.replace('/login');
      return;
    }
    if (hasCompletedOnboarding(profile, ONBOARDING_VERSION)) {
      router.replace(nextPath);
      return;
    }
  }, [
    loading,
    profile,
    router,
    nextPath,
  ]);

  const markStepAndMove = useCallback(
    async (stepId: OnboardingStepId, nextStep: OnboardingStepId) => {
      if (savingStep) return;
      if (completedSteps.has(stepId)) {
        setRequestedStep(nextStep);
        return;
      }
      setSavingStep(stepId);
      await completeOnboardingStep(stepId);
      setSavingStep(null);
      setRequestedStep(nextStep);
    },
    [savingStep, completedSteps, completeOnboardingStep],
  );

  const handleStartSetup = useCallback(async () => {
    if (!profile || savingStep) return;
    setSavingStep('welcome');
    if (!profile.onboardingStartedAt) {
      await startOnboarding();
    }
    if (!completedSteps.has('welcome')) {
      await completeOnboardingStep('welcome');
    }
    setSavingStep(null);
    setRequestedStep('camera-check');
  }, [
    profile,
    savingStep,
    startOnboarding,
    completedSteps,
    completeOnboardingStep,
  ]);

  const handleFinish = useCallback(async () => {
    if (!profile || finishing) return;
    setFinishing(true);
    if (!completedSteps.has('module-previews')) {
      await completeOnboardingStep('module-previews');
    }
    const startedAtMs = profile.onboardingStartedAt
      ? Date.parse(profile.onboardingStartedAt)
      : NaN;
    const baseline = Number.isFinite(startedAtMs) ? startedAtMs : Date.now();
    const durationMs = Math.max(0, Date.now() - baseline);
    await completeOnboarding(durationMs);
    router.replace(nextPath);
  }, [
    profile,
    finishing,
    completedSteps,
    completeOnboardingStep,
    completeOnboarding,
    router,
    nextPath,
  ]);

  if (loading || !profile) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-4 text-sm text-slate-500">
          Loading onboarding...
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
        <header
          className="border-b border-slate-200 bg-white"
          data-onboarding-tutorial-target={ONBOARDING_TUTORIAL_TARGETS.pageHeader}
        >
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
                First-time setup
              </p>
              <h1 className="mt-1 text-xl font-semibold text-slate-900">
                Quick Setup (2 minutes)
              </h1>
            </div>
            <div className="text-right">
              <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
                Progress
              </p>
              <p className="text-sm font-semibold text-slate-900">
                {progressPercent}%
              </p>
            </div>
          </div>
        </header>

        <main className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-6 md:grid-cols-[260px_minmax(0,1fr)] md:px-6">
          <aside
            className="rounded-2xl border border-slate-200 bg-white p-4"
            data-onboarding-tutorial-target={ONBOARDING_TUTORIAL_TARGETS.stepsNav}
          >
            <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
              Steps
            </p>
            <div className="mt-3 space-y-2">
              {STEP_META.map((step, idx) => {
                const done = completedSteps.has(step.id);
                const active = step.id === currentStep;
                const canOpen = idx <= maxUnlockedIndex;
                return (
                  <button
                    key={step.id}
                    type="button"
                    onClick={() => {
                      if (!canOpen) return;
                      setRequestedStep(step.id);
                    }}
                    disabled={!canOpen}
                    data-onboarding-tutorial-target={`${ONBOARDING_TUTORIAL_TARGETS.stepNavItemPrefix}${step.id}`}
                    className={`h-[126px] w-full rounded-xl border px-3 py-2 text-left ${
                      active
                        ? 'border-blue-300 bg-blue-50'
                        : done
                          ? 'border-emerald-200 bg-emerald-50'
                          : canOpen
                            ? 'border-slate-200 bg-white hover:border-slate-300'
                            : 'border-slate-200 bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-slate-900">
                        {idx + 1}. {step.title}
                      </p>
                      <span className="text-[11px] text-slate-500">
                        {done ? '✓' : active ? 'Now' : canOpen ? '' : 'Locked'}
                      </span>
                    </div>
                    <p className="mt-2 text-[11px] text-slate-500 leading-snug">
                      {step.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </aside>

          <section
            className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5"
            data-onboarding-tutorial-target={ONBOARDING_TUTORIAL_TARGETS.activeStepPanel}
          >
            {currentStep === 'welcome' && (
              <div
                className="space-y-4"
                data-onboarding-tutorial-target={ONBOARDING_TUTORIAL_TARGETS.welcomePanel}
              >
                <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
                  Step 1
                </p>
                <h2 className="text-xl font-semibold text-slate-900">
                  Welcome to SgSL Learn
                </h2>
                <div className="space-y-2 rounded-2xl text-sm text-slate-600">
                  <p>This platform relies on input from your webcam, and consequently benefits from good positioning of your hands to improve the computer's recognition. </p>
                  <p>This quick setup guide will help you get familar with how to use the platform successfully.</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
                  <p className="font-semibold text-slate-900">
                    If recognition feels unstable:
                  </p>
                  <p className="mt-1">
                    Increase front lighting, keep your hands a consistent distance from the camera, and slow
                    down transitions in between handshapes (when appropriate)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleStartSetup}
                  disabled={savingStep === 'welcome'}
                  data-onboarding-tutorial-target={
                    ONBOARDING_TUTORIAL_TARGETS.welcomeStartButton
                  }
                  className="inline-flex items-center rounded-xl bg-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {savingStep === 'welcome' ? 'Starting...' : 'Start setup'}
                </button>
              </div>
            )}

            {currentStep === 'camera-check' && (
              <CameraCalibrationCheck
                onPassed={() => {
                  void markStepAndMove('camera-check', 'hold-check');
                }}
                pending={savingStep === 'camera-check'}
              />
            )}

            {currentStep === 'hold-check' && (
              <HoldMechanicCheck
                onPassed={() => {
                  void markStepAndMove('hold-check', 'fingerspelling-check');
                }}
                pending={savingStep === 'hold-check'}
              />
            )}

            {currentStep === 'fingerspelling-check' && (
              <LFingerspellingCheck
                onPassed={() => {
                  void markStepAndMove('fingerspelling-check', 'module-previews');
                }}
                pending={savingStep === 'fingerspelling-check'}
              />
            )}

            {currentStep === 'module-previews' && (
              <div
                className="space-y-4"
                data-onboarding-tutorial-target={
                  ONBOARDING_TUTORIAL_TARGETS.modulePreviewsPanel
                }
              >
                <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
                  Step 5
                </p>
                <h2 className="text-xl font-semibold text-slate-900">
                  Wrap-up and next steps
                </h2>
                <p className="text-sm text-slate-600">
                  You are ready to start learning. Keep these differences and tips
                  in mind as you begin Module 1.
                </p>

                <div
                  className="grid gap-3 md:grid-cols-2"
                  data-onboarding-tutorial-target={
                    ONBOARDING_TUTORIAL_TARGETS.modulePreviewGrid
                  }
                >
                  {MODULE_PREVIEWS.map((preview) => {
                    return (
                      <div
                        key={preview.id}
                        data-onboarding-tutorial-target={`${ONBOARDING_TUTORIAL_TARGETS.modulePreviewCardPrefix}${preview.id}`}
                        className="h-full rounded-xl border border-slate-200 bg-white p-3 text-left"
                      >
                        <p className="text-xs font-semibold text-slate-900">
                          {preview.title}
                        </p>
                        <p className="mt-1 text-[11px] text-slate-500">
                          {preview.cue}
                        </p>
                        <p className="mt-2 text-[11px] text-slate-500">
                          {preview.details}
                        </p>
                      </div>
                    );
                  })}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={handleFinish}
                    disabled={finishing}
                    data-onboarding-tutorial-target={
                      ONBOARDING_TUTORIAL_TARGETS.modulePreviewsFinishButton
                    }
                    className="inline-flex items-center rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {finishing
                      ? 'Finishing...'
                      : 'Complete onboarding and continue'}
                  </button>
                </div>
              </div>
            )}

            <div className="mt-6 border-t border-slate-200 pt-4">
              <p className="text-[11px] text-slate-500">
                Step {Math.max(1, currentStepIndex + 1)} of {STEP_META.length}
              </p>
            </div>
          </section>
        </main>
      </div>
    </>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
          <div className="rounded-2xl border border-slate-200 bg-white px-6 py-4 text-sm text-slate-500">
            Loading onboarding...
          </div>
        </div>
      }
    >
      <OnboardingPageContent />
    </Suspense>
  );
}

function CameraCalibrationCheck({
  onPassed,
  pending,
}: {
  onPassed: () => void;
  pending: boolean;
}) {
  const { videoRef, landmarks, error, running } = useHandRecognition();
  const [progress, setProgress] = useState(0);
  const [framingHint, setFramingHint] = useState(
    'Show one hand in frame to begin the check.',
  );
  const [canContinue, setCanContinue] = useState(false);
  const passedRef = useRef(false);
  const landmarksRef = useRef<number[] | null>(null);
  const progressMsRef = useRef(0);
  const lastTickRef = useRef<number | null>(null);

  useEffect(() => {
    landmarksRef.current = landmarks;
  }, [landmarks]);

  useEffect(() => {
    const targetHoldMs = 2000;
    const tolerance = 0.012;
    const interval = window.setInterval(() => {
      if (passedRef.current) return;
      const now = Date.now();
      const lastTick = lastTickRef.current ?? now;
      const delta = Math.max(16, now - lastTick);
      lastTickRef.current = now;

      const bounds = getHandBounds(landmarksRef.current);
      if (!bounds) {
        progressMsRef.current = Math.max(0, progressMsRef.current - delta * 1.5);
        setProgress(Math.round((progressMsRef.current / targetHoldMs) * 100));
        setFramingHint('Show one hand in frame to begin the check.');
        return;
      }

      const insideZone =
        bounds.minX >= FRAMING_ZONE.minX - tolerance &&
        bounds.maxX <= FRAMING_ZONE.maxX + tolerance &&
        bounds.minY >= FRAMING_ZONE.minY - tolerance &&
        bounds.maxY <= FRAMING_ZONE.maxY + tolerance;

      if (!insideZone) {
        progressMsRef.current = Math.max(0, progressMsRef.current - delta * 1.5);
        setProgress(Math.round((progressMsRef.current / targetHoldMs) * 100));
        if (bounds.minX < FRAMING_ZONE.minX - tolerance) {
          setFramingHint('Move your hand slightly to the right.');
        } else if (bounds.maxX > FRAMING_ZONE.maxX + tolerance) {
          setFramingHint('Move your hand slightly to the left.');
        } else if (bounds.minY < FRAMING_ZONE.minY - tolerance) {
          setFramingHint('Move your hand slightly down.');
        } else if (bounds.maxY > FRAMING_ZONE.maxY + tolerance) {
          setFramingHint('Move your hand slightly up.');
        } else {
          setFramingHint('Center your full hand inside the dashed zone.');
        }
        return;
      }

      setFramingHint('Great framing. Hold steady inside the zone.');
      progressMsRef.current = Math.min(targetHoldMs, progressMsRef.current + delta);
      const pct = Math.round((progressMsRef.current / targetHoldMs) * 100);
      setProgress(pct);

      if (pct >= 100) {
        passedRef.current = true;
        setCanContinue(true);
        setFramingHint('Great. Camera calibration passed.');
      }
    }, 80);
    return () => window.clearInterval(interval);
  }, []);

  const permissionIssue =
    !!error && /notallowed|permission|denied|access/i.test(error);

  return (
    <div
      className="space-y-4"
      data-onboarding-tutorial-target={ONBOARDING_TUTORIAL_TARGETS.cameraCheckPanel}
    >
      <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
        Step 2
      </p>
      <h2 className="text-xl font-semibold text-slate-900">
        Camera framing check
      </h2>
      <p className="text-sm text-slate-600">
        When using the platform, hand positioning is crucical. When using the webcam, target to keep your full hand centered in the dashed zone.
      </p>
      <p className="text-sm text-slate-600">
        Follow the instructions and keep your hand in the dashed zone for 2 seconds to pass this check. Please ensure to turn on your webcam and provide the site with the necessary permissions.
      </p>

      <div
        className="relative rounded-2xl border border-slate-200 bg-white p-3"
        data-onboarding-tutorial-target={
          ONBOARDING_TUTORIAL_TARGETS.cameraCheckCameraCard
        }
      >
        <div
          className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-slate-100"
          data-onboarding-tutorial-target={
            ONBOARDING_TUTORIAL_TARGETS.cameraCheckCaptureZone
          }
        >
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="h-full w-full object-cover"
            style={{ transform: 'scaleX(-1)' }}
          />
          <div
            className="pointer-events-none absolute rounded-xl border-2 border-dashed border-blue-200"
            style={{
              top: `${FRAMING_ZONE.minY * 100}%`,
              right: `${(1 - FRAMING_ZONE.maxX) * 100}%`,
              bottom: `${(1 - FRAMING_ZONE.maxY) * 100}%`,
              left: `${FRAMING_ZONE.minX * 100}%`,
            }}
          />
        </div>

        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-blue-500 transition-[width] duration-100"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-slate-500">
          {pending
            ? 'Saving progress...'
            : canContinue
              ? 'Great. Camera calibration passed. Continue when ready.'
              : !running
                ? 'Starting camera...'
                : framingHint}
        </p>

        {error && (
          <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-600">
            {permissionIssue
              ? 'Camera access is required. Enable camera permission in your browser and reload this page.'
              : `Camera issue: ${error}`}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={onPassed}
        disabled={!canContinue || pending}
        data-onboarding-tutorial-target={
          ONBOARDING_TUTORIAL_TARGETS.cameraCheckContinueButton
        }
        className="inline-flex items-center rounded-xl bg-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {pending ? 'Saving progress...' : 'Continue to hold check'}
      </button>
    </div>
  );
}

function HoldMechanicCheck({
  onPassed,
  pending,
}: {
  onPassed: () => void;
  pending: boolean;
}) {
  const [progress, setProgress] = useState(0);
  const holdStartRef = useRef<number | null>(null);
  const lastHitRef = useRef<number | null>(null);
  const passedRef = useRef(false);

  const handlePrediction = useCallback(() => {
    if (passedRef.current) return;
    const now = Date.now();
    lastHitRef.current = now;
    if (!holdStartRef.current) holdStartRef.current = now;
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (passedRef.current) return;
      const now = Date.now();
      if (!lastHitRef.current || now - lastHitRef.current > 260) {
        holdStartRef.current = null;
        setProgress((prev) => (prev === 0 ? prev : 0));
        return;
      }
      if (!holdStartRef.current) holdStartRef.current = now;
      const pct = Math.min(100, ((now - holdStartRef.current) / 800) * 100);
      setProgress(pct);
      if (pct >= 100) {
        passedRef.current = true;
        onPassed();
      }
    }, 50);

    return () => window.clearInterval(interval);
  }, [onPassed]);

  return (
    <div
      className="space-y-4"
      data-onboarding-tutorial-target={ONBOARDING_TUTORIAL_TARGETS.holdCheckPanel}
    >
      <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
        Step 3
      </p>
      <h2 className="text-xl font-semibold text-slate-900">
        Getting comfortable with signing individual letters
      </h2>
      <p className="text-sm text-slate-600">
        In module 1 of this platform, you will learn to sign individual letters of the alphabet. This involves forming and maintaing a specific shape with your right hand.
      </p>
      <p className="text-sm text-slate-600">
        To pass this check, we will learn to sign the letter 'L'. Copy the guide for letter L (with your right hand), then hold it steady in the frame for a second.
      </p>

      <div className="grid items-stretch gap-4 lg:grid-cols-2">
        <div
          className="h-full rounded-2xl border border-slate-200 bg-white p-4"
          data-onboarding-tutorial-target={
            ONBOARDING_TUTORIAL_TARGETS.holdCheckPracticeCard
          }
        >
          <StaticLetterPractice
            key="onboarding-hold-l"
            targetLetter="L"
            allowedLetters={['L']}
            confidenceThreshold={0.4}
            onConfidentPrediction={handlePrediction}
          />
        </div>
        <div
          className="h-full rounded-2xl border border-slate-200 bg-white p-4"
          data-onboarding-tutorial-target={ONBOARDING_TUTORIAL_TARGETS.holdCheckGuideCard}
        >
          <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
            Letter guide
          </p>
          <div className="mt-3 flex items-center justify-center rounded-xl border border-slate-200 bg-slate-50 p-3">
            <Image
              src="/images/L.png"
              alt="Guide for letter L"
              width={220}
              height={220}
              className="h-44 w-auto object-contain"
              style={{ transform: 'scaleX(-1)' }}
            />
          </div>
          <p className="mt-3 text-xs text-slate-600">
            Keep your hand centered and match this shape before holding.
          </p>
        </div>
      </div>

      <div
        className="rounded-2xl border border-slate-200 bg-white p-3"
        data-onboarding-tutorial-target={ONBOARDING_TUTORIAL_TARGETS.holdCheckProgressCard}
      >
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-emerald-500 transition-[width] duration-75"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-slate-500">
          {pending
            ? 'Saving progress...'
            : progress >= 100
              ? 'Hold mechanic passed.'
              : 'Hold the letter L shape steadily.'}
        </p>
      </div>
    </div>
  );
}

function LFingerspellingCheck({
  onPassed,
  pending,
}: {
  onPassed: () => void;
  pending: boolean;
}) {
  const completedRef = useRef(false);
  const [attemptKey, setAttemptKey] = useState(0);

  return (
    <div
      className="space-y-4"
      data-onboarding-tutorial-target={
        ONBOARDING_TUTORIAL_TARGETS.fingerspellingCheckPanel
      }
    >
      <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
        Step 4
      </p>
      <h2 className="text-xl font-semibold text-slate-900">
        Fingerspelling drill (L-L-L-L)
      </h2>
      <p className="text-sm text-slate-600">
        In module 2, you will learn to finger spell words using handshapes (i.e. alphabets) that you learned in module 1. This involves gesturing and releasing between letters.
      </p>
      <p className="text-sm text-slate-600">
        To pass this step, gesture and release the letter 'L' 4 times to simulate fingerspelling a word.
      </p>


      <div className="grid items-stretch gap-4 lg:grid-cols-1">
        <div
          className="h-full rounded-2xl border border-slate-200 bg-white p-4"
          data-onboarding-tutorial-target={
            ONBOARDING_TUTORIAL_TARGETS.fingerspellingCheckPracticeCard
          }
        >
          <FingerspellingPractice
            key={`onboarding-llll-${attemptKey}`}
            mode="practice"
            word="LLLL"
            minConfidence={0.4}
            minConfidenceByLetter={{ L: 0.4 }}
            onComplete={() => {
              if (completedRef.current) return;
              completedRef.current = true;
              onPassed();
            }}
            onExit={() => {
              setAttemptKey((prev) => prev + 1);
            }}
          />
        </div>
      </div>
    </div>
  );
}
