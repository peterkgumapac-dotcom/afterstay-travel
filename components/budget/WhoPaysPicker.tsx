import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, BounceIn } from 'react-native-reanimated';

import { useTheme } from '@/constants/ThemeContext';
import type { GroupMember } from '@/lib/types';
import DiceRoller from './DiceRoller';
import SpinWheel from './SpinWheel';
import type { DiceRollerRef } from './DiceRoller';
import type { SpinWheelRef, WheelMember } from './SpinWheel';

type ThemeColors = ReturnType<typeof useTheme>['colors'];

type PickerMode = 'wheel' | 'dice';

const MEMBER_COLORS = ['#a64d1e', '#b8892b', '#c66a36', '#8a5a2b', '#7e9f5b'];

interface WhoPaysPickerProps {
  members?: GroupMember[];
}

export default function WhoPaysPicker({ members: groupMembers }: WhoPaysPickerProps) {
  const { colors } = useTheme();
  const styles = getStyles(colors);

  const [mode, setMode] = useState<PickerMode>('wheel');
  const [winner, setWinner] = useState<WheelMember | null>(null);
  const [spinning, setSpinning] = useState(false);

  const wheelRef = useRef<SpinWheelRef>(null);
  const diceRef = useRef<DiceRollerRef>(null);

  const mapped = useMemo<WheelMember[]>(() => {
    if (groupMembers && groupMembers.length > 0) {
      return groupMembers.map((m, i) => ({
        name: m.name,
        initials: m.name.charAt(0).toUpperCase(),
        color: MEMBER_COLORS[i % MEMBER_COLORS.length],
        photo: m.profilePhoto,
      }));
    }
    return [
      { name: 'Peter', initials: 'P', color: '#a64d1e' },
      { name: 'Aaron', initials: 'A', color: '#b8892b' },
      { name: 'Jane', initials: 'J', color: '#c66a36' },
    ];
  }, [groupMembers]);

  const handleSpinStart = useCallback(() => {
    setSpinning(true);
    setWinner(null);
  }, []);

  const handleResult = useCallback((result: WheelMember) => {
    setWinner(result);
    setSpinning(false);
  }, []);

  const handleButtonPress = useCallback(() => {
    if (spinning) return;
    if (mode === 'wheel') {
      wheelRef.current?.spin();
    } else {
      diceRef.current?.roll();
    }
  }, [mode, spinning]);

  return (
    <View style={styles.container}>
      {/* Card */}
      <View style={styles.cardOuter}>
        <LinearGradient
          colors={[colors.card, colors.card2]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.card}
        >
          {/* Wheel or Dice */}
          {mode === 'wheel' && (
            <SpinWheel
              ref={wheelRef}
              members={mapped}
              onResult={handleResult}
              onSpinStart={handleSpinStart}
            />
          )}

          {mode === 'dice' && (
            <DiceRoller
              ref={diceRef}
              members={mapped}
              onResult={handleResult}
              onRollStart={handleSpinStart}
            />
          )}

          {/* Result */}
          <View style={[styles.resultArea, { opacity: winner && !spinning ? 1 : 0.4 }]}>
            {winner && !spinning ? (
              <Animated.View entering={BounceIn.duration(500)} style={styles.resultContent}>
                {winner.photo ? (
                  <Image
                    source={{ uri: winner.photo }}
                    style={styles.winnerPhoto}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={[styles.winnerPhoto, { backgroundColor: winner.color }]}>
                    <Text style={styles.winnerInit}>{winner.initials}</Text>
                  </View>
                )}
                <Text style={[styles.resultEyebrow, { color: colors.accent }]}>
                  Next round's on
                </Text>
                <Text style={[styles.resultName, { color: colors.text }]}>
                  {winner.name} {'\uD83C\uDF79'}
                </Text>
              </Animated.View>
            ) : (
              <View style={{ marginTop: 14 }}>
                <Text style={[styles.resultHint, { color: colors.text3 }]}>
                  {spinning
                    ? mode === 'wheel'
                      ? 'Spinning\u2026'
                      : 'Rolling\u2026'
                    : 'Tap to pick someone to pay'}
                </Text>
              </View>
            )}
          </View>

          {/* Button */}
          <TouchableOpacity
            onPress={handleButtonPress}
            disabled={spinning}
            style={[styles.button, { opacity: spinning ? 0.55 : 1 }]}
            activeOpacity={0.85}
          >
            <Text style={styles.buttonText}>
              {spinning ? '\u2026' : mode === 'wheel' ? 'Spin the wheel' : 'Roll the dice'}
            </Text>
          </TouchableOpacity>
        </LinearGradient>
      </View>
    </View>
  );
}

/* ---------- Segmented control for mode (exposed separately for GroupHeader action slot) ---------- */

export function WhoPaysSegment({
  mode,
  onModeChange,
}: {
  mode: PickerMode;
  onModeChange: (m: PickerMode) => void;
}) {
  const { colors } = useTheme();
  const s = segStyles(colors);
  return (
    <View style={s.seg}>
      {(['wheel', 'dice'] as const).map((m) => {
        const active = mode === m;
        return (
          <Pressable
            key={m}
            style={[s.segBtn, active && s.segBtnActive]}
            onPress={() => onModeChange(m)}
          >
            <Text style={[s.segText, active && s.segTextActive]}>
              {m === 'wheel' ? 'Wheel' : 'Dice'}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const segStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    seg: {
      flexDirection: 'row',
      padding: 3,
      backgroundColor: colors.card2,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      gap: 2,
    },
    segBtn: {
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 9,
    },
    segBtnActive: {
      backgroundColor: colors.card,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.22,
      shadowRadius: 3,
      elevation: 2,
    },
    segText: {
      fontSize: 10,
      fontWeight: '600',
      color: colors.text3,
      letterSpacing: -0.1,
    },
    segTextActive: {
      color: colors.text,
    },
  });

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      paddingHorizontal: 16,
    },
    cardOuter: {
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    card: {
      paddingTop: 22,
      paddingHorizontal: 16,
      paddingBottom: 20,
      alignItems: 'center',
      gap: 16,
    },
    resultArea: {
      minHeight: 48,
      alignItems: 'center',
      justifyContent: 'center',
    },
    resultContent: {
      alignItems: 'center',
    },
    winnerPhoto: {
      width: 52,
      height: 52,
      borderRadius: 26,
      marginBottom: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    winnerInit: {
      color: '#fff',
      fontSize: 20,
      fontWeight: '700',
    },
    resultEyebrow: {
      fontSize: 10,
      fontWeight: '600',
      letterSpacing: 1.6,
      textTransform: 'uppercase',
    },
    resultName: {
      fontSize: 22,
      fontWeight: '500',
      letterSpacing: -0.66,
      marginTop: 2,
    },
    resultHint: {
      fontSize: 12,
    },
    button: {
      backgroundColor: colors.black,
      paddingVertical: 12,
      paddingHorizontal: 18,
      borderRadius: 999,
      alignSelf: 'stretch',
      alignItems: 'center',
      justifyContent: 'center',
    },
    buttonText: {
      color: colors.onBlack,
      fontSize: 13,
      fontWeight: '600',
    },
  });
