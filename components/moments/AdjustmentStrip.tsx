/**
 * Instagram-style adjustment tool strip.
 *
 * Bottom row of tool icons (horizontal scroll) — tap one to reveal
 * a center-zero slider above it. Modified tools show a dot indicator.
 * Double-tap resets a single tool to 0.
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import {
  Sun,
  Contrast,
  Thermometer,
  Droplets,
  CloudFog,
  Aperture,
  Sparkles,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';

import { useTheme } from '@/constants/ThemeContext';
import type { AdjustmentKey, AdjustmentValues } from '@/hooks/usePhotoAdjustments';
import { AdjustmentSlider } from './AdjustmentSlider';

// ── Tool definitions ───────────────────────────────────────────────────────

interface Tool {
  key: AdjustmentKey;
  label: string;
  Icon: LucideIcon;
}

const TOOLS: Tool[] = [
  { key: 'brightness',  label: 'Brightness',  Icon: Sun },
  { key: 'contrast',    label: 'Contrast',    Icon: Contrast },
  { key: 'warmth',      label: 'Warmth',      Icon: Thermometer },
  { key: 'saturation',  label: 'Saturation',  Icon: Droplets },
  { key: 'fade',        label: 'Fade',        Icon: CloudFog },
  { key: 'vignette',    label: 'Vignette',    Icon: Aperture },
  { key: 'grain',       label: 'Grain',       Icon: Sparkles },
];

// ── Props ──────────────────────────────────────────────────────────────────

interface AdjustmentStripProps {
  values: AdjustmentValues;
  onValueChange: (key: AdjustmentKey, value: number) => void;
  onResetAll: () => void;
}

// ── Component ──────────────────────────────────────────────────────────────

export function AdjustmentStrip({ values, onValueChange, onResetAll }: AdjustmentStripProps) {
  const { colors } = useTheme();
  const s = useMemo(() => getStyles(), []);
  const [activeTool, setActiveTool] = useState<AdjustmentKey | null>(null);
  const lastTap = useRef<{ key: AdjustmentKey; time: number } | null>(null);

  const hasAnyAdjustment = Object.values(values).some((v) => v !== 0);

  const handleToolPress = useCallback((key: AdjustmentKey) => {
    const now = Date.now();
    // Double-tap detection (300ms window) → reset that tool
    if (lastTap.current?.key === key && now - lastTap.current.time < 300) {
      onValueChange(key, 0);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      lastTap.current = null;
      return;
    }
    lastTap.current = { key, time: now };

    if (activeTool === key) {
      setActiveTool(null);
    } else {
      setActiveTool(key);
      Haptics.selectionAsync();
    }
  }, [activeTool, onValueChange]);

  const handleSliderChange = useCallback((v: number) => {
    if (activeTool) onValueChange(activeTool, v);
  }, [activeTool, onValueChange]);

  return (
    <View style={s.root}>
      {/* Active slider panel */}
      {activeTool && (
        <Animated.View entering={FadeIn.duration(150)} exiting={FadeOut.duration(100)} style={s.sliderRow}>
          <AdjustmentSlider
            value={values[activeTool]}
            onValueChange={handleSliderChange}
          />
        </Animated.View>
      )}

      {/* Tool icon row */}
      <View style={s.toolBarWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.toolBar}
          bounces={false}
        >
          {TOOLS.map(({ key, label, Icon }) => {
            const isActive = activeTool === key;
            const isModified = values[key] !== 0;

            return (
              <Pressable
                key={key}
                onPress={() => handleToolPress(key)}
                style={s.toolBtn}
                accessibilityLabel={`${label} adjustment`}
                accessibilityRole="button"
              >
                <View style={[s.iconWrap, isActive && { backgroundColor: colors.accentDim }]}>
                  <Icon
                    size={20}
                    color={isActive ? colors.accent : colors.text3}
                    strokeWidth={isActive ? 2.2 : 1.8}
                  />
                  {/* Modified dot */}
                  {isModified && <View style={[s.modDot, { backgroundColor: colors.accent }]} />}
                </View>
                <Text
                  style={[s.toolLabel, { color: isActive ? colors.accent : colors.text3 }]}
                  numberOfLines={1}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Reset all */}
        {hasAnyAdjustment && (
          <Pressable
            onPress={() => {
              onResetAll();
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            }}
            style={s.resetBtn}
            accessibilityLabel="Reset all adjustments"
          >
            <Text style={[s.resetText, { color: colors.accent }]}>Reset</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

const getStyles = () =>
  StyleSheet.create({
    root: {
      paddingBottom: 4,
    },
    sliderRow: {
      paddingTop: 4,
      paddingBottom: 8,
    },
    toolBarWrap: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    toolBar: {
      flexDirection: 'row',
      gap: 4,
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    toolBtn: {
      alignItems: 'center',
      width: 62,
    },
    iconWrap: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    modDot: {
      position: 'absolute',
      bottom: 2,
      right: 2,
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    toolLabel: {
      fontSize: 10,
      fontWeight: '500',
      marginTop: 3,
      letterSpacing: -0.2,
    },
    resetBtn: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      marginRight: 8,
    },
    resetText: {
      fontSize: 12,
      fontWeight: '600',
    },
  });
