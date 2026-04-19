import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/constants/ThemeContext';

interface StatBlockProps {
  label: string;
  value: number;
}

export function StatBlock({ label, value }: StatBlockProps) {
  const { colors } = useTheme();
  const s = getStyles(colors);

  return (
    <View style={s.container}>
      <Text style={s.value}>{value}</Text>
      <Text style={s.label}>{label}</Text>
    </View>
  );
}

const getStyles = (colors: ReturnType<typeof useTheme>['colors']) =>
  StyleSheet.create({
    container: {
      flex: 1,
      paddingVertical: 10,
      paddingHorizontal: 12,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
    },
    value: {
      fontSize: 20,
      lineHeight: 20,
      fontWeight: '500',
      fontFamily: 'SpaceMono',
      letterSpacing: -0.8,
      color: colors.text,
    },
    label: {
      fontSize: 10,
      fontWeight: '600',
      letterSpacing: 1,
      textTransform: 'uppercase',
      marginTop: 5,
      color: colors.text3,
    },
  });
