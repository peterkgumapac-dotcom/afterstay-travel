/**
 * Center-zero horizontal slider for photo adjustments (-100 to +100).
 * Uses PanResponder for reliable touch handling inside ScrollViews.
 */

import React, { useMemo, useRef } from 'react';
import { Dimensions, PanResponder, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/constants/ThemeContext';

const { width: SCREEN_W } = Dimensions.get('window');
const TRACK_W = SCREEN_W - 80;
const THUMB_SIZE = 24;
const TRACK_H = 3;

interface AdjustmentSliderProps {
  value: number;
  onValueChange: (v: number) => void;
}

export function AdjustmentSlider({ value, onValueChange }: AdjustmentSliderProps) {
  const { colors } = useTheme();

  // Refs so PanResponder always sees latest value/callback
  const valueRef = useRef(value);
  valueRef.current = value;
  const cbRef = useRef(onValueChange);
  cbRef.current = onValueChange;

  const startValue = useRef(0);
  const didCenterHaptic = useRef(false);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dx) > 4,
        onPanResponderGrant: () => {
          startValue.current = valueRef.current;
          didCenterHaptic.current = false;
        },
        onPanResponderMove: (_, gs) => {
          const delta = (gs.dx / TRACK_W) * 200;
          const raw = startValue.current + delta;
          const clamped = Math.round(Math.min(100, Math.max(-100, raw)));
          cbRef.current(clamped);
          if (Math.abs(clamped) <= 1 && !didCenterHaptic.current) {
            didCenterHaptic.current = true;
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }
        },
        onPanResponderTerminationRequest: () => false,
      }),
    [],
  );

  const thumbLeft = ((value + 100) / 200) * TRACK_W;
  const center = TRACK_W / 2;
  const fillLeft = Math.min(thumbLeft, center);
  const fillWidth = Math.abs(thumbLeft - center);

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: colors.text, left: thumbLeft + 40 - 20 }]}>
        {value > 0 ? `+${value}` : `${value}`}
      </Text>

      <View style={styles.trackArea} {...panResponder.panHandlers}>
        <View style={[styles.track, { backgroundColor: colors.border }]} />
        <View style={[styles.centerTick, { backgroundColor: colors.text3 }]} />
        <View
          style={[
            styles.fill,
            { left: fillLeft, width: fillWidth, backgroundColor: colors.accent },
          ]}
        />
        <View
          style={[
            styles.thumb,
            { left: thumbLeft - THUMB_SIZE / 2, backgroundColor: colors.accent },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 56,
    justifyContent: 'flex-end',
    paddingHorizontal: 40,
  },
  label: {
    position: 'absolute',
    top: 4,
    width: 40,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  trackArea: {
    height: 40,
    justifyContent: 'center',
  },
  track: {
    height: TRACK_H,
    borderRadius: TRACK_H / 2,
    width: TRACK_W,
  },
  centerTick: {
    position: 'absolute',
    width: 1.5,
    height: 10,
    left: TRACK_W / 2 - 0.75,
    borderRadius: 1,
  },
  fill: {
    position: 'absolute',
    height: TRACK_H,
    borderRadius: TRACK_H / 2,
  },
  thumb: {
    position: 'absolute',
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
});
