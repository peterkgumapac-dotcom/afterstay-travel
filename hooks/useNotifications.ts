import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, any>;
  read: boolean;
  createdAt: string;
}

/**
 * Fetches notifications from Supabase, provides mark-read and unread count.
 * All operations wrapped in try/catch — never crashes the app.
 */
export function useNotifications(enabled = true) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const userIdRef = useRef<string | undefined>(user?.id);
  const fetchSeq = useRef(0);

  useEffect(() => {
    userIdRef.current = user?.id;
    fetchSeq.current += 1;
  }, [user?.id]);

  const fetchNotifs = useCallback(async () => {
    const seq = ++fetchSeq.current;
    if (!enabled || !user?.id) {
      setNotifications([]);
      setLoading(false);
      return;
    }
    const requestUserId = user.id;
    const isCurrentRequest = () => fetchSeq.current === seq && userIdRef.current === requestUserId;
    try {
      setLoading(true);
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', requestUserId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (!isCurrentRequest()) return;
      if (data) {
        setNotifications(
          data.map((n: any) => ({
            id: n.id,
            type: n.type,
            title: n.title,
            body: n.body,
            data: n.data ?? {},
            read: n.read,
            createdAt: n.created_at,
          })),
        );
      }
    } catch (err) {
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.warn('[useNotifications] fetch failed:', err);
      }
    } finally {
      if (isCurrentRequest()) setLoading(false);
    }
  }, [enabled, user?.id]);

  useEffect(() => { fetchNotifs(); }, [fetchNotifs]);

  useEffect(() => {
    if (!enabled || !user?.id) {
      fetchSeq.current += 1;
      setNotifications([]);
      setLoading(false);
    }
  }, [enabled, user?.id]);

  // Realtime subscription — wrapped in try/catch
  useEffect(() => {
    if (!enabled || !user?.id) return;

    let channel: any;
    const channelName = `notifs-rt-${user.id}`;
    try {
      channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`,
          },
          (payload: any) => {
            const n = payload.new;
            setNotifications((prev) => [
              {
                id: n.id,
                type: n.type,
                title: n.title,
                body: n.body,
                data: n.data ?? {},
                read: false,
                createdAt: n.created_at,
              },
              ...prev,
            ]);
          },
        )
        .subscribe();
    } catch {
      // Realtime not available — fall back to polling on refresh
    }

    return () => {
      if (channel) supabase.removeChannel(channel).catch(() => {});
    };
  }, [enabled, user?.id]);

  const markRead = useCallback(async (id: string) => {
    if (!user?.id) return;
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );
    try {
      await supabase.from('notifications').update({ read: true }).eq('id', id).eq('user_id', user.id);
    } catch { /* ignore */ }
  }, [user?.id]);

  const markAllRead = useCallback(async () => {
    if (!user?.id) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      await supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false);
    } catch { /* ignore */ }
  }, [user?.id]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return { notifications, unreadCount, loading, refresh: fetchNotifs, markRead, markAllRead };
}
