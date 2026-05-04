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
  const latitude = location?.lat;
  const longitude = location?.lng;

  const [moments, setMoments] = useState<Moment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const offsetRef = useRef(0);
  const loadingRef = useRef(false);
  const refreshingRef = useRef(false);
  const requestSeqRef = useRef(0);

  const fetchPage = useCallback(
    async (offset: number): Promise<FeedPage> => {
      switch (filter) {
        case 'trending':
          return getTrendingFeed(offset, 20, hoursBack);
        case 'nearby':
          if (latitude == null || longitude == null) return { moments: [], nextOffset: null };
          return getNearbyFeed(latitude, longitude, radiusKm, offset);
        case 'friends':
          return getFriendsFeed(offset);
        case 'recent':
        default:
          return getPublicFeed(offset);
      }
    },
    [filter, latitude, longitude, radiusKm, hoursBack],
  );

  const refresh = useCallback(async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    const requestSeq = requestSeqRef.current + 1;
    requestSeqRef.current = requestSeq;
    setIsRefreshing(true);
    setError(null);

    try {
      const page = await fetchPage(0);
      if (requestSeq !== requestSeqRef.current) return;
      setMoments(page.moments);
      offsetRef.current = page.nextOffset ?? 0;
      setHasMore(page.nextOffset !== null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load feed');
    } finally {
      setIsRefreshing(false);
      refreshingRef.current = false;
    }
  }, [fetchPage]);

  const loadMore = useCallback(async () => {
    if (loadingRef.current || refreshingRef.current || !hasMore) return;
    loadingRef.current = true;
    const requestSeq = requestSeqRef.current;
    setIsLoading(true);

    try {
      const page = await fetchPage(offsetRef.current);
      if (requestSeq !== requestSeqRef.current) return;
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
