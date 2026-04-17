import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Filters, DEFAULT_FILTERS } from '../lib/filters';

const KEY = '@afterstay:filters';

export const useFilters = () => {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY).then(v => {
      if (v) {
        try { setFilters(JSON.parse(v)); } catch {}
      }
      setLoaded(true);
    });
  }, []);

  const updateFilters = useCallback((next: Partial<Filters>) => {
    setFilters(curr => {
      const merged = { ...curr, ...next };
      AsyncStorage.setItem(KEY, JSON.stringify(merged));
      return merged;
    });
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    AsyncStorage.setItem(KEY, JSON.stringify(DEFAULT_FILTERS));
  }, []);

  return { filters, updateFilters, resetFilters, loaded };
};
