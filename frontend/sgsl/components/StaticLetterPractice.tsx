'use client';

import { useEffect, useEffectEvent, useRef, useState } from 'react';

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000';
const R_MINI_FEEDBACK_WINDOW = 60;

const R_MINI_PALM_LANDMARKS = [0, 5, 9, 13, 17] as const;
const R_MINI_CHECK_CONFIGS = [
  {
    id: 'vertical',
    label: 'Vertical',
    modelFilename: 'r_vertical_js_browser.json',
    landmarks: [0, 5, 6, 7, 8, 9, 10, 11, 12, 13, 17],
    fix: 'Keep your index and middle fingers upright and vertical.',
  },
  {
    id: 'cross',
    label: 'Cross',
    modelFilename: 'r_cross_js_browser.json',
    landmarks: [0, 5, 6, 7, 8, 9, 10, 11, 12, 13, 17],
    fix: 'Hold upright and cross your index and middle fingers.',
  },
  {
    id: 'tuck',
    label: 'Tuck',
    modelFilename: 'r_tuck_js_browser.json',
    landmarks: [0, 5, 9, 13, 14, 15, 16, 17, 18, 19, 20],
    fix: 'Curl your pinky and ring fingers into your palm.',
  },
  {
    id: 'thumb',
    label: 'Thumb',
    modelFilename: 'r_thumb_js_browser.json',
    landmarks: [0, 1, 2, 3, 4, 5, 9, 13, 14, 15, 16, 17, 18, 19, 20],
    fix: 'Place thumb over pinky and ring finger.',
  },
] as const;

type HandLandmark = {
  x: number;
  y: number;
  z?: number;
};

type LegacyGetUserMedia = (
  constraints: MediaStreamConstraints,
  success: (stream: MediaStream) => void,
  failure: (error: unknown) => void,
) => void;

type MediaPipeHands = {
  setOptions: (options: {
    maxNumHands: number;
    modelComplexity: number;
    minDetectionConfidence: number;
    minTrackingConfidence: number;
  }) => void;
  onResults: (callback: (results: MPResults) => void | Promise<void>) => void;
  close?: () => void;
  send: (payload: { image: HTMLVideoElement }) => Promise<void>;
};

type HandsConstructor = new (options: {
  locateFile: (file: string) => string;
}) => MediaPipeHands;

type DrawingUtilsInstance = {
  drawConnectors: (
    hand: HandLandmark[],
    connections: unknown,
    options: { lineWidth: number },
  ) => void;
  drawLandmarks: (
    hand: HandLandmark[],
    options: { radius: number; lineWidth: number },
  ) => void;
};

type DrawingUtilsConstructor = new (
  ctx: CanvasRenderingContext2D,
) => DrawingUtilsInstance;

type MediaPipeWindow = Window & {
  DrawingUtils?: DrawingUtilsConstructor;
  HAND_CONNECTIONS?: unknown;
  Hands?: HandsConstructor;
};

type RMiniCheckId = (typeof R_MINI_CHECK_CONFIGS)[number]['id'];

type BrowserLinearSVCModel = {
  format: 'linear_svc_binary_v1';
  feature: string;
  class_names: string[];
  positive_class_index: number;
  negative_class_index: number;
  present_index: number;
  absent_index: number;
  feature_dim: number;
  scaler: {
    mean: number[];
    scale: number[];
  };
  svm: {
    coef: number[];
    intercept: number;
  };
};

type RMiniCheckConfig = {
  id: RMiniCheckId;
  label: string;
  modelFilename: string;
  landmarks: number[];
  fix: string;
};

type LoadedRMiniCheck = RMiniCheckConfig & {
  model: BrowserLinearSVCModel;
};

export interface RMiniCheckResult {
  id: RMiniCheckId;
  passed: boolean;
  predLabel: string;
  margin: number;
  presentScore: number;
}

