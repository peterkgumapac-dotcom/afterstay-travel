import { useEffect } from 'react';
import { AppState } from 'react-native';
import * as Updates from 'expo-updates';

/**
 * Checks for EAS Updates on app launch and foreground,
 * downloads if available, and reloads with a branded splash screen.
 *
 * Skipped in development / Expo Go.
 */
export function useAppUpdates() {
  useEffect(() => {
    // Skip in dev / Expo Go
    if (__DEV__ || !Updates.isEnabled) return;

    async function checkAndReload() {
      try {
        const check = await Updates.checkForUpdateAsync();
        if (!check.isAvailable) return;

        // Download the update
        const fetch = await Updates.fetchUpdateAsync();
        if (!fetch.isNew) return;

        // Reload with branded transition
        await Updates.reloadAsync({
          reloadScreenOptions: {
            backgroundColor: '#0A0A0A',
            image: require('@/assets/images/splash-icon.png'),
            imageResizeMode: 'contain',
            fade: true,
            spinner: {
              enabled: true,
              color: '#d8ab7a',
              size: 'small',
            },
          },
        });
      } catch (err) {
        if (__DEV__) console.warn('[Updates] check/reload failed:', err);
      }
    }

    // Check on mount
    checkAndReload();

    // Check when app comes to foreground
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') checkAndReload();
    });

    return () => sub.remove();
  }, []);
}
