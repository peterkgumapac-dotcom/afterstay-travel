import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MessageCircle, Send, Trash2, X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { spacing, radius } from '@/constants/theme';
import { useTheme } from '@/constants/ThemeContext';
import { useAuth } from '@/lib/auth';
import { addComment, deleteComment, getComments } from '@/lib/supabase';
import type { MomentComment, GroupMember } from '@/lib/types';

interface CommentSheetProps {
  visible: boolean;
  momentId: string;
  members?: GroupMember[];
  onClose: () => void;
  onCountChange?: (momentId: string, count: number) => void;
}

/** Render comment text with @mentions highlighted in accent color. */
function CommentText({ text, accentColor, textColor }: { text: string; accentColor: string; textColor: string }) {
  const parts = text.split(/(@\S+)/g);
  return (
    <Text style={{ fontSize: 14, color: textColor, lineHeight: 20, marginTop: 2 }}>
      {parts.map((part, i) =>
        part.startsWith('@') ? (
          <Text key={i} style={{ color: accentColor, fontWeight: '600' }}>{part}</Text>
        ) : (
          <Text key={i}>{part}</Text>
        ),
      )}
    </Text>
  );
}

export default function CommentSheet({ visible, momentId, members = [], onClose, onCountChange }: CommentSheetProps) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const s = getStyles(colors);

  const [comments, setComments] = useState<MomentComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const listRef = useRef<FlatList>(null);

  // @mention state
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionStart, setMentionStart] = useState(-1);

  const filteredMembers = mentionQuery.length > 0
    ? members.filter(m => m.name.toLowerCase().includes(mentionQuery) && m.userId !== user?.id)
    : mentionStart >= 0
      ? members.filter(m => m.userId !== user?.id)
      : [];

  const handleTextChange = (newText: string) => {
    setText(newText);
    const lastAt = newText.lastIndexOf('@');
    if (lastAt >= 0) {
      const after = newText.slice(lastAt + 1);
      if (!after.includes(' ') && !after.includes('\n')) {
        setMentionQuery(after.toLowerCase());
        setMentionStart(lastAt);
        return;
      }
    }
    setMentionQuery('');
    setMentionStart(-1);
  };

  const insertMention = (member: GroupMember) => {
    const before = text.slice(0, mentionStart);
    const after = text.slice(mentionStart + 1 + mentionQuery.length);
    setText(`${before}@${member.name} ${after}`);
    setMentionQuery('');
    setMentionStart(-1);
    inputRef.current?.focus();
  };

  const load = useCallback(async () => {
    if (!momentId) return;
    setLoading(true);
    try {
      const data = await getComments(momentId);
      setComments(data);
    } catch { /* best-effort */ }
    setLoading(false);
  }, [momentId]);

  useEffect(() => {
    if (visible && momentId) load();
  }, [visible, momentId, load]);

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    setSending(true);
    try {
      const newComment = await addComment(momentId, trimmed);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setComments(prev => [...prev, newComment]);
      setText('');
      setMentionQuery('');
      setMentionStart(-1);
      onCountChange?.(momentId, comments.length + 1);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (err) {
      Alert.alert('Failed', 'Could not post comment. Try again.');
    }
    setSending(false);
  };

  const handleDelete = (comment: MomentComment) => {
    Alert.alert('Delete comment?', `"${comment.text.slice(0, 40)}..."`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteComment(comment.id);
            setComments(prev => prev.filter(c => c.id !== comment.id));
            onCountChange?.(momentId, comments.length - 1);
          } catch { /* best-effort */ }
        },
      },
    ]);
  };

  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'now';
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    const days = Math.floor(hrs / 24);
    return `${days}d`;
  };

  const goToProfile = (userId?: string) => {
    if (!userId) return;
    onClose();
    setTimeout(() => router.push(`/profile/${userId}` as never), 300);
  };

  const renderComment = ({ item }: { item: MomentComment }) => {
    const isMine = item.userId === user?.id;
    return (
      <View style={s.commentRow}>
        <Pressable onPress={() => goToProfile(item.userId)}>
          {item.userAvatar ? (
            <Image source={{ uri: item.userAvatar }} style={s.commentAvatar} />
          ) : (
            <View style={[s.commentAvatar, s.commentAvatarFallback]}>
              <Text style={s.commentAvatarText}>
                {item.userName.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
        </Pressable>
        <View style={s.commentBody}>
          <View style={s.commentHeader}>
            <Pressable onPress={() => goToProfile(item.userId)}>
              <Text style={s.commentName}>{item.userName}</Text>
            </Pressable>
            <Text style={s.commentTime}>{timeAgo(item.createdAt)}</Text>
          </View>
          <CommentText text={item.text} accentColor={colors.accent} textColor={colors.text2} />
        </View>
        {isMine && (
          <TouchableOpacity
            style={s.deleteBtn}
            onPress={() => handleDelete(item)}
            hitSlop={8}
          >
            <Trash2 size={14} color={colors.text3} />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={s.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
      >
        <Pressable style={s.backdrop} onPress={onClose} />
        <SafeAreaView style={s.sheet} edges={['bottom']}>
          {/* Header */}
          <View style={s.header}>
            <MessageCircle size={18} color={colors.accent} strokeWidth={1.8} />
            <Text style={s.headerTitle}>
              Comments{comments.length > 0 ? ` · ${comments.length}` : ''}
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <X size={20} color={colors.text2} />
            </TouchableOpacity>
          </View>

          {/* Comment list */}
          {loading ? (
            <View style={s.center}>
              <ActivityIndicator color={colors.accent} />
            </View>
          ) : comments.length === 0 ? (
            <View style={s.center}>
              <MessageCircle size={32} color={colors.text3} strokeWidth={1.2} />
              <Text style={s.emptyText}>No comments yet</Text>
              <Text style={s.emptySub}>Be the first to comment on this moment.</Text>
            </View>
          ) : (
            <FlatList
              ref={listRef}
              data={comments}
              keyExtractor={c => c.id}
              renderItem={renderComment}
              contentContainerStyle={s.list}
              showsVerticalScrollIndicator={false}
            />
          )}

          {/* @Mention suggestion row */}
          {filteredMembers.length > 0 && (
            <View style={s.mentionBar}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="always">
                {filteredMembers.map(m => (
                  <TouchableOpacity
                    key={m.id}
                    style={s.mentionChip}
                    onPress={() => insertMention(m)}
                    activeOpacity={0.7}
                  >
                    {m.profilePhoto ? (
                      <Image source={{ uri: m.profilePhoto }} style={s.mentionAvatar} />
                    ) : (
                      <View style={[s.mentionAvatar, s.mentionAvatarFallback]}>
                        <Text style={s.mentionAvatarText}>{m.name.charAt(0)}</Text>
                      </View>
                    )}
                    <Text style={s.mentionName}>{m.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Input bar */}
          <View style={s.inputBar}>
            <TextInput
              ref={inputRef}
              style={s.input}
              placeholder="Add a comment..."
              placeholderTextColor={colors.text3}
              value={text}
              onChangeText={handleTextChange}
              maxLength={500}
              multiline
              returnKeyType="send"
              onSubmitEditing={handleSend}
              blurOnSubmit
            />
            <TouchableOpacity
              style={[s.sendBtn, (!text.trim() || sending) && s.sendBtnDisabled]}
              onPress={handleSend}
              disabled={!text.trim() || sending}
              activeOpacity={0.7}
            >
              {sending ? (
                <ActivityIndicator size="small" color={colors.canvas} />
              ) : (
                <Send size={16} color={text.trim() ? colors.canvas : colors.text3} />
              )}
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const getStyles = (colors: ReturnType<typeof useTheme>['colors']) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.5)',
    },
    sheet: {
      backgroundColor: colors.canvas,
      borderTopLeftRadius: 22,
      borderTopRightRadius: 22,
      maxHeight: '70%',
      minHeight: 300,
      borderWidth: 1,
      borderBottomWidth: 0,
      borderColor: colors.border,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTitle: {
      flex: 1,
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
      letterSpacing: -0.2,
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 40,
      gap: 8,
    },
    emptyText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text2,
      marginTop: 4,
    },
    emptySub: {
      fontSize: 12,
      color: colors.text3,
    },
    list: {
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    commentRow: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 16,
      alignItems: 'flex-start',
    },
    commentAvatar: {
      width: 32,
      height: 32,
      borderRadius: 16,
    },
    commentAvatarFallback: {
      backgroundColor: colors.card,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    commentAvatarText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text2,
    },
    commentBody: {
      flex: 1,
    },
    commentHeader: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 8,
    },
    commentName: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
      letterSpacing: -0.2,
    },
    commentTime: {
      fontSize: 11,
      color: colors.text3,
    },
    deleteBtn: {
      padding: 4,
      marginTop: 2,
    },
    // @mention suggestion bar
    mentionBar: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: colors.bg2,
    },
    mentionChip: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderRadius: 20,
      paddingRight: 12,
      paddingLeft: 4,
      paddingVertical: 4,
      marginRight: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    mentionAvatar: {
      width: 24,
      height: 24,
      borderRadius: 12,
      marginRight: 6,
    },
    mentionAvatarFallback: {
      backgroundColor: colors.card2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    mentionAvatarText: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.accent,
    },
    mentionName: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
    },
    // Input bar
    inputBar: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 8,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.bg2,
    },
    input: {
      flex: 1,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 20,
      paddingHorizontal: 14,
      paddingVertical: 8,
      fontSize: 14,
      color: colors.text,
      maxHeight: 80,
    },
    sendBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sendBtnDisabled: {
      backgroundColor: colors.border,
    },
  });
