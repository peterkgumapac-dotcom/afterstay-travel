import type { WishlistItem } from './types';

export type WishlistRow = {
  user_id: string;
  name: string;
  category: string | null;
  google_place_id: string | null;
  photo_url: string | null;
  rating: number | null;
  total_ratings: number | null;
  latitude: number | null;
  longitude: number | null;
  address: string | null;
  destination: string | null;
  notes: string | null;
  source_post_id: string | null;
  source_trip_id: string | null;
};

export function buildWishlistRow(
  userId: string,
  item: Omit<WishlistItem, 'id' | 'createdAt'>,
): WishlistRow {
  const destination = item.destination?.trim() || null;
  const name = item.name?.trim() || destination || 'Saved idea';

  return {
    user_id: userId,
    name,
    category: item.category ?? null,
    google_place_id: item.googlePlaceId ?? null,
    photo_url: item.photoUrl ?? null,
    rating: item.rating ?? null,
    total_ratings: item.totalRatings ?? null,
    latitude: item.latitude ?? null,
    longitude: item.longitude ?? null,
    address: item.address ?? null,
    destination,
    notes: item.notes ?? null,
    source_post_id: item.sourcePostId ?? null,
    source_trip_id: item.sourceTripId ?? null,
  };
}
