import * as Haptics from 'expo-haptics';
import { Compass, MapPin } from 'lucide-react-native';
import React, { useCallback } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { PAPER } from '@/components/feed/feedTheme';
import { useTheme } from '@/constants/ThemeContext';

export type DiscoverMode = 'explore_moments' | 'plan';

interface DiscoverModeSwitchProps {
  mode: DiscoverMode;
  onModeChange: (mode: DiscoverMode) => void;
}

const MODES: { id: DiscoverMode; label: string; Icon: React.ElementType }[] = [
  { id: 'explore_moments', label: 'Explore Moments', Icon: Compass },
  { id: 'plan', label: 'Find Places & Food', Icon: MapPin },
];

const PILL_H = 36;
const DURATION = 250;

export default function DiscoverModeSwitch({ mode, onModeChange }: DiscoverModeSwitchProps) {
  const { colors } = useTheme();
  const isPaper = mode === 'explore_moments';
  const pillX = useSharedValue(mode === 'explore_moments' ? 0 : 1);

  const handlePress = useCallback((id: DiscoverMode) => {
    if (id === mode) return;
    pillX.value = withTiming(id === 'explore_moments' ? 0 : 1, { duration: DURATION });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onModeChange(id);
  }, [mode, onModeChange, pillX]);

  const pillStyle = useAnimatedStyle(() => ({
    left: `${pillX.value * 50}%` as unknown as number,
  }));

  const trackBg = isPaper ? PAPER.ivoryClean : colors.card;
  const trackBorder = isPaper ? PAPER.rule : colors.border;
  const pillBg = isPaper ? PAPER.stamp : colors.accent;
  const inactiveColor = isPaper ? PAPER.inkMid : colors.text2;

  return (
    <View style={styles.container}>
      <View style={[styles.track, { backgroundColor: trackBg, borderColor: trackBorder }]}>
        <Animated.View style={[styles.pill, pillStyle, { backgroundColor: pillBg }]} />
        {MODES.map(({ id, label, Icon }) => {
          const active = mode === id;
          return (
            <TouchableOpacity
              key={id}
              style={styles.option}
              onPress={() => handlePress(id)}
              activeOpacity={0.7}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
            >
              <Icon
                size={14}
                color={active ? '#fff' : inactiveColor}
                strokeWidth={active ? 2 : 1.5}
              />
              <Text style={[styles.label, { color: inactiveColor }, active && styles.labelActive]}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  track: {
    flexDirection: 'row',
    borderRadius: PILL_H / 2,
    height: PILL_H,
    borderWidth: 1,
    overflow: 'hidden',
  },
  pill: {
    position: 'absolute',
    top: 0,
    width: '50%',
    height: '100%',
    borderRadius: PILL_H / 2,
  },
  option: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    zIndex: 1,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  labelActive: {
    color: '#fff',
    fontWeight: '700',
  },
});
