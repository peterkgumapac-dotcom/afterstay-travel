import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import {
  AlertTriangle,
  Bell,
  Car,
  CheckCircle,
  Clock,
  DollarSign,
  MapPin,
  Plane,
  TrendingUp,
  UserPlus,
  Users,
  X,
} from 'lucide-react-native';
import { useTheme } from '@/constants/ThemeContext';
import { formatCurrency } from '@/lib/utils';
import { useNotifications, type AppNotification } from '@/hooks/useNotifications';
import { shouldNotify, getLocalNotificationPrefs } from '@/lib/notificationPrefs';
import type { NotificationPrefs } from '@/lib/notificationPrefs';
import type { Place, GroupMember } from '@/lib/types';

type ThemeColors = ReturnType<typeof useTheme>['colors'];

// ── Computed (local) notification type ────────────────────────────────

interface LocalNotification {
  id: string;
  icon: React.ComponentType<any>;
  iconColor: string;
  iconBg: string;
  title: string;
  body: string;
  category: string;
  action?: string;
  priority: 'high' | 'medium' | 'low';
  source: 'local';
}

interface DBNotification {
  id: string;
  icon: React.ComponentType<any>;
  iconColor: string;
  iconBg: string;
  title: string;
  body: string;
  category: string;
  action?: string;
  priority: 'medium';
  source: 'db';
  read: boolean;
  createdAt: string;
}

type MergedNotification = LocalNotification | DBNotification;

// ── Props ─────────────────────────────────────────────────────────────

interface NotificationsSheetProps {
  visible: boolean;
  onClose: () => void;
  dayOfTrip: number;
  totalDays: number;
  daysLeft: number;
  spent: number;
  budget: number;
  savedPlaces: Place[];
  members: GroupMember[];
  destination: string;
  /** Called when user taps a group-votes or vote_needed notification */
  onGroupVoteTap?: () => void;
  /** Shared notification state from parent — avoids duplicate useNotifications() */
  dbNotifications?: AppNotification[];
  onMarkRead?: (id: string) => void;
  onMarkAllRead?: () => void;
}

// ── Local alerts engine ───────────────────────────────────────────────

function generateLocalAlerts(
  props: Omit<NotificationsSheetProps, 'visible' | 'onClose'>,
  colors: ThemeColors,
): LocalNotification[] {
  const { dayOfTrip, totalDays, daysLeft, spent, budget, savedPlaces, members, destination } = props;
  const items: LocalNotification[] = [];

  if (budget > 0 && dayOfTrip > 1 && daysLeft > 0) {
    const projected = (spent / dayOfTrip) * totalDays;
    const diff = projected - budget;
    if (diff > 0) {
      items.push({
        id: 'budget-over', icon: TrendingUp, iconColor: colors.danger,
        iconBg: colors.accentDim, title: 'Budget alert',
        body: `Projected ₱${Math.round(projected).toLocaleString()} by Day ${totalDays} — ₱${Math.round(diff).toLocaleString()} over.`,
        category: 'budget', action: '/(tabs)/budget', priority: 'high', source: 'local',
      });
    }
  }

  if (budget > 0 && dayOfTrip > 0) {
    const dailyBudget = budget / totalDays;
    const avgDaily = spent / dayOfTrip;
    if (avgDaily > dailyBudget * 1.5) {
      items.push({
        id: 'budget-spike', icon: DollarSign, iconColor: colors.warn,
        iconBg: colors.accentDim, title: 'Spending spike',
        body: `Averaging ₱${Math.round(avgDaily).toLocaleString()}/day — ${Math.round((avgDaily / dailyBudget - 1) * 100)}% above target.`,
        category: 'budget', action: '/(tabs)/budget', priority: 'medium', source: 'local',
      });
    }
  }

  const pending = savedPlaces.filter((p) => p.saved && p.vote !== '👎 No');
  if (pending.length > 0 && daysLeft > 0) {
    items.push({
      id: 'places-visit', icon: MapPin, iconColor: colors.accent,
      iconBg: colors.accentBg, title: `${pending.length} places to visit`,
      body: `${Math.ceil(pending.length / daysLeft)}/day for the remaining ${daysLeft} day${daysLeft !== 1 ? 's' : ''}.`,
      category: 'places', action: '/(tabs)/discover', priority: 'low', source: 'local',
    });
  }

  const needVotes = savedPlaces.filter((p) => {
    if (p.vote !== 'Pending') return false;
    return Object.keys(p.voteByMember ?? {}).length < members.length;
  });
  if (needVotes.length > 0 && members.length >= 2) {
    items.push({
      id: 'group-votes', icon: Users, iconColor: colors.chart2,
      iconBg: colors.accentDim, title: 'Votes needed',
      body: `${needVotes.length} place${needVotes.length !== 1 ? 's' : ''} waiting for group votes.`,
      category: 'group', action: '/(tabs)/discover', priority: 'medium', source: 'local',
    });
  }

  if (daysLeft === 0) {
    items.push({
      id: 'last-day', icon: Clock, iconColor: colors.warn,
      iconBg: colors.accentDim, title: 'Last day!',
      body: `Make the most of ${destination} before checkout.`,
      category: 'trip', priority: 'high', source: 'local',
    });
  }

  if (daysLeft === 1) {
    items.push({
      id: 'ending-soon', icon: AlertTriangle, iconColor: colors.warn,
      iconBg: colors.accentDim, title: 'Trip ending tomorrow',
      body: 'Check your packing list before your last night.',
      category: 'trip', action: '/(tabs)/trip', priority: 'medium', source: 'local',
    });
  }

  return items;
}

