import React from 'react';
import {
  View,
  Text,
  ImageBackground,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
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
