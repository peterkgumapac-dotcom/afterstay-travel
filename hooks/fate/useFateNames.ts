import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

import { getActiveTrip, getGroupMembers } from '@/lib/supabase';

const STORAGE_KEY = 'fate_names';
const FALLBACK_NAMES = ['Traveler 1', 'Traveler 2'];

export function useFateNames() {
  const [names, setNamesState] = useState<string[]>(FALLBACK_NAMES);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      // Try saved names first
      const raw = await AsyncStorage.getItem(STORAGE_KEY).catch(() => null);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length >= 2) {
            setNamesState(parsed);
            setLoaded(true);
            return;
          }
        } catch { /* ignore corrupt data */ }
      }

      // No saved names — pull from trip members
      try {
        const trip = await getActiveTrip();
        if (trip) {
          const members = await getGroupMembers(trip.id);
          if (members.length >= 2) {
            const memberNames = members.map((m) => m.name.split(' ')[0]);
            setNamesState(memberNames);
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(memberNames));
          }
        }
      } catch { /* fall back to defaults */ }

      setLoaded(true);
    })();
  }, []);

  const setNames = useCallback((next: string[]) => {
    setNamesState(next);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  return { names, setNames, loaded };
}
