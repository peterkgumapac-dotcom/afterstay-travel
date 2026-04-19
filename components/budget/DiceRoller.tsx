import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@/constants/ThemeContext';

interface DiceMember {
  name: string;
  initials: string;
  color: string;
}

interface DiceRollerProps {
  members: DiceMember[];
  onResult: (winner: DiceMember) => void;
}

const DICE_SIZE = 120;
const TICK_MS = 80;
const MIN_TICKS = 12;
const MAX_TICKS = 18;

export default function DiceRoller({ members, onResult }: DiceRollerProps) {
  const { colors } = useTheme();
  const styles = getStyles(colors);

  const [rolling, setRolling] = useState(false);
  const [displayIdx, setDisplayIdx] = useState<number | null>(null);
  const rotation = useSharedValue(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const n = members.length;

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const roll = useCallback(() => {
    if (rolling || n === 0) return;
    setRolling(true);

    const totalTicks = MIN_TICKS + Math.floor(Math.random() * (MAX_TICKS - MIN_TICKS + 1));
    const winnerIdx = Math.floor(Math.random() * n);
    let tickCount = 0;

    // Animate rotation tumble
    rotation.value = 0;
    const tumbleSeq = Array.from({ length: 4 }, (_, i) =>
      withTiming((i + 1) * 360, { duration: TICK_MS }),
    );
    rotation.value = withSequence(...tumbleSeq);

    intervalRef.current = setInterval(() => {
      tickCount += 1;
      const cycleIdx = tickCount % n;
      setDisplayIdx(cycleIdx);

      // Re-trigger tumble animation per tick
      rotation.value = withSequence(
        withTiming(180, { duration: TICK_MS / 2 }),
        withTiming(360, { duration: TICK_MS / 2 }),
      );

      if (tickCount >= totalTicks) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        intervalRef.current = null;
        setDisplayIdx(winnerIdx);
        setRolling(false);
        rotation.value = 0;
        onResult(members[winnerIdx]);
      }
    }, TICK_MS);
  }, [rolling, n, members, onResult, rotation]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const currentMember = displayIdx !== null ? members[displayIdx] : null;
  const bgColor = currentMember ? currentMember.color : colors.card2;
  const letter = currentMember ? currentMember.initials : '?';

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.dice,
          { backgroundColor: bgColor },
          animStyle,
        ]}
      >
        <Text style={styles.diceLetter}>{letter}</Text>
      </Animated.View>

      <Pressable
        style={[styles.button, rolling && styles.buttonDisabled]}
        onPress={roll}
        disabled={rolling}
      >
        <Text style={styles.buttonText}>
          {rolling ? 'Rolling\u2026' : 'Roll the dice'}
        </Text>
      </Pressable>
    </View>
  );
}

type ThemeColors = ReturnType<typeof useTheme>['colors'];

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      alignItems: 'center',
      gap: 16,
    },
    dice: {
      width: DICE_SIZE,
      height: DICE_SIZE,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 10,
      elevation: 6,
    },
    diceLetter: {
      fontSize: 56,
      fontWeight: '800',
      color: '#ffffff',
    },
    button: {
      backgroundColor: colors.accent,
      paddingVertical: 12,
      paddingHorizontal: 24,
      borderRadius: 14,
      alignSelf: 'stretch',
      alignItems: 'center',
    },
    buttonDisabled: {
      opacity: 0.5,
    },
    buttonText: {
      color: colors.white,
      fontSize: 14,
      fontWeight: '700',
    },
  });
