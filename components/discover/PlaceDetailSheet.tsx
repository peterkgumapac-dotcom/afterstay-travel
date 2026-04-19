import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Dimensions,
  Linking,
  StyleSheet,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import MiniLoader from '@/components/loader/MiniLoader';
import {
  X,
  Star,
  MapPin,
  Phone,
  Globe,
  Clock,
  Bookmark,
  BookmarkCheck,
  Navigation,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { fetchPlaceDetails, PlaceDetails, Review } from '../../lib/placeDetails';
import { formatDistance, estimateWalkTime } from '../../lib/distance';
import { useTheme } from '@/constants/ThemeContext';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.92;
const PHOTO_WIDTH = SCREEN_WIDTH - 32;
const PHOTO_HEIGHT = 220;

// ── Props ───────────────────────────────────────────────────────────────
interface Props {
  visible: boolean;
  placeId: string | null;
  initialName?: string;
  saved?: boolean;
  onClose: () => void;
  onSaveToggle?: () => void;
  distanceKm?: number;
}

// ── Helpers ─────────────────────────────────────────────────────────────
const renderStars = (rating: number, colors: any) => {
  const starColor = colors.warn;
  const stars: React.ReactNode[] = [];
  for (let i = 1; i <= 5; i++) {
    stars.push(
      <Star
        key={i}
        size={14}
        color={starColor}
        fill={i <= Math.round(rating) ? starColor : 'transparent'}
      />,
    );
  }
  return stars;
};

const priceLabel = (level?: number): string => {
  if (level == null) return '';
  return '$'.repeat(level);
};

// ── Photo Gallery ───────────────────────────────────────────────────────
const PhotoGallery = ({ photos }: { photos: string[] }) => {
  const { colors } = useTheme();
  const s = getStyles(colors);
  const [activeIdx, setActiveIdx] = useState(0);

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / PHOTO_WIDTH);
    setActiveIdx(idx);
  };

  if (photos.length === 0) {
    return (
      <View style={[s.photoPlaceholder, { height: PHOTO_HEIGHT }]}>
        <MapPin size={40} color={colors.text3} />
        <Text style={[s.mutedText, { marginTop: 8 }]}>No photos available</Text>
      </View>
    );
  }

  return (
    <View>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        style={{ marginHorizontal: 16 }}
      >
        {photos.map((uri, i) => (
          <Image
            key={i}
            source={{ uri }}
            style={s.photo}
            resizeMode="cover"
          />
        ))}
      </ScrollView>
      {photos.length > 1 && (
        <View style={s.dotRow}>
          {photos.map((_, i) => (
            <View
              key={i}
              style={[s.dot, activeIdx === i && s.dotActive]}
            />
          ))}
        </View>
      )}
    </View>
  );
};

