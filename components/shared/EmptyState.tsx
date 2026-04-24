import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { useTheme } from '@/constants/ThemeContext';
import { radius, spacing, typography } from '@/constants/theme';

import type { LucideIcon } from 'lucide-react-native';

type ThemeColors = ReturnType<typeof useTheme>['colors'];

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
}

export default function EmptyState({
  icon: Icon,
  title,
  subtitle,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondary,
}: EmptyStateProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);

  return (
    <Animated.View entering={FadeInDown.duration(500).springify()} style={styles.container}>
      <View style={styles.iconWrap}>
        <Icon size={44} color={colors.text3} strokeWidth={1.5} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
      {actionLabel && onAction && (
        <Pressable style={styles.cta} onPress={onAction} accessibilityRole="button" accessibilityLabel={actionLabel}>
          <Text style={styles.ctaText}>{actionLabel}</Text>
        </Pressable>
      )}
      {secondaryLabel && onSecondary && (
        <Pressable onPress={onSecondary} accessibilityRole="button" accessibilityLabel={secondaryLabel}>
          <Text style={styles.secondaryText}>{secondaryLabel}</Text>
        </Pressable>
      )}
    </Animated.View>
  );
}

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: spacing.xxl,
      paddingVertical: spacing.xxxl * 2,
    },
    iconWrap: {
      width: 80,
      height: 80,
      borderRadius: radius.xl,
      backgroundColor: colors.accentDim,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: spacing.xl,
    },
    title: {
      ...typography.h3,
      color: colors.text,
      textAlign: 'center',
      marginBottom: spacing.sm,
    },
    subtitle: {
      ...typography.body,
      color: colors.text2,
      textAlign: 'center',
      lineHeight: 22,
      marginBottom: spacing.xl,
    },
    cta: {
      backgroundColor: colors.accent,
      paddingHorizontal: spacing.xxl,
      paddingVertical: spacing.md,
      borderRadius: radius.pill,
      marginBottom: spacing.md,
    },
    ctaText: {
      ...typography.bodyBold,
      color: colors.bg,
      textAlign: 'center',
    },
    secondaryText: {
      ...typography.body,
      color: colors.accent,
      textAlign: 'center',
    },
  });
