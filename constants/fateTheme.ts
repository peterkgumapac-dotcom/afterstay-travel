import { TextStyle } from 'react-native';

// ─── Color tokens ────────────────────────────────────────────
export const fateColors = {
  background: '#F5EEDC',
  backgroundDeep: '#EDE3CC',
  surface: '#FFFFFF',
  surfaceBorder: 'rgba(139, 90, 43, 0.2)',

  textPrimary: '#3C2814',
  textSecondary: 'rgba(60, 40, 20, 0.65)',
  textTertiary: 'rgba(60, 40, 20, 0.5)',
  textMuted: 'rgba(60, 40, 20, 0.4)',

  primary: '#B8541A',
  primaryText: '#8B3A10',
  secondary: '#DB7A3C',
  accent: '#C59820',
  warm: '#8B5A2B',

  divider: 'rgba(139, 90, 43, 0.15)',
  dividerStrong: 'rgba(139, 90, 43, 0.2)',

  buttonPrimary: '#3C2814',
  buttonPrimaryText: '#F5EEDC',

  shadow: 'rgba(60, 40, 20, 0.08)',
  shadowStrong: 'rgba(60, 40, 20, 0.15)',
};

// ─── Person colors (wheel slices + finger circles) ──────────
export const personColors = [
  '#B8541A', // burnt orange
  '#DB7A3C', // soft orange
  '#C59820', // mustard
  '#8B5A2B', // saddle brown
  '#A84518', // deep orange
  '#E8A854', // light amber
  '#6B4423', // dark brown
  '#D4A038', // yellow-gold
  '#C2612E', // rust
  '#7A4818', // walnut
];

export function colorForName(_name: string, index: number): string {
  return personColors[index % personColors.length];
}

// ─── Typography ─────────────────────────────────────────────
export const fateFonts = {
  serif: 'Georgia',
  // sans: omit fontFamily to use platform default (SF Pro / Roboto)
};

export const fateText: Record<string, TextStyle> = {
  kicker: {
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: '500',
    color: fateColors.warm,
    textTransform: 'uppercase',
  },
  headline: {
    fontFamily: fateFonts.serif,
    fontSize: 28,
    fontWeight: '500',
    color: fateColors.textPrimary,
    letterSpacing: -0.5,
  },
  body: {
    fontSize: 14,
    color: fateColors.textSecondary,
    lineHeight: 21,
  },
  bodyItalic: {
    fontSize: 13,
    color: fateColors.textSecondary,
    fontStyle: 'italic',
  },
};

// ─── Component constants ────────────────────────────────────
export const fateLayout = {
  buttonRadius: 10,
  buttonPaddingV: 16,
  cardRadius: 20,
  cardPaddingH: 48,
  cardPaddingV: 36,
  tabBarRadius: 8,
  tabBarPadding: 3,
  tabActiveRadius: 6,
};

// ─── Animation timing ───────────────────────────────────────
export const fateTiming = {
  wheelMainSpin: 2500,
  wheelFakeOutSlow: 1200,
  wheelFakeOutSlowDecay: 200,
  wheelFakeOutPush: 700,
  wheelFinalLand: 1800,
  spotlightHopStart: 300,
  spotlightHopMin: 80,
  heartbeatStart: 1200,
  heartbeatMin: 150,
  winnerRevealSpring: { damping: 12 },
  pageTransition: 240,
};
