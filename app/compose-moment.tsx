import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { Camera, ChevronLeft, MapPin, Send, X } from 'lucide-react-native';
import React, { useCallback, useRef, useState } from 'react';
import { CONFIG } from '@/lib/config';
import { placeAutocomplete } from '@/lib/google-places';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FEED, SERIF, PAPER } from '@/components/feed/feedTheme';
import { createExplorePost, tagUsersInPost, searchProfiles } from '@/lib/moments/exploreMomentsService';
import type { LayoutType } from '@/lib/types';

const SCREEN_W = Dimensions.get('window').width;
const THUMB_SIZE = (SCREEN_W - 48 - 16) / 4;

type FormatOption = 'single' | 'carousel' | 'collage';

const FORMAT_OPTIONS: { id: FormatOption; label: string; layout: LayoutType }[] = [
  { id: 'single', label: 'Single', layout: 'single' },
  { id: 'carousel', label: 'Carousel', layout: 'carousel' },
  { id: 'collage', label: 'Collage', layout: 'polaroid_stack' },
];

export default function ComposeMomentScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ photoUris?: string }>();

  // Pre-populate from camera icon flow
  const initialImages = React.useMemo(() => {
    if (params.photoUris) return params.photoUris.split(',').filter(Boolean);
    return [];
  }, [params.photoUris]);

  const [images, setImages] = useState<string[]>(initialImages);
  const [caption, setCaption] = useState('');
  const [locationName, setLocationName] = useState('');
  const [locationSuggestions, setLocationSuggestions] = useState<{ placeId: string; description: string }[]>([]);
  const locationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [format, setFormat] = useState<FormatOption>(initialImages.length > 1 ? 'carousel' : 'single');
  const [posting, setPosting] = useState(false);

  // Tag people
  const [taggedPeople, setTaggedPeople] = useState<{ id: string; name: string; avatar?: string }[]>([]);
  const [tagQuery, setTagQuery] = useState('');
  const [tagSuggestions, setTagSuggestions] = useState<{ id: string; name: string; avatar?: string }[]>([]);
  const tagTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleTagSearch = useCallback((text: string) => {
    setTagQuery(text);
    if (tagTimer.current) clearTimeout(tagTimer.current);
    if (text.trim().length < 2) { setTagSuggestions([]); return; }
    tagTimer.current = setTimeout(async () => {
      try {
        const results = await searchProfiles(text);
        const filtered = results.filter((r) => !taggedPeople.some((t) => t.id === r.id));
        setTagSuggestions(filtered.slice(0, 5));
      } catch { setTagSuggestions([]); }
    }, 300);
  }, [taggedPeople]);

  const addTag = useCallback((person: { id: string; name: string; avatar?: string }) => {
    setTaggedPeople((prev) => [...prev, person]);
    setTagQuery('');
    setTagSuggestions([]);
  }, []);

  const removeTag = useCallback((id: string) => {
    setTaggedPeople((prev) => prev.filter((p) => p.id !== id));
  }, []);

  // Reverse-geocode from EXIF GPS
  const reverseGeocodeExif = useCallback(async (assets: ImagePicker.ImagePickerAsset[]) => {
    if (locationName) return; // Already has location
    const withGps = assets.find((a) => a.exif?.GPSLatitude && a.exif?.GPSLongitude);
    if (!withGps?.exif) return;
    const lat = withGps.exif.GPSLatitude as number;
    const lng = withGps.exif.GPSLongitude as number;
    try {
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${CONFIG.GOOGLE_MAPS_KEY}&result_type=point_of_interest|establishment|locality`,
      );
      const json = await res.json();
      const name = json.results?.[0]?.formatted_address?.split(',')[0];
      if (name) setLocationName(name);
    } catch {}
  }, [locationName]);

  const pickImages = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: 10,
      quality: 0.8,
      exif: true,
    });

    if (!result.canceled && result.assets.length > 0) {
      const uris = result.assets.map((a) => a.uri);
      setImages((prev) => [...prev, ...uris].slice(0, 10));

      if (uris.length > 1 && format === 'single') {
        setFormat('carousel');
      }

      reverseGeocodeExif(result.assets);
    }
  }, [format, reverseGeocodeExif]);

  // Location autocomplete
  const handleLocationChange = useCallback((text: string) => {
    setLocationName(text);
    if (locationTimer.current) clearTimeout(locationTimer.current);
    if (text.trim().length < 2) {
      setLocationSuggestions([]);
      return;
    }
    locationTimer.current = setTimeout(async () => {
      try {
        const results = await placeAutocomplete(text);
        setLocationSuggestions(results.slice(0, 5));
      } catch {
        setLocationSuggestions([]);
      }
    }, 300);
  }, []);

  const removeImage = useCallback((idx: number) => {
    setImages((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      if (next.length <= 1 && format !== 'single') setFormat('single');
      return next;
    });
  }, [format]);

  const handlePost = useCallback(async () => {
    if (images.length === 0) {
      Alert.alert('No photos', 'Select at least one photo to share.');
      return;
    }

    setPosting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const selected = FORMAT_OPTIONS.find((f) => f.id === format);
      const post = await createExplorePost({
        caption: caption.trim() || undefined,
        locationName: locationName.trim() || undefined,
        layoutType: selected?.layout ?? 'single',
        localMediaUris: images,
      });

      if (taggedPeople.length > 0) {
        try {
          await tagUsersInPost(post.id, taggedPeople.map((p) => p.id));
        } catch (tagErr) {
          Alert.alert(
            'Moment shared',
            tagErr instanceof Error
              ? `Your moment was posted, but tags did not save: ${tagErr.message}`
              : 'Your moment was posted, but tags did not save. Please try tagging again later.',
            [{ text: 'OK', onPress: () => router.back() }],
          );
          return;
        }
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (err) {
      Alert.alert('Upload failed', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setPosting(false);
    }
  }, [images, caption, locationName, format, taggedPeople, router]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={styles.backBtn}>
          <ChevronLeft size={24} color={FEED.ink} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Moment</Text>
        <TouchableOpacity
          onPress={handlePost}
          disabled={posting || images.length === 0}
          activeOpacity={0.7}
          style={[styles.postBtn, (posting || images.length === 0) && styles.postBtnDisabled]}
        >
          {posting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Send size={14} color="#fff" strokeWidth={2} />
              <Text style={styles.postBtnText}>Share</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        {/* Image picker */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>PHOTOS</Text>
          <View style={styles.thumbGrid}>
            {images.map((uri, i) => (
              <View key={uri + i} style={styles.thumbWrap}>
                <Image source={{ uri }} style={styles.thumb} contentFit="cover" />
                <TouchableOpacity
                  style={styles.thumbRemove}
                  onPress={() => removeImage(i)}
                  activeOpacity={0.7}
                >
                  <X size={12} color="#fff" strokeWidth={3} />
                </TouchableOpacity>
              </View>
            ))}
            {images.length < 10 && (
              <TouchableOpacity style={styles.addThumb} onPress={pickImages} activeOpacity={0.7}>
                <Camera size={22} color={FEED.terracotta} strokeWidth={1.8} />
                <Text style={styles.addThumbText}>Add</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Format selector (only if 2+ images) */}
        {images.length >= 2 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>FORMAT</Text>
            <View style={styles.formatRow}>
              {FORMAT_OPTIONS.map((opt) => {
                if (opt.id === 'single' && images.length > 1) return null;
                const active = format === opt.id;
                return (
                  <TouchableOpacity
                    key={opt.id}
                    style={[styles.formatChip, active && styles.formatChipActive]}
                    onPress={() => setFormat(opt.id)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.formatText, active && styles.formatTextActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Caption */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>CAPTION</Text>
          <TextInput
            style={styles.captionInput}
            placeholder="Write something about this moment..."
            placeholderTextColor={FEED.inkMuted}
            value={caption}
            onChangeText={setCaption}
            multiline
            maxLength={500}
          />
        </View>

        {/* Location */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>LOCATION</Text>
          <View style={styles.locationInputWrap}>
            <MapPin size={16} color={FEED.terracotta} strokeWidth={1.8} />
            <TextInput
              style={styles.locationInput}
              placeholder="Add location"
              placeholderTextColor={FEED.inkMuted}
              value={locationName}
              onChangeText={handleLocationChange}
              maxLength={100}
            />
          </View>
          {locationSuggestions.length > 0 && (
            <View style={styles.suggestions}>
              {locationSuggestions.map((s) => (
                <TouchableOpacity
                  key={s.placeId}
                  style={styles.suggestionRow}
                  onPress={() => {
                    setLocationName(s.description.split(',')[0]);
                    setLocationSuggestions([]);
                  }}
                >
                  <MapPin size={14} color={FEED.inkLight} strokeWidth={1.5} />
                  <Text style={styles.suggestionText} numberOfLines={1}>{s.description}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Tag People */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>TAG PEOPLE</Text>

          {/* Tagged chips */}
          {taggedPeople.length > 0 && (
            <View style={styles.tagChipRow}>
              {taggedPeople.map((p) => (
                <View key={p.id} style={styles.tagChip}>
                  {p.avatar ? (
                    <Image source={{ uri: p.avatar }} style={styles.tagChipAvatar} contentFit="cover" />
                  ) : (
                    <View style={[styles.tagChipAvatar, styles.tagChipAvatarPlaceholder]}>
                      <Text style={styles.tagChipInitial}>{p.name[0].toUpperCase()}</Text>
                    </View>
                  )}
                  <Text style={styles.tagChipName} numberOfLines={1}>{p.name.split(' ')[0]}</Text>
                  <TouchableOpacity onPress={() => removeTag(p.id)} activeOpacity={0.7}>
                    <X size={14} color={PAPER.inkLight} strokeWidth={2} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {/* Search input */}
          <View style={styles.locationInputWrap}>
            <TextInput
              style={styles.locationInput}
              placeholder="Search companions..."
              placeholderTextColor={FEED.inkMuted}
              value={tagQuery}
              onChangeText={handleTagSearch}
              maxLength={50}
            />
          </View>

          {/* Suggestions dropdown */}
          {tagSuggestions.length > 0 && (
            <View style={styles.suggestions}>
              {tagSuggestions.map((s) => (
                <TouchableOpacity
                  key={s.id}
                  style={styles.suggestionRow}
                  onPress={() => addTag(s)}
                  activeOpacity={0.7}
                >
                  {s.avatar ? (
                    <Image source={{ uri: s.avatar }} style={styles.tagSugAvatar} contentFit="cover" />
                  ) : (
                    <View style={[styles.tagSugAvatar, styles.tagChipAvatarPlaceholder]}>
                      <Text style={styles.tagChipInitial}>{s.name[0].toUpperCase()}</Text>
                    </View>
                  )}
                  <Text style={styles.suggestionText} numberOfLines={1}>{s.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: FEED.bg },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: FEED.cardBorder,
  },
  backBtn: { padding: 4 },
  headerTitle: {
    fontFamily: SERIF,
    fontSize: 18,
    color: FEED.ink,
  },
  postBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: FEED.terracotta,
  },
  postBtnDisabled: { opacity: 0.5 },
  postBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  // Body
  body: { flex: 1 },
  bodyContent: { paddingBottom: 40 },

  section: {
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: FEED.inkLight,
    letterSpacing: 1.2,
    marginBottom: 10,
  },

  // Thumbnails
  thumbGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  thumbWrap: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: 8,
    overflow: 'hidden',
  },
  thumb: {
    width: '100%',
    height: '100%',
  },
  thumbRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addThumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: FEED.cardBorder,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  addThumbText: {
    fontSize: 10,
    fontWeight: '600',
    color: FEED.terracotta,
  },

  // Format
  formatRow: {
    flexDirection: 'row',
    gap: 8,
  },
  formatChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: FEED.cardBorder,
    backgroundColor: FEED.card,
  },
  formatChipActive: {
    backgroundColor: FEED.terracotta,
    borderColor: FEED.terracotta,
  },
  formatText: {
    fontSize: 13,
    fontWeight: '500',
    color: FEED.inkLight,
  },
  formatTextActive: {
    color: '#fff',
    fontWeight: '700',
  },

  // Caption
  captionInput: {
    backgroundColor: FEED.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: FEED.cardBorder,
    padding: 14,
    fontSize: 14,
    color: FEED.ink,
    minHeight: 80,
    textAlignVertical: 'top',
  },

  // Location
  locationInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: FEED.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: FEED.cardBorder,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  locationInput: {
    flex: 1,
    fontSize: 14,
    color: FEED.ink,
  },
  suggestions: {
    marginTop: 4,
    backgroundColor: FEED.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: FEED.cardBorder,
    overflow: 'hidden',
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: FEED.cardBorder,
  },
  suggestionText: {
    flex: 1,
    fontSize: 13,
    color: FEED.ink,
  },

  // Tag people
  tagChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: FEED.card,
    borderWidth: 1,
    borderColor: FEED.cardBorder,
  },
  tagChipAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  tagChipAvatarPlaceholder: {
    backgroundColor: PAPER.postcardEdge,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagChipInitial: {
    fontSize: 10,
    fontWeight: '700',
    color: PAPER.postcardInk,
  },
  tagChipName: {
    fontSize: 13,
    fontWeight: '500',
    color: FEED.ink,
    maxWidth: 100,
  },
  tagSugAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
});
