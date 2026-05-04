import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import Svg, { Path } from 'react-native-svg';
import { Footprints, Car, MapPin, Navigation, Plus, Users } from 'lucide-react-native';

import { useTheme } from '@/constants/ThemeContext';
import { spacing, radius } from '@/constants/theme';
import { fmtKm, travelTime as calcTravelTime } from '@/lib/utils';
import type { PlaceVote } from '@/lib/types';

type ThemeColors = ReturnType<typeof useTheme>['colors'];

const CATEGORY_LABELS: Record<string, string> = {
  tourist_attraction: 'Attraction',
  natural_feature: 'Nature',
  point_of_interest: 'Spot',
  establishment: 'Place',
  park: 'Park',
  lodging: 'Hotel',
  restaurant: 'Restaurant',
  cafe: 'Café',
  bar: 'Bar',
  store: 'Shopping',
  shopping_mall: 'Shopping',
};

export function friendlyCategory(t: string): string {
  return CATEGORY_LABELS[t.toLowerCase()] ?? t;
}

export interface DiscoverPlace {
  n: string;
  t: string;
  r: number;
  rv: string;
  d: string;
  dn: number;
  price: number;
  openNow: boolean;
  img: string;
  placeId?: string;
  address?: string;
  mapsUrl?: string;
  businessStatus?: string;
  lat?: number;
  lng?: number;
  totalRatings?: number;
  types?: string[];
  summary?: string;
}

interface DiscoverPlaceCardProps {
  place: DiscoverPlace;
  distanceKm?: number;
  travelMode?: 'walk' | 'car';
  isSaved: boolean;
  isRecommended: boolean;
  onSave: (name: string) => void;
  onRecommend: (name: string) => void;
  saveActionLabel?: string;
  savedActionLabel?: string;
  onExplore?: (placeId: string | undefined, name: string) => void;
  onAddToPlanner?: (place: DiscoverPlace) => void;
  /** Whether to show the recommend-to-group button */
  showRecommend?: boolean;
  /** Per-member votes for group consensus display */
  voteByMember?: Record<string, PlaceVote>;
  /** Member ID → display name for avatar initials */
  memberNames?: Record<string, string>;
  totalMembers?: number;
  onVoteTap?: (placeName: string) => void;
}

const VOTE_COLORS = ['#a64d1e', '#b8892b', '#c66a36', '#8a5a2b', '#7e9f5b']
const THUMB_FALLBACK = 'https://images.unsplash.com/photo-1506929562872-bb421503ef21?w=800&q=80';

