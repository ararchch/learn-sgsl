import Script from 'next/script';
import {
  MEDIAPIPE_DRAWING_UTILS_SCRIPT_SRC,
  MEDIAPIPE_HANDS_SCRIPT_SRC,
} from '@/lib/mediapipe';

export default function MediaPipeScripts() {
  return (
    <>
      <Script
        id="mediapipe-hands"
        src={MEDIAPIPE_HANDS_SCRIPT_SRC}
        strategy="afterInteractive"
      />
      <Script
        id="mediapipe-drawing-utils"
        src={MEDIAPIPE_DRAWING_UTILS_SCRIPT_SRC}
        strategy="afterInteractive"
      />
    </>
  );
}
