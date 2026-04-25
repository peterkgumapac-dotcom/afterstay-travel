import { useCallback, useEffect, useState } from 'react';
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
export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchNotifs = useCallback(async () => {
    if (!user?.id) return;
    try {
      setLoading(true);
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

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
    } catch {
      // Table might not exist yet or RLS issue — silently ignore
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { fetchNotifs(); }, [fetchNotifs]);

  // Realtime subscription — wrapped in try/catch
  useEffect(() => {
    if (!user?.id) return;

    let channel: any;
    try {
      channel = supabase
        .channel('notifs-rt')
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
  }, [user?.id]);

  const markRead = useCallback(async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );
    try {
      await supabase.from('notifications').update({ read: true }).eq('id', id);
    } catch { /* ignore */ }
  }, []);

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
