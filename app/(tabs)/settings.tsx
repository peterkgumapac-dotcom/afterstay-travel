import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  TextInput,
  Modal,
  Image,
  Linking,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import * as ImagePicker from 'expo-image-picker';
import * as Updates from 'expo-updates';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AtSign,
  Bell,
  Camera,
  Check,
  ChevronRight,
  Crown,
  Info,
  ArrowLeft,
  LogOut,
  Moon,
  Palette,
  Plane,
  Sun,
  User,
  X,
} from 'lucide-react-native';
import { spacing, radius } from '@/constants/theme';
import { useTheme } from '@/constants/ThemeContext';
import { useAuth } from '@/lib/auth';
import {
  getActiveTrip,
  getProfile,
  isHandleAvailable,
  supabase,
  updateProfile,
  uploadProfilePhoto,
  type ProfileSocials,
} from '@/lib/supabase';
import type { Trip } from '@/lib/types';
import { clearPrefsCache } from '@/lib/notificationPrefs';

const WHATS_NEW = [
  'Fixed photo uploads failing on Android',
  'Notifications now work — bell badge, in-app alerts, and clear all',
  'Location autocomplete no longer hidden behind form fields',
  'Upload errors now show the actual reason instead of a generic message',
];

interface ProfileState {
  name: string;
  avatarUri: string;
  handle: string;
  phone: string;
  socials: ProfileSocials;
}

interface Notifications {
  departureReminders: boolean;
  budgetAlerts: boolean;
  packingReminders: boolean;
  groupActivity: boolean;
  expenseAlerts: boolean;
  tripLifecycle: boolean;
  checkInOut: boolean;
  // Phase controls
  preTripAlerts: boolean;
  activeTripAlerts: boolean;
  postTripAlerts: boolean;
  // Quiet hours
  quietHours: { enabled: boolean; startHour: number; endHour: number };
  // Muted trips
  mutedTrips: string[];
}

const STORAGE_PROFILE = 'settings_profile';
const STORAGE_NOTIFICATIONS = 'settings_notifications';

