import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,
  Switch,
  TextInput,
  Modal,
  Image,
  Linking,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import * as ImagePicker from 'expo-image-picker';
import * as Updates from 'expo-updates';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Bell,
  Camera,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Crown,
  Download,
  ArrowLeft,
  LogOut,
  Moon,
  Plane,
  QrCode,
  Sun,
  User,
  X,
} from 'lucide-react-native';
import { spacing, radius } from '@/constants/theme';
import { useTheme } from '@/constants/ThemeContext';
import { useAuth } from '@/lib/auth';
import { useUserSegment, setSegmentOverride, getSegmentOverride } from '@/contexts/UserSegmentContext';
import { MOCK_KEYS, MOCK_LABELS, MOCK_DESCRIPTIONS, type MockKey } from '@/lib/mockData';
import {
  addUserPaymentQr,
  getActiveTrip,
  getCompanions,
  getProfile,
  getUserPaymentQrs,
  isHandleAvailable,
  removeUserPaymentQr,
  supabase,
  updateProfile,
  uploadProfilePhoto,
  type ProfileSocials,
  type UserPaymentQr,
} from '@/lib/supabase';
import type { CompanionProfile } from '@/lib/types';
import type { Trip } from '@/lib/types';

const CHANGELOG = [
  {
    title: 'May 2 reliability batch',
    summary: 'Uploads, scan rescans, profiles, stories, and new-user handle setup.',
    items: [
      'Moments uploads now use safer sequential uploads with timeouts and cleanup.',
      'Public moments save into Explore feed so other travelers can see them.',
      'Trip Group and Personal Album uploads now match the Supabase write policies.',
      'Round-trip flight rescans replace outbound and return flights atomically.',
      'Profile pages and story rows keep loading even when optional sections fail.',
      'New-user handle save falls back during Supabase schema-cache lag.',
    ],
  },
  {
    title: 'New-user and planning polish',
    summary: 'Better onboarding recovery, destination fallback, and trip readiness controls.',
    items: [
      'Trip checklist can be collapsed or hidden per trip, with a Show control.',
      'Discover and Top Picks can use hotel, address, or flight data when destination is fuzzy.',
      'Quick Trip and onboarding destination entry have safer autocomplete fallbacks.',
      'Invited companions can confirm shared stay and shared flight details.',
    ],
  },
  {
    title: 'Explore Moments refresh',
    summary: 'Social feed, stories, profile search, and postcard-style moments.',
    items: [
      'Explore Moments has a paper-style feed and inline compose bar.',
      'Traveler search opens public profiles from the Moments feed.',
      'Story viewer supports owner delete and graceful unavailable states.',
      'Saved, Recent, and Trending feeds use the live Explore feed data.',
    ],
  },
];

interface ProfileState {
  name: string;
  avatarUri: string;
  handle: string;
  phone: string;
  socials: ProfileSocials;
}

const STORAGE_PROFILE = 'settings_profile';

const DEFAULT_PROFILE: ProfileState = { name: 'Traveler', avatarUri: '', handle: '', phone: '', socials: {} };

const HANDLE_REGEX = /^[a-z][a-z0-9_]{2,19}$/;

function storageProfileKey(userId?: string | null): string {
  return `${STORAGE_PROFILE}:${userId ?? 'anon'}`;
}

function shortUpdateId(): string | null {
  return Updates.updateId ? Updates.updateId.slice(0, 8) : null;
}

function updateDiagnosticsText(): string {
  const id = shortUpdateId();
  const parts = [
    id ? `Build: ${id}` : 'No OTA update loaded',
    Updates.channel ? `Channel: ${Updates.channel}` : 'No channel',
    Updates.runtimeVersion ? `Runtime: ${Updates.runtimeVersion}` : null,
    Updates.isEmbeddedLaunch ? 'Embedded' : null,
  ].filter(Boolean);

  return parts.join(' | ');
}

