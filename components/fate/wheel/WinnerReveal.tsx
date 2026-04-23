import React, { useEffect } from 'react';
import { Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { colorForName, fateColors, fateFonts, fateLayout } from '@/constants/fateTheme';
import { useHaptics } from '@/hooks/fate/useHaptics';

interface WinnerRevealProps {
  winner: string;
  winnerIndex: number;
  duoWinner?: string;
  duoWinnerIndex?: number;
  onSpinAgain: () => void;
  onDone: () => void;
}

export default function WinnerReveal({
  winner,
  winnerIndex,
  duoWinner,
  duoWinnerIndex,
  onSpinAgain,
  onDone,
}: WinnerRevealProps) {
  const scale = useSharedValue(0.8);
  const opacity = useSharedValue(0);
  const haptics = useHaptics();

  useEffect(() => {
    haptics.success();
    scale.value = withSpring(1, { damping: 12 });
    opacity.value = withDelay(200, withTiming(1, { duration: 400 }));
  }, []);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const confettiStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const initial = winner.charAt(0).toUpperCase();
  const color = colorForName(winner, winnerIndex);
  const isDuo = duoWinner != null;

  return (
    <View style={styles.overlay}>
      {/* Confetti dots */}
      <Animated.View style={[styles.confettiContainer, confettiStyle]}>
        {CONFETTI_POSITIONS.map((pos, i) => (
          <View
            key={i}
            style={[
              styles.confettiDot,
              {
                left: pos.x,
                top: pos.y,
                backgroundColor: colorForName('', i),
                width: pos.size,
                height: pos.size,
                borderRadius: pos.size / 2,
              },
            ]}
          />
        ))}
      </Animated.View>

      <Animated.View style={[styles.card, cardStyle]}>
        <Text style={styles.badge}>CHOSEN</Text>

        <View style={[styles.initialCircle, { backgroundColor: color }]}>
          <Text style={styles.initialText}>{initial}</Text>
        </View>

        <Text style={styles.winnerName}>{winner}</Text>
        {isDuo && duoWinner && (
          <Text style={styles.winnerName}>&amp; {duoWinner}</Text>
        )}

        <Text style={styles.subtitle}>
          {isDuo ? 'are picking up the tab tonight' : 'is picking up the tab tonight'}
        </Text>

        <View style={styles.actions}>
          <Pressable
            onPress={onSpinAgain}
            style={styles.spinAgainBtn}
            accessibilityRole="button"
            accessibilityLabel="Spin again"
          >
            <Text style={styles.spinAgainText}>Spin again</Text>
          </Pressable>
          <Pressable
            onPress={onDone}
            style={styles.doneBtn}
            accessibilityRole="button"
            accessibilityLabel="Done"
          >
            <Text style={styles.doneText}>Done</Text>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const CONFETTI_POSITIONS = [
  { x: SCREEN_W * 0.15, y: SCREEN_H * 0.20, size: 8 },
  { x: SCREEN_W * 0.80, y: SCREEN_H * 0.15, size: 6 },
  { x: SCREEN_W * 0.10, y: SCREEN_H * 0.70, size: 10 },
  { x: SCREEN_W * 0.85, y: SCREEN_H * 0.65, size: 7 },
  { x: SCREEN_W * 0.25, y: SCREEN_H * 0.85, size: 5 },
  { x: SCREEN_W * 0.70, y: SCREEN_H * 0.80, size: 9 },
  { x: SCREEN_W * 0.50, y: SCREEN_H * 0.10, size: 6 },
  { x: SCREEN_W * 0.90, y: SCREEN_H * 0.40, size: 8 },
  { x: SCREEN_W * 0.05, y: SCREEN_H * 0.45, size: 7 },
  { x: SCREEN_W * 0.60, y: SCREEN_H * 0.90, size: 5 },
];

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: fateColors.background,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  confettiContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  confettiDot: {
    position: 'absolute',
    opacity: 0.6,
  },
  card: {
    backgroundColor: fateColors.surface,
    borderWidth: 0.5,
    borderColor: fateColors.surfaceBorder,
    borderRadius: fateLayout.cardRadius,
    paddingHorizontal: fateLayout.cardPaddingH,
    paddingTop: fateLayout.cardPaddingV,
    paddingBottom: 32,
    alignItems: 'center',
    shadowColor: fateColors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 24,
    elevation: 8,
  },
  badge: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    color: fateColors.primary,
    marginBottom: 20,
  },
  initialCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  initialText: {
    fontFamily: fateFonts.serif,
    fontSize: 32,
    fontWeight: '500',
    color: fateColors.background,
  },
  winnerName: {
    fontFamily: fateFonts.serif,
    fontSize: 36,
    fontWeight: '500',
    color: fateColors.textPrimary,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    fontStyle: 'italic',
    color: fateColors.textSecondary,
    marginTop: 8,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 28,
  },
  spinAgainBtn: {
    backgroundColor: fateColors.buttonPrimary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: fateLayout.buttonRadius,
  },
  spinAgainText: {
    fontSize: 14,
    fontWeight: '600',
    color: fateColors.buttonPrimaryText,
  },
  doneBtn: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: fateLayout.buttonRadius,
    borderWidth: 1,
    borderColor: 'rgba(60, 40, 20, 0.3)',
  },
  doneText: {
    fontSize: 14,
    fontWeight: '600',
    color: fateColors.textPrimary,
  },
});
