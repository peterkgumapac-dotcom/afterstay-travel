import React, { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, G, Path, Text as SvgText } from 'react-native-svg';

import { useTheme } from '@/constants/ThemeContext';

export interface WheelMember {
  name: string;
  initials: string;
  color: string;
  photo?: string;
}

export interface SpinWheelRef {
  spin: () => void;
}

interface SpinWheelProps {
  members: WheelMember[];
  onResult: (winner: WheelMember) => void;
  onSpinStart: () => void;
}

const SIZE = 180;
const R = SIZE / 2;

function segPath(i: number, n: number): string {
  const segAngle = 360 / n;
  const startRad = ((i * segAngle - 90) * Math.PI) / 180;
  const endRad = (((i + 1) * segAngle - 90) * Math.PI) / 180;
  const x1 = R + R * Math.cos(startRad);
  const y1 = R + R * Math.sin(startRad);
  const x2 = R + R * Math.cos(endRad);
  const y2 = R + R * Math.sin(endRad);
  const large = segAngle > 180 ? 1 : 0;
  return `M${R},${R} L${x1},${y1} A${R},${R} 0 ${large} 1 ${x2},${y2} Z`;
}

const SpinWheel = forwardRef<SpinWheelRef, SpinWheelProps>(
  function SpinWheel({ members, onResult, onSpinStart }, ref) {
    const { colors } = useTheme();
    const rotation = useSharedValue(0);
    const [spinning, setSpinning] = useState(false);
    const cumulativeDeg = useRef(0);
    const n = members.length;
    const segAngle = 360 / n;

    const handleResult = useCallback(
      (idx: number) => {
        setSpinning(false);
        onResult(members[idx]);
      },
      [members, onResult],
    );

    const spin = useCallback(() => {
      if (spinning || n === 0) return;
      setSpinning(true);
      onSpinStart();

      const pickIdx = Math.floor(Math.random() * n);
      const centerAngle = pickIdx * segAngle + segAngle / 2;
      const targetBase = (360 - centerAngle) % 360;
      const spins = 5 + Math.floor(Math.random() * 3);
      const currentMod = cumulativeDeg.current % 360;
      let delta = spins * 360 + targetBase - currentMod;
      if (delta < spins * 360) delta += 360;

      const targetDeg = cumulativeDeg.current + delta;
      cumulativeDeg.current = targetDeg;

      rotation.value = withTiming(
        targetDeg,
        {
          duration: 3400,
          easing: Easing.bezier(0.17, 0.67, 0.2, 1.0),
        },
        (finished) => {
          if (finished) {
            runOnJS(handleResult)(pickIdx);
          }
        },
      );
    }, [spinning, n, segAngle, rotation, handleResult, onSpinStart]);

    useImperativeHandle(ref, () => ({ spin }), [spin]);

    const animStyle = useAnimatedStyle(() => ({
      transform: [{ rotate: `${rotation.value}deg` }],
    }));

    if (n === 0) return null;

    return (
      <View style={styles.container}>
        {/* Pointer */}
        <View style={styles.pointerWrap}>
          <View style={[styles.pointer, { borderTopColor: colors.text }]} />
        </View>

        {/* Wheel */}
        <Animated.View style={animStyle}>
          <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
            {members.map((m, i) => {
              const centerRad = ((i * segAngle + segAngle / 2 - 90) * Math.PI) / 180;
              const tx = R + R * 0.62 * Math.cos(centerRad);
              const ty = R + R * 0.62 * Math.sin(centerRad);
              const rotDeg = i * segAngle + segAngle / 2;
              return (
                <G key={m.name}>
                  <Path
                    d={segPath(i, n)}
                    fill={m.color}
                    stroke="#fffaf0"
                    strokeWidth={2}
                  />
                  <G rotation={rotDeg} origin={`${tx}, ${ty}`}>
                    <SvgText
                      x={tx}
                      y={ty - 4}
                      fill="#fffaf0"
                      fontSize={13}
                      fontWeight="700"
                      textAnchor="middle"
                    >
                      {m.initials}
                    </SvgText>
                    <SvgText
                      x={tx}
                      y={ty + 12}
                      fill="#fffaf0"
                      fontSize={8.5}
                      fontWeight="600"
                      textAnchor="middle"
                      opacity={0.85}
                    >
                      {m.name.toUpperCase()}
                    </SvgText>
                  </G>
                </G>
              );
            })}
            {/* Center hub */}
            <Circle cx={R} cy={R} r={14} fill="#fffaf0" stroke={colors.border} strokeWidth={1.5} />
            <Circle cx={R} cy={R} r={4} fill={colors.accent} />
          </Svg>
        </Animated.View>
      </View>
    );
  },
);

export default SpinWheel;

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    width: SIZE + 20,
    height: SIZE + 20,
    justifyContent: 'center',
  },
  pointerWrap: {
    position: 'absolute',
    top: -2,
    alignSelf: 'center',
    zIndex: 2,
  },
  pointer: {
    width: 0,
    height: 0,
    borderLeftWidth: 9,
    borderRightWidth: 9,
    borderTopWidth: 14,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
});
