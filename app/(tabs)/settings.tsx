import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  TextInput,
  Modal,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User, Plane, Bell, Info, ChevronRight, ArrowLeft, Sun, Moon, Palette, LogOut } from 'lucide-react-native';
import { spacing, radius } from '@/constants/theme';
import { useTheme } from '@/constants/ThemeContext';
import { useAuth } from '@/lib/auth';
import { getActiveTrip, getProfile, updateProfile } from '@/lib/supabase';
import type { Trip } from '@/lib/types';

interface Profile {
  name: string;
  avatarUri: string;
}

interface Notifications {
  departureReminders: boolean;
  budgetAlerts: boolean;
  packingReminders: boolean;
}

const STORAGE_PROFILE = 'settings_profile';
const STORAGE_NOTIFICATIONS = 'settings_notifications';

const DEFAULT_PROFILE: Profile = { name: 'Traveler', avatarUri: '' };
const DEFAULT_NOTIFICATIONS: Notifications = {
  departureReminders: true,
  budgetAlerts: true,
  packingReminders: true,
};

export default function SettingsScreen() {
  const router = useRouter();
  const { mode, colors, toggle: toggleTheme } = useTheme();
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE);
  const [notifications, setNotifications] = useState<Notifications>(DEFAULT_NOTIFICATIONS);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [editName, setEditName] = useState('');

  useEffect(() => {
    loadProfile();
    loadNotifications();
    loadTrip();
  }, []);

  const loadProfile = async () => {
    if (user?.id) {
      const p = await getProfile(user.id);
      if (p) {
        setProfile({ name: p.fullName || user.email?.split('@')[0] || 'Traveler', avatarUri: p.avatarUrl || '' });
        return;
      }
    }
    // Fallback to AsyncStorage
    const raw = await AsyncStorage.getItem(STORAGE_PROFILE);
    if (raw) setProfile(JSON.parse(raw));
  };

  const loadNotifications = async () => {
    const raw = await AsyncStorage.getItem(STORAGE_NOTIFICATIONS);
    if (raw) setNotifications(JSON.parse(raw));
  };

  const loadTrip = async () => {
    const active = await getActiveTrip();
    setTrip(active);
  };

  const saveProfile = async (updated: Profile) => {
    setProfile(updated);
    await AsyncStorage.setItem(STORAGE_PROFILE, JSON.stringify(updated));
    if (user?.id) {
      await updateProfile(user.id, { fullName: updated.name, avatarUrl: updated.avatarUri || undefined }).catch(() => {});
    }
  };

  const toggleNotification = useCallback(
    async (key: keyof Notifications) => {
      const updated = { ...notifications, [key]: !notifications[key] };
      setNotifications(updated);
      await AsyncStorage.setItem(STORAGE_NOTIFICATIONS, JSON.stringify(updated));
    },
    [notifications],
  );

  const handleSaveProfile = () => {
    const trimmed = editName.trim();
    if (trimmed.length > 0) {
      saveProfile({ ...profile, name: trimmed });
    }
    setModalVisible(false);
  };

  const openEditProfile = () => {
    setEditName(profile.name);
    setModalVisible(true);
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const dynamicStyles = getDynamicStyles(colors);

  return (
    <SafeAreaView style={dynamicStyles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.push('/(tabs)/home')} hitSlop={12}>
          <ArrowLeft size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={dynamicStyles.headerTitle}>Settings</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Profile */}
        <SectionLabel icon={<User size={14} color={colors.green2} />} label="Profile" textColor={colors.text2} />
        <TouchableOpacity style={dynamicStyles.card} onPress={openEditProfile} activeOpacity={0.7}>
          <View style={styles.cardRow}>
            {profile.avatarUri ? (
              <Image source={{ uri: profile.avatarUri }} style={styles.avatar} />
            ) : (
              <View style={dynamicStyles.avatarFallback}>
                <User size={20} color={colors.text3} />
              </View>
            )}
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <Text style={dynamicStyles.cardTitle}>{profile.name}</Text>
              <Text style={dynamicStyles.cardSub}>Tap to edit profile</Text>
            </View>
            <ChevronRight size={18} color={colors.text3} />
          </View>
        </TouchableOpacity>

        {/* Trip */}
        <SectionLabel icon={<Plane size={14} color={colors.green2} />} label="Trip" textColor={colors.text2} />
        <View style={dynamicStyles.card}>
          {trip ? (
            <>
              <Text style={dynamicStyles.cardTitle}>{trip.name}</Text>
              <Text style={dynamicStyles.cardSub}>
                {formatDate(trip.startDate)} — {formatDate(trip.endDate)}
              </Text>
              {trip.budgetLimit != null && (
                <Text style={[dynamicStyles.cardSub, { marginTop: spacing.xs }]}>
                  Budget limit: {trip.costCurrency ?? '₱'}{trip.budgetLimit.toLocaleString()}
                </Text>
              )}
            </>
          ) : (
            <Text style={dynamicStyles.cardSub}>No active trip found</Text>
          )}
        </View>

        {/* Appearance */}
        <SectionLabel icon={<Palette size={14} color={colors.green2} />} label="Appearance" textColor={colors.text2} />
        <View style={dynamicStyles.card}>
          <View style={styles.toggleRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              {mode === 'dark' ? (
                <Moon size={18} color={colors.accent} />
              ) : (
                <Sun size={18} color={colors.accent} />
              )}
              <Text style={dynamicStyles.toggleLabel}>
                {mode === 'dark' ? 'Dark Mode' : 'Light Mode'}
              </Text>
            </View>
            <Switch
              value={mode === 'light'}
              onValueChange={toggleTheme}
              trackColor={{ false: colors.border, true: colors.green }}
              thumbColor={colors.white}
            />
          </View>
        </View>

        {/* Notifications */}
        <SectionLabel icon={<Bell size={14} color={colors.green2} />} label="Notifications" textColor={colors.text2} />
        <View style={dynamicStyles.card}>
          <View style={styles.toggleRow}>
            <Text style={dynamicStyles.toggleLabel}>Departure Reminders</Text>
            <Switch value={notifications.departureReminders} onValueChange={() => toggleNotification('departureReminders')} trackColor={{ false: colors.border, true: colors.green }} thumbColor={colors.white} />
          </View>
          <View style={dynamicStyles.divider} />
          <View style={styles.toggleRow}>
            <Text style={dynamicStyles.toggleLabel}>Budget Alerts</Text>
            <Switch value={notifications.budgetAlerts} onValueChange={() => toggleNotification('budgetAlerts')} trackColor={{ false: colors.border, true: colors.green }} thumbColor={colors.white} />
          </View>
          <View style={dynamicStyles.divider} />
          <View style={styles.toggleRow}>
            <Text style={dynamicStyles.toggleLabel}>Packing Reminders</Text>
            <Switch value={notifications.packingReminders} onValueChange={() => toggleNotification('packingReminders')} trackColor={{ false: colors.border, true: colors.green }} thumbColor={colors.white} />
          </View>
        </View>

        {/* Account */}
        <SectionLabel icon={<LogOut size={14} color={colors.green2} />} label="Account" textColor={colors.text2} />
        <View style={dynamicStyles.card}>
          <Text style={dynamicStyles.cardTitle}>{user?.email ?? 'Not signed in'}</Text>
          <Text style={dynamicStyles.cardSub}>Signed in</Text>
          <TouchableOpacity
            onPress={async () => { await signOut(); router.replace('/auth/login' as any); }}
            style={{ marginTop: spacing.md, paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, backgroundColor: colors.danger + '22', borderRadius: radius.sm, alignSelf: 'flex-start' }}
          >
            <Text style={{ color: colors.danger, fontSize: 13, fontWeight: '600' }}>Sign Out</Text>
          </TouchableOpacity>
        </View>

        {/* About */}
        <SectionLabel icon={<Info size={14} color={colors.green2} />} label="About" textColor={colors.text2} />
        <View style={dynamicStyles.card}>
          <Text style={dynamicStyles.cardTitle}>AfterStay v{Constants.expoConfig?.version ?? '?'}</Text>
          <Text style={dynamicStyles.cardSub}>Build {Constants.expoConfig?.extra?.eas?.projectId?.slice(0, 8) ?? '—'} · Expo SDK {Constants.expoConfig?.sdkVersion ?? '?'}</Text>
        </View>
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={dynamicStyles.modalCard}>
            <Text style={dynamicStyles.modalTitle}>Edit Profile</Text>
            <TextInput
              style={dynamicStyles.modalInput}
              value={editName}
              onChangeText={setEditName}
              placeholder="Your name"
              placeholderTextColor={colors.text3}
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.modalBtn}>
                <Text style={[dynamicStyles.modalBtnText, { color: colors.text3 }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSaveProfile} style={[styles.modalBtn, dynamicStyles.modalBtnPrimary]}>
                <Text style={[dynamicStyles.modalBtnText, { color: colors.bg }]}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/* ---------- Sub-components ---------- */

function SectionLabel({ icon, label, textColor }: { icon: React.ReactNode; label: string; textColor: string }) {
  return (
    <View style={styles.sectionRow}>
      {icon}
      <Text style={[styles.sectionLabel, { color: textColor }]}>{label}</Text>
    </View>
  );
}

/* ---------- Styles ---------- */

const getDynamicStyles = (c: Record<string, string>) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    headerTitle: { fontSize: 18, fontWeight: '700', color: c.text },
    sectionLabel: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.7, color: c.text2, marginLeft: spacing.xs },
    card: { backgroundColor: c.bg2, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, padding: spacing.lg },
    cardTitle: { fontSize: 15, fontWeight: '600', color: c.text },
    cardSub: { fontSize: 13, color: c.text2, marginTop: 2 },
    avatarFallback: { width: 42, height: 42, borderRadius: 21, backgroundColor: c.border, alignItems: 'center', justifyContent: 'center' },
    divider: { height: 1, backgroundColor: c.border, marginVertical: spacing.md },
    toggleLabel: { fontSize: 14, color: c.text },
    modalCard: { width: '85%', backgroundColor: c.bg2, borderRadius: radius.lg, padding: spacing.xxl, borderWidth: 1, borderColor: c.border },
    modalTitle: { fontSize: 18, fontWeight: '700', color: c.text, marginBottom: spacing.lg },
    modalInput: { backgroundColor: c.bg, borderRadius: radius.sm, borderWidth: 1, borderColor: c.border, color: c.text, fontSize: 15, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
    modalBtnPrimary: { backgroundColor: c.green2 },
    modalBtnText: { fontSize: 14, fontWeight: '600', color: c.text },
  });

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  scrollContent: { paddingHorizontal: spacing.lg, paddingBottom: 40 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.xl, marginBottom: spacing.sm },
  sectionLabel: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.7, marginLeft: spacing.xs },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 42, height: 42, borderRadius: 21 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: spacing.xl, gap: spacing.sm },
  modalBtn: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.sm },
});
