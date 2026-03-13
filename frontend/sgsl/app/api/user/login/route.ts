import { NextResponse } from 'next/server';
import { createUser, getUser, touchLogin, updateUser } from '@/lib/db';
import type { GuestProgressSnapshot } from '@/lib/userProgressSnapshot';

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unknown error';
}

function toNonNegativeInt(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.round(parsed));
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

function normalizeXpByLesson(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

  const entries: Array<[string, number]> = [];
  for (const [lessonId, xpValue] of Object.entries(value as Record<string, unknown>)) {
    const normalizedLesson = lessonId.trim();
    if (!normalizedLesson) continue;

    const normalizedXp = toNonNegativeInt(xpValue);
    if (normalizedXp <= 0) continue;

    entries.push([normalizedLesson, normalizedXp]);
  }

  return Object.fromEntries(entries);
}

function normalizeGuestSnapshot(value: unknown): GuestProgressSnapshot | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const raw = value as Record<string, unknown>;
  return {
    xp: toNonNegativeInt(raw.xp),
    completedLessons: normalizeStringArray(raw.completedLessons),
    onboardingVersionCompleted: toNonNegativeInt(raw.onboardingVersionCompleted),
    module1lessontour: toNonNegativeInt(raw.module1lessontour),
    module1practice: toNonNegativeInt(raw.module1practice),
    module2practice: toNonNegativeInt(raw.module2practice),
    playground: toNonNegativeInt(raw.playground),
    xpByLesson: normalizeXpByLesson(raw.xpByLesson),
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const username = String(body?.username ?? '').trim();
    const guestSnapshot = normalizeGuestSnapshot(body?.guestSnapshot);

    if (!username) {
      return NextResponse.json(
        { error: 'Username is required.' },
        { status: 400 },
      );
    }

    let profile = (await getUser(username)) ?? (await createUser(username));

    if (guestSnapshot) {
      const existingLessons = new Set(profile.completedLessons);
      const mergedLessons = Array.from(
        new Set([...profile.completedLessons, ...guestSnapshot.completedLessons]),
      );

      let xpDelta = 0;
      for (const lessonId of guestSnapshot.completedLessons) {
        if (existingLessons.has(lessonId)) continue;
        xpDelta += guestSnapshot.xpByLesson[lessonId] ?? 0;
      }

      const updates: Parameters<typeof updateUser>[1] = {};

      if (mergedLessons.length !== profile.completedLessons.length) {
        updates.completedLessons = mergedLessons;
      }
      if (xpDelta > 0) {
        updates.xp = profile.xp + xpDelta;
      }

      const nextModule1LessonTour = Math.max(
        profile.module1lessontour,
        guestSnapshot.module1lessontour,
      );
      if (nextModule1LessonTour !== profile.module1lessontour) {
        updates.module1lessontour = nextModule1LessonTour;
      }

      const nextModule1Practice = Math.max(
        profile.module1practice,
        guestSnapshot.module1practice,
      );
      if (nextModule1Practice !== profile.module1practice) {
        updates.module1practice = nextModule1Practice;
      }

      const nextModule2Practice = Math.max(
        profile.module2practice,
        guestSnapshot.module2practice,
      );
      if (nextModule2Practice !== profile.module2practice) {
        updates.module2practice = nextModule2Practice;
      }

      const nextPlayground = Math.max(profile.playground, guestSnapshot.playground);
      if (nextPlayground !== profile.playground) {
        updates.playground = nextPlayground;
      }

      const nextOnboardingVersion = Math.max(
        profile.onboardingVersionCompleted,
        guestSnapshot.onboardingVersionCompleted,
      );
      if (nextOnboardingVersion !== profile.onboardingVersionCompleted) {
        updates.onboardingVersionCompleted = nextOnboardingVersion;
      }

      if (Object.keys(updates).length > 0) {
        const mergedProfile = await updateUser(username, updates);
        if (mergedProfile) {
          profile = mergedProfile;
        }
      }
    }

    profile = await touchLogin(username);

    return NextResponse.json(profile, { status: 200 });
  } catch (error) {
    console.error('Login error', error);
    return NextResponse.json(
      {
        error:
          process.env.NODE_ENV === 'production'
            ? 'Unable to login right now.'
            : `Unable to login right now. ${toErrorMessage(error)}`,
      },
      { status: 500 },
    );
  }
}
