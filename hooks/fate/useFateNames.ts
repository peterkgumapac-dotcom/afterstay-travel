import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'fate_names';
const DEFAULT_NAMES = ['Peter', 'Anya', 'Marco', 'Jess'];

export function useFateNames() {
  const [names, setNamesState] = useState<string[]>(DEFAULT_NAMES);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length >= 2) {
            setNamesState(parsed);
          }
        } catch {
          // ignore corrupt data, keep defaults
        }
      }
      setLoaded(true);
    });
  }, []);

  const setNames = useCallback((next: string[]) => {
    setNamesState(next);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  return { names, setNames, loaded };
}
