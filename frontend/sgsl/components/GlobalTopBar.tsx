'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useUserProgress } from '@/hooks/useUserProgress';

export default function GlobalTopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { profile, loading, logout } = useUserProgress();

  if (pathname === '/login') {
    return null;
  }

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
        <Link
          href="/"
          className="text-sm font-semibold tracking-wide text-slate-900 hover:text-slate-700"
        >
          SgSL Learn
        </Link>
        {profile ? (
          <div className="flex items-center gap-4 text-xs text-slate-600">
            <span>🔥 {profile.streak} streak</span>
            <span>⚡ {profile.xp} XP</span>
            <span>👤 {profile.username}</span>
            <button
              type="button"
              onClick={() => {
                logout();
                router.push('/login');
              }}
              className="rounded-full border border-slate-200 px-3 py-1 text-[11px] font-semibold text-slate-500 hover:border-slate-300 hover:text-slate-700"
            >
              Log out
            </button>
          </div>
        ) : loading ? (
          <span className="text-xs text-slate-500">Loading session...</span>
        ) : null}
      </div>
    </nav>
  );
}
