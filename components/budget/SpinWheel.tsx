import React, { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, G, Path, Text as SvgText } from 'react-native-svg';

import { useTheme } from '@/constants/ThemeContext';

interface WheelMember {
  name: string;
  initials: string;
  color: string;
}

interface SpinWheelProps {
  members: WheelMember[];
  onResult: (winner: WheelMember) => void;
}

const WHEEL_SIZE = 180;
const RADIUS = WHEEL_SIZE / 2;
const HUB_RADIUS = 14;
const HUB_DOT_RADIUS = 4;
const POINTER_SIZE = 14;

function segPath(i: number, n: number, r: number): string {
  const segAngle = 360 / n;
  const startRad = ((i * segAngle - 90) * Math.PI) / 180;
  const endRad = (((i + 1) * segAngle - 90) * Math.PI) / 180;
  const x1 = r + r * Math.cos(startRad);
  const y1 = r + r * Math.sin(startRad);
  const x2 = r + r * Math.cos(endRad);
  const y2 = r + r * Math.sin(endRad);
  const large = segAngle > 180 ? 1 : 0;
  return `M${r},${r} L${x1},${y1} A${r},${r} 0 ${large} 1 ${x2},${y2} Z`;
}

function segLabelPos(i: number, n: number, r: number): { x: number; y: number } {
  const segAngle = 360 / n;
  const midRad = (((i + 0.5) * segAngle - 90) * Math.PI) / 180;
  const labelR = r * 0.62;
  return {
    x: r + labelR * Math.cos(midRad),
    y: r + labelR * Math.sin(midRad),
  };
}

export default function SpinWheel({ members, onResult }: SpinWheelProps) {
  const { colors } = useTheme();
  const styles = getStyles(colors);

  const rotation = useSharedValue(0);
  const [spinning, setSpinning] = useState(false);
  const cumulativeDeg = useRef(0);
  const n = members.length;

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

    const winnerIdx = Math.floor(Math.random() * n);
    const segAngle = 360 / n;
    // The pointer is at the top (0 deg). To land winner under pointer:
    // winner segment center angle from 0 = winnerIdx * segAngle + segAngle/2
    // We need total rotation to end so that winner is at top.
    const winnerCenterAngle = winnerIdx * segAngle + segAngle / 2;
    const fullRotations = (5 + Math.floor(Math.random() * 3)) * 360;
    // Rotation goes clockwise; to put winner at top we need:
    // (cumulativeDeg + target) mod 360 = 360 - winnerCenterAngle
    const targetAngle = 360 - winnerCenterAngle;
    const currentMod = cumulativeDeg.current % 360;
    let delta = fullRotations + targetAngle - currentMod;
    if (delta < fullRotations) delta += 360;

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
          runOnJS(handleResult)(winnerIdx);
        }
      },
    );
  }, [spinning, n, rotation, handleResult]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  if (n === 0) return null;

  return (
    <View style={styles.container}>
      {/* Pointer triangle */}
      <View style={styles.pointerWrap}>
        <View style={[styles.pointer, { borderBottomColor: colors.accent }]} />
      </View>

      <Animated.View style={animStyle}>
        <Svg width={WHEEL_SIZE} height={WHEEL_SIZE} viewBox={`0 0 ${WHEEL_SIZE} ${WHEEL_SIZE}`}>
          <G>
            {members.map((member, i) => {
              const d = segPath(i, n, RADIUS);
              const pos = segLabelPos(i, n, RADIUS);
              const segAngle = 360 / n;
              const midAngle = (i + 0.5) * segAngle - 90;
              return (
                <G key={`${member.name}-${i}`}>
                  <Path
                    d={d}
                    fill={member.color}
                    stroke="#ffffff"
                    strokeWidth={1.5}
                  />
                  <SvgText
                    x={pos.x}
                    y={pos.y - 5}
                    fill="#ffffff"
                    fontSize={n > 6 ? 11 : 14}
                    fontWeight="800"
                    textAnchor="middle"
                    alignmentBaseline="central"
                    rotation={midAngle + 90}
                    origin={`${pos.x},${pos.y}`}
                  >
                    {member.initials}
                  </SvgText>
                  {n <= 6 && (
                    <SvgText
                      x={pos.x}
                      y={pos.y + 9}
                      fill="rgba(255,255,255,0.8)"
                      fontSize={7}
                      fontWeight="600"
                      textAnchor="middle"
                      alignmentBaseline="central"
                      rotation={midAngle + 90}
                      origin={`${pos.x},${pos.y}`}
                    >
                      {member.name.length > 8
                        ? member.name.slice(0, 7) + '\u2026'
                        : member.name}
                    </SvgText>
                  )}
                </G>
              );
            })}
          </G>
          {/* Center hub */}
          <Circle cx={RADIUS} cy={RADIUS} r={HUB_RADIUS} fill="#ffffff" />
          <Circle cx={RADIUS} cy={RADIUS} r={HUB_DOT_RADIUS} fill={colors.accent} />
        </Svg>
      </Animated.View>

      <Pressable
        style={[styles.button, spinning && styles.buttonDisabled]}
        onPress={spin}
        disabled={spinning}
      >
        <Text style={styles.buttonText}>
          {spinning ? 'Spinning\u2026' : 'Spin the wheel'}
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
    pointerWrap: {
      alignItems: 'center',
      marginBottom: -4,
      zIndex: 1,
    },
    pointer: {
      width: 0,
      height: 0,
      borderLeftWidth: POINTER_SIZE / 2,
      borderRightWidth: POINTER_SIZE / 2,
      borderBottomWidth: POINTER_SIZE,
      borderLeftColor: 'transparent',
      borderRightColor: 'transparent',
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
