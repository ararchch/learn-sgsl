export const ONBOARDING_VERSION = 1 as const;

export const ONBOARDING_STEP_IDS = [
  'welcome',
  'camera-check',
  'hold-check',
  'fingerspelling-check',
  'module-previews',
] as const;

export type OnboardingStepId = (typeof ONBOARDING_STEP_IDS)[number];

export type OnboardingProfileFields = {
  onboardingVersionCompleted: number;
  onboardingStartedAt: string | null;
  onboardingCompletedAt: string | null;
  onboardingDurationMs: number | null;
  onboardingStepsCompleted: OnboardingStepId[];
};

export const DEFAULT_ONBOARDING_FIELDS: OnboardingProfileFields = {
  onboardingVersionCompleted: 0,
  onboardingStartedAt: null,
  onboardingCompletedAt: null,
  onboardingDurationMs: null,
  onboardingStepsCompleted: [],
};

const ONBOARDING_STEP_SET = new Set<OnboardingStepId>(ONBOARDING_STEP_IDS);

export function normalizeOnboardingSteps(value: unknown): OnboardingStepId[] {
  if (!Array.isArray(value)) return [];
  const unique = new Set<OnboardingStepId>();
  for (const step of value) {
    if (typeof step !== 'string') continue;
    if (!ONBOARDING_STEP_SET.has(step as OnboardingStepId)) continue;
    unique.add(step as OnboardingStepId);
  }
  return Array.from(unique);
}

export function mergeOnboardingSteps(
  current: OnboardingStepId[],
  incoming: OnboardingStepId[],
): OnboardingStepId[] {
  return Array.from(new Set<OnboardingStepId>([...current, ...incoming]));
}

export function hasCompletedOnboarding(
  profile:
    | Pick<OnboardingProfileFields, 'onboardingVersionCompleted'>
    | null
    | undefined,
  requiredVersion: number = ONBOARDING_VERSION,
) {
  return Number(profile?.onboardingVersionCompleted ?? 0) >= requiredVersion;
}
