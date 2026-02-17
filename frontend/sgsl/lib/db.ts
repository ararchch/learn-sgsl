import { promises as fs } from 'fs';
import path from 'path';
import {
  DEFAULT_ONBOARDING_FIELDS,
  mergeOnboardingSteps,
  normalizeOnboardingSteps,
  type OnboardingProfileFields,
  type OnboardingStepId,
} from './onboarding';

type UserProfile = {
  username: string;
  xp: number;
  streak: number;
  lastLogin: string;
  completedLessons: string[];
  unlockedModules: number[];
} & OnboardingProfileFields;

type UserUpdate = Partial<Omit<UserProfile, 'username'>> & {
  completedLessons?: string[];
  unlockedModules?: number[];
  onboardingStepsCompleted?: OnboardingStepId[];
};

type OnboardingUpdate = Partial<OnboardingProfileFields>;

function resolveDataPath(): string {
  const configuredPath = process.env.USERS_DATA_PATH?.trim();
  if (configuredPath) {
    return path.isAbsolute(configuredPath)
      ? configuredPath
      : path.join(process.cwd(), configuredPath);
  }

  if (process.env.VERCEL) {
    // Vercel serverless functions can only write to /tmp.
    return path.join('/tmp', 'sgsl', 'users.json');
  }

  return path.join(process.cwd(), 'data', 'users.json');
}

const DATA_PATH = resolveDataPath();

async function ensureDataFile() {
  await fs.mkdir(path.dirname(DATA_PATH), { recursive: true });
  try {
    await fs.access(DATA_PATH);
  } catch {
    await fs.writeFile(DATA_PATH, JSON.stringify([], null, 2), 'utf8');
  }
}

function parseUsersArray(raw: string): { parsed: unknown[]; recovered: boolean } {
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return { parsed, recovered: false };
    }
  } catch {
  }

  const firstArrayStart = raw.indexOf('[');
  if (firstArrayStart < 0) {
    throw new Error('Users data file is not a JSON array.');
  }

  for (
    let end = raw.lastIndexOf(']');
    end >= firstArrayStart;
    end = raw.lastIndexOf(']', end - 1)
  ) {
    const candidate = raw.slice(firstArrayStart, end + 1).trim();
    if (!candidate) continue;
    try {
      const parsed = JSON.parse(candidate);
      if (Array.isArray(parsed)) {
        return { parsed, recovered: true };
      }
    } catch {
    }
  }

  throw new Error('Unable to parse users data file.');
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

function normalizeNumberArray(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map((item) => Number(item))
        .filter((item) => Number.isFinite(item) && item > 0)
        .map((item) => Math.floor(item)),
    ),
  );
}

function normalizeNullableIsoString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeNullableMs(value: unknown): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.round(parsed);
}

function normalizeUser(raw: unknown): UserProfile | null {
  if (!raw || typeof raw !== 'object') return null;
  const user = raw as Record<string, unknown>;
  const username =
    typeof user.username === 'string' ? user.username.trim() : '';
  if (!username) return null;

  const xp = Number.isFinite(Number(user.xp)) ? Number(user.xp) : 0;
  const streak = Number.isFinite(Number(user.streak)) ? Number(user.streak) : 0;
  const lastLogin =
    typeof user.lastLogin === 'string' && user.lastLogin.trim()
      ? user.lastLogin
      : new Date().toISOString();
  const completedLessons = normalizeStringArray(user.completedLessons);
  const unlockedModules = normalizeNumberArray(user.unlockedModules);
  const onboardingVersionCompleted = Number.isFinite(
    Number(user.onboardingVersionCompleted),
  )
    ? Math.max(0, Math.floor(Number(user.onboardingVersionCompleted)))
    : DEFAULT_ONBOARDING_FIELDS.onboardingVersionCompleted;
  const onboardingStartedAt = normalizeNullableIsoString(
    user.onboardingStartedAt,
  );
  const onboardingCompletedAt = normalizeNullableIsoString(
    user.onboardingCompletedAt,
  );
  const onboardingDurationMs = normalizeNullableMs(user.onboardingDurationMs);
  const onboardingStepsCompleted = normalizeOnboardingSteps(
    user.onboardingStepsCompleted,
  );

  return {
    username,
    xp: Math.max(0, Math.round(xp)),
    streak: Math.max(0, Math.round(streak)),
    lastLogin,
    completedLessons,
    unlockedModules: unlockedModules.length > 0 ? unlockedModules : [1],
    onboardingVersionCompleted,
    onboardingStartedAt,
    onboardingCompletedAt,
    onboardingDurationMs,
    onboardingStepsCompleted,
  };
}

