import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@/constants/ThemeContext';

interface DiceMember {
  name: string;
  initials: string;
  color: string;
}

export interface DiceRollerRef {
  roll: () => void;
}

interface DiceRollerProps {
  members: DiceMember[];
  onResult: (winner: DiceMember) => void;
  onRollStart: () => void;
}

const DICE_SIZE = 120;
const TICK_MS = 80;

const DiceRoller = forwardRef<DiceRollerRef, DiceRollerProps>(
  function DiceRoller({ members, onResult, onRollStart }, ref) {
    const { colors } = useTheme();
    const [rolling, setRolling] = useState(false);
    const [current, setCurrent] = useState<DiceMember | null>(null);
    const rotation = useSharedValue(0);
    const scale = useSharedValue(1);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const n = members.length;

    useEffect(() => {
      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    }, []);

    const roll = useCallback(() => {
      if (rolling || n === 0) return;
      setRolling(true);
      setCurrent(null);
      onRollStart();

      const totalTicks = 12 + Math.floor(Math.random() * 6);
      const pickIdx = Math.floor(Math.random() * n);
      let ticks = 0;

      // diceTumble: 0.12s linear infinite
      // rotate 0 → 90 → 180 → 270 → 360, scale 1 → 0.95 → 1.02 → 0.95 → 1
      rotation.value = withRepeat(
        withSequence(
          withTiming(90, { duration: 30, easing: Easing.linear }),
          withTiming(180, { duration: 30, easing: Easing.linear }),
          withTiming(270, { duration: 30, easing: Easing.linear }),
          withTiming(360, { duration: 30, easing: Easing.linear }),
        ),
        -1,
      );
      scale.value = withRepeat(
        withSequence(
          withTiming(0.95, { duration: 30, easing: Easing.linear }),
          withTiming(1.02, { duration: 30, easing: Easing.linear }),
          withTiming(0.95, { duration: 30, easing: Easing.linear }),
          withTiming(1, { duration: 30, easing: Easing.linear }),
        ),
        -1,
      );

      intervalRef.current = setInterval(() => {
        setCurrent(members[ticks % n]);
        ticks += 1;
        if (ticks >= totalTicks) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          intervalRef.current = null;
          setCurrent(members[pickIdx]);
          setRolling(false);
          rotation.value = withTiming(0, { duration: 200 });
          scale.value = withTiming(1, { duration: 200 });
          onResult(members[pickIdx]);
        }
      }, TICK_MS);
    }, [rolling, n, members, onResult, onRollStart, rotation, scale]);

    useImperativeHandle(ref, () => ({ roll }), [roll]);

    const animStyle = useAnimatedStyle(() => ({
      transform: [
        { rotate: `${rotation.value}deg` },
        { scale: scale.value },
      ],
    }));

    const bgColor = current ? current.color : colors.card2;
    const letter = current ? current.initials : '?';

    return (
      <View style={styles.container}>
        <Animated.View
          style={[
            styles.dice,
            { backgroundColor: bgColor, borderColor: colors.border },
            animStyle,
          ]}
        >
          <Text style={styles.diceLetter}>{letter}</Text>
        </Animated.View>
      </View>
    );
  },
);

export default DiceRoller;

const styles = StyleSheet.create({
  container: {
    width: 180,
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dice: {
    width: DICE_SIZE,
    height: DICE_SIZE,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 26,
    elevation: 6,
  },
  diceLetter: {
    fontSize: 56,
    fontWeight: '700',
    color: '#fffaf0',
  },
});
