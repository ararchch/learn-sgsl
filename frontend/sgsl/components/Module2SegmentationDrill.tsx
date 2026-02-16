'use client';

import Module2InstantWordsLesson from '@/components/Module2InstantWordsLesson';

export default function Module2SegmentationDrill({
  words,
  onComplete,
}: {
  words: string[];
  onComplete: () => void;
}) {
  return (
    <Module2InstantWordsLesson
      words={words}
      title="Segmentation basics"
      helper="Spell each word with a clear micro-pause between letters."
      onComplete={onComplete}
    />
  );
}
