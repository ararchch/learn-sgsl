'use client';

import { Space_Grotesk } from 'next/font/google';
import { useState } from 'react';

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
});

const signPresets = ['Down', 'Up', 'Left', 'Right', 'Hello', 'Thank You'];

const toTitleCase = (value: string) =>
  value
    .split(' ')
    .filter(Boolean)
    .map((word) => word[0]?.toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');

export default function PlaygroundPage() {
  const [query, setQuery] = useState('Down');
  const [activeSign, setActiveSign] = useState('Down');

  const handleGenerate = () => {
    const trimmed = query.trim();
    if (!trimmed) {
      return;
    }
    setActiveSign(toTitleCase(trimmed));
  };

  return (
    <div
      className={`${spaceGrotesk.className} min-h-screen text-white`}
      style={{
        background:
          'radial-gradient(circle at 12% 12%, rgba(124, 58, 237, 0.65), transparent 55%), radial-gradient(circle at 80% 20%, rgba(59, 130, 246, 0.35), transparent 60%), linear-gradient(180deg, #2d1b71 0%, #3a2da5 42%, #5645c8 100%)',
      }}
    >
      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-6">
        <header className="relative flex items-center justify-between">
          <button className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white shadow-[0_12px_30px_rgba(0,0,0,0.25)] transition hover:bg-white/20">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>

          <div className="absolute left-1/2 -translate-x-1/2 rounded-full bg-white/90 px-4 py-1 text-xs font-semibold uppercase tracking-wide text-[#3b2fa4] shadow-[0_10px_24px_rgba(0,0,0,0.22)]">
            Level 1 - Sign 2 of 4
          </div>

          <div className="rounded-full bg-[#120b2d] px-4 py-2 text-xs font-semibold shadow-[0_10px_26px_rgba(0,0,0,0.35)]">
            10 points
          </div>
        </header>

        <main className="mt-10 grid flex-1 gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:items-center">
          <section className="space-y-8">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/70">
                Prompted sign
              </p>
              <h1 className="mt-3 text-5xl font-semibold tracking-tight text-white drop-shadow-[0_14px_24px_rgba(0,0,0,0.35)] md:text-6xl">
                {activeSign}
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs text-white/80">
                Motion: index finger points downwards
              </div>
              <div className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs text-white/80">
                Next sign in 40s
              </div>
            </div>

            <div className="max-w-md rounded-3xl border border-white/20 bg-white/10 p-4 shadow-[0_18px_40px_rgba(0,0,0,0.35)]">
              <label className="text-[11px] font-semibold uppercase tracking-[0.25em] text-white/70">
                Try another sign
              </label>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Type a sign name"
                  className="w-full flex-1 rounded-2xl border border-white/20 bg-[#2a2060]/60 px-4 py-3 text-sm text-white placeholder:text-white/50 focus:border-white/60 focus:outline-none focus:ring-1 focus:ring-white/50"
                />
                <button
                  onClick={handleGenerate}
                  className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-[#3b2fa4] shadow-[0_12px_24px_rgba(0,0,0,0.3)] transition hover:-translate-y-0.5 hover:bg-white/90"
                >
                  Show
                </button>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {signPresets.map((preset) => (
                  <button
                    key={preset}
                    onClick={() => {
                      setQuery(preset);
                      setActiveSign(preset);
                    }}
                    className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/70 transition hover:border-white/60 hover:text-white"
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            <div className="relative flex h-[360px] items-center justify-center">
              <div className="avatar-body">
                <div className="avatar-head" />
                <div className="avatar-torso" />
                <div className="avatar-shoulder left" />
                <div className="avatar-shoulder right" />
                <div className="avatar-arm left">
                  <div className="avatar-forearm" />
                </div>
                <div className="avatar-arm right">
                  <div className="avatar-forearm" />
                </div>
                <div className="avatar-glow" />
              </div>
            </div>
          </section>

          <section className="flex flex-col items-center">
            <div className="relative w-full max-w-xl overflow-hidden rounded-[28px] border border-white/30 bg-gradient-to-br from-white/10 via-white/5 to-white/10 p-6 shadow-[0_28px_60px_rgba(0,0,0,0.4)]">
              <div className="camera-frame">
                <div className="camera-feed">
                  <div className="camera-subject" />
                  <div className="camera-grid" />
                  <div className="camera-corners" />
                  <div className="camera-skeleton">
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
                <div className="camera-caption">
                  Give it a go - index finger points downwards.
                </div>
              </div>
            </div>
            <p className="mt-4 text-xs text-white/70">
              No video or audio is captured or collected
            </p>
          </section>
        </main>
      </div>

      <style jsx>{`
        .avatar-body {
          position: relative;
          width: 240px;
          height: 320px;
          transform: translateY(8px);
          animation: float 4.2s ease-in-out infinite;
        }

        .avatar-head {
          position: absolute;
          left: 50%;
          top: 18px;
          width: 110px;
          height: 140px;
          transform: translateX(-50%);
          border-radius: 50% 50% 40% 40%;
          background: linear-gradient(140deg, #dbeafe 0%, #bfdbfe 60%, #9ac6ff 100%);
          box-shadow: inset -12px -14px 30px rgba(74, 222, 128, 0.25);
        }

        .avatar-torso {
          position: absolute;
          left: 50%;
          top: 125px;
          width: 180px;
          height: 160px;
          transform: translateX(-50%);
          border-radius: 120px;
          background: linear-gradient(160deg, #bfdbfe 0%, #9ac6ff 55%, #8ab8ff 100%);
          box-shadow: inset 0 18px 30px rgba(255, 255, 255, 0.45);
        }

        .avatar-shoulder {
          position: absolute;
          top: 150px;
          width: 70px;
          height: 70px;
          border-radius: 999px;
          background: linear-gradient(150deg, #e0f2fe, #93c5fd);
          box-shadow: inset 0 10px 20px rgba(255, 255, 255, 0.45);
        }

        .avatar-shoulder.left {
          left: 4px;
        }

        .avatar-shoulder.right {
          right: 4px;
        }

        .avatar-arm {
          position: absolute;
          top: 190px;
          width: 90px;
          height: 90px;
          transform-origin: top center;
        }

        .avatar-arm.left {
          left: 10px;
          transform: rotate(18deg);
        }

        .avatar-arm.right {
          right: 20px;
          transform: rotate(-25deg);
        }

        .avatar-forearm {
          position: absolute;
          top: 10px;
          left: 18px;
          width: 70px;
          height: 70px;
          border-radius: 28px;
          background: linear-gradient(150deg, #dbeafe, #93c5fd);
          box-shadow: inset 0 6px 16px rgba(255, 255, 255, 0.5);
        }

        .avatar-glow {
          position: absolute;
          left: 50%;
          top: 140px;
          width: 200px;
          height: 200px;
          transform: translateX(-50%);
          border-radius: 999px;
          background: radial-gradient(circle, rgba(147, 197, 253, 0.5), transparent 70%);
          filter: blur(12px);
        }

        .camera-frame {
          position: relative;
          border-radius: 24px;
          overflow: hidden;
          background: rgba(10, 10, 10, 0.35);
        }

        .camera-feed {
          position: relative;
          height: 420px;
          border-radius: 24px;
          background: linear-gradient(160deg, #646464 0%, #3f3f3f 40%, #2b2b2b 100%);
          filter: grayscale(0.2);
        }

        .camera-subject {
          position: absolute;
          left: 30%;
          top: 18%;
          width: 180px;
          height: 240px;
          border-radius: 30px;
          background: radial-gradient(circle at 40% 20%, #bfbfbf 0%, #737373 60%, #3d3d3d 100%);
          opacity: 0.6;
        }

        .camera-grid {
          position: absolute;
          inset: 0;
          background-image: linear-gradient(
              rgba(255, 255, 255, 0.05) 1px,
              transparent 1px
            ),
            linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px);
          background-size: 60px 60px;
          opacity: 0.4;
        }

        .camera-corners {
          position: absolute;
          inset: 16px;
          border-radius: 18px;
          border: 2px solid rgba(231, 229, 255, 0.4);
          box-shadow: inset 0 0 0 20px rgba(0, 0, 0, 0.08);
        }

        .camera-corners::before,
        .camera-corners::after {
          content: '';
          position: absolute;
          inset: 36px;
          border-radius: 20px;
          border: 2px dashed rgba(199, 210, 254, 0.25);
        }

        .camera-skeleton {
          position: absolute;
          right: 70px;
          top: 140px;
          display: grid;
          gap: 10px;
        }

        .camera-skeleton span {
          width: 48px;
          height: 48px;
          border-radius: 18px;
          background: rgba(56, 189, 248, 0.85);
          box-shadow: 0 10px 24px rgba(56, 189, 248, 0.45);
        }

        .camera-caption {
          position: absolute;
          left: 50%;
          bottom: 16px;
          transform: translateX(-50%);
          padding: 8px 18px;
          border-radius: 999px;
          background: rgba(17, 17, 17, 0.8);
          color: white;
          font-size: 12px;
          letter-spacing: 0.04em;
        }

        @keyframes float {
          0%,
          100% {
            transform: translateY(6px);
          }
          50% {
            transform: translateY(-6px);
          }
        }
      `}</style>
    </div>
  );
}