async function readUsers(): Promise<UserProfile[]> {
  await ensureDataFile();
  const raw = await fs.readFile(DATA_PATH, 'utf8');
  const { parsed, recovered } = parseUsersArray(raw);
  const users = parsed
    .map((entry) => normalizeUser(entry))
    .filter((entry): entry is UserProfile => entry !== null);

  if (recovered) {
    console.warn('Recovered malformed users data file and rewrote normalized JSON.');
    await writeUsers(users);
  }

  return users;
}

async function writeUsers(users: UserProfile[]) {
  await ensureDataFile();
  await fs.writeFile(DATA_PATH, JSON.stringify(users, null, 2), 'utf8');
}

export async function getUser(username: string): Promise<UserProfile | null> {
  const users = await readUsers();
  return users.find((user) => user.username === username) ?? null;
}

export async function createUser(username: string): Promise<UserProfile> {
  const users = await readUsers();
  const existing = users.find((user) => user.username === username);
  if (existing) return existing;
  const now = new Date().toISOString();
  const profile: UserProfile = {
    username,
    xp: 0,
    streak: 0,
    lastLogin: now,
    completedLessons: [],
    unlockedModules: [1],
    ...DEFAULT_ONBOARDING_FIELDS,
  };
  users.push(profile);
  await writeUsers(users);
  return profile;
}

export async function updateProgress(
  username: string,
  data: UserUpdate,
): Promise<UserProfile | null> {
  const users = await readUsers();
  const index = users.findIndex((user) => user.username === username);
  if (index === -1) return null;

  const current = users[index];
  const mergedLessons = data.completedLessons
    ? Array.from(new Set([...current.completedLessons, ...data.completedLessons]))
    : current.completedLessons;
  const mergedModules = data.unlockedModules
    ? Array.from(new Set([...current.unlockedModules, ...data.unlockedModules]))
    : current.unlockedModules;
  const mergedOnboardingSteps = data.onboardingStepsCompleted
    ? mergeOnboardingSteps(
        current.onboardingStepsCompleted,
        normalizeOnboardingSteps(data.onboardingStepsCompleted),
      )
    : current.onboardingStepsCompleted;

  const next: UserProfile = {
    ...current,
    ...data,
    completedLessons: mergedLessons,
    unlockedModules: mergedModules,
    onboardingStepsCompleted: mergedOnboardingSteps,
  };

  users[index] = normalizeUser(next) ?? current;
  await writeUsers(users);
  return users[index];
}

export async function updateOnboarding(
  username: string,
  data: OnboardingUpdate,
  options: { mergeSteps?: boolean } = {},
): Promise<UserProfile | null> {
  const users = await readUsers();
  const index = users.findIndex((user) => user.username === username);
  if (index === -1) return null;

  const current = users[index];
  const mergeSteps = options.mergeSteps ?? true;
  const nextSteps = Array.isArray(data.onboardingStepsCompleted)
    ? normalizeOnboardingSteps(data.onboardingStepsCompleted)
    : undefined;

  const onboardingStepsCompleted =
    nextSteps === undefined
      ? current.onboardingStepsCompleted
      : mergeSteps
        ? mergeOnboardingSteps(current.onboardingStepsCompleted, nextSteps)
        : nextSteps;

  const next: UserProfile = normalizeUser({
    ...current,
    ...data,
    onboardingStepsCompleted,
  }) ?? current;

  users[index] = next;
  await writeUsers(users);
  return users[index];
}

export async function touchLogin(username: string): Promise<UserProfile> {
  const users = await readUsers();
  const index = users.findIndex((user) => user.username === username);
  if (index === -1) {
    return createUser(username);
  }
  const now = new Date().toISOString();
  users[index] = { ...users[index], lastLogin: now };
  await writeUsers(users);
  return users[index];
}

export type { UserProfile };
