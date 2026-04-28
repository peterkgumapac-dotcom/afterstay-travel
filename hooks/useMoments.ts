import {
  useInfiniteQuery,
  useQuery,
  useMutation,
  useQueryClient,
  type UseInfiniteQueryResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { getMoments, getGroupMembers } from '@/lib/supabase';
import type { Moment, GroupMember } from '@/lib/types';

/* ------------------------------------------------------------------ */
// Query keys
/* ------------------------------------------------------------------ */

export const momentKeys = {
  all: ['moments'] as const,
  trip: (tripId: string) => [...momentKeys.all, 'trip', tripId] as const,
  paginated: (tripId: string) => [...momentKeys.all, 'trip', tripId, 'paginated'] as const,
  detail: (id: string) => [...momentKeys.all, 'detail', id] as const,
};

const memberKeys = {
  all: ['members'] as const,
  trip: (tripId: string) => [...memberKeys.all, tripId] as const,
};

/* ------------------------------------------------------------------ */
// Cache-first helpers (used by MomentsTab.tsx)
/* ------------------------------------------------------------------ */

export function getMomentsCached(tripId: string): Moment[] | undefined {
  return queryClient.getQueryData<Moment[]>(momentKeys.trip(tripId));
}

export async function getMomentsPromise(tripId: string, force = false): Promise<Moment[]> {
  return queryClient.fetchQuery({
    queryKey: momentKeys.trip(tripId),
    queryFn: () => getMoments(tripId),
    staleTime: force ? 0 : 1000 * 60 * 3,
  });
}

export function getGroupMembersCached(tripId: string): GroupMember[] | undefined {
  return queryClient.getQueryData<GroupMember[]>(memberKeys.trip(tripId));
}

export async function getGroupMembersPromise(tripId: string, force = false): Promise<GroupMember[]> {
  return queryClient.fetchQuery({
    queryKey: memberKeys.trip(tripId),
    queryFn: () => getGroupMembers(tripId),
    staleTime: force ? 0 : 1000 * 60 * 3,
  });
}

/* ------------------------------------------------------------------ */
// Hooks
/* ------------------------------------------------------------------ */

const PAGE_SIZE = 21; // 3-column grid, 7 rows per page

/** Fetch all moments for a trip (cached, SWR). */
export function useTripMoments(tripId?: string): UseQueryResult<Moment[], Error> {
  return useQuery({
    queryKey: momentKeys.trip(tripId ?? ''),
    queryFn: () => getMoments(tripId),
    enabled: !!tripId,
    staleTime: 1000 * 60 * 3, // 3 minutes
  });
}

/** Infinite scroll moments for a trip (grid-friendly pagination). */
export function useInfiniteMoments(tripId?: string): UseInfiniteQueryResult<Moment[], Error> {
  return useInfiniteQuery({
    queryKey: momentKeys.paginated(tripId ?? ''),
    queryFn: async ({ pageParam = 0 }) => {
      const all = await getMoments(tripId);
      const start = pageParam * PAGE_SIZE;
      const end = start + PAGE_SIZE;
      return all.slice(start, end);
    },
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.length < PAGE_SIZE) return undefined;
      return allPages.length;
    },
    initialPageParam: 0,
    enabled: !!tripId,
    staleTime: 1000 * 60 * 3,
  });
}

/** Optimistic favorite toggle for moments. */
export function useFavoriteMoment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ momentId, favorite }: { momentId: string; favorite: boolean }) => {
      // Placeholder — wire to actual API when available
      return { momentId, favorite };
    },
    onMutate: async ({ momentId, favorite }) => {
      await queryClient.cancelQueries({ queryKey: momentKeys.all });

      const previousData = queryClient.getQueryData<Moment[]>(momentKeys.all);

      queryClient.setQueriesData<Moment[]>({ queryKey: momentKeys.all }, (old) => {
        if (!old) return old;
        return old.map((m) =>
          m.id === momentId ? { ...m, isFavorited: favorite } : m,
        );
      });

      return { previousData };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousData) {
        queryClient.setQueriesData({ queryKey: momentKeys.all }, context.previousData);
      }
    },
    onSettled: (_data, _error, vars) => {
      queryClient.invalidateQueries({ queryKey: momentKeys.trip(vars.momentId) });
    },
  });
}

/** Prefetch moments for instant photo grid open. */
export function usePrefetchMoments() {
  const queryClient = useQueryClient();

  return (tripId: string) => {
    queryClient.prefetchQuery({
      queryKey: momentKeys.trip(tripId),
      queryFn: () => getMoments(tripId),
      staleTime: 1000 * 60 * 3,
    });
  };
}
