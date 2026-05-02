import { useMemo, useState, useCallback } from 'react';

// ── Types ──────────────────────────────────────────────────────────────────

export interface PolaroidPlacement {
  index: number;
  x: number;
  y: number;
  rotation: number;
  zIndex: number;
  caption: string;
  photoW: number;
  photoH: number;
  frameW: number;
  frameH: number;
  sidePad: number;
  topPad: number;
  bottomPad: number;
}

export interface PolaroidLayoutResult {
  placements: PolaroidPlacement[];
  shuffle: () => void;
}

// ── Seeded PRNG (Mulberry32) ───────────────────────────────────────────────

function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Layout templates ───────────────────────────────────────────────────────
// Each slot: [cx%, cy%, rotation°]
// Designed for "tossed on table" aesthetic with intentional rhythm.

type Slot = [number, number, number];
type Template = Slot[];

const TEMPLATES: Record<number, Template[]> = {
  3: [
    // Fan spread
    [[0.25, 0.30, -8], [0.70, 0.25, 5], [0.45, 0.68, -3]],
    // Cascade
    [[0.30, 0.22, 4], [0.55, 0.48, -6], [0.35, 0.72, 3]],
    // Triangle
    [[0.50, 0.24, -4], [0.25, 0.65, 6], [0.72, 0.62, -5]],
  ],
  4: [
    // Scattered quad
    [[0.28, 0.22, -6], [0.68, 0.28, 4], [0.32, 0.62, 5], [0.72, 0.68, -4]],
    // Diamond
    [[0.50, 0.18, 3], [0.22, 0.48, -5], [0.78, 0.48, 6], [0.50, 0.76, -3]],
    // Cascade stairs
    [[0.22, 0.20, -4], [0.45, 0.38, 3], [0.65, 0.55, -5], [0.40, 0.75, 4]],
  ],
  5: [
    // Cross pattern
    [[0.50, 0.18, -3], [0.22, 0.42, 5], [0.50, 0.48, -2], [0.78, 0.42, -5], [0.50, 0.78, 4]],
    // Scattered organic
    [[0.30, 0.20, 5], [0.70, 0.25, -4], [0.25, 0.55, -6], [0.65, 0.58, 3], [0.48, 0.80, -3]],
    // Arc
    [[0.20, 0.40, -8], [0.38, 0.22, -3], [0.55, 0.18, 2], [0.72, 0.28, 5], [0.80, 0.50, 8]],
  ],
  6: [
    // Two rows staggered
    [[0.22, 0.25, -5], [0.50, 0.20, 3], [0.78, 0.28, -4], [0.28, 0.65, 4], [0.55, 0.70, -3], [0.78, 0.62, 5]],
    // Spiral
    [[0.50, 0.18, -3], [0.75, 0.35, 4], [0.68, 0.65, -5], [0.38, 0.75, 3], [0.22, 0.50, -4], [0.35, 0.30, 5]],
    // Mosaic
    [[0.25, 0.20, 4], [0.65, 0.18, -5], [0.45, 0.45, 2], [0.20, 0.68, -3], [0.55, 0.72, 5], [0.80, 0.50, -4]],
  ],
  7: [
    // Honeycomb
    [[0.35, 0.15, -4], [0.65, 0.15, 3], [0.20, 0.40, 5], [0.50, 0.38, -2], [0.80, 0.40, -5], [0.32, 0.68, 4], [0.68, 0.68, -3]],
    // Scattered cloud
    [[0.25, 0.18, 5], [0.55, 0.15, -3], [0.80, 0.25, 4], [0.18, 0.50, -5], [0.50, 0.52, 2], [0.78, 0.55, -4], [0.45, 0.80, 3]],
    // Wave
    [[0.15, 0.30, -6], [0.32, 0.18, 3], [0.50, 0.25, -2], [0.68, 0.18, 4], [0.85, 0.30, -5], [0.30, 0.65, 5], [0.70, 0.65, -4]],
  ],
};

// ── Layout computation ─────────────────────────────────────────────────────

function computeLayout(
  count: number,
  canvasW: number,
  canvasH: number,
  captions: string[],
  seed: number,
): PolaroidPlacement[] {
  const rand = mulberry32(seed);
  const clampedCount = Math.max(3, Math.min(7, count));

  // Pick template based on seed
  const templates = TEMPLATES[clampedCount];
  const templateIdx = Math.floor(rand() * templates.length);
  const template = templates[templateIdx];

  // Photo size scales inversely with count
  const photoW = canvasW * (0.50 - clampedCount * 0.026);
  const photoH = photoW; // Square — classic Polaroid

  // Frame padding (proportional to photo size)
  const sidePad = photoW * 0.06;
  const topPad = photoW * 0.06;
  const bottomPad = photoW * 0.18;

  const frameW = photoW + 2 * sidePad;
  const frameH = photoH + topPad + bottomPad;

  const margin = frameW * 0.1;
  const halfFrameW = frameW / 2;
  const halfFrameH = frameH / 2;

  // Small random jitter on top of template positions
  const jitterX = canvasW * 0.03;
  const jitterY = canvasH * 0.03;

  const placements: PolaroidPlacement[] = [];

  for (let i = 0; i < count && i < template.length; i++) {
    const [cxPct, cyPct, baseRot] = template[i];

    // Template position + small jitter
    const dx = (rand() * 2 - 1) * jitterX;
    const dy = (rand() * 2 - 1) * jitterY;
    const rotJitter = (rand() * 2 - 1) * 2; // ±2° extra

    const cx = Math.max(
      margin + halfFrameW,
      Math.min(canvasW - margin - halfFrameW, cxPct * canvasW + dx),
    );
    const cy = Math.max(
      margin + halfFrameH,
      Math.min(canvasH - margin - halfFrameH, cyPct * canvasH + dy),
    );

    placements.push({
      index: i,
      x: cx,
      y: cy,
      rotation: baseRot + rotJitter,
      zIndex: i, // Later items drawn on top (natural stacking)
      caption: captions[i] ?? '',
      photoW,
      photoH,
      frameW,
      frameH,
      sidePad,
      topPad,
      bottomPad,
    });
  }

  return placements;
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function usePolaroidLayout(
  count: number,
  canvasW: number,
  canvasH: number,
  captions: string[],
): PolaroidLayoutResult {
  const [seed, setSeed] = useState(() => Date.now());

  const placements = useMemo(
    () => computeLayout(count, canvasW, canvasH, captions, seed),
    [count, canvasW, canvasH, captions, seed],
  );

  const shuffle = useCallback(() => {
    setSeed(Date.now());
  }, []);

  return { placements, shuffle };
}
