import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';

import { useCurationGesture } from '@/hooks/useCurationGesture';
import { PhotoLayer } from './PhotoLayer';
import { GlowOverlay } from './GlowOverlay';
import { FavoriteStack } from './FavoriteStack';
import { CurationProgress } from './CurationProgress';

interface PhotoItem {
  id: string;
  uri: string;
}

interface CurationDay {
  dateLabel: string;
  photos: PhotoItem[];
}

interface CurationLightboxProps {
  day: CurationDay;
  onComplete: (ids: string[]) => void;
  onDismiss: () => void;
  maxFavorites?: number;
}

function CurationLightboxInner({
  day,
  onComplete,
  onDismiss,
  maxFavorites = 3,
}: CurationLightboxProps) {
  const insets = useSafeAreaInsets();
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [lastFavoriteAddedAt, setLastFavoriteAddedAt] = useState(0);

  const currentIndex = useSharedValue(0);
  const photos = day.photos;
  const totalPhotos = photos.length;
  const isFinished = currentPhotoIndex >= totalPhotos;

  // Fire onComplete when all photos have been processed
  useEffect(() => {
    if (isFinished) {
      onComplete(Array.from(favorites));
    }
  }, [isFinished, favorites, onComplete]);

  // Keep shared value in sync with React state
  useEffect(() => {
    currentIndex.value = currentPhotoIndex;
  }, [currentPhotoIndex, currentIndex]);

  const advanceToNext = useCallback(() => {
    setCurrentPhotoIndex((prev) => prev + 1);
  }, []);

  const handleCommit = useCallback(
    (action: 'favorite' | 'skip') => {
      const photo = photos[currentPhotoIndex];
      if (!photo) return;

      if (action === 'favorite') {
        setFavorites((prev) => {
          const next = new Set(prev);
          next.add(photo.id);
          return next;
        });
        setLastFavoriteAddedAt(Date.now());
      } else {
        // Skip — also unfavorite if it was previously favorited
        setFavorites((prev) => {
          if (!prev.has(photo.id)) return prev;
          const next = new Set(prev);
          next.delete(photo.id);
          return next;
        });
      }

      advanceToNext();
    },
    [photos, currentPhotoIndex, advanceToNext],
  );

  const { gesture, cardStyle, glowStyle } = useCurationGesture({
    onCommit: handleCommit,
    favoriteCount: favorites.size,
    maxFavorites,
    enabled: !isFinished,
  });

  // Don't render photo layer after all photos processed
  if (totalPhotos === 0) return null;

  return (
    <GestureHandlerRootView style={styles.root}>
      <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        {/* Progress bar */}
        <View style={styles.progressWrap}>
          <View style={styles.progressHeader}>
            <TouchableOpacity onPress={onDismiss} hitSlop={12} style={styles.dismissBtn}>
              <ArrowLeft size={22} color="#fff" />
            </TouchableOpacity>
          </View>
          <CurationProgress
            dayLabel={day.dateLabel}
            photoIndex={Math.min(currentPhotoIndex, totalPhotos - 1)}
            totalPhotos={totalPhotos}
            favoritesCount={favorites.size}
            maxFavorites={maxFavorites}
          />
        </View>

        {/* Card area — GestureDetector must wrap the full touchable area */}
        {!isFinished ? (
          <GestureDetector gesture={gesture}>
            <Animated.View style={[styles.cardArea, cardStyle]}>
              <View style={styles.cardWrap}>
                <PhotoLayer
                  photos={photos}
                  currentIndex={currentIndex}
                  animatedStyle={styles.photoFill}
                />
                <GlowOverlay glowStyle={glowStyle} />
              </View>
              {/* Favorite stack indicator */}
              <FavoriteStack
                count={favorites.size}
                max={maxFavorites}
                lastAddedAt={lastFavoriteAddedAt}
              />
            </Animated.View>
          </GestureDetector>
        ) : (
          <View style={styles.cardArea}>
            <FavoriteStack
              count={favorites.size}
              max={maxFavorites}
              lastAddedAt={lastFavoriteAddedAt}
            />
          </View>
        )}
      </View>
    </GestureHandlerRootView>
  );
}

export const CurationLightbox = memo(CurationLightboxInner);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  container: { flex: 1 },
  progressWrap: { paddingHorizontal: 12, gap: 8 },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 4,
  },
  dismissBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardArea: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 16,
  },
  cardWrap: {
    flex: 1,
    borderRadius: 22,
    overflow: 'hidden',
  },
  photoFill: {
    flex: 1,
  },
});
