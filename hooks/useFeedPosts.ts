import { useState, useCallback, useEffect, useRef } from 'react';
import type { FeedPost } from '@/lib/types';
import {
  getFeedPosts,
  getTrendingPosts,
  getCompanionPosts,
} from '@/lib/supabase';

type FeedMode = 'recent' | 'trending' | 'companions';
const REQUEST_TIMEOUT_MS = 12000;

function withTimeout<T>(promise: Promise<T>, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), REQUEST_TIMEOUT_MS);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      }, (error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

function mergePosts(existing: FeedPost[], next: FeedPost[]): FeedPost[] {
  const seen = new Set(existing.map((post) => post.id));
  const merged = [...existing];
  for (const post of next) {
    if (!seen.has(post.id)) {
      seen.add(post.id);
      merged.push(post);
    }
  }
  return merged;
}

interface UseFeedPostsResult {
  posts: FeedPost[];
  isLoading: boolean;
  isRefreshing: boolean;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  addLocal: (post: FeedPost) => void;
  error: string | null;
}

export function useFeedPosts(mode: FeedMode = 'recent'): UseFeedPostsResult {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const offsetRef = useRef(0);
  const loadingRef = useRef(false);
  const loadedOnceRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const fetchPage = useCallback(
    async (offset: number) => {
      switch (mode) {
        case 'trending':
          return withTimeout(getTrendingPosts(offset), 'Feed is taking too long to load. Pull to retry.');
        case 'companions':
          return withTimeout(getCompanionPosts(offset), 'Companion posts are taking too long to load. Pull to retry.');
        case 'recent':
        default:
          return withTimeout(getFeedPosts(offset), 'Feed is taking too long to load. Pull to retry.');
      }
    },
    [mode],
  );

  const refresh = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    const firstLoad = !loadedOnceRef.current;
    if (firstLoad) {
      setIsLoading(true);
    } else {
      setIsRefreshing(true);
    }
    setError(null);
    try {
      const page = await fetchPage(0);
      if (!mountedRef.current) return;
      setPosts(page.posts);
      offsetRef.current = page.nextOffset ?? 0;
      setHasMore(page.nextOffset !== null);
      loadedOnceRef.current = true;
    } catch (e: unknown) {
      if (mountedRef.current) {
        setError(e instanceof Error ? e.message : 'Failed to load feed');
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
      loadingRef.current = false;
    }
  }, [fetchPage]);

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMore) return;
    loadingRef.current = true;
    setIsLoading(true);
    setError(null);
    try {
      const page = await fetchPage(offsetRef.current);
      if (!mountedRef.current) return;
      setPosts((prev) => mergePosts(prev, page.posts));
      offsetRef.current = page.nextOffset ?? 0;
      setHasMore(page.nextOffset !== null);
    } catch (e: unknown) {
      if (mountedRef.current) {
        setError(e instanceof Error ? e.message : 'Failed to load more');
      }
    } finally {
      if (mountedRef.current) setIsLoading(false);
      loadingRef.current = false;
    }
  }, [fetchPage, hasMore]);

  const addLocal = useCallback((post: FeedPost) => {
    setPosts((prev) => [post, ...prev]);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { posts, isLoading, isRefreshing, hasMore, loadMore, refresh, addLocal, error };
}
