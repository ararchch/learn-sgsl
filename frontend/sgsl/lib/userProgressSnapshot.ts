export type GuestProgressSnapshot = {
  xp: number;
  completedLessons: string[];
  onboardingVersionCompleted: number;
  module1lessontour: number;
  module1practice: number;
  module2practice: number;
  playground: number;
  xpByLesson: Record<string, number>;
};
