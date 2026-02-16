'use client';

import Link from 'next/link';

const modules = [
  {
    id: 1,
    title: 'Module 1 · Static Letters',
    description: 'Learn individual letters with real-time AI feedback.',
    href: '/module-1',
  },
  {
    id: 2,
    title: 'Module 2 · Fingerspelling',
    description: 'Chain letters together to spell complete words.',
    href: '/module-2',
  },
  {
    id: 3,
    title: 'Module 3 · Simple Vocabulary',
    description: 'Practice everyday vocabulary signs with AI feedback.',
    href: '/module-3',
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 md:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-xs font-bold text-white">
              SgSL
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-base font-semibold">SgSL Learn</span>
              <span className="text-xs text-slate-500">
                Your sign language learning hub
              </span>
            </div>
          </div>
          <span className="text-xs font-medium text-slate-500">
            Level 1 · Beginner
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 md:px-6">
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
            Home
          </p>
          <h1 className="mt-2 text-2xl font-semibold md:text-3xl">
            Choose a module to start learning
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Pick a module below. Each one has teaching, practice, and testing
            built in.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {modules.map((module) => (
            <div
              key={module.id}
              className="flex flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">
                Module {module.id}
              </p>
              <h2 className="mt-2 text-base font-semibold text-slate-900">
                {module.title.replace(/^Module \d+ · /, '')}
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                {module.description}
              </p>
              <Link href={module.href} className="mt-4">
                <button className="w-full rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 transition">
                  Open module
                </button>
              </Link>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
