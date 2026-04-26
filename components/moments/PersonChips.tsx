import React, { useMemo } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from '@/constants/ThemeContext';
import type { GroupMember } from '@/lib/types';

interface PersonChipsProps {
  active: string | null;
  onChange: (userId: string | null) => void;
  members: GroupMember[];
  /** Count of moments per userId. */
  counts: Record<string, number>;
  total: number;
}

const PEOPLE_COLORS = ['#a64d1e', '#b8892b', '#c66a36', '#7f3712', '#9a7d52'];

export function PersonChips({ active, onChange, members, counts, total }: PersonChipsProps) {
  const { colors } = useTheme();

  const membersWithCounts = useMemo(
    () => members.filter((m) => m.userId && (counts[m.userId!] ?? 0) > 0),
    [members, counts],
  );

  const activeName = active
    ? membersWithCounts.find((m) => m.userId === active)?.name.split(' ')[0]
    : null;

  // Don't render if only one contributor
  if (membersWithCounts.length <= 1) return null;

  return (
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        style={styles.scrollView}
      >
      <PersonChip
        label="All"
        count={total}
        isActive={active === null}
        onPress={() => onChange(null)}
        color={colors.accent}
        colors={colors}
      />
      {membersWithCounts.map((m, i) => (
        <PersonChip
          key={m.userId}
          label={m.name.split(' ')[0]}
          count={counts[m.userId!] ?? 0}
          isActive={active === m.userId}
          onPress={() => onChange(m.userId!)}
          color={PEOPLE_COLORS[i % PEOPLE_COLORS.length]}
          avatar={m.profilePhoto}
          initial={m.name.charAt(0).toUpperCase()}
          colors={colors}
        />
      ))}
      </ScrollView>
      {activeName && (
        <Text style={[styles.helperText, { color: colors.text3 }]}>
          Viewing {activeName}'s photos · tap All to reset
        </Text>
      )}
    </View>
  );
}

interface PersonChipProps {
  label: string;
  count: number;
  isActive: boolean;
  onPress: () => void;
  color: string;
  avatar?: string;
  initial?: string;
  colors: ReturnType<typeof useTheme>['colors'];
}

const PersonChip = React.memo(function PersonChip({
  label,
  count,
  isActive,
  onPress,
  color,
  avatar,
  initial,
  colors,
}: PersonChipProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[
        styles.chip,
        {
          backgroundColor: isActive ? colors.accent : colors.card,
          borderColor: isActive ? colors.accent : colors.border,
        },
      ]}
    >
      {initial && (
        <View style={[styles.avatar, { backgroundColor: color }]}>
          {avatar ? (
            <Image source={{ uri: avatar }} style={styles.avatarImage} />
          ) : (
            <Text style={styles.avatarText}>{initial}</Text>
          )}
        </View>
      )}
      <Text
        style={[
          styles.chipLabel,
          { color: isActive ? colors.onBlack : colors.text2 },
        ]}
      >
        {label}
      </Text>
      <View
        style={[
          styles.chipCount,
          {
            backgroundColor: isActive ? 'rgba(0,0,0,0.16)' : colors.card2,
          },
        ]}
      >
        <Text
          style={[
            styles.chipCountText,
            { color: isActive ? colors.onBlack : colors.text3 },
          ]}
        >
          {count}
        </Text>
      </View>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  scrollView: {
    flexGrow: 0,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 6,
    flexDirection: 'row',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  chipCount: {
    minWidth: 18,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 99,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipCountText: {
    fontSize: 10,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
  },
  avatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  avatarText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#0b0f14',
  },
  helperText: {
    fontSize: 11,
    fontWeight: '500',
    paddingHorizontal: 18,
    paddingBottom: 6,
    fontStyle: 'italic',
  },
});
