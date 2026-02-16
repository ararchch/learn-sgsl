'use client';

type TimerState = 'idle' | 'running' | 'success' | 'fail';

export default function TimerBar({
  durationMs,
  elapsedMs,
  state,
}: {
  durationMs: number;
  elapsedMs: number;
  state: TimerState;
}) {
  const clamped = Math.max(0, Math.min(durationMs, elapsedMs));
  const pct = durationMs > 0 ? (clamped / durationMs) * 100 : 0;
  const colorClass =
    state === 'success'
      ? 'bg-emerald-500'
      : state === 'fail'
        ? 'bg-rose-500'
        : 'bg-blue-500';

  return (
    <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
      <div
        className={`h-full transition-[width] duration-75 ${colorClass}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
