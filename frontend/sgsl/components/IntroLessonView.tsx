'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';

export default function IntroLessonView({
  onComplete,
}: {
  onComplete: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const completedRef = useRef(false);
  const [reachedEnd, setReachedEnd] = useState(false);

  useEffect(() => {
    const root = scrollRef.current;
    const target = endRef.current;
    if (!root || !target) return;

    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setReachedEnd(true);
        }
      },
      { root, threshold: 0.6 },
    );

    obs.observe(target);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!reachedEnd) return;
    if (completedRef.current) return;
    completedRef.current = true;
    onComplete();
  }, [reachedEnd, onComplete]);

  return (
    <div className="grid gap-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto w-full max-w-3xl rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden"
      >
        <div className="border-b border-slate-200 bg-white px-6 py-5">
          <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
            Module 1
          </p>
          <h3 className="mt-1 text-2xl font-semibold text-slate-900">
            Welcome to Static Letters
          </h3>
          <p className="mt-2 text-sm text-slate-600">
            Read this once to understand what you will learn, how to use the
            lessons, and how to get the best results from the camera.
          </p>
        </div>

        <div ref={scrollRef} className="max-h-[65vh] overflow-y-auto px-6 py-6">
          <div className="space-y-8 text-sm text-slate-700">
            <section>
              <h4 className="text-sm font-semibold text-slate-900">
                What you will learn
              </h4>
              <p className="mt-2 text-slate-600">
                You will learn 10 foundational static letters used in SgSL
                fingerspelling: E, T, A, O, I, N, S, R, L, C. The goal is not
                just memorization, but producing each letter reliably on camera.
              </p>
            </section>

            <section>
              <h4 className="text-sm font-semibold text-slate-900">
                How to learn using this page
              </h4>
              <div className="mt-3 grid gap-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-semibold text-slate-900">
                    Learn
                  </p>
                  <p className="mt-1 text-slate-600">
                    Click a letter to open it, then watch the guide video/image
                    to understand the target handshape.
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-semibold text-slate-900">
                    Mirror
                  </p>
                  <p className="mt-1 text-slate-600">
                    Use the webcam mirror to match the guide. Focus on
                    consistency (same angle, same distance).
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-semibold text-slate-900">
                    Practice and test
                  </p>
                  <p className="mt-1 text-slate-600">
                    The flashcard practice prompts you with what to sign next.
                    The final test checks that you can produce the letters
                    under time pressure.
                  </p>
                </div>
              </div>
            </section>

            <section>
              <h4 className="text-sm font-semibold text-slate-900">
                Rules of the road
              </h4>
              <div className="mt-3 grid gap-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="inline-flex items-center gap-2">
                    <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-semibold text-white">
                      HAND
                    </span>
                    <p className="font-semibold text-slate-900">
                      Dominant hand
                    </p>
                  </div>
                  <p className="mt-2 text-slate-600">
                    Use one hand for all letters. Do not switch hands mid-lesson
                    unless you are re-calibrating.
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="inline-flex items-center gap-2">
                    <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-semibold text-white">
                      HOLD
                    </span>
                    <p className="font-semibold text-slate-900">
                      The hold mechanic
                    </p>
                  </div>
                  <p className="mt-2 text-slate-600">
                    To confirm an answer, you do not click. You hold the sign
                    steady for a moment. Use the on-screen indicator as your feedback.
                  </p>
                </div>
              </div>
            </section>

            <section>
              <h4 className="text-sm font-semibold text-slate-900">
                Camera setup (for best recognition)
              </h4>
              <div className="mt-3 grid gap-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="inline-flex items-center gap-2">
                    <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-semibold text-white">
                      LIGHT
                    </span>
                    <p className="font-semibold text-slate-900">Lighting</p>
                  </div>
                  <p className="mt-2 text-slate-600">
                    Be in a well-lit room. Avoid backlighting (bright windows
                    behind you), which can turn your hand into a silhouette.
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="inline-flex items-center gap-2">
                    <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-semibold text-white">
                      FRAME
                    </span>
                    <p className="font-semibold text-slate-900">
                      Position and framing
                    </p>
                  </div>
                  <p className="mt-2 text-slate-600">
                    Keep your hand fully visible and roughly centered. Avoid
                    being too close to the camera; give enough space so your
                    full hand is visible.
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="inline-flex items-center gap-2">
                    <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-semibold text-white">
                      MOTION
                    </span>
                    <p className="font-semibold text-slate-900">
                      Steadiness
                    </p>
                  </div>
                  <p className="mt-2 text-slate-600">
                    Small wrist rotations and drifting position can cause the
                    model to flicker. Slow down, hold steady, and reset between
                    attempts.
                  </p>
                </div>
              </div>
            </section>

            <section>
              <h4 className="text-sm font-semibold text-slate-900">
                Completion logic (how progress is counted)
              </h4>
              <div className="mt-3 grid gap-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="font-semibold text-slate-900">
                    Lessons 1 and 2
                  </p>
                  <p className="mt-2 text-slate-600">
                    You complete the lesson by visiting every letter (click
                    through each one). This ensures you saw all the content.
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="font-semibold text-slate-900">
                    Lesson 3 (Practice)
                  </p>
                  <p className="mt-2 text-slate-600">
                    You complete practice after 10 successful signs during the
                    flashcard flow.
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="font-semibold text-slate-900">Unlocks</p>
                  <p className="mt-2 text-slate-600">
                    Completing all Module 1 lessons unlocks Module 2.
                  </p>
                </div>
              </div>
            </section>

            <div ref={endRef} />
          </div>
        </div>

        <div className="border-t border-slate-200 bg-white px-6 py-4">
          <p className="text-[11px] text-slate-500">
            {reachedEnd
              ? 'Nice — lesson complete. Use the “Continue to next lesson” banner to proceed.'
              : 'Tip: Scroll to the end to complete this intro.'}
          </p>
        </div>
      </motion.div>
    </div>
  );
}
