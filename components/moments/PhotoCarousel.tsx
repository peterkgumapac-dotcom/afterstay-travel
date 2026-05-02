import React, { useCallback, useState, useEffect, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Pressable,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  runOnJS,
  type SharedValue,
} from 'react-native-reanimated';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Image as RNImage } from 'react-native';
import { ChevronLeft, Heart, MessageCircle, Share2, Download, MoreHorizontal, MapPin, Sparkles } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/constants/ThemeContext';
import { springPresets, thresholds } from '@/constants/animations';
import type { MomentDisplay, PeopleMap } from './types';
import { HeartBurst } from './HeartBurst';
import { PhotoActionsSheet, type PhotoAction } from './PhotoActionsSheet';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const FALLBACK_BLURHASH = 'L15OE2-;00xu~q%M4nof00D%00Rj';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PhotoCarouselProps {
  moments: MomentDisplay[];
  initialIndex: number;
  people: PeopleMap;
  onClose: () => void;
  onFavorite?: (id: string) => void;
  onComment?: (momentId: string) => void;
  onAction?: (action: PhotoAction, moment: MomentDisplay) => void;
  onIndexChange?: (index: number) => void;
  dismissedIds?: Set<string>;
}

interface CarouselItemProps {
  moment: MomentDisplay;
  index: number;
  scrollX: SharedValue<number>;
  onDoubleTap: (moment: MomentDisplay) => void;
  isNearActive: boolean;
}

// ---------------------------------------------------------------------------
// CarouselItem — single photo slide
// ---------------------------------------------------------------------------

const CarouselItem = memo(function CarouselItemComponent({
  moment,
  index,
  scrollX,
  onDoubleTap,
  isNearActive,
}: CarouselItemProps) {
  const [burstVisible, setBurstVisible] = useState(false);
  const [burstCenter, setBurstCenter] = useState({ x: SCREEN_W / 2, y: SCREEN_H / 2 });
  const [hasBeenVisible, setHasBeenVisible] = useState(isNearActive);

  useEffect(() => {
    if (isNearActive && !hasBeenVisible) setHasBeenVisible(true);
  }, [isNearActive]);

  // No scale/opacity animation — clean flat slide
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: 1,
  }));

  const handleDoubleTap = useCallback(() => {
    setBurstCenter({ x: SCREEN_W / 2, y: SCREEN_H / 2 });
    setBurstVisible(true);
    onDoubleTap(moment);
  }, [moment, onDoubleTap]);

  const handleBurstComplete = useCallback(() => setBurstVisible(false), []);

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .maxDuration(250)
    .onEnd(() => {
      'worklet';
      runOnJS(handleDoubleTap)();
    });

  const photoUri = moment.hdPhoto || moment.photo;

  return (
    <View style={styles.slide}>
      <GestureDetector gesture={doubleTap}>
        <Animated.View style={[styles.photoWrap, animatedStyle]}>
          {hasBeenVisible && photoUri && (
            <Image
              source={{ uri: photoUri }}
              style={StyleSheet.absoluteFill}
              contentFit="contain"
              placeholder={moment.blurhash ? { blurhash: moment.blurhash } : { blurhash: FALLBACK_BLURHASH }}
              cachePolicy="memory-disk"
              recyclingKey={moment.id}
              transition={120}
            />
          )}
        </Animated.View>
      </GestureDetector>

      <HeartBurst
        visible={burstVisible}
        onComplete={handleBurstComplete}
        centerX={burstCenter.x}
        centerY={burstCenter.y}
      />
    </View>
  );
}, (prev, next) =>
  prev.moment.id === next.moment.id &&
  prev.index === next.index &&
  prev.isNearActive === next.isNearActive
);

// ---------------------------------------------------------------------------
// PhotoCarousel — fullscreen lightbox
// ---------------------------------------------------------------------------

