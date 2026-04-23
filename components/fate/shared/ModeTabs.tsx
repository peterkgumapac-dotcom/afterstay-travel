import * as Haptics from 'expo-haptics';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { fateColors, fateLayout } from '@/constants/fateTheme';

interface ModeTabsProps {
  activeMode: 'wheel' | 'touch';
  onModeChange: (mode: 'wheel' | 'touch') => void;
}

const TABS: { key: 'wheel' | 'touch'; label: string }[] = [
  { key: 'wheel', label: 'Wheel' },
  { key: 'touch', label: 'Touch of Fate' },
];

export default function ModeTabs({ activeMode, onModeChange }: ModeTabsProps) {
  const handlePress = (mode: 'wheel' | 'touch') => {
    if (mode !== activeMode) {
      Haptics.selectionAsync();
      onModeChange(mode);
    }
  };

  return (
    <View style={styles.container}>
      {TABS.map(({ key, label }) => {
        const active = key === activeMode;
        return (
          <Pressable
            key={key}
            onPress={() => handlePress(key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={label}
            style={[styles.tab, active && styles.tabActive]}
          >
            <Text style={[styles.tabText, active && styles.tabTextActive]}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: 'rgba(139, 90, 43, 0.08)',
    borderRadius: fateLayout.tabBarRadius,
    padding: fateLayout.tabBarPadding,
    marginBottom: 20,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: fateLayout.tabActiveRadius,
  },
  tabActive: {
    backgroundColor: fateColors.background,
    shadowColor: fateColors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 2,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: fateColors.textMuted,
  },
  tabTextActive: {
    color: fateColors.textPrimary,
  },
});
