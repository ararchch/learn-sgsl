'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { ONBOARDING_VERSION } from '@/lib/onboarding';
import {
  MODULE1_LESSON_TOUR_VERSION,
  MODULE1_PRACTICE_TOUR_VERSION,
  MODULE2_PRACTICE_TOUR_VERSION,
  PLAYGROUND_TOUR_VERSION,
} from '@/lib/module1Tour';
import type { GuestProgressSnapshot } from '@/lib/userProgressSnapshot';

export type SessionMode = 'guest' | 'authenticated';

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

type GuestSessionState = {
  version: number;
  profile: UserProfile;
  xpByLesson: Record<string, number>;
  onboardingChoiceSeen: boolean;
};

type UserProgressContextValue = {
  profile: UserProfile | null;
  loading: boolean;
  sessionMode: SessionMode;
  isAuthenticated: boolean;
  onboardingChoiceSeen: boolean;
  login: (username: string) => Promise<UserProfile>;
  completeLesson: (lessonId: string, xp?: number) => Promise<void>;
  refreshProfile: () => Promise<void>;
  completeOnboarding: () => Promise<void>;
  completeModule1LessonTour: (version?: number) => Promise<void>;
  completeModule1PracticeTour: (version?: number) => Promise<void>;
  completeModule2PracticeTour: (version?: number) => Promise<void>;
  completePlaygroundTour: (version?: number) => Promise<void>;
  resetOnboarding: () => Promise<void>;
  markOnboardingChoiceSeen: () => void;
  logout: () => void;
};

const UserProgressContext = createContext<UserProgressContextValue | null>(null);

const SGSL_USER_COOKIE = 'sgsl_user';
const GUEST_SESSION_STORAGE_KEY = 'sgsl_guest_session_v2';
const GUEST_SESSION_VERSION = 2;

type TutorialField =
  | 'module1lessontour'
  | 'module1practice'
  | 'module2practice'
  | 'playground';

function getCookieValue(name: string) {
  if (typeof document === 'undefined') return null;
  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split('=')[1]) : null;
}

function toNonNegativeInt(value: unknown, fallback: number = 0): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.round(parsed));
}

function toIsoOrNow(value: unknown): string {
  if (typeof value !== 'string') return new Date().toISOString();
  const trimmed = value.trim();
  return trimmed || new Date().toISOString();
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .filter((entry): entry is string => typeof entry === 'string')
        .map((entry) => entry.trim())
        .filter(Boolean),
    ),
  );
}

function sanitizeProfile(
  raw: Partial<UserProfile> | null | undefined,
  options: { fallbackUsername: string },
): UserProfile {
  const usernameRaw = typeof raw?.username === 'string' ? raw.username.trim() : '';
  const username = usernameRaw || options.fallbackUsername;

  return {
    username,
    xp: toNonNegativeInt(raw?.xp),
    streak: toNonNegativeInt(raw?.streak),
    lastLogin: toIsoOrNow(raw?.lastLogin),
    completedLessons: normalizeStringArray(raw?.completedLessons),
    module1lessontour: toNonNegativeInt(raw?.module1lessontour),
    module1practice: toNonNegativeInt(raw?.module1practice),
    module2practice: toNonNegativeInt(raw?.module2practice),
    playground: toNonNegativeInt(raw?.playground),
    onboardingVersionCompleted: toNonNegativeInt(raw?.onboardingVersionCompleted),
  };
}

function createFreshGuestProfile(): UserProfile {
  return sanitizeProfile(
    {
      username: 'Guest',
      xp: 0,
      streak: 0,
      lastLogin: new Date().toISOString(),
      completedLessons: [],
      module1lessontour: 0,
      module1practice: 0,
      module2practice: 0,
      playground: 0,
      onboardingVersionCompleted: 0,
    },
    { fallbackUsername: 'Guest' },
  );
}

function normalizeXpByLesson(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const input = value as Record<string, unknown>;
  const entries: Array<[string, number]> = [];
  for (const [lessonId, xpValue] of Object.entries(input)) {
    const normalizedLesson = lessonId.trim();
    if (!normalizedLesson) continue;
    const normalizedXp = toNonNegativeInt(xpValue);
    if (normalizedXp <= 0) continue;
    entries.push([normalizedLesson, normalizedXp]);
  }

  return Object.fromEntries(entries);
}

