
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
  const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_KEY ?? '';
  if (!API_KEY) return null;

  const fields = [
    'name', 'formatted_address', 'formatted_phone_number',
    'website', 'rating', 'user_ratings_total', 'price_level',
    'opening_hours', 'photos', 'reviews', 'geometry',
  ].join(',');

  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&key=${API_KEY}`;

  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data.status !== 'OK') return null;
    const r = data.result;

    return {
      name: r.name,
      address: r.formatted_address,
      phone: r.formatted_phone_number,
      website: r.website,
      rating: r.rating,
      totalReviews: r.user_ratings_total,
      priceLevel: r.price_level,
      openingHours: r.opening_hours?.weekday_text,
      isOpenNow: r.opening_hours?.open_now,
      photos: (r.photos || []).slice(0, 8).map((p: any) =>
        `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${p.photo_reference}&key=${API_KEY}`
      ),
      reviews: (r.reviews || []).slice(0, 5).map((rv: any): Review => ({
        authorName: rv.author_name,
        authorPhoto: rv.profile_photo_url,
        rating: rv.rating,
        relativeTime: rv.relative_time_description,
        text: rv.text,
      })),
      coords: r.geometry?.location,
    };
  } catch {
    return null;
  }
};
