import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { ThemeColors } from '@/constants/ThemeContext';

interface Props {
  icon: React.ReactNode;
  label: string;
  value: string;
  subtitle?: string;
  colors: ThemeColors;
}

export default function SuperlativeCard({ icon, label, value, subtitle, colors }: Props) {
  const styles = getStyles(colors);
  return (
    <View style={styles.card}>
      <View style={styles.iconWrap}>{icon}</View>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value} numberOfLines={2}>{value}</Text>
      {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
    </View>
  );
}

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      gap: 6,
    },
    iconWrap: {
      width: 32,
      height: 32,
      borderRadius: 10,
      backgroundColor: colors.accentDim,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 4,
    },
    label: {
      fontSize: 10,
      fontWeight: '600',
      color: colors.text3,
      textTransform: 'uppercase',
      letterSpacing: 1.4,
    },
    value: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
      letterSpacing: -0.3,
    },
    subtitle: {
      fontSize: 12,
      color: colors.text2,
    },
  });
