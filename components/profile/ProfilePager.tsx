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

import { useTheme } from '@/constants/ThemeContext';

interface ProfilePagerProps {
  profilePage: React.ReactNode;
  memoriesPage: React.ReactNode;
}

export default function ProfilePager({ profilePage, memoriesPage }: ProfilePagerProps) {
  const { width } = useWindowDimensions();
  const { colors } = useTheme();
  const s = getStyles(colors);
  const scrollRef = useRef<ScrollView>(null);
  const x = useRef(new Animated.Value(0)).current;
  const [active, setActive] = useState(0);
  const segmentInnerWidth = Math.max(0, width - 40);
  const thumbWidth = segmentInnerWidth / 2;

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
      <View style={s.segment}>
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
  },
  pager: {
    flex: 1,
  },
  page: {
    flex: 1,
  },
  segment: {
    height: 44,
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  thumb: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 4,
    borderRadius: 18,
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabText: {
    color: colors.text3,
    fontSize: 13,
    fontWeight: '700',
  },
  tabTextActive: {
    color: colors.text,
  },
});