function createFreshGuestSession(): GuestSessionState {
  return {
    version: GUEST_SESSION_VERSION,
    profile: createFreshGuestProfile(),
    xpByLesson: {},
    onboardingChoiceSeen: false,
  };
}

function readGuestSession(): GuestSessionState {
  if (typeof window === 'undefined') {
    return createFreshGuestSession();
  }

  try {
    const raw = sessionStorage.getItem(GUEST_SESSION_STORAGE_KEY);
    if (!raw) return createFreshGuestSession();

    const parsed = JSON.parse(raw) as Partial<GuestSessionState>;
    if (parsed.version !== GUEST_SESSION_VERSION) {
      return createFreshGuestSession();
    }

    return {
      version: GUEST_SESSION_VERSION,
      profile: sanitizeProfile(parsed.profile, { fallbackUsername: 'Guest' }),
      xpByLesson: normalizeXpByLesson(parsed.xpByLesson),
      onboardingChoiceSeen: parsed.onboardingChoiceSeen === true,
    };
  } catch {
    return createFreshGuestSession();
  }
}

function writeGuestSession(state: GuestSessionState) {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(GUEST_SESSION_STORAGE_KEY, JSON.stringify(state));
  } catch {
  }
}

function clearGuestSessionStorage() {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(GUEST_SESSION_STORAGE_KEY);
  } catch {
  }
}

function buildGuestSnapshot(
  profile: UserProfile,
  xpByLesson: Record<string, number>,
): GuestProgressSnapshot {
  return {
    xp: profile.xp,
    completedLessons: [...profile.completedLessons],
    onboardingVersionCompleted: profile.onboardingVersionCompleted,
    module1lessontour: profile.module1lessontour,
    module1practice: profile.module1practice,
    module2practice: profile.module2practice,
    playground: profile.playground,
    xpByLesson: { ...xpByLesson },
  };
}

