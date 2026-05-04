import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import * as Updates from 'expo-updates';

const FOREGROUND_CHECK_COOLDOWN_MS = 10 * 60 * 1000;

/**
 * Checks for EAS Updates when returning to the foreground and downloads if
 * available. The update is applied on the next real app restart so returning
 * from the app switcher does not unexpectedly reset navigation or in-memory UI.
 *
 * Expo's native ON_LOAD check already handles startup. Keeping this hook to
 * foreground checks avoids double network checks during cold launch.
 */
export function useAppUpdates() {
  const appStateRef = useRef(AppState.currentState);
  const inFlightRef = useRef(false);
  const lastCheckAtRef = useRef(0);

  useEffect(() => {
    // Skip in dev / Expo Go
    if (__DEV__ || !Updates.isEnabled) return;

    async function checkAndReload() {
      const now = Date.now();
      if (inFlightRef.current) return;
      if (now - lastCheckAtRef.current < FOREGROUND_CHECK_COOLDOWN_MS) {
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

        if (__DEV__) console.log('[Updates] update downloaded; will apply on next restart');
      } catch (err) {
        if (__DEV__) console.warn('[Updates] check/reload failed:', err);
      } finally {
        inFlightRef.current = false;
      }
    }

    // Check when app comes to foreground
    const sub = AppState.addEventListener('change', (nextState) => {
      const wasBackgrounded = appStateRef.current === 'inactive' || appStateRef.current === 'background';
      appStateRef.current = nextState;
      if (wasBackgrounded && nextState === 'active') checkAndReload();
    });

    return () => sub.remove();
  }, []);
}
