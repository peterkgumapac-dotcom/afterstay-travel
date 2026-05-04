import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';

import { lightColors, useTheme } from '@/constants/ThemeContext';

interface ProfilePagerProps {
  profilePage: React.ReactNode;
  memoriesPage: React.ReactNode;
}

export default function ProfilePager({ profilePage, memoriesPage }: ProfilePagerProps) {
  const { width } = useWindowDimensions();
  const colors = lightColors;
  const s = getStyles(colors);
  const scrollRef = useRef<ScrollView>(null);
  const x = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const [active, setActive] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const dotProgress = x.interpolate({
    inputRange: [0, width],
    outputRange: [0, 10],
    extrapolate: 'clamp',
  });

  const onMomentumEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    setActive(Math.max(0, Math.min(1, Math.round(event.nativeEvent.contentOffset.x / width))));
    setIsDragging(false);
  };

  const jumpTo = (index: number) => {
    scrollRef.current?.scrollTo({ x: index * width, animated: true });
    setActive(index);
  };

  const nextIndex = active === 0 ? 1 : 0;
  const pulseDirection = active === 0 ? 1 : -1;
  const pulseTranslate = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0, pulseDirection * 3],
  });
  const pulseScale = pulse.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, 1.03, 1],
  });
  const pulseOpacity = pulse.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.7, 1, 0.7],
  });

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 900,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [pulse]);

  return (
    <View style={s.root}>
      <Animated.ScrollView
        ref={scrollRef}
        style={s.pager}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x } } }],
          { useNativeDriver: true },
        )}
        onScrollBeginDrag={() => setIsDragging(true)}
        onScrollEndDrag={() => setIsDragging(false)}
        onMomentumScrollEnd={onMomentumEnd}
      >
        <View style={[s.page, { width }]}>{profilePage}</View>
        <View style={[s.page, { width }]}>{memoriesPage}</View>
      </Animated.ScrollView>

      <View
        style={[s.edgeRail, active === 0 ? s.edgeRailRight : s.edgeRailLeft, isDragging && s.edgeRailHidden]}
        pointerEvents={isDragging ? 'none' : 'box-none'}
      >
        <Animated.View
          style={[
            s.edgePulse,
            {
              opacity: pulseOpacity,
              transform: [
                { translateX: pulseTranslate },
                { scale: pulseScale },
              ],
            },
          ]}
        >
          <Pressable
            style={s.edgeButton}
            onPress={() => jumpTo(nextIndex)}
            accessibilityRole="button"
            accessibilityLabel={active === 0 ? 'Show memories' : 'Show profile'}
          >
            {active === 0 ? (
              <ChevronRight size={18} color={colors.accent} strokeWidth={2.5} />
            ) : (
              <ChevronLeft size={18} color={colors.accent} strokeWidth={2.5} />
            )}
          </Pressable>
        </Animated.View>
      </View>

      <View style={s.dots} pointerEvents="none">
        <View style={s.dotTrack}>
          <Animated.View style={[s.dotActive, { transform: [{ translateX: dotProgress }] }]} />
        </View>
      </View>
    </View>
  );
}

const getStyles = (colors: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  pager: {
    flex: 1,
  },
  page: {
    flex: 1,
  },
  edgeRail: {
    position: 'absolute',
    top: 330,
    zIndex: 14,
    elevation: 8,
  },
  edgeRailRight: {
    right: 8,
  },
  edgeRailLeft: {
    left: 8,
  },
  edgePulse: {
    borderRadius: 22,
  },
  edgeButton: {
    width: 42,
    height: 54,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: 'rgba(217,202,171,0.94)',
    backgroundColor: 'rgba(253,248,235,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#4b2d13',
    shadowOpacity: 0.16,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  edgeRailHidden: {
    opacity: 0,
  },
  dots: {
    position: 'absolute',
    bottom: 22,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  dotTrack: {
    width: 18,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(168,145,108,0.22)',
  },
  dotActive: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
});
