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
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User, Plane, Bell, Info, ChevronRight, ArrowLeft } from 'lucide-react-native';
import { colors, spacing, radius } from '@/constants/theme';
import { getActiveTrip } from '@/lib/notion';
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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.push('/(tabs)/home')} hitSlop={12}>
          <ArrowLeft size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Profile */}
        <SectionLabel icon={<User size={14} color={colors.green2} />} label="Profile" />
        <TouchableOpacity style={styles.card} onPress={openEditProfile} activeOpacity={0.7}>
          <View style={styles.cardRow}>
            {profile.avatarUri ? (
              <Image source={{ uri: profile.avatarUri }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarFallback}>
                <User size={20} color={colors.text3} />
              </View>
            )}
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <Text style={styles.cardTitle}>{profile.name}</Text>
              <Text style={styles.cardSub}>Tap to edit profile</Text>
            </View>
            <ChevronRight size={18} color={colors.text3} />
          </View>
        </TouchableOpacity>

        {/* Trip */}
        <SectionLabel icon={<Plane size={14} color={colors.green2} />} label="Trip" />
        <View style={styles.card}>
          {trip ? (
            <>
              <Text style={styles.cardTitle}>{trip.name}</Text>
              <Text style={styles.cardSub}>
                {formatDate(trip.startDate)} — {formatDate(trip.endDate)}
              </Text>
              {trip.budgetLimit != null && (
                <Text style={[styles.cardSub, { marginTop: spacing.xs }]}>
                  Budget limit: {trip.costCurrency ?? '₱'}{trip.budgetLimit.toLocaleString()}
                </Text>
              )}
            </>
          ) : (
            <Text style={styles.cardSub}>No active trip found</Text>
          )}
        </View>

        {/* Notifications */}
        <SectionLabel icon={<Bell size={14} color={colors.green2} />} label="Notifications" />
        <View style={styles.card}>
          <ToggleRow
            label="Departure Reminders"
            value={notifications.departureReminders}
            onToggle={() => toggleNotification('departureReminders')}
          />
          <View style={styles.divider} />
          <ToggleRow
            label="Budget Alerts"
            value={notifications.budgetAlerts}
            onToggle={() => toggleNotification('budgetAlerts')}
          />
          <View style={styles.divider} />
          <ToggleRow
            label="Packing Reminders"
            value={notifications.packingReminders}
            onToggle={() => toggleNotification('packingReminders')}
          />
        </View>

        {/* About */}
        <SectionLabel icon={<Info size={14} color={colors.green2} />} label="About" />
        <View style={styles.card}>
          <Text style={styles.cardTitle}>AfterStay v1.0</Text>
          <Text style={styles.cardSub}>Built with love for Boracay 2026</Text>
        </View>
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit Profile</Text>
            <TextInput
              style={styles.modalInput}
              value={editName}
              onChangeText={setEditName}
              placeholder="Your name"
              placeholderTextColor={colors.text3}
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.modalBtn}>
                <Text style={[styles.modalBtnText, { color: colors.text3 }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSaveProfile} style={[styles.modalBtn, styles.modalBtnPrimary]}>
                <Text style={[styles.modalBtnText, { color: colors.bg }]}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/* ---------- Sub-components ---------- */

function SectionLabel({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <View style={styles.sectionRow}>
      {icon}
      <Text style={styles.sectionLabel}>{label}</Text>
    </View>
  );
}

function ToggleRow({ label, value, onToggle }: { label: string; value: boolean; onToggle: () => void }) {
  return (
    <View style={styles.toggleRow}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: colors.border, true: colors.green }}
        thumbColor={colors.white}
      />
    </View>
  );
}

/* ---------- Styles ---------- */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  scrollContent: { paddingHorizontal: spacing.lg, paddingBottom: 40 },

  sectionRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.xl, marginBottom: spacing.sm },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    color: colors.text2,
    marginLeft: spacing.xs,
  },

  card: {
    backgroundColor: colors.bg2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  cardTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  cardSub: { fontSize: 13, color: colors.text2, marginTop: 2 },

  avatar: { width: 42, height: 42, borderRadius: 21 },
  avatarFallback: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.md },

  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toggleLabel: { fontSize: 14, color: colors.text },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCard: {
    width: '85%',
    backgroundColor: colors.bg2,
    borderRadius: radius.lg,
    padding: spacing.xxl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: spacing.lg },
  modalInput: {
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontSize: 15,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: spacing.xl, gap: spacing.sm },
  modalBtn: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.sm },
  modalBtnPrimary: { backgroundColor: colors.green2 },
  modalBtnText: { fontSize: 14, fontWeight: '600', color: colors.text },
});
