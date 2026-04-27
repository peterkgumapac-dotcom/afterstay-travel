import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
import { clearPrefsCache } from '@/lib/notificationPrefs';
import { spacing } from '@/constants/theme';

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

const STORAGE_KEY = 'settings_notifications';

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

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) setPrefs({ ...DEFAULTS, ...JSON.parse(raw) });
    }).catch(() => {});
  }, []);

  const save = useCallback(async (updated: NotificationPrefsState) => {
    setPrefs(updated);
    clearPrefsCache();
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    if (user?.id) {
      supabase.from('profiles').update({ notification_prefs: updated }).eq('id', user.id).then(() => {});
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
