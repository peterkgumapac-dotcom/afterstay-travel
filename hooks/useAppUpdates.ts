import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import * as Updates from 'expo-updates';

const FOREGROUND_CHECK_COOLDOWN_MS = 10 * 60 * 1000;

/**
 * Checks for EAS Updates on app launch and foreground,
 * downloads if available, and reloads with a branded splash screen.
 *
 * Skipped in development / Expo Go.
 */
export function useAppUpdates() {
  const appStateRef = useRef(AppState.currentState);
  const inFlightRef = useRef(false);
  const lastCheckAtRef = useRef(0);

  useEffect(() => {
    // Skip in dev / Expo Go
    if (__DEV__ || !Updates.isEnabled) return;

    async function checkAndReload(reason: 'launch' | 'foreground') {
      const now = Date.now();
      if (inFlightRef.current) return;
      if (reason === 'foreground' && now - lastCheckAtRef.current < FOREGROUND_CHECK_COOLDOWN_MS) {
        return;
      }

      inFlightRef.current = true;
      lastCheckAtRef.current = now;

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
      } finally {
        inFlightRef.current = false;
      }
    }

    // Check on mount
    checkAndReload('launch');

    // Check when app comes to foreground
    const sub = AppState.addEventListener('change', (nextState) => {
      const wasBackgrounded = appStateRef.current === 'inactive' || appStateRef.current === 'background';
      appStateRef.current = nextState;
      if (wasBackgrounded && nextState === 'active') checkAndReload('foreground');
    });

    return () => sub.remove();
  }, []);
}
