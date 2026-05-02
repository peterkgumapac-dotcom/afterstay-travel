import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  Bell,
  BellOff,
  Calendar,
  Clock,
  CreditCard,
  Luggage,
  Moon,
  Plane,
  TrendingUp,
  Users,
} from 'lucide-react-native';

import { useTheme, ThemeColors } from '@/constants/ThemeContext';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { clearPrefsCache, getLocalNotificationPrefs, saveLocalNotificationPrefs } from '@/lib/notificationPrefs';

// ---------- TYPES ----------

interface NotificationPrefsState {
  departureReminders: boolean;
  budgetAlerts: boolean;
  packingReminders: boolean;
  groupActivity: boolean;
  expenseAlerts: boolean;
  tripLifecycle: boolean;
  checkInOut: boolean;
  preTripAlerts: boolean;
  activeTripAlerts: boolean;
  postTripAlerts: boolean;
  quietHours: { enabled: boolean; startHour: number; endHour: number };
  mutedTrips: string[];
}

const DEFAULTS: NotificationPrefsState = {
  departureReminders: true,
  budgetAlerts: true,
  packingReminders: true,
  groupActivity: true,
  expenseAlerts: true,
  tripLifecycle: true,
  checkInOut: true,
  preTripAlerts: true,
  activeTripAlerts: true,
  postTripAlerts: true,
  quietHours: { enabled: false, startHour: 22, endHour: 7 },
  mutedTrips: [],
};

// ---------- SCREEN ----------

