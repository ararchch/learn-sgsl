export const MODULE_ONE_LETTERS = [
  'E',
  'T',
  'A',
  'O',
  'I',
  'N',
  'S',
  'R',
  'L',
  'C',
] as const;

export type ModuleOneLetter = (typeof MODULE_ONE_LETTERS)[number];

export interface ModuleOneSign {
  letter: ModuleOneLetter;
  label: string;
  imageSrc: string;
  videoSrc: string | null;
  tip: string;
}

export const MODULE_ONE_SIGNS: ModuleOneSign[] = [
  {
    letter: 'E',
    label: 'E',
    imageSrc: '/images/E.png',
    videoSrc: '/videos/E.mp4',
    tip: 'Curl the fingers inward evenly and keep the thumb relaxed against the side.',
  },
  {
    letter: 'T',
    label: 'T',
    imageSrc: '/images/T.png',
    videoSrc: null,
    tip: 'Tuck the thumb cleanly and keep the handshape compact so the finger placement stays readable.',
  },
  {
    letter: 'A',
    label: 'A',
    imageSrc: '/images/A.png',
    videoSrc: '/videos/A.mp4',
    tip: 'Form a closed fist and keep the thumb resting alongside the hand, not crossing over the fingers.',
  },
  {
    letter: 'O',
    label: 'O',
    imageSrc: '/images/O.png',
    videoSrc: '/videos/O.mp4',
    tip: 'Make a rounded opening with the fingers and thumb and avoid squeezing the shape flat.',
  },
  {
    letter: 'I',
    label: 'I',
    imageSrc: '/images/I.png',
    videoSrc: '/videos/I.mp4',
    tip: 'Extend only the little finger and keep the other fingers folded consistently.',
  },
  {
    letter: 'N',
    label: 'N',
    imageSrc: '/images/N.png',
    videoSrc: '/videos/N.mp4',
    tip: 'Keep the selected fingers aligned and avoid letting the hand rotate away from the camera.',
  },
  {
    letter: 'S',
    label: 'S',
    imageSrc: '/images/S.png',
    videoSrc: '/videos/S.mp4',
    tip: 'Make a full fist and keep the thumb position distinct from A so the model can separate them.',
  },
  {
    letter: 'R',
    label: 'R',
    imageSrc: '/images/R.png',
    videoSrc: '/videos/R.mp4',
    tip: 'Cross the fingers cleanly and hold the hand steady so the crossing remains visible.',
  },
  {
    letter: 'L',
    label: 'L',
    imageSrc: '/images/L.png',
    videoSrc: '/videos/L.mp4',
    tip: 'Open the index finger and thumb into a clear L shape while keeping the remaining fingers folded.',
  },
  {
    letter: 'C',
    label: 'C',
    imageSrc: '/images/C.png',
    videoSrc: '/videos/C.mp4',
    tip: 'Curve the hand into a visible C shape and keep enough space between the thumb and fingers.',
  },
];

export const MODULE_ONE_SIGN_BY_LETTER: Record<ModuleOneLetter, ModuleOneSign> =
  Object.fromEntries(
    MODULE_ONE_SIGNS.map((sign) => [sign.letter, sign]),
  ) as Record<ModuleOneLetter, ModuleOneSign>;