/** Filter local alerts through user's notification preferences. */
function filterLocalAlertsByPrefs(
  alerts: LocalNotification[],
  prefs: Partial<NotificationPrefs>,
): LocalNotification[] {
  return alerts.filter((a) => shouldNotify(a.id, prefs));
}

// ── Icon + color mapping for DB notifications ───────────────────────

interface NotifStyle {
  icon: React.ComponentType<any>;
  colorKey: 'accent' | 'danger' | 'warn' | 'coral' | 'gold' | 'text2';
}

const NOTIF_STYLES: Record<string, NotifStyle> = {
  expense_added:      { icon: DollarSign,  colorKey: 'accent' },
  budget_threshold:   { icon: TrendingUp,  colorKey: 'danger' },
  member_joined:      { icon: UserPlus,    colorKey: 'accent' },
  check_in_reminder:  { icon: Clock,       colorKey: 'gold' },
  check_out_reminder: { icon: Clock,       colorKey: 'warn' },
  vote_needed:        { icon: Users,       colorKey: 'coral' },
  moments_added:      { icon: Bell,        colorKey: 'accent' },
  flight_boarding:    { icon: Plane,       colorKey: 'warn' },
  departure_prep:     { icon: Car,         colorKey: 'warn' },
  trip_starting:      { icon: MapPin,      colorKey: 'accent' },
  last_day:           { icon: MapPin,      colorKey: 'coral' },
  trip_recap_ready:   { icon: CheckCircle, colorKey: 'accent' },
};

function getNotifStyle(type: string): NotifStyle {
  return NOTIF_STYLES[type] ?? { icon: Bell, colorKey: 'text2' };
}

// ── Dismissed local alerts (persisted to AsyncStorage) ──────────────

const DISMISSED_KEY = 'notif_dismissed_local';

// Module-level cache — hydrated from AsyncStorage on first use
let dismissedLocalIds = new Set<string>();
let dismissHydrated = false;
let dismissListeners: Array<() => void> = [];

async function hydrateDismissed() {
  if (dismissHydrated) return;
  try {
    const raw = await AsyncStorage.getItem(DISMISSED_KEY);
    if (raw) dismissedLocalIds = new Set(JSON.parse(raw));
  } catch { /* ignore */ }
  dismissHydrated = true;
}

function dismissLocal(id: string) {
  dismissedLocalIds.add(id);
  dismissListeners.forEach((fn) => fn());
  AsyncStorage.setItem(DISMISSED_KEY, JSON.stringify([...dismissedLocalIds])).catch(() => {});
}

function clearDismissed() {
  dismissedLocalIds = new Set();
  dismissListeners.forEach((fn) => fn());
  AsyncStorage.removeItem(DISMISSED_KEY).catch(() => {});
}

function useDismissedCount(): number {
  const [, forceUpdate] = useState(0);
  const listener = useCallback(() => forceUpdate((n) => n + 1), []);

  // Hydrate on first mount
  useEffect(() => {
    hydrateDismissed().then(() => forceUpdate((n) => n + 1));
  }, []);

  // Register/unregister listener
  useState(() => {
    dismissListeners.push(listener);
    return () => { dismissListeners = dismissListeners.filter((fn) => fn !== listener); };
  });

  return dismissedLocalIds.size;
}

