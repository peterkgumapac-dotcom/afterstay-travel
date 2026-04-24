import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Phone, Globe, MapPin, Bookmark, Star } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import {
  Dimensions,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import AfterStayLoader from '@/components/AfterStayLoader';
import { useTheme, ThemeColors } from '@/constants/ThemeContext';
import { radius, spacing } from '@/constants/theme';
import { getPlaceDetails, type PlaceDetails } from '@/lib/google-places';
import { addPlace } from '@/lib/supabase';

function priceLevelString(level?: number): string {
  if (level == null) return '';
  return '$'.repeat(level);
}

export default function PlaceDetailsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const { placeId, placeName } = useLocalSearchParams<{ placeId: string; placeName?: string }>();
  const router = useRouter();
  const [details, setDetails] = useState<PlaceDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!placeId) return;
    let cancelled = false;
    (async () => {
      try {
        setError(undefined);
        const result = await getPlaceDetails(placeId);
        if (!cancelled) {
          if (result) {
            setDetails(result);
          } else {
            // No details from API — open Google Maps directly and go back
            const query = placeName ? encodeURIComponent(placeName + ' Boracay') : '';
            const fallbackUrl = `https://www.google.com/maps/search/?api=1&query=${query}&query_place_id=${placeId}`;
            try {
              await Linking.openURL(fallbackUrl);
            } catch {
              if (__DEV__) console.warn('Failed to open URL:', fallbackUrl);
            }
            if (router.canGoBack()) router.back();
          }
        }
      } catch {
        if (!cancelled) {
          // On error, open Google Maps as fallback
          const query = placeName ? encodeURIComponent(placeName + ' Boracay') : '';
          const fallbackUrl = `https://www.google.com/maps/search/?api=1&query=${query}&query_place_id=${placeId}`;
          try {
            await Linking.openURL(fallbackUrl);
          } catch {
            if (__DEV__) console.warn('Failed to open URL:', fallbackUrl);
          }
          if (router.canGoBack()) router.back();
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [placeId, placeName, router]);

  const onSaveToTrip = async () => {
    if (!details || saving || !placeId) return;
    setSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await addPlace({
        name: details.name,
        category: 'Do',
        rating: details.rating,
        source: 'Manual',
        vote: 'Pending',
        photoUrl: details.photos[0] ?? undefined,
        googlePlaceId: placeId,
        googleMapsUri: details.url ?? `https://www.google.com/maps/place/?q=place_id:${placeId}`,
        saved: true,
        notes: details.formatted_address,
        priceEstimate: priceLevelString(details.price_level) || undefined,
      });
      setSaved(true);
    } catch {
      // Save failed
    } finally {
      setSaving(false);
    }
  };

  const onOpenMaps = async () => {
    if (!placeId) return;
    const url = details?.url ?? `https://www.google.com/maps/place/?q=place_id:${placeId}`;
    try {
      await Linking.openURL(url);
    } catch {
      if (__DEV__) console.warn('Failed to open URL:', url);
    }
  };

  const onCallPhone = async () => {
    if (!details?.formatted_phone_number) return;
    const url = `tel:${details.formatted_phone_number}`;
    try {
      await Linking.openURL(url);
    } catch {
      if (__DEV__) console.warn('Failed to open URL:', url);
    }
  };

  const onOpenWebsite = async () => {
    if (!details?.website) return;
    const url = details.website;
    try {
      await Linking.openURL(url);
    } catch {
      if (__DEV__) console.warn('Failed to open URL:', url);
    }
  };

  if (loading) {
    return <AfterStayLoader message="Loading place details..." />;
  }

  if (error || !details) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errText}>{error ?? 'Something went wrong.'}</Text>
      </View>
    );
  }

  const priceStr = priceLevelString(details.price_level);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Photo carousel */}
        {details.photos.length > 0 && (
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            style={styles.photoCarousel}
          >
            {details.photos.map((url, i) => (
              <Image key={`photo-${i}`} source={{ uri: url }} style={styles.photo} />
            ))}
          </ScrollView>
        )}

        <View style={styles.body}>
          {/* Name & rating */}
          <Text style={styles.name}>{details.name}</Text>
          <View style={styles.ratingRow}>
            <Star size={16} color={colors.amber} fill={colors.amber} />
            <Text style={styles.ratingText}>
              {details.rating.toFixed(1)}
              {priceStr ? ` · ${priceStr}` : ''}
            </Text>
          </View>

          {/* Address */}
          <View style={styles.infoRow}>
            <MapPin size={14} color={colors.text2} />
            <Text style={styles.infoText}>{details.formatted_address}</Text>
          </View>

          {/* Phone */}
          {details.formatted_phone_number && (
            <Pressable style={styles.infoRow} onPress={onCallPhone} accessibilityLabel="Call phone number" accessibilityRole="button">
              <Phone size={14} color={colors.blue} />
              <Text style={[styles.infoText, styles.linkText]}>{details.formatted_phone_number}</Text>
            </Pressable>
          )}

          {/* Website */}
          {details.website && (
            <Pressable style={styles.infoRow} onPress={onOpenWebsite} accessibilityLabel="Open website" accessibilityRole="link">
              <Globe size={14} color={colors.blue} />
              <Text style={[styles.infoText, styles.linkText]} numberOfLines={1}>
                {details.website}
              </Text>
            </Pressable>
          )}

          {/* Editorial summary */}
          {details.editorial_summary && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>About</Text>
              <Text style={styles.summaryText}>{details.editorial_summary}</Text>
            </View>
          )}

          {/* Opening hours */}
          {details.opening_hours && details.opening_hours.weekday_text.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Hours</Text>
              {details.opening_hours.weekday_text.map((line, i) => (
                <Text key={`hour-${i}`} style={styles.hoursLine}>{line}</Text>
              ))}
            </View>
          )}

          {/* Reviews */}
          {details.reviews && details.reviews.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Reviews</Text>
              {details.reviews.map((review, i) => (
                <View key={`review-${i}`} style={styles.reviewCard}>
                  <View style={styles.reviewHeader}>
                    <Text style={styles.reviewAuthor}>{review.author_name}</Text>
                    <Text style={styles.reviewTime}>{review.relative_time_description}</Text>
                  </View>
                  <View style={styles.reviewRatingRow}>
                    {Array.from({ length: 5 }).map((_, si) => (
                      <Star
                        key={`star-${i}-${si}`}
                        size={12}
                        color={si < review.rating ? colors.amber : colors.text3}
                        fill={si < review.rating ? colors.amber : 'transparent'}
                      />
                    ))}
                  </View>
                  <Text style={styles.reviewText} numberOfLines={4}>{review.text}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Bottom action bar */}
      <View style={styles.bottomBar}>
        <Pressable
          style={[styles.bottomBtn, styles.saveBtn]}
          onPress={onSaveToTrip}
          disabled={saving || saved}
          accessibilityLabel={saved ? 'Place saved' : saving ? 'Saving place' : 'Save to trip'}
          accessibilityRole="button"
        >
          <Bookmark size={16} color={colors.white} />
          <Text style={styles.bottomBtnText}>
            {saved ? 'Saved!' : saving ? 'Saving...' : 'Save to Trip'}
          </Text>
        </Pressable>
        <Pressable style={[styles.bottomBtn, styles.mapsBtn]} onPress={onOpenMaps} accessibilityLabel="Open in Maps" accessibilityRole="button">
          <MapPin size={16} color={colors.green2} />
          <Text style={styles.mapsBtnText}>Open in Maps</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: spacing.xxxl },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  errText: { color: colors.red, fontSize: 14, textAlign: 'center' },

  // Photo carousel
  photoCarousel: { height: 250 },
  photo: { width: Dimensions.get('window').width, height: 250 },

  // Body
  body: { padding: spacing.lg, gap: spacing.md },
  name: { color: colors.text, fontSize: 22, fontWeight: '800', letterSpacing: -0.3 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ratingText: { color: colors.amber, fontSize: 15, fontWeight: '600' },

  // Info rows
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoText: { color: colors.text2, fontSize: 13, flex: 1 },
  linkText: { color: colors.blue },

  // Sections
  section: { gap: spacing.sm },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  summaryText: { color: colors.text2, fontSize: 14, lineHeight: 20 },
  hoursLine: { color: colors.text2, fontSize: 13 },

  // Reviews
  reviewCard: {
    backgroundColor: colors.bg3,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 4,
  },
  reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  reviewAuthor: { color: colors.text, fontSize: 13, fontWeight: '600' },
  reviewTime: { color: colors.text3, fontSize: 11 },
  reviewRatingRow: { flexDirection: 'row', gap: 2, marginVertical: 2 },
  reviewText: { color: colors.text2, fontSize: 13, lineHeight: 18 },

  // Bottom bar
  bottomBar: {
    flexDirection: 'row',
    padding: spacing.lg,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
  bottomBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: radius.md,
  },
  saveBtn: { backgroundColor: colors.green },
  bottomBtnText: { color: colors.white, fontSize: 14, fontWeight: '700' },
  mapsBtn: { backgroundColor: colors.bg3, borderWidth: 1, borderColor: colors.border },
  mapsBtnText: { color: colors.green2, fontSize: 14, fontWeight: '700' },
});
