import { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Plus, Wallet } from 'lucide-react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  interpolateColor,
} from 'react-native-reanimated';
import { useEffect } from 'react';

import { useTheme } from '@/constants/ThemeContext';
import { formatCurrency } from '@/lib/utils';
import type { DailyExpenseCategory } from '@/lib/types';

type ThemeColors = ReturnType<typeof useTheme>['colors'];

const CAT_COLORS: Record<DailyExpenseCategory, string> = {
  Food: '#d8ab7a',
  Transport: '#c49460',
  Bills: '#e2b361',
  Entertainment: '#e38868',
  Groceries: '#8a5a2b',
  Other: '#857d70',
};

interface DailyTrackerStripProps {
  enabled: boolean;
  todayTotal: number;
  todayCount: number;
  byCategory: Record<string, number>;
  currency: string;
  onPress: () => void;
  onAddPress: () => void;
  onEnable: () => void;
}

export default function DailyTrackerStrip({
  enabled,
  todayTotal,
  todayCount,
  byCategory,
  currency,
  onPress,
  onAddPress,
  onEnable,
}: DailyTrackerStripProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);

  // Green/red blinking dot
  const blink = useSharedValue(0);
  useEffect(() => {
    if (!enabled) return;
    blink.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 800 }),
        withTiming(0, { duration: 800 }),
      ),
      -1,
    );
  }, [enabled]);

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: 0.6 + blink.value * 0.4,
    transform: [{ scale: 0.85 + blink.value * 0.15 }],
    backgroundColor: interpolateColor(blink.value, [0, 1], ['#4ade80', '#ef4444']),
  }));

  // ── Not enabled — show activation prompt ──
  if (!enabled) {
    return (
      <TouchableOpacity style={styles.promptStrip} onPress={onEnable} activeOpacity={0.75}>
        <Wallet size={16} color={colors.accent} />
        <View style={{ flex: 1 }}>
          <Text style={styles.promptTitle}>Track daily spending</Text>
          <Text style={styles.promptSub}>Monitor expenses outside of trips</Text>
        </View>
        <Text style={styles.promptAction}>Enable</Text>
      </TouchableOpacity>
    );
  }

  // ── Enabled — show today's summary ──
  const categories = Object.entries(byCategory).sort(([, a], [, b]) => b - a);
  const maxCat = Math.max(1, ...Object.values(byCategory));

  return (
    <TouchableOpacity style={styles.strip} onPress={onPress} activeOpacity={0.75}>
      {/* Pulsing dot + label */}
      <View style={styles.left}>
        <Animated.View style={[styles.dot, pulseStyle]} />
        <View>
          <Text style={styles.label}>Daily Tracker is on</Text>
          <Text style={styles.sub}>
            {todayCount > 0
              ? `${todayCount} expense${todayCount !== 1 ? 's' : ''} today`
              : 'No expenses today'}
          </Text>
        </View>
      </View>

      {/* Today's total + mini category bars */}
      <View style={styles.right}>
        <Text style={styles.total}>{formatCurrency(todayTotal, currency)}</Text>
        {categories.length > 0 && (
          <View style={styles.miniBars}>
            {categories.slice(0, 4).map(([cat, amount]) => (
              <View
                key={cat}
                style={[
                  styles.miniBar,
                  {
                    width: `${Math.max(12, (amount / maxCat) * 100)}%`,
                    backgroundColor: CAT_COLORS[cat as DailyExpenseCategory] ?? colors.text3,
                  },
                ]}
              />
            ))}
          </View>
        )}
      </View>

      {/* Quick add button */}
      <TouchableOpacity
        style={styles.addBtn}
        onPress={(e) => { e.stopPropagation(); onAddPress(); }}
        activeOpacity={0.7}
        hitSlop={8}
      >
        <Plus size={16} color={colors.bg} strokeWidth={2.5} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    // ── Enabled state ──
    strip: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: 16,
      marginBottom: 12,
      paddingVertical: 12,
      paddingLeft: 14,
      paddingRight: 10,
      backgroundColor: colors.accentBg,
      borderWidth: 1,
      borderColor: colors.accentBorder,
      borderRadius: 14,
      gap: 12,
    },
    left: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      flex: 1,
      minWidth: 0,
    },
    dot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    label: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.accent,
      letterSpacing: 0.3,
    },
    sub: {
      fontSize: 10,
      color: colors.text3,
      marginTop: 1,
    },
    right: {
      alignItems: 'flex-end',
      gap: 4,
      minWidth: 80,
    },
    total: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
      letterSpacing: -0.3,
    },
    miniBars: {
      width: 60,
      gap: 2,
    },
    miniBar: {
      height: 3,
      borderRadius: 1.5,
    },
    addBtn: {
      width: 30,
      height: 30,
      borderRadius: 10,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    // ── Not enabled prompt ──
    promptStrip: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: 16,
      marginBottom: 12,
      paddingVertical: 12,
      paddingHorizontal: 14,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      gap: 10,
    },
    promptTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
    },
    promptSub: {
      fontSize: 10,
      color: colors.text3,
      marginTop: 1,
    },
    promptAction: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.accent,
    },
  });
