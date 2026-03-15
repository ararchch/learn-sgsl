'use client';

import { motion } from 'framer-motion';

interface LessonCompletionModalProps {
  open: boolean;
  title: string;
  message: string;
  repeatLabel: string;
  moveOnLabel: string;
  onRepeat: () => void;
  onMoveOn: () => void;
}

export default function LessonCompletionModal({
  open,
  title,
  message,
  repeatLabel,
  moveOnLabel,
  onRepeat,
  onMoveOn,
}: LessonCompletionModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/40 px-4 backdrop-blur-sm">
      <motion.div
        role="dialog"
        aria-modal="true"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{
          type: 'spring',
          stiffness: 340,
          damping: 24,
        }}
        className="w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl ring-1 ring-slate-900/5 md:p-6"
      >
        <div className="mx-auto flex w-fit items-center justify-center rounded-2xl bg-blue-50 p-3 text-blue-600">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            className="h-5 w-5"
            aria-hidden="true"
          >
            <path
              d="M12 3l1.8 4.2L18 9l-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8L12 3zM18.5 14l1 2.2L22 17l-2.5.8-1 2.2-1-2.2L15 17l2.5-.8 1-2.2zM5.5 14l1 2.2L9 17l-2.5.8-1 2.2-1-2.2L2 17l2.5-.8 1-2.2z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <p className="mt-5 text-center text-[11px] uppercase tracking-[0.2em] text-blue-600">
          Lesson complete
        </p>
        <h3 className="mt-2 text-center text-xl font-semibold tracking-tight text-slate-900">
          {title}
        </h3>
        <p className="mt-3 text-center text-sm leading-relaxed text-slate-500">
          {message}
        </p>

        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={onRepeat}
            className="inline-flex w-full items-center justify-center rounded-xl bg-white px-5 py-3 text-sm font-medium text-slate-600 ring-1 ring-inset ring-slate-200 transition-all hover:bg-slate-50"
          >
            {repeatLabel}
          </button>
          <button
            type="button"
            onClick={onMoveOn}
            className="inline-flex w-full items-center justify-center rounded-xl bg-blue-600 px-5 py-3 text-sm font-medium text-white shadow-sm transition-all hover:bg-blue-500 active:scale-[0.98]"
          >
            {moveOnLabel}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
