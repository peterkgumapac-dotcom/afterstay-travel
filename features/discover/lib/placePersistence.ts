import type { DiscoverPlace } from '@/components/discover/DiscoverPlaceCard';
import type { Place, PlaceCategory, PlaceVote, WishlistItem } from '@/lib/types';

import { resolveCategory } from './screenConfig';

type WishlistPlaceInput = Omit<WishlistItem, 'id' | 'createdAt'>;
type TripPlaceInput = Omit<Place, 'id'> & { tripId?: string };

function placeCategory(placeData: DiscoverPlace, fallback?: PlaceCategory): PlaceCategory | undefined {
  if (placeData.types?.length) return resolveCategory(placeData.types);
  return fallback;
}

export function buildWishlistPlaceInput(
  placeData: DiscoverPlace,
  destination?: string,
): WishlistPlaceInput {
  return {
    name: placeData.n,
    category: placeCategory(placeData),
    googlePlaceId: placeData.placeId,
    photoUrl: placeData.img,
    rating: placeData.r,
    totalRatings: placeData.totalRatings,
    latitude: placeData.lat,
    longitude: placeData.lng,
    destination: destination || undefined,
  };
}

export function buildTripPlaceInput({
  placeData,
  tripId,
  source,
  vote,
}: {
  placeData: DiscoverPlace;
  tripId: string;
  source: 'Manual' | 'Suggested';
  vote: PlaceVote;
}): TripPlaceInput {
  return {
    tripId,
    name: placeData.n,
    category: placeCategory(placeData, 'Do') ?? 'Do',
    distance: placeData.d,
    rating: placeData.r,
    source,
    vote,
    photoUrl: placeData.img,
    googlePlaceId: placeData.placeId,
    latitude: placeData.lat,
    longitude: placeData.lng,
    totalRatings: placeData.totalRatings,
    saved: true,
  };
}
