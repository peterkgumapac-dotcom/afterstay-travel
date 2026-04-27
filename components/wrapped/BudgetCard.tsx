import { StyleSheet, Text, View } from 'react-native';
import { Wallet } from 'lucide-react-native';
import WrappedCard from './WrappedCard';
import AnimatedCounter from './AnimatedCounter';

interface BudgetCardProps {
  total: number;
  currency: string;
  dailyAverage: number;
  nights: number;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  PHP: '\u20B1',
  USD: '$',
  EUR: '\u20AC',
  JPY: '\u00A5',
  GBP: '\u00A3',
  KRW: '\u20A9',
  THB: '\u0E3F',
  SGD: 'S$',
  VND: '\u20AB',
  IDR: 'Rp',
};

export default function BudgetCard({
  total,
  currency,
  dailyAverage,
  nights,
}: BudgetCardProps) {
  const symbol = CURRENCY_SYMBOLS[currency] ?? currency;

  return (
    <WrappedCard bg="#18140f">
      <View style={styles.content}>
        <Wallet size={28} color="#d8ab7a" strokeWidth={1.5} />
        <Text style={styles.kicker}>TOTAL SPENT</Text>

        <AnimatedCounter
          value={total}
          duration={1600}
          delay={300}
          prefix={symbol}
          style={styles.number}
        />

        <View style={styles.subStats}>
          <View style={styles.subStat}>
            <Text style={styles.subValue}>
              {symbol}{Math.round(dailyAverage).toLocaleString()}
            </Text>
            <Text style={styles.subLabel}>per day</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.subStat}>
            <Text style={styles.subValue}>{nights}</Text>
            <Text style={styles.subLabel}>{nights === 1 ? 'night' : 'nights'}</Text>
          </View>
        </View>
      </View>
    </WrappedCard>
  );
}

const styles = StyleSheet.create({
  content: {
    alignItems: 'center',
    gap: 8,
  },
  kicker: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    color: 'rgba(216,171,122,0.7)',
    marginTop: 8,
  },
  number: {
    fontSize: 52,
    fontWeight: '800',
    color: '#f1ebe2',
    letterSpacing: -2,
    marginVertical: 8,
    textAlign: 'center',
  },
  subStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
    marginTop: 12,
    paddingVertical: 14,
    paddingHorizontal: 28,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
  },
  subStat: {
    alignItems: 'center',
  },
  subValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f1ebe2',
  },
  subLabel: {
    fontSize: 12,
    color: 'rgba(241,235,226,0.45)',
    marginTop: 2,
  },
  divider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
});
