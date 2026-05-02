import { useState, useCallback, useRef } from 'react';
import type { Moment, FeedFilter, FeedPage } from '@/lib/types';
import {
  getPublicFeed,
  getTrendingFeed,
  getNearbyFeed,
  getFriendsFeed,
} from '@/lib/supabase';

interface UseFeedOptions {
  filter?: FeedFilter;
  location?: { lat: number; lng: number };
  radiusKm?: number;
  hoursBack?: number;
}

interface UseFeedResult {
  moments: Moment[];
  isLoading: boolean;
  isRefreshing: boolean;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  error: string | null;
}

export function useFeed(options: UseFeedOptions = {}): UseFeedResult {
  const { filter = 'recent', location, radiusKm = 50, hoursBack = 24 } = options;

  const [moments, setMoments] = useState<Moment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const offsetRef = useRef(0);
  const loadingRef = useRef(false);

  const fetchPage = useCallback(
    async (offset: number): Promise<FeedPage> => {
      switch (filter) {
        case 'trending':
          return getTrendingFeed(offset, 20, hoursBack);
        case 'nearby':
          if (!location) return { moments: [], nextOffset: null };
          return getNearbyFeed(location.lat, location.lng, radiusKm, offset);
        case 'friends':
          return getFriendsFeed(offset);
        case 'recent':
        default:
          return getPublicFeed(offset);
      }
    },
    [filter, location?.lat, location?.lng, radiusKm, hoursBack],
  );

  const refresh = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setIsRefreshing(true);
    setError(null);

    try {
      const page = await fetchPage(0);
      setMoments(page.moments);
      offsetRef.current = page.nextOffset ?? 0;
      setHasMore(page.nextOffset !== null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load feed');
    } finally {
      setIsRefreshing(false);
      loadingRef.current = false;
    }
  }, [fetchPage]);

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMore) return;
    loadingRef.current = true;
    setIsLoading(true);

    try {
      const page = await fetchPage(offsetRef.current);
      setMoments(prev => [...prev, ...page.moments]);
      offsetRef.current = page.nextOffset ?? 0;
      setHasMore(page.nextOffset !== null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load more');
    } finally {
      setIsLoading(false);
      loadingRef.current = false;
    }
  }, [fetchPage, hasMore]);

  return { moments, isLoading, isRefreshing, hasMore, loadMore, refresh, error };
}