function updateFailureMessage(err: unknown): string {
  const details = String(err);
  if (!Updates.isEnabled) {
    return 'OTA updates are disabled in this install. If you are running from Metro, you already have the local code.';
  }
  if (!Updates.channel) {
    return [
      'This install is not attached to an EAS Update channel, so it cannot receive the preview or production OTA update.',
      'Install a preview/production build to test OTA, or keep using Metro for local development.',
      '',
      details,
    ].join('\n');
  }
  return details;
}

export default function SettingsScreen() {
  const router = useRouter();
  const { mode, colors, toggle: toggleTheme } = useTheme();
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<ProfileState>(DEFAULT_PROFILE);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [editName, setEditName] = useState('');
  const [editHandle, setEditHandle] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editSocials, setEditSocials] = useState<ProfileSocials>({});
  const [handleStatus, setHandleStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');
  const [saving, setSaving] = useState(false);
  const handleCheckTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // App updates
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'downloading' | 'up-to-date' | 'error'>('idle');
  const [changelogExpanded, setChangelogExpanded] = useState(false);

  // Payment QR codes
  const [userQrs, setUserQrs] = useState<UserPaymentQr[]>([]);
  const [showQrNameModal, setShowQrNameModal] = useState(false);
  const [pendingQrUri, setPendingQrUri] = useState<string | null>(null);
  const [qrNameInput, setQrNameInput] = useState('');
  const [viewingQr, setViewingQr] = useState<UserPaymentQr | null>(null);

  useEffect(() => {
    loadProfile();
    loadTrip();
    if (user?.id) getUserPaymentQrs(user.id).then(setUserQrs).catch(() => {});
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
        await AsyncStorage.setItem(storageProfileKey(user.id), JSON.stringify(loaded));
        return;
      }
    }
    const raw = await AsyncStorage.getItem(storageProfileKey(user?.id));
    if (raw) {
      const parsed = JSON.parse(raw);
      setProfile({ ...DEFAULT_PROFILE, ...parsed });
    }
  };

  const loadTrip = async () => {
    const active = await getActiveTrip();
    setTrip(active);
  };

  const saveProfile = async (updated: ProfileState) => {
    setProfile(updated);
    await AsyncStorage.setItem(storageProfileKey(user?.id), JSON.stringify(updated));
    if (user?.id) {
      try {
        let avatarUrl = updated.avatarUri || undefined;
        if (updated.avatarUri && !updated.avatarUri.startsWith('http')) {
          const publicUrl = await uploadProfilePhoto(user.id, updated.avatarUri);
          avatarUrl = publicUrl;
          const synced = { ...updated, avatarUri: publicUrl };
          setProfile(synced);
          await AsyncStorage.setItem(storageProfileKey(user.id), JSON.stringify(synced));
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
        <View style={s.profileActionRow}>
          <TouchableOpacity style={s.profileActionButton} onPress={openEditProfile} activeOpacity={0.75}>
            <Camera size={15} color={colors.accent} strokeWidth={1.8} />
            <Text style={s.profileActionText}>Edit profile</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.profileActionButton, !user?.id && { opacity: 0.5 }]}
            onPress={() => {
              if (!user?.id) return;
              router.push({ pathname: '/profile/[userId]', params: { userId: user.id } } as never);
            }}
            activeOpacity={0.75}
            disabled={!user?.id}
          >
            <User size={15} color={colors.accent} strokeWidth={1.8} />
            <Text style={s.profileActionText}>View profile</Text>
          </TouchableOpacity>
        </View>

        {/* Profile completeness */}
        {(() => {
          const fields = [
            !!profile.name,
            !!profile.handle,
            !!profile.avatarUri,
            !!profile.phone,
            !!(profile.socials?.instagram || profile.socials?.tiktok || profile.socials?.x || profile.socials?.facebook),
          ];
          const filled = fields.filter(Boolean).length;
          const pct = Math.round((filled / fields.length) * 100);
          if (pct >= 100) return null;
          return (
            <View style={s.completenessCard}>
              <View style={s.completenessHeader}>
                <Text style={s.completenessTitle}>Complete your profile</Text>
                <Text style={s.completenessPct}>{pct}%</Text>
              </View>
              <View style={s.completenessBar}>
                <View style={[s.completenessFill, { width: `${pct}%` }]} />
              </View>
              <Text style={s.completenessSub}>
                {!profile.handle ? 'Set your AS handle' : !profile.avatarUri ? 'Add a profile photo' : !profile.phone ? 'Add your phone number' : 'Link a social account'}
              </Text>
            </View>
          );
        })()}

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

        {/* Payment QR Codes */}
        <SectionLabel label="Payment QR Codes" textColor={colors.text3} />
        <View style={s.card}>
          {userQrs.map((qr) => (
            <TouchableOpacity
              key={qr.id}
              style={styles.qrRow}
              onPress={() => setViewingQr(qr)}
              onLongPress={() => {
                Alert.alert('Remove QR?', `Remove "${qr.label}"?`, [
                  { text: 'Keep', style: 'cancel' },
                  {
                    text: 'Remove',
                    style: 'destructive',
                    onPress: async () => {
                      await removeUserPaymentQr(qr.id).catch(() => {});
                      setUserQrs(prev => prev.filter(q => q.id !== qr.id));
                    },
                  },
                ]);
              }}
              activeOpacity={0.7}
            >
              <Image source={{ uri: qr.uri }} style={styles.qrThumb} />
              <View style={{ flex: 1 }}>
                <Text style={s.cardTitle}>{qr.label}</Text>
                <Text style={s.cardSub}>Tap to view · long press to remove</Text>
              </View>
              <QrCode size={16} color={colors.accent} />
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={styles.qrAddRow}
            onPress={async () => {
              const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
              if (!result.canceled && result.assets[0]) {
                setPendingQrUri(result.assets[0].uri);
                setQrNameInput('');
                setShowQrNameModal(true);
              }
            }}
            activeOpacity={0.7}
          >
            <QrCode size={16} color={colors.accent} />
            <Text style={[s.cardTitle, { color: colors.accent }]}>
              {userQrs.length > 0 ? 'Add another QR' : 'Add payment QR'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* QR name modal */}
        <Modal visible={showQrNameModal} transparent animationType="fade">
          <Pressable style={styles.qrModalOverlay} onPress={() => setShowQrNameModal(false)}>
            <View style={[styles.qrModalCard, { backgroundColor: colors.card }]}>
              <Text style={[s.cardTitle, { fontSize: 16, marginBottom: 12 }]}>Name this QR</Text>
              <TextInput
                style={[styles.qrModalInput, { backgroundColor: colors.bg, borderColor: colors.border, color: colors.text }]}
                value={qrNameInput}
                onChangeText={setQrNameInput}
                placeholder="e.g. GCash, Maya, BPI"
                placeholderTextColor={colors.text3}
                autoFocus
              />
              <TouchableOpacity
                style={[styles.qrModalSaveBtn, { backgroundColor: colors.accent }]}
                onPress={async () => {
                  if (!pendingQrUri || !user?.id || !qrNameInput.trim()) return;
                  try {
                    const qr = await addUserPaymentQr(user.id, qrNameInput.trim(), pendingQrUri);
                    setUserQrs(prev => [...prev, qr]);
                    setShowQrNameModal(false);
                    setPendingQrUri(null);
                  } catch (err: any) {
                    Alert.alert('Upload failed', err?.message ?? 'Could not save QR code. Check your connection and try again.');
                  }
                }}
                activeOpacity={0.7}
              >
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Save</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Modal>

        {/* QR viewer modal */}
        <Modal visible={!!viewingQr} transparent animationType="fade">
          <Pressable style={styles.qrModalOverlay} onPress={() => setViewingQr(null)}>
            <View style={[styles.qrModalCard, { backgroundColor: colors.card, alignItems: 'center', padding: 24 }]}>
              <Text style={[s.cardTitle, { fontSize: 16 }]}>{viewingQr?.label}</Text>
              {viewingQr?.uri && (
                <Image source={{ uri: viewingQr.uri }} style={{ width: 240, height: 240, borderRadius: 12, marginTop: 12 }} />
              )}
              <Text style={{ color: colors.text3, fontSize: 12, marginTop: 12 }}>Scan to pay</Text>
            </View>
          </Pressable>
        </Modal>

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

        {/* App Updates */}
        <SectionLabel label="App Updates" textColor={colors.text3} />
        <View style={s.card}>
          <TouchableOpacity
            style={styles.updateRow}
            activeOpacity={0.7}
            disabled={updateStatus === 'checking' || updateStatus === 'downloading'}
            onPress={async () => {
              if (!Updates.isEnabled) {
                Alert.alert('Dev Mode', updateFailureMessage('Updates.isEnabled is false'));
                return;
              }
              if (!Updates.channel) {
                setUpdateStatus('error');
                Alert.alert('Update unavailable', updateFailureMessage('Updates.channel is null'));
                setTimeout(() => setUpdateStatus('idle'), 3000);
                return;
              }
              setUpdateStatus('checking');
              try {
                const check = await Updates.checkForUpdateAsync();
                if (!check.isAvailable) {
                  setUpdateStatus('up-to-date');
                  setTimeout(() => setUpdateStatus('idle'), 3000);
                  return;
                }
                setUpdateStatus('downloading');
                const result = await Updates.fetchUpdateAsync();
                if (result.isNew) {
                  await Updates.reloadAsync();
                } else {
                  setUpdateStatus('up-to-date');
                  setTimeout(() => setUpdateStatus('idle'), 3000);
                }
              } catch (err) {
                setUpdateStatus('error');
                Alert.alert('Update failed', updateFailureMessage(err));
                setTimeout(() => setUpdateStatus('idle'), 3000);
              }
            }}
          >
            {updateStatus === 'checking' || updateStatus === 'downloading' ? (
              <ActivityIndicator size="small" color={colors.accent} />
            ) : (
              <Download size={18} color={colors.accent} />
            )}
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <Text style={s.cardTitle}>
                {updateStatus === 'checking' ? 'Checking...'
                  : updateStatus === 'downloading' ? 'Downloading update...'
                  : updateStatus === 'up-to-date' ? 'Up to date ✓'
                  : updateStatus === 'error' ? 'Update failed'
                  : 'Check for Updates'}
              </Text>
              <Text style={s.cardSub}>
                {updateDiagnosticsText()}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* My Companions */}
        <SectionLabel label="My Companions" textColor={colors.text3} />
        <CompanionsSection colors={colors} />

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
            {shortUpdateId() ? ` · ${shortUpdateId()}` : ''}
          </Text>
        </View>

        {/* What's New */}
        <SectionLabel label="What's New" textColor={colors.text3} />
        <View style={s.card}>
          <TouchableOpacity
            style={styles.changelogHeader}
            onPress={() => setChangelogExpanded((prev) => !prev)}
            activeOpacity={0.72}
            accessibilityRole="button"
            accessibilityState={{ expanded: changelogExpanded }}
          >
            <View style={{ flex: 1 }}>
              <Text style={s.cardTitle}>v{Constants.expoConfig?.version ?? '?'} updates</Text>
              <Text style={s.cardSub}>{CHANGELOG[0].summary}</Text>
            </View>
            {changelogExpanded ? (
              <ChevronUp size={18} color={colors.text3} strokeWidth={1.8} />
            ) : (
              <ChevronDown size={18} color={colors.text3} strokeWidth={1.8} />
            )}
          </TouchableOpacity>

          {changelogExpanded ? (
            <View style={styles.changelogList}>
              {CHANGELOG.map((entry, entryIndex) => (
                <View
                  key={entry.title}
                  style={[
                    styles.changelogEntry,
                    entryIndex > 0 && { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth },
                  ]}
                >
                  <Text style={[styles.changelogTitle, { color: colors.text }]}>{entry.title}</Text>
                  <Text style={[styles.changelogSummary, { color: colors.text3 }]}>{entry.summary}</Text>
                  {entry.items.map((item) => (
                    <View key={item} style={styles.changelogItem}>
                      <Check size={12} color={colors.accent} strokeWidth={2} />
                      <Text style={[styles.changelogItemText, { color: colors.text2 }]}>{item}</Text>
                    </View>
                  ))}
                </View>
              ))}
            </View>
          ) : null}
        </View>

        {/* Test Notification */}
        {user?.email === 'peterkgumapac@gmail.com' && (
          <>
            <SectionLabel label="Notifications" textColor={colors.text3} />
            <TouchableOpacity
              style={s.card}
              activeOpacity={0.7}
              onPress={async () => {
                const Notifs = await import('expo-notifications');
                await Notifs.scheduleNotificationAsync({
                  content: {
                    title: 'AfterStay \u00B7 Trip Reminder',
                    body: 'Your Boracay trip memories are waiting! Tap to relive the moments.',
                    sound: 'default',
                  },
                  trigger: { seconds: 2, channelId: 'default' } as any,
                });
                Alert.alert('Sent', 'Test notification in 2 seconds');
              }}
            >
              <Bell size={18} color={colors.accent} />
              <Text style={s.cardTitle}>Send Test Notification</Text>
              <ChevronRight size={16} color={colors.text3} />
            </TouchableOpacity>
          </>
        )}

        {/* Dev Test Mode — only for peterkgumapac@gmail.com */}
        {user?.email === 'peterkgumapac@gmail.com' && <DevSegmentSection colors={colors} />}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView style={{ flex: 1, justifyContent: 'center' }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
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
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/* ---------- Sub-components ---------- */

function CompanionsSection({ colors }: { colors: Record<string, string> }) {
  const router = useRouter();
  const [companions, setCompanions] = React.useState<CompanionProfile[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const timeout = new Promise<CompanionProfile[]>((_, reject) => {
      timer = setTimeout(() => reject(new Error('Companions request timed out')), 8000);
    });
    setLoading(true);
    setLoadError(false);
    Promise.race([getCompanions(), timeout])
      .then((items) => {
        if (!cancelled) setCompanions(items);
        clearTimeout(timer);
        if (!cancelled) setLoading(false);
      }, () => {
        if (!cancelled) {
          setLoadError(true);
          setCompanions([]);
        }
        clearTimeout(timer);
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  const cardStyle = { backgroundColor: colors.card, borderRadius: 16, padding: 16 };

  if (loading) {
    return (
      <View style={[cardStyle, { alignItems: 'center', paddingVertical: 20 }]}>
        <ActivityIndicator size="small" color={colors.accent} />
      </View>
    );
  }

  if (companions.length === 0) {
    return (
      <View style={[cardStyle, { alignItems: 'center', paddingVertical: 16 }]}>
        <Text style={{ color: colors.text3, fontSize: 13, textAlign: 'center', lineHeight: 18 }}>
          {loadError
            ? 'Companions could not load right now.\nTry again after refreshing Settings.'
            : 'No companions yet.\nTravel together to connect automatically.'}
        </Text>
      </View>
    );
  }

  return (
    <View style={cardStyle}>
      {companions.map((c, i) => (
        <TouchableOpacity
          key={c.id}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            paddingVertical: 10,
            borderTopWidth: i > 0 ? 1 : 0,
            borderTopColor: colors.border,
          }}
          activeOpacity={0.7}
          onPress={() => router.push({ pathname: '/profile/[userId]', params: { userId: c.id } } as never)}
        >
          {c.avatarUrl ? (
            <Image
              source={{ uri: c.avatarUrl }}
              style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, borderColor: colors.accent }}
            />
          ) : (
            <View
              style={{
                width: 40, height: 40, borderRadius: 20,
                backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.accent,
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text2 }}>
                {c.fullName.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text, letterSpacing: -0.2 }}>
              {c.fullName}
            </Text>
            {c.handle ? (
              <Text style={{ fontSize: 11, color: colors.accent, marginTop: 1 }}>@{c.handle}</Text>
            ) : (
              <Text style={{ fontSize: 11, color: colors.text3, marginTop: 1 }}>Companion</Text>
            )}
          </View>
          <ChevronRight size={16} color={colors.text3} />
        </TouchableOpacity>
      ))}
    </View>
  );
}

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
    profileActionRow: {
      flexDirection: 'row',
      gap: 10,
      marginHorizontal: 16,
      marginTop: 10,
      marginBottom: 12,
    },
    profileActionButton: {
      flex: 1,
      minHeight: 42,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.bg2,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
    },
    profileActionText: {
      color: c.accent,
      fontSize: 13,
      fontWeight: '700',
    },

    // Profile completeness
    completenessCard: {
      marginHorizontal: 16, marginBottom: 12, padding: 14,
      backgroundColor: c.accentBg, borderRadius: 14, borderWidth: 1, borderColor: c.accentBorder,
    },
    completenessHeader: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    },
    completenessTitle: { fontSize: 13, fontWeight: '700', color: c.text },
    completenessPct: { fontSize: 12, fontWeight: '600', color: c.accent },
    completenessBar: {
      height: 4, backgroundColor: c.border, borderRadius: 2, marginTop: 8, overflow: 'hidden',
    },
    completenessFill: {
      height: 4, backgroundColor: c.accent, borderRadius: 2,
    },
    completenessSub: { fontSize: 11, color: c.text2, marginTop: 6 },

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
  // QR management
  qrRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  qrThumb: { width: 40, height: 40, borderRadius: 8 },
  qrAddRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 14,
  },
  qrModalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center',
  },
  qrModalCard: {
    width: '85%', borderRadius: 20, padding: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  qrModalInput: {
    borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15,
  },
  qrModalSaveBtn: {
    paddingVertical: 12, borderRadius: 12, alignItems: 'center', marginTop: 12,
  },
  updateRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 4,
  },
  changelogHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
  },
  changelogList: {
    marginTop: 14,
  },
  changelogEntry: {
    paddingTop: 12,
    paddingBottom: 2,
  },
  changelogTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 4,
  },
  changelogSummary: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 8,
  },
  changelogItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 7,
  },
  changelogItemText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
  },
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

