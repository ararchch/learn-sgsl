import { NextResponse } from 'next/server';
import { getUser, updateProgress } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const username = String(body?.username ?? '').trim();
    const lessonId = String(body?.lessonId ?? '').trim();
    const xp = Number(body?.xp ?? 0);
    const unlockedModules = Array.isArray(body?.unlockedModules)
      ? (body.unlockedModules as number[]).filter((value) =>
          Number.isFinite(value),
        )
      : [];

    if (!username) {
      return NextResponse.json(
        { error: 'Username is required.' },
        { status: 400 },
      );
    }

    const existing = await getUser(username);
    if (!existing) {
      return NextResponse.json(
        { error: 'User not found.' },
        { status: 404 },
      );
    }

    const nextXp =
      Number.isFinite(xp) && xp !== 0 ? existing.xp + xp : existing.xp;

    const updates: {
      xp?: number;
      completedLessons?: string[];
      unlockedModules?: number[];
    } = {};

    if (nextXp !== existing.xp) {
      updates.xp = nextXp;
    }

    if (lessonId) {
      const currentLessons = existing.completedLessons ?? [];
      if (!currentLessons.includes(lessonId)) {
        updates.completedLessons = [...currentLessons, lessonId];
      }
    }
    if (unlockedModules.length > 0) {
      updates.unlockedModules = unlockedModules;
    }

    const profile = await updateProgress(username, updates);

    return NextResponse.json(profile, { status: 200 });
  } catch (error) {
    console.error('Progress update error', error);
    return NextResponse.json(
      { error: 'Unable to update progress.' },
      { status: 500 },
    );
  }
}
