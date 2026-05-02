/**
 * Photo adjustment hook — IG-style slider math for Skia ColorMatrix.
 *
 * Each adjustment maps a -100..+100 integer to a 4x5 color matrix.
 * Matrices are composed (multiplied) in a fixed order on top of the
 * active film filter matrix so adjustments stack predictably.
 */

import { useMemo, useCallback, useState } from 'react';
import { IDENTITY } from '@/hooks/useFilmFilters';

// ── Types ──────────────────────────────────────────────────────────────────

export interface AdjustmentValues {
  brightness: number;
  contrast: number;
  warmth: number;
  saturation: number;
  fade: number;
  vignette: number;
  grain: number;
}

export const DEFAULT_ADJUSTMENTS: AdjustmentValues = {
  brightness: 0,
  contrast: 0,
  warmth: 0,
  saturation: 0,
  fade: 0,
  vignette: 0,
  grain: 0,
};

export type AdjustmentKey = keyof AdjustmentValues;

// ── 4x5 matrix math ───────────────────────────────────────────────────────
//
// Layout (row-major, Skia convention):
//   [R_r, R_g, R_b, R_a, R_off,
//    G_r, G_g, G_b, G_a, G_off,
//    B_r, B_g, B_b, B_a, B_off,
//    A_r, A_g, A_b, A_a, A_off]
//
// We treat columns 0-3 as a 4x4 transform and column 4 as the offset.

export function multiplyColorMatrices(a: number[], b: number[]): number[] {
  const result = new Array<number>(20).fill(0);

  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      result[row * 5 + col] =
        a[row * 5 + 0] * b[0 * 5 + col] +
        a[row * 5 + 1] * b[1 * 5 + col] +
        a[row * 5 + 2] * b[2 * 5 + col] +
        a[row * 5 + 3] * b[3 * 5 + col];
    }
    // Offset column: a's 4x4 * b's offset + a's offset
    result[row * 5 + 4] =
      a[row * 5 + 0] * b[0 * 5 + 4] +
      a[row * 5 + 1] * b[1 * 5 + 4] +
      a[row * 5 + 2] * b[2 * 5 + 4] +
      a[row * 5 + 3] * b[3 * 5 + 4] +
      a[row * 5 + 4];
  }

  return result;
}

// ── Individual matrix builders ─────────────────────────────────────────────

/** Brightness: shift R/G/B offsets. v in -100..100 */
export function brightnessMatrix(v: number): number[] {
  const t = v / 100;
  return [
    1, 0, 0, 0, t * 0.3,
    0, 1, 0, 0, t * 0.3,
    0, 0, 1, 0, t * 0.3,
    0, 0, 0, 1, 0,
  ];
}

/** Contrast: scale around midpoint. v in -100..100 */
export function contrastMatrix(v: number): number[] {
  const c = 1 + v / 100;
  const o = -0.5 * c + 0.5;
  return [
    c, 0, 0, 0, o,
    0, c, 0, 0, o,
    0, 0, c, 0, o,
    0, 0, 0, 1, 0,
  ];
}

/** Saturation: luminance-weighted. v in -100..100 */
export function saturationMatrix(v: number): number[] {
  const s = 1 + v / 100;
  const sr = (1 - s) * 0.2126;
  const sg = (1 - s) * 0.7152;
  const sb = (1 - s) * 0.0722;
  return [
    sr + s, sg,     sb,     0, 0,
    sr,     sg + s, sb,     0, 0,
    sr,     sg,     sb + s, 0, 0,
    0,      0,      0,      1, 0,
  ];
}

/** Warmth: push reds warm, blues cool. v in -100..100 */
export function warmthMatrix(v: number): number[] {
  const t = v / 100;
  return [
    1, 0, 0, 0,  t * 0.15,
    0, 1, 0, 0,  t * 0.05,
    0, 0, 1, 0, -t * 0.15,
    0, 0, 0, 1,  0,
  ];
}

/** Fade: lift black point (shadow fade). v in -100..100, only positive has effect */
export function fadeMatrix(v: number): number[] {
  const t = Math.max(0, v / 100);
  const scale = 1 - t * 0.3;
  const offset = t * 0.3;
  return [
    scale, 0,     0,     0, offset,
    0,     scale, 0,     0, offset,
    0,     0,     scale, 0, offset,
    0,     0,     0,     1, 0,
  ];
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function usePhotoAdjustments(filterMatrix: number[]) {
  const [values, setValues] = useState<AdjustmentValues>({ ...DEFAULT_ADJUSTMENTS });

  const setValue = useCallback((key: AdjustmentKey, value: number) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  const resetAll = useCallback(() => {
    setValues({ ...DEFAULT_ADJUSTMENTS });
  }, []);

  const combinedMatrix = useMemo(() => {
    let matrix = filterMatrix;

    // Chain each non-identity adjustment in fixed order
    if (values.brightness !== 0) matrix = multiplyColorMatrices(matrix, brightnessMatrix(values.brightness));
    if (values.contrast !== 0)   matrix = multiplyColorMatrices(matrix, contrastMatrix(values.contrast));
    if (values.saturation !== 0) matrix = multiplyColorMatrices(matrix, saturationMatrix(values.saturation));
    if (values.warmth !== 0)     matrix = multiplyColorMatrices(matrix, warmthMatrix(values.warmth));
    if (values.fade !== 0)       matrix = multiplyColorMatrices(matrix, fadeMatrix(values.fade));

    return matrix;
  }, [filterMatrix, values.brightness, values.contrast, values.saturation, values.warmth, values.fade]);

  // Vignette and grain are not ColorMatrix ops — pass intensities separately
  const vignetteIntensity = Math.max(0, values.vignette / 100);
  const grainIntensity = Math.max(0, values.grain / 100);

  const hasAdjustments = Object.values(values).some((v) => v !== 0);

  return {
    values,
    setValue,
    resetAll,
    combinedMatrix,
    vignetteIntensity,
    grainIntensity,
    hasAdjustments,
  };
}
