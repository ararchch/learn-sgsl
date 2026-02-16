'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';

export default function Module2IntroLessonView({
  onComplete,
}: {
  onComplete: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const completedRef = useRef(false);
  const [reachedEnd, setReachedEnd] = useState(false);

  const title = useMemo(() => 'Module 2: Fingerspelling Words', []);

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
            Lesson 1
          </p>
          <h3 className="mt-1 text-2xl font-semibold text-slate-900">
            From letters to words
          </h3>
          <p className="mt-2 text-sm text-slate-600">
            You already know the handshapes. Now we chain letters into readable
            words with clean pauses and resets.
          </p>
        </div>

        <div ref={scrollRef} className="max-h-[65vh] overflow-y-auto px-6 py-6">
          <div className="space-y-8 text-sm text-slate-700">
            <section>
              <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
              <p className="mt-2 text-slate-600">
                Module 1 focused on single handshapes. Module 2 focuses on
                fingerspelling words, where transitions between letters matter as
                much as the final handshape.
              </p>
            </section>

            <section>
              <h4 className="text-sm font-semibold text-slate-900">
                What you will learn
              </h4>
              <div className="mt-3 grid gap-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="font-semibold text-slate-900">
                    Spell short words clearly
                  </p>
                  <p className="mt-2 text-slate-600">
                    You will spell words letter-by-letter (for example, T-E-N)
                    and keep a steady rhythm so each letter is readable.
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="font-semibold text-slate-900">
                    Control timing between letters
                  </p>
                  <p className="mt-2 text-slate-600">
                    You will learn when to hold, when to pause, and how to reset
                    so letters do not blend into each other.
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="font-semibold text-slate-900">
                    Know the completion target
                  </p>
                  <p className="mt-2 text-slate-600">
                    Practice builds consistency first. The test then checks if you
                    can keep that consistency under a time limit.
                  </p>
                </div>
              </div>
            </section>

            <section>
              <h4 className="text-sm font-semibold text-slate-900">
                The core shift: from letters to transitions
              </h4>
              <div className="mt-3 grid gap-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="inline-flex items-center gap-2">
                    <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-semibold text-white">
                      BEAT
                    </span>
                    <p className="font-semibold text-slate-900">Micro-pause</p>
                  </div>
                  <p className="mt-2 text-slate-600">
                    After each letter, pause briefly—just long enough to be
                    stable—before moving to the next letter. This separates one
                    letter from the next.
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="inline-flex items-center gap-2">
                    <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-semibold text-white">
                      RESET
                    </span>
                    <p className="font-semibold text-slate-900">Relax</p>
                  </div>
                  <p className="mt-2 text-slate-600">
                    Between letters, relax your hand slightly so your next
                    letter looks distinct. Without a reset, transitions can look
                    like a blended shape and produce wrong letters.
                  </p>
                </div>
              </div>
            </section>

            <section>
              <h4 className="text-sm font-semibold text-slate-900">
                Worked example (T-E-N)
              </h4>
              <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="font-semibold text-slate-900">Try this rhythm</p>
                <p className="mt-2 text-slate-600">
                  T (hold) → micro-pause → E (hold) → micro-pause → N (hold).
                </p>
                <p className="mt-2 text-slate-600">
                  If letters merge, increase the pause slightly before the next
                  letter.
                </p>
              </div>
            </section>

            <section>
              <h4 className="text-sm font-semibold text-slate-900">
                How to use Module 2
              </h4>
              <div className="mt-3 grid gap-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="font-semibold text-slate-900">
                    Practice mode (Guided spelling)
                  </p>
                  <p className="mt-2 text-slate-600">
                    Spell the word in order. Hold each letter until it is
                    accepted, then reset and move on. Use Exit if you want to
                    restart a word.
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="font-semibold text-slate-900">
                    Test mode (time-limited)
                  </p>
                  <p className="mt-2 text-slate-600">
                    Accuracy comes first. If you rush, you’ll get extra letters
                    or skips. Keep your rhythm steady, and use Exit if you need
                    to end the run early.
                  </p>
                </div>
              </div>
            </section>

            <section>
              <h4 className="text-sm font-semibold text-slate-900">
                Technical tips (to help recognition)
              </h4>
              <div className="mt-3 grid gap-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="font-semibold text-slate-900">
                    Keep your hand in one zone
                  </p>
                  <p className="mt-2 text-slate-600">
                    Don’t drift left/right between letters. Fingerspelling moves
                    more, so staying centered matters more here than Module 1.
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="font-semibold text-slate-900">
                    Use consistent distance + lighting
                  </p>
                  <p className="mt-2 text-slate-600">
                    Keep a repeatable distance from the camera and avoid
                    backlighting. If recognition is unstable, fix lighting
                    before changing your signing.
                  </p>
                </div>
              </div>
            </section>

            <section>
              <h4 className="text-sm font-semibold text-slate-900">
                Common issues (fast fixes)
              </h4>
              <div className="mt-3 grid gap-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="font-semibold text-slate-900">
                    It adds extra letters
                  </p>
                  <p className="mt-2 text-slate-600">
                    You are blending transitions. Reset your hand more clearly
                    and pause briefly between letters.
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="font-semibold text-slate-900">
                    It skips letters
                  </p>
                  <p className="mt-2 text-slate-600">
                    You are moving too fast. Slow down and make each letter a
                    distinct “snapshot.”
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
