import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/constants/ThemeContext';
import { radius, spacing } from '@/constants/theme';
import type { Moment } from '@/lib/types';

interface Props {
  moments: readonly Moment[];
  onSeeAll?: () => void;
  onDelete?: (moment: Moment) => void;
}

const MAX_DISPLAY = 8;
const THUMB_SIZE = 80;

export default function MomentStrip({ moments, onSeeAll, onDelete }: Props) {
  const { colors } = useTheme();
  const styles = getStyles(colors);

  if (moments.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No moments yet. Start capturing!</Text>
      </View>
    );
  }

  const displayed = moments.slice(0, MAX_DISPLAY);

  const handleLongPress = (moment: Moment) => {
    if (!onDelete) return;
    Alert.alert('Delete Moment', `Delete "${moment.caption || 'Untitled'}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => onDelete(moment) },
    ]);
  };

  const handlePress = (moment: Moment) => {
    const details = [
      moment.caption,
      moment.location ? `Location: ${moment.location}` : null,
      moment.takenBy ? `By: ${moment.takenBy}` : null,
      moment.tags.length > 0 ? `Tags: ${moment.tags.join(', ')}` : null,
      `Date: ${moment.date}`,
    ]
      .filter(Boolean)
      .join('\n');

    Alert.alert('Moment', details);
  };

  return (
    <View style={styles.wrapper}>
      <Text style={styles.heading}>Moments</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {displayed.map((m) => (
          <Pressable key={m.id} onPress={() => handlePress(m)} onLongPress={() => handleLongPress(m)} style={styles.item} accessibilityLabel={`Moment: ${m.caption || 'Untitled'}. Long press to delete`} accessibilityRole="button">
            {m.photo ? (
              <Image source={{ uri: m.photo }} style={styles.thumb} resizeMode="cover" />
            ) : (
              <View style={[styles.thumb, styles.noPhoto]}>
                <Text style={styles.noPhotoIcon}>📷</Text>
              </View>
            )}
            <Text style={styles.caption} numberOfLines={1}>
              {m.caption || 'Untitled'}
            </Text>
          </Pressable>
        ))}

        {onSeeAll && (
          <Pressable onPress={onSeeAll} style={styles.seeAllBtn}>
            <Text style={styles.seeAllText}>See All</Text>
            <Text style={styles.seeAllArrow}>→</Text>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  wrapper: {
    gap: spacing.sm,
  },
  heading: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  scrollContent: {
    gap: spacing.md,
    paddingRight: spacing.lg,
  },
  item: {
    width: THUMB_SIZE,
    gap: spacing.xs,
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: radius.lg,
    backgroundColor: colors.bg3,
  },
  noPhoto: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  noPhotoIcon: {
    fontSize: 24,
    opacity: 0.4,
  },
  caption: {
    color: colors.text2,
    fontSize: 11,
    fontWeight: '500',
  },
  empty: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    color: colors.text3,
    fontSize: 13,
  },
  seeAllBtn: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  seeAllText: {
    color: colors.green2,
    fontSize: 12,
    fontWeight: '700',
  },
  seeAllArrow: {
    color: colors.green2,
    fontSize: 16,
    fontWeight: '700',
  },
});
