'use client';

import { useMemo } from 'react';
import Module1LetterRecognition from '@/components/Module1LetterRecognition';

const PAIRS: [string, string][] = [
  ['A', 'S'],
  ['O', 'C'],
  ['N', 'T'],
  ['I', 'T'],
];

function shuffle(list: string[]) {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export default function Module1ConfusionLesson({
  onComplete,
}: {
  onComplete: () => void;
}) {
  const prompts = useMemo(() => {
    const base: string[] = [];
    PAIRS.forEach(([a, b]) => {
      base.push(a, b, a, b);
    });
    return shuffle(base);
  }, []);

  const options = useMemo(() => {
    const unique = new Set<string>();
    PAIRS.forEach(([a, b]) => {
      unique.add(a);
      unique.add(b);
    });
    return Array.from(unique);
  }, []);

  return (
    <Module1LetterRecognition
      promptLetters={prompts}
      options={options}
      title="Confusion pairs bootcamp"
      helper="Focus on the subtle differences. All prompts must be correct within 2 seconds."
      onComplete={onComplete}
    />
  );
}
