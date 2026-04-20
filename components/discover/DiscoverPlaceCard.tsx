import { Image, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { useTheme } from '@/constants/ThemeContext';

type ThemeColors = ReturnType<typeof useTheme>['colors'];

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
  lat?: number;
  lng?: number;
  totalRatings?: number;
  types?: string[];
}

interface DiscoverPlaceCardProps {
  place: DiscoverPlace;
  isSaved: boolean;
  isRecommended: boolean;
  onSave: () => void;
  onRecommend: () => void;
  onExplore?: () => void;
}

export function DiscoverPlaceCard({
  place,
  isSaved,
  isRecommended,
  onSave,
  onRecommend,
  onExplore,
}: DiscoverPlaceCardProps) {
  const { colors } = useTheme();
  const styles = getStyles(colors);

  const priceLabel = place.price === 0 ? 'Free' : '$'.repeat(place.price);

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.85}
      onPress={() => {
        if (onExplore) onExplore();
      }}
      accessibilityRole="button"
      accessibilityLabel={`View details for ${place.n}`}
    >
      {/* Top row: image + info */}
      <View style={styles.topRow}>
        <Image
          source={{ uri: place.img }}
          style={styles.image}
          resizeMode="cover"
          accessibilityLabel={`Photo of ${place.n}`}
        />
        <View style={styles.info}>
          {/* Type + open/closed pill */}
          <View style={styles.typeRow}>
            <Text style={styles.typeText}>{place.t}</Text>
            {place.openNow ? (
              <View style={styles.openPill}>
                <Text style={styles.openText}>OPEN</Text>
              </View>
            ) : (
              <View style={styles.closedPill}>
                <Text style={styles.closedText}>CLOSED</Text>
              </View>
            )}
          </View>

          {/* Name */}
          <Text style={styles.name} numberOfLines={1}>
            {place.n}
          </Text>

          {/* Rating row */}
          <View style={styles.ratingRow}>
            <View style={styles.starRow}>
              <Svg width={11} height={11} viewBox="0 0 24 24" fill={colors.warn}>
                <Path d="M12 2l2.9 6.7L22 9.3l-5 4.9 1.2 7.1L12 18l-6.2 3.3L7 14.2 2 9.3l7.1-.6z" />
              </Svg>
              <Text style={styles.ratingValue}>{place.r}</Text>
            </View>
            <Text style={styles.ratingMeta}>{place.rv}</Text>
            <Text style={styles.ratingDot}>{'\u00B7'}</Text>
            <Text style={styles.ratingMeta}>{place.d}</Text>
            <Text style={styles.ratingDot}>{'\u00B7'}</Text>
            <Text style={styles.priceText}>{priceLabel}</Text>
          </View>
        </View>
      </View>

      {/* Action buttons: Explore + Save */}
      <View style={styles.actionGrid}>
        <TouchableOpacity
          style={styles.exploreBtn}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`Explore ${place.n}`}
          onPress={() => {
            if (onExplore) {
              onExplore();
            } else if (place.lat != null && place.lng != null) {
              Linking.openURL(
                `https://maps.google.com/?q=${place.lat},${place.lng}`,
              );
            } else {
              Linking.openURL(
                `https://maps.google.com/maps/search/${encodeURIComponent(place.n)}`,
              );
            }
          }}
        >
          <Svg
            width={13}
            height={13}
            viewBox="0 0 24 24"
            fill="none"
            stroke={colors.onBlack}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <Circle cx={12} cy={12} r={9} />
            <Path d="M15.5 8.5l-2 5-5 2 2-5z" fill={colors.onBlack} stroke="none" />
          </Svg>
          <Text style={styles.exploreBtnText}>Explore</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.saveBtn,
            isSaved && styles.saveBtnActive,
          ]}
          onPress={onSave}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={isSaved ? 'Saved' : 'Save'}
        >
          <Svg
            width={13}
            height={13}
            viewBox="0 0 24 24"
            fill={isSaved ? 'currentColor' : 'none'}
            stroke={isSaved ? colors.accent : colors.text}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <Path
              d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"
              fill={isSaved ? colors.accent : 'none'}
            />
          </Svg>
          <Text style={[styles.saveBtnText, isSaved && styles.saveBtnTextActive]}>
            {isSaved ? 'Saved' : 'Save'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Recommend to group */}
      <TouchableOpacity
        style={[
          styles.recommendBtn,
          isRecommended && styles.recommendBtnActive,
        ]}
        onPress={onRecommend}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={isRecommended ? 'Recommended to group' : 'Recommend to group'}
      >
        <Svg
          width={12}
          height={12}
          viewBox="0 0 24 24"
          fill={isRecommended ? colors.accent : 'none'}
          stroke={isRecommended ? colors.accent : colors.text3}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <Path d="M16 3h5v5M21 3l-7 7M4 21l7-7M4 14v7h7" />
        </Svg>
        <Text style={[styles.recommendText, isRecommended && styles.recommendTextActive]}>
          {isRecommended ? 'Recommended to group \u2713' : 'Recommend to group'}
        </Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      padding: 10,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      gap: 10,
    },
    topRow: {
      flexDirection: 'row',
      gap: 12,
    },
    image: {
      width: 130,
      height: 130,
      borderRadius: 14,
      backgroundColor: colors.card2,
    },
    info: {
      flex: 1,
      justifyContent: 'center',
    },
    typeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    typeText: {
      fontSize: 11,
      color: colors.accent,
      fontWeight: '600',
      letterSpacing: 0.66, // 0.06em * 11
      textTransform: 'uppercase',
    },
    openPill: {
      paddingVertical: 1,
      paddingHorizontal: 6,
      borderRadius: 999,
      backgroundColor: 'rgba(125,220,150,0.14)',
      borderWidth: 1,
      borderColor: 'rgba(125,220,150,0.35)',
    },
    openText: {
      fontSize: 9.5,
      fontWeight: '700',
      color: '#2f7a46',
    },
    closedPill: {
      paddingVertical: 1,
      paddingHorizontal: 6,
      borderRadius: 999,
      backgroundColor: colors.card2,
      borderWidth: 1,
      borderColor: colors.border,
    },
    closedText: {
      fontSize: 9.5,
      fontWeight: '700',
      color: colors.text3,
    },
    name: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      marginTop: 2,
    },
    ratingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginTop: 6,
    },
    starRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
    },
    ratingValue: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.warn,
    },
    ratingMeta: {
      fontSize: 11,
      color: colors.text3,
    },
    ratingDot: {
      fontSize: 11,
      color: colors.text3,
    },
    priceText: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.text3,
    },
    actionGrid: {
      flexDirection: 'row',
      gap: 8,
    },
    exploreBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 9,
      paddingHorizontal: 12,
      borderRadius: 10,
      backgroundColor: colors.black,
    },
    exploreBtnText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.onBlack,
    },
    saveBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 9,
      paddingHorizontal: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    saveBtnActive: {
      borderColor: colors.accent,
      backgroundColor: colors.accentBg,
    },
    saveBtnText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.text,
    },
    saveBtnTextActive: {
      color: colors.accent,
    },
    recommendBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: colors.border,
      backgroundColor: 'transparent',
    },
    recommendBtnActive: {
      borderColor: colors.accent,
      backgroundColor: colors.accentBg,
    },
    recommendText: {
      fontSize: 11.5,
      fontWeight: '600',
      color: colors.text3,
    },
    recommendTextActive: {
      color: colors.accent,
    },
  });
