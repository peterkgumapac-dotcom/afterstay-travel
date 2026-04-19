import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/constants/ThemeContext';

// ---------- TYPES ----------

interface HighlightCardProps {
  icon: string;
  label: string;
  sub: string;
  tint: string;
}

type ThemeColors = ReturnType<typeof useTheme>['colors'];

// ---------- COMPONENT ----------

export default function HighlightCard({ icon, label, sub, tint }: HighlightCardProps) {
  const { colors } = useTheme();
  const styles = getStyles(colors);

  return (
    <View style={styles.card}>
      {/* Background tint circle */}
      <View style={[styles.tintCircle, { backgroundColor: tint }]} />

      <Text style={styles.icon}>{icon}</Text>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.sub}>{sub}</Text>
    </View>
  );
}

// ---------- STYLES ----------

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      width: 140,
      paddingTop: 14,
      paddingHorizontal: 14,
      paddingBottom: 16,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      overflow: 'hidden',
      position: 'relative',
    },
    tintCircle: {
      position: 'absolute',
      top: -20,
      right: -20,
      width: 60,
      height: 60,
      borderRadius: 999,
      opacity: 0.08,
    },
    icon: {
      fontSize: 22,
      marginBottom: 8,
    },
    label: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
    },
    sub: {
      fontSize: 10.5,
      color: colors.text3,
      marginTop: 3,
      lineHeight: 14.175,
    },
  });
