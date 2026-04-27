import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { useTheme } from '@/constants/ThemeContext';

type ThemeColors = ReturnType<typeof useTheme>['colors'];

interface StatPillProps {
  icon: React.ReactNode;
  value: string | number;
  label: string;
  colors: ThemeColors;
}

export default function StatPill({ icon, value, label, colors }: StatPillProps) {
  const styles = useMemo(() => getStyles(colors), [colors]);

  return (
    <View style={styles.pill}>
      <View style={styles.iconWrap}>{icon}</View>
      <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    pill: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 14,
      paddingHorizontal: 8,
      backgroundColor: colors.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 4,
    },
    iconWrap: {
      marginBottom: 2,
    },
    value: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      letterSpacing: -0.3,
    },
    label: {
      fontSize: 10,
      fontWeight: '600',
      color: colors.text3,
      textTransform: 'uppercase',
      letterSpacing: 1.2,
    },
  });
