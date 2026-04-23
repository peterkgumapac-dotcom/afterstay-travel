import React from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/constants/ThemeContext';
import { spacing, radius } from '@/constants/theme';
import type { GroupMember } from '@/lib/types';

interface Props {
  members: GroupMember[];
  selected: string | null; // null = All
  onSelect: (name: string | null) => void;
  spendingByPerson?: Record<string, number>;
}

export function PersonFilter({ members, selected, onSelect, spendingByPerson = {} }: Props) {
  const { colors } = useTheme();
  const styles = getStyles(colors);

  if (members.length < 2) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>Filter by person</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        <TouchableOpacity
          style={[styles.chip, !selected && styles.chipActive]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onSelect(null);
          }}
          activeOpacity={0.7}
        >
          <Text style={[styles.chipText, !selected && styles.chipTextActive]}>All</Text>
        </TouchableOpacity>
        {members.map((m) => {
          const active = selected === m.name;
          const spent = spendingByPerson[m.name] ?? 0;
          return (
            <TouchableOpacity
              key={m.id}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onSelect(active ? null : m.name);
              }}
              activeOpacity={0.7}
            >
              {m.profilePhoto ? (
                <Image source={{ uri: m.profilePhoto }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatarFallback, { backgroundColor: colors.accentBg }]}>
                  <Text style={{ fontSize: 10, color: colors.accent, fontWeight: '600' }}>
                    {m.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <View>
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{m.name.split(' ')[0]}</Text>
                {spent > 0 && (
                  <Text style={[styles.chipAmount, active && { color: colors.accent }]}>
                    {'\u20B1'}{spent.toLocaleString()}
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const getStyles = (colors: ReturnType<typeof useTheme>['colors']) =>
  StyleSheet.create({
    container: {
      gap: spacing.sm,
    },
    eyebrow: {
      fontSize: 10,
      fontWeight: '600',
      letterSpacing: 1,
      textTransform: 'uppercase',
      color: colors.text3,
    },
    row: {
      gap: spacing.sm,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    chipActive: {
      borderColor: colors.accent,
      backgroundColor: colors.accentBg,
    },
    chipText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.text,
    },
    chipTextActive: {
      color: colors.accent,
    },
    chipAmount: {
      fontSize: 9,
      color: colors.text3,
      marginTop: 1,
    },
    avatar: {
      width: 20,
      height: 20,
      borderRadius: 10,
    },
    avatarFallback: {
      width: 20,
      height: 20,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
