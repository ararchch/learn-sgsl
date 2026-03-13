'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useUserProgress } from '@/hooks/useUserProgress';
import { hasCompletedOnboarding } from '@/lib/onboarding';

export default function GlobalTopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { profile, loading, logout, sessionMode } = useUserProgress();
  const showPracticeNav = profile ? hasCompletedOnboarding(profile) : false;

  if (pathname === '/login') {
    return null;
  }

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="text-sm font-semibold tracking-wide text-slate-900 hover:text-slate-700"
          >
            SgSL Learn
          </Link>
          {showPracticeNav && (
            <div className="flex items-center gap-2 text-[11px] font-semibold">
              <Link
                href="/"
                className={`rounded-full px-3 py-1 transition ${
                  pathname === '/'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                }`}
              >
                Dashboard
              </Link>
              <Link
                href="/playground"
                className={`rounded-full px-3 py-1 transition ${
                  pathname === '/playground'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                }`}
              >
                Playground
              </Link>
            </div>
          )}
        </div>
        {profile && sessionMode === 'authenticated' ? (
          <div className="flex items-center gap-4 text-xs text-slate-600">
            <span>🔥 {profile.streak} streak</span>
            <span>⚡ {profile.xp} XP</span>
            <span>👤 {profile.username}</span>
            <button
              type="button"
              onClick={() => {
                logout();
                router.push('/');
              }}
              className="rounded-full border border-slate-200 px-3 py-1 text-[11px] font-semibold text-slate-500 hover:border-slate-300 hover:text-slate-700"
            >
              Log out
            </button>
          </div>
        ) : profile && sessionMode === 'guest' ? (
          <div className="flex items-center gap-3 text-xs text-slate-600">
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold text-slate-600">
              Guest session
            </span>
            <span>⚡ {profile.xp} XP</span>
            <Link
              href="/login"
              className="rounded-full bg-blue-600 px-3 py-1 text-[11px] font-semibold text-white hover:bg-blue-500"
            >
              Log in to save progress
            </Link>
          </div>
        ) : loading ? (
          <span className="text-xs text-slate-500">Loading session...</span>
        ) : null}
      </div>
    </nav>
  );
}
