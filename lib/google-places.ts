// Google Places API client — classic (legacy) endpoints.

const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_KEY ?? '';

const HOTEL_LAT = 11.9710;
const HOTEL_LNG = 121.9215;

export interface PlaceSearchResult {
  place_id: string;
  name: string;
  address: string;
  rating: number;
  total_ratings: number;
  photo_url: string | null;
  lat: number;
  lng: number;
}

function getPhotoUrl(photoRef: string, maxWidth: number = 800): string {
  // Return the Google Places photo URL directly.
  // React Native Image handles the 302 redirect on both iOS and Android.
  return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&photo_reference=${photoRef}&key=${API_KEY}`;
}

export async function searchPlace(
  query: string,
  location: string = 'Boracay, Philippines',
): Promise<PlaceSearchResult | null> {
  if (!API_KEY) return null;

  const encodedQuery = encodeURIComponent(`${query} ${location}`);
  const fields = 'place_id,name,formatted_address,rating,user_ratings_total,photos,geometry';
  const url = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodedQuery}&inputtype=textquery&fields=${fields}&key=${API_KEY}`;

  const res = await fetch(url);
  if (!res.ok) return null;

  const data = await res.json();
  const candidate = data?.candidates?.[0];
  if (!candidate) return null;

  const photoRef = candidate.photos?.[0]?.photo_reference ?? null;
  const photo_url = photoRef ? getPhotoUrl(photoRef) : null;

  return {
    place_id: candidate.place_id ?? '',
    name: candidate.name ?? query,
    address: candidate.formatted_address ?? '',
    rating: candidate.rating ?? 0,
    total_ratings: candidate.user_ratings_total ?? 0,
    photo_url,
    lat: candidate.geometry?.location?.lat ?? 0,
    lng: candidate.geometry?.location?.lng ?? 0,
  };
}

export interface NearbyPlace {
  place_id: string;
  name: string;
  rating: number;
  total_ratings: number;
  price_level?: number;
  address: string;
  lat: number;
  lng: number;
  open_now?: boolean;
  photo_url: string | null;
  types: string[];
}

export interface PlaceDetails {
  name: string;
  rating: number;
  formatted_phone_number?: string;
  formatted_address: string;
  opening_hours?: { weekday_text: string[] };
  reviews?: { author_name: string; rating: number; text: string; relative_time_description: string }[];
  photos: string[];
  website?: string;
  url?: string;
  price_level?: number;
  editorial_summary?: string;
}

export async function searchNearby(type?: string, keyword?: string): Promise<NearbyPlace[]> {
  if (!API_KEY) return [];
  const params = new URLSearchParams({
    location: `${HOTEL_LAT},${HOTEL_LNG}`,
    radius: '3000',
    key: API_KEY,
  });
  if (type) params.append('type', type);
  if (keyword) params.append('keyword', keyword);
  const res = await fetch(`https://maps.googleapis.com/maps/api/place/nearbysearch/json?${params}`);
  if (!res.ok) return [];
  const data = await res.json();
  return (data.results ?? []).map((place: any) => ({
    place_id: place.place_id,
    name: place.name,
    rating: place.rating ?? 0,
    total_ratings: place.user_ratings_total ?? 0,
    price_level: place.price_level,
    address: place.vicinity ?? '',
    lat: place.geometry?.location?.lat ?? 0,
    lng: place.geometry?.location?.lng ?? 0,
    open_now: place.opening_hours?.open_now,
    photo_url: place.photos?.[0]?.photo_reference
      ? getPhotoUrl(place.photos[0].photo_reference)
      : null,
    types: place.types ?? [],
  }));
}

export async function getPlaceDetails(placeId: string): Promise<PlaceDetails | null> {
  if (!API_KEY) return null;
  const fields = 'name,rating,formatted_phone_number,formatted_address,opening_hours,reviews,photos,website,url,price_level,editorial_summary';
  const res = await fetch(
    `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&key=${API_KEY}`
  );
  if (!res.ok) return null;
  const data = await res.json();
  const r = data.result;
  if (!r) return null;
  return {
    name: r.name,
    rating: r.rating ?? 0,
    formatted_phone_number: r.formatted_phone_number,
    formatted_address: r.formatted_address ?? '',
    opening_hours: r.opening_hours ? { weekday_text: r.opening_hours.weekday_text ?? [] } : undefined,
    reviews: (r.reviews ?? []).slice(0, 3).map((rv: any) => ({
      author_name: rv.author_name,
      rating: rv.rating,
      text: rv.text,
      relative_time_description: rv.relative_time_description,
    })),
    photos: (r.photos ?? []).slice(0, 6).map((p: any) => getPhotoUrl(p.photo_reference, 600)),
    website: r.website,
    url: r.url,
    price_level: r.price_level,
    editorial_summary: r.editorial_summary?.overview,
  };
}

export { HOTEL_LAT, HOTEL_LNG };

export async function enrichRecommendations<T extends { name: string }>(
  recs: T[],
): Promise<
  (T & {
    photoUri: string | null;
    googleMapsUri: string | null;
    googlePlaceId: string | null;
    totalRatings: number;
    lat: number;
    lng: number;
  })[]
> {
  if (!API_KEY) {
    return recs.map(r => ({
      ...r,
      photoUri: null,
      googleMapsUri: null,
      googlePlaceId: null,
      totalRatings: 0,
      lat: 0,
      lng: 0,
    }));
  }

  const results = await Promise.allSettled(
    recs.map(rec => searchPlace(rec.name)),
  );

  return recs.map((rec, i) => {
    const result = results[i];
    if (result.status === 'fulfilled' && result.value) {
      const v = result.value;
      const googleMapsUri = `https://www.google.com/maps/place/?q=place_id:${v.place_id}`;
      return {
        ...rec,
        photoUri: v.photo_url,
        googleMapsUri,
        googlePlaceId: v.place_id,
        totalRatings: v.total_ratings,
        lat: v.lat,
        lng: v.lng,
      };
    }
    return {
      ...rec,
      photoUri: null,
      googleMapsUri: null,
      googlePlaceId: null,
      totalRatings: 0,
      lat: 0,
      lng: 0,
    };
  });
}
