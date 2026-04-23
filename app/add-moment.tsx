import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check, Plus, X, AlertCircle, Loader } from 'lucide-react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { useTheme } from '@/constants/ThemeContext';
import { radius, spacing } from '@/constants/theme';
import { placeAutocomplete } from '@/lib/google-places';
import { addMoment } from '@/lib/supabase';
import type { MomentTag } from '@/lib/types';

type PhotoStatus = 'pending' | 'uploading' | 'done' | 'error';

interface PhotoItem {
  uri: string;
  status: PhotoStatus;
}

const ALL_TAGS: readonly MomentTag[] = [
  'Beach', 'Food', 'Sunset', 'Group', 'Activity', 'Hotel', 'Scenery', 'Night',
];

export default function AddMomentScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const todayStr = new Date().toISOString().slice(0, 10);

  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [caption, setCaption] = useState('');
  const [location, setLocation] = useState('');
  const [tags, setTags] = useState<MomentTag[]>([]);
  const [takenBy, setTakenBy] = useState('');
  const [date, setDate] = useState(todayStr);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ done: 0, total: 0 });
  const [locationSuggestions, setLocationSuggestions] = useState<{ placeId: string; description: string }[]>([]);
  const locationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    pickImages();
  }, []);

  const pickImages = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.5,
      allowsMultipleSelection: true,
      selectionLimit: 20,
      exif: false,
    });

    if (result.canceled || result.assets.length === 0) {
      if (photos.length === 0) router.back();
      return;
    }

    const newPhotos: PhotoItem[] = result.assets.map((a) => ({
      uri: a.uri,
      status: 'pending' as const,
    }));
    setPhotos((prev) => [...prev, ...newPhotos]);
  };

  const removePhoto = (uri: string) => {
    setPhotos((prev) => prev.filter((p) => p.uri !== uri));
  };

  const toggleTag = (tag: MomentTag) => {
    setTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  const handleUploadAll = useCallback(async () => {
    if (photos.length === 0) return;
    setUploading(true);
    setUploadProgress({ done: 0, total: photos.length });

    let successCount = 0;
    const updatedPhotos = [...photos];

    for (let i = 0; i < updatedPhotos.length; i++) {
      const photo = updatedPhotos[i];
      if (photo.status === 'done') {
        successCount++;
        continue;
      }

      // Mark as uploading
      setPhotos((prev) =>
        prev.map((p) => p.uri === photo.uri ? { ...p, status: 'uploading' } : p),
      );

      try {
        await addMoment({
          caption: caption || 'Untitled',
          localUri: photo.uri,
          location: location || undefined,
          takenBy: takenBy || undefined,
          date,
          tags,
        });

        setPhotos((prev) =>
          prev.map((p) => p.uri === photo.uri ? { ...p, status: 'done' } : p),
        );
        successCount++;
      } catch {
        setPhotos((prev) =>
          prev.map((p) => p.uri === photo.uri ? { ...p, status: 'error' } : p),
        );
      }

      setUploadProgress({ done: successCount, total: photos.length });
    }

    setUploading(false);

    if (successCount === photos.length) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert(
        'Partial upload',
        `${successCount} of ${photos.length} uploaded. Tap "Upload" to retry failed ones.`,
      );
    }
  }, [photos, caption, location, tags, takenBy, date, router]);

  const renderPhoto = ({ item }: { item: PhotoItem }) => (
    <Animated.View entering={FadeIn.duration(200)} style={styles.photoThumb}>
      <Image source={{ uri: item.uri }} style={styles.photoImage} />
      {/* Status overlay */}
      {item.status === 'uploading' && (
        <View style={styles.photoOverlay}>
          <Loader size={18} color={colors.ink} strokeWidth={2} />
        </View>
      )}
      {item.status === 'done' && (
        <View style={[styles.photoOverlay, styles.photoOverlayDone]}>
          <Check size={18} color={colors.ink} strokeWidth={2.5} />
        </View>
      )}
      {item.status === 'error' && (
        <View style={[styles.photoOverlay, styles.photoOverlayError]}>
          <AlertCircle size={18} color={colors.danger} strokeWidth={2} />
        </View>
      )}
      {/* Remove button */}
      {item.status !== 'uploading' && item.status !== 'done' && (
        <Pressable
          style={styles.photoRemove}
          onPress={() => removePhoto(item.uri)}
          hitSlop={6}
        >
          <X size={12} color={colors.ink} strokeWidth={2.5} />
        </Pressable>
      )}
    </Animated.View>
  );

  if (photos.length === 0) {
    return (
      <SafeAreaView style={[styles.safe, styles.centered]}>
        <Text style={styles.emptyText}>Selecting photos...</Text>
      </SafeAreaView>
    );
  }

  const doneCount = photos.filter((p) => p.status === 'done').length;
  const errorCount = photos.filter((p) => p.status === 'error').length;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <FlatList
        data={[]}
        renderItem={null}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <>
            {/* Header */}
            <View style={styles.header}>
              <Pressable onPress={() => router.back()}>
                <Text style={styles.headerCancel}>Cancel</Text>
              </Pressable>
              <Text style={styles.headerTitle}>
                {photos.length} photo{photos.length !== 1 ? 's' : ''}
              </Text>
              <View style={{ width: 50 }} />
            </View>

            {/* Photo grid */}
            <View style={styles.photoGrid}>
              {photos.map((item) => (
                <View key={item.uri}>{renderPhoto({ item })}</View>
              ))}
              {/* Add more button */}
              <Pressable style={styles.addMoreBtn} onPress={pickImages}>
                <Plus size={20} color={colors.text3} strokeWidth={1.8} />
                <Text style={styles.addMoreText}>Add</Text>
              </Pressable>
            </View>

            {/* Progress bar */}
            {uploading && (
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${(uploadProgress.done / Math.max(uploadProgress.total, 1)) * 100}%` },
                  ]}
                />
                <Text style={styles.progressText}>
                  {uploadProgress.done} of {uploadProgress.total}
                </Text>
              </View>
            )}

            {/* Error count */}
            {errorCount > 0 && !uploading && (
              <Text style={styles.errorCount}>
                {errorCount} failed — tap Upload to retry
              </Text>
            )}

            {/* Caption */}
            <View style={styles.field}>
              <Text style={styles.label}>Caption</Text>
              <TextInput
                style={styles.input}
                value={caption}
                onChangeText={setCaption}
                placeholder="What's happening?"
                placeholderTextColor={colors.text3}
                multiline
              />
            </View>

            {/* Location with autocomplete */}
            <View style={styles.field}>
              <Text style={styles.label}>Location</Text>
              <TextInput
                style={styles.input}
                value={location}
                onChangeText={(text) => {
                  setLocation(text);
                  if (locationTimer.current) clearTimeout(locationTimer.current);
                  if (!text.trim()) { setLocationSuggestions([]); return; }
                  locationTimer.current = setTimeout(async () => {
                    const results = await placeAutocomplete(text);
                    setLocationSuggestions(results.slice(0, 4));
                  }, 300);
                }}
                placeholder="Where was this?"
                placeholderTextColor={colors.text3}
              />
              {locationSuggestions.length > 0 && (
                <View style={styles.suggestions}>
                  {locationSuggestions.map((s) => (
                    <Pressable
                      key={s.placeId}
                      style={styles.suggestionItem}
                      onPress={() => {
                        setLocation(s.description.split(',')[0]);
                        setLocationSuggestions([]);
                      }}
                    >
                      <Text style={styles.suggestionText} numberOfLines={1}>{s.description}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>

            {/* Tags */}
            <View style={styles.field}>
              <Text style={styles.label}>Tags</Text>
              <View style={styles.tagRow}>
                {ALL_TAGS.map((tag) => {
                  const active = tags.includes(tag);
                  return (
                    <Pressable
                      key={tag}
                      onPress={() => toggleTag(tag)}
                      style={[styles.tagPill, active && styles.tagPillActive]}
                    >
                      <Text style={[styles.tagText, active && styles.tagTextActive]}>
                        {tag}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Taken by */}
            <View style={styles.field}>
              <Text style={styles.label}>Taken by</Text>
              <TextInput
                style={styles.input}
                value={takenBy}
                onChangeText={setTakenBy}
                placeholder="Who took this?"
                placeholderTextColor={colors.text3}
              />
            </View>

            {/* Date — calendar picker */}
            <View style={styles.field}>
              <Text style={styles.label}>Date</Text>
              <TouchableOpacity
                style={styles.input}
                onPress={() => setShowDatePicker(true)}
                activeOpacity={0.7}
              >
                <Text style={{ color: colors.text, fontSize: 14 }}>
                  {new Date(date + 'T00:00:00+08:00').toLocaleDateString('en-US', {
                    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
                  })}
                </Text>
              </TouchableOpacity>
              {showDatePicker && Platform.OS === 'android' && (
                <DateTimePicker
                  value={new Date(date + 'T00:00:00+08:00')}
                  mode="date"
                  onChange={(_, selected) => {
                    setShowDatePicker(false);
                    if (selected) setDate(selected.toISOString().slice(0, 10));
                  }}
                />
              )}
              {showDatePicker && Platform.OS === 'ios' && (
                <Modal transparent animationType="fade" onRequestClose={() => setShowDatePicker(false)}>
                  <Pressable style={styles.dateModalBackdrop} onPress={() => setShowDatePicker(false)}>
                    <View style={[styles.dateModalCard, { backgroundColor: colors.card }]}>
                      <DateTimePicker
                        value={new Date(date + 'T00:00:00+08:00')}
                        mode="date"
                        display="inline"
                        onChange={(_, selected) => {
                          if (selected) setDate(selected.toISOString().slice(0, 10));
                        }}
                      />
                      <TouchableOpacity
                        style={[styles.dateModalDone, { backgroundColor: colors.accent }]}
                        onPress={() => setShowDatePicker(false)}
                      >
                        <Text style={{ color: colors.ink, fontWeight: '600', fontSize: 14 }}>Done</Text>
                      </TouchableOpacity>
                    </View>
                  </Pressable>
                </Modal>
              )}
            </View>

            {/* Upload button */}
            <Pressable
              style={[styles.uploadBtn, uploading && styles.uploadBtnDisabled]}
              onPress={handleUploadAll}
              disabled={uploading}
            >
              <Text style={styles.uploadBtnText}>
                {uploading
                  ? `Uploading ${uploadProgress.done}/${uploadProgress.total}...`
                  : doneCount > 0
                    ? `Upload ${photos.length - doneCount} remaining`
                    : `Upload ${photos.length} moment${photos.length !== 1 ? 's' : ''}`}
              </Text>
            </Pressable>
          </>
        }
      />
    </SafeAreaView>
  );
}

type ThemeColors = ReturnType<typeof import('@/constants/ThemeContext').useTheme>['colors'];

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    centered: { alignItems: 'center', justifyContent: 'center' },
    emptyText: { color: colors.text2, fontSize: 13 },
    content: { padding: spacing.lg, paddingBottom: 100, gap: spacing.lg },

    // Header
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    headerCancel: { color: colors.accent, fontSize: 14, fontWeight: '600' },
    headerTitle: { color: colors.text, fontSize: 16, fontWeight: '600' },

    // Photo grid
    photoGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    photoThumb: {
      width: 72,
      height: 72,
      borderRadius: radius.sm,
      overflow: 'hidden',
    },
    photoImage: { width: '100%', height: '100%' },
    photoOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.35)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    photoOverlayDone: { backgroundColor: 'rgba(79,179,114,0.5)' },
    photoOverlayError: { backgroundColor: 'rgba(196,85,74,0.35)' },
    photoRemove: {
      position: 'absolute',
      top: 4,
      right: 4,
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: 'rgba(0,0,0,0.6)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    addMoreBtn: {
      width: 72,
      height: 72,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: colors.border,
      borderStyle: 'dashed',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
    },
    addMoreText: { color: colors.text3, fontSize: 10, fontWeight: '600' },

    // Progress
    progressBar: {
      height: 28,
      backgroundColor: colors.card,
      borderRadius: radius.pill,
      overflow: 'hidden',
      justifyContent: 'center',
    },
    progressFill: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.accent,
      borderRadius: radius.pill,
    },
    progressText: {
      textAlign: 'center',
      fontSize: 11,
      fontWeight: '700',
      color: colors.ink,
      zIndex: 1,
    },
    errorCount: {
      color: colors.danger,
      fontSize: 12,
      fontWeight: '600',
      textAlign: 'center',
    },

    // Form
    field: { gap: spacing.sm },
    label: {
      color: colors.text3,
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.8,
      textTransform: 'uppercase',
    },
    input: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      padding: spacing.md,
      color: colors.text,
      fontSize: 14,
    },
    tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    tagPill: {
      paddingHorizontal: spacing.md,
      paddingVertical: 6,
      borderRadius: radius.pill,
      backgroundColor: colors.bg3,
      borderWidth: 1,
      borderColor: colors.border,
    },
    tagPillActive: {
      backgroundColor: colors.accentBg,
      borderColor: colors.accentBorder,
    },
    tagText: { color: colors.text2, fontSize: 12, fontWeight: '600' },
    tagTextActive: { color: colors.accent },
    suggestions: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.sm,
      marginTop: 4,
    },
    suggestionItem: {
      paddingVertical: 10,
      paddingHorizontal: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    suggestionText: { fontSize: 13, color: colors.text },

    // Date picker modal
    dateModalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    dateModalCard: {
      width: '100%',
      borderRadius: 16,
      padding: 16,
      gap: 12,
    },
    dateModalDone: {
      paddingVertical: 12,
      borderRadius: 12,
      alignItems: 'center',
    },

    // Upload button
    uploadBtn: {
      backgroundColor: colors.accent,
      borderRadius: radius.md,
      paddingVertical: 14,
      alignItems: 'center',
    },
    uploadBtnDisabled: { opacity: 0.6 },
    uploadBtnText: { color: colors.ink, fontSize: 15, fontWeight: '700' },
  });