export default function NotificationSettingsScreen() {
  const { colors } = useTheme();
  const s = useMemo(() => getStyles(colors), [colors]);
  const router = useRouter();
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<NotificationPrefsState>(DEFAULTS);
  const [pushStatus, setPushStatus] = useState<'loading' | 'enabled' | 'disabled'>('loading');
  const [sendingTest, setSendingTest] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadPrefs() {
      const localPrefs = await getLocalNotificationPrefs(user?.id).catch(() => ({}));
      if (!cancelled && Object.keys(localPrefs).length > 0) {
        setPrefs({ ...DEFAULTS, ...localPrefs });
      }

      if (!user?.id) {
        if (!cancelled) setPushStatus('disabled');
        return;
      }

      const { data } = await supabase
        .from('profiles')
        .select('fcm_token, expo_push_token, push_enabled, notification_prefs')
        .eq('id', user.id)
        .maybeSingle();

      if (cancelled) return;
      if (data?.notification_prefs && typeof data.notification_prefs === 'object') {
        const remotePrefs = { ...DEFAULTS, ...(data.notification_prefs as Partial<NotificationPrefsState>) };
        setPrefs(remotePrefs);
        await saveLocalNotificationPrefs(remotePrefs, user.id).catch(() => {});
      }
      setPushStatus((data?.fcm_token || data?.expo_push_token) && data?.push_enabled ? 'enabled' : 'disabled');
    }

    loadPrefs();
    return () => { cancelled = true; };
  }, [user?.id]);

  const save = useCallback(async (updated: NotificationPrefsState) => {
    setPrefs(updated);
    clearPrefsCache(user?.id);
    await saveLocalNotificationPrefs(updated, user?.id);
    if (user?.id) {
      await supabase.from('profiles').update({ notification_prefs: updated }).eq('id', user.id);
    }
  }, [user?.id]);

  const toggle = useCallback((key: keyof Omit<NotificationPrefsState, 'quietHours' | 'mutedTrips'>) => {
    save({ ...prefs, [key]: !prefs[key] });
  }, [prefs, save]);

  const toggleQuietHours = useCallback(() => {
    save({
      ...prefs,
      quietHours: { ...prefs.quietHours, enabled: !prefs.quietHours.enabled },
    });
  }, [prefs, save]);

  const sendTestPush = useCallback(async () => {
    if (!user?.id || sendingTest) return;
    setSendingTest(true);
    try {
      const record = {
        user_id: user.id,
        type: 'trip_starting',
        title: 'Test push',
        body: 'If this arrives, Firebase push delivery is working.',
        data: { type: 'trip_starting', source: 'notification_settings' },
        read: false,
      };
      const { data, error } = await supabase
        .from('notifications')
        .insert(record)
        .select('*')
        .single();
      if (error) throw new Error(`Notification insert failed: ${error.message}`);

      const { error: pushError } = await supabase.functions.invoke('send-push-notification', {
        body: { type: 'INSERT', record: data },
      });
      if (pushError) throw new Error(`Push function failed: ${pushError.message}`);

      Alert.alert('Test sent', 'If your device token is valid, the push should arrive shortly.');
    } catch (err) {
      Alert.alert('Test failed', err instanceof Error ? err.message : 'Unable to send test push.');
    } finally {
      setSendingTest(false);
    }
  }, [sendingTest, user?.id]);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <ArrowLeft size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Notifications</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* ── PUSH STATUS ── */}
        {pushStatus !== 'loading' && (
          <View style={[s.pushBanner, pushStatus === 'enabled' ? s.pushBannerOn : s.pushBannerOff]}>
            {pushStatus === 'enabled' ? (
              <Bell size={14} color={colors.success} />
            ) : (
              <BellOff size={14} color={colors.danger} />
            )}
            <Text style={[s.pushBannerText, { color: pushStatus === 'enabled' ? colors.success : colors.danger }]}>
              {pushStatus === 'enabled' ? 'Push notifications enabled' : 'Push notifications not registered'}
            </Text>
          </View>
        )}

        {user?.id && (
          <TouchableOpacity
            style={[s.testPushBtn, sendingTest && { opacity: 0.55 }]}
            onPress={sendTestPush}
            disabled={sendingTest}
            activeOpacity={0.75}
          >
            <Bell size={15} color={colors.bg} strokeWidth={2} />
            <Text style={s.testPushText}>{sendingTest ? 'Sending test...' : 'Send test push'}</Text>
          </TouchableOpacity>
        )}

        {/* ── TRIP PHASES ── */}
        <Text style={s.sectionLabel}>When to notify</Text>
        <View style={s.card}>
          <ToggleRow
            icon={<Plane size={16} color={colors.accent} />}
            label="Before trip"
            desc="Trip starting, flight boarding, departure prep"
            value={prefs.preTripAlerts}
            onToggle={() => toggle('preTripAlerts')}
            colors={colors}
          />
          <View style={s.divider} />
          <ToggleRow
            icon={<Calendar size={16} color={colors.accent} />}
            label="During trip"
            desc="Budget, expenses, group activity, check-in/out"
            value={prefs.activeTripAlerts}
            onToggle={() => toggle('activeTripAlerts')}
            colors={colors}
          />
          <View style={s.divider} />
          <ToggleRow
            icon={<Bell size={16} color={colors.accent} />}
            label="After trip"
            desc="Recaps, memory prompts, sharing nudges"
            value={prefs.postTripAlerts}
            onToggle={() => toggle('postTripAlerts')}
            colors={colors}
          />
        </View>

        {/* ── CATEGORIES ── */}
        <Text style={s.sectionLabel}>Categories</Text>
        <View style={s.card}>
          <ToggleRow
            icon={<Calendar size={16} color={colors.coral} />}
            label="Trip Lifecycle"
            desc="Trip starting, last day, daily recap"
            value={prefs.tripLifecycle}
            onToggle={() => toggle('tripLifecycle')}
            colors={colors}
          />
          <View style={s.divider} />
          <ToggleRow
            icon={<Plane size={16} color={colors.warn} />}
            label="Departure Reminders"
            desc="Flight boarding, departure prep"
            value={prefs.departureReminders}
            onToggle={() => toggle('departureReminders')}
            colors={colors}
          />
          <View style={s.divider} />
          <ToggleRow
            icon={<Clock size={16} color={colors.gold} />}
            label="Check-in / Check-out"
            desc="Accommodation reminders"
            value={prefs.checkInOut}
            onToggle={() => toggle('checkInOut')}
            colors={colors}
          />
          <View style={s.divider} />
          <ToggleRow
            icon={<TrendingUp size={16} color={colors.danger} />}
            label="Budget Alerts"
            desc="Spending pace, over-budget warnings"
            value={prefs.budgetAlerts}
            onToggle={() => toggle('budgetAlerts')}
            colors={colors}
          />
          <View style={s.divider} />
          <ToggleRow
            icon={<CreditCard size={16} color={colors.accent} />}
            label="Expense Alerts"
            desc="When group members add expenses"
            value={prefs.expenseAlerts}
            onToggle={() => toggle('expenseAlerts')}
            colors={colors}
          />
          <View style={s.divider} />
          <ToggleRow
            icon={<Users size={16} color={colors.coral} />}
            label="Group Activity"
            desc="Votes, new members, shared photos"
            value={prefs.groupActivity}
            onToggle={() => toggle('groupActivity')}
            colors={colors}
          />
          <View style={s.divider} />
          <ToggleRow
            icon={<Luggage size={16} color={colors.text2} />}
            label="Packing Reminders"
            desc="Don't forget your essentials"
            value={prefs.packingReminders}
            onToggle={() => toggle('packingReminders')}
            colors={colors}
          />
        </View>

        {/* ── QUIET HOURS ── */}
        <Text style={s.sectionLabel}>Quiet hours</Text>
        <View style={s.card}>
          <ToggleRow
            icon={<Moon size={16} color={colors.text2} />}
            label="Do Not Disturb"
            desc={prefs.quietHours.enabled
              ? `No push ${prefs.quietHours.startHour}:00 – ${prefs.quietHours.endHour}:00 PHT`
              : 'Push notifications always on'}
            value={prefs.quietHours.enabled}
            onToggle={toggleQuietHours}
            colors={colors}
          />
        </View>
        <Text style={s.footnote}>
          Quiet hours only suppress push notifications. In-app alerts still appear when you open AfterStay.
        </Text>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ---------- TOGGLE ROW ----------

