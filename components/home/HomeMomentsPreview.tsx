import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useTheme, ThemeColors } from '@/constants/ThemeContext';
import type { GroupMember, Moment } from '@/lib/types';

const SLIDE_INTERVAL = 5000; // 5s per photo
const FADE_DURATION = 1200; // 1.2s cross-fade

interface HomeMomentsPreviewProps {
  moments: Moment[];
  members: GroupMember[];
  onViewAll?: () => void;
}

/** Cycles through photos with a slow cross-fade */
function SlideshowImage({
  photos,
  offset = 0,
  style,
}: {
  photos: string[];
  offset?: number;
  style: any;
}) {
  const [currentIdx, setCurrentIdx] = useState(offset % photos.length);
  const [nextIdx, setNextIdx] = useState((offset + 1) % photos.length);
  const fade = useSharedValue(0);

  useEffect(() => {
    if (photos.length <= 1) return;
    let timeout: ReturnType<typeof setTimeout>;
    const interval = setInterval(() => {
      fade.value = withTiming(1, {
        duration: FADE_DURATION,
        easing: Easing.inOut(Easing.ease),
      });
      timeout = setTimeout(() => {
        setCurrentIdx((p) => (p + 1) % photos.length);
        setNextIdx((p) => (p + 2) % photos.length);
        fade.value = 0;
      }, FADE_DURATION);
    }, SLIDE_INTERVAL);
    return () => { clearInterval(interval); clearTimeout(timeout); };
  }, [photos.length, fade]);

  const fadeStyle = useAnimatedStyle(() => ({
    opacity: fade.value,
  }));

  return (
    <View style={[style, { overflow: 'hidden' }]}>
      <Image source={{ uri: photos[currentIdx] }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      {photos.length > 1 && (
        <Animated.View style={[StyleSheet.absoluteFill, fadeStyle]}>
          <Image source={{ uri: photos[nextIdx] }} style={StyleSheet.absoluteFill} resizeMode="cover" />
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

  const allPhotos = moments.filter((m) => m.photo).map((m) => m.photo!);
  const displayPhotos = moments.filter((m) => m.photo).slice(0, 5);
  const overflow = moments.length - displayPhotos.length;

  // Shuffle photos for each slot so they don't all show the same sequence
  const shuffled = useMemo(() => {
    const arr = [...allPhotos];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }, [allPhotos.length]);

  if (displayPhotos.length === 1) {
    return (
      <View style={styles.wrapper}>
        <Animated.View entering={FadeInDown.duration(300)}>
          <TouchableOpacity style={styles.singleCard} activeOpacity={0.85} onPress={onViewAll}>
            <SlideshowImage photos={allPhotos} style={styles.singleImage} />
            <LinearGradient colors={['transparent', 'rgba(0,0,0,0.6)']} style={styles.gradient}>
              <Text style={styles.caption} numberOfLines={1}>{displayPhotos[0].caption || 'Trip moment'}</Text>
            </LinearGradient>
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
              <LinearGradient colors={['transparent', 'rgba(0,0,0,0.5)']} style={styles.gradient}>
                <Text style={styles.smallCaption} numberOfLines={1}>{m.caption || ''}</Text>
              </LinearGradient>
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
          <LinearGradient colors={['transparent', 'rgba(0,0,0,0.55)']} style={styles.gradient}>
            <Text style={styles.caption} numberOfLines={1}>{main.caption || ''}</Text>
          </LinearGradient>
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