// ── Exported count hook ───────────────────────────────────────────────

export function useNotificationCount(
  props: Omit<NotificationsSheetProps, 'visible' | 'onClose'>,
  /** Pass dbUnread from the shared useNotifications() in the parent to avoid a second instance */
  dbUnread?: number,
): number {
  const { colors } = useTheme();
  // Only call useNotifications() as fallback if parent doesn't provide dbUnread
  const fallback = useNotifications();
  const resolvedDbUnread = dbUnread ?? fallback.unreadCount;
  const dismissed = useDismissedCount();
  const [prefs, setPrefs] = useState<Partial<NotificationPrefs>>({});

  // Load prefs once
  useState(() => {
    getLocalNotificationPrefs().then(setPrefs).catch(() => {});
  });

  const localAlerts = useMemo(
    () => filterLocalAlertsByPrefs(generateLocalAlerts(props, colors), prefs),
    [props.dayOfTrip, props.totalDays, props.daysLeft, props.spent, props.budget, props.savedPlaces, props.members, props.destination, colors, prefs],
  );
  const localCount = localAlerts.filter((a) => !dismissedLocalIds.has(a.id)).length;
  return localCount + resolvedDbUnread;
}

// ── Main Sheet ────────────────────────────────────────────────────────

export default function NotificationsSheet({
  visible,
  onClose,
  onGroupVoteTap,
  dbNotifications: sharedNotifs,
  onMarkRead: sharedMarkRead,
  onMarkAllRead: sharedMarkAllRead,
  ...dataProps
}: NotificationsSheetProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const router = useRouter();
  // Use shared state from parent when available; fall back to own instance otherwise
  const fallback = useNotifications();
  const dbNotifs = sharedNotifs ?? fallback.notifications;
  const markRead = sharedMarkRead ?? fallback.markRead;
  const markAllRead = sharedMarkAllRead ?? fallback.markAllRead;

  const [prefs, setPrefs] = useState<Partial<NotificationPrefs>>({});
  useState(() => {
    getLocalNotificationPrefs().then(setPrefs).catch(() => {});
  });

  const localAlerts = useMemo(
    () => filterLocalAlertsByPrefs(generateLocalAlerts(dataProps, colors), prefs),
    [dataProps.dayOfTrip, dataProps.totalDays, dataProps.daysLeft, dataProps.spent, dataProps.budget, dataProps.savedPlaces, dataProps.members, dataProps.destination, colors, prefs],
  );

  // Convert DB notifications to display format
  const dbItems: DBNotification[] = useMemo(
    () => dbNotifs.map((n) => {
      const ns = getNotifStyle(n.type);
      const iconColor = colors[ns.colorKey];
      return {
      id: n.id,
      icon: ns.icon,
      iconColor,
      iconBg: colors.accentDim,
      title: n.title,
      body: n.body,
      category: n.type.replace(/_/g, ' '),
      priority: 'medium' as const,
      source: 'db' as const,
      read: n.read,
      createdAt: n.createdAt,
    };
    }),
    [dbNotifs, colors],
  );

  // Merge: local alerts (exclude dismissed) first, then unread DB (newest first)
  const activeLocalAlerts = localAlerts.filter((a) => !dismissedLocalIds.has(a.id));
  const unreadDbItems = dbItems.filter((n) => !n.read);
  const all: MergedNotification[] = [...activeLocalAlerts, ...unreadDbItems];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.handleRow}><View style={styles.handle} /></View>

          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={styles.headerTitle}>Notifications</Text>
              {all.length > 0 && (
                <TouchableOpacity
                  onPress={() => {
                    markAllRead();
                    for (const a of activeLocalAlerts) dismissLocal(a.id);
                  }}
                  style={styles.markAllBtn}
                  activeOpacity={0.7}
                >
                  <CheckCircle size={14} color={colors.accent} strokeWidth={2} />
                  <Text style={styles.markAllRead}>Clear all</Text>
                </TouchableOpacity>
              )}
            </View>
            <Pressable onPress={onClose} hitSlop={12}>
              <X size={22} color={colors.text2} strokeWidth={2} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
            {/* DEV-ONLY: Test notification button — remove before release */}
            {__DEV__ && (
              <TouchableOpacity
                style={{ backgroundColor: colors.accent, padding: 12, borderRadius: 10, marginBottom: 12, alignItems: 'center' }}
                onPress={async () => {
                  try {
                    const { supabase } = await import('@/lib/supabase');
                    const { data: { user } } = await supabase.auth.getUser();
                    if (!user?.id) { Alert.alert('No auth user', 'Sign in first'); return; }
                    const { error } = await supabase.from('notifications').insert({
                      user_id: user.id,
                      type: 'trip_starting',
                      title: 'Test notification',
                      body: 'If you see this, notifications are working!',
                      data: { type: 'trip_starting' },
                      read: false,
                    });
                    if (error) Alert.alert('Insert failed', error.message);
                    else Alert.alert('Sent!', 'Check the bell badge and refresh.');
                  } catch (e: any) { Alert.alert('Error', e.message); }
                }}
              >
                <Text style={{ color: colors.ink, fontWeight: '700', fontSize: 13 }}>Send Test Notification</Text>
              </TouchableOpacity>
            )}
            {all.length === 0 ? (
              <View style={styles.emptyWrap}>
                <Bell size={32} color={colors.text3} strokeWidth={1.5} />
                <Text style={styles.emptyText}>You're all caught up</Text>
              </View>
            ) : (
              all.map((n) => {
                const Icon = n.icon;
                const isDB = n.source === 'db';
                const isUnread = isDB ? !(n as DBNotification).read : true;
                return (
                  <TouchableOpacity
                    key={n.id}
                    style={[styles.item, isUnread && styles.itemUnread]}
                    activeOpacity={n.action ? 0.7 : 1}
                    onPress={() => {
                      if (isDB) markRead(n.id);
                      if (!isDB) dismissLocal(n.id);
                      // Group vote items open the voting sheet instead of navigating
                      const isGroupVote = n.id === 'group-votes' || (isDB && (n as any).category?.includes('vote needed'));
                      if (isGroupVote && onGroupVoteTap) {
                        onClose();
                        onGroupVoteTap();
                      } else if (n.action) {
                        onClose();
                        router.push(n.action as any);
                      }
                    }}
                  >
                    <View style={[styles.iconWrap, { backgroundColor: n.iconBg }]}>
                      <Icon size={16} color={n.iconColor} strokeWidth={2} />
                    </View>
                    <View style={styles.itemContent}>
                      <View style={styles.itemHeader}>
                        <Text style={styles.itemTitle}>{n.title}</Text>
                        {n.priority === 'high' && <View style={styles.highDot} />}
                        {isUnread && <View style={styles.unreadDot} />}
                      </View>
                      <Text style={styles.itemBody}>{n.body}</Text>
                      <Text style={styles.itemCategory}>
                        {isDB ? timeAgo((n as DBNotification).createdAt) : n.category.toUpperCase()}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

const getStyles = (c: ThemeColors) =>
  StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
    sheet: { maxHeight: '80%', backgroundColor: c.canvas, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
    handleRow: { alignItems: 'center', paddingTop: 10, paddingBottom: 4 },
    handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: c.text3 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12 },
    headerLeft: { flex: 1, gap: 8 },
    headerTitle: { fontSize: 18, fontWeight: '700', color: c.text },
    markAllBtn: {
      flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6,
      paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10,
      backgroundColor: c.accentBg, borderWidth: 1, borderColor: c.accentBorder,
    },
    markAllRead: { fontSize: 12, fontWeight: '600', color: c.accent },
    listContent: { paddingHorizontal: 16, paddingBottom: 40, gap: 6 },
    emptyWrap: { paddingVertical: 50, alignItems: 'center', gap: 10 },
    emptyText: { color: c.text3, fontSize: 14 },
    item: {
      flexDirection: 'row', gap: 12, paddingVertical: 12, paddingHorizontal: 14,
      backgroundColor: c.card, borderRadius: 14, borderWidth: 1, borderColor: c.border,
    },
    itemUnread: { borderColor: c.accentBorder, backgroundColor: c.accentBg },
    iconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    itemContent: { flex: 1, gap: 3 },
    itemHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    itemTitle: { fontSize: 13, fontWeight: '700', color: c.text },
    highDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: c.danger },
    unreadDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: c.accent },
    itemBody: { fontSize: 12, color: c.text2, lineHeight: 17 },
    itemCategory: { fontSize: 9, fontWeight: '700', color: c.text3, letterSpacing: 1, marginTop: 2 },
  });
