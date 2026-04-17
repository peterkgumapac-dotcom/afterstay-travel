export type SortBy = 'distance' | 'rating';

export interface Filters {
  sortBy: SortBy;
  minRating: number;      // 0 = no filter, 4.0 / 4.5 etc
  openNow: boolean;
  maxPrice: number | null; // 1-4, null = no filter
}

export const DEFAULT_FILTERS: Filters = {
  sortBy: 'distance',
  minRating: 0,
  openNow: false,
  maxPrice: null,
};

export const applyFilters = <T extends {
  rating?: number;
  distanceKm?: number;
  isOpenNow?: boolean;
  priceLevel?: number;
}>(
  places: T[],
  filters: Filters
): T[] => {
  // Filter
  const filtered = places.filter(p => {
    if (filters.minRating > 0 && (!p.rating || p.rating < filters.minRating)) return false;
    if (filters.openNow && p.isOpenNow !== true) return false;
    if (filters.maxPrice !== null && p.priceLevel !== undefined && p.priceLevel > filters.maxPrice) return false;
    return true;
  });

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    if (filters.sortBy === 'distance') {
      const da = a.distanceKm ?? 999;
      const db = b.distanceKm ?? 999;
      return da - db;
    }
    // rating
    const ra = a.rating ?? 0;
    const rb = b.rating ?? 0;
    return rb - ra; // desc
  });

  return sorted;
};

// Count how many filters are active (for "More" badge)
export const countActiveFilters = (f: Filters): number => {
  let n = 0;
  if (f.minRating > 0) n++;
  if (f.openNow) n++;
  if (f.maxPrice !== null) n++;
  return n;
};
