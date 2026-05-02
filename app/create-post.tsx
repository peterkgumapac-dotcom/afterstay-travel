import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, MapPin, Send } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { useTheme } from '@/constants/ThemeContext';
import { createFeedPost } from '@/lib/supabase';
import { FEED } from '@/components/feed/feedTheme';

const MAX_CHARS = 280;

export default function CreatePostScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [text, setText] = useState('');
  const [location, setLocation] = useState('');
  const [posting, setPosting] = useState(false);

  const charsLeft = MAX_CHARS - text.length;

  const handlePost = async () => {
    if (!text.trim()) return;
    setPosting(true);
    try {
      await createFeedPost({
        type: 'text',
        caption: text.trim(),
        locationName: location.trim() || undefined,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (err) {
      Alert.alert('Error', 'Failed to post. Try again.');
    } finally {
      setPosting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <X size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>New Post</Text>
        <TouchableOpacity
          onPress={handlePost}
          disabled={!text.trim() || posting}
          style={[styles.postBtn, (!text.trim() || posting) && { opacity: 0.4 }]}
          activeOpacity={0.7}
        >
          <Send size={16} color="#fff" strokeWidth={2} />
          <Text style={styles.postBtnText}>{posting ? 'Posting...' : 'Post'}</Text>
        </TouchableOpacity>
      </View>

      {/* Text input */}
      <View style={styles.inputWrap}>
        <TextInput
          style={[styles.textInput, { color: colors.text }]}
          placeholder="What's on your mind?"
          placeholderTextColor={colors.text3}
          multiline
          maxLength={MAX_CHARS}
          value={text}
          onChangeText={setText}
          autoFocus
          textAlignVertical="top"
        />
        <Text style={[styles.charCount, charsLeft < 20 && { color: FEED.terracotta }]}>
          {charsLeft}
        </Text>
      </View>

      {/* Location (optional) */}
      <View style={[styles.locationRow, { borderTopColor: colors.border }]}>
        <MapPin size={16} color={colors.text3} strokeWidth={1.8} />
        <TextInput
          style={[styles.locationInput, { color: colors.text }]}
          placeholder="Add location (optional)"
          placeholderTextColor={colors.text3}
          value={location}
          onChangeText={setLocation}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: FEED.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  postBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: FEED.terracotta,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  postBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  inputWrap: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  textInput: {
    flex: 1,
    fontSize: 17,
    lineHeight: 24,
  },
  charCount: {
    fontSize: 12,
    color: FEED.inkLight,
    textAlign: 'right',
    marginTop: 8,
    marginBottom: 12,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  locationInput: {
    flex: 1,
    fontSize: 14,
  },
});
