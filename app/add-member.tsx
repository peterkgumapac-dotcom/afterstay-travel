import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import FormField from '@/components/FormField';
import { useTheme } from '@/constants/ThemeContext';
import { radius, spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { buildTripInviteMessage } from '@/lib/inviteLinks';
import { addGroupMember, getActiveTrip, getGroupMembers, getOrCreateInviteCode } from '@/lib/supabase';
import { canManageTripMembers } from '@/lib/tripPermissions';

export default function AddMemberScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const { user } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [accessState, setAccessState] = useState<'checking' | 'ready' | 'no-trip' | 'blocked'>('checking');

  const loadAccess = useCallback(async () => {
    try {
      const trip = await getActiveTrip();
      if (!trip) {
        setAccessState('no-trip');
        return;
      }
      const members = await getGroupMembers(trip.id);
      setAccessState(canManageTripMembers(trip, members, user?.id) ? 'ready' : 'blocked');
    } catch {
      setAccessState('blocked');
    }
  }, [user?.id]);

  useEffect(() => {
    void loadAccess();
  }, [loadAccess]);

  const sendInvite = async (targetEmail?: string, targetPhone?: string) => {
    const trip = await getActiveTrip();
    if (!trip) return Alert.alert('No active trip', 'Create or select a trip before inviting members.');
    const members = await getGroupMembers(trip.id);
    if (!canManageTripMembers(trip, members, user?.id)) {
      return Alert.alert('Organizer access needed', 'Only the trip organizer can invite members.');
    }
    const inviteCode = await getOrCreateInviteCode(trip.id);
    const message = buildTripInviteMessage({
      code: inviteCode,
      tripName: trip.destination || trip.name,
      senderPrefix: 'my',
    });

    try {
      if (targetPhone) {
        await Linking.openURL(`sms:${encodeURIComponent(targetPhone)}?body=${encodeURIComponent(message)}`);
      } else if (targetEmail) {
        await Linking.openURL(
          `mailto:${encodeURIComponent(targetEmail)}?subject=${encodeURIComponent('Join our trip on AfterStay')}&body=${encodeURIComponent(message)}`,
        );
      } else {
        await Share.share({ message });
      }
    } catch {
      await Share.share({ message });
    }
  };

  const save = async () => {
    if (accessState === 'checking') return;
    if (accessState === 'no-trip') {
      return Alert.alert('No active trip', 'Create or select a trip before adding members.');
    }
    if (accessState === 'blocked') {
      return Alert.alert('Organizer access needed', 'Only the trip organizer can add or invite members.');
    }
    if (!name.trim()) return Alert.alert('Name is required');
    const trimmedEmail = email.trim();
    const trimmedPhone = phone.trim();
    if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      return Alert.alert('Invalid email', 'Please enter a valid email address.');
    }
    if (trimmedPhone && !/^\+?[\d\s\-()]{7,}$/.test(trimmedPhone)) {
      return Alert.alert('Invalid phone', 'Please enter a valid phone number.');
    }
    setSubmitting(true);
    try {
      await addGroupMember({
        name: name.trim(),
        email: trimmedEmail || undefined,
        phone: trimmedPhone || undefined,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        'Member added',
        trimmedEmail || trimmedPhone
          ? 'Send them an invite code now so they can join with their own account.'
          : 'They are on the trip list. You can share an invite code next.',
        [
          { text: 'Later', style: 'cancel', onPress: () => router.back() },
          {
            text: 'Send invite',
            onPress: () => {
              void sendInvite(trimmedEmail || undefined, trimmedPhone || undefined)
                .then(() => router.back(), () => router.back());
            },
          },
        ],
      );
    } catch (e: any) {
      Alert.alert('Failed to add member', e?.message ?? 'Unknown error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.safe}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Add or invite member</Text>
        <Text style={styles.subtitle}>Add someone to the trip, then send them a code to join with their own account.</Text>

        {accessState === 'no-trip' && (
          <View style={styles.noticeCard}>
            <Text style={styles.noticeTitle}>No active trip yet</Text>
            <Text style={styles.noticeText}>Create or select a trip before adding companions.</Text>
          </View>
        )}

        {accessState === 'blocked' && (
          <View style={styles.noticeCard}>
            <Text style={styles.noticeTitle}>Organizer access needed</Text>
            <Text style={styles.noticeText}>Ask the trip organizer to add companions or send an invite code.</Text>
          </View>
        )}

        <FormField
          label="Name"
          placeholder="e.g. Jane Doe"
          value={name}
          onChangeText={setName}
          autoFocus
          editable={accessState === 'ready'}
        />
        <FormField
          label="Email (optional)"
          placeholder="jane@example.com"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          editable={accessState === 'ready'}
        />
        <FormField
          label="Phone (optional)"
          placeholder="+63 912 345 6789"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          editable={accessState === 'ready'}
        />

        <Pressable
          style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.8 }]}
          onPress={save}
          disabled={submitting || accessState !== 'ready'}
        >
          {submitting || accessState === 'checking' ? (
            <ActivityIndicator color={colors.ink} />
          ) : (
            <Text style={styles.saveText}>Add member</Text>
          )}
        </Pressable>

        <Pressable onPress={() => router.back()} style={styles.cancelBtn}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const getStyles = (colors: ReturnType<typeof import('@/constants/ThemeContext').useTheme>['colors']) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxxl },
    title: { fontSize: 22, fontWeight: '700', color: colors.text, letterSpacing: -0.3 },
    subtitle: { fontSize: 13, color: colors.text3, marginTop: -spacing.sm },
    noticeCard: {
      padding: spacing.lg,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      gap: spacing.xs,
    },
    noticeTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
    noticeText: { fontSize: 13, lineHeight: 18, color: colors.text3 },
    saveBtn: {
      backgroundColor: colors.accent,
      paddingVertical: 14,
      borderRadius: radius.md,
      alignItems: 'center',
      marginTop: spacing.md,
    },
    saveText: { fontWeight: '700', fontSize: 15, color: colors.ink },
    cancelBtn: { alignItems: 'center', paddingVertical: spacing.md },
    cancelText: { fontSize: 14, color: colors.text2 },
  });
