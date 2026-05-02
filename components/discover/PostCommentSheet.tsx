import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Send, X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { PAPER } from '@/components/feed/feedTheme';
import { getPostComments, addPostComment } from '@/lib/supabase';
import type { FeedPostComment } from '@/lib/types';

interface PostCommentSheetProps {
  visible: boolean;
  postId: string;
  onClose: () => void;
  onCommentAdded?: (comment: FeedPostComment) => void;
}

function timeSince(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}

export default function PostCommentSheet({ visible, postId, onClose, onCommentAdded }: PostCommentSheetProps) {
  const [comments, setComments] = useState<FeedPostComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<TextInput>(null);

  const loadComments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const nextComments = await getPostComments(postId);
      setComments(nextComments);
    } catch (err) {
      setComments([]);
      setError(err instanceof Error ? err.message : 'Comments did not load. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    if (!visible) return;
    loadComments();
  }, [visible, loadComments]);

  const handleSend = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    setSending(true);
    setError(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const comment = await addPostComment(postId, trimmed);
      setComments((prev) => [...prev, comment]);
      setText('');
      onCommentAdded?.(comment);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Comment did not send. Please try again.');
    } finally {
      setSending(false);
    }
  }, [text, sending, postId, onCommentAdded]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableOpacity style={styles.backdrop} onPress={onClose} activeOpacity={1} />

        <SafeAreaView style={styles.sheet} edges={['bottom']}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Comments</Text>
            <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
              <X size={22} color={PAPER.inkDark} strokeWidth={2} />
            </TouchableOpacity>
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
              {!sending && (
                <TouchableOpacity onPress={loadComments} activeOpacity={0.75}>
                  <Text style={styles.retryText}>Retry</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : null}

          {/* Comment list */}
          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={PAPER.stamp} />
            </View>
          ) : (
            <FlatList
              data={comments}
              keyExtractor={(c) => c.id}
              style={styles.list}
              contentContainerStyle={comments.length === 0 ? styles.emptyList : undefined}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <View style={styles.emptyWrap}>
                  <Text style={styles.emptyText}>No comments yet. Be the first!</Text>
                </View>
              }
              renderItem={({ item }) => (
                <View style={styles.commentRow}>
                  {item.userAvatar ? (
                    <Image source={{ uri: item.userAvatar }} style={styles.commentAvatar} contentFit="cover" />
                  ) : (
                    <View style={[styles.commentAvatar, styles.commentAvatarPlaceholder]}>
                      <Text style={styles.commentAvatarLetter}>
                        {(item.userName || 'T')[0].toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View style={styles.commentBody}>
                    <Text style={styles.commentName}>
                      {item.userName}{' '}
                      <Text style={styles.commentTime}>{timeSince(item.createdAt)}</Text>
                    </Text>
                    <Text style={styles.commentText}>{item.text}</Text>
                  </View>
                </View>
              )}
            />
          )}

          {/* Input */}
          <View style={styles.inputRow}>
            <TextInput
              ref={inputRef}
              style={styles.input}
              placeholder="Add a comment..."
              placeholderTextColor={PAPER.inkLight}
              value={text}
              onChangeText={setText}
              maxLength={500}
              multiline
              textAlignVertical="top"
              returnKeyType="send"
              onSubmitEditing={handleSend}
            />
            <TouchableOpacity
              style={[styles.sendBtn, (!text.trim() || sending) && styles.sendBtnDisabled]}
              onPress={handleSend}
              disabled={!text.trim() || sending}
              activeOpacity={0.7}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Send size={16} color="#fff" strokeWidth={2} />
              )}
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { flex: 1, backgroundColor: 'rgba(26,18,10,0.28)' },
  sheet: {
    backgroundColor: PAPER.ivoryClean,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '82%',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: PAPER.rule,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: PAPER.rule,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: PAPER.inkDark,
  },
  list: { flex: 1 },
  emptyList: { flex: 1, justifyContent: 'center' },
  loadingWrap: { paddingVertical: 40, alignItems: 'center' },
  emptyWrap: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 14, color: PAPER.inkLight },
  errorBox: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#fff8ed',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PAPER.rule,
  },
  errorText: {
    color: PAPER.inkDark,
    fontSize: 13,
    lineHeight: 18,
  },
  retryText: {
    color: PAPER.stamp,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 6,
  },

  // Comment row
  commentRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  commentAvatar: { width: 36, height: 36, borderRadius: 18 },
  commentAvatarPlaceholder: {
    backgroundColor: PAPER.postcardEdge,
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentAvatarLetter: { color: PAPER.postcardInk, fontSize: 14, fontWeight: '700' },
  commentBody: { flex: 1, minWidth: 0 },
  commentName: { fontSize: 14, fontWeight: '700', color: PAPER.inkDark },
  commentTime: { fontSize: 12, fontWeight: '500', color: PAPER.inkLight },
  commentText: { fontSize: 15, color: PAPER.inkDark, lineHeight: 22, marginTop: 3 },

  // Input
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: PAPER.rule,
    backgroundColor: PAPER.ivoryClean,
  },
  input: {
    flex: 1,
    backgroundColor: '#fffaf0',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    lineHeight: 20,
    color: PAPER.inkDark,
    minHeight: 42,
    maxHeight: 96,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PAPER.rule,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: PAPER.stamp,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.4 },
});
