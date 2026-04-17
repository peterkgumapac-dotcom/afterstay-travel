import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Wallet, TrendingUp, AlertTriangle } from 'lucide-react-native';
import { getBudgetStatus } from '../../lib/budgetAlerts';
import { getActiveTrip, getExpenses } from '../../lib/notion';
import type { Expense, Trip } from '../../lib/types';

export const BudgetAlertStrip: React.FC = () => {
  const router = useRouter();
  const [tripSpent, setTripSpent] = useState(0);
  const [total, setTotal] = useState(0);
  const [daysRemaining, setDaysRemaining] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
        try {
          const trip = await getActiveTrip();
          if (cancelled || !trip || !trip.budgetLimit) return;

          const expenses = await getExpenses(trip.id);
          if (cancelled) return;

          const isAccommodation = (e: Expense) => {
            const desc = (e.description ?? '').toLowerCase();
            return e.category === 'Accommodation' || desc.includes('hotel') || desc.includes('canyon');
          };
          const dailyTotal = expenses
            .filter(e => !isAccommodation(e))
            .reduce((sum, e) => sum + e.amount, 0);

          const endMs = new Date(trip.endDate).getTime();
          const remaining = Math.max(0, Math.ceil((endMs - Date.now()) / 86400000));

          setTripSpent(dailyTotal);
          setTotal(trip.budgetLimit);
          setDaysRemaining(remaining);
          setReady(true);
        } catch {
          // silently fail — strip just won't show
        }
    })();
    return () => { cancelled = true; };
  }, []);

  if (!ready || total === 0) return null;

  const status = getBudgetStatus(tripSpent, total, daysRemaining);

  const colorMap = {
    green: { bg: 'rgba(45,212,160,0.08)', border: 'rgba(45,212,160,0.3)', accent: '#2dd4a0', icon: TrendingUp },
    yellow: { bg: 'rgba(251,191,36,0.08)', border: 'rgba(251,191,36,0.3)', accent: '#fbbf24', icon: Wallet },
    orange: { bg: 'rgba(249,115,22,0.1)', border: 'rgba(249,115,22,0.4)', accent: '#fdba74', icon: AlertTriangle },
    red: { bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.5)', accent: '#fca5a5', icon: AlertTriangle },
  };

  const c = colorMap[status.level];
  const StatusIcon = c.icon;

  return (
    <TouchableOpacity
      style={[styles.container, { backgroundColor: c.bg, borderColor: c.border }]}
      onPress={() => router.push('/(tabs)/budget')}
      activeOpacity={0.8}
    >
      <View style={styles.iconWrap}>
        <StatusIcon color={c.accent} size={20} strokeWidth={2} />
      </View>

      <View style={styles.content}>
        <View style={styles.row}>
          <Text style={[styles.amount, { color: c.accent }]}>
            {'\u20B1'}{tripSpent.toLocaleString()}
          </Text>
          <Text style={styles.totalText}>
            of {'\u20B1'}{total.toLocaleString()}
          </Text>
        </View>
        <Text style={[styles.message, { color: c.accent }]} numberOfLines={1}>
          {status.title}
        </Text>
      </View>

      <View style={styles.percentBadge}>
        <Text style={[styles.percentText, { color: c.accent }]}>
          {status.percentUsed.toFixed(0)}%
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginVertical: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  amount: { fontSize: 16, fontWeight: '700', fontVariant: ['tabular-nums'] },
  totalText: { color: '#5a6577', fontSize: 12, fontVariant: ['tabular-nums'] },
  message: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  percentBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  percentText: { fontSize: 12, fontWeight: '700' },
});
