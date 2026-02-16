export type LessonType = 'intro' | 'interactive' | 'gym' | 'test';
export type LessonMode = 'learn' | 'practice' | 'exam';

export interface LessonConfig {
  id: string;
  title: string;
  description: string;
  type: LessonType;
  mode: LessonMode;
  letters: string[];
  notes?: Record<string, string>;
}

export const MODULE_ONE_LETTERS = ['E', 'T', 'A', 'O', 'I', 'N', 'S', 'R', 'L', 'C'];

export const MODULE_ONE_LESSONS: LessonConfig[] = [
  {
    id: 'intro',
    title: 'Welcome & Calibration',
    description: 'Understand the platform mechanics and setup your camera.',
    type: 'intro',
    mode: 'learn',
    letters: [],
  },
  {
    id: 'high-frequency',
    title: 'Lesson 1: High Frequency Letters',
    description: 'Learn the five most common letters with guided feedback.',
    type: 'interactive',
    mode: 'learn',
    letters: ['E', 'T', 'A', 'O', 'I'],
    notes: {
      T: 'SgSL note: Some variations use an index placement instead of a thumb tuck.',
    },
  },
  {
    id: 'consonants',
    title: 'Lesson 2: Core Consonants',
    description: 'Build confidence with common consonant handshapes.',
    type: 'interactive',
    mode: 'learn',
    letters: ['N', 'S', 'R', 'L', 'C'],
    notes: {
      S: 'Contrast tip: S is a full fist, while A keeps the thumb along the side.',
    },
  },
  {
    id: 'gym',
    title: 'Lesson 3: Free Practice',
    description: 'Mix all 10 letters and practice at your own pace.',
    type: 'gym',
    mode: 'practice',
    letters: MODULE_ONE_LETTERS,
  },
  {
    id: 'final-test',
    title: 'Lesson 4: Final Test',
    description: 'Time attack with all 10 letters.',
    type: 'test',
    mode: 'exam',
    letters: MODULE_ONE_LETTERS,
  },
];
