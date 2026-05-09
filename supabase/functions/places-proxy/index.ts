/**
 * places-proxy — Edge Function proxying all Google Places API calls.
 * Keeps the API key server-side. Client sends { action, payload }.
 *
 * Actions: search, nearby, details, location, autocomplete, photo
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const PLACES_BASE = 'https://places.googleapis.com/v1';
const GEOCODE_BASE = 'https://maps.googleapis.com/maps/api/geocode';

const PLACE_SUMMARY_FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.shortFormattedAddress',
  'places.rating',
  'places.userRatingCount',
  'places.priceLevel',
  'places.businessStatus',
  'places.location',
  'places.currentOpeningHours',
  'places.photos',
  'places.types',
  'places.editorialSummary',
].join(',');

const PLACE_DETAIL_FIELD_MASK = [
  'id',
  'displayName',
  'rating',
  'userRatingCount',
  'nationalPhoneNumber',
  'formattedAddress',
  'regularOpeningHours',
  'currentOpeningHours',
  'reviews',
  'photos',
  'websiteUri',
  'googleMapsUri',
  'priceLevel',
  'editorialSummary',
  'location',
  'types',
].join(',');

const AUTOCOMPLETE_FIELD_MASK = [
  'suggestions.placePrediction.placeId',
  'suggestions.placePrediction.text',
].join(',');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function placesHeaders(apiKey: string, fieldMask: string) {
  return {
    'Content-Type': 'application/json',
    'X-Goog-Api-Key': apiKey,
    'X-Goog-FieldMask': fieldMask,
  };
}

function mapPriceLevel(value: string | undefined): number | undefined {
  switch (value) {
    case 'PRICE_LEVEL_FREE': return 0;
    case 'PRICE_LEVEL_INEXPENSIVE': return 1;
    case 'PRICE_LEVEL_MODERATE': return 2;
    case 'PRICE_LEVEL_EXPENSIVE': return 3;
    case 'PRICE_LEVEL_VERY_EXPENSIVE': return 4;
    default: return undefined;
  }
}

function mapBusinessStatus(value: string | undefined): string | undefined {
  switch (value) {
    case 'OPERATIONAL': return 'OPERATIONAL';
    case 'CLOSED_TEMPORARILY': return 'CLOSED_TEMPORARILY';
    case 'CLOSED_PERMANENTLY': return 'CLOSED_PERMANENTLY';
    default: return undefined;
  }
}

function toLegacyPhoto(photo: any) {
  return {
    photo_reference: photo?.name,
    width: photo?.widthPx,
    height: photo?.heightPx,
  };
}

function toLegacyPlace(place: any) {
  return {
    place_id: place.id,
    name: place.displayName?.text ?? '',
    formatted_address: place.formattedAddress ?? '',
    vicinity: place.shortFormattedAddress ?? place.formattedAddress ?? '',
    rating: place.rating ?? 0,
    user_ratings_total: place.userRatingCount ?? 0,
    price_level: mapPriceLevel(place.priceLevel),
    business_status: mapBusinessStatus(place.businessStatus),
    geometry: {
      location: {
        lat: place.location?.latitude ?? 0,
        lng: place.location?.longitude ?? 0,
      },
    },
    opening_hours: place.currentOpeningHours
      ? { open_now: place.currentOpeningHours.openNow }
      : undefined,
    photos: (place.photos ?? []).map(toLegacyPhoto).filter((p: any) => p.photo_reference),
    types: place.types ?? [],
    editorial_summary: place.editorialSummary?.text ?? null,
  };
}

async function resolveNewPhotoUrl(apiKey: string, photoName: string | undefined, maxWidth = 800): Promise<string | null> {
  if (!photoName) return null;
  try {
    const photoUrl = `${PLACES_BASE}/${photoName}/media?maxWidthPx=${maxWidth}&key=${apiKey}`;
    const photoRes = await fetch(photoUrl, { redirect: 'follow' });
    return photoRes.ok ? photoRes.url : null;
  } catch {
    return null;
  }
}

async function withResolvedPhoto(apiKey: string, place: any) {
  const legacy = toLegacyPlace(place);
  const photos: any[] = place.photos ?? [];
  const candidates = photos.slice(0, 5);
  const landscape = candidates.find((p: any) => (p.widthPx ?? 0) > (p.heightPx ?? 0));
  const best = landscape ?? photos[0];
  return {
    ...legacy,
    resolved_photo_url: await resolveNewPhotoUrl(apiKey, best?.name, 800),
  };
}

function isGoogleApiDisabled(data: any): boolean {
  const message = String(data?.error?.message ?? data?.error_message ?? '').toLowerCase();
  return message.includes('disabled') || message.includes('legacy api') || message.includes('not been used');
}

function osmPlaceId(item: any): string {
  return [
    'osm',
    item.osm_type ?? 'node',
    item.osm_id ?? item.id ?? '0',
    item.lat ?? item.center?.lat ?? 0,
    item.lon ?? item.center?.lon ?? 0,
    encodeURIComponent(item.display_name ?? item.tags?.name ?? ''),
  ].join(':');
}

function parseOsmPlaceId(placeId: string) {
  const parts = String(placeId).split(':');
  if (parts[0] !== 'osm') return null;
  const lat = Number(parts[3]);
  const lng = Number(parts[4]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return {
    name: decodeURIComponent(parts.slice(5).join(':')) || 'Selected place',
    lat,
    lng,
  };
}

async function geocodeWithOsm(query: string, limit = 5) {
  const params = new URLSearchParams({
    format: 'jsonv2',
    limit: String(limit),
    q: query,
  });
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'AfterStay/1.3.0 places fallback',
    },
  });
  if (!res.ok) return [];
  return await res.json().catch(() => []);
}

function osmSelectorFor(type: string | undefined, keyword: string | undefined): string {
  const haystack = `${type ?? ''} ${keyword ?? ''}`.toLowerCase();
  if (type === 'restaurant' || haystack.includes('food') || haystack.includes('dinner')) {
    return '["amenity"~"restaurant|fast_food|food_court"]';
  }
  if (type === 'cafe' || haystack.includes('coffee')) return '["amenity"="cafe"]';
  if (type === 'bar' || haystack.includes('nightlife')) return '["amenity"~"bar|pub|nightclub"]';
  if (type === 'atm' || haystack.includes('atm')) return '["amenity"="atm"]';
  if (type === 'store' || haystack.includes('shopping')) return '["shop"]';
  if (type === 'spa' || haystack.includes('wellness') || haystack.includes('massage')) {
    return '["shop"~"massage|beauty"]';
  }
  if (type === 'lodging' || haystack.includes('hotel') || haystack.includes('resort')) return '["tourism"~"hotel|resort|guest_house"]';
  if (haystack.includes('beach')) return '["natural"="beach"]';
  if (type === 'tourist_attraction' || haystack.includes('activity') || haystack.includes('tour') || haystack.includes('landmark')) {
    return '["tourism"~"attraction|viewpoint|theme_park|information"]';
  }
  return '["name"]';
}

function toLegacyOsmPlace(item: any) {
  const tags = item.tags ?? {};
  const lat = item.lat ?? item.center?.lat ?? 0;
  const lng = item.lon ?? item.center?.lon ?? 0;
  const category = tags.amenity ?? tags.tourism ?? tags.shop ?? tags.natural ?? 'place';
  const address = [
    tags['addr:street'],
    tags['addr:barangay'],
    tags['addr:city'],
    tags['addr:province'],
  ].filter(Boolean).join(', ');
  return {
    place_id: osmPlaceId({ ...item, lat, lon: lng, display_name: tags.name }),
    name: tags.name ?? tags.brand ?? category,
    formatted_address: address,
    vicinity: address,
    rating: 0,
    user_ratings_total: 0,
    geometry: { location: { lat, lng } },
    photos: [],
    types: [category].filter(Boolean),
    editorial_summary: null,
    resolved_photo_url: null,
  };
}

async function searchNearbyWithOsm(lat: number, lng: number, radius: number, type?: string, keyword?: string) {
  const safeRadius = Math.min(Math.max(Number(radius) || 5000, 500), 25000);
  const selector = osmSelectorFor(type, keyword);
  const query = `
    [out:json][timeout:12];
    (
      node(around:${safeRadius},${lat},${lng})${selector};
      way(around:${safeRadius},${lat},${lng})${selector};
      relation(around:${safeRadius},${lat},${lng})${selector};
    );
    out center tags 40;
  `;
  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'AfterStay/1.3.0 places fallback',
    },
    body: new URLSearchParams({ data: query }).toString(),
  });
  if (!res.ok) return [];
  const data = await res.json().catch(() => ({}));
  const seen = new Set<string>();
  return (data.elements ?? [])
    .map(toLegacyOsmPlace)
    .filter((place: any) => {
      if (!place.name || !place.geometry.location.lat || !place.geometry.location.lng) return false;
      const key = `${place.name}:${place.geometry.location.lat}:${place.geometry.location.lng}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 20);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Validate auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonResponse({ error: 'Missing auth' }, 401);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const apiKey = Deno.env.get('GOOGLE_PLACES_API_KEY');
    if (!apiKey) {
      return jsonResponse({ error: 'Places service not configured' }, 500);
    }

    const { action, payload } = await req.json();

	    switch (action) {
	      case 'search': {
	        const { query } = payload;
	        const res = await fetch(`${PLACES_BASE}/places:searchText`, {
	          method: 'POST',
	          headers: placesHeaders(apiKey, PLACE_SUMMARY_FIELD_MASK),
	          body: JSON.stringify({
	            textQuery: String(query ?? '').trim(),
	            maxResultCount: 1,
	          }),
	        });
	        const data = await res.json();
	        if (!res.ok) {
	          if (isGoogleApiDisabled(data)) {
	            const fallback = await geocodeWithOsm(String(query ?? '').trim(), 1);
	            return jsonResponse({
	              status: fallback.length ? 'OK' : 'ZERO_RESULTS',
	              candidates: fallback.map((item: any) => ({
	                place_id: osmPlaceId(item),
	                name: item.name ?? item.display_name?.split(',')?.[0] ?? String(query ?? ''),
	                formatted_address: item.display_name ?? '',
	                rating: 0,
	                user_ratings_total: 0,
	                photos: [],
	                geometry: {
	                  location: {
	                    lat: Number(item.lat),
	                    lng: Number(item.lon),
	                  },
	                },
	              })),
	            });
	          }
	          return jsonResponse({ status: 'ERROR', error_message: data?.error?.message ?? 'Places search failed' });
	        }
	        return jsonResponse({
	          status: data.places?.length ? 'OK' : 'ZERO_RESULTS',
	          candidates: (data.places ?? []).map(toLegacyPlace),
	        });
	      }

	      case 'nearby': {
	        const { lat, lng, radius, type, keyword, pagetoken } = payload;
	        const center = {
	          latitude: Number(lat),
	          longitude: Number(lng),
	        };
	        const locationBias = {
	          circle: {
	            center,
	            radius: Number(radius || 5000),
	          },
	        };
	        const textQuery = [keyword, type].filter(Boolean).join(' ').trim();
	        const useTextSearch = Boolean(keyword || pagetoken);
	        const res = await fetch(
	          useTextSearch ? `${PLACES_BASE}/places:searchText` : `${PLACES_BASE}/places:searchNearby`,
	          {
	            method: 'POST',
	            headers: placesHeaders(apiKey, PLACE_SUMMARY_FIELD_MASK),
	            body: JSON.stringify(useTextSearch
	              ? {
	                  textQuery: textQuery || 'places',
	                  locationBias,
	                  includedType: type || undefined,
	                  pageToken: pagetoken || undefined,
	                  maxResultCount: 20,
	                }
	              : {
	                  includedTypes: type ? [type] : undefined,
	                  maxResultCount: 20,
	                  locationRestriction: locationBias,
	                }),
	          },
	        );
	        const data = await res.json();
	        if (!res.ok) {
	          if (isGoogleApiDisabled(data)) {
	            const fallback = await searchNearbyWithOsm(Number(lat), Number(lng), Number(radius || 5000), type, keyword);
	            return jsonResponse({
	              results: fallback,
	              next_page_token: null,
	              status: fallback.length ? 'OK' : 'ZERO_RESULTS',
	            });
	          }
	          return jsonResponse({ status: 'ERROR', error_message: data?.error?.message ?? 'Nearby search failed' });
	        }
	        const enriched = await Promise.all((data.places ?? []).map((place: any) => withResolvedPhoto(apiKey, place)));

	        return jsonResponse({
	          results: enriched,
	          next_page_token: data.nextPageToken ?? null,
	          status: enriched.length ? 'OK' : 'ZERO_RESULTS',
	        });
	      }

	      case 'details': {
	        const { placeId, fields } = payload;
	        const osmLocation = parseOsmPlaceId(String(placeId ?? ''));
	        if (osmLocation) {
	          return jsonResponse({
	            status: 'OK',
	            result: {
	              place_id: placeId,
	              name: osmLocation.name,
	              formatted_address: osmLocation.name,
	              rating: 0,
	              user_ratings_total: 0,
	              photos: [],
	              geometry: {
	                location: {
	                  lat: osmLocation.lat,
	                  lng: osmLocation.lng,
	                },
	              },
	              url: `https://www.google.com/maps/search/?api=1&query=${osmLocation.lat},${osmLocation.lng}`,
	            },
	          });
	        }
	        const f = fields || PLACE_DETAIL_FIELD_MASK;
	        const url = `${PLACES_BASE}/places/${placeId}`;
	        const res = await fetch(url, {
	          headers: placesHeaders(apiKey, String(f)),
	        });
	        const data = await res.json();
	        if (!res.ok) {
	          return jsonResponse({ status: 'ERROR', error_message: data?.error?.message ?? 'Place details failed' });
	        }
	        return jsonResponse({
	          status: 'OK',
	          result: {
	            ...toLegacyPlace(data),
	            formatted_phone_number: data.nationalPhoneNumber,
	            opening_hours: {
	              weekday_text: data.regularOpeningHours?.weekdayDescriptions ?? [],
	              open_now: data.currentOpeningHours?.openNow,
	            },
	            reviews: (data.reviews ?? []).map((review: any) => ({
	              author_name: review.authorAttribution?.displayName ?? '',
	              rating: review.rating ?? 0,
	              text: review.text?.text ?? '',
	              relative_time_description: review.relativePublishTimeDescription ?? '',
	            })),
	            website: data.websiteUri,
	            url: data.googleMapsUri,
	            editorial_summary: data.editorialSummary ? { overview: data.editorialSummary.text } : undefined,
	          },
	        });
	      }

	      case 'location': {
	        const { placeId } = payload;
	        const osmLocation = parseOsmPlaceId(String(placeId ?? ''));
	        if (osmLocation) {
	          return jsonResponse({
	            status: 'OK',
	            result: {
	              name: osmLocation.name,
	              geometry: { location: { lat: osmLocation.lat, lng: osmLocation.lng } },
	            },
	          });
	        }
	        const url = `${PLACES_BASE}/places/${placeId}`;
	        const res = await fetch(url, {
	          headers: placesHeaders(apiKey, 'id,displayName,location'),
	        });
	        const data = await res.json();
	        if (!res.ok) {
	          return jsonResponse({ status: 'ERROR', error_message: data?.error?.message ?? 'Place location failed' });
	        }
	        return jsonResponse({
	          status: 'OK',
	          result: {
	            name: data.displayName?.text ?? '',
	            geometry: {
	              location: {
	                lat: data.location?.latitude,
	                lng: data.location?.longitude,
	              },
	            },
	          },
	        });
	      }

	      case 'autocomplete': {
	        const { input, lat, lng } = payload;
	        const hasBias = lat && lng;
	        const res = await fetch(`${PLACES_BASE}/places:autocomplete`, {
	          method: 'POST',
	          headers: placesHeaders(apiKey, AUTOCOMPLETE_FIELD_MASK),
	          body: JSON.stringify({
	            input: String(input ?? '').trim(),
	            locationBias: hasBias
	              ? {
	                  circle: {
	                    center: { latitude: Number(lat), longitude: Number(lng) },
	                    radius: 5000,
	                  },
	                }
	              : undefined,
	          }),
	        });
	        const data = await res.json();
	        if (!res.ok) {
	          if (isGoogleApiDisabled(data)) {
	            const fallback = await geocodeWithOsm(String(input ?? '').trim(), 5);
	            const predictions = fallback.map((item: any) => ({
	              place_id: osmPlaceId(item),
	              description: item.display_name ?? item.name ?? String(input ?? ''),
	            }));
	            return jsonResponse({
	              status: predictions.length ? 'OK' : 'ZERO_RESULTS',
	              predictions,
	            });
	          }
	          return jsonResponse({ status: 'ERROR', error_message: data?.error?.message ?? 'Autocomplete failed' });
	        }
	        const predictions = (data.suggestions ?? [])
	          .map((suggestion: any) => suggestion.placePrediction)
	          .filter(Boolean)
	          .map((prediction: any) => ({
	            place_id: prediction.placeId,
	            description: prediction.text?.text ?? '',
	          }))
	          .filter((prediction: any) => prediction.place_id && prediction.description);
	        return jsonResponse({
	          status: predictions.length ? 'OK' : 'ZERO_RESULTS',
	          predictions,
	        });
	      }

	      case 'photo': {
	        const { photoReference, maxWidth } = payload;
	        const url = await resolveNewPhotoUrl(apiKey, photoReference, maxWidth || 800);
	        return jsonResponse({ url });
	      }

      case 'geocode': {
        const { lat, lng, resultType } = payload;
        const params = new URLSearchParams({
          latlng: `${lat},${lng}`,
          key: apiKey,
        });
        if (resultType) params.append('result_type', String(resultType));
        const res = await fetch(`${GEOCODE_BASE}/json?${params}`);
        const data = await res.json();
        return jsonResponse(data);
      }

      default:
        return jsonResponse({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500);
  }
});
