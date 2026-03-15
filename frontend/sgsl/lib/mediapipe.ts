export const MEDIAPIPE_HANDS_ASSET_ROOT = '/vendor/mediapipe/hands';
export const MEDIAPIPE_HANDS_SCRIPT_SRC =
  `${MEDIAPIPE_HANDS_ASSET_ROOT}/hands.js`;
export const MEDIAPIPE_DRAWING_UTILS_SCRIPT_SRC =
  '/vendor/mediapipe/drawing_utils/drawing_utils.js';

export function getMediaPipeHandsAssetUrl(file: string) {
  return `${MEDIAPIPE_HANDS_ASSET_ROOT}/${file}`;
}
