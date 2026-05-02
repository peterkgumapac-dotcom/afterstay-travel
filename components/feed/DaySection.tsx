import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { Moment } from '@/lib/types';
import { formatTimePHT } from '@/lib/utils';

import { PAPER, SERIF, SERIF_ITALIC } from './feedTheme';
import { FeaturedPhoto } from './FeaturedPhoto';
import { ContactSheet } from './ContactSheet';

interface DaySectionProps {
  dayNumber: number;
  moments: Moment[];
  onMomentPress?: (moment: Moment) => void;
  onLike?: (momentId: string) => void;
  onShare?: (moment: Moment) => void;
}

export function DaySection({ dayNumber, moments, onMomentPress, onLike, onShare }: DaySectionProps) {
  if (moments.length === 0) return null;

  const featured = moments[0];
  const rest = moments.slice(1, 4); // up to 3 for contact sheet

  const totalLikes = moments.reduce((sum, m) => sum + (m.likesCount ?? 0), 0);
  const totalComments = moments.reduce((sum, m) => sum + (m.commentsCount ?? 0), 0);

  return (
    <View>
      {/* Day header */}
      <View style={styles.dayHeader}>
        <Text style={styles.dayLabel}>DAY {dayNumber}</Text>
        <Text style={styles.dayCount}>
          {moments.length} moment{moments.length !== 1 ? 's' : ''}
        </Text>
      </View>

      {/* Featured photo */}
      {featured.photo && (
        <FeaturedPhoto
          photo={featured.photo}
          title={featured.caption || featured.location || 'Untitled'}
          time={formatTimePHT(featured.date)}
          likes={featured.likesCount ?? 0}
          comments={featured.commentsCount ?? 0}
          onPress={() => onMomentPress?.(featured)}
          onLike={() => onLike?.(featured.id)}
          onShare={() => onShare?.(featured)}
        />
      )}

      {/* Contact sheet for remaining */}
      {rest.length > 0 && (
        <ContactSheet
          items={rest.map((m, i) => ({
            photo: m.photo ?? '',
            time: formatTimePHT(m.date),
            rotation: [-1.2, 0.6, -0.4][i] ?? 0,
          }))}
          onPress={(i) => onMomentPress?.(rest[i])}
        />
      )}

      {/* Day totals */}
      {(totalLikes > 0 || totalComments > 0) && (
        <View style={styles.totalsWrap}>
          <Text style={styles.totalsText}>
            {totalLikes > 0 ? `♥ ${totalLikes} total` : ''}
            {totalLikes > 0 && totalComments > 0 ? ' · ' : ''}
            {totalComments > 0 ? `◆ ${totalComments} comments` : ''}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  dayHeader: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 12,
  },
  dayLabel: {
    fontFamily: SERIF,
    fontSize: 32,
    color: PAPER.inkDark,
    letterSpacing: -0.5,
    lineHeight: 34,
  },
  dayCount: {
    fontFamily: SERIF_ITALIC,
    fontSize: 13,
    color: PAPER.inkLight,
    letterSpacing: 0.2,
  },
  totalsWrap: {
    paddingHorizontal: 24,
    paddingTop: 4,
    paddingBottom: 22,
    alignItems: 'center',
  },
  totalsText: {
    fontFamily: SERIF_ITALIC,
    fontSize: 12,
    color: PAPER.inkLight,
    letterSpacing: 0.3,
  },
});
