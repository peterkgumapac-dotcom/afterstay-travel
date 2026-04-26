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
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { Copy, Mail, MessageCircle, Send, Share2, Users } from 'lucide-react-native';
import QRCode from 'react-native-qrcode-svg';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '@/constants/ThemeContext';
import { radius, spacing } from '@/constants/theme';
import { createInviteCode, getActiveTrip, getInvites, type TripInvite } from '@/lib/supabase';

export default function InviteScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const router = useRouter();

  const [code, setCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [tripName, setTripName] = useState('');
  const [history, setHistory] = useState<TripInvite[]>([]);

  const generateCode = useCallback(async () => {
    setLoading(true);
    try {
      const trip = await getActiveTrip();
      if (!trip) { Alert.alert('No active trip'); setLoading(false); return; }
      setTripName(trip.destination || trip.name);
      const newCode = await createInviteCode(trip.id);
      setCode(newCode);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Refresh history after generating
      const invites = await getInvites(trip.id);
      setHistory(invites);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to create invite');
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-generate code on mount
  useEffect(() => { generateCode(); }, [generateCode]);

  const inviteLink = code ? `https://afterstay.travel/join/${code}` : '';
  const shareMessage = code
    ? `Join my trip to ${tripName} on AfterStay! Use invite code: ${code}\n\nOr open: ${inviteLink}`
    : '';

  const handleShare = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await Share.share({ message: shareMessage });
  };

  const handleMessenger = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const encoded = encodeURIComponent(inviteLink);
    // Try Facebook Messenger deep link first, fallback to web
    const messengerUrl = `fb-messenger://share?link=${encoded}`;
    const canOpen = await Linking.canOpenURL(messengerUrl);
    if (canOpen) {
      await Linking.openURL(messengerUrl);
    } else {
      // Fallback: use m.me share dialog or generic share
      const webFallback = `https://www.facebook.com/dialog/send?link=${encoded}&app_id=afterstay&redirect_uri=${encoded}`;
      const canOpenWeb = await Linking.canOpenURL(webFallback);
      if (canOpenWeb) {
        await Linking.openURL(webFallback);
      } else {
        // Final fallback: system share sheet
        await Share.share({ message: shareMessage });
      }
    }
  };

  const handleEmail = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const subject = encodeURIComponent(`Join my trip to ${tripName} on AfterStay`);
    const body = encodeURIComponent(
      `Hey!\n\nI'd love for you to join my trip to ${tripName} on AfterStay.\n\n` +
      `Use this invite code: ${code}\n\n` +
      `Or tap this link to join: ${inviteLink}\n\n` +
      `See you there!`
    );
    const mailUrl = `mailto:?subject=${subject}&body=${body}`;
    await Linking.openURL(mailUrl);
  };

  const handleCopy = async () => {
    if (!code) return;
    await Clipboard.setStringAsync(code);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Copied!', `Invite code ${code} copied to clipboard`);
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

        {!code ? (
          <Pressable
            style={({ pressed }) => [styles.generateBtn, pressed && { opacity: 0.8 }]}
            onPress={generateCode}
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
                value={inviteLink}
                size={160}
                backgroundColor="transparent"
                color={colors.text}
              />
              <Text style={styles.qrHint}>Scan to join</Text>
            </View>

            {/* Share actions */}
            <View style={styles.actions}>
              <Pressable style={styles.actionBtn} onPress={handleShare}>
                <Send size={18} color={colors.accent} strokeWidth={1.8} />
                <Text style={styles.actionText}>Share via SMS / WhatsApp</Text>
              </Pressable>

              <Pressable style={styles.actionBtn} onPress={handleMessenger}>
                <MessageCircle size={18} color={colors.accent} strokeWidth={1.8} />
                <Text style={styles.actionText}>Share via Messenger</Text>
              </Pressable>

              <Pressable style={styles.actionBtn} onPress={handleEmail}>
                <Mail size={18} color={colors.accent} strokeWidth={1.8} />
                <Text style={styles.actionText}>Share via Email</Text>
              </Pressable>

              <Pressable style={styles.actionBtn} onPress={handleCopy}>
                <Copy size={18} color={colors.accent} strokeWidth={1.8} />
                <Text style={styles.actionText}>Copy invite code</Text>
              </Pressable>
            </View>

            {/* New code */}
            <Pressable onPress={generateCode} style={styles.newCodeBtn}>
              <Text style={styles.newCodeText}>Generate new code</Text>
            </Pressable>

            {/* Invite history */}
            {history.length > 1 && (
              <View style={styles.historySection}>
                <Text style={styles.historyTitle}>Previous invites</Text>
                {history.slice(1).map((inv) => {
                  const expired = new Date(inv.expiresAt) < new Date();
                  const status = inv.used ? 'Used' : expired ? 'Expired' : 'Active';
                  const statusColor = inv.used ? colors.success : expired ? colors.danger : colors.accent;
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
