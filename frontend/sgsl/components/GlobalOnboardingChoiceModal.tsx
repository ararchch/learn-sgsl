'use client';

import { useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useUserProgress } from '@/hooks/useUserProgress';
import { hasCompletedOnboarding } from '@/lib/onboarding';

function getNextPath(pathname: string | null): string {
  if (!pathname) return '/';
  if (!pathname.startsWith('/')) return '/';
  return pathname;
}

export default function GlobalOnboardingChoiceModal() {
  const pathname = usePathname();
  const router = useRouter();
  const {
    profile,
    loading,
    sessionMode,
    onboardingChoiceSeen,
    completeOnboarding,
    markOnboardingChoiceSeen,
  } = useUserProgress();
  const [pendingAction, setPendingAction] = useState<null | 'tutorial' | 'skip'>(
    null,
  );

  const shouldShow = useMemo(() => {
    if (loading || !profile) return false;
    if (pathname === '/login') return false;
    if (pathname?.startsWith('/onboarding')) return false;
    if (hasCompletedOnboarding(profile)) return false;

    if (sessionMode === 'guest') {
      return !onboardingChoiceSeen;
    }
    return true;
  }, [loading, profile, pathname, sessionMode, onboardingChoiceSeen]);

  if (!shouldShow) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/45 px-4">
      <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
        <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
          Before you start
        </p>
        <h2 className="mt-2 text-xl font-semibold text-slate-900">
          Do you want a quick tutorial?
        </h2>
        <p className="mt-3 text-sm text-slate-600">
          You can go through a short guided onboarding, or skip straight to
          practice.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            disabled={pendingAction !== null}
            onClick={() => {
              setPendingAction('tutorial');
              if (sessionMode === 'guest') {
                markOnboardingChoiceSeen();
              }
              const nextPath = getNextPath(pathname);
              router.push(`/onboarding?next=${encodeURIComponent(nextPath)}`);
            }}
            className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {pendingAction === 'tutorial' ? 'Opening tutorial...' : 'Take tutorial'}
          </button>
          <button
            type="button"
            disabled={pendingAction !== null}
            onClick={async () => {
              setPendingAction('skip');
              if (sessionMode === 'guest') {
                markOnboardingChoiceSeen();
              }
              await completeOnboarding();
              setPendingAction(null);
            }}
            className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {pendingAction === 'skip'
              ? 'Saving...'
              : 'I know what I’m doing'}
          </button>
        </div>
      </div>
    </div>
  );
}
