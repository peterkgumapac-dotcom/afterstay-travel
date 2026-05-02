import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Image } from 'expo-image';
import { MapPin } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { useTheme } from '@/constants/ThemeContext';
import { formatDatePHT } from '@/lib/utils';
import type { Moment } from '@/lib/types';

const { width: SCREEN_W } = Dimensions.get('window');
const CARD_W = SCREEN_W - 36;
const CARD_H = 280;
const HALF_H = CARD_H / 2;
const FLIP_DURATION = 500;
const HOLD_DURATION = 4000;

interface MomentsShowcaseProps {
  moments: Moment[];
  onPress?: () => void;
}

/** Shuffle array (Fisher-Yates) and return a new array */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function MomentsShowcaseInner({ moments, onPress }: MomentsShowcaseProps) {
  const { colors } = useTheme();

  // Randomize order on mount
  const shuffled = useMemo(() => shuffle(moments), [moments]);

  const [currentIdx, setCurrentIdx] = useState(0);
  const [nextIdx, setNextIdx] = useState(shuffled.length > 1 ? 1 : 0);
  const [isFlipping, setIsFlipping] = useState(false);
  const [displayIdx, setDisplayIdx] = useState(0); // for counter
  const paused = useRef(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const flipCount = useRef(0);

  const flipProgress = useSharedValue(0); // 0 = flat, 1 = fully flipped
  const revealScale = useSharedValue(1);

  const count = shuffled.length;

  // Pick a random next index (not current)
  const pickRandom = useCallback((exclude: number) => {
    if (count <= 1) return 0;
    let next: number;
    do {
      next = Math.floor(Math.random() * count);
    } while (next === exclude);
    return next;
  }, [count]);

  // Prefetch upcoming image
  useEffect(() => {
    if (count > 1) {
      const upcoming = shuffled[nextIdx];
      if (upcoming?.photo) Image.prefetch(upcoming.photo).catch(() => {});
    }
  }, [nextIdx, count]);

  // Calendar page flip
  const doFlip = useCallback(() => {
    if (paused.current || count <= 1) return;

    const next = pickRandom(currentIdx);
    setNextIdx(next);
    setIsFlipping(true);
    revealScale.value = 0.98;

    // Animate: 0 → 1 (page flips from top hinge)
    flipProgress.value = withTiming(1, {
      duration: FLIP_DURATION,
      easing: Easing.inOut(Easing.cubic),
    });

    // After flip completes, swap and reset
    setTimeout(() => {
      flipCount.current += 1;
      setCurrentIdx(next);
      setDisplayIdx(flipCount.current % count);
      setNextIdx(pickRandom(next));
      flipProgress.value = 0;
      setIsFlipping(false);

      revealScale.value = withTiming(1, { duration: 280 });
    }, FLIP_DURATION + 50);
  }, [currentIdx, count, pickRandom]);

  useEffect(() => {
    if (count <= 1) return;
    timer.current = setInterval(doFlip, HOLD_DURATION);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [doFlip, count]);

  // ── Top-hinge calendar page flip ──
  // The "page" is the top half that flips forward.
  // We simulate top-pivot by: translateY(-halfH) → rotateX → translateY(halfH)
  // This makes the rotation axis the top edge of the card.

  // Front page — flips away from top edge
  const frontStyle = useAnimatedStyle(() => {
    const angle = interpolate(flipProgress.value, [0, 1], [0, -180]);
    const opacity = interpolate(flipProgress.value, [0, 0.4, 0.5], [1, 1, 0]);

    return {
      transform: [
        { perspective: 1200 },
        { translateY: -HALF_H },
        { rotateX: `${angle}deg` },
        { translateY: HALF_H },
      ],
      opacity,
      backfaceVisibility: 'hidden' as const,
    };
  });

  // Shadow that appears on the revealed photo as the page flips over it
  const shadowStyle = useAnimatedStyle(() => {
    const opacity = interpolate(flipProgress.value, [0, 0.3, 0.5, 1], [0, 0.3, 0.15, 0]);
    return { opacity };
  });

  // Revealed photo underneath — subtle scale bounce
  const revealStyle = useAnimatedStyle(() => ({
    transform: [{ scale: revealScale.value }],
  }));

  if (count === 0) return null;

  const current = shuffled[currentIdx];
  const next = shuffled[nextIdx];

  return (
    <Pressable
      style={styles.container}
      onPress={onPress}
      onLongPress={() => { paused.current = true; }}
      onPressOut={() => { paused.current = false; }}
    >
      {/* Layer 1: Next photo (revealed underneath) */}
      <Animated.View style={[styles.card, revealStyle]}>
        {next?.photo && (
          <Image
            source={{ uri: next.photo }}
            style={styles.image}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        )}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.65)']}
          style={styles.gradient}
          pointerEvents="none"
        />
        <PhotoInfo moment={next} />

        {/* Shadow overlay from flipping page */}
        <Animated.View style={[styles.flipShadow, shadowStyle]} />
      </Animated.View>

      {/* Layer 2: Current photo — flips from top like a calendar page */}
      <Animated.View style={[styles.card, styles.frontPage, frontStyle]}>
        {current?.photo && (
          <Image
            source={{ uri: current.photo }}
            style={styles.image}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        )}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.65)']}
          style={styles.gradient}
          pointerEvents="none"
        />
        <PhotoInfo moment={current} />
      </Animated.View>

      {/* Counter pill */}
      {count > 1 && (
        <View style={styles.counterPill}>
          <Text style={styles.counterText}>{displayIdx + 1} / {count}</Text>
        </View>
      )}
    </Pressable>
  );
}

const PhotoInfo = memo(function PhotoInfo({ moment }: { moment: Moment }) {
  if (!moment) return null;
  return (
    <View style={styles.info}>
      {moment.location && (
        <View style={styles.locationRow}>
          <MapPin size={11} color="rgba(255,255,255,0.8)" strokeWidth={2} />
          <Text style={styles.locationText} numberOfLines={1}>{moment.location}</Text>
        </View>
      )}
      <Text style={styles.dateText}>{formatDatePHT(moment.date)}</Text>
      {moment.caption ? (
        <Text style={styles.captionText} numberOfLines={1}>{moment.caption}</Text>
      ) : null}
    </View>
  );
});

export const MomentsShowcase = memo(MomentsShowcaseInner);

const styles = StyleSheet.create({
  container: {
    width: CARD_W,
    height: CARD_H,
    alignSelf: 'center',
    marginBottom: 24,
    borderRadius: 20,
    overflow: 'hidden',
  },
  card: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
  },
  frontPage: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  gradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '50%',
  },
  flipShadow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  info: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  locationText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  dateText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '500',
  },
  captionText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '500',
    marginTop: 4,
  },
  counterPill: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  counterText: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.9)',
    fontVariant: ['tabular-nums'],
  },
});
