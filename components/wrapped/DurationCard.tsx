import { StyleSheet, Text, View } from 'react-native';
import { Moon } from 'lucide-react-native';
import WrappedCard from './WrappedCard';
import AnimatedCounter from './AnimatedCounter';

interface DurationCardProps {
  nights: number;
  accommodation: string;
  destination: string;
}

export default function DurationCard({
  nights,
  accommodation,
  destination,
}: DurationCardProps) {
  return (
    <WrappedCard bg="#1a1510">
      <View style={styles.content}>
        <Moon size={32} color="#d8ab7a" strokeWidth={1.5} />
        <AnimatedCounter
          value={nights}
          duration={1400}
          delay={300}
          style={styles.number}
        />
        <Text style={styles.label}>
          {nights === 1 ? 'night' : 'nights'} in {destination}
        </Text>
        {accommodation ? (
          <Text style={styles.sub}>Staying at {accommodation}</Text>
        ) : null}
      </View>
    </WrappedCard>
  );
}

const styles = StyleSheet.create({
  content: {
    alignItems: 'center',
    gap: 8,
  },
  number: {
    fontSize: 72,
    fontWeight: '800',
    color: '#f1ebe2',
    letterSpacing: -3,
    marginTop: 12,
    textAlign: 'center',
  },
  label: {
    fontSize: 20,
    fontWeight: '500',
    color: 'rgba(241,235,226,0.7)',
    textAlign: 'center',
  },
  sub: {
    fontSize: 14,
    color: 'rgba(241,235,226,0.45)',
    marginTop: 4,
    textAlign: 'center',
  },
});
