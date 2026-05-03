import { Image, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import WrappedCard from './WrappedCard';
import { formatDatePHT } from '@/lib/utils';

interface CoverCardProps {
  destination: string;
  startDate: string;
  endDate: string;
  heroPhotoUrl?: string;
}

export default function CoverCard({
  destination,
  startDate,
  endDate,
  heroPhotoUrl,
}: CoverCardProps) {
  const dateRange = `${formatDatePHT(startDate)} \u2013 ${formatDatePHT(endDate)}`;

  return (
    <WrappedCard bg="#0a0806">
      {/* Hero photo background */}
      {heroPhotoUrl && (
        <Image
          source={{ uri: heroPhotoUrl }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        />
      )}
      <LinearGradient
        colors={['transparent', 'rgba(10,8,6,0.6)', 'rgba(10,8,6,0.92)']}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Content at bottom */}
      <View style={styles.content}>
        <Text style={styles.kicker}>YOUR TRIP RECAP</Text>
        <Text style={styles.destination}>{destination}</Text>
        <Text style={styles.dates}>{dateRange}</Text>
      </View>
    </WrappedCard>
  );
}

const styles = StyleSheet.create({
  content: {
    position: 'absolute',
    bottom: 80,
    left: 24,
    right: 24,
  },
  kicker: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    color: 'rgba(216,171,122,0.8)',
    marginBottom: 8,
  },
  destination: {
    fontSize: 42,
    fontWeight: '700',
    color: '#f1ebe2',
    letterSpacing: -1.2,
    lineHeight: 46,
    marginBottom: 8,
  },
  dates: {
    fontSize: 16,
    fontWeight: '500',
    color: 'rgba(241,235,226,0.7)',
    letterSpacing: 0.2,
  },
});
