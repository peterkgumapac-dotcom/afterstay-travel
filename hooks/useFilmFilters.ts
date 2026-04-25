/**
 * Film filter presets — Skia ColorMatrix definitions for the Film Tone Editor.
 *
 * Each filter is a 20-element array (4x5 row-major color matrix) compatible
 * with @shopify/react-native-skia's <ColorMatrix> component.
 *
 * Matrix layout:
 *   [R_r, R_g, R_b, R_a, R_offset,
 *    G_r, G_g, G_b, G_a, G_offset,
 *    B_r, B_g, B_b, B_a, B_offset,
 *    A_r, A_g, A_b, A_a, A_offset]
 *
 * Offset values are in 0-255 range, normalized to 0-1 for Skia.
 */

export interface FilmFilter {
  id: string;
  name: string;
  /** Short feel-description shown under thumbnail */
  vibe: string;
  /** 4x5 color matrix for Skia ColorMatrix */
  matrix: number[];
  /** Whether to apply subtle blur (softness) */
  softness: number;
  /** Whether to show Polaroid-style border */
  border: boolean;
  /** Whether to apply letterbox (cinematic bars) */
  letterbox: boolean;
  /** Grain overlay intensity 0-1 (0 = none) */
  grain: number;
}

// ── Identity (no-op) ────────────────────────────────────────────────────────
const IDENTITY: number[] = [
  1, 0, 0, 0, 0,
  0, 1, 0, 0, 0,
  0, 0, 1, 0, 0,
  0, 0, 0, 1, 0,
];

// ── Kodak Gold 200 ─────────────────────────────────────────────────────────
// Warm yellows, faded shadows, slight saturation boost, lifted blacks
const KODAK_GOLD: number[] = [
  1.15, 0.05, -0.02, 0, 0.04,   // R: boost reds, tiny green bleed, warm offset
  0.02, 1.08,  0.00, 0, 0.03,   // G: slight green boost, warm offset
 -0.03, 0.05,  0.90, 0, 0.02,   // B: pull blues down, faded feel
  0,    0,     0,    1, 0,
];

// ── Fuji Velvia 50 ──────────────────────────────────────────────────────────
// Vivid greens/reds, high contrast, saturated punch
const FUJI_VELVIA: number[] = [
  1.30, -0.10, -0.05, 0, -0.02,  // R: strong red push, pull green/blue
 -0.05,  1.25, -0.05, 0, -0.02,  // G: vivid greens
 -0.05, -0.05,  1.20, 0, -0.03,  // B: moderate blue boost
  0,     0,     0,    1,  0,
];

// ── Polaroid 600 ────────────────────────────────────────────────────────────
// Soft whites, cyan tint in shadows, faded contrast, lifted blacks
const POLAROID: number[] = [
  0.95, 0.05, 0.02, 0, 0.06,    // R: slightly desaturated, lifted
  0.02, 0.95, 0.05, 0, 0.07,    // G: slight cyan push, lifted
  0.03, 0.08, 0.92, 0, 0.10,    // B: cyan tint, more lifted
  0,    0,    0,    1, 0,
];

// ── Ilford HP5 B&W ──────────────────────────────────────────────────────────
// Rich blacks, silver highlight tones, classic B&W luminance weights
const ILFORD_BW: number[] = [
  0.35, 0.50, 0.15, 0, -0.01,   // R: luminance from RGB
  0.35, 0.50, 0.15, 0, -0.01,   // G: same luminance
  0.32, 0.48, 0.15, 0,  0.02,   // B: slight silver warmth in highlights
  0,    0,    0,    1,  0,
];

// ── Cinematic (Teal & Orange) ───────────────────────────────────────────────
// Teal shadows, orange highlights, desaturated midtones
const CINEMATIC: number[] = [
  1.15, 0.05, -0.08, 0, 0.02,   // R: orange push in highlights
 -0.02, 1.05,  0.02, 0, -0.01,  // G: slightly muted
 -0.05, 0.08,  1.15, 0, 0.04,   // B: teal push in shadows
  0,    0,     0,    1, 0,
];

export const FILM_FILTERS: readonly FilmFilter[] = [
  {
    id: 'original',
    name: 'Original',
    vibe: 'No filter',
    matrix: IDENTITY,
    softness: 0,
    border: false,
    letterbox: false,
    grain: 0,
  },
  {
    id: 'kodak-gold',
    name: 'Kodak Gold',
    vibe: 'Warm & nostalgic',
    matrix: KODAK_GOLD,
    softness: 0.4,
    border: false,
    letterbox: false,
    grain: 0.25,
  },
  {
    id: 'fuji-velvia',
    name: 'Fuji Velvia',
    vibe: 'Vivid & punchy',
    matrix: FUJI_VELVIA,
    softness: 0,
    border: false,
    letterbox: false,
    grain: 0,
  },
  {
    id: 'polaroid',
    name: 'Polaroid',
    vibe: 'Soft & dreamy',
    matrix: POLAROID,
    softness: 0.6,
    border: true,
    letterbox: false,
    grain: 0.1,
  },
  {
    id: 'ilford-bw',
    name: 'Ilford B&W',
    vibe: 'Classic silver',
    matrix: ILFORD_BW,
    softness: 0,
    border: false,
    letterbox: false,
    grain: 0.3,
  },
  {
    id: 'cinematic',
    name: 'Cinematic',
    vibe: 'Teal & orange',
    matrix: CINEMATIC,
    softness: 0,
    border: false,
    letterbox: true,
    grain: 0.15,
  },
] as const;

/** Get filter by ID, falls back to 'original' */
export function getFilter(id: string): FilmFilter {
  return FILM_FILTERS.find((f) => f.id === id) ?? FILM_FILTERS[0];
}