function ToggleRow({
  icon,
  label,
  desc,
  value,
  onToggle,
  colors,
}: {
  icon: React.ReactNode;
  label: string;
  desc: string;
  value: boolean;
  onToggle: () => void;
  colors: ThemeColors;
}) {
  return (
    <View style={toggleStyles.row}>
      <View style={toggleStyles.iconWrap}>{icon}</View>
      <View style={toggleStyles.info}>
        <Text style={[toggleStyles.label, { color: colors.text }]}>{label}</Text>
        <Text style={[toggleStyles.desc, { color: colors.text3 }]}>{desc}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: colors.border, true: colors.accent }}
        thumbColor="#fff"
      />
    </View>
  );
}

const toggleStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(216,171,122,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
  },
  desc: {
    fontSize: 11,
    marginTop: 2,
  },
});

// ---------- STYLES ----------

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 16, paddingVertical: 12,
    },
    headerTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
    scroll: { paddingHorizontal: 16, paddingTop: 8 },
    pushBanner: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      paddingVertical: 10, paddingHorizontal: 14,
      borderRadius: 12, borderWidth: 1,
    },
    pushBannerOn: {
      backgroundColor: 'rgba(216,171,122,0.08)', borderColor: 'rgba(216,171,122,0.25)',
    },
    pushBannerOff: {
      backgroundColor: 'rgba(196,85,74,0.08)', borderColor: 'rgba(196,85,74,0.25)',
    },
    pushBannerText: {
      fontSize: 12, fontWeight: '600',
    },
    testPushBtn: {
      marginTop: 10,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.accent,
      borderRadius: 14,
      paddingVertical: 11,
      paddingHorizontal: 14,
    },
    testPushText: {
      color: colors.bg,
      fontSize: 13,
      fontWeight: '700',
    },
    sectionLabel: {
      fontSize: 11, fontWeight: '600', color: colors.text3,
      textTransform: 'uppercase', letterSpacing: 1.4,
      marginTop: 24, marginBottom: 10, paddingHorizontal: 4,
    },
    card: {
      backgroundColor: colors.card, borderRadius: 16,
      borderWidth: 1, borderColor: colors.border,
      paddingHorizontal: 14,
    },
    divider: {
      height: 1, backgroundColor: colors.border, marginHorizontal: -14,
    },
    footnote: {
      fontSize: 11, color: colors.text3, marginTop: 8, paddingHorizontal: 4, lineHeight: 16,
    },
  });
