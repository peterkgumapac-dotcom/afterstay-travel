import { useEffect } from 'react';
import { registerBackgroundTasks } from '@/lib/backgroundTasks';
import { useAuth } from '@/lib/auth';

/**
 * Registers background tasks when the user is authenticated.
 * The task executor is defined at module level in lib/backgroundTasks.ts.
 */
export function useBackgroundTasks(enabled = true) {
  const { user } = useAuth();

  useEffect(() => {
    if (!enabled || !user?.id) return;
    registerBackgroundTasks();
  }, [enabled, user?.id]);
}
