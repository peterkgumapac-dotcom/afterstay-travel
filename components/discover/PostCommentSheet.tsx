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
import { getPostComments, addPostComment, searchProfiles } from '@/lib/supabase';
import type { FeedPostComment } from '@/lib/types';

interface PostCommentSheetProps {
  visible: boolean;
  postId: string;
  onClose: () => void;
  onCommentAdded?: (comment: FeedPostComment) => void;
}

type MentionSuggestion = {
  id: string;
  fullName: string;
  handle?: string;
  avatarUrl?: string;
};

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

function getActiveMention(value: string, cursor: number): { start: number; query: string } | null {
  const beforeCursor = value.slice(0, cursor);
  const match = beforeCursor.match(/(^|\s)@([A-Za-z0-9_.-]{0,30})$/);
  if (!match) return null;
  const query = match[2] ?? '';
  return {
    start: beforeCursor.length - query.length - 1,
    query,
  };
}

function renderCommentText(value: string) {
  const parts = value.split(/(@[A-Za-z0-9_.-]+)/g);
  return parts.map((part, index) => (
    <Text key={`${part}-${index}`} style={part.startsWith('@') ? styles.commentMention : undefined}>
      {part}
    </Text>
  ));
}

export default function PostCommentSheet({ visible, postId, onClose, onCommentAdded }: PostCommentSheetProps) {
  const [comments, setComments] = useState<FeedPostComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectionStart, setSelectionStart] = useState(0);
  const [mentionSuggestions, setMentionSuggestions] = useState<MentionSuggestion[]>([]);
  const mentionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<TextInput>(null);

  const clearMentionSuggestions = useCallback(() => {
    if (mentionTimer.current) {
      clearTimeout(mentionTimer.current);
      mentionTimer.current = null;
    }
    setMentionSuggestions([]);
  }, []);

  const updateMentionSearch = useCallback((value: string, cursor: number) => {
    if (mentionTimer.current) clearTimeout(mentionTimer.current);

    const activeMention = getActiveMention(value, cursor);
    if (!activeMention || activeMention.query.trim().length < 2) {
      setMentionSuggestions([]);
      return;
    }

    mentionTimer.current = setTimeout(async () => {
      try {
        const results = await searchProfiles(activeMention.query);
        setMentionSuggestions(results.slice(0, 5));
      } catch {
        setMentionSuggestions([]);
      }
    }, 250);
  }, []);

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
      clearMentionSuggestions();
      onCommentAdded?.(comment);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Comment did not send. Please try again.');
    } finally {
      setSending(false);
    }
  }, [text, sending, postId, onCommentAdded, clearMentionSuggestions]);

  const handleTextChange = useCallback((value: string) => {
    setText(value);
    const nextCursor = Math.min(selectionStart, value.length);
    updateMentionSearch(value, nextCursor || value.length);
  }, [selectionStart, updateMentionSearch]);

  const insertMention = useCallback((person: MentionSuggestion) => {
    const activeMention = getActiveMention(text, selectionStart);
    if (!activeMention) return;

    const label = `@${person.handle ?? person.fullName.split(/\s+/)[0]}`;
    const nextText = `${text.slice(0, activeMention.start)}${label} ${text.slice(selectionStart)}`;
    const nextCursor = activeMention.start + label.length + 1;
    setText(nextText);
    setSelectionStart(nextCursor);
    clearMentionSuggestions();
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [text, selectionStart, clearMentionSuggestions]);

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
                    <Text style={styles.commentText}>{renderCommentText(item.text)}</Text>
                  </View>
                </View>
              )}
            />
          )}

          {/* Input */}
          {mentionSuggestions.length > 0 && (
            <View style={styles.mentionPanel}>
              {mentionSuggestions.map((person) => (
                <TouchableOpacity
                  key={person.id}
                  style={styles.mentionRow}
                  onPress={() => insertMention(person)}
                  activeOpacity={0.75}
                >
                  {person.avatarUrl ? (
                    <Image source={{ uri: person.avatarUrl }} style={styles.mentionAvatar} contentFit="cover" />
                  ) : (
                    <View style={[styles.mentionAvatar, styles.mentionAvatarPlaceholder]}>
                      <Text style={styles.mentionInitial}>
                        {(person.fullName || person.handle || 'T')[0].toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View style={styles.mentionTextWrap}>
                    <Text style={styles.mentionName} numberOfLines={1}>{person.fullName}</Text>
                    {person.handle ? <Text style={styles.mentionHandle}>@{person.handle}</Text> : null}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
          <View style={styles.inputRow}>
            <TextInput
              ref={inputRef}
              style={styles.input}
              placeholder="Add a comment..."
              placeholderTextColor={PAPER.inkLight}
              value={text}
              onChangeText={handleTextChange}
              onSelectionChange={(event) => {
                const cursor = event.nativeEvent.selection.start;
                setSelectionStart(cursor);
                updateMentionSearch(text, cursor);
              }}
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
  backdrop: { flex: 1, backgroundColor: 'rgba(26,18,10,0.38)' },
  sheet: {
    backgroundColor: PAPER.ivoryClean,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '88%',
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
    paddingVertical: 10,
    gap: 12,
  },
  commentAvatar: { width: 36, height: 36, borderRadius: 18 },
  commentAvatarPlaceholder: {
    backgroundColor: PAPER.postcardEdge,
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentAvatarLetter: { color: PAPER.postcardInk, fontSize: 14, fontWeight: '700' },
  commentBody: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: '#fffaf0',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PAPER.rule,
  },
  commentName: { fontSize: 14, fontWeight: '700', color: PAPER.inkDark },
  commentTime: { fontSize: 12, fontWeight: '500', color: PAPER.inkLight },
  commentText: { fontSize: 15, color: PAPER.inkDark, lineHeight: 22, marginTop: 3 },
  commentMention: { color: PAPER.stamp, fontWeight: '700' },

  // Mentions
  mentionPanel: {
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 14,
    backgroundColor: '#fffaf0',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PAPER.rule,
    overflow: 'hidden',
  },
  mentionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  mentionAvatar: { width: 30, height: 30, borderRadius: 15 },
  mentionAvatarPlaceholder: {
    backgroundColor: PAPER.postcardEdge,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mentionInitial: { color: PAPER.postcardInk, fontSize: 12, fontWeight: '700' },
  mentionTextWrap: { flex: 1, minWidth: 0 },
  mentionName: { color: PAPER.inkDark, fontSize: 14, fontWeight: '700' },
  mentionHandle: { color: PAPER.inkLight, fontSize: 12, marginTop: 1 },

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