export interface RMiniFeedback {
  status: 'loading' | 'models_missing' | 'pass' | 'fail';
  marginThreshold: number;
  loadedChecks: number;
  totalChecks: number;
  missingChecks: string[];
  checks: RMiniCheckResult[];
  failingCheckId?: RMiniCheckId;
  failingLabel?: string;
  fix?: string;
}

interface Props {
  allowedLetters?: string[];
  targetLetter?: string;
  onConfidentPrediction?: (letter: string) => void;
  onPredictionChange?: (prediction: PredictResponse | null) => void;
  onRMiniFeedbackChange?: (feedback: RMiniFeedback | null) => void;
  hideSkeleton?: boolean;
  showDotsOnly?: boolean;
  confidenceThreshold?: number;
  showPredictionPanel?: boolean;
  enableRMiniChecks?: boolean;
  disableStaticModel?: boolean;
  rMiniMargin?: number;
  rMiniModelBaseUrl?: string;
}

export interface PredictResponse {
  letter: string;
  confidence: number;
  margin: number;
  class_names: string[];
}

type MPResults = {
  multiHandLandmarks?: HandLandmark[][];
};

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function hasUsableVideoFrame(video: HTMLVideoElement): boolean {
  return (
    video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
    video.videoWidth > 0 &&
    video.videoHeight > 0
  );
}

function sigmoid(x: number): number {
  if (x >= 0) {
    const z = Math.exp(-x);
    return 1 / (1 + z);
  }
  const z = Math.exp(x);
  return z / (1 + z);
}

function parseConnection(connection: unknown): [number, number] | null {
  if (Array.isArray(connection) && connection.length >= 2) {
    const a = connection[0];
    const b = connection[1];
    if (typeof a === 'number' && typeof b === 'number') {
      return [a, b];
    }
  }

  if (connection && typeof connection === 'object') {
    const asObj = connection as { start?: unknown; end?: unknown };
    if (typeof asObj.start === 'number' && typeof asObj.end === 'number') {
      return [asObj.start, asObj.end];
    }
  }

  return null;
}

function buildSubsetConnections(
  subsetIndices: number[],
  allConnections: unknown,
): [number, number][] {
  if (!Array.isArray(allConnections)) return [];

  const subset = new Set(subsetIndices);
  const subsetConnections: [number, number][] = [];

  for (const conn of allConnections) {
    const pair = parseConnection(conn);
    if (!pair) continue;
    const [a, b] = pair;
    if (subset.has(a) && subset.has(b)) {
      subsetConnections.push([a, b]);
    }
  }

  return subsetConnections;
}

function extractSubsetFeature(
  handLandmarks: HandLandmark[],
  subsetIndices: number[],
): number[] {
  const pts = new Array<[number, number, number]>(21);
  for (let i = 0; i < 21; i++) {
    const p = handLandmarks[i];
    pts[i] = [p.x, p.y, p.z ?? 0.0];
  }

  let cx = 0.0;
  let cy = 0.0;
  let cz = 0.0;
  for (const idx of R_MINI_PALM_LANDMARKS) {
    cx += pts[idx][0];
    cy += pts[idx][1];
    cz += pts[idx][2];
  }
  cx /= R_MINI_PALM_LANDMARKS.length;
  cy /= R_MINI_PALM_LANDMARKS.length;
  cz /= R_MINI_PALM_LANDMARKS.length;

  for (let i = 0; i < 21; i++) {
    pts[i][0] -= cx;
    pts[i][1] -= cy;
    pts[i][2] -= cz;
  }

  const dx = pts[5][0] - pts[17][0];
  const dy = pts[5][1] - pts[17][1];
  const dz = pts[5][2] - pts[17][2];
  let palmWidth = Math.sqrt(dx * dx + dy * dy + dz * dz);

  if (palmWidth < 1e-6) {
    let maxNorm = 0;
    for (let i = 0; i < 21; i++) {
      const [x, y, z] = pts[i];
      const norm = Math.sqrt(x * x + y * y + z * z);
      if (norm > maxNorm) maxNorm = norm;
    }
    palmWidth = maxNorm;
  }

  if (palmWidth < 1e-6) palmWidth = 1.0;

  const out: number[] = [];
  for (const idx of subsetIndices) {
    out.push(pts[idx][0] / palmWidth);
    out.push(pts[idx][1] / palmWidth);
    out.push(pts[idx][2] / palmWidth);
  }

  return out;
}

