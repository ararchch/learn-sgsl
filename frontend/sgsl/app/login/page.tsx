'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUserProgress } from '@/hooks/useUserProgress';

export default function LoginPage() {
  const router = useRouter();
  const { refreshProfile } = useUserProgress();
  const [username, setUsername] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = username.trim();
    if (!trimmed) {
      setError('Please enter your name to continue.');
      return;
    }
    try {
      setIsSubmitting(true);
      setError(null);
      const response = await fetch('/api/user/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: trimmed }),
      });
      if (!response.ok) {
        throw new Error('Unable to log in.');
      }
      document.cookie = `sgsl_user=${encodeURIComponent(
        trimmed,
      )}; path=/; max-age=${60 * 60 * 24 * 30}`;
      await refreshProfile();
      router.push('/');
    } catch (err) {
      console.error(err);
      setError('Could not start your session. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-lg">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-500 text-2xl font-semibold text-white">
            Sg
          </div>
          <h1 className="mt-4 text-2xl font-semibold text-slate-900">
            Welcome to SgSL Learn.
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Enter your name to save your progress and keep your streak.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-500">
              Enter your name
            </label>
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              placeholder="e.g. Mei"
            />
          </div>
          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-600">
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-xl bg-blue-500 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? 'Starting…' : 'Start Learning'}
          </button>
        </form>
      </div>
    </div>
  );
}
