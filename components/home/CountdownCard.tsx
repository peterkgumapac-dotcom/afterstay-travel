import { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { ChevronRight, Plane } from 'lucide-react-native';
import { useTheme } from '@/constants/ThemeContext';
import { spacing } from '@/constants/theme';
import { safeParse } from '@/lib/utils';

interface Props {
  tripStartISO: string;
  status: 'upcoming' | 'active' | 'completed';
  dayNumber?: number;
  totalDays: number;
  dateLabel?: string;
  onBoard?: () => void;
}

export function CountdownCard({
  tripStartISO,
  status,
  dayNumber,
  totalDays,
  dateLabel,
  onBoard,
}: Props) {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const [now, setNow] = useState(Date.now());
  const pulseScale = useSharedValue(1);

  useEffect(() => {
    if (status !== 'upcoming') return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [status]);

  useEffect(() => {
    if (status !== 'upcoming') return;
    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.03, { duration: 1000, easing: Easing.inOut(Easing.sin) }),
        withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
    );
  }, [status, pulseScale]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  if (status === 'completed') return null;

  if (status === 'active') {
    return (
      <View style={styles.card}>
        <Text style={styles.activeLabel}>
          Day {dayNumber} of {totalDays}
        </Text>
      </View>
    );
  }

  const tripStart = safeParse(tripStartISO).getTime();
  const diff = Math.max(0, tripStart - now);
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <Text style={styles.eyebrow}>ARRIVING IN</Text>
        {dateLabel ? <Text style={styles.dateLabel}>{dateLabel}</Text> : null}
      </View>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>Departing</Text>
      </View>
      <View style={styles.digitsRow}>
        <Animated.View style={[styles.digitCell, pulseStyle]}>
          <Text style={styles.digitLarge}>{days}</Text>
          <Text style={styles.digitLabel}>DAYS</Text>
        </Animated.View>
        <Text style={styles.separator}>:</Text>
        <View style={styles.digitCell}>
          <Text style={styles.digit}>{String(hours).padStart(2, '0')}</Text>
          <Text style={styles.digitLabel}>HRS</Text>
        </View>
        <Text style={styles.separator}>:</Text>
        <View style={styles.digitCell}>
          <Text style={styles.digit}>{String(minutes).padStart(2, '0')}</Text>
          <Text style={styles.digitLabel}>MIN</Text>
        </View>
        <Text style={styles.separator}>:</Text>
        <View style={styles.digitCell}>
          <Text style={styles.digitMuted}>{String(seconds).padStart(2, '0')}</Text>
          <Text style={styles.digitLabel}>SEC</Text>
        </View>
      </View>

      {onBoard ? (
        <>
          <View style={styles.boardDivider} />
          <TouchableOpacity
            style={styles.boardButton}
            onPress={onBoard}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="I'm boarding now"
          >
            <View style={styles.boardRow}>
              <View style={styles.boardIconCircle}>
                <Plane
                  size={12}
                  color="rgba(255,250,240,0.95)"
                  style={{ transform: [{ rotate: '-45deg' }] }}
                />
              </View>
              <View style={styles.boardTextCol}>
                <Text style={styles.boardEyebrow}>AT THE GATE?</Text>
                <Text style={styles.boardLabel}>I'm boarding now</Text>
              </View>
            </View>
            <ChevronRight size={16} color="rgba(255,250,240,0.85)" />
          </TouchableOpacity>
        </>
      ) : null}
    </View>
  );
}

const getStyles = (colors: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  card: {
    backgroundColor: colors.bg2,
    borderRadius: 16,
    padding: 18,
    marginHorizontal: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 4,
  },
  eyebrow: {
    color: colors.text3,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
  },
  dateLabel: {
    color: colors.text2,
    fontSize: 11,
  },
  badge: {
    position: 'absolute',
    top: 14,
    right: 14,
    backgroundColor: colors.accentDim,
    borderColor: colors.accentBorder,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  badgeText: {
    color: colors.accent,
    fontSize: 10,
    fontWeight: '600',
  },
  digitsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
  digitCell: {
    alignItems: 'center',
    minWidth: 52,
  },
  digitLarge: {
    color: colors.accent,
    fontSize: 36,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    letterSpacing: -1,
    lineHeight: 40,
  },
  digit: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    lineHeight: 34,
  },
  digitMuted: {
    color: colors.text3,
    fontSize: 24,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    lineHeight: 28,
  },
  digitLabel: {
    color: colors.text3,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: 4,
  },
  separator: {
    color: colors.text3,
    fontSize: 24,
    fontWeight: '200',
    marginTop: -14,
  },
  activeLabel: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  boardDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.lg,
    alignSelf: 'stretch',
  },
  boardButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#3d2416',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignSelf: 'stretch',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  boardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  boardIconCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,250,240,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(255,250,240,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  boardTextCol: {
    gap: 1,
  },
  boardEyebrow: {
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.16 * 9.5,
    color: 'rgba(255,250,240,0.85)',
  },
  boardLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,250,240,0.95)',
  },
});
