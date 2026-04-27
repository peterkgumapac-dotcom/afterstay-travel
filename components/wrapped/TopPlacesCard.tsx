import { StyleSheet, Text, View } from 'react-native';
import { MapPin } from 'lucide-react-native';
import WrappedCard from './WrappedCard';
import type { TripMemoryPlace } from '@/lib/types';

const CATEGORY_ICONS: Record<string, string> = {
  Eat: '\uD83C\uDF7D\uFE0F',
  Do: '\uD83C\uDFC4',
  Nature: '\uD83C\uDF3F',
  Essentials: '\uD83D\uDED2',
  Transport: '\uD83D\uDE95',
  Nightlife: '\uD83C\uDF1F',
  Wellness: '\uD83E\uDDD8',
  Culture: '\uD83C\uDFDB\uFE0F',
  Coffee: '\u2615',
};

interface TopPlacesCardProps {
  places: TripMemoryPlace[];
}

export default function TopPlacesCard({ places }: TopPlacesCardProps) {
  const top5 = places.slice(0, 5);

  return (
    <WrappedCard bg="#141210">
      <View style={styles.content}>
        <MapPin size={28} color="#d8ab7a" strokeWidth={1.5} />
        <Text style={styles.title}>Top places</Text>

        <View style={styles.list}>
          {top5.map((p, i) => (
            <View key={i} style={styles.row}>
              <Text style={styles.rank}>{i + 1}</Text>
              <Text style={styles.emoji}>
                {CATEGORY_ICONS[p.category] ?? '\uD83D\uDCCD'}
              </Text>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.placeName} numberOfLines={1}>
                  {p.name}
                </Text>
                <Text style={styles.placeCategory}>{p.category}</Text>
              </View>
              {p.rating && p.rating > 0 ? (
                <Text style={styles.rating}>
                  {'\u2605'.repeat(p.rating)}
                </Text>
              ) : null}
            </View>
          ))}
        </View>

        <Text style={styles.total}>
          {places.length} places discovered
        </Text>
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
  list: {
    alignSelf: 'stretch',
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
  },
  rank: {
    fontSize: 18,
    fontWeight: '800',
    color: '#d8ab7a',
    width: 24,
    textAlign: 'center',
  },
  emoji: {
    fontSize: 20,
  },
  placeName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#f1ebe2',
  },
  placeCategory: {
    fontSize: 11,
    color: 'rgba(241,235,226,0.45)',
    marginTop: 2,
  },
  rating: {
    fontSize: 12,
    color: '#d9a441',
  },
  total: {
    fontSize: 13,
    color: 'rgba(241,235,226,0.4)',
    marginTop: 4,
  },
});
