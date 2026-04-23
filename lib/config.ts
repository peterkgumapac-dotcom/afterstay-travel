export const CONFIG = {
  GOOGLE_MAPS_KEY: process.env.EXPO_PUBLIC_GOOGLE_PLACES_KEY || '',
  SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL || '',
  SUPABASE_KEY: process.env.EXPO_PUBLIC_SUPABASE_KEY || '',
  WEATHER_KEY: process.env.EXPO_PUBLIC_WEATHER_API_KEY || '',
  ANTHROPIC_KEY: process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY || '',
  TRIP_PAGE_ID: process.env.EXPO_PUBLIC_TRIP_PAGE_ID || '',
  HOTEL: { lat: 11.9710, lng: 121.9215 },
  HOTEL_COORDS: { lat: 11.9710, lng: 121.9215 },
  GOOGLE_WEB_CLIENT_ID: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '',
  TRIP_BUDGET_KEY: 'tripBudget_v1',
} as const;

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
