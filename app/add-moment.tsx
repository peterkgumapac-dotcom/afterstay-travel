import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { Check, ChevronRight, FolderPlus, Lock, Plus, Users, X, AlertCircle, Loader } from 'lucide-react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { useTheme } from '@/constants/ThemeContext';
import { radius, spacing } from '@/constants/theme';
import { CONFIG } from '@/lib/config';
import { placeAutocomplete } from '@/lib/google-places';
import { addMoment, addPersonalPhoto, getActiveTrip } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { MomentTag, MomentVisibility } from '@/lib/types';
import CaptureDestinationSheet, { type CaptureDestination } from '@/components/shared/CaptureDestinationSheet';

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
  const { tripId: paramTripId } = useLocalSearchParams<{ tripId?: string }>();
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
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
  const [scope, setScope] = useState<MomentVisibility>('private');
  const [locationSuggestions, setLocationSuggestions] = useState<{ placeId: string; description: string }[]>([]);
  const locationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Capture routing state
  const { user } = useAuth();
  const [destination, setDestination] = useState<CaptureDestination | null>(
    paramTripId ? { type: 'trip', tripId: paramTripId, tripName: '' } : null,
  );
  const [showDestSheet, setShowDestSheet] = useState(false);
  const [activeTripName, setActiveTripName] = useState('');

  // On mount: detect active trip, then pick images
  useEffect(() => {
    (async () => {
      if (!paramTripId) {
        const active = await getActiveTrip().catch(() => null);
        if (active) {
          setDestination({ type: 'trip', tripId: active.id, tripName: active.name });
          setActiveTripName(active.name);
        }
        // If no active trip and no param, we'll show the sheet after picking photos
      }
      pickImages();
    })();
  }, []);

  const pickImages = async () => {
    if (Platform.OS === 'ios') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please allow photo library access in Settings to add moments.');
        if (photos.length === 0) router.back();
        return;
      }
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      quality: 0.8,
      allowsMultipleSelection: true,
      selectionLimit: 20,
      exif: true,
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

    // If no destination set (no active trip, no param), show the routing sheet
    if (!destination && !paramTripId) {
      setShowDestSheet(true);
    }

    // Auto-populate location from first photo's EXIF GPS if location is empty
    if (!location) {
      const firstWithGps = result.assets.find(
        (a) => a.exif?.GPSLatitude && a.exif?.GPSLongitude,
      );
      if (firstWithGps?.exif) {
        const lat = firstWithGps.exif.GPSLatitude as number;
        const lng = firstWithGps.exif.GPSLongitude as number;
        try {
          const res = await fetch(
            `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${CONFIG.GOOGLE_MAPS_KEY}&result_type=point_of_interest|establishment|locality`,
          );
          const json = await res.json();
          const name = json.results?.[0]?.formatted_address?.split(',')[0];
          if (name) setLocation(name);
        } catch {
          // Silently fail — user can still type location manually
        }
      }
    }
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
    const pending = photos.filter((p) => p.status !== 'done');
    setUploadProgress({ done: 0, total: pending.length });

    // Mark all as uploading
    setPhotos((prev) =>
      prev.map((p) => p.status === 'done' ? p : { ...p, status: 'uploading' }),
    );

    let successCount = photos.filter((p) => p.status === 'done').length;
    let lastErrors: string[] = [];
    const BATCH_SIZE = 3;

    // Upload in parallel batches of 3
    for (let i = 0; i < pending.length; i += BATCH_SIZE) {
      const batch = pending.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map(async (photo) => {
          if (destination?.type === 'personal' && user?.id) {
            await addPersonalPhoto({
              userId: user.id,
              localUri: photo.uri,
              location: location || undefined,
              caption: caption || undefined,
              takenAt: date,
              tags,
            });
          } else if (destination?.type === 'quick-trip') {
            // Navigate to quick-trip-create with photos — handled in onSelect
            // This path shouldn't reach here; it redirects before upload
            return photo.uri;
          } else {
            const tripId = destination?.type === 'trip' ? destination.tripId : paramTripId;
            await addMoment({
              caption: caption || '',
              localUri: photo.uri,
              location: location || undefined,
              takenBy: takenBy || undefined,
              date,
              tags,
              visibility: scope,
              ...(tripId ? { tripId } : {}),
            });
          }
          return photo.uri;
        }),
      );

      const errors: string[] = [];
      for (let j = 0; j < results.length; j++) {
        const result = results[j];
        if (result.status === 'fulfilled') {
          setPhotos((prev) =>
            prev.map((p) => p.uri === result.value ? { ...p, status: 'done' } : p),
          );
          successCount++;
        } else {
          const failedUri = batch[j]?.uri;
          if (failedUri) {
            setPhotos((prev) =>
              prev.map((p) => p.uri === failedUri ? { ...p, status: 'error' } : p),
            );
          }
          const reason = result.reason instanceof Error ? result.reason.message : String(result.reason);
          errors.push(reason);
          // eslint-disable-next-line no-console
          console.error('[add-moment] upload failed:', reason);
        }
      }
      lastErrors = errors;
      setUploadProgress({ done: successCount - (photos.length - pending.length), total: pending.length });
    }

    setUploading(false);

    if (successCount === photos.length) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      const errDetail = lastErrors.length > 0 ? `\n\nError: ${lastErrors[0]}` : '';
      Alert.alert(
        'Partial upload',
        `${successCount} of ${photos.length} uploaded. Tap "Upload" to retry failed ones.${errDetail}`,
      );
    }
  }, [photos, caption, location, tags, takenBy, date, scope, paramTripId, router]);

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

            {/* Destination chip — shows where photos will be saved */}
            {destination && (
              <TouchableOpacity
                style={styles.destChip}
                activeOpacity={0.7}
                onPress={() => setShowDestSheet(true)}
              >
                <Text style={styles.destChipLabel}>Saving to: </Text>
                <Text style={styles.destChipValue} numberOfLines={1}>
                  {destination.type === 'trip'
                    ? destination.tripName || activeTripName || 'Trip'
                    : destination.type === 'personal'
                    ? 'Personal Album'
                    : 'Quick Trip'}
                </Text>
                <ChevronRight size={12} color={colors.text3} />
              </TouchableOpacity>
            )}

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

            {/* Scope picker — "Share with" */}
            <View style={styles.field}>
              <Text style={styles.label}>Share with</Text>
              <View style={{ gap: 6 }}>
                {/* Just me */}
                <Pressable
                  onPress={() => setScope('private')}
                  style={[
                    styles.scopeRow,
                    {
                      borderColor: scope === 'private' ? colors.accent : colors.border,
                      backgroundColor: scope === 'private' ? colors.accentBg : colors.card,
                    },
                  ]}
                >
                  <View style={[styles.scopeIcon, { backgroundColor: scope === 'private' ? colors.danger : colors.card2 }]}>
                    <Lock size={16} color={scope === 'private' ? '#fff' : colors.text3} strokeWidth={2} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.scopeTitle, { color: colors.text }]}>Just me</Text>
                    <Text style={[styles.scopeSub, { color: colors.text3 }]}>Private. Group can{'\u2019'}t see it.</Text>
                  </View>
                  <View style={[styles.scopeCheck, scope === 'private' ? { backgroundColor: colors.accent, borderColor: colors.accent } : { borderColor: colors.border2 }]}>
                    {scope === 'private' && <Check size={11} color={colors.onBlack} strokeWidth={3} />}
                  </View>
                </Pressable>

                {/* The trip group */}
                <Pressable
                  onPress={() => setScope('shared')}
                  style={[
                    styles.scopeRow,
                    {
                      borderColor: scope === 'shared' ? colors.accent : colors.border,
                      backgroundColor: scope === 'shared' ? colors.accentBg : colors.card,
                    },
                  ]}
                >
                  <View style={[styles.scopeIcon, { backgroundColor: scope === 'shared' ? colors.accent : colors.card2 }]}>
                    <Users size={16} color={scope === 'shared' ? colors.onBlack : colors.text3} strokeWidth={2} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.scopeTitle, { color: colors.text }]}>The trip group</Text>
                    <Text style={[styles.scopeSub, { color: colors.text3 }]}>Visible to all trip members.</Text>
                  </View>
                  <View style={[styles.scopeCheck, scope === 'shared' ? { backgroundColor: colors.accent, borderColor: colors.accent } : { borderColor: colors.border2 }]}>
                    {scope === 'shared' && <Check size={11} color={colors.onBlack} strokeWidth={3} />}
                  </View>
                </Pressable>

                {/* Custom album — routes to album creator */}
                <Pressable
                  onPress={() => {
                    setScope('album');
                    router.push('/new-album' as never);
                  }}
                  style={[
                    styles.scopeRow,
                    {
                      borderColor: scope === 'album' ? colors.accent : colors.border,
                      backgroundColor: scope === 'album' ? colors.accentBg : colors.card,
                    },
                  ]}
                >
                  <View style={[styles.scopeIcon, { backgroundColor: scope === 'album' ? colors.accentLt : colors.card2 }]}>
                    <FolderPlus size={16} color={scope === 'album' ? colors.onBlack : colors.text3} strokeWidth={2} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.scopeTitle, { color: colors.text }]}>A custom album</Text>
                    <Text style={[styles.scopeSub, { color: colors.text3 }]}>Pick specific people. Optional.</Text>
                  </View>
                  <ChevronRight size={16} color={colors.text3} strokeWidth={2} />
                </Pressable>
              </View>
            </View>

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
            <View style={[styles.field, { zIndex: 5 }]}>
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
                    : `Add ${photos.length} to ${scope === 'private' ? 'private' : scope === 'album' ? 'album' : 'the group'}`}
              </Text>
            </Pressable>
          </>
        }
      />

      <CaptureDestinationSheet
        visible={showDestSheet}
        onClose={() => {
          setShowDestSheet(false);
          // If still no destination after closing, go back
          if (!destination) router.back();
        }}
        onSelect={(dest) => {
          setShowDestSheet(false);
          if (dest.type === 'quick-trip') {
            // Redirect to quick-trip-create with the selected photos
            router.replace({
              pathname: '/quick-trip-create',
              params: { photoUris: photos.map((p) => p.uri).join(',') },
            } as never);
          } else {
            setDestination(dest);
          }
        }}
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
    destChip: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      backgroundColor: colors.card,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 12,
      paddingVertical: 8,
      marginBottom: 12,
      gap: 2,
    },
    destChipLabel: { fontSize: 12, color: colors.text3 },
    destChipValue: { fontSize: 12, fontWeight: '600', color: colors.accent, maxWidth: 180 },

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
    field: { gap: spacing.sm, zIndex: 1 },
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
      zIndex: 10,
      elevation: 10,
    },
    suggestionItem: {
      paddingVertical: 12,
      paddingHorizontal: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      minHeight: 44,
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

    // Scope picker
    scopeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 14,
      borderWidth: 1.5,
      borderRadius: 14,
    },
    scopeIcon: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    scopeTitle: {
      fontSize: 14,
      fontWeight: '600',
    },
    scopeSub: {
      fontSize: 11,
      marginTop: 2,
    },
    scopeCheck: {
      width: 22,
      height: 22,
      borderRadius: 99,
      borderWidth: 1.5,
      alignItems: 'center',
      justifyContent: 'center',
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
