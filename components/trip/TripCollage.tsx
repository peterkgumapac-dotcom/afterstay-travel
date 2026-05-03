import React, { memo, useEffect, useState, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { Image } from 'expo-image';
import { getMoments, supabase } from '@/lib/supabase';

const GAP = 2;

interface TripCollageProps {
  tripId?: string;
  quickTripId?: string;
  width: number;
  height: number;
  animated?: boolean;
  maxPhotos?: number;
  /** If provided, skip the fetch and use these URLs directly */
  photoUrls?: string[];
}

/** Shuffle array (Fisher-Yates) */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Fetch random moment photos for a trip. */
async function fetchTripPhotos(tripId: string, maxPhotos: number): Promise<string[]> {
  const moments = await getMoments(tripId);
  const urls = moments
    .map((moment) => moment.photo)
    .filter((url): url is string => !!url && !url.endsWith('/'))
    .slice(0, maxPhotos);

  return shuffle(urls);
}

/** Fetch photos for a quick trip. */
async function fetchQuickTripPhotos(quickTripId: string, maxPhotos: number): Promise<string[]> {
  const { data } = await supabase
    .from('quick_trip_photos')
    .select('photo_url')
    .eq('quick_trip_id', quickTripId)
    .limit(maxPhotos);

  if (!data || data.length === 0) return [];

  const urls = data
    .map((row) => row.photo_url as string | undefined)
    .filter((url): url is string => !!url && !url.endsWith('/'));

  return shuffle(urls);
}

// ── Flipping cell ──
interface FlipCellProps {
  photos: string[];
  cellW: number;
  cellH: number;
  flipInterval: number;
  flipDelay: number;
  animated: boolean;
}

const FlipCell = memo(function FlipCell({ photos, cellW, cellH, flipInterval, flipDelay, animated }: FlipCellProps) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const rotateY = useSharedValue(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!animated || photos.length <= 1) return;

    const startFlipping = () => {
      timer.current = setInterval(() => {
        // Flip out
        rotateY.value = withSequence(
          withTiming(90, { duration: 250, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 250, easing: Easing.inOut(Easing.ease) }),
        );
        // Swap image at the midpoint
        setTimeout(() => {
          setCurrentIdx((prev) => (prev + 1) % photos.length);
        }, 250);
      }, flipInterval);
    };

    const timeout = setTimeout(startFlipping, flipDelay);

    return () => {
      clearTimeout(timeout);
      if (timer.current) clearInterval(timer.current);
    };
  }, [animated, photos.length, flipInterval, flipDelay, rotateY]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 600 },
      { rotateY: `${rotateY.value}deg` },
    ],
  }));

  if (photos.length === 0) return <View style={{ width: cellW, height: cellH, backgroundColor: '#1a1a1a' }} />;

  if (!animated) {
    return (
      <View style={{ width: cellW, height: cellH, overflow: 'hidden' }}>
        <Image
          source={{ uri: photos[currentIdx] }}
          style={{ width: cellW, height: cellH }}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={0}
        />
      </View>
    );
  }

  return (
    <Animated.View style={[{ width: cellW, height: cellH, overflow: 'hidden' }, animStyle]}>
      <Image
        source={{ uri: photos[currentIdx] }}
        style={{ width: cellW, height: cellH }}
        contentFit="cover"
        cachePolicy="memory-disk"
        transition={0}
      />
    </Animated.View>
  );
});

// ── Main collage ──
function TripCollageInner({ tripId, quickTripId, width, height, animated = true, maxPhotos = 12, photoUrls }: TripCollageProps) {
  const fetchLimit = Math.max(1, Math.min(maxPhotos, 12));
  const [photos, setPhotos] = useState<string[]>(() => (photoUrls ?? []).slice(0, fetchLimit));
  const [loaded, setLoaded] = useState(!!photoUrls);

  useEffect(() => {
    let cancelled = false;
    if (photoUrls) {
      setPhotos(photoUrls.slice(0, fetchLimit));
      setLoaded(true);
      return () => { cancelled = true; };
    }
    const fetchFn = quickTripId
      ? fetchQuickTripPhotos(quickTripId, fetchLimit)
      : tripId
        ? fetchTripPhotos(tripId, fetchLimit)
        : Promise.resolve([]);
    fetchFn.then((urls) => {
      if (cancelled) return;
      setPhotos(urls.slice(0, fetchLimit));
      setLoaded(true);
    }).catch(() => {
      if (!cancelled) setLoaded(true);
    });
    return () => { cancelled = true; };
  }, [tripId, quickTripId, photoUrls, fetchLimit]);

  if (!loaded || photos.length === 0) {
    return <View style={{ width, height, backgroundColor: '#1a1a1a' }} />;
  }

  // Single photo — just show it
  if (photos.length === 1) {
    return (
      <Image
        source={{ uri: photos[0] }}
        style={{ width, height }}
        contentFit="cover"
        cachePolicy="memory-disk"
        transition={200}
      />
    );
  }

  // 2x2 collage — distribute photos across 4 cells
  const cellW = (width - GAP) / 2;
  const cellH = (height - GAP) / 2;

  // Distribute photos into 4 buckets for rotation
  const cells: string[][] = [[], [], [], []];
  photos.forEach((url, i) => {
    cells[i % 4].push(url);
  });
  // Ensure every cell has at least 1 photo
  cells.forEach((cell, i) => {
    if (cell.length === 0) cell.push(photos[i % photos.length]);
  });

  // Stagger flip intervals so cells don't all flip at once
  const intervals = [3200, 4100, 3700, 4500];
  const delays = [1000, 2200, 1600, 3000];

  return (
    <View style={[styles.grid, { width, height }]}>
      <View style={styles.row}>
        <FlipCell photos={cells[0]} cellW={cellW} cellH={cellH} flipInterval={intervals[0]} flipDelay={delays[0]} animated={animated} />
        <FlipCell photos={cells[1]} cellW={cellW} cellH={cellH} flipInterval={intervals[1]} flipDelay={delays[1]} animated={animated} />
      </View>
      <View style={styles.row}>
        <FlipCell photos={cells[2]} cellW={cellW} cellH={cellH} flipInterval={intervals[2]} flipDelay={delays[2]} animated={animated} />
        <FlipCell photos={cells[3]} cellW={cellW} cellH={cellH} flipInterval={intervals[3]} flipDelay={delays[3]} animated={animated} />
      </View>
    </View>
  );
}

export const TripCollage = memo(TripCollageInner);

const styles = StyleSheet.create({
  grid: {
    gap: GAP,
  },
  row: {
    flexDirection: 'row',
    gap: GAP,
  },
});
