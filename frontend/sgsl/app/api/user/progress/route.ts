import { NextResponse } from 'next/server';
import { createUser, getUser, updateUser } from '@/lib/db';

function toNonNegativeInt(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.round(parsed));
}

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unknown error';
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const username = String(body?.username ?? '').trim();
    const lessonId = String(body?.lessonId ?? '').trim();
    const xp = Number(body?.xp ?? 0);
    const streak = body?.streak;
    const lastLogin = body?.lastLogin;
    const requestedModule1LessonTour = Number(body?.module1lessontour);
    const requestedModule1Practice = Number(body?.module1practice);
    const requestedModule2Practice = Number(body?.module2practice);
    const requestedPlayground = Number(body?.playground);

    if (!username) {
      return NextResponse.json(
        { error: 'Username is required.' },
        { status: 400 },
      );
    }

    const existing = (await getUser(username)) ?? (await createUser(username));
    const updates: Parameters<typeof updateUser>[1] = {};

    if (lessonId && !existing.completedLessons.includes(lessonId)) {
      updates.completedLessons = [...existing.completedLessons, lessonId];
      if (Number.isFinite(xp) && xp > 0) {
        updates.xp = existing.xp + Math.round(xp);
      }
    } else if (Number.isFinite(xp) && xp !== 0) {
      updates.xp = existing.xp + Math.round(xp);
    }

    if (streak !== undefined) {
      updates.streak = toNonNegativeInt(streak);
    }

    if (lastLogin !== undefined && typeof lastLogin === 'string' && lastLogin.trim()) {
      updates.lastLogin = lastLogin;
    }

    if (Number.isFinite(requestedModule1LessonTour)) {
      const normalized = Math.max(0, Math.floor(requestedModule1LessonTour));
      if (normalized > existing.module1lessontour) {
        updates.module1lessontour = normalized;
      }
    }

    if (Number.isFinite(requestedModule1Practice)) {
      const normalized = Math.max(0, Math.floor(requestedModule1Practice));
      if (normalized > existing.module1practice) {
        updates.module1practice = normalized;
      }
    }

    if (Number.isFinite(requestedModule2Practice)) {
      const normalized = Math.max(0, Math.floor(requestedModule2Practice));
      if (normalized > existing.module2practice) {
        updates.module2practice = normalized;
      }
    }

    if (Number.isFinite(requestedPlayground)) {
      const normalized = Math.max(0, Math.floor(requestedPlayground));
      if (normalized > existing.playground) {
        updates.playground = normalized;
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(existing, { status: 200 });
    }

    const profile = await updateUser(username, updates);

    return NextResponse.json(profile, { status: 200 });
  } catch (error) {
    console.error('Progress update error', error);
    return NextResponse.json(
      {
        error:
          process.env.NODE_ENV === 'production'
            ? 'Unable to update progress.'
            : `Unable to update progress. ${toErrorMessage(error)}`,
      },
      { status: 500 },
    );
  }
}