export function PhotoCarousel({
  moments,
  initialIndex,
  people,
  onClose,
  onFavorite,
  onComment,
  onAction,
  onIndexChange,
  dismissedIds,
}: PhotoCarouselProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [currentIdx, setCurrentIdx] = useState(initialIndex);
  const [actionsVisible, setActionsVisible] = useState(false);
  const [chromeVisible, setChromeVisible] = useState(true);
  const [favoritedIds, setFavoritedIds] = useState<Set<string>>(new Set());

  const scrollX = useSharedValue(initialIndex * SCREEN_W);
  const chromeOpacity = useSharedValue(1);

  const currentMoment = moments[currentIdx];
  const isHd = !!currentMoment?.hdPhoto;

  useEffect(() => {
    if (onIndexChange) onIndexChange(currentIdx);
  }, [currentIdx]);

  // Preload ±2 adjacent (HD when available)
  useEffect(() => {
    [currentIdx - 2, currentIdx - 1, currentIdx, currentIdx + 1, currentIdx + 2]
      .filter((i) => i >= 0 && i < moments.length)
      .forEach((i) => {
        const uri = moments[i].hdPhoto || moments[i].photo;
        if (uri) Image.prefetch(uri).catch(() => {});
      });
  }, [currentIdx, moments]);

  const handleFavorite = useCallback((moment: MomentDisplay) => {
    if (onFavorite) {
      onFavorite(moment.id);
      setFavoritedIds((prev) => new Set(prev).add(moment.id));
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [onFavorite]);

  // Toggle chrome on single tap
  const toggleChrome = useCallback(() => {
    const next = !chromeVisible;
    setChromeVisible(next);
    chromeOpacity.value = withTiming(next ? 1 : 0, { duration: 200 });
  }, [chromeVisible]);

  // ---------------------------------------------------------------------------
  // Gestures
  // ---------------------------------------------------------------------------

  // Horizontal pan for swiping between photos
  const horizontalPan = Gesture.Pan()
    .activeOffsetX([-15, 15])
    .failOffsetY([-10, 10])
    .onUpdate((event) => {
      'worklet';
      const translation = event.translationX;
      const baseX = currentIdx * SCREEN_W;
      if ((currentIdx === 0 && translation > 0) || (currentIdx === moments.length - 1 && translation < 0)) {
        scrollX.value = baseX + translation * thresholds.edgeResistance;
      } else {
        scrollX.value = baseX + translation;
      }
    })
    .onEnd((event) => {
      'worklet';
      const velocity = event.velocityX;
      const translation = event.translationX;
      const shouldAdvance = Math.abs(translation) > 80 || Math.abs(velocity) > thresholds.flickVelocity;
      const direction = translation < 0 ? 'left' : 'right';

      if (shouldAdvance) {
        if (direction === 'left' && currentIdx < moments.length - 1) {
          scrollX.value = withSpring((currentIdx + 1) * SCREEN_W, springPresets.CAROUSEL_SNAP);
          runOnJS(setCurrentIdx)(currentIdx + 1);
          runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
        } else if (direction === 'right' && currentIdx > 0) {
          scrollX.value = withSpring((currentIdx - 1) * SCREEN_W, springPresets.CAROUSEL_SNAP);
          runOnJS(setCurrentIdx)(currentIdx - 1);
          runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
        } else {
          scrollX.value = withSpring(currentIdx * SCREEN_W, springPresets.CAROUSEL_SNAP);
        }
      } else {
        scrollX.value = withSpring(currentIdx * SCREEN_W, springPresets.CAROUSEL_SNAP);
      }
    });

  // Single tap toggles chrome
  const singleTap = Gesture.Tap()
    .numberOfTaps(1)
    .onEnd(() => {
      'worklet';
      runOnJS(toggleChrome)();
    });

  const composedGestures = Gesture.Simultaneous(
    horizontalPan,
    singleTap,
  );

  // ---------------------------------------------------------------------------
  // Animated styles
  // ---------------------------------------------------------------------------

  const containerStyle = useAnimatedStyle(() => ({
    opacity: 1,
  }));

  const bgStyle = useAnimatedStyle(() => ({
    opacity: 1,
  }));

  const chromeStyle = useAnimatedStyle(() => ({
    opacity: chromeOpacity.value,
  }));

  const trackStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -scrollX.value }],
  }));

  const handleAction = useCallback((action: PhotoAction) => {
    setActionsVisible(false);
    if (onAction && currentMoment) onAction(action, currentMoment);
  }, [currentMoment, onAction]);

  const isFavorited = currentMoment?.isFavorited || favoritedIds.has(currentMoment?.id ?? '');

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <GestureHandlerRootView style={styles.root}>
      {/* Background */}
      <Animated.View style={[styles.bg, bgStyle]} />

      {/* Photo track */}
      <GestureDetector gesture={composedGestures}>
        <Animated.View style={[styles.trackContainer, containerStyle]}>
          <Animated.View
            style={[
              styles.track,
              { width: SCREEN_W * moments.length },
              trackStyle,
            ]}
          >
            {moments.map((moment, idx) => (
              <CarouselItem
                key={moment.id}
                moment={moment}
                index={idx}
                scrollX={scrollX}
                onDoubleTap={handleFavorite}
                isNearActive={Math.abs(idx - currentIdx) <= 2}
              />
            ))}
          </Animated.View>
        </Animated.View>
      </GestureDetector>

      {/* ── Top chrome ── */}
      <Animated.View style={[styles.topChrome, { paddingTop: insets.top + 4 }, chromeStyle]} pointerEvents={chromeVisible ? 'auto' : 'none'}>
        <LinearGradient
          colors={['rgba(0,0,0,0.6)', 'transparent']}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <Pressable onPress={() => { Haptics.selectionAsync(); onClose(); }} style={styles.pill} accessibilityLabel="Close">
          <ChevronLeft size={18} color="#fff" strokeWidth={2.5} />
        </Pressable>

        <View style={styles.counterPill}>
          <Text style={styles.counterText}>{currentIdx + 1} / {moments.length}</Text>
          {isHd && (
            <View style={styles.hdBadge}>
              <Sparkles size={10} color="#000" strokeWidth={2.5} />
              <Text style={styles.hdText}>HD</Text>
            </View>
          )}
        </View>

        <Pressable onPress={() => { Haptics.selectionAsync(); setActionsVisible(true); }} style={styles.pill} accessibilityLabel="More actions">
          <MoreHorizontal size={18} color="#fff" strokeWidth={1.8} />
        </Pressable>
      </Animated.View>

      {/* ── Bottom chrome: caption + actions ── */}
      <Animated.View style={[styles.bottomChrome, { paddingBottom: insets.bottom + 16 }, chromeStyle]} pointerEvents={chromeVisible ? 'auto' : 'none'}>
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.7)']}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        {/* Shared by indicator */}
        {currentMoment && (() => {
          const personEntry = currentMoment.userId ? people[currentMoment.userId] : null;
          const authorName = personEntry?.name ?? currentMoment.takenBy;
          if (!authorName) return null;
          return (
            <View style={styles.sharedByRow}>
              <View style={[styles.sharedByAvatar, { backgroundColor: currentMoment.authorColor ?? '#a64d1e' }]}>
                {personEntry?.avatar ? (
                  <RNImage source={{ uri: personEntry.avatar }} style={styles.sharedByAvatarImg} />
                ) : (
                  <Text style={styles.sharedByInitial}>{authorName.charAt(0).toUpperCase()}</Text>
                )}
              </View>
              <Text style={styles.sharedByText}>
                {currentMoment.isMine ? 'You' : authorName.split(' ')[0]}
              </Text>
              {currentMoment.date && (
                <Text style={styles.sharedByDate}> · {new Date(currentMoment.date + 'T00:00:00+08:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</Text>
              )}
            </View>
          );
        })()}

        {/* Caption / location */}
        {(currentMoment?.caption || currentMoment?.location) && (
          <View style={styles.captionWrap}>
            {currentMoment.location && (
              <View style={styles.locationRow}>
                <MapPin size={12} color="rgba(255,255,255,0.7)" strokeWidth={2} />
                <Text style={styles.locationText} numberOfLines={1}>{currentMoment.location}</Text>
              </View>
            )}
            {currentMoment.caption ? (
              <Text style={styles.captionText} numberOfLines={2}>{currentMoment.caption}</Text>
            ) : null}
          </View>
        )}

        {/* Action buttons */}
        <View style={styles.actionRow}>
          <Pressable
            onPress={() => currentMoment && handleFavorite(currentMoment)}
            style={styles.actionBtn}
            accessibilityLabel={isFavorited ? 'Unfavorite' : 'Favorite'}
          >
            <Heart
              size={22}
              color={isFavorited ? '#ff4d6a' : '#fff'}
              fill={isFavorited ? '#ff4d6a' : 'transparent'}
              strokeWidth={2}
            />
          </Pressable>

          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              if (currentMoment && onComment) onComment(currentMoment.id);
            }}
            style={styles.actionBtn}
            accessibilityLabel="Comments"
          >
            <MessageCircle size={20} color="#fff" strokeWidth={2} />
            {(currentMoment?.commentCount ?? 0) > 0 && (
              <View style={styles.commentBadge}>
                <Text style={styles.commentBadgeText}>{currentMoment!.commentCount}</Text>
              </View>
            )}
          </Pressable>

          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              if (currentMoment && onAction) onAction('share', currentMoment);
            }}
            style={styles.actionBtn}
            accessibilityLabel="Share"
          >
            <Share2 size={20} color="#fff" strokeWidth={2} />
          </Pressable>

          {isHd && (
            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                if (currentMoment && onAction) onAction('download-hd', currentMoment);
              }}
              style={styles.actionBtn}
              accessibilityLabel="Save HD"
            >
              <Download size={20} color="#fff" strokeWidth={2} />
            </Pressable>
          )}
        </View>
      </Animated.View>

      {/* Actions Sheet */}
      <PhotoActionsSheet
        visible={actionsVisible}
        onAction={handleAction}
        onClose={() => setActionsVisible(false)}
        photoId={currentMoment?.id ?? ''}
        currentVisibility={(currentMoment?.visibility as 'shared' | 'private' | 'album') ?? 'shared'}
        hasHd={isHd}
        isMine={currentMoment?.isMine ?? true}
        isDismissed={dismissedIds?.has(currentMoment?.id ?? '') ?? false}
      />
    </GestureHandlerRootView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  bg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  trackContainer: {
    flex: 1,
    overflow: 'hidden',
  },
  track: {
    flexDirection: 'row',
    flex: 1,
  },
  slide: {
    width: SCREEN_W,
    height: SCREEN_H,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoWrap: {
    width: SCREEN_W,
    height: SCREEN_H,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── Top chrome ──
  topChrome: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 16,
    zIndex: 10,
  },
  pill: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
  },
  counterText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  hdBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#d8ab7a',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  hdText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#000',
    letterSpacing: 0.5,
  },

  // ── Bottom chrome ──
  bottomChrome: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 40,
    zIndex: 10,
  },
  captionWrap: {
    marginBottom: 16,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  locationText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '500',
  },
  captionText: {
    fontSize: 15,
    color: '#fff',
    fontWeight: '500',
    lineHeight: 21,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  actionBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#d8ab7a',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  commentBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#141210',
  },

  // ── Shared by ──
  sharedByRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  sharedByAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  sharedByAvatarImg: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  sharedByInitial: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },
  sharedByText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
  },
  sharedByDate: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.5)',
  },
});
