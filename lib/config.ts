export const CONFIG = {
  GOOGLE_MAPS_KEY: process.env.EXPO_PUBLIC_GOOGLE_PLACES_KEY || '',
  NOTION_KEY: process.env.EXPO_PUBLIC_NOTION_API_KEY || '',
  WEATHER_KEY: process.env.EXPO_PUBLIC_WEATHER_API_KEY || '',
  ANTHROPIC_KEY: process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY || '',
  TRIP_PAGE_ID: process.env.EXPO_PUBLIC_TRIP_PAGE_ID || '344e56a9-1cd3-8123-aa32-da48cfbfb7c1',
  HOTEL: { lat: 11.9710, lng: 121.9215 },
  HOTEL_COORDS: { lat: 11.9710, lng: 121.9215 },
  TRIP_BUDGET_KEY: 'tripBudget_v1',
  NOTION_DBS: {
    TRIP: '9be3ad05-4004-465b-9228-b8b825fb334d',
    PACKING: '8daea2c2-8222-45bc-8f0f-f7dc2f1033fa',
    EXPENSES: '9bcc75b2-71aa-4a86-bdf6-56e1f086a7dc',
    FLIGHTS: 'e11dc77d-90df-41a7-a748-70866d0ea576',
    PLACES: '5e57045c-7a9d-4015-b3f6-b636908b031a',
    GROUP: '5b6e2179-a155-48f2-ba36-cd4c0c01779f',
    CHECKLIST: '331563e8-057d-45e5-8c9c-6aabb2bad2ab',
    MOMENTS: 'ba5fbab9-f32e-4336-ba1d-c307627169eb',
    FILES: '6f680533-2b9b-434a-bd32-4b2edd63e766',
  },
} as const;

export const verifyConfig = (): boolean => {
  const missing: string[] = [];
  if (!CONFIG.GOOGLE_MAPS_KEY) missing.push('GOOGLE_PLACES_KEY');
  if (!CONFIG.NOTION_KEY) missing.push('NOTION_API_KEY');
  if (!CONFIG.WEATHER_KEY) missing.push('WEATHER_API_KEY');
  if (missing.length) {
    console.error('[CONFIG] Missing env vars:', missing.join(', '));
    console.error('[CONFIG] Make sure they start with EXPO_PUBLIC_ in .env');
  }
  return missing.length === 0;
};
