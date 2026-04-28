import React, { useCallback, useRef, useState, useEffect } from 'react';
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
  interpolate,
  Extrapolation,
  type SharedValue,
} from 'react-native-reanimated';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { ChevronLeft, Heart, Share2, Bookmark, MoreHorizontal } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CachedImage } from '@/components/CachedImage';
import { useTheme } from '@/constants/ThemeContext';
import { springPresets, thresholds } from '@/constants/animations';
import type { MomentDisplay, PeopleMap } from './types';
import { HeartBurst } from './HeartBurst';
import { PhotoActionsSheet, type PhotoAction } from './PhotoActionsSheet';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

interface PhotoCarouselProps {
  moments: MomentDisplay[];
  initialIndex: number;
  people: PeopleMap;
  onClose: () => void;
  onFavorite?: (id: string) => void;
  onAction?: (action: PhotoAction, moment: MomentDisplay) => void;
  onIndexChange?: (index: number) => void;
}

interface CarouselItemProps {
  moment: MomentDisplay;
  index: number;
  scrollX: SharedValue<number>;
  onDoubleTap: (moment: MomentDisplay) => void;
}

function CarouselItem({ moment, index, scrollX, onDoubleTap }: CarouselItemProps) {
  const [burstVisible, setBurstVisible] = useState(false);
  const [burstCenter, setBurstCenter] = useState({ x: SCREEN_W / 2, y: SCREEN_H / 2 });

  const animatedStyle = useAnimatedStyle(() => {
    const inputRange = [
      (index - 1) * SCREEN_W,
      index * SCREEN_W,
      (index + 1) * SCREEN_W,
    ];

    const scale = interpolate(
      scrollX.value,
      inputRange,
      [0.85, 1, 0.85],
      Extrapolation.CLAMP
    );

    const opacity = interpolate(
      scrollX.value,
      inputRange,
      [0.5, 1, 0.5],
      Extrapolation.CLAMP
    );

    const rotateY = interpolate(
      scrollX.value,
      inputRange,
      [15, 0, -15],
      Extrapolation.CLAMP
    );

    const translateX = interpolate(
      scrollX.value,
      inputRange,
      [-SCREEN_W * 0.1, 0, SCREEN_W * 0.1],
      Extrapolation.CLAMP
    );

    return {
      transform: [
        { translateX },
        { scale },
        { perspective: 1000 },
        { rotateY: `${rotateY}deg` },
      ],
      opacity,
    };
  });

  const handleDoubleTap = useCallback(() => {
    setBurstCenter({ x: SCREEN_W / 2, y: SCREEN_H / 2 });
    setBurstVisible(true);
    onDoubleTap(moment);
  }, [moment, onDoubleTap]);

  const handleBurstComplete = useCallback(() => {
    setBurstVisible(false);
  }, []);

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .maxDuration(250)
    .onEnd(() => {
      'worklet';
      runOnJS(handleDoubleTap)();
    });

  return (
    <View style={styles.carouselItem}>
      <GestureDetector gesture={doubleTap}>
        <Animated.View style={[styles.photoContainer, animatedStyle]}>
          {moment.photo ? (
            <CachedImage
              remoteUrl={moment.photo}
              style={styles.photo}
              resizeMode="contain"
            />
          ) : (
            <View style={[styles.photo, { backgroundColor: '#1a1a1a' }]} />
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
}

export function PhotoCarousel({
  moments,
  initialIndex,
  people,
  onClose,
  onFavorite,
  onAction,
  onIndexChange,
}: PhotoCarouselProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [currentIdx, setCurrentIdx] = useState(initialIndex);
  const [actionsVisible, setActionsVisible] = useState(false);
  const [favoritedIds, setFavoritedIds] = useState<Set<string>>(new Set());

  const scrollX = useSharedValue(initialIndex * SCREEN_W);
  const translateY = useSharedValue(0);
  const dismissScale = useSharedValue(1);
  const dismissOpacity = useSharedValue(1);
  const bgOpacity = useSharedValue(1);

  const currentMoment = moments[currentIdx];

  useEffect(() => {
    if (onIndexChange) {
      onIndexChange(currentIdx);
    }
  }, [currentIdx]);

  const handleFavorite = useCallback((moment: MomentDisplay) => {
    if (onFavorite) {
      onFavorite(moment.id);
      setFavoritedIds(prev => new Set(prev).add(moment.id));
    }
  }, [onFavorite]);

  const handleSwipeLeft = useCallback(() => {
    if (currentIdx < moments.length - 1) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setCurrentIdx(prev => prev + 1);
      scrollX.value = withSpring((currentIdx + 1) * SCREEN_W, springPresets.CAROUSEL_SNAP);
    }
  }, [currentIdx, moments.length, scrollX]);

  const handleSwipeRight = useCallback(() => {
    if (currentIdx > 0) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setCurrentIdx(prev => prev - 1);
      scrollX.value = withSpring((currentIdx - 1) * SCREEN_W, springPresets.CAROUSEL_SNAP);
    }
  }, [currentIdx, scrollX]);

  const handleDismissComplete = useCallback(() => {
    onClose();
  }, [onClose]);

  // Horizontal pan for carousel
  const horizontalPan = Gesture.Pan()
    .activeOffsetX([-15, 15])
    .failOffsetY([-10, 10])
    .onUpdate((event) => {
      'worklet';
      const translation = event.translationX;
      const baseX = currentIdx * SCREEN_W;
      
      // Edge resistance
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
      const shouldAdvance = Math.abs(translation) > 100 || Math.abs(velocity) > thresholds.flickVelocity;
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

  // Vertical pan for dismiss
  const verticalPan = Gesture.Pan()
    .activeOffsetY([-20, 20])
    .failOffsetX([-10, 10])
    .onUpdate((event) => {
      'worklet';
      if (event.translationY > 0) {
        const progress = Math.min(event.translationY / thresholds.dismissSwipe, 1);
        translateY.value = event.translationY * 0.6;
        dismissScale.value = 1 - progress * 0.2;
        bgOpacity.value = 1 - progress * 0.6;
      }
    })
    .onEnd((event) => {
      'worklet';
      if (event.translationY > thresholds.dismissSwipe || event.velocityY > 300) {
        translateY.value = withSpring(SCREEN_H, springPresets.DISMISS);
        dismissOpacity.value = withTiming(0, { duration: 250 });
        runOnJS(handleDismissComplete)();
        runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Medium);
      } else {
        translateY.value = withSpring(0, springPresets.BOUNCY);
        dismissScale.value = withSpring(1, springPresets.BOUNCY);
        bgOpacity.value = withSpring(1, springPresets.BOUNCY);
      }
    });

  // Swipe up for action sheet
  const swipeUp = Gesture.Pan()
    .activeOffsetY([-30, -5])
    .failOffsetX([-10, 10])
    .onEnd((event) => {
      'worklet';
      if (event.translationY < -80 || event.velocityY < -300) {
        runOnJS(setActionsVisible)(true);
        runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
      }
    });

  const composedGestures = Gesture.Simultaneous(
    Gesture.Race(horizontalPan, verticalPan),
    swipeUp
  );

  const containerStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { scale: dismissScale.value },
    ],
    opacity: dismissOpacity.value,
  }));

  const bgStyle = useAnimatedStyle(() => ({
    opacity: bgOpacity.value,
  }));

  const handleAction = useCallback((action: PhotoAction) => {
    setActionsVisible(false);
    if (onAction && currentMoment) {
      onAction(action, currentMoment);
    }
  }, [currentMoment, onAction]);

  return (
    <GestureHandlerRootView style={styles.root}>
      {/* Background */}
      <Animated.View style={[styles.background, bgStyle]} />

      {/* Carousel */}
      <GestureDetector gesture={composedGestures}>
        <Animated.View style={[styles.carouselContainer, containerStyle]}>
          <Animated.View
            style={[
              styles.carouselTrack,
              { transform: [{ translateX: -scrollX.value }] },
            ]}
          >
            {moments.map((moment, idx) => (
              <CarouselItem
                key={moment.id}
                moment={moment}
                index={idx}
                scrollX={scrollX}
                onDoubleTap={handleFavorite}
              />
            ))}
          </Animated.View>
        </Animated.View>
      </GestureDetector>

      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            onClose();
          }}
          style={styles.topBtn}
        >
          <ChevronLeft size={20} color="#fff" strokeWidth={2.5} />
        </Pressable>

        <View style={styles.counter}>
          <Text style={styles.counterText}>
            {currentIdx + 1} of {moments.length}
          </Text>
        </View>

        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            setActionsVisible(true);
          }}
          style={styles.topBtn}
        >
          <MoreHorizontal size={18} color="#fff" strokeWidth={1.8} />
        </Pressable>
      </View>

      {/* Bottom bar */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
        <Pressable
          onPress={() => currentMoment && handleFavorite(currentMoment)}
          style={styles.bottomBtn}
        >
          <Heart
            size={22}
            color={currentMoment?.isFavorited ? '#e55' : '#fff'}
            fill={currentMoment?.isFavorited ? '#e55' : 'transparent'}
            strokeWidth={2}
          />
        </Pressable>

        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            if (currentMoment && onAction) {
              onAction('share', currentMoment);
            }
          }}
          style={styles.bottomBtn}
        >
          <Share2 size={22} color="#fff" strokeWidth={2} />
        </Pressable>

        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            if (currentMoment && onAction) {
              onAction('reel', currentMoment);
            }
          }}
          style={styles.bottomBtn}
        >
          <Bookmark size={22} color="#fff" strokeWidth={2} />
        </Pressable>
      </View>

      {/* Actions Sheet */}
      <PhotoActionsSheet
        visible={actionsVisible}
        onAction={handleAction}
        onClose={() => setActionsVisible(false)}
        photoId={currentMoment?.id ?? ''}
      />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  background: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  carouselContainer: {
    flex: 1,
    overflow: 'hidden',
  },
  carouselTrack: {
    flexDirection: 'row',
    width: SCREEN_W * 3, // Dynamic in real usage
  },
  carouselItem: {
    width: SCREEN_W,
    height: SCREEN_H,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoContainer: {
    width: SCREEN_W,
    height: SCREEN_H * 0.8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
    zIndex: 10,
  },
  topBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  counter: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  counterText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 32,
    paddingTop: 16,
    paddingHorizontal: 16,
    zIndex: 10,
  },
  bottomBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
