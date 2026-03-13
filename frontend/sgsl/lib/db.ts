import { Prisma } from '@prisma/client';
import { prisma } from './prisma';

export type UserProfile = {
  username: string;
  xp: number;
  streak: number;
  lastLogin: string;
  completedLessons: string[];
  module1lessontour: number;
  module1practice: number;
  module2practice: number;
  playground: number;
  onboardingVersionCompleted: number;
};

export type UserUpdate = Partial<Omit<UserProfile, 'username'>>;

type PrismaUserRecord = Awaited<ReturnType<typeof prisma.user.findUnique>>;

function buildCreatePayload(username: string, now: Date) {
  return {
    username,
    xp: 0,
    streak: 0,
    lastLogin: now,
    completedLessons: [],
    module1lessontour: 0,
    module1practice: 0,
    module2practice: 0,
    playground: 0,
    onboardingVersionCompleted: 0,
  };
}

function isUniqueConstraintError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}

function toNonNegativeInt(value: unknown, fallback: number = 0): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
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

function serializeUser(user: PrismaUserRecord): UserProfile | null {
  if (!user) return null;
  return {
    username: user.username,
    xp: toNonNegativeInt(user.xp),
    streak: toNonNegativeInt(user.streak),
    lastLogin: user.lastLogin.toISOString(),
    completedLessons: normalizeStringArray(user.completedLessons),
    module1lessontour: toNonNegativeInt(user.module1lessontour),
    module1practice: toNonNegativeInt(user.module1practice),
    module2practice: toNonNegativeInt(user.module2practice),
    playground: toNonNegativeInt(user.playground),
    onboardingVersionCompleted: toNonNegativeInt(user.onboardingVersionCompleted),
  };
}

function buildUpdatePayload(data: UserUpdate) {
  const payload: {
    xp?: number;
    streak?: number;
    lastLogin?: Date;
    completedLessons?: string[];
    module1lessontour?: number;
    module1practice?: number;
    module2practice?: number;
    playground?: number;
    onboardingVersionCompleted?: number;
  } = {};

  if (data.xp !== undefined) {
    payload.xp = toNonNegativeInt(data.xp);
  }
  if (data.streak !== undefined) {
    payload.streak = toNonNegativeInt(data.streak);
  }
  if (data.lastLogin !== undefined) {
    const parsed = new Date(data.lastLogin);
    payload.lastLogin = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  }
  if (data.completedLessons !== undefined) {
    payload.completedLessons = normalizeStringArray(data.completedLessons);
  }
  if (data.module1lessontour !== undefined) {
    payload.module1lessontour = toNonNegativeInt(data.module1lessontour);
  }
  if (data.module1practice !== undefined) {
    payload.module1practice = toNonNegativeInt(data.module1practice);
  }
  if (data.module2practice !== undefined) {
    payload.module2practice = toNonNegativeInt(data.module2practice);
  }
  if (data.playground !== undefined) {
    payload.playground = toNonNegativeInt(data.playground);
  }
  if (data.onboardingVersionCompleted !== undefined) {
    payload.onboardingVersionCompleted = toNonNegativeInt(
      data.onboardingVersionCompleted,
    );
  }

  return payload;
}

export async function getUser(username: string): Promise<UserProfile | null> {
  const normalizedUsername = username.trim();
  if (!normalizedUsername) return null;

  const user = await prisma.user.findUnique({
    where: { username: normalizedUsername },
  });

  return serializeUser(user);
}

export async function createUser(username: string): Promise<UserProfile> {
  const normalizedUsername = username.trim();
  const now = new Date();
  const existing = await prisma.user.findUnique({
    where: { username: normalizedUsername },
  });
  if (existing) {
    return serializeUser(existing)!;
  }

  try {
    const user = await prisma.user.create({
      data: buildCreatePayload(normalizedUsername, now),
    });

    return serializeUser(user)!;
  } catch (error) {
    if (!isUniqueConstraintError(error)) {
      throw error;
    }

    const user = await prisma.user.findUnique({
      where: { username: normalizedUsername },
    });
    if (!user) {
      throw error;
    }
    return serializeUser(user)!;
  }
}

export async function updateUser(
  username: string,
  data: UserUpdate,
): Promise<UserProfile | null> {
  const normalizedUsername = username.trim();
  if (!normalizedUsername) return null;

  const existing = await prisma.user.findUnique({
    where: { username: normalizedUsername },
  });
  if (!existing) return null;

  const user = await prisma.user.update({
    where: { username: normalizedUsername },
    data: buildUpdatePayload(data),
  });

  return serializeUser(user);
}

export async function touchLogin(username: string): Promise<UserProfile> {
  const normalizedUsername = username.trim();
  const now = new Date();
  const existing = await prisma.user.findUnique({
    where: { username: normalizedUsername },
  });

  if (existing) {
    const user = await prisma.user.update({
      where: { username: normalizedUsername },
      data: {
        lastLogin: now,
      },
    });

    return serializeUser(user)!;
  }

  try {
    const user = await prisma.user.create({
      data: buildCreatePayload(normalizedUsername, now),
    });

    return serializeUser(user)!;
  } catch (error) {
    if (!isUniqueConstraintError(error)) {
      throw error;
    }

    const user = await prisma.user.update({
      where: { username: normalizedUsername },
      data: {
        lastLogin: now,
      },
    });

    return serializeUser(user)!;
  }
}
