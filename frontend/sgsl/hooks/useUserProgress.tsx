'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type {
  OnboardingProfileFields,
  OnboardingStepId,
} from '@/lib/onboarding';

export type UserProfile = {
  username: string;
  xp: number;
  streak: number;
  lastLogin: string;
  completedLessons: string[];
  unlockedModules: number[];
} & OnboardingProfileFields;

type UserProgressContextValue = {
  profile: UserProfile | null;
  loading: boolean;
  completeLesson: (lessonId: string, xp?: number) => Promise<void>;
  unlockModule: (moduleId: number) => Promise<void>;
  refreshProfile: () => Promise<void>;
  startOnboarding: () => Promise<void>;
  completeOnboardingStep: (stepId: OnboardingStepId) => Promise<void>;
  completeOnboarding: (durationMs: number) => Promise<void>;
  resetOnboarding: () => Promise<void>;
  logout: () => void;
};

const UserProgressContext = createContext<UserProgressContextValue | null>(null);

function getCookieValue(name: string) {
  if (typeof document === 'undefined') return null;
  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split('=')[1]) : null;
}

export function UserProgressProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = useCallback(async () => {
    const username = getCookieValue('sgsl_user');
    if (!username) {
      setProfile(null);
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
      setProfile(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  const updateOnboardingState = useCallback(
    async (payload: {
      action: 'start' | 'step_complete' | 'complete' | 'reset';
      stepId?: OnboardingStepId;
      durationMs?: number;
      throwOnError?: boolean;
    }) => {
      const username = profile?.username ?? getCookieValue('sgsl_user');
      if (!username) return;
      try {
        const response = await fetch('/api/user/onboarding', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username,
            action: payload.action,
            stepId: payload.stepId,
            durationMs: payload.durationMs,
          }),
        });
        if (!response.ok) {
          let details = '';
          try {
            const body = (await response.json()) as { error?: string };
            details = body.error ? ` ${body.error}` : '';
          } catch {
            try {
              const text = await response.text();
              details = text ? ` ${text}` : '';
            } catch {
            }
          }
          throw new Error(
            `Unable to update onboarding state (HTTP ${response.status}).${details}`,
          );
        }
        const data = (await response.json()) as UserProfile;
        setProfile(data);
      } catch (error) {
        console.error(error);
        if (payload.throwOnError) {
          throw error;
        }
      }
    },
    [profile?.username],
  );

  const completeLesson = useCallback(
    async (lessonId: string, xp: number = 50) => {
      if (!profile?.username) return;
      if (profile.completedLessons.includes(lessonId)) return;

      const optimistic: UserProfile = {
        ...profile,
        xp: profile.xp + xp,
        completedLessons: [...profile.completedLessons, lessonId],
      };
      setProfile(optimistic);

      try {
        const response = await fetch('/api/user/progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: profile.username,
            lessonId,
            xp,
          }),
        });
        if (response.ok) {
          const data = (await response.json()) as UserProfile;
          setProfile(data);
        }
      } catch (error) {
        console.error(error);
      }
    },
    [profile],
  );

  const unlockModule = useCallback(
    async (moduleId: number) => {
      if (!profile?.username) return;
      if (profile.unlockedModules.includes(moduleId)) return;

      const optimistic: UserProfile = {
        ...profile,
        unlockedModules: [...profile.unlockedModules, moduleId],
      };
      setProfile(optimistic);

      try {
        const response = await fetch('/api/user/progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: profile.username,
            unlockedModules: [moduleId],
          }),
        });
        if (response.ok) {
          const data = (await response.json()) as UserProfile;
          setProfile(data);
        }
      } catch (error) {
        console.error(error);
      }
    },
    [profile],
  );

  const startOnboarding = useCallback(async () => {
    await updateOnboardingState({ action: 'start' });
  }, [updateOnboardingState]);

  const completeOnboardingStep = useCallback(
    async (stepId: OnboardingStepId) => {
      await updateOnboardingState({ action: 'step_complete', stepId });
    },
    [updateOnboardingState],
  );

  const completeOnboarding = useCallback(
    async (durationMs: number) => {
      await updateOnboardingState({ action: 'complete', durationMs });
    },
    [updateOnboardingState],
  );

  const resetOnboarding = useCallback(async () => {
    await updateOnboardingState({ action: 'reset', throwOnError: true });
  }, [updateOnboardingState]);

  const logout = useCallback(() => {
    if (typeof document !== 'undefined') {
      document.cookie =
        'sgsl_user=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    }
    setProfile(null);
    setLoading(false);
  }, []);

  const value = useMemo(
    () => ({
      profile,
      loading,
      completeLesson,
      unlockModule,
      refreshProfile,
      startOnboarding,
      completeOnboardingStep,
      completeOnboarding,
      resetOnboarding,
      logout,
    }),
    [
      profile,
      loading,
      completeLesson,
      unlockModule,
      refreshProfile,
      startOnboarding,
      completeOnboardingStep,
      completeOnboarding,
      resetOnboarding,
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
