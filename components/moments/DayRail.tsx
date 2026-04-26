import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/constants/ThemeContext';

interface DayEntry {
  key: string;
  dayNum: string;
  count: number;
}

interface DayRailProps {
  days: DayEntry[];
  active: string | null;
  onChange: (key: string | null) => void;
}

export function DayRail({ days, active, onChange }: DayRailProps) {
  const { colors } = useTheme();

  if (days.length <= 1) return null;

  return (
    <View style={styles.container}>
      {days.map((d) => {
        const isActive = active === d.key;
        return (
          <TouchableOpacity
            key={d.key}
            onPress={() => onChange(isActive ? null : d.key)}
            activeOpacity={0.7}
            style={[
              styles.day,
              {
                backgroundColor: isActive ? colors.accentBg : 'transparent',
              },
            ]}
          >
            <Text
              style={[
                styles.dayNum,
                { color: isActive ? colors.accent : colors.text3 },
              ]}
            >
              {d.dayNum}
            </Text>
            <Text
              style={[
                styles.dayCount,
                { color: isActive ? colors.accent : colors.text3 },
              ]}
            >
              {d.count}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 4,
    top: 0,
    bottom: 0,
    width: 28,
    flexDirection: 'column',
    gap: 2,
    paddingTop: 6,
    zIndex: 10,
  },
  day: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
    paddingVertical: 4,
    borderRadius: 8,
  },
  dayNum: {
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 14,
    fontVariant: ['tabular-nums'],
  },
  dayCount: {
    fontSize: 8,
    fontWeight: '600',
    opacity: 0.6,
    fontVariant: ['tabular-nums'],
    marginTop: 1,
  },
});
