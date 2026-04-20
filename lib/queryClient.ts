import { QueryClient } from '@tanstack/react-query';

const FIVE_MINUTES_MS = 5 * 60 * 1000;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: FIVE_MINUTES_MS,
      gcTime: THIRTY_DAYS_MS,
      retry: 2,
      networkMode: 'offlineFirst',
    },
  },
});

// MMKV persister is available only in production builds (not Expo Go).
// Import `persister` from lib/cache/queryPersister.ts when wiring
// PersistQueryClientProvider after the APK includes react-native-mmkv.
