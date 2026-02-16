'use client';

import { useEffect, useRef, useState } from 'react';

export type MPResults = {
  multiHandLandmarks?: { x: number; y: number; z?: number }[][];
};

const CENTER_TOLERANCE = 0.08; // fraction of width allowed from center
const SCALE_MIN = 0.18; // min normalized hand distance (wrist-to-wrist / width)
const SCALE_MAX = 0.42; // max normalized hand distance
const HAND_ZONE_SIZE = 0.16; // fraction of width for hand zones
const READY_HOLD_MS = 800;
const DEBUG_MODE = false;

interface Props {
  videoWidth: number;
  videoHeight: number;
  resultsRef: React.MutableRefObject<MPResults | null>;
  onReady?: (ready: boolean) => void;
  enabled?: boolean;
  debug?: boolean;
}

export default function AlignmentOverlay({
  videoWidth,
  videoHeight,
  resultsRef,
  onReady,
  enabled = true,
  debug = DEBUG_MODE,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [message, setMessage] = useState('Align to begin');
  const [ready, setReady] = useState(false);
  const lastMessageRef = useRef(message);
  const readyRef = useRef(false);
  const holdStartRef = useRef<number | null>(null);

  useEffect(() => {
    readyRef.current = ready;
  }, [ready]);

  useEffect(() => {
    if (typeof onReady !== 'function') return;
    onReady(ready);
  }, [ready, onReady]);

  useEffect(() => {
    if (!enabled) {
      if (readyRef.current) setReady(false);
      if (typeof onReady === 'function') onReady(false);
      return;
    }
    let raf = 0;

    const draw = () => {
      raf = requestAnimationFrame(draw);
      const canvas = canvasRef.current;
      if (!canvas) return;
      if (!videoWidth || !videoHeight) return;

      if (canvas.width !== videoWidth) canvas.width = videoWidth;
      if (canvas.height !== videoHeight) canvas.height = videoHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const results = resultsRef.current;
      const width = canvas.width;
      const height = canvas.height;

      const metrics = computeAlignment(results, width, height);
      const nextMessage = metrics.message;

      if (nextMessage !== lastMessageRef.current) {
        lastMessageRef.current = nextMessage;
        setMessage(nextMessage);
      }

      if (metrics.ready) {
        if (!readyRef.current) setReady(true);
      } else if (readyRef.current) {
        setReady(false);
      }

      drawOverlay(ctx, width, height, metrics, readyRef.current, debug);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [enabled, videoWidth, videoHeight, resultsRef, debug]);

  if (!enabled) return null;

  return (
    <>
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 w-full h-full pointer-events-none transition-opacity ${
          ready ? 'opacity-40' : 'opacity-100'
        }`}
      />
      <div className="absolute top-2 left-1/2 -translate-x-1/2 rounded-full border border-amber-300/60 bg-slate-950/70 px-3 py-1 text-[11px] font-semibold text-amber-300 backdrop-blur">
        {ready ? 'Ready' : message}
      </div>
      {!ready && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-slate-700/60 bg-slate-950/70 px-4 py-1 text-[11px] text-slate-200 backdrop-blur">
          Align hands in the guides.
        </div>
      )}
    </>
  );

  function computeAlignment(
    results: MPResults | null,
    width: number,
    height: number,
  ) {
    const zoneSize = HAND_ZONE_SIZE;
    const zoneCenterY = 0.55;
    const zoneOffsetX = 0.18;
    const leftZone = {
      x: 0.5 - zoneOffsetX,
      y: zoneCenterY,
      w: zoneSize,
      h: zoneSize,
    };
    const rightZone = {
      x: 0.5 + zoneOffsetX,
      y: zoneCenterY,
      w: zoneSize,
      h: zoneSize,
    };

    const fallback = {
      isCentered: false,
      isInRange: false,
      handsInStart: false,
      ready: false,
      message: 'Show both hands',
      debug: {
        centerX: 0.5,
        handDistNorm: 0,
        zoneCenterY,
        leftZone,
        rightZone,
      },
    };

    if (!results?.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
      holdStartRef.current = null;
      return fallback;
    }

    const handData = results.multiHandLandmarks.map((hand) => {
      let minX = 1;
      let maxX = 0;
      let minY = 1;
      let maxY = 0;
      for (const p of hand) {
        minX = Math.min(minX, p.x);
        maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y);
        maxY = Math.max(maxY, p.y);
      }
      const wrist = hand[0] ?? { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
      return {
        wrist,
        center: { x: (minX + maxX) / 2, y: (minY + maxY) / 2 },
        boxWidth: maxX - minX,
        boxHeight: maxY - minY,
      };
    });

    const wrists = handData
      .map((h) => h.wrist)
      .sort((a, b) => a.x - b.x);

    const centerX = wrists.length >= 2
      ? (wrists[0].x + wrists[1].x) / 2
      : wrists[0].x;

    const handDistNorm =
      wrists.length >= 2
        ? Math.abs(wrists[1].x - wrists[0].x)
        : handData[0].boxWidth;

    const isCentered = Math.abs(centerX - 0.5) <= CENTER_TOLERANCE;
    const isInRange = handDistNorm >= SCALE_MIN && handDistNorm <= SCALE_MAX;

    const handsInStart =
      wrists.length >= 2 &&
      pointInZone(wrists[0], leftZone) &&
      pointInZone(wrists[1], rightZone);

    let message = '';
    if (!isCentered) {
      message = centerX < 0.5 ? 'Move right' : 'Move left';
    } else if (!isInRange) {
      message = handDistNorm < SCALE_MIN ? 'Step closer' : 'Step back';
    } else if (!handsInStart) {
      message = 'Place hands in start zones';
    } else {
      message = 'Hold still...';
    }

    const allGood = isCentered && isInRange && handsInStart;
    const now = performance.now();
    if (allGood) {
      if (holdStartRef.current == null) {
        holdStartRef.current = now;
      }
    } else {
      holdStartRef.current = null;
    }

    const ready =
      allGood &&
      holdStartRef.current != null &&
      now - holdStartRef.current >= READY_HOLD_MS;

    return {
      isCentered,
      isInRange,
      handsInStart,
      ready,
      message: ready ? 'Ready' : message,
      debug: {
        centerX,
        handDistNorm,
        zoneCenterY,
        leftZone,
        rightZone,
      },
    };
  }

  function pointInZone(
    p: { x: number; y: number },
    zone: { x: number; y: number; w: number; h: number },
  ) {
    return (
      p.x >= zone.x - zone.w / 2 &&
      p.x <= zone.x + zone.w / 2 &&
      p.y >= zone.y - zone.h / 2 &&
      p.y <= zone.y + zone.h / 2
    );
  }

  function drawOverlay(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    metrics: ReturnType<typeof computeAlignment>,
    isReady: boolean,
    debugMode: boolean,
  ) {
    ctx.clearRect(0, 0, width, height);

    const overlayAlpha = isReady ? 0.2 : 0.6;
    ctx.fillStyle = `rgba(0,0,0,${overlayAlpha})`;
    ctx.fillRect(0, 0, width, height);

    const silhouettePath = buildSilhouettePath(width, height);

    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fill(silhouettePath);
    ctx.restore();

    ctx.save();
    const glow = ctx.createRadialGradient(
      width / 2,
      height * 0.45,
      Math.min(width, height) * 0.1,
      width / 2,
      height * 0.45,
      Math.min(width, height) * 0.55,
    );
    glow.addColorStop(0, 'rgba(255,255,255,0.65)');
    glow.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = isReady ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 2.5;
    ctx.stroke(silhouettePath);
    ctx.restore();

    const frameMargin = Math.min(width, height) * 0.08;
    ctx.save();
    ctx.setLineDash([8, 8]);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(
      frameMargin,
      frameMargin * 0.8,
      width - frameMargin * 2,
      height - frameMargin * 1.6,
    );
    ctx.restore();

    const leftZonePx = toZonePixels(metrics.debug.leftZone, width, height);
    const rightZonePx = toZonePixels(metrics.debug.rightZone, width, height);

    drawHandZone(ctx, leftZonePx, 'rgba(250, 204, 21, 0.7)', isReady);
    drawHandZone(ctx, rightZonePx, 'rgba(56, 189, 248, 0.7)', isReady);

    if (debugMode) {
      ctx.save();
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.font = '12px sans-serif';
      ctx.fillText(
        `centerX=${metrics.debug.centerX.toFixed(2)} handDist=${metrics.debug.handDistNorm.toFixed(2)}`,
        10,
        height - 10,
      );
      ctx.restore();
    }
  }

  function buildSilhouettePath(width: number, height: number) {
    const headRadius = Math.min(width, height) * 0.075;
    const centerX = width / 2;
    const headCenterY = height * 0.22;
    const shoulderY = headCenterY + headRadius * 1.6;
    const torsoWidth = width * 0.6;
    const torsoHeight = height * 0.46;
    const torsoX = centerX - torsoWidth / 2;
    const torsoY = shoulderY;
    const cornerRadius = Math.min(torsoWidth, torsoHeight) * 0.08;

    const path = new Path2D();
    path.arc(centerX, headCenterY, headRadius, 0, Math.PI * 2);
    const neckWidth = headRadius * 0.9;
    path.moveTo(centerX - neckWidth / 2, headCenterY + headRadius * 0.9);
    path.lineTo(centerX - neckWidth / 2, shoulderY);
    path.moveTo(torsoX + cornerRadius, torsoY);
    path.lineTo(torsoX + torsoWidth - cornerRadius, torsoY);
    path.quadraticCurveTo(
      torsoX + torsoWidth,
      torsoY,
      torsoX + torsoWidth,
      torsoY + cornerRadius,
    );
    path.lineTo(torsoX + torsoWidth, torsoY + torsoHeight - cornerRadius);
    path.quadraticCurveTo(
      torsoX + torsoWidth,
      torsoY + torsoHeight,
      torsoX + torsoWidth - cornerRadius,
      torsoY + torsoHeight,
    );
    path.lineTo(torsoX + cornerRadius, torsoY + torsoHeight);
    path.quadraticCurveTo(
      torsoX,
      torsoY + torsoHeight,
      torsoX,
      torsoY + torsoHeight - cornerRadius,
    );
    path.lineTo(torsoX, torsoY + cornerRadius);
    path.quadraticCurveTo(torsoX, torsoY, torsoX + cornerRadius, torsoY);
    path.closePath();
    return path;
  }

  function toZonePixels(
    zone: { x: number; y: number; w: number; h: number },
    width: number,
    height: number,
  ) {
    return {
      x: (zone.x - zone.w / 2) * width,
      y: (zone.y - zone.h / 2) * height,
      w: zone.w * width,
      h: zone.h * height,
    };
  }

  function drawHandZone(
    ctx: CanvasRenderingContext2D,
    zone: { x: number; y: number; w: number; h: number },
    color: string,
    isReady: boolean,
  ) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.shadowColor = color;
    ctx.shadowBlur = isReady ? 6 : 12;
    drawRoundedRect(ctx, zone.x, zone.y, zone.w, zone.h, zone.w * 0.2);
    ctx.stroke();
    ctx.restore();

    drawHandIcon(
      ctx,
      zone.x + zone.w * 0.25,
      zone.y + zone.h * 0.18,
      zone.w * 0.5,
      zone.h * 0.64,
      color,
    );
  }

  function drawRoundedRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
  ) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  function drawHandIcon(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    color: string,
  ) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.setLineDash([]);
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;

    const palmW = w * 0.55;
    const palmH = h * 0.5;
    const palmX = x + (w - palmW) / 2;
    const palmY = y + h * 0.35;
    drawRoundedRect(ctx, palmX, palmY, palmW, palmH, palmW * 0.2);
    ctx.stroke();

    const fingerGap = w * 0.08;
    const fingerW = w * 0.12;
    const fingerH = h * 0.4;
    for (let i = 0; i < 4; i += 1) {
      const fx = x + i * (fingerW + fingerGap) + fingerGap;
      const fy = y + h * 0.05;
      drawRoundedRect(ctx, fx, fy, fingerW, fingerH, fingerW * 0.4);
      ctx.stroke();
    }

    const thumbW = w * 0.16;
    const thumbH = h * 0.28;
    drawRoundedRect(
      ctx,
      x + w * 0.02,
      y + h * 0.45,
      thumbW,
      thumbH,
      thumbW * 0.4,
    );
    ctx.stroke();

    ctx.restore();
  }
}
