import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/lib/auth';
import {
  deriveUserStatus,
  refreshUserStatus,
  type UserStatus,
} from '@/lib/userStatus';
import type { Trip } from '@/lib/types';

export function useUserStatus() {
  const { user } = useAuth();
  const [status, setStatus] = useState<UserStatus>('new');
  const [activeTrip, setActiveTrip] = useState<Trip | null>(null);
  const [completedTrips, setCompletedTrips] = useState<Trip[]>([]);
  const [planningTrips, setPlanningTrips] = useState<Trip[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadStatus = useCallback(async () => {
    if (!user?.id) {
      setStatus('new');
      setActiveTrip(null);
      setCompletedTrips([]);
      setPlanningTrips([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    try {
      const result = await deriveUserStatus(user.id);
      setStatus(result.status);
      setActiveTrip(result.activeTrip);
      setCompletedTrips(result.completedTrips);
      setPlanningTrips(result.planningTrips);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  // Load on mount and when auth changes
  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  /** Manual refresh — e.g. after creating or completing a trip. */
  const refresh = useCallback(async () => {
    if (!user?.id) return;
    setIsLoading(true);
    try {
      const result = await refreshUserStatus(user.id);
      setStatus(result.status);
      setActiveTrip(result.activeTrip);
      setCompletedTrips(result.completedTrips);
      setPlanningTrips(result.planningTrips);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  return {
    status,
    activeTrip,
    completedTrips,
    planningTrips,
    isLoading,
    error,
    refresh,
    isNew: status === 'new',
    isPlanning: status === 'planning',
    isActive: status === 'active',
    isReturning: status === 'returning' || status === 'completed',
  };
}
