import { Check, MapPin, Plus } from 'lucide-react-native';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '@/constants/theme';
import type { AIRecommendation } from '@/lib/types';
import Pill from './Pill';

interface Props {
  rec: AIRecommendation;
  saved?: boolean;
  onSave: () => void;
  photoUri?: string | null;
  googleMapsUri?: string | null;
}

export default function AIRecommendationCard({ rec, saved, onSave, photoUri }: Props) {
  return (
    <View style={styles.card}>
      {photoUri ? (
        <Image source={{ uri: photoUri }} style={styles.coverImage} resizeMode="cover" />
      ) : null}

      <View style={styles.body}>
        <View style={styles.topRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{rec.name}</Text>
            <View style={styles.metaRow}>
              <Pill label={rec.category} tone="green" />
              <View style={styles.distance}>
                <MapPin size={11} color={colors.text2} />
                <Text style={styles.distanceText}>{rec.distance}</Text>
              </View>
              <Text style={styles.rating}>{'★'.repeat(Math.round(rec.rating))}</Text>
            </View>
          </View>
        </View>
        <Text style={styles.reason}>{rec.reason}</Text>
        <Text style={styles.price}>{rec.price_estimate}</Text>

        <Pressable
          disabled={saved}
          onPress={onSave}
          style={({ pressed }) => [
            styles.saveBtn,
            saved ? styles.saved : null,
            pressed ? { opacity: 0.7 } : null,
          ]}
        >
          {saved ? <Check size={14} color={colors.green2} /> : <Plus size={14} color={colors.white} />}
          <Text style={[styles.saveText, saved ? { color: colors.green2 } : null]}>
            {saved ? 'Saved to trip' : 'Save to Trip Board'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  coverImage: {
    width: '100%',
    height: 120,
  },
  body: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  topRow: { flexDirection: 'row', gap: spacing.md },
  name: { color: colors.text, fontSize: 16, fontWeight: '700' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs, flexWrap: 'wrap' },
  distance: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  distanceText: { color: colors.text2, fontSize: 11 },
  rating: { color: colors.amber, fontSize: 12 },
  reason: { color: colors.text2, fontSize: 13, lineHeight: 18 },
  price: { color: colors.green2, fontSize: 12, fontWeight: '600' },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.green,
    paddingVertical: 10,
    borderRadius: radius.md,
    marginTop: spacing.xs,
  },
  saved: {
    backgroundColor: colors.green + '22',
    borderWidth: 1,
    borderColor: colors.green,
  },
  saveText: { color: colors.white, fontWeight: '700', fontSize: 13 },
});
