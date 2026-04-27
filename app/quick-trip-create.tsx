import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  ArrowLeft,
  Calendar,
  Camera,
  Check,
  MapPin,
  Plus,
} from 'lucide-react-native';

import CategoryChipSelector from '@/components/quick-trips/CategoryChip';
import CompanionChips, { type CompanionInput } from '@/components/quick-trips/CompanionChips';
import { useTheme, ThemeColors } from '@/constants/ThemeContext';
import { placeAutocomplete } from '@/lib/google-places';
import { createQuickTrip } from '@/lib/quickTrips';
import type { QuickTripCategory } from '@/lib/quickTripTypes';

type Phase = 'photos' | 'review';

export default function QuickTripCreateScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const router = useRouter();
  const { returnTo, photoUris } = useLocalSearchParams<{ returnTo?: string; photoUris?: string }>();

  // Phase
  const [phase, setPhase] = useState<Phase>('photos');

  // Photo state
  const [photos, setPhotos] = useState<{ uri: string }[]>([]);

  // Review state
  const [placeName, setPlaceName] = useState('');
  const [placeAddress, setPlaceAddress] = useState('');
  const [googlePlaceId, setGooglePlaceId] = useState('');
  const [placeResults, setPlaceResults] = useState<{ placeId: string; description: string }[]>([]);
  const [category, setCategory] = useState<QuickTripCategory | null>(null);
  const [occurredAt, setOccurredAt] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [companions, setCompanions] = useState<CompanionInput[]>([]);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Pre-populate from passed photoUris or open picker
  useEffect(() => {
    if (photoUris) {
      const uris = photoUris.split(',').filter(Boolean);
      if (uris.length > 0) {
        setPhotos(uris.map((uri) => ({ uri })));
        setPhase('review');
        return;
      }
    }
    pickPhotos();
  }, []);

  const pickPhotos = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: 10,
      quality: 0.8,
    });
    if (!result.canceled && result.assets.length > 0) {
      setPhotos((prev) => {
        const existing = new Set(prev.map((p) => p.uri));
        const newPhotos = result.assets.filter((a) => !existing.has(a.uri)).map((a) => ({ uri: a.uri }));
        return [...prev, ...newPhotos].slice(0, 10);
      });
    }
  };

  const takePhoto = async () => {
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotos((prev) => [...prev, { uri: result.assets[0].uri }].slice(0, 10));
    }
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  // Place autocomplete
  const onPlaceTextChange = useCallback((text: string) => {
    setPlaceName(text);
    setGooglePlaceId('');
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (text.trim().length < 2) {
      setPlaceResults([]);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      const results = await placeAutocomplete(text);
      setPlaceResults(results);
    }, 300);
  }, []);

  const selectPlace = (result: { placeId: string; description: string }) => {
    const shortName = result.description.split(',')[0] ?? result.description;
    setPlaceName(shortName);
    setPlaceAddress(result.description);
    setGooglePlaceId(result.placeId);
    setPlaceResults([]);
  };

  const handleSave = async () => {
    if (!placeName.trim() || !category || photos.length === 0) return;
    setSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const id = await createQuickTrip({
        title: title.trim() || undefined,
        placeName: placeName.trim(),
        placeAddress: placeAddress || undefined,
        googlePlaceId: googlePlaceId || undefined,
        category,
        occurredAt: occurredAt.toISOString(),
        notes: notes.trim() || undefined,
        photoUris: photos.map((p) => p.uri),
        companions,
      });
      if (returnTo === 'add-expense') {
        router.replace({ pathname: '/add-expense', params: { target: 'quick-trip', quickTripId: id } } as never);
      } else {
        router.replace({ pathname: '/quick-trip-detail', params: { quickTripId: id } } as never);
      }
    } catch {
      setSaving(false);
    }
  };

  // ---------- PHOTO PHASE ----------
  if (phase === 'photos') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
            <ArrowLeft size={20} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Select Photos</Text>
          <TouchableOpacity
            onPress={() => { if (photos.length > 0) setPhase('review'); }}
            style={[styles.headerBtn, photos.length === 0 && { opacity: 0.3 }]}
            disabled={photos.length === 0}
          >
            <Text style={styles.nextText}>Next</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.photoGrid}>
          <FlatList
            data={[...photos, { uri: '__add__' }, { uri: '__camera__' }]}
            keyExtractor={(item, i) => `${item.uri}-${i}`}
            numColumns={3}
            contentContainerStyle={styles.gridContent}
            columnWrapperStyle={styles.gridRow}
            renderItem={({ item, index }) => {
              if (item.uri === '__add__') {
                return (
                  <TouchableOpacity style={styles.addTile} onPress={pickPhotos} activeOpacity={0.7}>
                    <Plus size={24} color={colors.accent} />
                    <Text style={styles.addTileText}>Gallery</Text>
                  </TouchableOpacity>
                );
              }
              if (item.uri === '__camera__') {
                return (
                  <TouchableOpacity style={styles.addTile} onPress={takePhoto} activeOpacity={0.7}>
                    <Camera size={24} color={colors.accent} />
                    <Text style={styles.addTileText}>Camera</Text>
                  </TouchableOpacity>
                );
              }
              return (
                <TouchableOpacity
                  style={styles.photoTile}
                  onPress={() => removePhoto(index)}
                  activeOpacity={0.8}
                >
                  <Image source={{ uri: item.uri }} style={styles.photoImage} />
                  <View style={styles.photoBadge}>
                    <Text style={styles.photoBadgeText}>{index + 1}</Text>
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        </View>

        <View style={styles.photoFooter}>
          <Text style={styles.photoCount}>{photos.length}/10 photos selected</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ---------- REVIEW PHASE ----------
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setPhase('photos')} style={styles.headerBtn}>
          <ArrowLeft size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Quick Trip</Text>
        <TouchableOpacity
          onPress={handleSave}
          style={[styles.saveBtn, (!placeName.trim() || !category || saving) && { opacity: 0.4 }]}
          disabled={!placeName.trim() || !category || saving}
          activeOpacity={0.7}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Check size={16} color="#fff" />
              <Text style={styles.saveBtnText}>Save</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.reviewContent} showsVerticalScrollIndicator={false}>
        {/* Photo carousel */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.carousel}>
          {photos.map((p, i) => (
            <Image key={i} source={{ uri: p.uri }} style={styles.carouselImage} />
          ))}
          <TouchableOpacity style={styles.carouselAdd} onPress={pickPhotos}>
            <Plus size={20} color={colors.accent} />
          </TouchableOpacity>
        </ScrollView>

        {/* Place */}
        <Text style={styles.fieldLabel}>Where</Text>
        <View style={styles.fieldRow}>
          <MapPin size={16} color={colors.text3} />
          <TextInput
            style={styles.fieldInput}
            value={placeName}
            onChangeText={onPlaceTextChange}
            placeholder="Search place..."
            placeholderTextColor={colors.text3}
          />
        </View>
        {placeResults.length > 0 && (
          <View style={styles.placeResults}>
            {placeResults.slice(0, 4).map((r) => (
              <TouchableOpacity key={r.placeId} style={styles.placeRow} onPress={() => selectPlace(r)}>
                <MapPin size={13} color={colors.text3} />
                <Text style={styles.placeText} numberOfLines={1}>{r.description}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* When */}
        <Text style={styles.fieldLabel}>When</Text>
        <TouchableOpacity style={styles.fieldRow} onPress={() => setShowDatePicker(true)}>
          <Calendar size={16} color={colors.text3} />
          <Text style={styles.fieldValue}>
            {occurredAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            {' \u00B7 '}
            {occurredAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
          </Text>
        </TouchableOpacity>
        {showDatePicker && (
          <DateTimePicker
            value={occurredAt}
            mode="datetime"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(_, date) => {
              setShowDatePicker(Platform.OS !== 'ios');
              if (date) setOccurredAt(date);
            }}
          />
        )}

        {/* Category */}
        <Text style={styles.fieldLabel}>Category</Text>
        <CategoryChipSelector selected={category} onSelect={setCategory} colors={colors} />

        {/* Companions */}
        <Text style={styles.fieldLabel}>Who was there</Text>
        <CompanionChips
          companions={companions}
          onAdd={(c) => setCompanions((prev) => [...prev, c])}
          onRemove={(i) => setCompanions((prev) => prev.filter((_, idx) => idx !== i))}
          colors={colors}
        />

        {/* Title */}
        <Text style={styles.fieldLabel}>Title (optional)</Text>
        <TextInput
          style={styles.textInput}
          value={title}
          onChangeText={setTitle}
          placeholder={placeName ? `Trip to ${placeName}` : 'Auto-generated from place'}
          placeholderTextColor={colors.text3}
        />

        {/* Notes */}
        <Text style={styles.fieldLabel}>Notes (optional)</Text>
        <TextInput
          style={[styles.textInput, styles.textArea]}
          value={notes}
          onChangeText={setNotes}
          placeholder="What happened..."
          placeholderTextColor={colors.text3}
          multiline
          numberOfLines={3}
        />

        <View style={{ height: 60 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 16, paddingVertical: 10,
    },
    headerBtn: {
      width: 36, height: 36, borderRadius: 12, backgroundColor: colors.card,
      borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center',
    },
    headerTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
    nextText: { fontSize: 14, fontWeight: '700', color: colors.accent },
    saveBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
      paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12,
      backgroundColor: colors.accent,
    },
    saveBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },

    // Photo phase
    photoGrid: { flex: 1 },
    gridContent: { paddingHorizontal: 12, paddingTop: 8 },
    gridRow: { gap: 6, marginBottom: 6 },
    photoTile: { flex: 1, aspectRatio: 1, borderRadius: 12, overflow: 'hidden', position: 'relative' },
    photoImage: { width: '100%', height: '100%' },
    photoBadge: {
      position: 'absolute', top: 6, left: 6,
      width: 22, height: 22, borderRadius: 11,
      backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center',
    },
    photoBadgeText: { fontSize: 11, fontWeight: '700', color: '#fff' },
    addTile: {
      flex: 1, aspectRatio: 1, borderRadius: 12,
      borderWidth: 1.5, borderColor: colors.accentBorder, borderStyle: 'dashed',
      alignItems: 'center', justifyContent: 'center', gap: 4,
    },
    addTileText: { fontSize: 11, fontWeight: '600', color: colors.accent },
    photoFooter: { paddingVertical: 12, alignItems: 'center' },
    photoCount: { fontSize: 13, fontWeight: '600', color: colors.text3 },

    // Review phase
    reviewContent: { paddingHorizontal: 20, paddingTop: 8 },
    carousel: { marginBottom: 20, marginHorizontal: -20, paddingHorizontal: 20 },
    carouselImage: { width: 160, height: 120, borderRadius: 14, marginRight: 8 },
    carouselAdd: {
      width: 60, height: 120, borderRadius: 14,
      borderWidth: 1.5, borderColor: colors.accentBorder, borderStyle: 'dashed',
      alignItems: 'center', justifyContent: 'center',
    },

    fieldLabel: {
      fontSize: 11, fontWeight: '600', color: colors.text3,
      textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 8, marginTop: 18,
    },
    fieldRow: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      paddingHorizontal: 14, paddingVertical: 12,
      backgroundColor: colors.card, borderRadius: 14,
      borderWidth: 1, borderColor: colors.border,
    },
    fieldInput: { flex: 1, fontSize: 14, color: colors.text, paddingVertical: 0 },
    fieldValue: { fontSize: 14, color: colors.text },

    placeResults: {
      marginTop: 4, backgroundColor: colors.card,
      borderRadius: 12, borderWidth: 1, borderColor: colors.border, overflow: 'hidden',
    },
    placeRow: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      paddingHorizontal: 14, paddingVertical: 10,
      borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    placeText: { flex: 1, fontSize: 13, color: colors.text2 },

    textInput: {
      fontSize: 14, color: colors.text, paddingHorizontal: 14, paddingVertical: 12,
      backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border,
    },
    textArea: { minHeight: 80, textAlignVertical: 'top' },
  });
