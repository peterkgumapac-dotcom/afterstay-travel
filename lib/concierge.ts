import { generateConciergeSuggestions, type ConciergeSuggestion } from './anthropic';
import { searchNearby } from './google-places';
import type { ConciergeResultPlace, ConciergeWhat } from './types';

// ── Smart defaults based on time of day ─────────────────────────────

function getHourPHT(): number {
  // PHT = UTC+8
  const now = new Date();
  return (now.getUTCHours() + 8) % 24;
}

export function getSmartDefaults(): { suggestedWhat: ConciergeWhat; greeting: string } {
  const h = getHourPHT();
  if (h >= 5 && h < 11) return { suggestedWhat: 'coffee', greeting: 'Good morning' };
  if (h >= 11 && h < 14) return { suggestedWhat: 'food', greeting: 'Lunch time' };
  if (h >= 14 && h < 17) return { suggestedWhat: 'activity', greeting: 'Good afternoon' };
  if (h >= 17 && h < 21) return { suggestedWhat: 'food', greeting: 'Good evening' };
  return { suggestedWhat: 'nightlife', greeting: 'Night owl?' };
}

function getTimeOfDayLabel(): string {
  const h = getHourPHT();
  if (h >= 5 && h < 12) return 'morning';
  if (h >= 12 && h < 17) return 'afternoon';
  if (h >= 17 && h < 21) return 'evening';
  return 'night';
}

// ── Map ConciergeWhat to Google Places search params ────────────────

const WHAT_TO_SEARCH: Record<ConciergeWhat, { type?: string; keyword: string }> = {
  food: { type: 'restaurant', keyword: 'restaurant food' },
  coffee: { type: 'cafe', keyword: 'coffee cafe' },
  activity: { keyword: 'activities tours attractions things to do' },
  nightlife: { type: 'bar', keyword: 'bar nightlife club' },
  wellness: { type: 'spa', keyword: 'spa wellness massage' },
  explore: { keyword: 'tourist attraction viewpoint landmark' },
};

// ── Enrichment: cross-reference AI names against Google Places ──────

async function enrichWithPlaces(
  suggestions: ConciergeSuggestion[],
  coords: { lat: number; lng: number },
): Promise<ConciergeResultPlace[]> {
  // Search Google Places for each suggestion name in parallel
  const enrichments = await Promise.allSettled(
    suggestions.map(async (s) => {
      const { places: results } = await searchNearby(undefined, s.name, coords, 5000);
      // Find a result whose name closely matches
      const match = results.find(
        (r) => r.name.toLowerCase().includes(s.name.toLowerCase().split(' ')[0])
          || s.name.toLowerCase().includes(r.name.toLowerCase().split(' ')[0]),
      );
      return { suggestion: s, match: match ?? results[0] ?? null };
    }),
  );

  return enrichments.map((result) => {
    if (result.status === 'rejected') {
      // AI-only result, no Google enrichment
      const s = suggestions[enrichments.indexOf(result)];
      return {
        name: s.name,
        reason: s.reason,
        isQuickMoment: s.isQuickMoment,
        estimatedDuration: s.estimatedDuration,
        priceRange: s.priceRange,
      };
    }

    const { suggestion, match } = result.value;
    return {
      name: match?.name ?? suggestion.name,
      reason: suggestion.reason,
      isQuickMoment: suggestion.isQuickMoment,
      estimatedDuration: suggestion.estimatedDuration,
      priceRange: suggestion.priceRange,
      placeId: match?.place_id,
      photoUrl: match?.photo_url ?? undefined,
      rating: match?.rating,
      totalRatings: match?.total_ratings,
      lat: match?.lat,
      lng: match?.lng,
      openNow: match?.open_now,
      types: match?.types,
      address: match?.address,
    };
  });
}

// ── Main orchestrator ───────────────────────────────────────────────

export async function runConciergeSearch(input: {
  what: ConciergeWhat | string;
  when: string;
  whoCount: number;
  destination: string;
  hotelName?: string;
  coords: { lat: number; lng: number };
  budget?: number;
  budgetCurrency?: string;
}): Promise<ConciergeResultPlace[]> {
  // Step 1: Get AI suggestions
  const suggestions = await generateConciergeSuggestions({
    what: input.what,
    when: input.when,
    whoCount: input.whoCount,
    destination: input.destination,
    hotelName: input.hotelName,
    currentTimeOfDay: getTimeOfDayLabel(),
    budget: input.budget,
    budgetCurrency: input.budgetCurrency,
  });

  if (suggestions.length === 0) return [];

  // Step 2: Enrich with Google Places data (photos, ratings, coords)
  const enriched = await enrichWithPlaces(suggestions, input.coords);

  // Step 3: If any places still lack coords, try a broader category search
  // to fill in photos and ratings
  const whatKey = input.what as ConciergeWhat;
  const searchParams = WHAT_TO_SEARCH[whatKey];
  if (searchParams) {
    const { places: nearby } = await searchNearby(
      searchParams.type, searchParams.keyword, input.coords, 3000,
    );
    const nearbyMap = new Map(nearby.map((n) => [n.name.toLowerCase(), n]));

    for (const place of enriched) {
      if (place.placeId) continue; // already enriched
      const match = nearbyMap.get(place.name.toLowerCase());
      if (match) {
        place.placeId = match.place_id;
        place.photoUrl = match.photo_url ?? undefined;
        place.rating = match.rating;
        place.totalRatings = match.total_ratings;
        place.lat = match.lat;
        place.lng = match.lng;
        place.openNow = match.open_now;
        place.types = match.types;
        place.address = match.address;
      }
    }
  }

  return enriched;
}
