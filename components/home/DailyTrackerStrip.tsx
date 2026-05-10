import { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ChevronDown, Plus, Wallet } from 'lucide-react-native';

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
  const [expanded, setExpanded] = useState(false);

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

  const categories = Object.entries(byCategory).sort(([, a], [, b]) => b - a);
  const maxCat = Math.max(1, ...Object.values(byCategory));
  const dotColor = todayCount > 0 ? '#4ade80' : '#ef4444';

  return (
    <View style={[styles.strip, expanded && styles.stripExpanded]}>
      <TouchableOpacity
        style={styles.pulseRow}
        onPress={() => setExpanded((open) => !open)}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel={expanded ? 'Collapse Daily Tracker' : 'Expand Daily Tracker'}
      >
        <View style={styles.left}>
          <View style={[styles.dot, { backgroundColor: dotColor }]} />
          <View>
            <Text style={styles.label}>Today</Text>
            <Text style={styles.sub}>
              {todayCount > 0
                ? `${todayCount} expense${todayCount !== 1 ? 's' : ''}`
                : 'Daily Tracker is on'}
            </Text>
          </View>
        </View>

        <View style={styles.right}>
          <Text style={styles.total}>{formatCurrency(todayTotal, currency)}</Text>
          <ChevronDown
            size={14}
            color={colors.text3}
            strokeWidth={2}
            style={expanded ? styles.chevronOpen : undefined}
          />
        </View>

        <TouchableOpacity
          style={styles.addBtn}
          onPress={(event) => {
            event.stopPropagation();
            onAddPress();
          }}
          activeOpacity={0.7}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Add daily expense"
        >
          <Plus size={16} color={colors.bg} strokeWidth={2.5} />
        </TouchableOpacity>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.details}>
          {categories.length > 0 ? (
            <View style={styles.categoryList}>
              {categories.slice(0, 4).map(([cat, amount]) => (
                <View key={cat} style={styles.categoryRow}>
                  <Text style={styles.categoryLabel}>{cat}</Text>
                  <View style={styles.categoryTrack}>
                    <View
                      style={[
                        styles.categoryFill,
                        {
                          width: `${Math.max(8, (amount / maxCat) * 100)}%`,
                          backgroundColor: CAT_COLORS[cat as DailyExpenseCategory] ?? colors.text3,
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.categoryAmount}>{formatCurrency(amount, currency)}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyDetail}>No daily expenses logged yet.</Text>
          )}
          <TouchableOpacity style={styles.openBudgetBtn} onPress={onPress} activeOpacity={0.72}>
            <Wallet size={14} color={colors.accent} strokeWidth={2} />
            <Text style={styles.openBudgetText}>Open Budget</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    strip: {
      marginHorizontal: 16,
      marginBottom: 12,
      padding: 10,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
    },
    stripExpanded: {
      borderColor: colors.accentBorder,
      backgroundColor: colors.accentBg,
    },
    pulseRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    left: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      flex: 1,
      minWidth: 0,
    },
    dot: {
      width: 9,
      height: 9,
      borderRadius: 5,
    },
    label: {
      fontSize: 12,
      fontWeight: '800',
      color: colors.text,
    },
    sub: {
      fontSize: 10,
      color: colors.text3,
      marginTop: 1,
    },
    right: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      minWidth: 90,
      justifyContent: 'flex-end',
    },
    total: {
      fontSize: 15,
      fontWeight: '800',
      color: colors.text,
    },
    chevronOpen: {
      transform: [{ rotate: '180deg' }],
    },
    addBtn: {
      width: 32,
      height: 32,
      borderRadius: 11,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    details: {
      marginTop: 10,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: colors.accentBorder,
      gap: 10,
    },
    categoryList: {
      gap: 7,
    },
    categoryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    categoryLabel: {
      width: 82,
      fontSize: 10,
      fontWeight: '700',
      color: colors.text2,
    },
    categoryTrack: {
      flex: 1,
      height: 5,
      borderRadius: 999,
      backgroundColor: colors.border,
      overflow: 'hidden',
    },
    categoryFill: {
      height: '100%',
      borderRadius: 999,
    },
    categoryAmount: {
      width: 64,
      textAlign: 'right',
      fontSize: 10,
      fontWeight: '700',
      color: colors.text2,
    },
    emptyDetail: {
      fontSize: 11,
      color: colors.text3,
    },
    openBudgetBtn: {
      minHeight: 34,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.accentBorder,
      backgroundColor: colors.card,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 6,
    },
    openBudgetText: {
      fontSize: 12,
      fontWeight: '800',
      color: colors.accent,
    },
    promptStrip: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: 16,
      marginBottom: 12,
      paddingVertical: 10,
      paddingHorizontal: 12,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      gap: 10,
    },
    promptTitle: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.text,
    },
    promptSub: {
      fontSize: 10,
      color: colors.text3,
      marginTop: 1,
    },
    promptAction: {
      fontSize: 12,
      fontWeight: '800',
      color: colors.accent,
    },
  });
