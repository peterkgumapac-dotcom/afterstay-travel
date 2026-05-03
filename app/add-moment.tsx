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
  KeyboardAvoidingView,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check, ChevronRight, FolderPlus, Globe, Lock, Plus, Users, X, AlertCircle, Loader } from 'lucide-react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { useTheme } from '@/constants/ThemeContext';
import { radius, spacing } from '@/constants/theme';
import { CONFIG } from '@/lib/config';
import { placeAutocomplete } from '@/lib/google-places';
import { addMoment, addPersonalPhoto, getActiveTrip } from '@/lib/supabase';
import { createExplorePost } from '@/lib/moments/exploreMomentsService';
import { useAuth } from '@/lib/auth';
import { invalidateHomeCache } from '@/hooks/useTabHomeData';
import { invalidateCache } from '@/lib/tabDataCache';
import type { MomentTag, MomentVisibility } from '@/lib/types';
import CaptureDestinationSheet, { type CaptureDestination } from '@/components/shared/CaptureDestinationSheet';

type PhotoStatus = 'pending' | 'uploading' | 'done' | 'error';

interface PhotoItem {
  uri: string;
  status: PhotoStatus;
  mediaType?: 'image' | 'video';
}

const ALL_TAGS: readonly MomentTag[] = ['Beach', 'Food', 'Sunset', 'Group', 'Activity', 'Hotel', 'Scenery', 'Night'];

const SINGLE_PHOTO_UPLOAD_TIMEOUT_MS = 210_000;
const PUBLIC_POST_BASE_TIMEOUT_MS = 90_000;
const PUBLIC_POST_PER_PHOTO_TIMEOUT_MS = 150_000;

