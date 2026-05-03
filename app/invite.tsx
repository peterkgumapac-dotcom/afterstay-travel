import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { Copy, Mail, MessageCircle, Send, Users } from 'lucide-react-native';
import QRCode from 'react-native-qrcode-svg';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '@/constants/ThemeContext';
import { radius, spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { buildInviteWebLink, buildTripInviteMessage } from '@/lib/inviteLinks';
import { createInviteCode, getActiveTrip, getGroupMembers, getInvites, getOrCreateInviteCode, type TripInvite } from '@/lib/supabase';
import { canManageTripMembers } from '@/lib/tripPermissions';

export default function InviteScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const router = useRouter();
  const { user } = useAuth();

  const [code, setCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [tripName, setTripName] = useState('');
  const [history, setHistory] = useState<TripInvite[]>([]);
  const [emailRecipient, setEmailRecipient] = useState('');
  const [accessState, setAccessState] = useState<'checking' | 'ready' | 'no-trip' | 'blocked'>('checking');

  const generateCode = useCallback(async (forceNew = false) => {
    setLoading(true);
    try {
      const trip = await getActiveTrip();
      if (!trip) {
        setCode(null);
        setAccessState('no-trip');
        return;
      }
      setTripName(trip.destination || trip.name);
      const members = await getGroupMembers(trip.id);
      if (!canManageTripMembers(trip, members, user?.id)) {
        setCode(null);
        setHistory([]);
        setAccessState('blocked');
        return;
      }
      setAccessState('ready');
      const newCode = forceNew ? await createInviteCode(trip.id) : await getOrCreateInviteCode(trip.id);
      setCode(newCode);
      // Refresh history after generating
      const invites = await getInvites(trip.id);
      setHistory(invites);
      if (forceNew) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to create invite');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // Auto-generate code on mount
  useEffect(() => { generateCode(); }, [generateCode]);

  const qrLink = code ? buildInviteWebLink(code) : '';
  const shareMessage = code
    ? buildTripInviteMessage({ code, tripName, senderPrefix: 'my' })
    : '';

  const handleShare = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await Share.share({ message: shareMessage });
  };

  const handleMessenger = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await Share.share({ message: shareMessage });
  };

  const handleEmail = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!code) return;
    const recipient = emailRecipient.trim();
    if (recipient && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
      Alert.alert('Check the email', 'Enter a valid email address, or leave it blank to choose someone in your mail app.');
      return;
    }

    const subject = encodeURIComponent(`Join my trip to ${tripName} on AfterStay`);
    const body = encodeURIComponent(`Hey!\n\n${shareMessage}\n\nSee you there!`);
    const mailUrl = `mailto:${recipient ? encodeURIComponent(recipient) : ''}?subject=${subject}&body=${body}`;
    try {
      const canOpen = await Linking.canOpenURL(mailUrl);
      if (canOpen) {
        await Linking.openURL(mailUrl);
      } else {
        await Share.share({ message: shareMessage });
      }
    } catch {
      await Share.share({ message: shareMessage });
    }
  };

  const handleCopy = async () => {
    if (!code) return;
    await Clipboard.setStringAsync(shareMessage);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Copied!', 'Invite link and code copied to clipboard.');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={[styles.iconCircle, { backgroundColor: colors.accentBg }]}>
            <Users size={28} color={colors.accent} strokeWidth={1.8} />
          </View>
          <Text style={styles.title}>Invite to trip</Text>
          <Text style={styles.subtitle}>
            Share a code with your travel group. They'll join your trip when they sign in.
          </Text>
        </View>

        {accessState === 'no-trip' ? (
          <View style={styles.noticeCard}>
            <Text style={styles.noticeTitle}>No active trip yet</Text>
            <Text style={styles.noticeText}>Create or select a trip before inviting travel companions.</Text>
          </View>
        ) : accessState === 'blocked' ? (
          <View style={styles.noticeCard}>
            <Text style={styles.noticeTitle}>Organizer access needed</Text>
            <Text style={styles.noticeText}>
              Only the trip organizer can generate invite codes and add new companions.
            </Text>
          </View>
        ) : !code ? (
          <Pressable
            style={({ pressed }) => [styles.generateBtn, pressed && { opacity: 0.8 }]}
            onPress={() => generateCode()}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.ink} />
            ) : (
              <Text style={styles.generateText}>Generate invite code</Text>
            )}
          </Pressable>
        ) : (
          <>
            {/* Code display */}
            <View style={styles.codeCard}>
              <Text style={styles.codeLabel}>INVITE CODE</Text>
              <Text style={styles.codeText}>{code}</Text>
              <Text style={styles.codeExpiry}>Expires in 7 days</Text>
            </View>

            {/* QR code */}
            <View style={styles.qrWrap}>
              <QRCode
                value={qrLink}
                size={160}
                backgroundColor="transparent"
                color={colors.text}
              />
              <Text style={styles.qrHint}>Scan to open the invite</Text>
              <Text style={styles.qrLink} numberOfLines={1}>{qrLink}</Text>
            </View>

            <View style={styles.emailCard}>
              <Text style={styles.emailLabel}>EMAIL INVITE</Text>
              <TextInput
                value={emailRecipient}
                onChangeText={setEmailRecipient}
                placeholder="friend@example.com"
                placeholderTextColor={colors.text3}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="emailAddress"
                style={styles.emailInput}
              />
              <Text style={styles.emailHint}>
                Optional. Leave blank to choose someone in your email app.
              </Text>
            </View>

            {/* Share actions */}
            <View style={styles.actions}>
              <Pressable style={styles.actionBtn} onPress={handleShare}>
                <Send size={18} color={colors.accent} strokeWidth={1.8} />
                <Text style={styles.actionText}>Share link</Text>
              </Pressable>

              <Pressable style={styles.actionBtn} onPress={handleMessenger}>
                <MessageCircle size={18} color={colors.accent} strokeWidth={1.8} />
                <Text style={styles.actionText}>Share via Messenger</Text>
              </Pressable>

              <Pressable style={styles.actionBtn} onPress={handleEmail}>
                <Mail size={18} color={colors.accent} strokeWidth={1.8} />
                <Text style={styles.actionText}>Send email invite</Text>
              </Pressable>

              <Pressable style={styles.actionBtn} onPress={handleCopy}>
                <Copy size={18} color={colors.accent} strokeWidth={1.8} />
                <Text style={styles.actionText}>Copy invite link</Text>
              </Pressable>
            </View>

            {/* New code */}
            <Pressable onPress={() => generateCode(true)} style={styles.newCodeBtn}>
              <Text style={styles.newCodeText}>Generate new code</Text>
            </Pressable>

            {/* Invite history */}
            {history.length > 1 && (
              <View style={styles.historySection}>
                <Text style={styles.historyTitle}>Previous invites</Text>
                {history.slice(1).map((inv) => {
                  const expired = new Date(inv.expiresAt) < new Date();
                  const status = expired ? 'Expired' : 'Active';
                  const statusColor = expired ? colors.danger : colors.accent;
                  return (
                    <View key={inv.id} style={styles.historyRow}>
                      <Text style={styles.historyCode}>{inv.code}</Text>
                      <Text style={[styles.historyStatus, { color: statusColor }]}>{status}</Text>
                    </View>
                  );
                })}
              </View>
            )}
          </>
        )}

        <Pressable onPress={() => router.back()} style={styles.closeBtn}>
          <Text style={styles.closeText}>Close</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (colors: ReturnType<typeof import('@/constants/ThemeContext').useTheme>['colors']) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    content: {
      padding: spacing.xl,
      paddingTop: 40,
      paddingBottom: 40,
      gap: spacing.xl,
    },
    header: { alignItems: 'center', gap: spacing.sm },
    iconCircle: {
      width: 64,
      height: 64,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.sm,
    },
    title: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.text,
      letterSpacing: -0.3,
    },
    subtitle: {
      fontSize: 13,
      color: colors.text3,
      textAlign: 'center',
      lineHeight: 18,
      maxWidth: 280,
    },

    // Generate button
    generateBtn: {
      backgroundColor: colors.accent,
      paddingVertical: 16,
      borderRadius: radius.md,
      alignItems: 'center',
    },
    generateText: { fontSize: 15, fontWeight: '700', color: colors.ink },
    noticeCard: {
      padding: spacing.xl,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.lg,
      gap: spacing.sm,
    },
    noticeTitle: {
      fontSize: 17,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
    },
    noticeText: {
      fontSize: 13,
      color: colors.text3,
      textAlign: 'center',
      lineHeight: 19,
    },

    // Code display
    codeCard: {
      alignItems: 'center',
      padding: spacing.xl,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.lg,
      gap: spacing.sm,
    },
    codeLabel: {
      fontSize: 10,
      fontWeight: '700',
      color: colors.text3,
      letterSpacing: 1.5,
    },
    codeText: {
      fontFamily: 'SpaceMono',
      fontSize: 32,
      fontWeight: '700',
      color: colors.accent,
      letterSpacing: 4,
    },
    codeExpiry: {
      fontSize: 11,
      color: colors.text3,
    },

    // QR code
    qrWrap: {
      alignItems: 'center',
      padding: spacing.xl,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.lg,
      gap: spacing.sm,
    },
    qrHint: {
      fontSize: 11,
      color: colors.text3,
      fontWeight: '600',
      marginTop: spacing.xs,
    },
    qrLink: {
      maxWidth: 250,
      fontSize: 11,
      color: colors.text2,
      fontWeight: '600',
    },

    // Email invite
    emailCard: {
      padding: spacing.lg,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      gap: spacing.sm,
    },
    emailLabel: {
      fontSize: 10,
      fontWeight: '700',
      color: colors.text3,
      letterSpacing: 1.4,
    },
    emailInput: {
      minHeight: 46,
      paddingHorizontal: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.sm,
      color: colors.text,
      fontSize: 15,
      fontWeight: '600',
      backgroundColor: colors.bg,
    },
    emailHint: {
      fontSize: 11,
      color: colors.text3,
      lineHeight: 16,
    },

    // Actions
    actions: { gap: spacing.sm },
    actionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      padding: spacing.lg,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
    },
    actionText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },

    // New code
    newCodeBtn: { alignItems: 'center', padding: spacing.sm },
    newCodeText: { fontSize: 12, color: colors.text3, fontWeight: '600' },

    // History
    historySection: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: spacing.lg,
      gap: spacing.sm,
    },
    historyTitle: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.text3,
      letterSpacing: 1.2,
      textTransform: 'uppercase',
      marginBottom: spacing.xs,
    },
    historyRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: spacing.sm,
    },
    historyCode: {
      fontFamily: 'SpaceMono',
      fontSize: 14,
      color: colors.text2,
      letterSpacing: 2,
    },
    historyStatus: {
      fontSize: 11,
      fontWeight: '600',
    },

    // Close
    closeBtn: { alignItems: 'center', padding: spacing.md },
    closeText: { fontSize: 14, color: colors.text2 },
  });