function isBrowserLinearSVCModel(value: unknown): value is BrowserLinearSVCModel {
  if (!value || typeof value !== 'object') return false;
  const model = value as Partial<BrowserLinearSVCModel>;
  return (
    model.format === 'linear_svc_binary_v1' &&
    typeof model.feature === 'string' &&
    Array.isArray(model.class_names) &&
    typeof model.positive_class_index === 'number' &&
    typeof model.negative_class_index === 'number' &&
    typeof model.present_index === 'number' &&
    typeof model.feature_dim === 'number' &&
    !!model.scaler &&
    Array.isArray(model.scaler.mean) &&
    Array.isArray(model.scaler.scale) &&
    !!model.svm &&
    Array.isArray(model.svm.coef) &&
    typeof model.svm.intercept === 'number'
  );
}

function predictRMiniCheck(model: BrowserLinearSVCModel, feats: number[]) {
  if (feats.length !== model.feature_dim) {
    throw new Error(
      `Feature length mismatch (expected ${model.feature_dim}, got ${feats.length}).`,
    );
  }

  let score = model.svm.intercept;
  for (let i = 0; i < feats.length; i++) {
    const denom = Math.abs(model.scaler.scale[i] ?? 1.0) < 1e-12
      ? 1.0
      : (model.scaler.scale[i] ?? 1.0);
    const standardized = (feats[i] - (model.scaler.mean[i] ?? 0.0)) / denom;
    score += (model.svm.coef[i] ?? 0.0) * standardized;
  }

  const predIdx =
    score >= 0 ? model.positive_class_index : model.negative_class_index;
  const predLabel = model.class_names[predIdx] ?? '';
  const margin = Math.abs(score);
  const presentScore =
    model.present_index === model.positive_class_index
      ? sigmoid(score)
      : 1.0 - sigmoid(score);

  return { predLabel, margin, presentScore };
}