export function UserProgressProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sessionMode, setSessionMode] = useState<SessionMode>('guest');
  const [loading, setLoading] = useState(true);
  const [authenticatedProfile, setAuthenticatedProfile] =
    useState<UserProfile | null>(null);
  const [guestSession, setGuestSession] = useState<GuestSessionState>(
    createFreshGuestSession,
  );

  const profile =
    sessionMode === 'authenticated' ? authenticatedProfile : guestSession.profile;

  useEffect(() => {
    if (sessionMode !== 'guest') return;
    writeGuestSession(guestSession);
  }, [sessionMode, guestSession]);

  const applyAuthenticatedProfile = useCallback(
    (data: UserProfile | null, fallbackUsername: string) => {
      if (!data) {
        setAuthenticatedProfile(null);
        return;
      }
      setAuthenticatedProfile(
        sanitizeProfile(data, { fallbackUsername }),
      );
    },
    [],
  );

  const refreshProfile = useCallback(async () => {
    const username = getCookieValue(SGSL_USER_COOKIE);
    if (!username) {
      setAuthenticatedProfile(null);
      setGuestSession(readGuestSession());
      setSessionMode('guest');
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/user/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      });
      if (!response.ok) throw new Error('Unable to load profile');

      const data = (await response.json()) as UserProfile;
      applyAuthenticatedProfile(data, username);
      setSessionMode('authenticated');
    } catch (error) {
      console.error(error);
      setAuthenticatedProfile(null);
      setGuestSession(readGuestSession());
      setSessionMode('guest');
    } finally {
      setLoading(false);
    }
  }, [applyAuthenticatedProfile]);

  useEffect(() => {
    void refreshProfile();
  }, [refreshProfile]);

  const login = useCallback(
    async (rawUsername: string) => {
      const username = rawUsername.trim();
      if (!username) {
        throw new Error('Please enter your name to continue.');
      }

      setLoading(true);
      try {
        const payload: {
          username: string;
          guestSnapshot?: GuestProgressSnapshot;
        } = { username };

        if (sessionMode === 'guest') {
          payload.guestSnapshot = buildGuestSnapshot(
            guestSession.profile,
            guestSession.xpByLesson,
          );
        }

        const response = await fetch('/api/user/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          let details = '';
          try {
            const body = (await response.json()) as { error?: string };
            details = body.error ? ` ${body.error}` : '';
          } catch {
          }
          throw new Error(`Unable to log in.${details}`.trim());
        }

        const data = (await response.json()) as UserProfile;
        const sanitized = sanitizeProfile(data, { fallbackUsername: username });

        if (typeof document !== 'undefined') {
          document.cookie = `sgsl_user=${encodeURIComponent(
            username,
          )}; path=/; max-age=${60 * 60 * 24 * 30}`;
        }

        clearGuestSessionStorage();
        setGuestSession(createFreshGuestSession());
        setAuthenticatedProfile(sanitized);
        setSessionMode('authenticated');

        return sanitized;
      } finally {
        setLoading(false);
      }
    },
    [sessionMode, guestSession],
  );

  const updateOnboardingState = useCallback(
    async (action: 'complete' | 'reset', options?: { throwOnError?: boolean }) => {
      if (sessionMode === 'guest') {
        setGuestSession((current) => ({
          ...current,
          profile: sanitizeProfile(
            {
              ...current.profile,
              onboardingVersionCompleted:
                action === 'complete' ? ONBOARDING_VERSION : 0,
            },
            { fallbackUsername: 'Guest' },
          ),
        }));
        return;
      }

      const username = authenticatedProfile?.username ?? getCookieValue(SGSL_USER_COOKIE);
      if (!username) return;

      try {
        const response = await fetch('/api/user/onboarding', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, action }),
        });
        if (!response.ok) {
          let details = '';
          try {
            const body = (await response.json()) as { error?: string };
            details = body.error ? ` ${body.error}` : '';
          } catch {
          }
          throw new Error(
            `Unable to update onboarding state (HTTP ${response.status}).${details}`,
          );
        }

        const data = (await response.json()) as UserProfile;
        applyAuthenticatedProfile(data, username);
      } catch (error) {
        console.error(error);
        if (options?.throwOnError) {
          throw error;
        }
      }
    },
    [sessionMode, authenticatedProfile, applyAuthenticatedProfile],
  );

  const completeLesson = useCallback(
    async (lessonId: string, xp: number = 50) => {
      const normalizedLessonId = lessonId.trim();
      if (!normalizedLessonId) return;
      const normalizedXp = toNonNegativeInt(xp);

      if (sessionMode === 'guest') {
        setGuestSession((current) => {
          if (current.profile.completedLessons.includes(normalizedLessonId)) {
            return current;
          }

          return {
            ...current,
            profile: sanitizeProfile(
              {
                ...current.profile,
                xp: current.profile.xp + normalizedXp,
                completedLessons: [
                  ...current.profile.completedLessons,
                  normalizedLessonId,
                ],
              },
              { fallbackUsername: 'Guest' },
            ),
            xpByLesson:
              normalizedXp > 0
                ? { ...current.xpByLesson, [normalizedLessonId]: normalizedXp }
                : current.xpByLesson,
          };
        });
        return;
      }

      if (!authenticatedProfile?.username) return;
      if (authenticatedProfile.completedLessons.includes(normalizedLessonId)) {
        return;
      }

      const optimistic = sanitizeProfile(
        {
          ...authenticatedProfile,
          xp: authenticatedProfile.xp + normalizedXp,
          completedLessons: [
            ...authenticatedProfile.completedLessons,
            normalizedLessonId,
          ],
        },
        { fallbackUsername: authenticatedProfile.username },
      );
      setAuthenticatedProfile(optimistic);

      try {
        const response = await fetch('/api/user/progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: authenticatedProfile.username,
            lessonId: normalizedLessonId,
            xp: normalizedXp,
          }),
        });
        if (response.ok) {
          const data = (await response.json()) as UserProfile;
          applyAuthenticatedProfile(data, authenticatedProfile.username);
        }
      } catch (error) {
        console.error(error);
      }
    },
    [sessionMode, authenticatedProfile, applyAuthenticatedProfile],
  );

  const persistTutorialProgress = useCallback(
    async (field: TutorialField, version: number) => {
      if (!Number.isFinite(version)) return;
      const normalizedVersion = Math.max(0, Math.floor(version));

      if (sessionMode === 'guest') {
        setGuestSession((current) => {
          if (current.profile[field] >= normalizedVersion) {
            return current;
          }

          return {
            ...current,
            profile: sanitizeProfile(
              {
                ...current.profile,
                [field]: normalizedVersion,
              },
              { fallbackUsername: 'Guest' },
            ),
          };
        });
        return;
      }

      if (!authenticatedProfile?.username) return;
      if (authenticatedProfile[field] >= normalizedVersion) {
        return;
      }

      const optimistic = sanitizeProfile(
        {
          ...authenticatedProfile,
          [field]: normalizedVersion,
        },
        { fallbackUsername: authenticatedProfile.username },
      );
      setAuthenticatedProfile(optimistic);

      try {
        const response = await fetch('/api/user/progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: authenticatedProfile.username,
            [field]: normalizedVersion,
          }),
        });
        if (response.ok) {
          const data = (await response.json()) as UserProfile;
          applyAuthenticatedProfile(data, authenticatedProfile.username);
        }
      } catch (error) {
        console.error(error);
      }
    },
    [sessionMode, authenticatedProfile, applyAuthenticatedProfile],
  );

  const completeOnboarding = useCallback(async () => {
    await updateOnboardingState('complete');
  }, [updateOnboardingState]);

  const completeModule1LessonTour = useCallback(
    async (version: number = MODULE1_LESSON_TOUR_VERSION) => {
      await persistTutorialProgress('module1lessontour', version);
    },
    [persistTutorialProgress],
  );

  const completeModule1PracticeTour = useCallback(
    async (version: number = MODULE1_PRACTICE_TOUR_VERSION) => {
      await persistTutorialProgress('module1practice', version);
    },
    [persistTutorialProgress],
  );

  const completeModule2PracticeTour = useCallback(
    async (version: number = MODULE2_PRACTICE_TOUR_VERSION) => {
      await persistTutorialProgress('module2practice', version);
    },
    [persistTutorialProgress],
  );

  const completePlaygroundTour = useCallback(
    async (version: number = PLAYGROUND_TOUR_VERSION) => {
      await persistTutorialProgress('playground', version);
    },
    [persistTutorialProgress],
  );

  const resetOnboarding = useCallback(async () => {
    await updateOnboardingState('reset', { throwOnError: true });
  }, [updateOnboardingState]);

  const markOnboardingChoiceSeen = useCallback(() => {
    if (sessionMode !== 'guest') return;
    setGuestSession((current) => {
      if (current.onboardingChoiceSeen) return current;
      return {
        ...current,
        onboardingChoiceSeen: true,
      };
    });
  }, [sessionMode]);

  const logout = useCallback(() => {
    if (typeof document !== 'undefined') {
      document.cookie =
        'sgsl_user=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    }
    clearGuestSessionStorage();
    setAuthenticatedProfile(null);
    setGuestSession(createFreshGuestSession());
    setSessionMode('guest');
    setLoading(false);
  }, []);

  const value = useMemo(
    () => ({
      profile,
      loading,
      sessionMode,
      isAuthenticated: sessionMode === 'authenticated',
      onboardingChoiceSeen:
        sessionMode === 'guest' ? guestSession.onboardingChoiceSeen : true,
      login,
      completeLesson,
      refreshProfile,
      completeOnboarding,
      completeModule1LessonTour,
      completeModule1PracticeTour,
      completeModule2PracticeTour,
      completePlaygroundTour,
      resetOnboarding,
      markOnboardingChoiceSeen,
      logout,
    }),
    [
      profile,
      loading,
      sessionMode,
      guestSession.onboardingChoiceSeen,
      login,
      completeLesson,
      refreshProfile,
      completeOnboarding,
      completeModule1LessonTour,
      completeModule1PracticeTour,
      completeModule2PracticeTour,
      completePlaygroundTour,
      resetOnboarding,
      markOnboardingChoiceSeen,
      logout,
    ],
  );

  return (
    <UserProgressContext.Provider value={value}>
      {children}
    </UserProgressContext.Provider>
  );
}

export function useUserProgress() {
  const context = useContext(UserProgressContext);
  if (!context) {
    throw new Error('useUserProgress must be used within UserProgressProvider');
  }
  return context;
}
