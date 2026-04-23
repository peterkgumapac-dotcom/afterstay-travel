import * as Haptics from 'expo-haptics';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { fateColors } from '@/constants/fateTheme';

interface DuoToggleProps {
  duo: boolean;
  onToggle: (duo: boolean) => void;
}

const OPTIONS: { key: boolean; label: string }[] = [
  { key: false, label: 'Solo' },
  { key: true, label: 'Duo' },
];

export default function DuoToggle({ duo, onToggle }: DuoToggleProps) {
  return (
    <View style={styles.container}>
      {OPTIONS.map(({ key, label }) => {
        const active = key === duo;
        return (
          <Pressable
            key={label}
            onPress={() => {
              if (key !== duo) {
                Haptics.selectionAsync();
                onToggle(key);
              }
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={[styles.option, active && styles.optionActive]}
          >
            <Text style={[styles.text, active && styles.textActive]}>
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
    borderRadius: 6,
    padding: 2,
    alignSelf: 'flex-end',
    marginBottom: 12,
  },
  option: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 5,
  },
  optionActive: {
    backgroundColor: fateColors.background,
    shadowColor: fateColors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 1,
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
    color: fateColors.textMuted,
  },
  textActive: {
    color: fateColors.textPrimary,
  },
});
