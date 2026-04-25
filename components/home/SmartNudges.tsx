import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';
import {
  ChevronDown,
  ChevronUp,
  Clock,
  MapPin,
  TrendingUp,
  Users,
} from 'lucide-react-native';
import { useTheme } from '@/constants/ThemeContext';
import { formatCurrency } from '@/lib/utils';
import type { Place, GroupMember } from '@/lib/types';

type ThemeColors = ReturnType<typeof useTheme>['colors'];

interface SmartNudgesProps {
  dayOfTrip: number;
  totalDays: number;
  daysLeft: number;
  spent: number;
  budget: number;
  savedPlaces: Place[];
  members: GroupMember[];
  destination: string;
  /** Called when user taps the group-votes nudge — opens voting sheet */
  onGroupVoteTap?: () => void;
}

interface Nudge {
  id: string;
  icon: React.ComponentType<any>;
  iconColor: string;
  text: string;
  action?: string;
  /** Custom callback instead of router.push */
  onTap?: () => void;
}

export function SmartNudges({
  dayOfTrip,
  totalDays,
  daysLeft,
  spent,
  budget,
  savedPlaces,
  members,
  destination,
  onGroupVoteTap,
}: SmartNudgesProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);

  const nudges = useMemo(() => {
    const items: Nudge[] = [];

    // Budget forecast
    if (budget > 0 && dayOfTrip > 1 && daysLeft > 0) {
      const dailyRate = spent / dayOfTrip;
      const projected = dailyRate * totalDays;
      const diff = projected - budget;
      if (diff > 0) {
        items.push({
          id: 'budget-forecast',
          icon: TrendingUp,
          iconColor: colors.danger,
          text: `At this pace, you'll spend ${formatCurrency(Math.round(projected), 'PHP')} by Day ${totalDays} — ${formatCurrency(Math.round(diff), 'PHP')} over budget`,
          action: '/(tabs)/budget',
        });
      }
    }

    // Unvisited saved places
    const pendingPlaces = savedPlaces.filter(
      (p) => p.saved && p.vote !== '👎 No',
    );
    if (pendingPlaces.length > 0 && daysLeft > 0) {
      const count = pendingPlaces.length;
      const perDay = Math.ceil(count / daysLeft);
      items.push({
        id: 'unvisited',
        icon: MapPin,
        iconColor: colors.accent,
        text: `${count} saved place${count !== 1 ? 's' : ''} still to visit — ${perDay}/day to see them all`,
        action: '/(tabs)/discover',
      });
    }

    // Group voting pending
    const placesNeedingVotes = savedPlaces.filter((p) => {
      if (p.vote !== 'Pending') return false;
      const votes = p.voteByMember ?? {};
      const votedCount = Object.keys(votes).length;
      return votedCount < members.length;
    });
    if (placesNeedingVotes.length > 0 && members.length >= 2) {
      items.push({
        id: 'group-votes',
        icon: Users,
        iconColor: colors.chart2,
        text: `${placesNeedingVotes.length} place${placesNeedingVotes.length !== 1 ? 's' : ''} waiting for group votes`,
        onTap: onGroupVoteTap,
      });
    }

    // Last day checkout reminder
    if (daysLeft === 0) {
      items.push({
        id: 'checkout',
        icon: Clock,
        iconColor: colors.warn,
        text: `Last day in ${destination}! Make the most of it before checkout`,
      });
    }

    return items.slice(0, 3);
  }, [dayOfTrip, totalDays, daysLeft, spent, budget, savedPlaces, members, destination, colors]);

  const toggleExpand = useCallback(() => setExpanded((e) => !e), []);

  if (nudges.length === 0) return null;

  const firstNudge = nudges[0];
  const restNudges = nudges.slice(1);
  const FirstIcon = firstNudge.icon;
  const Chevron = expanded ? ChevronUp : ChevronDown;

  return (
    <View style={styles.container}>
      {/* First nudge — always visible */}
      <Pressable
        style={styles.nudge}
        onPress={() => {
          if (firstNudge.onTap) firstNudge.onTap();
          else if (firstNudge.action) router.push(firstNudge.action as any);
        }}
      >
        <FirstIcon size={14} color={firstNudge.iconColor} strokeWidth={2} />
        <Text style={styles.nudgeText} numberOfLines={2}>{firstNudge.text}</Text>
        {restNudges.length > 0 && (
          <Pressable onPress={toggleExpand} hitSlop={8} style={styles.expandBtn}>
            <Text style={styles.moreCount}>{restNudges.length}</Text>
            <Chevron size={12} color={colors.text3} strokeWidth={2} />
          </Pressable>
        )}
      </Pressable>

      {/* Expanded nudges */}
      {expanded && restNudges.map((nudge) => {
        const Icon = nudge.icon;
        return (
          <Animated.View
            key={nudge.id}
            entering={FadeInDown.duration(200)}
            exiting={FadeOutUp.duration(150)}
          >
            <TouchableOpacity
              style={styles.nudge}
              activeOpacity={nudge.action || nudge.onTap ? 0.7 : 1}
              onPress={() => {
                if (nudge.onTap) nudge.onTap();
                else if (nudge.action) router.push(nudge.action as any);
              }}
            >
              <Icon size={14} color={nudge.iconColor} strokeWidth={2} />
              <Text style={styles.nudgeText} numberOfLines={2}>{nudge.text}</Text>
            </TouchableOpacity>
          </Animated.View>
        );
      })}
    </View>
  );
}

const getStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: {
      paddingHorizontal: 16,
      gap: 4,
      marginBottom: 8,
    },
    nudge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 8,
      paddingLeft: 12,
      paddingRight: 8,
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 12,
    },
    nudgeText: {
      flex: 1,
      fontSize: 11,
      color: c.text2,
      lineHeight: 15,
    },
    expandBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      paddingHorizontal: 6,
      paddingVertical: 4,
      borderRadius: 8,
      backgroundColor: c.card2,
    },
    moreCount: {
      fontSize: 10,
      fontWeight: '700',
      color: c.text3,
    },
  });
