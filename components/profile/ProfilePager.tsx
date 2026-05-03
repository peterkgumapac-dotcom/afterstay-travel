import React, { useRef, useState } from 'react';
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
  const [active, setActive] = useState(0);

  const dotProgress = x.interpolate({
    inputRange: [0, width],
    outputRange: [0, 10],
    extrapolate: 'clamp',
  });

  const onMomentumEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    setActive(Math.max(0, Math.min(1, Math.round(event.nativeEvent.contentOffset.x / width))));
  };

  const jumpTo = (index: number) => {
    scrollRef.current?.scrollTo({ x: index * width, animated: true });
    setActive(index);
  };

  const nextIndex = active === 0 ? 1 : 0;

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
        onMomentumScrollEnd={onMomentumEnd}
      >
        <View style={[s.page, { width }]}>{profilePage}</View>
        <View style={[s.page, { width }]}>{memoriesPage}</View>
      </Animated.ScrollView>

      <View style={[s.edgeRail, active === 0 ? s.edgeRailRight : s.edgeRailLeft]} pointerEvents="box-none">
        <Pressable
          style={s.edgeButton}
          onPress={() => jumpTo(nextIndex)}
          accessibilityRole="button"
          accessibilityLabel={active === 0 ? 'Show memories' : 'Show profile'}
        >
          {active === 0 ? (
            <ChevronRight size={22} color={colors.accent} strokeWidth={2.4} />
          ) : (
            <ChevronLeft size={22} color={colors.accent} strokeWidth={2.4} />
          )}
        </Pressable>
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
    top: '48%',
    zIndex: 20,
    elevation: 10,
  },
  edgeRailRight: {
    right: 8,
  },
  edgeRailLeft: {
    left: 8,
  },
  edgeButton: {
    width: 42,
    height: 58,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(253,248,235,0.88)',
    alignItems: 'center',
    justifyContent: 'center',
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
