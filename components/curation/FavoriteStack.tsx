import React, { memo, useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
} from 'react-native-reanimated';

interface FavoriteStackProps {
  count: number;
  max: number;
  /** Timestamp (Date.now()) of last add — triggers bounce animation. */
  lastAddedAt: number;
}

const STACK_VISIBLE = 3;
const CARD_SIZE = 28;
const OFFSET = 4;

const BOUNCE_SPRING = { damping: 8, stiffness: 300, mass: 0.6 };

/**
 * Top-right stack showing "count/max" with mini photo placeholders.
 * Spring-bounces when a new favorite is added.
 */
function FavoriteStackInner({ count, max, lastAddedAt }: FavoriteStackProps) {
  const bounceScale = useSharedValue(1);
  const prevTimestamp = useRef(0);

  useEffect(() => {
    if (lastAddedAt > 0 && lastAddedAt !== prevTimestamp.current) {
      prevTimestamp.current = lastAddedAt;
      bounceScale.value = withSequence(
        withSpring(1.2, BOUNCE_SPRING),
        withSpring(1, BOUNCE_SPRING),
      );
    }
  }, [lastAddedAt, bounceScale]);

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: bounceScale.value }],
  }));

  if (count === 0) return null;

  const stackCount = Math.min(count, STACK_VISIBLE);

  return (
    <Animated.View style={[styles.container, containerStyle]}>
      <View style={styles.stackWrap}>
        {Array.from({ length: stackCount }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.miniCard,
              {
                top: i * OFFSET,
                right: i * OFFSET,
                zIndex: stackCount - i,
                opacity: 1 - i * 0.2,
              },
            ]}
          />
        ))}
      </View>
      <Text style={styles.label}>{count}/{max}</Text>
    </Animated.View>
  );
}

export const FavoriteStack = memo(FavoriteStackInner);

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 12,
    right: 12,
    alignItems: 'center',
    gap: 4,
    zIndex: 50,
  },
  stackWrap: {
    width: CARD_SIZE + (STACK_VISIBLE - 1) * OFFSET,
    height: CARD_SIZE + (STACK_VISIBLE - 1) * OFFSET,
  },
  miniCard: {
    position: 'absolute',
    width: CARD_SIZE,
    height: CARD_SIZE,
    borderRadius: 6,
    backgroundColor: 'rgba(200, 149, 108, 0.7)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});
