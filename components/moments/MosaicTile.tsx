import React, { useMemo } from 'react';
import {
  View,
  Text,
  ImageBackground,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import Svg, { Rect, Path, Circle } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/constants/ThemeContext';
import { Avatar } from './Avatar';
import type { MomentDisplay, PeopleMap } from './types';

interface MosaicTileProps {
  moment: MomentDisplay;
  onOpen: (moment: MomentDisplay) => void;
  aspect?: number;
  people: PeopleMap;
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
          borderRadius: 14,
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
        imageStyle={{ borderRadius: 13 }}
        resizeMode="cover"
      >
        {/* Author color strip - left edge, 2.5px */}
        <View
          style={[
            styles.authorStrip,
            { backgroundColor: authorColor },
          ]}
        />

        {/* Bottom gradient overlay */}
        <LinearGradient
          colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.72)']}
          locations={[0.5, 1]}
          style={StyleSheet.absoluteFillObject}
        />

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
          <Avatar authorKey={authorKey} people={people} size={18} />
        </View>

        {/* Top-left corner badges */}
        <View style={styles.topLeftBadges}>
          {moment.voice && (
            <View style={styles.iconBadge}>
              <Svg width={10} height={10} viewBox="0 0 24 24" fill="none">
                <Rect
                  x={9}
                  y={2}
                  width={6}
                  height={12}
                  rx={3}
                  stroke="rgba(255,255,255,0.95)"
                  strokeWidth={2.2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
                <Path
                  d="M5 11a7 7 0 0014 0M12 18v3"
                  stroke="rgba(255,255,255,0.95)"
                  strokeWidth={2.2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              </Svg>
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
  bottomMeta: {
    position: 'absolute',
    left: 8,
    right: 8,
    bottom: 8,
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
  topLeftBadges: {
    position: 'absolute',
    top: 8,
    left: 10,
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
  },
  iconBadge: {
    width: 20,
    height: 20,
    borderRadius: 99,
    backgroundColor: 'rgba(11, 15, 20, 0.78)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reactionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 99,
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
    top: 8,
    right: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 99,
    backgroundColor: 'rgba(11, 15, 20, 0.78)',
  },
  expenseText: {
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.2,
    fontVariant: ['tabular-nums'],
  },
});
