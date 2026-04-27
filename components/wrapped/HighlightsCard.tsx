import { StyleSheet, Text, View } from 'react-native';
import { Camera, MapPin, Utensils, Zap } from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import WrappedCard from './WrappedCard';
import type { TripMemoryStats } from '@/lib/types';

interface HighlightsCardProps {
  stats: TripMemoryStats;
}

export default function HighlightsCard({ stats }: HighlightsCardProps) {
  const highlights = [
    {
      icon: <Camera size={20} color="#e38868" />,
      label: 'Most photographed',
      value: stats.mostPhotographedSpot,
    },
    {
      icon: <Utensils size={20} color="#d9a441" />,
      label: 'Favorite food spot',
      value: stats.favoriteFood,
    },
    {
      icon: <Zap size={20} color="#d8ab7a" />,
      label: 'Busiest day',
      value: stats.busiestDay,
    },
    {
      icon: <MapPin size={20} color="#e6c196" />,
      label: 'Places visited',
      value: String(stats.totalPlacesVisited),
    },
  ].filter((h) => h.value);

  return (
    <WrappedCard bg="#131110">
      <View style={styles.content}>
        <Text style={styles.title}>Trip highlights</Text>

        <View style={styles.grid}>
          {highlights.map((h, i) => (
            <Animated.View
              key={i}
              entering={FadeInDown.delay(200 + i * 120).duration(400)}
              style={styles.cell}
            >
              <View style={styles.iconWrap}>{h.icon}</View>
              <Text style={styles.cellLabel}>{h.label}</Text>
              <Text style={styles.cellValue} numberOfLines={2}>
                {h.value}
              </Text>
            </Animated.View>
          ))}
        </View>
      </View>
    </WrappedCard>
  );
}

const styles = StyleSheet.create({
  content: {
    alignItems: 'center',
    gap: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    color: '#f1ebe2',
    letterSpacing: -0.5,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  cell: {
    width: '46%',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    padding: 16,
    gap: 6,
  },
  iconWrap: {
    marginBottom: 4,
  },
  cellLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    color: 'rgba(241,235,226,0.45)',
    textTransform: 'uppercase',
  },
  cellValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f1ebe2',
    lineHeight: 20,
  },
});