export default function StaticLetterPractice({
  allowedLetters,
  targetLetter,
  onConfidentPrediction,
  onPredictionChange,
  onRMiniFeedbackChange,
  hideSkeleton = false,
  showDotsOnly = false,
  confidenceThreshold = 0.6,
  showPredictionPanel = true,
  enableRMiniChecks = false,
  disableStaticModel = false,
  rMiniMargin = 0.2,
  rMiniModelBaseUrl = '/models',
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const autoStartedRef = useRef(false);

  const handsRef = useRef<MediaPipeHands | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  const [running, setRunning] = useState(false);
  const [prediction, setPrediction] = useState<PredictResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const frameCountRef = useRef(0);

  // 🔁 keep latest props in refs so Mediapipe callback never sees stale closures
  const allowedLettersRef = useRef<string[] | undefined>(allowedLetters);
  const targetLetterRef = useRef<string | undefined>(targetLetter);
  const confidenceThresholdRef = useRef<number>(confidenceThreshold);
  const onConfidentRef = useRef<Props['onConfidentPrediction']>(
    onConfidentPrediction,
  );
  const onPredictionChangeRef = useRef<Props['onPredictionChange']>(
    onPredictionChange,
  );
  const onRMiniFeedbackChangeRef = useRef<Props['onRMiniFeedbackChange']>(
    onRMiniFeedbackChange,
  );
  const enableRMiniChecksRef = useRef<boolean>(enableRMiniChecks);
  const disableStaticModelRef = useRef<boolean>(disableStaticModel);
  const rMiniMarginRef = useRef<number>(rMiniMargin);
  const rMiniModelBaseUrlRef = useRef<string>(rMiniModelBaseUrl);

  const rMiniChecksRef = useRef<LoadedRMiniCheck[]>([]);
  const rMiniLoadStateRef = useRef<'idle' | 'loading' | 'ready' | 'error'>(
    'idle',
  );
  const rMiniMissingChecksRef = useRef<string[]>([]);
  const failingMiniCheckRef = useRef<LoadedRMiniCheck | null>(null);
  const rMiniFeedbackHistoryRef = useRef<
    Array<{ key: string; feedback: RMiniFeedback }>
  >([]);

  const handleResultsRef = useRef<((results: MPResults) => void) | null>(null);

  useEffect(() => {
    allowedLettersRef.current = allowedLetters;
  }, [allowedLetters]);

  useEffect(() => {
    targetLetterRef.current = targetLetter;
  }, [targetLetter]);

  useEffect(() => {
    confidenceThresholdRef.current = confidenceThreshold;
  }, [confidenceThreshold]);

  useEffect(() => {
    onConfidentRef.current = onConfidentPrediction;
  }, [onConfidentPrediction]);

  useEffect(() => {
    onPredictionChangeRef.current = onPredictionChange;
  }, [onPredictionChange]);

  useEffect(() => {
    onRMiniFeedbackChangeRef.current = onRMiniFeedbackChange;
  }, [onRMiniFeedbackChange]);

  useEffect(() => {
    enableRMiniChecksRef.current = enableRMiniChecks;
    if (!enableRMiniChecks) {
      failingMiniCheckRef.current = null;
      rMiniFeedbackHistoryRef.current = [];
      onRMiniFeedbackChangeRef.current?.(null);
    }
  }, [enableRMiniChecks]);

  useEffect(() => {
    disableStaticModelRef.current = disableStaticModel;
  }, [disableStaticModel]);

  useEffect(() => {
    rMiniMarginRef.current = rMiniMargin;
  }, [rMiniMargin]);

  useEffect(() => {
    rMiniModelBaseUrlRef.current = rMiniModelBaseUrl;
  }, [rMiniModelBaseUrl]);

  useEffect(() => {
    if (targetLetter !== 'R') {
      failingMiniCheckRef.current = null;
      rMiniFeedbackHistoryRef.current = [];
      onRMiniFeedbackChangeRef.current?.(null);
    }
  }, [targetLetter]);

  useEffect(() => {
    let cancelled = false;

    async function loadRMiniModels() {
      if (!enableRMiniChecks) {
        rMiniChecksRef.current = [];
        rMiniMissingChecksRef.current = [];
        rMiniLoadStateRef.current = 'idle';
        return;
      }

      rMiniLoadStateRef.current = 'loading';
      rMiniChecksRef.current = [];
      rMiniMissingChecksRef.current = [];

      const loadedChecks: LoadedRMiniCheck[] = [];
      const missingChecks: string[] = [];
      const baseUrl = rMiniModelBaseUrlRef.current.replace(/\/$/, '');

      for (const cfg of R_MINI_CHECK_CONFIGS) {
        const url = `${baseUrl}/${cfg.modelFilename}`;
        try {
          const res = await fetch(url, { cache: 'no-store' });
          if (!res.ok) {
            missingChecks.push(cfg.id);
            continue;
          }

          const data: unknown = await res.json();
          if (!isBrowserLinearSVCModel(data)) {
            missingChecks.push(cfg.id);
            continue;
          }

          loadedChecks.push({
            id: cfg.id,
            label: cfg.label,
            modelFilename: cfg.modelFilename,
            landmarks: [...cfg.landmarks],
            fix: cfg.fix,
            model: data,
          });
        } catch {
          missingChecks.push(cfg.id);
        }
      }

      if (cancelled) return;

      rMiniChecksRef.current = loadedChecks;
      rMiniMissingChecksRef.current = missingChecks;
      rMiniLoadStateRef.current =
        loadedChecks.length > 0 || missingChecks.length === 0 ? 'ready' : 'error';
    }

    void loadRMiniModels();

    return () => {
      cancelled = true;
    };
  }, [enableRMiniChecks, rMiniModelBaseUrl]);

  function flattenLandmarks(lms: HandLandmark[]): number[] {
    const arr = new Array(63);
    for (let i = 0; i < 21; i++) {
      const p = lms[i];
      arr[i * 3 + 0] = p.x;
      arr[i * 3 + 1] = p.y;
      arr[i * 3 + 2] = p.z ?? 0.0;
    }
    return arr;
  }

  async function sendStatic(flat63: number[]): Promise<PredictResponse> {
    const res = await fetch(`${API_BASE}/predict_landmarks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ landmarks: flat63 }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `HTTP ${res.status}`);
    }
    return res.json();
  }

  function evaluateRMiniFeedback(
    mirroredHand: HandLandmark[],
  ): RMiniFeedback | null {
    if (!enableRMiniChecksRef.current) return null;
    if (targetLetterRef.current !== 'R') return null;

    const totalChecks = R_MINI_CHECK_CONFIGS.length;
    const loadedChecks = rMiniChecksRef.current;
    const loadedCount = loadedChecks.length;
    const marginThreshold = rMiniMarginRef.current;
    const missingChecks = [...rMiniMissingChecksRef.current];

    if (rMiniLoadStateRef.current === 'loading') {
      return {
        status: 'loading',
        marginThreshold,
        loadedChecks: loadedCount,
        totalChecks,
        missingChecks,
        checks: [],
      };
    }

    if (loadedCount === 0) {
      return {
        status: 'models_missing',
        marginThreshold,
        loadedChecks: loadedCount,
        totalChecks,
        missingChecks:
          missingChecks.length > 0
            ? missingChecks
            : R_MINI_CHECK_CONFIGS.map((c) => c.id),
        checks: [],
      };
    }

    const checkResults: RMiniCheckResult[] = [];
    let failingCheck: LoadedRMiniCheck | null = null;

    for (const check of loadedChecks) {
      const feats = extractSubsetFeature(mirroredHand, check.landmarks);
      const out = predictRMiniCheck(check.model, feats);
      const passed = out.predLabel === 'present' && out.margin >= marginThreshold;

      checkResults.push({
        id: check.id,
        passed,
        predLabel: out.predLabel,
        margin: out.margin,
        presentScore: out.presentScore,
      });

      if (!passed && !failingCheck) {
        failingCheck = check;
      }
    }

    if (missingChecks.length > 0) {
      return {
        status: 'models_missing',
        marginThreshold,
        loadedChecks: loadedCount,
        totalChecks,
        missingChecks,
        checks: checkResults,
        failingCheckId: failingCheck?.id,
        failingLabel: failingCheck?.label,
        fix: failingCheck?.fix,
      };
    }

    if (failingCheck) {
      return {
        status: 'fail',
        marginThreshold,
        loadedChecks: loadedCount,
        totalChecks,
        missingChecks,
        checks: checkResults,
        failingCheckId: failingCheck.id,
        failingLabel: failingCheck.label,
        fix: failingCheck.fix,
      };
    }

    return {
      status: 'pass',
      marginThreshold,
      loadedChecks: loadedCount,
      totalChecks,
      missingChecks,
      checks: checkResults,
    };
  }

  function smoothRMiniFeedback(
    feedback: RMiniFeedback | null,
  ): RMiniFeedback | null {
    if (!feedback) {
      rMiniFeedbackHistoryRef.current = [];
      return null;
    }

    if (feedback.status === 'loading' || feedback.status === 'models_missing') {
      rMiniFeedbackHistoryRef.current = [];
      return feedback;
    }

    const key =
      feedback.status === 'fail'
        ? `fail:${feedback.failingCheckId ?? 'unknown'}`
        : 'pass';

    const history = rMiniFeedbackHistoryRef.current;
    history.push({ key, feedback });
    if (history.length > R_MINI_FEEDBACK_WINDOW) {
      history.splice(0, history.length - R_MINI_FEEDBACK_WINDOW);
    }

    const counts = new Map<string, number>();
    for (const item of history) {
      counts.set(item.key, (counts.get(item.key) ?? 0) + 1);
    }

    let bestKey = history[history.length - 1]?.key ?? key;
    let bestCount = counts.get(bestKey) ?? 0;

    for (const [candidateKey, count] of counts.entries()) {
      if (count > bestCount) {
        bestKey = candidateKey;
        bestCount = count;
      } else if (count === bestCount) {
        const bestLatest = history.map((h) => h.key).lastIndexOf(bestKey);
        const candidateLatest = history.map((h) => h.key).lastIndexOf(candidateKey);
        if (candidateLatest > bestLatest) {
          bestKey = candidateKey;
          bestCount = count;
        }
      }
    }

    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i].key === bestKey) return history[i].feedback;
    }
    return feedback;
  }

  const drawHand = useEffectEvent((results: MPResults) => {
    if (hideSkeleton && !showDotsOnly) return;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = video.videoWidth || 640;
    const height = video.videoHeight || 480;
    canvas.width = width;
    canvas.height = height;

    ctx.clearRect(0, 0, width, height);

    if (!results.multiHandLandmarks || !results.multiHandLandmarks.length)
      return;

    const hand = results.multiHandLandmarks[0];

    ctx.save();
    ctx.translate(width, 0);
    ctx.scale(-1, 1); // mirror like selfie

    const mediaPipeWindow = window as MediaPipeWindow;
    const DrawingUtils = mediaPipeWindow.DrawingUtils;
    const handConnections = mediaPipeWindow.HAND_CONNECTIONS;

    if (DrawingUtils && handConnections) {
      const DU = new DrawingUtils(ctx);
      if (!hideSkeleton) {
        DU.drawConnectors(hand, handConnections, { lineWidth: 3 });
      }
      DU.drawLandmarks(hand, { radius: 2.2, lineWidth: 1 });
    } else {
      ctx.fillStyle = 'rgba(56,189,248,0.9)';
      for (const p of hand) {
        const x = p.x * width;
        const y = p.y * height;
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, 2 * Math.PI);
        ctx.fill();
      }
    }

    const failingCheck =
      enableRMiniChecksRef.current && targetLetterRef.current === 'R'
        ? failingMiniCheckRef.current
        : null;

    if (failingCheck && handConnections) {
      const subsetConnections = buildSubsetConnections(
        failingCheck.landmarks,
        handConnections,
      );

      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(255, 110, 110, 0.95)';
      for (const [a, b] of subsetConnections) {
        const pa = hand[a];
        const pb = hand[b];
        if (!pa || !pb) continue;

        ctx.beginPath();
        ctx.moveTo(pa.x * width, pa.y * height);
        ctx.lineTo(pb.x * width, pb.y * height);
        ctx.stroke();
      }

      for (const idx of failingCheck.landmarks) {
        const p = hand[idx];
        if (!p) continue;

        ctx.beginPath();
        ctx.fillStyle = R_MINI_PALM_LANDMARKS.includes(idx as 0 | 5 | 9 | 13 | 17)
          ? 'rgba(160, 255, 210, 1.0)'
          : 'rgba(255, 140, 100, 1.0)';
        ctx.arc(p.x * width, p.y * height, 5, 0, 2 * Math.PI);
        ctx.fill();
      }
    }

    ctx.restore();
  });

  // 🔁 define the core results handler into a ref (no stale closures)
  useEffect(() => {
    handleResultsRef.current = async (results: MPResults) => {
      const handLandmarks = results.multiHandLandmarks;
      if (!handLandmarks?.length) {
        failingMiniCheckRef.current = null;
        rMiniFeedbackHistoryRef.current = [];
        setPrediction(null);
        onPredictionChangeRef.current?.(null);
        onRMiniFeedbackChangeRef.current?.(null);
        drawHand(results);
        return;
      }

      const hand = handLandmarks[0];

      // mirror in data space
      const mirroredHand = hand.map((p) => ({
        x: 1 - p.x,
        y: p.y,
        z: p.z ?? 0.0,
      }));

      const rawMiniFeedback = evaluateRMiniFeedback(mirroredHand);
      const miniFeedback = smoothRMiniFeedback(rawMiniFeedback);
      if (miniFeedback?.status === 'fail' && miniFeedback.failingCheckId) {
        failingMiniCheckRef.current =
          rMiniChecksRef.current.find(
            (check) => check.id === miniFeedback.failingCheckId,
          ) ?? null;
      } else {
        failingMiniCheckRef.current = null;
      }
      onRMiniFeedbackChangeRef.current?.(miniFeedback);

      drawHand(results);

      if (
        disableStaticModelRef.current &&
        enableRMiniChecksRef.current &&
        targetLetterRef.current === 'R'
      ) {
        if (miniFeedback?.status === 'pass' && miniFeedback.checks.length > 0) {
          const confidence = Math.min(
            ...miniFeedback.checks.map((check) => check.presentScore),
          );
          const margin = Math.min(
            ...miniFeedback.checks.map((check) => check.margin),
          );
          const syntheticPrediction: PredictResponse = {
            letter: 'R',
            confidence,
            margin,
            class_names: ['not_r', 'R'],
          };
          setPrediction(syntheticPrediction);
          onPredictionChangeRef.current?.(syntheticPrediction);

          if (
            onConfidentRef.current &&
            confidence >= confidenceThresholdRef.current
          ) {
            onConfidentRef.current('R');
          }
        } else {
          setPrediction(null);
          onPredictionChangeRef.current?.(null);
        }
        return;
      }

      // Throttle backend calls a bit
      frameCountRef.current += 1;
      if (frameCountRef.current % 2 !== 0) return;

      try {
        const flat = flattenLandmarks(mirroredHand);
        const res = await sendStatic(flat);

        // ✅ always display whatever the model predicts
        setPrediction(res);
        onPredictionChangeRef.current?.(res);

        const currentAllowed = allowedLettersRef.current;
        const currentTarget = targetLetterRef.current;
        const matchesTarget = !currentTarget || res.letter === currentTarget;
        const canUseForCallback =
          matchesTarget &&
          (!currentAllowed ||
            currentAllowed.length === 0 ||
            currentAllowed.includes(res.letter));

        if (
          onConfidentRef.current &&
          canUseForCallback &&
          (res.confidence ?? 0) >= confidenceThresholdRef.current
        ) {
          // small debounce so one frame doesn't fire multiple times in dev/StrictMode
          onConfidentRef.current(res.letter);
        }
      } catch (error: unknown) {
        console.error(error);
        setError(getErrorMessage(error, 'Prediction error'));
      }
    };
  }, []); // depends only on refs / helpers

  async function startPipeline() {
    setError(null);
    setPrediction(null);
    failingMiniCheckRef.current = null;
    rMiniFeedbackHistoryRef.current = [];
    onPredictionChangeRef.current?.(null);
    onRMiniFeedbackChangeRef.current?.(null);
    frameCountRef.current = 0;

    const video = videoRef.current;
    if (!video) {
      setError('Video element not ready.');
      return;
    }

    if (typeof navigator === 'undefined') {
      setError('Camera API not available (navigator undefined).');
      return;
    }

    const constraints: MediaStreamConstraints = {
      video: { width: 960, height: 720 },
      audio: false,
    };

    const getUserMediaModern =
      navigator.mediaDevices && navigator.mediaDevices.getUserMedia
        ? navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices)
        : null;

    const legacyGetUserMedia =
      ((navigator as Navigator & { getUserMedia?: LegacyGetUserMedia })
        .getUserMedia ||
        (
          navigator as Navigator & {
            webkitGetUserMedia?: LegacyGetUserMedia;
          }
        ).webkitGetUserMedia ||
        (navigator as Navigator & { mozGetUserMedia?: LegacyGetUserMedia })
          .mozGetUserMedia ||
        (navigator as Navigator & { msGetUserMedia?: LegacyGetUserMedia })
          .msGetUserMedia ||
        null) as LegacyGetUserMedia | null;

    if (!getUserMediaModern && !legacyGetUserMedia) {
      setError('Camera API not supported in this browser/environment.');
      return;
    }

    const HandsCtor = (window as MediaPipeWindow).Hands;
    if (!HandsCtor) {
      setError('Mediapipe Hands not loaded. Check hands.js script.');
      return;
    }

    try {
      const stream: MediaStream = await new Promise((resolve, reject) => {
        if (getUserMediaModern) {
          getUserMediaModern(constraints).then(resolve).catch(reject);
        } else if (legacyGetUserMedia) {
          legacyGetUserMedia.call(
            navigator,
            constraints,
            (s: MediaStream) => resolve(s),
            (err: unknown) => reject(err),
          );
        } else {
          reject(new Error('No getUserMedia implementation found.'));
        }
      });

      streamRef.current = stream;
      video.srcObject = stream;
      await video.play();
    } catch (error: unknown) {
      console.error(error);
      setError(getErrorMessage(error, 'Unable to access camera'));
      return;
    }

    const hands = new HandsCtor({
      locateFile: (file: string) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
    });
    hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.6,
      minTrackingConfidence: 0.6,
    });
    hands.onResults((results: MPResults) => {
      handleResultsRef.current?.(results);
    });
    handsRef.current = hands;

    const loop = async () => {
      const v = videoRef.current;
      const h = handsRef.current;
      if (!v || !h) return;
      if (!hasUsableVideoFrame(v)) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }

      try {
        await h.send({ image: v });
      } catch (error: unknown) {
        const message =
          error instanceof Error && error.message
            ? error.message
            : 'Hand tracking error';
        if (/memory access out of bounds/i.test(message)) {
          setError(
            'Camera tracking hit an internal error. Stop and restart webcam.',
          );
          setRunning(false);
          h.close?.();
          handsRef.current = null;
          return;
        }
        console.warn(`Hands send warning: ${message}`);
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    setRunning(true);
  }

  function stopPipeline() {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    if (handsRef.current) {
      handsRef.current.close?.();
      handsRef.current = null;
    }

    const stream = streamRef.current;
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    const video = videoRef.current;
    if (video) {
      video.srcObject = null;
    }

    failingMiniCheckRef.current = null;
    rMiniFeedbackHistoryRef.current = [];
    setRunning(false);
    setPrediction(null);
    onPredictionChangeRef.current?.(null);
    onRMiniFeedbackChangeRef.current?.(null);
  }

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      stopPipeline();
    };
  }, []);

  function handleVideoRef(node: HTMLVideoElement | null) {
    videoRef.current = node;
    if (node && !autoStartedRef.current) {
      autoStartedRef.current = true;
      void startPipeline();
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative w-full max-w-xl mx-auto rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <video
          ref={handleVideoRef}
          autoPlay
          muted
          playsInline
          className="w-full h-auto block"
          style={{ transform: 'scaleX(-1)' }}
        />
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none"
        />
        {!running && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80">
            <p className="text-xs text-slate-600">Starting camera...</p>
          </div>
        )}
      </div>

      {showPredictionPanel && (
        <div className="rounded-2xl border border-slate-200 bg-white p-3 text-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
              Live prediction
            </span>
            {prediction && (
              <span className="text-[11px] text-slate-500">
                Confidence: {(prediction.confidence * 100).toFixed(1)}% · Margin:{' '}
                {prediction.margin.toFixed(2)}
              </span>
            )}
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-semibold tracking-[0.25em] text-slate-900">
              {prediction?.letter ?? '—'}
            </span>
          </div>
          {error && (
            <p className="mt-2 text-[11px] text-red-400">Error: {error}</p>
          )}
        </div>
      )}

      {!showPredictionPanel && error && (
        <p className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-500">
          Error: {error}
        </p>
      )}
    </div>
  );
}
