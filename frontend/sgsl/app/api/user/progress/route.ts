import { NextResponse } from 'next/server';
import { createUser, getUser, updateProgress } from '@/lib/db';

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
    const requestedModule1TourVersion = Number(
      body?.module1LessonTourVersionCompleted,
    );
    const requestedModule1PracticeTourVersion = Number(
      body?.module1PracticeTourVersionCompleted,
    );
    const requestedModule2PracticeTourVersion = Number(
      body?.module2PracticeTourVersionCompleted,
    );
    const requestedPlaygroundTourVersion = Number(
      body?.playgroundTourVersionCompleted,
    );

    if (!username) {
      return NextResponse.json(
        { error: 'Username is required.' },
        { status: 400 },
      );
    }

    const existing = (await getUser(username)) ?? (await createUser(username));

    const nextXp =
      Number.isFinite(xp) && xp !== 0 ? existing.xp + xp : existing.xp;

    const updates: {
      xp?: number;
      completedLessons?: string[];
      unlockedModules?: number[];
      module1LessonTourVersionCompleted?: number;
      module1PracticeTourVersionCompleted?: number;
      module2PracticeTourVersionCompleted?: number;
      playgroundTourVersionCompleted?: number;
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
    if (Number.isFinite(requestedModule1TourVersion)) {
      const normalizedRequestedTourVersion = Math.max(
        0,
        Math.floor(requestedModule1TourVersion),
      );
      if (
        normalizedRequestedTourVersion >
        (existing.module1LessonTourVersionCompleted ?? 0)
      ) {
        updates.module1LessonTourVersionCompleted =
          normalizedRequestedTourVersion;
      }
    }
    if (Number.isFinite(requestedModule1PracticeTourVersion)) {
      const normalizedRequestedPracticeTourVersion = Math.max(
        0,
        Math.floor(requestedModule1PracticeTourVersion),
      );
      if (
        normalizedRequestedPracticeTourVersion >
        (existing.module1PracticeTourVersionCompleted ?? 0)
      ) {
        updates.module1PracticeTourVersionCompleted =
          normalizedRequestedPracticeTourVersion;
      }
    }
    if (Number.isFinite(requestedModule2PracticeTourVersion)) {
      const normalizedRequestedModule2PracticeTourVersion = Math.max(
        0,
        Math.floor(requestedModule2PracticeTourVersion),
      );
      if (
        normalizedRequestedModule2PracticeTourVersion >
        (existing.module2PracticeTourVersionCompleted ?? 0)
      ) {
        updates.module2PracticeTourVersionCompleted =
          normalizedRequestedModule2PracticeTourVersion;
      }
    }
    if (Number.isFinite(requestedPlaygroundTourVersion)) {
      const normalizedRequestedPlaygroundTourVersion = Math.max(
        0,
        Math.floor(requestedPlaygroundTourVersion),
      );
      if (
        normalizedRequestedPlaygroundTourVersion >
        (existing.playgroundTourVersionCompleted ?? 0)
      ) {
        updates.playgroundTourVersionCompleted =
          normalizedRequestedPlaygroundTourVersion;
      }
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