/* ---------- Dev Panel (test mode) ---------- */

type ThemeColorsLocal = ReturnType<typeof useTheme>['colors'];

function DevSegmentSection({ colors }: { colors: ThemeColorsLocal }) {
  const { segment, isTestMode, refresh } = useUserSegment();
  const { user } = useAuth();
  const [override, setOverride] = useState<MockKey | null>(null);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    getSegmentOverride().then((val) => {
      setOverride(val);
      setEnabled(val !== null);
    });
  }, []);

  const handleToggle = async (on: boolean) => {
    setEnabled(on);
    if (!on) {
      await setSegmentOverride(null);
      setOverride(null);
      await refresh();
    } else if (!override) {
      await setSegmentOverride('new');
      setOverride('new');
      await refresh();
    }
  };

  const handleSelect = async (key: MockKey) => {
    await setSegmentOverride(key);
    setOverride(key);
    await refresh();
  };

  const handleClearCache = async () => {
    await AsyncStorage.clear();
    Alert.alert('Cache Cleared', 'All AsyncStorage data has been wiped. Restart the app.');
  };

  const handleResetOnboarding = async () => {
    const { cacheSet: cs } = await import('@/lib/cache');
    await Promise.all([
      cs(user?.id ? `onboarding_complete:${user.id}` : 'onboarding_complete', false),
      cs('onboarding_complete', false),
    ]);
    Alert.alert('Onboarding Reset', 'Next cold start will show the welcome flow.');
  };

  const handleForceRefresh = async () => {
    await refresh();
    Alert.alert('Refreshed', 'Segment context reloaded from server.');
  };

  return (
    <>
      <SectionLabel label="Developer" textColor="#c4554a" />

      {/* Master toggle */}
      <View style={{
        backgroundColor: colors.card,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: enabled ? '#c4554a' : colors.border,
        padding: 16,
        gap: 14,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>
              Test Mode
            </Text>
            <Text style={{ fontSize: 11, color: colors.text3, marginTop: 2 }}>
              Override user segment with mock data
            </Text>
          </View>
          <Switch
            value={enabled}
            onValueChange={handleToggle}
            trackColor={{ false: colors.border, true: '#c4554a' }}
            thumbColor="#fff"
          />
        </View>

        {enabled && (
          <>
            {/* Current real segment info */}
            <View style={{
              backgroundColor: colors.bg2,
              borderRadius: radius.sm,
              padding: 10,
            }}>
              <Text style={{ fontSize: 10, fontWeight: '600', color: colors.text3, textTransform: 'uppercase', letterSpacing: 1 }}>
                Real segment
              </Text>
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.accent, marginTop: 2 }}>
                {segment}{isTestMode ? ` (showing: ${override})` : ''}
              </Text>
            </View>

            {/* Segment picker */}
            <Text style={{ fontSize: 11, fontWeight: '600', color: colors.text2, textTransform: 'uppercase', letterSpacing: 1 }}>
              Simulate as
            </Text>
            <View style={{ gap: 8 }}>
              {MOCK_KEYS.map((key) => {
                const active = override === key;
                const isSubPhase = key.startsWith('active:');
                return (
                  <TouchableOpacity
                    key={key}
                    onPress={() => handleSelect(key)}
                    activeOpacity={0.7}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      padding: 12,
                      paddingLeft: isSubPhase ? 24 : 12,
                      borderRadius: radius.sm,
                      backgroundColor: active ? '#c4554a' : colors.card2,
                      borderWidth: 1,
                      borderColor: active ? '#c4554a' : colors.border,
                      gap: 10,
                    }}
                  >
                    <View style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: active ? '#fff' : isSubPhase ? colors.accent : colors.text3,
                    }} />
                    <View style={{ flex: 1 }}>
                      <Text style={{
                        fontSize: 13,
                        fontWeight: '700',
                        color: active ? '#fff' : colors.text,
                      }}>
                        {MOCK_LABELS[key]}
                      </Text>
                      <Text style={{
                        fontSize: 11,
                        color: active ? 'rgba(255,255,255,0.7)' : colors.text3,
                        marginTop: 1,
                      }}>
                        {MOCK_DESCRIPTIONS[key]}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}
      </View>

      {/* Dev tools */}
      <View style={{
        backgroundColor: colors.card,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.border,
        padding: 16,
        gap: 10,
        marginTop: 12,
      }}>
        <Text style={{ fontSize: 11, fontWeight: '600', color: colors.text2, textTransform: 'uppercase', letterSpacing: 1 }}>
          Dev Tools
        </Text>
        <TouchableOpacity onPress={handleForceRefresh} activeOpacity={0.7}
          style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>Force Refresh Segment</Text>
          <Text style={{ fontSize: 11, color: colors.text3 }}>Re-derive segment from Supabase</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleResetOnboarding} activeOpacity={0.7}
          style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>Reset Onboarding</Text>
          <Text style={{ fontSize: 11, color: colors.text3 }}>Show welcome slides on next launch</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleClearCache} activeOpacity={0.7}
          style={{ paddingVertical: 10 }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: colors.danger }}>Clear All Cache</Text>
          <Text style={{ fontSize: 11, color: colors.text3 }}>Wipe AsyncStorage (requires restart)</Text>
        </TouchableOpacity>
      </View>
    </>
  );
}