const DEFAULT_PROFILE: ProfileState = { name: 'Traveler', avatarUri: '', handle: '', phone: '', socials: {} };
const DEFAULT_NOTIFICATIONS: Notifications = {
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

const HANDLE_REGEX = /^[a-z][a-z0-9_]{2,19}$/;

export default function SettingsScreen() {
  const router = useRouter();
  const { mode, colors, toggle: toggleTheme } = useTheme();
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<ProfileState>(DEFAULT_PROFILE);
  const [notifications, setNotifications] = useState<Notifications>(DEFAULT_NOTIFICATIONS);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [editName, setEditName] = useState('');
  const [editHandle, setEditHandle] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editSocials, setEditSocials] = useState<ProfileSocials>({});
  const [handleStatus, setHandleStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');
  const [saving, setSaving] = useState(false);
  const handleCheckTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadProfile();
    loadNotifications();
    loadTrip();
  }, []);

  const loadProfile = async () => {
    if (user?.id) {
      const p = await getProfile(user.id);
      if (p) {
        const loaded: ProfileState = {
          name: p.fullName || user.email?.split('@')[0] || 'Traveler',
          avatarUri: p.avatarUrl || '',
          handle: p.handle || '',
          phone: p.phone || '',
          socials: p.socials || {},
        };
        setProfile(loaded);
        await AsyncStorage.setItem(STORAGE_PROFILE, JSON.stringify(loaded));
        return;
      }
    }
    const raw = await AsyncStorage.getItem(STORAGE_PROFILE);
    if (raw) {
      const parsed = JSON.parse(raw);
      setProfile({ ...DEFAULT_PROFILE, ...parsed });
    }
  };

  const loadNotifications = async () => {
    const raw = await AsyncStorage.getItem(STORAGE_NOTIFICATIONS);
    if (raw) setNotifications(JSON.parse(raw));
  };

  const loadTrip = async () => {
    const active = await getActiveTrip();
    setTrip(active);
  };

  const saveProfile = async (updated: ProfileState) => {
    setProfile(updated);
    await AsyncStorage.setItem(STORAGE_PROFILE, JSON.stringify(updated));
    if (user?.id) {
      try {
        let avatarUrl = updated.avatarUri || undefined;
        if (updated.avatarUri && !updated.avatarUri.startsWith('http')) {
          const publicUrl = await uploadProfilePhoto(user.id, updated.avatarUri);
          avatarUrl = publicUrl;
          const synced = { ...updated, avatarUri: publicUrl };
          setProfile(synced);
          await AsyncStorage.setItem(STORAGE_PROFILE, JSON.stringify(synced));
        }
        await updateProfile(user.id, {
          fullName: updated.name,
          avatarUrl,
          handle: updated.handle ?? '',
          phone: updated.phone ?? '',
          socials: updated.socials ?? {},
        });
        // Sync avatar + name to group_members so home screen picks it up
        if (avatarUrl || updated.name) {
          const memberUpdate: Record<string, unknown> = {};
          if (avatarUrl) memberUpdate.avatar_url = avatarUrl;
          if (updated.name) memberUpdate.name = updated.name;
          await supabase
            .from('group_members')
            .update(memberUpdate)
            .eq('user_id', user.id)
            .then(() => {});
        }
      } catch (err) {
        if (__DEV__) console.warn('[settings] saveProfile remote failed:', err);
      }
    }
  };

  const toggleNotification = useCallback(
    async (key: keyof Omit<Notifications, 'quietHours' | 'mutedTrips'>) => {
      const updated = { ...notifications, [key]: !notifications[key] };
      setNotifications(updated);
      clearPrefsCache();
      await AsyncStorage.setItem(STORAGE_NOTIFICATIONS, JSON.stringify(updated));
      if (user?.id) {
        import('@/lib/supabase').then(({ supabase }) => {
          supabase.from('profiles').update({ notification_prefs: updated }).eq('id', user!.id).then(() => {});
        }).catch(() => {});
      }
    },
    [notifications, user?.id],
  );

  const toggleQuietHours = useCallback(async () => {
    const updated = {
      ...notifications,
      quietHours: { ...notifications.quietHours, enabled: !notifications.quietHours.enabled },
    };
    setNotifications(updated);
    clearPrefsCache();
    await AsyncStorage.setItem(STORAGE_NOTIFICATIONS, JSON.stringify(updated));
    if (user?.id) {
      import('@/lib/supabase').then(({ supabase }) => {
        supabase.from('profiles').update({ notification_prefs: updated }).eq('id', user!.id).then(() => {});
      }).catch(() => {});
    }
  }, [notifications, user?.id]);

  const handleSaveProfile = async () => {
    const trimmedName = editName.trim();
    const trimmedHandle = editHandle.trim().toLowerCase();
    if (trimmedName.length === 0) return;
    if (trimmedHandle && handleStatus !== 'available' && trimmedHandle !== profile.handle) return;

    setSaving(true);
    await saveProfile({ ...profile, name: trimmedName, handle: trimmedHandle, phone: editPhone.trim(), socials: editSocials });
    setSaving(false);
    setModalVisible(false);
  };

  const openEditProfile = () => {
    setEditName(profile.name);
    setEditHandle(profile.handle);
    setEditPhone(profile.phone);
    setEditSocials({ ...profile.socials });
    setHandleStatus(profile.handle ? 'available' : 'idle');
    setModalVisible(true);
  };

  const onHandleChange = (raw: string) => {
    const cleaned = raw.toLowerCase().replace(/[^a-z0-9_]/g, '');
    setEditHandle(cleaned);

    if (handleCheckTimer.current) clearTimeout(handleCheckTimer.current);

    if (!cleaned) {
      setHandleStatus('idle');
      return;
    }
    if (cleaned === profile.handle) {
      setHandleStatus('available');
      return;
    }
    if (!HANDLE_REGEX.test(cleaned)) {
      setHandleStatus('invalid');
      return;
    }

    setHandleStatus('checking');
    handleCheckTimer.current = setTimeout(async () => {
      if (!user?.id) return;
      const available = await isHandleAvailable(cleaned, user.id);
      setHandleStatus(available ? 'available' : 'taken');
    }, 500);
  };

  const pickAvatar = async () => {
    if (Platform.OS === 'ios') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Photo Library Access',
          'Please enable photo library access in Settings to change your profile picture.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openURL('app-settings:') },
          ],
        );
        return;
      }
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled && result.assets.length > 0) {
      saveProfile({ ...profile, avatarUri: result.assets[0].uri });
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso.length === 10 ? `${iso}T00:00:00+08:00` : iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const s = getDynamicStyles(colors);

  const handleStatusColor =
    handleStatus === 'available' ? colors.success
    : handleStatus === 'taken' || handleStatus === 'invalid' ? colors.danger
    : colors.text3;

  const handleStatusText =
    handleStatus === 'checking' ? 'Checking...'
    : handleStatus === 'available' ? 'Available'
    : handleStatus === 'taken' ? 'Already taken'
    : handleStatus === 'invalid' ? '3-20 chars, letters/numbers/underscores'
    : '';

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <ArrowLeft size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Settings</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Profile Hero Card */}
        <TouchableOpacity style={s.profileCard} onPress={openEditProfile} activeOpacity={0.7}>
          <View style={styles.profileRow}>
            <TouchableOpacity onPress={pickAvatar} activeOpacity={0.7} style={styles.avatarContainer}>
              {profile.avatarUri ? (
                <Image key={profile.avatarUri} source={{ uri: profile.avatarUri }} style={styles.avatarHero} />
              ) : (
                <View style={s.avatarHeroFallback}>
                  <User size={28} color={colors.text3} />
                </View>
              )}
              <View style={[styles.cameraBadge, { backgroundColor: colors.accent }]}>
                <Camera size={12} color={colors.bg} strokeWidth={2.5} />
              </View>
            </TouchableOpacity>
            <View style={styles.profileInfo}>
              <Text style={s.profileName} numberOfLines={1}>{profile.name}</Text>
              {profile.handle ? (
                <Text style={s.profileHandle} numberOfLines={1}>@{profile.handle}</Text>
              ) : (
                <Text style={s.profileHandleEmpty}>Set your AS handle</Text>
              )}
              <Text style={s.profileEmail} numberOfLines={1}>{user?.email ?? ''}</Text>
            </View>
            <ChevronRight size={18} color={colors.text3} />
          </View>
        </TouchableOpacity>

        {/* Trip */}
        <SectionLabel label="Active Trip" textColor={colors.text3} />
        <View style={s.card}>
          {trip ? (
            <View style={styles.tripContent}>
              <View style={s.tripIcon}>
                <Plane size={16} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.cardTitle}>{trip.name}</Text>
                <Text style={s.cardSub}>
                  {formatDate(trip.startDate)} — {formatDate(trip.endDate)}
                </Text>
                {trip.budgetLimit != null && (
                  <Text style={s.cardMeta}>
                    Budget: {trip.costCurrency ?? '₱'}{trip.budgetLimit.toLocaleString()}
                  </Text>
                )}
              </View>
            </View>
          ) : (
            <Text style={s.cardSub}>No active trip</Text>
          )}
        </View>

        {/* Appearance */}
        <SectionLabel label="Appearance" textColor={colors.text3} />
        <View style={s.card}>
          <View style={styles.toggleRow}>
            <View style={styles.toggleLeft}>
              {mode === 'dark' ? (
                <Moon size={18} color={colors.accent} />
              ) : (
                <Sun size={18} color={colors.accent} />
              )}
              <Text style={s.toggleLabel}>
                {mode === 'dark' ? 'Dark Mode' : 'Light Mode'}
              </Text>
            </View>
            <Switch
              value={mode === 'dark'}
              onValueChange={toggleTheme}
              trackColor={{ false: colors.border, true: colors.accent }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* Notifications */}
        <SectionLabel label="Notifications" textColor={colors.text3} />
        <TouchableOpacity
          style={s.card}
          onPress={() => router.push('/notification-settings' as never)}
          activeOpacity={0.7}
        >
          <View style={styles.notifNavRow}>
            <Bell size={18} color={colors.accent} />
            <View style={{ flex: 1 }}>
              <Text style={s.cardTitle}>Notification Preferences</Text>
              <Text style={s.cardSub}>Categories, quiet hours, trip phases</Text>
            </View>
            <ChevronRight size={16} color={colors.text3} />
          </View>
        </TouchableOpacity>

        {/* Subscription */}
        <SectionLabel label="Subscription" textColor={colors.text3} />
        <View style={s.card}>
          <View style={styles.subRow}>
            <Crown size={18} color={colors.accent} />
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <Text style={s.cardTitle}>Free Plan</Text>
              <Text style={s.cardSub}>Upgrade for Trip Memories and premium features</Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => Alert.alert('Premium', 'Premium subscriptions coming soon!')}
            style={s.upgradeBtn}
            activeOpacity={0.7}
          >
            <Text style={s.upgradeBtnText}>Upgrade</Text>
          </TouchableOpacity>
        </View>

        {/* Account */}
        <SectionLabel label="Account" textColor={colors.text3} />
        <View style={s.card}>
          <Text style={s.cardTitle}>{user?.email ?? 'Not signed in'}</Text>
          <TouchableOpacity
            onPress={async () => { await signOut(); router.replace('/auth/login' as any); }}
            style={s.signOutBtn}
            activeOpacity={0.7}
          >
            <LogOut size={14} color={colors.danger} />
            <Text style={s.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>

        {/* About */}
        <SectionLabel label="About" textColor={colors.text3} />
        <View style={s.card}>
          <Text style={s.cardTitle}>AfterStay Travel</Text>
          <Text style={s.cardSub}>
            Version {Constants.expoConfig?.version ?? '?'}
            {Updates.updateId ? ` · ${Updates.updateId.slice(0, 8)}` : ''}
          </Text>
        </View>

        {/* What's New */}
        <SectionLabel label="What's New" textColor={colors.text3} />
        <View style={s.card}>
          <Text style={[s.cardTitle, { marginBottom: 6 }]}>v{Constants.expoConfig?.version ?? '?'}</Text>
          {WHATS_NEW.map((item, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: 8, marginBottom: 4 }}>
              <Text style={[s.cardSub, { fontSize: 12 }]}>{'\u2022'}</Text>
              <Text style={[s.cardSub, { fontSize: 12, flex: 1 }]}>{item}</Text>
            </View>
          ))}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={s.modalCard}>
            <ScrollView showsVerticalScrollIndicator={false} bounces={false} keyboardShouldPersistTaps="handled">
              <Text style={s.modalTitle}>Edit Profile</Text>

              {/* Avatar picker */}
              <TouchableOpacity onPress={pickAvatar} activeOpacity={0.7} style={styles.avatarPickerModal}>
                {profile.avatarUri ? (
                  <Image key={profile.avatarUri} source={{ uri: profile.avatarUri }} style={styles.avatarLargeModal} />
                ) : (
                  <View style={s.avatarFallbackLarge}>
                    <User size={32} color={colors.text3} />
                  </View>
                )}
                <View style={[styles.cameraBadgeLarge, { backgroundColor: colors.accent }]}>
                  <Camera size={14} color={colors.bg} strokeWidth={2.5} />
                </View>
              </TouchableOpacity>
              <Text style={s.avatarHint}>Tap photo to change</Text>

              {/* Name input */}
              <Text style={s.inputLabel}>Display Name</Text>
              <TextInput
                style={s.modalInput}
                value={editName}
                onChangeText={setEditName}
                placeholder="Your name"
                placeholderTextColor={colors.text3}
                autoFocus
              />

              {/* Handle input */}
              <Text style={[s.inputLabel, { marginTop: spacing.lg }]}>AS Handle</Text>
              <View style={s.handleInputRow}>
                <Text style={s.handleAt}>@</Text>
                <TextInput
                  style={s.handleInput}
                  value={editHandle}
                  onChangeText={onHandleChange}
                  placeholder="yourhandle"
                  placeholderTextColor={colors.text3}
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={20}
                />
                {handleStatus === 'checking' && (
                  <ActivityIndicator size="small" color={colors.text3} />
                )}
                {handleStatus === 'available' && (
                  <Check size={16} color={colors.success} />
                )}
                {(handleStatus === 'taken' || handleStatus === 'invalid') && (
                  <X size={16} color={colors.danger} />
                )}
              </View>
              {handleStatusText ? (
                <Text style={[s.handleHint, { color: handleStatusColor }]}>{handleStatusText}</Text>
              ) : (
                <Text style={s.handleHint}>Unique username others can find you by</Text>
              )}

              {/* Email (read-only) */}
              <Text style={[s.inputLabel, { marginTop: spacing.lg }]}>Email</Text>
              <View style={s.readOnlyField}>
                <Text style={s.readOnlyText} numberOfLines={1}>{user?.email ?? 'Not set'}</Text>
              </View>
              <Text style={s.fieldHint}>Managed by your sign-in provider</Text>

              {/* Phone */}
              <Text style={[s.inputLabel, { marginTop: spacing.lg }]}>Phone Number</Text>
              <TextInput
                style={s.modalInput}
                value={editPhone}
                onChangeText={setEditPhone}
                placeholder="+63 917 123 4567"
                placeholderTextColor={colors.text3}
                keyboardType="phone-pad"
                autoCorrect={false}
              />
              <Text style={s.fieldHint}>Visible to your trip group members</Text>

              {/* Socials */}
              <Text style={[s.inputLabel, { marginTop: spacing.xl }]}>Connected Socials</Text>
              <Text style={[s.fieldHint, { marginBottom: spacing.md }]}>
                Let your travel group find you on social media
              </Text>

              <SocialInput
                label="Instagram"
                placeholder="username"
                prefix="@"
                value={editSocials.instagram ?? ''}
                onChangeText={(v) => setEditSocials({ ...editSocials, instagram: v || undefined })}
                colors={colors}
                s={s}
              />
              <SocialInput
                label="TikTok"
                placeholder="username"
                prefix="@"
                value={editSocials.tiktok ?? ''}
                onChangeText={(v) => setEditSocials({ ...editSocials, tiktok: v || undefined })}
                colors={colors}
                s={s}
              />
              <SocialInput
                label="X (Twitter)"
                placeholder="username"
                prefix="@"
                value={editSocials.x ?? ''}
                onChangeText={(v) => setEditSocials({ ...editSocials, x: v || undefined })}
                colors={colors}
                s={s}
              />
              <SocialInput
                label="Facebook"
                placeholder="profile name or URL"
                value={editSocials.facebook ?? ''}
                onChangeText={(v) => setEditSocials({ ...editSocials, facebook: v || undefined })}
                colors={colors}
                s={s}
              />

              {/* Actions */}
              <View style={styles.modalActions}>
                <TouchableOpacity onPress={() => setModalVisible(false)} style={s.cancelBtn}>
                  <Text style={s.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSaveProfile}
                  style={[
                    s.saveBtn,
                    (saving || (editHandle && handleStatus !== 'available' && editHandle !== profile.handle))
                      && { opacity: 0.5 },
                  ]}
                  disabled={saving || (!!editHandle && handleStatus !== 'available' && editHandle !== profile.handle)}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color={colors.bg} />
                  ) : (
                    <Text style={s.saveBtnText}>Save</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/* ---------- Sub-components ---------- */

function SectionLabel({ label, textColor }: { label: string; textColor: string }) {
  return (
    <View style={styles.sectionRow}>
      <Text style={[styles.sectionLabel, { color: textColor }]}>{label}</Text>
    </View>
  );
}

function SocialInput({ label, placeholder, prefix, value, onChangeText, colors, s }: {
  label: string;
  placeholder: string;
  prefix?: string;
  value: string;
  onChangeText: (v: string) => void;
  colors: Record<string, string>;
  s: ReturnType<typeof getDynamicStyles>;
}) {
  return (
    <View style={styles.socialRow}>
      <Text style={s.socialLabel}>{label}</Text>
      <View style={s.socialInputRow}>
        {prefix && <Text style={s.socialPrefix}>{prefix}</Text>}
        <TextInput
          style={s.socialInput}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.text3}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {value ? (
          <TouchableOpacity onPress={() => onChangeText('')} hitSlop={8}>
            <X size={14} color={colors.text3} />
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

function NotifRow({ label, desc, value, onToggle, colors, s }: {
  label: string;
  desc: string;
  value: boolean;
  onToggle: () => void;
  colors: Record<string, string>;
  s: ReturnType<typeof getDynamicStyles>;
}) {
  return (
    <View style={styles.toggleRow}>
      <View style={{ flex: 1 }}>
        <Text style={s.toggleLabel}>{label}</Text>
        <Text style={s.toggleDesc}>{desc}</Text>
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

/* ---------- Styles ---------- */

const getDynamicStyles = (c: Record<string, string>) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    headerTitle: { fontSize: 18, fontWeight: '700', color: c.text },

    // Profile hero
    profileCard: {
      backgroundColor: c.bg2,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: c.border,
      padding: spacing.lg,
      marginTop: spacing.md,
    },
    avatarHeroFallback: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: c.card2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    profileName: {
      fontSize: 17,
      fontWeight: '700',
      color: c.text,
    },
    profileHandle: {
      fontSize: 13,
      fontWeight: '500',
      color: c.accent,
      marginTop: 2,
    },
    profileHandleEmpty: {
      fontSize: 13,
      fontWeight: '500',
      color: c.text3,
      fontStyle: 'italic',
      marginTop: 2,
    },
    profileEmail: {
      fontSize: 12,
      color: c.text3,
      marginTop: 2,
    },

    // Cards
    card: {
      backgroundColor: c.bg2,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: c.border,
      padding: spacing.lg,
    },
    cardTitle: { fontSize: 15, fontWeight: '600', color: c.text },
    cardSub: { fontSize: 13, color: c.text2, marginTop: 2 },
    cardMeta: { fontSize: 12, color: c.text3, marginTop: 4 },

    // Trip
    tripIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: c.accentBg,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.md,
    },

    // Toggles
    toggleLabel: { fontSize: 14, fontWeight: '500', color: c.text },
    toggleDesc: { fontSize: 11, color: c.text3, marginTop: 1 },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: c.border, marginVertical: spacing.md },

    // Subscription
    upgradeBtn: {
      marginTop: spacing.md,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.lg,
      backgroundColor: c.accentBg,
      borderRadius: radius.sm,
      alignSelf: 'flex-start',
      borderWidth: 1,
      borderColor: c.accentBorder,
    },
    upgradeBtnText: { color: c.accent, fontSize: 13, fontWeight: '600' },

    // Account
    signOutBtn: {
      marginTop: spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.lg,
      backgroundColor: c.danger + '18',
      borderRadius: radius.sm,
      alignSelf: 'flex-start',
    },
    signOutText: { color: c.danger, fontSize: 13, fontWeight: '600' },

    // Modal
    modalCard: {
      width: '90%',
      maxHeight: '85%',
      backgroundColor: c.bg2,
      borderRadius: radius.xl,
      padding: spacing.xxl,
      borderWidth: 1,
      borderColor: c.border,
    },
    modalTitle: { fontSize: 20, fontWeight: '700', color: c.text, marginBottom: spacing.lg, textAlign: 'center' },
    avatarFallbackLarge: {
      width: 88,
      height: 88,
      borderRadius: 44,
      backgroundColor: c.card2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarHint: {
      fontSize: 12,
      color: c.text3,
      textAlign: 'center',
      marginBottom: spacing.xl,
    },
    inputLabel: {
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.5,
      textTransform: 'uppercase',
      color: c.text3,
      marginBottom: 6,
    },
    modalInput: {
      backgroundColor: c.bg,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: c.border,
      color: c.text,
      fontSize: 15,
      paddingHorizontal: spacing.md,
      paddingVertical: 10,
    },
    readOnlyField: {
      backgroundColor: c.bg,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: c.border,
      paddingHorizontal: spacing.md,
      paddingVertical: 10,
      opacity: 0.6,
    },
    readOnlyText: {
      fontSize: 15,
      color: c.text2,
    },
    fieldHint: {
      fontSize: 11,
      color: c.text3,
      marginTop: 4,
    },
    handleInputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.bg,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: c.border,
      paddingHorizontal: spacing.md,
    },
    handleAt: {
      fontSize: 15,
      fontWeight: '600',
      color: c.text3,
      marginRight: 2,
    },
    handleInput: {
      flex: 1,
      fontSize: 15,
      color: c.text,
      paddingVertical: 10,
    },
    handleHint: {
      fontSize: 11,
      color: c.text3,
      marginTop: 4,
    },

    // Socials
    socialLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: c.text2,
      width: 90,
    },
    socialInputRow: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.bg,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: c.border,
      paddingHorizontal: spacing.sm,
    },
    socialPrefix: {
      fontSize: 14,
      fontWeight: '500',
      color: c.text3,
      marginRight: 1,
    },
    socialInput: {
      flex: 1,
      fontSize: 14,
      color: c.text,
      paddingVertical: 8,
    },

    cancelBtn: {
      paddingHorizontal: spacing.xl,
      paddingVertical: 10,
      borderRadius: radius.sm,
    },
    cancelBtnText: { fontSize: 14, fontWeight: '600', color: c.text3 },
    saveBtn: {
      paddingHorizontal: spacing.xxl,
      paddingVertical: 10,
      borderRadius: radius.sm,
      backgroundColor: c.accent,
      minWidth: 80,
      alignItems: 'center',
    },
    saveBtnText: { fontSize: 14, fontWeight: '700', color: c.bg },
  });

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  notifNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  scrollContent: { paddingHorizontal: spacing.lg, paddingBottom: 120 },
  sectionRow: {
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    position: 'relative',
  },
  avatarHero: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  cameraBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#1b1814',
  },
  profileInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  tripContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPickerModal: {
    alignSelf: 'center',
    marginBottom: spacing.sm,
  },
  avatarLargeModal: {
    width: 88,
    height: 88,
    borderRadius: 44,
  },
  cameraBadgeLarge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  socialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: spacing.xxl,
    gap: spacing.sm,
  },
});
