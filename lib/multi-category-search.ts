/**
 * Multi-category search for the Discover "All" view.
 * Fires parallel Google Places searches across travel-relevant categories,
 * deduplicates by place_id, and round-robin interleaves for a varied feed.
 */

import { searchNearby, type NearbyPlace } from '@/lib/google-places';
import { CATEGORY_SEARCH_MAP, CATEGORY_RADIUS_MAP, DEFAULT_SEARCH_RADIUS } from '@/lib/category-config';

/** Categories fetched for the default "All" view */
const ALL_VIEW_CATEGORIES = ['food', 'coffee', 'activity', 'landmark', 'beach'] as const;

export interface MultiCategoryResult {
  places: NearbyPlace[];
}

/**
 * Search multiple travel categories in parallel and merge into a single
 * deduplicated, round-robin interleaved list.
 */
export async function searchMultiCategory(
  coords: { lat: number; lng: number },
  categories: readonly string[] = ALL_VIEW_CATEGORIES,
): Promise<MultiCategoryResult> {
  const searches = categories.map((cat) => {
    const config = CATEGORY_SEARCH_MAP[cat];
    const radius = CATEGORY_RADIUS_MAP[cat] ?? DEFAULT_SEARCH_RADIUS;
    return searchNearby(config?.type, config?.keyword ?? cat, coords, radius)
      .then((result) => ({ cat, places: result.places }));
  });

  const settled = await Promise.allSettled(searches);

  // Collect per-category buckets
  const buckets: NearbyPlace[][] = [];
  for (const result of settled) {
    if (result.status === 'fulfilled' && result.value.places.length > 0) {
      buckets.push(result.value.places);
    }
  }

  // Deduplicate by place_id across all buckets
  const seen = new Set<string>();
  const dedupedBuckets: NearbyPlace[][] = buckets.map((bucket) =>
    bucket.filter((place) => {
      const id = place.place_id;
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    }),
  );

  // Round-robin interleave: take 1 from each bucket in rotation
  const merged: NearbyPlace[] = [];
  let hasMore = true;
  let idx = 0;

  while (hasMore) {
    hasMore = false;
    for (const bucket of dedupedBuckets) {
      if (idx < bucket.length) {
        merged.push(bucket[idx]);
        hasMore = true;
      }
    }
    idx++;
  }

  return { places: merged };
}
