import { useState, useEffect, useCallback } from 'react';
import { getTripInsight, TripInsight } from '../lib/tripInsights';

export const useTripInsight = () => {
  const [insight, setInsight] = useState<TripInsight | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const result = await getTripInsight(forceRefresh);
      setInsight(result);
    } catch (e: any) {
      setError(e.message || 'Failed to load insights');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(false); }, [load]);

  return { insight, loading, error, refresh: () => load(true) };
};
