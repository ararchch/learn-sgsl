'use client';

import Module1LetterRecognition from '@/components/Module1LetterRecognition';

export default function Module1RecognitionLesson({
  letters,
  onComplete,
}: {
  letters: string[];
  onComplete: () => void;
}) {
  return (
    <Module1LetterRecognition
      promptLetters={letters}
      options={letters}
      title="Instant recognition"
      helper="Identify the letter being signed within 2 seconds."
      onComplete={onComplete}
    />
  );
}