export const DiscoverPlaceCard = React.memo(function DiscoverPlaceCard({
  place,
  distanceKm = 0,
  travelMode = 'walk',
  isSaved,
  onSave,
  onRecommend,
  saveActionLabel = 'Save',
  savedActionLabel = 'Saved',
  onExplore,
  onAddToPlanner,
  showRecommend,
  isRecommended,
  voteByMember,
  memberNames,
  totalMembers,
  onVoteTap,
}: DiscoverPlaceCardProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [imageUri, setImageUri] = useState(place.img || THUMB_FALLBACK);

  useEffect(() => {
    setImageUri(place.img || THUMB_FALLBACK);
  }, [place.img]);

  // Cap absurd distances (emulator GPS in wrong location)
  const validDistance = distanceKm > 0 && distanceKm < 50;
  const travelTimeLabel = useMemo(
    () => validDistance ? calcTravelTime(distanceKm, travelMode) : null,
    [validDistance, distanceKm, travelMode],
  );
  const distanceLabel = useMemo(
    () => validDistance ? fmtKm(distanceKm) : null,
    [validDistance, distanceKm],
  );
  const groupVoteSummary = useMemo(() => {
    if (!showRecommend || !totalMembers || totalMembers < 2) return null;
    const voted = Object.keys(voteByMember ?? {}).length;
    const pending = Math.max(totalMembers - voted, 0);
    return `${voted}/${totalMembers} voted${pending > 0 ? ` · ${pending} pending` : ''}`;
  }, [showRecommend, totalMembers, voteByMember]);
  const mapsUrl = useMemo(() => {
    if (place.mapsUrl) return place.mapsUrl;
    if (place.placeId) {
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.n)}&query_place_id=${place.placeId}`;
    }
    if (place.lat != null && place.lng != null) {
      return `https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lng}`;
    }
    return `https://www.google.com/maps/search/${encodeURIComponent(place.n)}`;
  }, [place.lat, place.lng, place.mapsUrl, place.n, place.placeId]);
  const handleOpenMaps = useCallback(async (event?: { stopPropagation?: () => void }) => {
    event?.stopPropagation?.();
    try {
      await Linking.openURL(mapsUrl);
    } catch {
      if (__DEV__) console.warn('[DiscoverPlaceCard] Failed to open maps URL:', mapsUrl);
    }
  }, [mapsUrl]);

  return (
    <TouchableOpacity
      style={styles.row}
      activeOpacity={0.7}
      onPress={() => onExplore?.(place.placeId, place.n)}
      accessibilityRole="button"
      accessibilityLabel={`View details for ${place.n}`}
    >
      {/* Thumbnail */}
      <ExpoImage
        source={{ uri: imageUri }}
        style={styles.thumb}
        contentFit="cover"
        cachePolicy="disk"
        transition={160}
        onError={() => {
          if (imageUri !== THUMB_FALLBACK) setImageUri(THUMB_FALLBACK);
        }}
      />

      {/* Info */}
      <View style={styles.info}>
        {/* Category + open/closed */}
        <View style={styles.tagRow}>
          <Text style={styles.category}>{friendlyCategory(place.t).toUpperCase()}</Text>
          {place.openNow ? (
            <View style={styles.openBadge}>
              <Text style={styles.openText}>OPEN</Text>
            </View>
          ) : (
            <View style={styles.closedBadge}>
              <Text style={styles.closedText}>CLOSED</Text>
            </View>
          )}
        </View>

        {/* Name */}
        <Text style={styles.name} numberOfLines={1}>{place.n}</Text>

        {/* Editorial summary — "why go" */}
        {place.summary ? (
          <Text style={styles.summary} numberOfLines={1}>{place.summary}</Text>
        ) : null}

        {/* Rating · travel time · distance */}
        <View style={styles.metaRow}>
          <Svg width={10} height={10} viewBox="0 0 24 24" fill={colors.warn}>
            <Path d="M12 2l2.9 6.7L22 9.3l-5 4.9 1.2 7.1L12 18l-6.2 3.3L7 14.2 2 9.3l7.1-.6z" />
          </Svg>
          <Text style={styles.rating}>{place.r}</Text>
          {place.rv ? <Text style={styles.meta}>({place.rv})</Text> : null}
          <Text style={styles.dot}>·</Text>
          {travelMode === 'walk'
            ? <Footprints size={10} color={colors.text2} strokeWidth={1.8} />
            : <Car size={10} color={colors.text2} strokeWidth={1.8} />
          }
          <Text style={styles.meta}>{travelTimeLabel || place.d}</Text>
          {distanceLabel && (
            <>
              <Text style={styles.dot}>·</Text>
              <Text style={styles.meta}>{distanceLabel}</Text>
            </>
          )}
        </View>

        {place.address ? (
          <View style={styles.addressRow}>
            <MapPin size={11} color={colors.text3} strokeWidth={1.8} />
            <Text style={styles.addressText} numberOfLines={1}>{place.address}</Text>
          </View>
        ) : null}

        <Pressable
          style={styles.mapsPill}
          onPress={handleOpenMaps}
          hitSlop={4}
          accessibilityRole="button"
          accessibilityLabel={`Open ${place.n} in Google Maps`}
        >
          <Navigation size={11} color={colors.accent} strokeWidth={2} />
          <Text style={styles.mapsPillText}>Maps</Text>
        </Pressable>

        {/* Vote consensus row — only when vote data exists */}
        {voteByMember && totalMembers && totalMembers >= 2 && Object.keys(voteByMember).length > 0 && (
          <Pressable
            style={styles.voteRow}
            onPress={(e) => { e.stopPropagation?.(); onVoteTap?.(place.n); }}
            hitSlop={4}
          >
            {/* Overlapping avatar circles */}
            <View style={styles.voteAvatars}>
              {Object.keys(voteByMember).slice(0, 3).map((memberId, i) => {
                const initial = memberNames?.[memberId]?.charAt(0).toUpperCase() ?? '?'
                return (
                  <View
                    key={memberId}
                    style={[
                      styles.voteAvatar,
                      {
                        backgroundColor: VOTE_COLORS[i % VOTE_COLORS.length],
                        marginLeft: i === 0 ? 0 : -6,
                        zIndex: 3 - i,
                      },
                    ]}
                  >
                    <Text style={styles.voteAvatarText}>{initial}</Text>
                  </View>
                )
              })}
              {Object.keys(voteByMember).length > 3 && (
                <View style={[styles.voteAvatar, { backgroundColor: colors.bg3, marginLeft: -6 }]}>
                  <Text style={[styles.voteAvatarText, { color: colors.text2 }]}>
                    +{Object.keys(voteByMember).length - 3}
                  </Text>
                </View>
              )}
            </View>
            {/* Summary text */}
            {(() => {
              const yes = Object.values(voteByMember).filter((v) => v === '👍 Yes').length
              const voted = Object.keys(voteByMember).length
              const pending = totalMembers - voted
              return (
                <Text style={styles.voteSummary} numberOfLines={1}>
                  {yes > 0 ? `${yes}/${totalMembers} yes` : `${voted} voted`}
                  {pending > 0 ? ` · ${pending} pending` : ''}
                </Text>
              )
            })()}
          </Pressable>
        )}

        {showRecommend && (
          <View style={styles.groupActionRow}>
            <Pressable
              style={[styles.recommendPill, isRecommended && styles.recommendPillActive]}
              onPress={(e) => { e.stopPropagation?.(); onRecommend(place.n); }}
              hitSlop={4}
              accessibilityRole="button"
              accessibilityLabel={isRecommended ? 'Recommended' : 'Recommend to group'}
            >
              <Users size={12} color={isRecommended ? colors.onBlack : colors.accent} strokeWidth={2} />
              <Text style={[styles.recommendPillText, isRecommended && styles.recommendPillTextActive]}>
                {isRecommended ? 'Recommended' : 'Recommend'}
              </Text>
            </Pressable>
            {groupVoteSummary ? (
              <Pressable
                onPress={(e) => { e.stopPropagation?.(); onVoteTap?.(place.n); }}
                hitSlop={4}
              >
                <Text style={styles.groupVoteText}>{groupVoteSummary}</Text>
              </Pressable>
            ) : null}
          </View>
        )}
      </View>

      {/* Add to planner */}
      {onAddToPlanner && (
        <TouchableOpacity
          onPress={(e) => { e.stopPropagation?.(); onAddToPlanner(place); }}
          style={styles.addBtn}
          activeOpacity={0.6}
          accessibilityRole="button"
          accessibilityLabel="Add to planner"
          hitSlop={8}
        >
          <Plus size={16} color={colors.text3} strokeWidth={2} />
        </TouchableOpacity>
      )}

      {/* Bookmark */}
      <TouchableOpacity
        onPress={(e) => { e.stopPropagation?.(); onSave(place.n); }}
        style={styles.bookmarkBtn}
        activeOpacity={0.6}
        accessibilityRole="button"
          accessibilityLabel={isSaved ? `Remove from ${savedActionLabel.toLowerCase()}` : saveActionLabel}
        hitSlop={8}
      >
        <Svg
          width={16}
          height={16}
          viewBox="0 0 24 24"
          fill={isSaved ? colors.accent : 'none'}
          stroke={isSaved ? colors.accent : colors.text3}
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <Path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
        </Svg>
      </TouchableOpacity>
    </TouchableOpacity>
  );
});

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    thumb: {
      width: 90,
      height: 90,
      borderRadius: radius.md,
      backgroundColor: colors.card2,
    },
    info: {
      flex: 1,
      minWidth: 0,
      overflow: 'hidden',
    },
    tagRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 2,
    },
    category: {
      fontSize: 10,
      fontWeight: '600',
      letterSpacing: 0.8,
      color: colors.accent,
    },
    openBadge: {
      paddingVertical: 1,
      paddingHorizontal: 6,
      borderRadius: radius.pill,
      backgroundColor: 'rgba(125,220,150,0.14)',
    },
    openText: {
      fontSize: 9,
      fontWeight: '600',
      color: '#2f7a46',
    },
    closedBadge: {
      paddingVertical: 1,
      paddingHorizontal: 6,
      borderRadius: radius.pill,
      backgroundColor: colors.card2,
    },
    closedText: {
      fontSize: 9,
      fontWeight: '600',
      color: colors.text3,
    },
    name: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    summary: {
      fontSize: 11,
      color: colors.text3,
      marginTop: 1,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 4,
      marginTop: 4,
    },
    rating: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.warn,
    },
    dot: {
      fontSize: 11,
      color: colors.text3,
    },
    meta: {
      fontSize: 11,
      color: colors.text3,
    },
    addressRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: 4,
      maxWidth: '96%',
    },
    addressText: {
      flex: 1,
      fontSize: 11,
      color: colors.text3,
    },
    mapsPill: {
      marginTop: 6,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      alignSelf: 'flex-start',
      paddingVertical: 4,
      paddingHorizontal: 8,
      borderRadius: 999,
      backgroundColor: colors.accentBg,
    },
    mapsPillText: {
      fontSize: 10.5,
      fontWeight: '700',
      color: colors.accent,
    },
    addBtn: {
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 44,
    },
    bookmarkBtn: {
      width: 36,
      height: 36,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 44,
    },
    // Vote consensus row
    voteRow: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 6,
      marginTop: 6,
      paddingVertical: 3,
      paddingHorizontal: 6,
      backgroundColor: colors.bg3,
      borderRadius: 8,
      alignSelf: 'flex-start' as const,
    },
    voteAvatars: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
    },
    voteAvatar: {
      width: 20,
      height: 20,
      borderRadius: 10,
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
      borderWidth: 1.5,
      borderColor: colors.bg3,
    },
    voteAvatarText: {
      fontSize: 9,
      fontWeight: '700' as const,
      color: '#fff',
    },
    voteSummary: {
      fontSize: 10,
      fontWeight: '500' as const,
      color: colors.text2,
      flexShrink: 1,
    },
    groupActionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 7,
    },
    recommendPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingVertical: 5,
      paddingHorizontal: 9,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    recommendPillActive: {
      backgroundColor: colors.black,
      borderColor: colors.black,
    },
    recommendPillText: {
      fontSize: 10.5,
      fontWeight: '700',
      color: colors.accent,
    },
    recommendPillTextActive: {
      color: colors.onBlack,
    },
    groupVoteText: {
      fontSize: 10.5,
      fontWeight: '600',
      color: colors.text3,
    },
  });
