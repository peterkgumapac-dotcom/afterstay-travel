import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/constants/ThemeContext';
import { radius } from '@/constants/theme';

interface StatBlockProps {
  label: string;
  value: number;
}

export function StatBlock({ label, value }: StatBlockProps) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
        },
      ]}
    >
      <Text
        style={[
          styles.value,
          { color: colors.text },
        ]}
      >
        {value}
      </Text>
      <Text
        style={[
          styles.label,
          { color: colors.text3 },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: radius.sm,
  },
  value: {
    fontSize: 20,
    lineHeight: 20,
    fontWeight: '500',
    fontFamily: 'SpaceMono',
    letterSpacing: -0.8,
  },
  label: {
    fontSize: 10,
    fontWeight: '550',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: 5,
  },
});
