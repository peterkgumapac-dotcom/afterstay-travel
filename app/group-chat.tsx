import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { ArrowLeft, Send } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '@/constants/ThemeContext';
import { radius, spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import {
  getActiveTrip,
  getChatMessages,
  sendChatMessage,
  subscribeToChatMessages,
  type ChatMessage,
} from '@/lib/supabase';

export default function GroupChatScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const router = useRouter();
  const { user } = useAuth();
  const flatListRef = useRef<FlatList>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [tripId, setTripId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const myName = user?.user_metadata?.full_name
    ?? user?.email?.split('@')[0]
    ?? 'Me';

  // Load trip + messages
  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    (async () => {
      const trip = await getActiveTrip().catch(() => null);
      if (!trip) return;
      setTripId(trip.id);

      const existing = await getChatMessages(trip.id).catch(() => []);
      setMessages(existing);

      // Subscribe to new messages
      unsubscribe = subscribeToChatMessages(trip.id, (msg) => {
        setMessages((prev) => {
          // Deduplicate
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
      });
    })();

    return () => { unsubscribe?.(); };
  }, []);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (messages.length > 0) {
      const t = setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
      return () => clearTimeout(t);
    }
  }, [messages.length]);

  const handleSend = useCallback(async () => {
    if (!text.trim() || !tripId || sending) return;
    const msg = text.trim();
    setText('');
    setSending(true);

    try {
      await sendChatMessage({
        tripId,
        senderName: myName,
        senderUserId: user?.id,
        message: msg,
      });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      // Put message back if send failed
      setText(msg);
    } finally {
      setSending(false);
    }
  }, [text, tripId, sending, myName]);

  const goToProfile = useCallback((userId?: string) => {
    if (!userId) return;
    router.push(`/profile/${userId}` as never);
  }, [router]);

  const renderMessage = useCallback(({ item }: { item: ChatMessage }) => {
    const isMe = item.senderName === myName;
    return (
      <View style={[styles.msgRow, isMe && styles.msgRowMe]}>
        {!isMe && (
          <Pressable onPress={() => goToProfile(item.senderUserId)} style={styles.avatar}>
            <Text style={styles.avatarText}>
              {item.senderName.charAt(0).toUpperCase()}
            </Text>
          </Pressable>
        )}
        <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleOther]}>
          {!isMe && (
            <Pressable onPress={() => goToProfile(item.senderUserId)}>
              <Text style={styles.senderName}>{item.senderName}</Text>
            </Pressable>
          )}
          <Text style={[styles.msgText, isMe && styles.msgTextMe]}>{item.message}</Text>
          <Text style={[styles.msgTime, isMe && styles.msgTimeMe]}>
            {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      </View>
    );
  }, [myName, styles]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <ArrowLeft size={22} color={colors.text} strokeWidth={1.8} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Group Chat</Text>
          <Text style={styles.headerSub}>{messages.length} messages</Text>
        </View>
        <View style={{ width: 22 }} />
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messageList}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No messages yet. Say hi!</Text>
          </View>
        }
      />

      {/* Input */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder="Type a message..."
            placeholderTextColor={colors.text3}
            multiline
            maxLength={500}
            returnKeyType="send"
            onSubmitEditing={handleSend}
            blurOnSubmit={false}
          />
          <Pressable
            onPress={handleSend}
            disabled={!text.trim() || sending}
            style={[styles.sendBtn, (!text.trim() || sending) && { opacity: 0.4 }]}
          >
            <Send size={18} color={colors.ink} strokeWidth={2} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const getStyles = (colors: ReturnType<typeof import('@/constants/ThemeContext').useTheme>['colors']) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },

    // Header
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerCenter: { flex: 1, alignItems: 'center' },
    headerTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
    headerSub: { fontSize: 11, color: colors.text3, marginTop: 1 },

    // Messages
    messageList: {
      padding: spacing.md,
      gap: spacing.sm,
      flexGrow: 1,
    },
    msgRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: spacing.sm,
      maxWidth: '85%',
    },
    msgRowMe: {
      alignSelf: 'flex-end',
      flexDirection: 'row-reverse',
    },
    avatar: {
      width: 28,
      height: 28,
      borderRadius: 999,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.ink,
    },
    bubble: {
      padding: spacing.md,
      borderRadius: radius.lg,
      maxWidth: '100%',
    },
    bubbleMe: {
      backgroundColor: colors.accent,
      borderBottomRightRadius: 4,
    },
    bubbleOther: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderBottomLeftRadius: 4,
    },
    senderName: {
      fontSize: 10,
      fontWeight: '700',
      color: colors.accent,
      marginBottom: 2,
    },
    msgText: {
      fontSize: 14,
      color: colors.text,
      lineHeight: 20,
    },
    msgTextMe: {
      color: colors.ink,
    },
    msgTime: {
      fontSize: 9,
      color: colors.text3,
      marginTop: 4,
      alignSelf: 'flex-end',
    },
    msgTimeMe: {
      color: colors.ink + '99',
    },

    // Empty
    empty: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: 100,
    },
    emptyText: { fontSize: 13, color: colors.text3 },

    // Input
    inputBar: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: spacing.sm,
      padding: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.bg,
    },
    input: {
      flex: 1,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.lg,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      fontSize: 14,
      color: colors.text,
      maxHeight: 100,
    },
    sendBtn: {
      width: 40,
      height: 40,
      borderRadius: 999,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
