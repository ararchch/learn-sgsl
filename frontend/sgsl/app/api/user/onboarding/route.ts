import { NextResponse } from 'next/server';
import { getUser, updateOnboarding } from '@/lib/db';
import {
  ONBOARDING_STEP_IDS,
  ONBOARDING_VERSION,
  type OnboardingStepId,
} from '@/lib/onboarding';

const ONBOARDING_STEP_SET = new Set<OnboardingStepId>(ONBOARDING_STEP_IDS);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const username = String(body?.username ?? '').trim();
    const action = String(body?.action ?? '').trim();
    const stepId = String(body?.stepId ?? '').trim();
    const durationMs = Number(body?.durationMs ?? 0);

    if (!username) {
      return NextResponse.json(
        { error: 'Username is required.' },
        { status: 400 },
      );
    }
    if (!action) {
      return NextResponse.json(
        { error: 'Action is required.' },
        { status: 400 },
      );
    }

    const existing = await getUser(username);
    if (!existing) {
      return NextResponse.json(
        { error: 'User not found.' },
        { status: 404 },
      );
    }

    const now = new Date().toISOString();

    if (action === 'start') {
      const profile = await updateOnboarding(username, {
        onboardingStartedAt: existing.onboardingStartedAt ?? now,
        onboardingCompletedAt: null,
        onboardingDurationMs: null,
      });
      if (!profile) {
        return NextResponse.json(
          { error: 'Unable to update onboarding.' },
          { status: 500 },
        );
      }
      return NextResponse.json(profile, { status: 200 });
    }

    if (action === 'step_complete') {
      if (!ONBOARDING_STEP_SET.has(stepId as OnboardingStepId)) {
        return NextResponse.json(
          { error: 'Invalid onboarding step.' },
          { status: 400 },
        );
      }
      const profile = await updateOnboarding(username, {
        onboardingStepsCompleted: [stepId as OnboardingStepId],
      });
      if (!profile) {
        return NextResponse.json(
          { error: 'Unable to update onboarding.' },
          { status: 500 },
        );
      }
      return NextResponse.json(profile, { status: 200 });
    }

    if (action === 'complete') {
      const duration =
        Number.isFinite(durationMs) && durationMs >= 0
          ? Math.round(durationMs)
          : null;

      const profile = await updateOnboarding(
        username,
        {
          onboardingVersionCompleted: ONBOARDING_VERSION,
          onboardingStartedAt: existing.onboardingStartedAt ?? now,
          onboardingCompletedAt: now,
          onboardingDurationMs: duration,
          onboardingStepsCompleted: [...ONBOARDING_STEP_IDS],
        },
        { mergeSteps: true },
      );
      if (!profile) {
        return NextResponse.json(
          { error: 'Unable to update onboarding.' },
          { status: 500 },
        );
      }
      return NextResponse.json(profile, { status: 200 });
    }

    if (action === 'reset') {
      const profile = await updateOnboarding(
        username,
        {
          onboardingVersionCompleted: 0,
          onboardingStartedAt: null,
          onboardingCompletedAt: null,
          onboardingDurationMs: null,
          onboardingStepsCompleted: [],
        },
        { mergeSteps: false },
      );
      if (!profile) {
        return NextResponse.json(
          { error: 'Unable to update onboarding.' },
          { status: 500 },
        );
      }
      return NextResponse.json(profile, { status: 200 });
    }

    return NextResponse.json({ error: 'Unsupported action.' }, { status: 400 });
  } catch (error) {
    console.error('Onboarding update error', error);
    return NextResponse.json(
      { error: 'Unable to update onboarding.' },
      { status: 500 },
    );
  }
}
