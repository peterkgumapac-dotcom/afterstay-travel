import * as Haptics from 'expo-haptics';
import { Bookmark, ExternalLink, MapPin, ThumbsDown, ThumbsUp } from 'lucide-react-native';
import { Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '@/constants/theme';
import type { Place, PlaceVote } from '@/lib/types';
import Pill from './Pill';

interface Props {
  place: Place;
  onVote: (vote: PlaceVote) => void;
  onSave?: () => void;
  saved?: boolean;
  busy?: boolean;
  photoUri?: string | null;
  googleMapsUri?: string | null;
  totalRatings?: number;
}

export default function PlaceCard({ place, onVote, onSave, saved, busy, photoUri, googleMapsUri, totalRatings }: Props) {
  const cast = async (vote: PlaceVote) => {
    if (busy) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onVote(vote);
  };

  const sourceLabel =
    place.source === 'Suggested'
      ? 'Recommended'
      : place.source === 'Friend Rec'
      ? 'Friend Rec'
      : 'Manual';

  const sourceTone =
    sourceLabel === 'Recommended'
      ? 'purple'
      : sourceLabel === 'Friend Rec'
      ? 'blue'
      : 'default';

  return (
    <View style={styles.card}>
      {photoUri ? (
        <Image source={{ uri: photoUri }} style={styles.coverImage} resizeMode="cover" />
      ) : null}
      <View style={styles.body}>
      <View style={styles.headerRow}>
        <Text style={styles.name} numberOfLines={2}>
          {place.name}
        </Text>
        <Pill label={sourceLabel} tone={sourceTone as any} />
      </View>

      <View style={styles.metaRow}>
        <Pill label={place.category} tone="green" />
        {place.distance ? (
          <View style={styles.distance}>
            <MapPin size={12} color={colors.text2} />
            <Text style={styles.distanceText}>{place.distance}</Text>
          </View>
        ) : null}
        {place.rating ? (
          <Text style={styles.rating}>
            {'\u2B50'} {place.rating.toFixed(1)}
            {(totalRatings ?? place.totalRatings) ? ` \u00B7 ${(totalRatings ?? place.totalRatings)!.toLocaleString()} reviews` : ''}
          </Text>
        ) : null}
      </View>

      {place.notes ? (
        <Text style={styles.notes} numberOfLines={3}>
          {place.notes}
        </Text>
      ) : null}

      {place.priceEstimate ? (
        <Text style={styles.price}>{place.priceEstimate}</Text>
      ) : null}

      <View style={styles.voteRow}>
        <VoteButton
          active={place.vote === '👍 Yes'}
          Icon={ThumbsUp}
          color={colors.green2}
          onPress={() => cast('👍 Yes')}
          label="Yes"
        />
        <VoteButton
          active={place.vote === '👎 No'}
          Icon={ThumbsDown}
          color={colors.red}
          onPress={() => cast('👎 No')}
          label="No"
        />
        {onSave ? (
          <Pressable
            onPress={onSave}
            style={({ pressed }) => [
              styles.bookmarkBtn,
              saved ? styles.bookmarkBtnActive : null,
              pressed ? { opacity: 0.7 } : null,
            ]}
          >
            <Bookmark
              size={14}
              color={saved ? colors.amber : colors.text2}
              fill={saved ? colors.amber : 'none'}
            />
          </Pressable>
        ) : null}
        {place.vote === 'Pending' && (
          <Text style={styles.pending}>Vote pending</Text>
        )}
        {googleMapsUri ? (
          <Pressable
            onPress={() => Linking.openURL(googleMapsUri)}
            style={styles.mapsLink}
          >
            <ExternalLink size={12} color={colors.blue} />
            <Text style={styles.mapsLinkText}>Google Maps</Text>
          </Pressable>
        ) : null}
      </View>
      </View>
    </View>
  );
}

function VoteButton({
  active,
  Icon,
  color,
  onPress,
  label,
}: {
  active: boolean;
  Icon: typeof ThumbsUp;
  color: string;
  onPress: () => void;
  label: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.voteBtn,
        active ? { backgroundColor: color + '22', borderColor: color } : null,
        pressed ? { opacity: 0.7 } : null,
      ]}
    >
      <Icon size={14} color={active ? color : colors.text2} />
      <Text style={[styles.voteLabel, active ? { color } : null]}>{label}</Text>
    </Pressable>
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
    height: 180,
  },
  body: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  name: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
    flex: 1,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  distance: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  distanceText: { color: colors.text2, fontSize: 12 },
  rating: { color: colors.amber, fontSize: 13 },
  notes: { color: colors.text2, fontSize: 13, lineHeight: 18 },
  price: { color: colors.green2, fontSize: 12, fontWeight: '600' },
  voteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  voteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  voteLabel: { color: colors.text2, fontSize: 12, fontWeight: '600' },
  bookmarkBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookmarkBtnActive: {
    backgroundColor: colors.amber + '22',
    borderColor: colors.amber,
  },
  pending: { color: colors.text3, fontSize: 11, marginLeft: spacing.sm, fontStyle: 'italic' },
  mapsLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 'auto',
  },
  mapsLinkText: { color: colors.blue, fontSize: 11, fontWeight: '600' },
});
