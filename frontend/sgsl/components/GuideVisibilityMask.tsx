import type { ReactNode } from 'react';

interface GuideVisibilityMaskProps {
  hidden: boolean;
  label?: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

export default function GuideVisibilityMask({
  hidden,
  label = 'Guide hidden',
  description = 'Use the toggle above whenever you want to reveal the guide again.',
  children,
  className = '',
}: GuideVisibilityMaskProps) {
  return (
    <div className={`relative overflow-hidden rounded-2xl ${className}`}>
      <div
        className={`transition duration-200 ${
          hidden ? 'pointer-events-none select-none opacity-0' : ''
        }`}
        aria-hidden={hidden}
      >
        {children}
      </div>

      {hidden && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-200">
          <div className="mx-6 rounded-2xl border border-dashed border-slate-300 bg-slate-100/90 px-5 py-4 text-center shadow-sm">
            <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
              {label}
            </p>
            <p className="mt-2 max-w-xs text-sm text-slate-600">{description}</p>
          </div>
        </div>
      )}
    </div>
  );
}
