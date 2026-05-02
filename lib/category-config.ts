/**
 * Category → Google Places API search config.
 * Shared between discover.tsx (single-category) and multi-category-search.ts (All view).
 */

export const CATEGORY_SEARCH_MAP: Record<string, { type?: string; keyword?: string }> = {
  beach: { keyword: 'beach' },
  food: { type: 'restaurant', keyword: 'food' },
  activity: { keyword: 'water sports activities tours' },
  nightlife: { type: 'bar', keyword: 'nightlife bar club' },
  photo: { keyword: 'viewpoint scenic photo spot' },
  wellness: { type: 'spa', keyword: 'spa wellness massage yoga' },
  coffee: { type: 'cafe', keyword: 'coffee cafe espresso' },
  atm: { type: 'atm', keyword: 'atm cash withdraw money changer' },
  shopping: { type: 'store', keyword: 'shopping mall market souvenir' },
  landmark: { type: 'tourist_attraction', keyword: 'landmark monument attraction viewpoint' },
  'date night': { type: 'restaurant', keyword: 'romantic dinner date night' },
  'rainy day': { keyword: 'museum indoor entertainment bowling arcade' },
  'worth the drive': { keyword: 'scenic viewpoint waterfall nature resort' },
  'budget friendly': { keyword: 'cheap eats street food market free' },
};

export const CATEGORY_RADIUS_MAP: Record<string, number> = {
  beach: 10000, food: 5000, activity: 15000, nightlife: 5000,
  photo: 10000, wellness: 5000, coffee: 2000, atm: 2000,
  shopping: 5000, landmark: 15000,
  'date night': 5000, 'rainy day': 5000, 'worth the drive': 25000, 'budget friendly': 5000,
};

export const DEFAULT_SEARCH_RADIUS = 5000;