function isVideoPhoto(photo: PhotoItem): boolean {
  if (photo.mediaType === 'video') return true;
  return /\.(mp4|mov|avi|webm|m4v)(\?|#|$)/i.test(photo.uri);
}

function withUploadTimeout<T>(promise: Promise<T>, ms = 60_000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      const timer = setTimeout(
        () => reject(new Error('Upload timed out. Please check your connection and try again.')),
        ms,
      );
      promise.then(
        () => clearTimeout(timer),
        () => clearTimeout(timer),
      );
    }),
  ]);
}

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
  const [uploadStage, setUploadStage] = useState('');
  const [scope, setScope] = useState<MomentVisibility>('private');
  const [isPublic, setIsPublic] = useState(false);
  const [locationSuggestions, setLocationSuggestions] = useState<{ placeId: string; description: string }[]>([]);
  const locationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scopeTouchedRef = useRef(false);

  // Capture routing state
  const { user } = useAuth();
  const userId = user?.id?.trim();
  const [destination, setDestination] = useState<CaptureDestination | null>(
    paramTripId ? { type: 'trip', tripId: paramTripId, tripName: '' } : null,
  );
  const [showDestSheet, setShowDestSheet] = useState(false);
  const [activeTripName, setActiveTripName] = useState('');
  const didAutoPickRef = useRef(false);

  const pickImages = useCallback(
    async (resolvedDestination = destination) => {
      if (Platform.OS === 'ios' || Platform.OS === 'android') {
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
        legacy: Platform.OS === 'android',
      });

      if (result.canceled || result.assets.length === 0) {
        if (photos.length === 0) router.back();
        return;
      }

      const newPhotos: PhotoItem[] = result.assets.map((a) => ({
        uri: a.uri,
        mediaType: a.type === 'video' ? 'video' : 'image',
        status: 'pending' as const,
      }));
      setPhotos((prev) => [...prev, ...newPhotos]);

      // If no destination set (no active trip, no param), show the routing sheet
      if (!resolvedDestination && !paramTripId) {
        setShowDestSheet(true);
      }

      // Auto-populate location from first photo's EXIF GPS if location is empty
      if (!location) {
        const firstWithGps = result.assets.find((a) => a.exif?.GPSLatitude && a.exif?.GPSLongitude);
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
    },
    [destination, location, paramTripId, photos.length, router],
  );

  // On mount: detect active trip, then pick images
  useEffect(() => {
    if (didAutoPickRef.current) return;
    didAutoPickRef.current = true;
    (async () => {
      let resolvedDestination = destination;
      if (!paramTripId) {
        const active = await getActiveTrip().catch(() => null);
        if (active) {
          resolvedDestination = { type: 'trip', tripId: active.id, tripName: active.name };
          setDestination(resolvedDestination);
          setActiveTripName(active.name);
        }
        // If no active trip and no param, we'll show the sheet after picking photos
      }
      pickImages(resolvedDestination);
    })();
  }, [destination, paramTripId, pickImages]);

  const removePhoto = (uri: string) => {
    setPhotos((prev) => prev.filter((p) => p.uri !== uri));
  };

  useEffect(() => {
    if (destination?.type === 'personal') {
      setScope('private');
      setIsPublic(false);
      return;
    }
    if (scopeTouchedRef.current) return;
    if (destination?.type === 'trip' || paramTripId) {
      setScope('shared');
      setIsPublic(false);
    }
  }, [destination?.type, paramTripId]);

  const toggleTag = (tag: MomentTag) => {
    setTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };

  const handleUploadAll = useCallback(async () => {
    if (uploading) return;
    if (photos.length === 0) return;

    // Validate destination exists
    const hasDestination = !!destination || !!paramTripId;
    if (!hasDestination) {
      Alert.alert('Choose a destination', 'Select where to save your photos before uploading.');
      setShowDestSheet(true);
      return;
    }

    // Validate userId for personal album
    if (destination?.type === 'personal' && !userId) {
      Alert.alert('Sign in required', 'Please sign in before uploading to your personal album.');
      return;
    }

    setUploading(true);
    setUploadStage('Preparing photos...');
    const pending = photos.filter((p) => p.status !== 'done');
    setUploadProgress({ done: 0, total: pending.length });
    if (pending.length === 0) {
      setUploading(false);
      router.back();
      return;
    }

    // Mark all as uploading
    setPhotos((prev) => prev.map((p) => (p.status === 'done' ? p : { ...p, status: 'uploading' })));

    let successCount = photos.filter((p) => p.status === 'done').length;
    let completedThisRun = 0;
    let lastErrors: string[] = [];
    const BATCH_SIZE = 1;
    const tripId = destination?.type === 'trip' ? destination.tripId : paramTripId;
    const shouldCreateExploreOnly = isPublic && destination?.type !== 'personal' && !tripId;

    try {
      if (shouldCreateExploreOnly) {
        if (pending.some(isVideoPhoto)) {
          throw new Error('Public Explore moments support photos only right now. Save videos to a Trip Album instead.');
        }
        setUploadStage('Uploading public post...');
        await withUploadTimeout(
          createExplorePost({
            caption: caption.trim() || undefined,
            locationName: location.trim() || undefined,
            tripId,
            localMediaUris: pending.map((photo) => photo.uri),
          }),
          PUBLIC_POST_BASE_TIMEOUT_MS + pending.length * PUBLIC_POST_PER_PHOTO_TIMEOUT_MS,
        );
        completedThisRun = pending.length;
        successCount = photos.length;
        setPhotos((prev) => prev.map((p) => (p.status === 'uploading' ? { ...p, status: 'done' } : p)));
        setUploadProgress({ done: completedThisRun, total: pending.length });
        if (tripId) {
          invalidateCache(`moments:${tripId}`);
          invalidateCache(`home:moments:${tripId}`);
        }
        invalidateHomeCache();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.back();
        return;
      }

      // Upload one at a time. It is slower, but much more reliable on mobile
      // connections and avoids one stuck request making the whole UI look frozen.
      for (let i = 0; i < pending.length; i += BATCH_SIZE) {
        const batch = pending.slice(i, i + BATCH_SIZE);
        setUploadStage(`Uploading photo ${i + 1} of ${pending.length}...`);
        const results = await Promise.allSettled(
          batch.map(async (photo) => {
            if (destination?.type === 'personal') {
              if (!userId) {
                throw new Error('Missing user ID for personal album upload.');
              }
              setUploadStage(`Saving to Personal Album ${i + 1} of ${pending.length}...`);
              await withUploadTimeout(
                addPersonalPhoto({
                  userId,
                  localUri: photo.uri,
                  location: location || undefined,
                  caption: caption || undefined,
                  takenAt: date,
                  tags,
                }),
                SINGLE_PHOTO_UPLOAD_TIMEOUT_MS,
              );
            } else if (destination?.type === 'quick-trip') {
              throw new Error(
                'Quick Trip photo upload is being routed through Quick Trip creation. Please choose Personal Album or a Trip for now.',
              );
            } else if (scope === 'album') {
              throw new Error('Custom album selection is not ready yet. Choose Just me or The trip group for now.');
            } else {
              setUploadStage(`Saving to Trip Album ${i + 1} of ${pending.length}...`);
              await withUploadTimeout(
                addMoment({
                  caption: caption || '',
                  localUri: photo.uri,
                  mediaType: photo.mediaType,
                  location: location || undefined,
                  takenBy: takenBy || undefined,
                  date,
                  tags,
                  visibility: scope,
                  isPublic: false,
                  ...(tripId ? { tripId } : {}),
                }),
                SINGLE_PHOTO_UPLOAD_TIMEOUT_MS,
              );
            }
            return photo.uri;
          }),
        );

        const errors: string[] = [];
        for (let j = 0; j < results.length; j++) {
          const result = results[j];
          completedThisRun++;
          if (result.status === 'fulfilled') {
            setPhotos((prev) => prev.map((p) => (p.uri === result.value ? { ...p, status: 'done' } : p)));
            successCount++;
          } else {
            const failedUri = batch[j]?.uri;
            if (failedUri) {
              setPhotos((prev) => prev.map((p) => (p.uri === failedUri ? { ...p, status: 'error' } : p)));
            }
            const reason = result.reason instanceof Error ? result.reason.message : String(result.reason);
            errors.push(reason);
            // eslint-disable-next-line no-console
            console.error('[add-moment] upload failed:', reason);
          }
        }
        if (errors.length > 0) lastErrors = errors;
        setUploadProgress({ done: completedThisRun, total: pending.length });
      }

      if (successCount === photos.length) {
        if (isPublic && destination?.type !== 'personal' && tripId) {
          if (pending.some(isVideoPhoto)) {
            lastErrors = ['Saved to the trip album. Videos are not shared to Explore yet.'];
          } else {
            try {
              setUploadStage('Sharing to Explore...');
              await withUploadTimeout(
                createExplorePost({
                  caption: caption.trim() || undefined,
                  locationName: location.trim() || undefined,
                  tripId,
                  localMediaUris: pending.map((photo) => photo.uri),
                }),
                PUBLIC_POST_BASE_TIMEOUT_MS + pending.length * PUBLIC_POST_PER_PHOTO_TIMEOUT_MS,
              );
            } catch (error) {
              const reason = error instanceof Error ? error.message : String(error);
              lastErrors = [`Saved to the trip album, but public sharing failed: ${reason}`];
              // eslint-disable-next-line no-console
              console.error('[add-moment] public mirror failed:', reason);
            }
          }
        }
        if (tripId) {
          invalidateCache(`moments:${tripId}`);
          invalidateCache(`home:moments:${tripId}`);
        }
        invalidateHomeCache();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        if (lastErrors.length > 0) {
          Alert.alert('Saved to trip album', lastErrors[0]);
        }
        router.back();
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        const errDetail = lastErrors.length > 0 ? `\n\nError: ${lastErrors[0]}` : '';
        Alert.alert(
          'Partial upload',
          `${successCount} of ${photos.length} uploaded. Tap "Upload" to retry failed ones.${errDetail}`,
        );
      }
    } catch (error: any) {
      setPhotos((prev) => prev.map((p) => (p.status === 'uploading' ? { ...p, status: 'error' } : p)));
      Alert.alert('Upload failed', error?.message ?? 'Something went wrong while uploading. Please try again.');
    } finally {
      setUploading(false);
      setUploadStage('');
    }
  }, [
    uploading,
    photos,
    caption,
    location,
    tags,
    takenBy,
    date,
    scope,
    isPublic,
    destination,
    userId,
    paramTripId,
    router,
  ]);

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
        <Pressable style={styles.photoRemove} onPress={() => removePhoto(item.uri)} hitSlop={6}>
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
  const isPersonalDestination = destination?.type === 'personal';
  const isTripDestination = destination?.type === 'trip' || !!paramTripId;
  const uploadTargetLabel = isPublic
    ? isTripDestination
      ? 'Trip Album + Explore'
      : 'Explore'
    : isPersonalDestination
      ? 'Personal Album'
    : scope === 'private'
      ? 'private'
      : scope === 'album'
        ? 'album'
        : 'the group';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
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
                <TouchableOpacity style={styles.destChip} activeOpacity={0.7} onPress={() => setShowDestSheet(true)}>
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
                <Pressable
                  style={styles.addMoreBtn}
                  onPress={() => {
                    pickImages();
                  }}
                >
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
                <Text style={styles.errorCount}>{errorCount} failed — tap Upload to retry</Text>
              )}

              {/* Scope picker — "Share with" */}
              <View style={styles.field}>
                <Text style={styles.label}>Share with</Text>
                <View style={{ gap: 6 }}>
                  {/* Just me */}
                  <Pressable
                    onPress={() => {
                      scopeTouchedRef.current = true;
                      setScope('private');
                      setIsPublic(false);
                    }}
                    style={[
                      styles.scopeRow,
                      {
                        borderColor: scope === 'private' ? colors.accent : colors.border,
                        backgroundColor: scope === 'private' ? colors.accentBg : colors.card,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.scopeIcon,
                        { backgroundColor: scope === 'private' ? colors.danger : colors.card2 },
                      ]}
                    >
                      <Lock size={16} color={scope === 'private' ? '#fff' : colors.text3} strokeWidth={2} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.scopeTitle, { color: colors.text }]}>Just me</Text>
                      <Text style={[styles.scopeSub, { color: colors.text3 }]}>
                        Private. Group can{'\u2019'}t see it.
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.scopeCheck,
                        scope === 'private'
                          ? { backgroundColor: colors.accent, borderColor: colors.accent }
                          : { borderColor: colors.border2 },
                      ]}
                    >
                      {scope === 'private' && <Check size={11} color={colors.onBlack} strokeWidth={3} />}
                    </View>
                  </Pressable>

                  {/* The trip group */}
                  <Pressable
                    onPress={() => {
                      scopeTouchedRef.current = true;
                      setScope('shared');
                      setIsPublic(false);
                    }}
                    style={[
                      styles.scopeRow,
                      {
                        borderColor: scope === 'shared' ? colors.accent : colors.border,
                        backgroundColor: scope === 'shared' ? colors.accentBg : colors.card,
                      },
                    ]}
                  >
                    <View
                      style={[styles.scopeIcon, { backgroundColor: scope === 'shared' ? colors.accent : colors.card2 }]}
                    >
                      <Users size={16} color={scope === 'shared' ? colors.onBlack : colors.text3} strokeWidth={2} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.scopeTitle, { color: colors.text }]}>The trip group</Text>
                      <Text style={[styles.scopeSub, { color: colors.text3 }]}>Visible to all trip members.</Text>
                    </View>
                    <View
                      style={[
                        styles.scopeCheck,
                        scope === 'shared'
                          ? { backgroundColor: colors.accent, borderColor: colors.accent }
                          : { borderColor: colors.border2 },
                      ]}
                    >
                      {scope === 'shared' && <Check size={11} color={colors.onBlack} strokeWidth={3} />}
                    </View>
                  </Pressable>

                  {!isPersonalDestination && (
                    <Pressable
                      onPress={() => {
                        scopeTouchedRef.current = true;
                        setScope('shared');
                        setIsPublic(true);
                      }}
                      style={[
                        styles.scopeRow,
                        {
                          borderColor: isPublic ? colors.accent : colors.border,
                          backgroundColor: isPublic ? colors.accentBg : colors.card,
                        },
                      ]}
                    >
                      <View style={[styles.scopeIcon, { backgroundColor: isPublic ? colors.success : colors.card2 }]}>
                        <Globe size={16} color={isPublic ? colors.onBlack : colors.text3} strokeWidth={2} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.scopeTitle, { color: colors.text }]}>
                          {isTripDestination ? 'Trip album + Explore' : 'Post to Explore'}
                        </Text>
                        <Text style={[styles.scopeSub, { color: colors.text3 }]}>
                          {isTripDestination
                            ? 'Saved to the trip and shared publicly.'
                            : 'Anyone on AfterStay can see it.'}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.scopeCheck,
                          isPublic
                            ? { backgroundColor: colors.accent, borderColor: colors.accent }
                            : { borderColor: colors.border2 },
                        ]}
                      >
                        {isPublic && <Check size={11} color={colors.onBlack} strokeWidth={3} />}
                      </View>
                    </Pressable>
                  )}

                  {/* Custom album — disabled until album membership is wired */}
                  <Pressable
                    onPress={() => {
                      Alert.alert(
                        'Custom albums are coming back soon',
                        'For now, save privately or to the trip group so the upload is attached correctly.',
                      );
                    }}
                    style={[
                      styles.scopeRow,
                      styles.scopeRowDisabled,
                      {
                        borderColor: colors.border,
                        backgroundColor: colors.card,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.scopeIcon,
                        { backgroundColor: colors.card2 },
                      ]}
                    >
                      <FolderPlus size={16} color={colors.text3} strokeWidth={2} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.scopeTitle, { color: colors.text }]}>A custom album</Text>
                      <Text style={[styles.scopeSub, { color: colors.text3 }]}>Temporarily unavailable.</Text>
                    </View>
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
                    if (!text.trim()) {
                      setLocationSuggestions([]);
                      return;
                    }
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
                        <Text style={styles.suggestionText} numberOfLines={1}>
                          {s.description}
                        </Text>
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
                        <Text style={[styles.tagText, active && styles.tagTextActive]}>{tag}</Text>
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
                <TouchableOpacity style={styles.input} onPress={() => setShowDatePicker(true)} activeOpacity={0.7}>
                  <Text style={{ color: colors.text, fontSize: 14 }}>
                    {new Date(date + 'T00:00:00+08:00').toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
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
                      : `Add ${photos.length} to ${uploadTargetLabel}`}
                </Text>
              </Pressable>
              {uploading && uploadStage ? <Text style={styles.uploadStage}>{uploadStage}</Text> : null}
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
      </KeyboardAvoidingView>
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
    scopeRowDisabled: {
      opacity: 0.58,
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
    uploadStage: {
      marginTop: 8,
      fontSize: 12,
      color: colors.text3,
      textAlign: 'center',
    },
  });
