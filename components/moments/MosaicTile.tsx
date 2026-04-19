import React, { useMemo } from 'react';
import {
  View,
  Text,
  ImageBackground,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useTheme } from '@/constants/ThemeContext';
import { spacing, radius } from '@/constants/theme';
import type { MomentDisplay } from './types';

interface MosaicTileProps {
  moment: MomentDisplay;
  onOpen: (moment: MomentDisplay) => void;
  aspect?: number;
  people: Record<string, { name: string; color: string }>;
}

export function MosaicTile({
  moment,
  onOpen,
  aspect = 1,
  people,
}: MosaicTileProps) {
  const authorKey = moment.authorKey ?? moment.takenBy ?? '';
  const person = people[authorKey];
  const authorColor = person?.color ?? '#999';
  const authorInitial = authorKey.charAt(0).toUpperCase();
  const { colors } = useTheme();

  const totalReactions = useMemo(() => {
    if (!moment.reactions) return 0;
    return Object.values(moment.reactions).reduce((a, b) => a + b, 0);
  }, [moment.reactions]);

  const isLoved = totalReactions >= 5;

  return (
    <TouchableOpacity
      onPress={() => onOpen(moment)}
      activeOpacity={0.85}
      style={[
        styles.container,
        {
          aspectRatio: aspect,
          borderRadius: radius.sm + 2,
          borderColor: colors.border,
          borderWidth: 1,
        },
        isLoved && {
          shadowColor: authorColor,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.25,
          shadowRadius: 18,
          elevation: 6,
        },
      ]}
    >
      <ImageBackground
        source={{ uri: moment.photo }}
        style={styles.image}
        imageStyle={{ borderRadius: radius.sm + 1 }}
        resizeMode="cover"
      >
        {/* Author color strip - left edge */}
        <View
          style={[
            styles.authorStrip,
            { backgroundColor: authorColor },
          ]}
        />

        {/* Bottom gradient overlay */}
        <View style={styles.bottomGradient} />

        {/* Bottom meta: place name + avatar */}
        <View style={styles.bottomMeta}>
          <View style={styles.placeContainer}>
            <Text
              style={styles.placeText}
              numberOfLines={1}
            >
              {moment.place ?? moment.location}
            </Text>
          </View>
          <View
            style={[
              styles.avatar,
              { backgroundColor: authorColor },
            ]}
          >
            <Text style={styles.avatarText}>{authorInitial}</Text>
          </View>
        </View>

        {/* Top-left corner badges */}
        <View style={styles.topLeftBadges}>
          {moment.voice && (
            <View style={styles.iconBadge}>
              <Text style={styles.micIcon}>{'\u{1F3A4}'}</Text>
            </View>
          )}
          {isLoved && (
            <View style={styles.reactionBadge}>
              <Text style={styles.heartIcon}>{'\u2665'}</Text>
              <Text style={styles.reactionCount}>{totalReactions}</Text>
            </View>
          )}
        </View>

        {/* Top-right expense badge */}
        {moment.expense && (
          <View style={styles.expenseBadge}>
            <Text
              style={[
                styles.expenseText,
                { color: colors.accentLt },
              ]}
            >
              {moment.expense.amt}
            </Text>
          </View>
        )}
      </ImageBackground>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  image: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  authorStrip: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 2.5,
    opacity: 0.9,
  },
  bottomGradient: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
    // Simulating linear-gradient via a semi-transparent overlay at the bottom
    // React Native doesn't have CSS gradients; we use a darker bottom region
  },
  bottomMeta: {
    position: 'absolute',
    left: spacing.sm,
    right: spacing.sm,
    bottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 6,
  },
  placeContainer: {
    flex: 1,
    minWidth: 0,
  },
  placeText: {
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.92)',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  avatar: {
    width: 18,
    height: 18,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 8,
    fontWeight: '600',
    color: '#0b0f14',
  },
  topLeftBadges: {
    position: 'absolute',
    top: spacing.sm,
    left: 10,
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
  },
  iconBadge: {
    width: 20,
    height: 20,
    borderRadius: 999,
    backgroundColor: 'rgba(11, 15, 20, 0.78)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  micIcon: {
    fontSize: 9,
  },
  reactionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(11, 15, 20, 0.78)',
  },
  heartIcon: {
    fontSize: 9,
    color: '#ffb4a2',
  },
  reactionCount: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.3,
    color: '#ffb4a2',
  },
  expenseBadge: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(11, 15, 20, 0.78)',
  },
  expenseText: {
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.2,
    fontVariant: ['tabular-nums'],
  },
});
