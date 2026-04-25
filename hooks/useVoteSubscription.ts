import { useEffect } from 'react'
import { subscribeToPlaceVotes } from '@/lib/supabase'
import type { PlaceVote } from '@/lib/types'

/**
 * Subscribe to realtime vote changes on places for a trip.
 * Calls `onVoteUpdate` whenever another member votes.
 */
export function useVoteSubscription(
  tripId: string | null,
  onVoteUpdate: (
    placeId: string,
    voteByMember: Record<string, PlaceVote>,
    vote: PlaceVote,
  ) => void,
): void {
  useEffect(() => {
    if (!tripId) return

    const unsubscribe = subscribeToPlaceVotes(tripId, onVoteUpdate)
    return unsubscribe
  }, [tripId, onVoteUpdate])
}
