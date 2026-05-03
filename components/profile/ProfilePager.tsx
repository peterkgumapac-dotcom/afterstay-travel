import React, { useRef, useState } from 'react';
import {
  Animated,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

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
  const segmentWidth = Math.min(238, Math.max(184, width - 140));
  const thumbWidth = (segmentWidth - 6) / 2;

  const indicator = x.interpolate({
    inputRange: [0, width],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const onMomentumEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    setActive(Math.max(0, Math.min(1, Math.round(event.nativeEvent.contentOffset.x / width))));
  };

  const jumpTo = (index: number) => {
    scrollRef.current?.scrollTo({ x: index * width, animated: true });
    setActive(index);
  };

  return (
    <View style={s.root}>
      <View style={s.segmentRow}>
        <View style={[s.segment, { width: segmentWidth }]}>
          <Animated.View
            style={[
              s.thumb,
              {
                width: thumbWidth,
                transform: [{
                  translateX: indicator.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, thumbWidth],
                  }),
                }],
              },
            ]}
          />
          {(['Profile', 'Memories'] as const).map((label, index) => (
            <Pressable key={label} style={s.tab} onPress={() => jumpTo(index)}>
              <Text style={[s.tabText, active === index && s.tabTextActive]}>{label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

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
  segmentRow: {
    position: 'absolute',
    top: 52,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  segment: {
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(253,248,235,0.92)',
    flexDirection: 'row',
    padding: 3,
    shadowColor: '#2a1d0d',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  thumb: {
    position: 'absolute',
    left: 3,
    top: 3,
    bottom: 3,
    borderRadius: 18,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  tabText: {
    color: colors.text2,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0,
  },
  tabTextActive: {
    color: colors.text,
  },
});
