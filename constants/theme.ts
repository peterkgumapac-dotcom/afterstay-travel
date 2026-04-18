export const colors = {
  // Backgrounds — warm espresso
  bg: '#141210',
  bg2: '#1b1814',
  bg3: '#231e19',
  canvas: '#0f0d0b',
  card: '#1f1b17',
  card2: '#262019',
  elevated: '#2c251e',
  border: '#2e2822',
  border2: '#3e362e',
  ink: '#f2ece3',

  // Text
  text: '#f1ebe2',
  text2: '#b8afa3',
  text3: '#857d70',
  textDim: '#544b41',

  // Accent — warm sand
  accent: '#d8ab7a',
  accentDk: '#c49460',
  accentLt: '#e6c196',
  accentDim: 'rgba(216, 171, 122, 0.14)',
  accentBg: 'rgba(216, 171, 122, 0.10)',
  accentBorder: 'rgba(216, 171, 122, 0.32)',

  // Semantic
  warn: '#e2b361',
  info: '#c49460',
  success: '#d8ab7a',

  // FAB radial colors
  fab1: '#c49460',
  fab2: '#d17858',
  fab3: '#b89478',
  fab4: '#d9a441',

  // Chart colors
  chart1: '#d8ab7a',
  chart2: '#d17858',
  chart3: '#b89478',
  chart4: '#d9a441',
  chart5: '#c49460',

  // Inverse surface
  black: '#f1ebe2',
  onBlack: '#18140f',

  // Utility
  gold: '#d9a441',
  coral: '#e38868',
  danger: '#c4554a',
  warnBg: 'rgba(217, 164, 65, 0.14)',
  warnBorder: 'rgba(217, 164, 65, 0.32)',
  warnInk: '#e2b361',

  // Legacy aliases (for backward compatibility during migration)
  green: '#d8ab7a',
  green2: '#e6c196',
  blue: '#c49460',
  amber: '#e2b361',
  red: '#c4554a',
  purple: '#c49460',
  pink: '#d17858',
  white: '#ffffff',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const radius = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 22,
  xl: 28,
  xxl: 36,
  pill: 999,
} as const;

export const typography = {
  h1: { fontSize: 28, fontWeight: '600' as const, letterSpacing: -0.8 },
  h2: { fontSize: 22, fontWeight: '600' as const, letterSpacing: -0.7 },
  h3: { fontSize: 18, fontWeight: '600' as const, letterSpacing: -0.5 },
  body: { fontSize: 15, fontWeight: '400' as const, lineHeight: 22 },
  bodyBold: { fontSize: 15, fontWeight: '600' as const, lineHeight: 22 },
  caption: { fontSize: 12, fontWeight: '500' as const, color: colors.text2 },
  sectionLabel: { fontSize: 11, fontWeight: '600' as const, textTransform: 'uppercase' as const, letterSpacing: 1.7, color: colors.text3 },
  eyebrow: { fontSize: 10, fontWeight: '600' as const, textTransform: 'uppercase' as const, letterSpacing: 1.8, color: colors.text3 },
  mono: { fontFamily: 'SpaceMono', fontSize: 14 },
  display: { fontWeight: '500' as const, letterSpacing: -0.8 },
} as const;

export const density = {
  padCard: 18,
  padStack: 16,
  cardGap: 14,
  rowV: 14,
} as const;

export const elevation = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.30,
    shadowRadius: 6,
    elevation: 4,
  },
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 3,
    elevation: 2,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.38,
    shadowRadius: 28,
    elevation: 8,
  },
} as const;
