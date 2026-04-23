import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { BarChart3, Target, Users } from 'lucide-react-native';
import { useTheme } from '@/constants/ThemeContext';
import { spacing, radius } from '@/constants/theme';

export type BudgetMode = 'tracking' | 'budget' | 'group';

interface Props {
  mode: BudgetMode;
  onChange: (mode: BudgetMode) => void;
  groupSize?: number;
}

const MODES: { id: BudgetMode; icon: typeof BarChart3; label: string; sub: string }[] = [
  { id: 'tracking', icon: BarChart3, label: 'Just tracking', sub: 'See where money goes' },
  { id: 'budget', icon: Target, label: 'Budget mode', sub: 'Set limits, get alerts' },
  { id: 'group', icon: Users, label: 'Group split', sub: 'Who pays what, settle up' },
];

export function BudgetModeSelector({ mode, onChange, groupSize }: Props) {
  const { colors } = useTheme();
  const styles = getStyles(colors);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>How are you tracking?</Text>
      <View style={styles.options}>
        {MODES.map((m, i) => {
          const active = mode === m.id;
          return (
            <Animated.View key={m.id} entering={FadeInDown.duration(300).delay(i * 60)}>
              <TouchableOpacity
                style={[styles.option, active && styles.optionActive]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onChange(m.id);
                }}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={m.label}
                accessibilityState={{ selected: active }}
              >
                <View style={[styles.iconBox, active && { backgroundColor: colors.accentBg }]}>
                  <m.icon size={18} color={active ? colors.accent : colors.text3} strokeWidth={1.8} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.label, active && styles.labelActive]}>{m.label}</Text>
                  <Text style={styles.sub}>{m.sub}</Text>
                </View>
                {active && <View style={styles.checkDot} />}
              </TouchableOpacity>
            </Animated.View>
          );
        })}
      </View>
      {groupSize != null && groupSize >= 2 && mode !== 'group' && (
        <Text style={styles.hint}>
          {groupSize} travelers detected — try Group split
        </Text>
      )}
    </View>
  );
}

const getStyles = (colors: ReturnType<typeof useTheme>['colors']) =>
  StyleSheet.create({
    container: {
      gap: spacing.sm,
    },
    title: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
      marginBottom: spacing.xs,
    },
    options: {
      gap: spacing.sm,
    },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      padding: spacing.md + 2,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
    },
    optionActive: {
      borderColor: colors.accent,
      backgroundColor: colors.accentBg,
    },
    iconBox: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: colors.card2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    label: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    labelActive: {
      color: colors.accent,
    },
    sub: {
      fontSize: 11,
      color: colors.text3,
      marginTop: 1,
    },
    checkDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.accent,
    },
    hint: {
      fontSize: 11,
      color: colors.text3,
      fontStyle: 'italic',
      textAlign: 'center',
      marginTop: spacing.xs,
    },
  });
