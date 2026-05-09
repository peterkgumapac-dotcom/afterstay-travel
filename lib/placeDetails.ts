
import { getPlaceDetails } from './google-places';

export interface Review {
  authorName: string;
  authorPhoto?: string;
  rating: number;
  relativeTime: string;
  text: string;
}

export interface PlaceDetails {
  name: string;
  address?: string;
  phone?: string;
  website?: string;
  rating?: number;
  totalReviews?: number;
  priceLevel?: number;
  openingHours?: string[];
  isOpenNow?: boolean;
  photos: string[];
  reviews: Review[];
  coords?: { lat: number; lng: number };
}

export const fetchPlaceDetails = async (placeId: string): Promise<PlaceDetails | null> => {
  const proxied = await getPlaceDetails(placeId);
  if (!proxied) return null;

  return {
    name: proxied.name,
    address: proxied.formatted_address,
    phone: proxied.formatted_phone_number,
    website: proxied.website,
    rating: proxied.rating,
    totalReviews: proxied.total_ratings,
    priceLevel: proxied.price_level,
    openingHours: proxied.opening_hours?.weekday_text,
    isOpenNow: proxied.opening_hours?.open_now,
    photos: proxied.photos,
    coords: proxied.coords,
    reviews: (proxied.reviews ?? []).map((rv): Review => ({
      authorName: rv.author_name,
      rating: rv.rating,
      relativeTime: rv.relative_time_description,
      text: rv.text,
    })),
  };
};
