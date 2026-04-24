import { useEffect, useMemo, useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useTheme, ThemeColors } from '@/constants/ThemeContext';
import { smallUrl } from '@/lib/imageUrl';
import type { GroupMember, Moment } from '@/lib/types';

const MAX_SLIDESHOW_PHOTOS = 8;

const SLIDE_INTERVAL = 8000; // 8s per photo — slow and relaxed
const FADE_DURATION = 2000; // 2s cross-fade

interface HomeMomentsPreviewProps {
  moments: Moment[];
  members: GroupMember[];
  onViewAll?: () => void;
}

/** Cycles through photos with a smooth continuous cross-fade */
function SlideshowImage({
  photos,
  offset = 0,
  style,
}: {
  photos: string[];
  offset?: number;
  style: any;
}) {
  const safeLen = Math.max(photos.length, 1);
  const [idxA, setIdxA] = useState(offset % safeLen);
  const [idxB, setIdxB] = useState((offset + 1) % safeLen);
  const [showingA, setShowingA] = useState(true);
  const opacityA = useSharedValue(1);
  const opacityB = useSharedValue(0);

  useEffect(() => {
    if (photos.length <= 1) return;
    const interval = setInterval(() => {
      if (showingA) {
        // Fade B in, A out
        setIdxB((prev) => {
          const next = (prev + 1) % photos.length;
          return next === idxA ? (next + 1) % photos.length : next;
        });
        opacityB.value = withTiming(1, { duration: FADE_DURATION, easing: Easing.inOut(Easing.ease) });
        opacityA.value = withTiming(0, { duration: FADE_DURATION, easing: Easing.inOut(Easing.ease) });
      } else {
        // Fade A in, B out
        setIdxA((prev) => {
          const next = (prev + 1) % photos.length;
          return next === idxB ? (next + 1) % photos.length : next;
        });
        opacityA.value = withTiming(1, { duration: FADE_DURATION, easing: Easing.inOut(Easing.ease) });
        opacityB.value = withTiming(0, { duration: FADE_DURATION, easing: Easing.inOut(Easing.ease) });
      }
      setShowingA((s) => !s);
    }, SLIDE_INTERVAL);
    return () => clearInterval(interval);
  }, [photos.length, showingA, idxA, idxB, opacityA, opacityB]);

  const styleA = useAnimatedStyle(() => ({ opacity: opacityA.value }));
  const styleB = useAnimatedStyle(() => ({ opacity: opacityB.value }));

  return (
    <View style={[style, { overflow: 'hidden', backgroundColor: '#1a1612' }]}>
      <Animated.View style={[StyleSheet.absoluteFill, styleA]}>
        <Image source={{ uri: photos[idxA] }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      </Animated.View>
      {photos.length > 1 && (
        <Animated.View style={[StyleSheet.absoluteFill, styleB]}>
          <Image source={{ uri: photos[idxB] }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        </Animated.View>
      )}
    </View>
  );
}

export function HomeMomentsPreview({
  moments,
  members,
  onViewAll,
}: HomeMomentsPreviewProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);

  const displayPhotos = moments.filter((m) => m.photo).slice(0, 5);
  const overflow = moments.length - displayPhotos.length;

  // Limit slideshow to MAX_SLIDESHOW_PHOTOS and use small thumbnails
  const allPhotos = useMemo(() => {
    const photos = moments
      .filter((m) => m.photo)
      .slice(0, MAX_SLIDESHOW_PHOTOS)
      .map((m) => smallUrl(m.photo!)!);
    // Shuffle so each session feels different
    for (let i = photos.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [photos[i], photos[j]] = [photos[j], photos[i]];
    }
    return photos;
  }, [moments.length]);

  if (moments.length === 0) {
    return (
      <View style={styles.wrapper}>
        <Animated.View entering={FadeIn.duration(300)} style={styles.emptyCard}>
          <Text style={styles.emptyText}>
            No moments yet — capture your first
          </Text>
        </Animated.View>
      </View>
    );
  }

  if (displayPhotos.length === 1) {
    return (
      <View style={styles.wrapper}>
        <Animated.View entering={FadeInDown.duration(300)}>
          <TouchableOpacity style={styles.singleCard} activeOpacity={0.85} onPress={onViewAll}>
            <SlideshowImage photos={allPhotos} style={styles.singleImage} />
          </TouchableOpacity>
        </Animated.View>
        <SeeAll count={moments.length} onPress={onViewAll} colors={colors} />
      </View>
    );
  }

  if (displayPhotos.length === 2) {
    return (
      <View style={styles.wrapper}>
        <Animated.View entering={FadeInDown.duration(300)} style={styles.row}>
          {displayPhotos.map((m, i) => (
            <TouchableOpacity key={m.id} style={styles.halfCard} activeOpacity={0.85} onPress={onViewAll}>
              <SlideshowImage photos={allPhotos} offset={i * Math.floor(allPhotos.length / 2)} style={styles.fillImage} />
            </TouchableOpacity>
          ))}
        </Animated.View>
        <SeeAll count={moments.length} onPress={onViewAll} colors={colors} />
      </View>
    );
  }

  // 3-5 photos: collage — big left + stacked right, all cycling
  const main = displayPhotos[0];
  const side = displayPhotos.slice(1, 4);
  const showOverflow = overflow > 0 || displayPhotos.length > 4;
  const overflowNum = moments.length - 4;

  return (
    <View style={styles.wrapper}>
      <Animated.View entering={FadeInDown.duration(300)} style={styles.collage}>
        {/* Left — big photo, cycles through all moments */}
        <TouchableOpacity style={styles.collageBig} activeOpacity={0.85} onPress={onViewAll}>
          <SlideshowImage photos={allPhotos} offset={0} style={styles.fillImage} />
        </TouchableOpacity>

        {/* Right — stacked, each cycles with different offset */}
        <View style={styles.collageSide}>
          {side.map((m, i) => {
            const isLast = i === side.length - 1 && showOverflow && overflowNum > 0;
            const photoOffset = Math.floor((allPhotos.length / (side.length + 1)) * (i + 1));
            return (
              <Animated.View
                key={m.id}
                entering={FadeInDown.duration(250).delay(80 + i * 50)}
                style={styles.collageSideCard}
              >
                <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={0.85} onPress={onViewAll}>
                  <SlideshowImage photos={allPhotos} offset={photoOffset} style={styles.fillImage} />
                  {isLast && (
                    <View style={styles.overflowBadge}>
                      <Text style={styles.overflowText}>+{overflowNum}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </Animated.View>
            );
          })}
        </View>
      </Animated.View>
      <SeeAll count={moments.length} onPress={onViewAll} colors={colors} />
    </View>
  );
}

function SeeAll({ count, onPress, colors }: { count: number; onPress?: () => void; colors: ThemeColors }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={{ alignSelf: 'flex-start' }}>
      <Text style={{ fontSize: 12, fontWeight: '600', color: colors.accent }}>
        See all {count} moments →
      </Text>
    </TouchableOpacity>
  );
}

const GAP = 6;

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    wrapper: {
      paddingHorizontal: 16,
      gap: 10,
    },

    /* Empty */
    emptyCard: {
      paddingVertical: 32,
      paddingHorizontal: 20,
      alignItems: 'center',
      borderRadius: 14,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    emptyText: { fontSize: 13, color: colors.text3, fontWeight: '500' },

    /* Single photo */
    singleCard: {
      borderRadius: 14,
      overflow: 'hidden',
      backgroundColor: colors.card2,
    },
    singleImage: {
      width: '100%',
      aspectRatio: 16 / 9,
    },

    /* Two photos side by side */
    row: {
      flexDirection: 'row',
      gap: GAP,
    },
    halfCard: {
      flex: 1,
      aspectRatio: 1,
      borderRadius: 12,
      overflow: 'hidden',
      backgroundColor: colors.card2,
    },

    /* Collage 3-5 */
    collage: {
      flexDirection: 'row',
      gap: GAP,
      height: 220,
    },
    collageBig: {
      flex: 3,
      borderRadius: 14,
      overflow: 'hidden',
      backgroundColor: colors.card2,
    },
    collageSide: {
      flex: 2,
      gap: GAP,
    },
    collageSideCard: {
      flex: 1,
      borderRadius: 10,
      overflow: 'hidden',
      backgroundColor: colors.card2,
    },

    /* Shared */
    fillImage: {
      width: '100%',
      height: '100%',
    },
    gradient: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      paddingTop: 28,
      paddingBottom: 10,
      paddingHorizontal: 12,
    },
    caption: {
      fontSize: 13,
      fontWeight: '600',
      color: '#fff',
    },
    smallCaption: {
      fontSize: 11,
      fontWeight: '600',
      color: '#fff',
    },
    overflowBadge: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.55)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    overflowText: {
      fontSize: 20,
      fontWeight: '700',
      color: '#fff',
    },
  });
