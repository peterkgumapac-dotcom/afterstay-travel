import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { useTheme } from '@/constants/ThemeContext';
import type { GroupMember } from '@/lib/types';
import DiceRoller from './DiceRoller';
import SpinWheel from './SpinWheel';

interface WhoPaysPickerProps {
  members: GroupMember[];
}

type PickerMode = 'wheel' | 'dice';

const MEMBER_COLORS = [
  '#a64d1e',
  '#b8892b',
  '#c66a36',
  '#d9a441',
  '#e38868',
] as const;

interface MappedMember {
  name: string;
  initials: string;
  color: string;
}

function mapMembers(members: ReadonlyArray<GroupMember>): MappedMember[] {
  return members.map((m, i) => ({
    name: m.name,
    initials: m.name.charAt(0).toUpperCase(),
    color: MEMBER_COLORS[i % MEMBER_COLORS.length],
  }));
}

export default function WhoPaysPicker({ members }: WhoPaysPickerProps) {
  const { colors } = useTheme();
  const styles = getStyles(colors);

  const [mode, setMode] = useState<PickerMode>('wheel');
  const [winner, setWinner] = useState<MappedMember | null>(null);
  const [spinning, setSpinning] = useState(false);

  const mapped = useMemo(() => mapMembers(members), [members]);

  const handleResult = useCallback((result: MappedMember) => {
    setWinner(result);
    setSpinning(false);
  }, []);

  const handleWheelResult = useCallback(
    (result: MappedMember) => {
      setSpinning(true);
      // Small delay so "Spinning..." shows briefly before result
      setTimeout(() => handleResult(result), 0);
    },
    [handleResult],
  );

  const handleDiceResult = useCallback(
    (result: MappedMember) => {
      handleResult(result);
    },
    [handleResult],
  );

  if (mapped.length < 2) return null;

  return (
    <View style={styles.section}>
      {/* Section header */}
      <Text style={styles.kicker}>WHO PAYS?</Text>
      <Text style={styles.sectionTitle}>Let fate decide</Text>

      {/* Mode toggle */}
      <View style={styles.toggleRow}>
        {(['wheel', 'dice'] as const).map((m) => {
          const active = mode === m;
          return (
            <Pressable
              key={m}
              style={[styles.togglePill, active && styles.togglePillActive]}
              onPress={() => {
                setMode(m);
                setWinner(null);
              }}
            >
              <Text style={[styles.togglePillText, active && styles.togglePillTextActive]}>
                {m === 'wheel' ? 'Wheel' : 'Dice'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Card container */}
      <View style={styles.cardWrapper}>
        <LinearGradient
          colors={[colors.card, colors.card2]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.card}
        >
          {mode === 'wheel' ? (
            <SpinWheel members={mapped} onResult={handleWheelResult} />
          ) : (
            <DiceRoller members={mapped} onResult={handleDiceResult} />
          )}

          {/* Result area */}
          <View style={styles.resultArea}>
            {winner ? (
              <>
                <Text style={[styles.resultEyebrow, { color: colors.accent }]}>
                  NEXT ROUND'S ON
                </Text>
                <Text style={[styles.resultName, { color: colors.text }]}>
                  {winner.name} {'\uD83C\uDF79'}
                </Text>
              </>
            ) : (
              <Text style={[styles.resultHint, { color: colors.text3 }]}>
                Tap to pick someone to pay
              </Text>
            )}
          </View>
        </LinearGradient>
      </View>
    </View>
  );
}

type ThemeColors = ReturnType<typeof useTheme>['colors'];

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    section: {
      marginTop: 24,
      marginBottom: 16,
    },
    kicker: {
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 1.8,
      textTransform: 'uppercase',
      color: colors.text3,
      marginBottom: 2,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: '800',
      color: colors.text,
      letterSpacing: -0.4,
      marginBottom: 12,
    },
    toggleRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 14,
    },
    togglePill: {
      paddingVertical: 6,
      paddingHorizontal: 16,
      borderRadius: 999,
      backgroundColor: colors.bg3,
    },
    togglePillActive: {
      backgroundColor: colors.accent,
    },
    togglePillText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.text3,
    },
    togglePillTextActive: {
      color: colors.white,
    },
    cardWrapper: {
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    card: {
      padding: 20,
    },
    resultArea: {
      marginTop: 16,
      alignItems: 'center',
      minHeight: 48,
      justifyContent: 'center',
    },
    resultEyebrow: {
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 1.6,
      textTransform: 'uppercase',
      marginBottom: 2,
    },
    resultName: {
      fontSize: 22,
      fontWeight: '800',
      letterSpacing: -0.4,
    },
    resultHint: {
      fontSize: 13,
    },
  });
