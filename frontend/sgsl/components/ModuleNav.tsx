'use client';

import Link from 'next/link';
import { useUserProgress } from '@/hooks/useUserProgress';

export default function ModuleNav({
  currentModule,
}: {
  currentModule: 1 | 2 | 3;
}) {
  const { profile } = useUserProgress();
  const unlocked = new Set(profile?.unlockedModules ?? [1]);

  return (
    <div className="w-full border-b border-slate-200 bg-white/80 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3 text-xs font-semibold text-slate-600">
          <Link href="/" className="text-slate-700 hover:text-slate-900">
            ← Home
          </Link>
          <span className="text-slate-300">|</span>
          <span className="uppercase tracking-[0.2em] text-[10px] text-slate-400">
            Modules
          </span>
          <div className="flex items-center gap-2">
            {[1, 2].map((id) => {
              const isUnlocked = unlocked.has(id);
              const isActive = currentModule === id;

              const classes = `rounded-full border px-3 py-1 text-[11px] transition ${
                isActive
                  ? 'border-blue-200 bg-blue-50 text-blue-700'
                  : isUnlocked
                  ? 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                  : 'border-slate-200 bg-slate-100 text-slate-300 cursor-not-allowed'
              }`;

              if (!isUnlocked) {
                return (
                  <span key={id} className={classes}>
                    Module {id} 🔒
                  </span>
                );
              }

              return (
                <Link key={id} href={`/module-${id}`} className={classes}>
                  Module {id}
                </Link>
              );
            })}
          </div>
        </div>
        <span className="text-[11px] text-slate-400">
          SgSL Learn
        </span>
      </div>
    </div>
  );
}
