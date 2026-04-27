import { Dimensions, Image, StyleSheet, Text, View } from 'react-native';
import { Camera } from 'lucide-react-native';
import WrappedCard from './WrappedCard';
import AnimatedCounter from './AnimatedCounter';

const GRID_GAP = 4;
const PADDING = 24;
const GRID_W = Dimensions.get('window').width - PADDING * 2;
const CELL_W = (GRID_W - GRID_GAP * 2) / 3;
const CELL_H = CELL_W * 1.2;

interface MomentsCardProps {
  totalMoments: number;
  photoUrls: string[];
}

export default function MomentsCard({
  totalMoments,
  photoUrls,
}: MomentsCardProps) {
  // Show up to 6 photos in a 3x2 grid
  const photos = photoUrls.slice(0, 6);

  return (
    <WrappedCard bg="#12100d">
      <View style={styles.content}>
        <Camera size={28} color="#d8ab7a" strokeWidth={1.5} />

        <View style={styles.counterRow}>
          <AnimatedCounter
            value={totalMoments}
            duration={1200}
            delay={300}
            style={styles.number}
          />
        </View>
        <Text style={styles.label}>moments captured</Text>

        {photos.length > 0 && (
          <View style={styles.grid}>
            {photos.map((url, i) => (
              <Image
                key={i}
                source={{ uri: url }}
                style={styles.photo}
                resizeMode="cover"
              />
            ))}
          </View>
        )}
      </View>
    </WrappedCard>
  );
}

const styles = StyleSheet.create({
  content: {
    alignItems: 'center',
    gap: 6,
  },
  counterRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 8,
  },
  number: {
    fontSize: 56,
    fontWeight: '800',
    color: '#f1ebe2',
    letterSpacing: -2,
    textAlign: 'center',
  },
  label: {
    fontSize: 18,
    fontWeight: '500',
    color: 'rgba(241,235,226,0.6)',
    marginBottom: 16,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
    width: GRID_W,
  },
  photo: {
    width: CELL_W,
    height: CELL_H,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
});
