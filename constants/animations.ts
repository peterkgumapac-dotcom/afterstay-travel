/**
 * Animation constants for AfterStay Moments
 * All springs run on the UI thread via Reanimated 3
 */

export const colors = {
  bg: '#0A0A0A',
  accent: '#d8ab7a',
  destructive: '#ff4444',
  success: '#4CAF50',
  reelPurple: '#9C27B0',
  glassBg: '#1a1a1a',
  goldenGlow: '#d8ab7a',
} as const;

// Critically-damped springs — Apple-style, no overshoot.
// damping ratio ≥ 1.0 for all presets (critically or over-damped).
export const springPresets = {
  SNAPPY: { stiffness: 500, damping: 40, mass: 0.8 },
  GENTLE: { stiffness: 300, damping: 35, mass: 1 },
  BOUNCY: { stiffness: 400, damping: 38, mass: 1 },       // no longer bouncy despite name
  SLOW: { stiffness: 200, damping: 30, mass: 1.2 },
  GRID_ENTER: { stiffness: 400, damping: 38, mass: 1 },
  CAROUSEL_SNAP: { stiffness: 400, damping: 38, mass: 0.8 },
  DISMISS: { stiffness: 400, damping: 38, mass: 1 },
  SHARED_ELEMENT: { stiffness: 500, damping: 44, mass: 1 },
  SHEET_REVEAL: { stiffness: 500, damping: 44, mass: 1 },
  HEART_BURST: { stiffness: 400, damping: 15, mass: 1 },   // keep playful
  CHECK_POP: { stiffness: 500, damping: 42, mass: 0.8 },
  PRESS: { stiffness: 600, damping: 44, mass: 0.8 },
  TILT_RELEASE: { stiffness: 300, damping: 34, mass: 1 },
} as const;

export const durations = {
  sharedElement: 400,
  heartBurst: 600,
  goldenBorder: 300,
  gridStagger: 50,
  pressFeedback: 100,
  longPress: 400,
  pullToRefresh: 80,
} as const;

export const stagger = {
  gridItem: 50,
  particle: 30,
  rowParallax: [0.9, 1.0, 1.1] as const,
} as const;

export const thresholds = {
  dismissSwipe: 150,
  actionSheetSwipe: 100,
  pullToRefresh: 80,
  flickVelocity: 500,
  edgeResistance: 0.3,
  longPress: 400,
} as const;

export const scales = {
  pressDown: 0.97,
  tiltMaxDeg: 3,
  tiltPerspective: 1200,
  carouselAdjacent: 0.85,
  carouselAdjacentOpacity: 0.5,
  carouselOvershoot: 1.05,
  carouselRotateY: 15,
  dismissEnd: 0.8,
  selectionActive: 0.95,
  unselectedOpacity: 0.6,
  heartStart: 1.0,
  heartPeak: 1.1,
  heartBurst: 1.5,
  gridCompressY: 0.98,
  emptyFloatAmp: 10,
  emptyFloatPeriod: 3000,
} as const;

export const particleConfig = {
  count: 12,
  angleInterval: 30, // degrees
  distanceMin: 50,
  distanceMax: 80,
  colors: ['#d8ab7a', '#e6c196', '#d9a441', '#f0d4a0', '#c49460'],
} as const;
