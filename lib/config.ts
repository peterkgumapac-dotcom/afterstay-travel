// Mutable hotel coords — updated at runtime from the active trip.
// Defaults to 0,0 (no location) — set via setHotelCoords() when trip loads.
const _hotelCoords = { lat: 0, lng: 0 };

export const CONFIG = {
  GOOGLE_MAPS_KEY: process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY || process.env.EXPO_PUBLIC_GOOGLE_PLACES_KEY || '',
  SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL || '',
  SUPABASE_KEY: process.env.EXPO_PUBLIC_SUPABASE_KEY || '',
  WEATHER_KEY: process.env.EXPO_PUBLIC_WEATHER_API_KEY || '',
  // ANTHROPIC_KEY removed — AI calls now go through ai-proxy Edge Function
  TRIP_PAGE_ID: process.env.EXPO_PUBLIC_TRIP_PAGE_ID || '',
  get HOTEL() { return _hotelCoords; },
  get HOTEL_COORDS() { return _hotelCoords; },
  GOOGLE_WEB_CLIENT_ID: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '',
  TRIP_BUDGET_KEY: 'tripBudget_v1',
} as const;

/** Call when the active trip changes to update distance calculations */
export function setHotelCoords(lat: number, lng: number) {
  _hotelCoords.lat = lat;
  _hotelCoords.lng = lng;
}

export const verifyConfig = (): boolean => {
  const missing: string[] = [];
  if (!CONFIG.GOOGLE_MAPS_KEY) missing.push('GOOGLE_PLACES_KEY');
  if (!CONFIG.SUPABASE_URL) missing.push('SUPABASE_URL');
  if (!CONFIG.WEATHER_KEY) console.warn('[CONFIG] Optional: WEATHER_API_KEY not set');
  if (missing.length) {
    console.error('[CONFIG] Missing env vars:', missing.join(', '));
    console.error('[CONFIG] Make sure they start with EXPO_PUBLIC_ in .env');
  }
  return missing.length === 0;
};
