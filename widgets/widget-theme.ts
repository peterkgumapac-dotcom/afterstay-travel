// Hardcoded theme constants for Android widgets.
// Widgets run in a headless JS context — no React context or hooks available.
// Must use solid hex colors only (no rgba — RemoteViews may not render alpha).

export const WT = {
  bg: '#141210',
  card: '#1f1b17',
  card2: '#262019',
  border: '#2e2822',
  text: '#f1ebe2',
  text2: '#b8afa3',
  text3: '#857d70',
  textDim: '#544b41',
  accent: '#d8ab7a',
  accentDk: '#c49460',
  danger: '#c4554a',
  warn: '#e2b361',
  coral: '#e38868',
  // Budget category colors
  catFood: '#d8ab7a',
  catTransport: '#c49460',
  catActivity: '#e2b361',
  catAccommodation: '#e38868',
  catShopping: '#8a5a2b',
  catOther: '#857d70',
  // Daily tracker category colors
  catBills: '#e2b361',
  catEntertainment: '#e38868',
  catGroceries: '#8a5a2b',
} as const;

export const CATEGORY_COLOR: Record<string, string> = {
  Food: WT.catFood,
  Transport: WT.catTransport,
  Activity: WT.catActivity,
  Accommodation: WT.catAccommodation,
  Shopping: WT.catShopping,
  Bills: WT.catBills,
  Entertainment: WT.catEntertainment,
  Groceries: WT.catGroceries,
  Other: WT.catOther,
};

export const WFont = {
  mono: 'SpaceMono-Regular',
  size: { xs: 10, sm: 12, md: 14, lg: 18, xl: 22, xxl: 28 },
} as const;
