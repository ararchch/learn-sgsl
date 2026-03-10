'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useUserProgress } from '@/hooks/useUserProgress';
import { hasCompletedOnboarding } from '@/lib/onboarding';

type ModuleMeta = {
  id: number;
  title: string;
  route: string;
  lessonIds: string[];
};

export default function Home() {
  const router = useRouter();
  const { profile, loading, resetOnboarding } = useUserProgress();
  const [isResettingOnboarding, setIsResettingOnboarding] = useState(false);

  const modules = useMemo<ModuleMeta[]>(
    () => [
      {
        id: 1,
        title: 'Module 1: Static Letters',
        route: '/module-1',
        lessonIds: [
          'module1-intro',
          'module1-high-frequency',
          'module1-consonants',
          'module1-gym',
          'module1-final-test',
        ],
      },
      {
        id: 2,
        title: 'Module 2: Fingerspelling',
        route: '/module-2',
        lessonIds: [
          'module2-intro',
          'module2-practice-short',
          'module2-practice-long',
          'module2-quiz-words',
        ],
      },
    ],
    [],
  );

  useEffect(() => {
    if (loading) return;
    if (!profile) {
      router.replace('/login');
      return;
    }
    if (!hasCompletedOnboarding(profile)) {
      router.replace(`/onboarding?next=${encodeURIComponent('/')}`);
    }
  }, [loading, profile, router]);

  const dashboard = useMemo(() => {
    if (!profile) return null;
    const unlocked = new Set(profile.unlockedModules ?? [1]);
    const completed = new Set(profile.completedLessons ?? []);

    const moduleProgress = modules.map((module) => {
      const done = module.lessonIds.filter((id) => completed.has(id)).length;
      return { ...module, done, total: module.lessonIds.length };
    });

    const nextModule = moduleProgress.find(
      (module) => unlocked.has(module.id) && module.done < module.total,
    );

    return {
      unlocked,
      moduleProgress,
      nextRoute: nextModule?.route ?? modules[0].route,
      currentModuleLabel: nextModule?.title ?? modules[0].title,
    };
  }, [modules, profile]);

  async function handleReplayOnboarding() {
    if (!profile) return;
    setIsResettingOnboarding(true);
    try {
      await resetOnboarding();
      router.push(`/onboarding?next=${encodeURIComponent('/')}`);
    } catch (error) {
      console.error('Replay onboarding failed', error);
    } finally {
      setIsResettingOnboarding(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <main className="mx-auto w-full max-w-6xl px-6 py-8">
        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
            Loading your dashboard...
          </div>
        ) : profile && dashboard ? (
          <div className="space-y-8">
            <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                Welcome back
              </p>
              <h1 className="mt-2 text-3xl font-semibold text-slate-900">
                Welcome back, {profile.username}!
              </h1>
              <p className="mt-2 text-sm text-slate-500">
                You are on {dashboard.currentModuleLabel}. Let&apos;s keep the
                streak alive.
              </p>
              <Link
                href={dashboard.nextRoute}
                className="mt-6 inline-flex items-center rounded-xl bg-blue-500 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-400"
              >
                Continue learning
              </Link>
              <button
                type="button"
                onClick={handleReplayOnboarding}
                disabled={isResettingOnboarding}
                className="mt-3 ml-3 inline-flex items-center rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isResettingOnboarding
                  ? 'Preparing onboarding...'
                  : 'Replay onboarding'}
              </button>
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
              {dashboard.moduleProgress.map((module) => {
                const isUnlocked = dashboard.unlocked.has(module.id);
                const progress = Math.round((module.done / module.total) * 100);
                return (
                  <div
                    key={module.id}
                    className={`rounded-2xl border p-5 ${
                      isUnlocked
                        ? 'border-slate-200 bg-white'
                        : 'border-slate-200 bg-slate-100 text-slate-400'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold">{module.title}</h3>
                      {!isUnlocked && <span>🔒</span>}
                    </div>
                    <p className="mt-2 text-xs">
                      {module.done}/{module.total} lessons
                    </p>
                    <div className="mt-3 h-2 w-full rounded-full bg-slate-200/80 overflow-hidden">
                      <div
                        className={`h-full ${
                          isUnlocked ? 'bg-blue-500' : 'bg-slate-300'
                        }`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    {isUnlocked && (
                      <Link
                        href={module.route}
                        className="mt-4 inline-flex text-xs font-semibold text-blue-600"
                      >
                        Open module
                      </Link>
                    )}
                  </div>
                );
              })}
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                    Practice anytime
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-slate-900">
                    Static Sign Playground
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm text-slate-500">
                    Jump straight into free practice for the 10 Module 1 static
                    signs. The playground is always available and does not
                    change your lesson progress.
                  </p>
                </div>

                <div className="flex flex-col items-start gap-3 lg:items-end">
                  <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                    Always unlocked
                  </span>
                  <Link
                    href="/playground"
                    className="inline-flex items-center rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    Open playground
                  </Link>
                </div>
              </div>
            </section>
          </div>
        ) : null}
      </main>
    </div>
  );
}
