import { StyleSheet, Text, View } from 'react-native';
import { PieChart } from 'lucide-react-native';
import WrappedCard from './WrappedCard';

const CATEGORY_COLORS: Record<string, string> = {
  Food: '#e38868',
  Transport: '#d9a441',
  Activity: '#d8ab7a',
  Accommodation: '#c49460',
  Shopping: '#e6c196',
  Other: '#857d70',
};

interface SpendingCardProps {
  topCategories: { category: string; amount: number }[];
  total: number;
  currency: string;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  PHP: '\u20B1',
  USD: '$',
  EUR: '\u20AC',
  JPY: '\u00A5',
  GBP: '\u00A3',
};

export default function SpendingCard({
  topCategories,
  total,
  currency,
}: SpendingCardProps) {
  const symbol = CURRENCY_SYMBOLS[currency] ?? currency;

  return (
    <WrappedCard bg="#14110d">
      <View style={styles.content}>
        <PieChart size={28} color="#d8ab7a" strokeWidth={1.5} />
        <Text style={styles.title}>Where it went</Text>

        <View style={styles.bars}>
          {topCategories.map((cat, i) => {
            const pct = total > 0 ? (cat.amount / total) * 100 : 0;
            const color = CATEGORY_COLORS[cat.category] ?? '#857d70';
            return (
              <View key={i} style={styles.barRow}>
                <View style={styles.barLabel}>
                  <Text style={styles.catName}>{cat.category}</Text>
                  <Text style={styles.catAmount}>
                    {symbol}{Math.round(cat.amount).toLocaleString()}
                  </Text>
                </View>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      { width: `${Math.max(pct, 3)}%`, backgroundColor: color },
                    ]}
                  />
                </View>
                <Text style={styles.pct}>{Math.round(pct)}%</Text>
              </View>
            );
          })}
        </View>
      </View>
    </WrappedCard>
  );
}

const styles = StyleSheet.create({
  content: {
    alignItems: 'center',
    gap: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    color: '#f1ebe2',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  bars: {
    alignSelf: 'stretch',
    gap: 14,
  },
  barRow: {
    gap: 6,
  },
  barLabel: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  catName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f1ebe2',
  },
  catAmount: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(241,235,226,0.6)',
  },
  barTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  barFill: {
    height: 8,
    borderRadius: 4,
  },
  pct: {
    fontSize: 11,
    color: 'rgba(241,235,226,0.4)',
    textAlign: 'right',
  },
});