// ── Review Card ─────────────────────────────────────────────────────────
const ReviewCard = ({ review }: { review: Review }) => {
  const { colors } = useTheme();
  const s = getStyles(colors);

  return (
    <View style={s.reviewCard}>
      <View style={s.reviewHeader}>
        {review.authorPhoto ? (
          <Image source={{ uri: review.authorPhoto }} style={s.avatar} />
        ) : (
          <View style={s.avatarFallback}>
            <Text style={s.avatarLetter}>
              {review.authorName.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={s.reviewAuthor}>{review.authorName}</Text>
          <View style={s.reviewMeta}>
            <View style={s.starRow}>{renderStars(review.rating, colors)}</View>
            <Text style={s.relativeTime}>{review.relativeTime}</Text>
          </View>
        </View>
      </View>
      {review.text ? (
        <Text style={s.reviewText}>{review.text}</Text>
      ) : null}
    </View>
  );
};

// ── Main Component ──────────────────────────────────────────────────────
export const PlaceDetailSheet: React.FC<Props> = ({
  visible,
  placeId,
  initialName,
  saved = false,
  onClose,
  onSaveToggle,
  distanceKm,
}) => {
  const { colors } = useTheme();
  const s = getStyles(colors);
  const [details, setDetails] = useState<PlaceDetails | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible || !placeId) {
      setDetails(null);
      return;
    }
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const result = await fetchPlaceDetails(placeId);
      if (!cancelled) {
        setDetails(result);
        setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [visible, placeId]);

  const handleSave = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSaveToggle?.();
  };

  const handleDirections = () => {
    if (!details?.coords) return;
    const { lat, lng } = details.coords;
    Linking.openURL(
      `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
    );
  };

  const handleCall = () => {
    if (!details?.phone) return;
    Linking.openURL(`tel:${details.phone}`);
  };

  const handleWebsite = () => {
    if (!details?.website) return;
    Linking.openURL(details.website);
  };

  const displayName = details?.name ?? initialName ?? 'Place Details';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={s.overlay}>
        <View style={s.sheet}>
          {/* Drag handle */}
          <View style={s.handleRow}>
            <View style={s.handle} />
          </View>

          {/* Header */}
          <View style={s.header}>
            <Text style={s.title} numberOfLines={2}>
              {displayName}
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={12} style={s.closeBtn}>
              <X size={22} color={colors.text2} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={s.loaderWrap}>
              <MiniLoader size={56} message="Loading details\u2026" />
            </View>
          ) : details ? (
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 40 }}
            >
              {/* Photo gallery */}
              <PhotoGallery photos={details.photos} />

              {/* Stats row */}
              <View style={s.statsRow}>
                {details.rating != null && (
                  <View style={s.statChip}>
                    <Star size={14} color={colors.warn} fill={colors.warn} />
                    <Text style={s.statValue}>
                      {details.rating.toFixed(1)}
                    </Text>
                    {details.totalReviews != null && (
                      <Text style={s.statSub}>
                        ({details.totalReviews.toLocaleString()})
                      </Text>
                    )}
                  </View>
                )}
                {distanceKm != null && (
                  <View style={s.statChip}>
                    <MapPin size={14} color={colors.accent} />
                    <Text style={s.statValue}>
                      {formatDistance(distanceKm)}
                    </Text>
                    <Text style={s.statSub}>
                      {estimateWalkTime(distanceKm)}
                    </Text>
                  </View>
                )}
                {details.priceLevel != null && details.priceLevel > 0 && (
                  <View style={s.statChip}>
                    <Text style={[s.statValue, { color: colors.accent }]}>
                      {priceLabel(details.priceLevel)}
                    </Text>
                  </View>
                )}
              </View>

              {/* Open now badge */}
              {details.isOpenNow != null && (
                <View style={s.badgeRow}>
                  <Clock size={14} color={details.isOpenNow ? colors.accent : colors.danger} />
                  <Text
                    style={[
                      s.badgeText,
                      { color: details.isOpenNow ? colors.accent : colors.danger },
                    ]}
                  >
                    {details.isOpenNow ? 'Open now' : 'Closed'}
                  </Text>
                </View>
              )}

              {/* Action buttons */}
              <View style={s.actionsRow}>
                <TouchableOpacity style={s.actionBtn} onPress={handleSave}>
                  {saved ? (
                    <BookmarkCheck size={20} color={colors.accent} />
                  ) : (
                    <Bookmark size={20} color={colors.text2} />
                  )}
                  <Text style={[s.actionLabel, saved && { color: colors.accent }]}>
                    {saved ? 'Saved' : 'Save'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity style={s.actionBtn} onPress={handleDirections}>
                  <Navigation size={20} color={colors.accent} />
                  <Text style={s.actionLabel}>Directions</Text>
                </TouchableOpacity>

                {details.phone && (
                  <TouchableOpacity style={s.actionBtn} onPress={handleCall}>
                    <Phone size={20} color={colors.accent} />
                    <Text style={s.actionLabel}>Call</Text>
                  </TouchableOpacity>
                )}

                {details.website && (
                  <TouchableOpacity style={s.actionBtn} onPress={handleWebsite}>
                    <Globe size={20} color={colors.accent} />
                    <Text style={s.actionLabel}>Website</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Address */}
              {details.address && (
                <View style={s.section}>
                  <View style={s.infoRow}>
                    <MapPin size={16} color={colors.text2} />
                    <Text style={s.infoText}>{details.address}</Text>
                  </View>
                </View>
              )}

              {/* Opening hours */}
              {details.openingHours && details.openingHours.length > 0 && (
                <View style={s.section}>
                  <Text style={s.sectionTitle}>Opening Hours</Text>
                  <View style={s.hoursCard}>
                    {details.openingHours.map((line, i) => (
                      <Text key={i} style={s.hourLine}>
                        {line}
                      </Text>
                    ))}
                  </View>
                </View>
              )}

              {/* Reviews */}
              {details.reviews.length > 0 && (
                <View style={s.section}>
                  <Text style={s.sectionTitle}>
                    Reviews ({details.reviews.length})
                  </Text>
                  {details.reviews.map((rv, i) => (
                    <ReviewCard key={i} review={rv} />
                  ))}
                </View>
              )}
            </ScrollView>
          ) : (
            <View style={s.loaderWrap}>
              <Text style={s.mutedText}>Could not load details.</Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

export default PlaceDetailSheet;

// ── Styles ──────────────────────────────────────────────────────────────
const getStyles = (colors: any) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    height: SHEET_HEIGHT,
    backgroundColor: colors.canvas,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  handleRow: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 4,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.text3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  title: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  closeBtn: {
    marginLeft: 12,
    padding: 4,
  },
  loaderWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mutedText: {
    color: colors.text2,
    fontSize: 14,
  },

  // Photos
  photo: {
    width: PHOTO_WIDTH,
    height: PHOTO_HEIGHT,
    borderRadius: 12,
    marginRight: 8,
  },
  photoPlaceholder: {
    marginHorizontal: 16,
    borderRadius: 12,
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dotRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 8,
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.text3,
  },
  dotActive: {
    backgroundColor: colors.accent,
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    marginTop: 14,
    gap: 10,
  },
  statChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  statValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  statSub: {
    color: colors.text2,
    fontSize: 12,
  },

  // Badge
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginTop: 10,
    gap: 6,
  },
  badgeText: {
    fontSize: 14,
    fontWeight: '600',
  },

  // Actions
  actionsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginTop: 16,
    gap: 12,
  },
  actionBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border2,
    gap: 4,
  },
  actionLabel: {
    color: colors.text2,
    fontSize: 11,
    fontWeight: '500',
  },

  // Sections
  section: {
    paddingHorizontal: 16,
    marginTop: 18,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  infoText: {
    flex: 1,
    color: colors.text2,
    fontSize: 14,
    lineHeight: 20,
  },

  // Hours
  hoursCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border2,
  },
  hourLine: {
    color: colors.text2,
    fontSize: 13,
    lineHeight: 22,
  },

  // Reviews
  reviewCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border2,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  avatarFallback: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.border2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarLetter: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  reviewAuthor: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  reviewMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    gap: 8,
  },
  starRow: {
    flexDirection: 'row',
    gap: 2,
  },
  relativeTime: {
    color: colors.text3,
    fontSize: 12,
  },
  reviewText: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 10,
  },
});
