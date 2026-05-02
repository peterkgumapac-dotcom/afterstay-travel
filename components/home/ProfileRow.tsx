import { useMemo } from 'react';
import { useRouter } from 'expo-router';
import { Image, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { useTheme } from '@/constants/ThemeContext';
import { AnimatedPressable } from '@/components/shared/AnimatedPressable';

interface Props {
  userName: string;
  avatarUrl?: string;
  tripLabel?: string;
  notificationCount?: number;
  onBellPress?: () => void;
}

export default function ProfileRow({
  userName,
  avatarUrl,
  tripLabel = 'My trip',
  notificationCount = 0,
  onBellPress,
}: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const router = useRouter();
  const firstName = userName.split(' ')[0];
  const initial = firstName.charAt(0).toUpperCase();

  const goToSettings = () => {
    if (__DEV__) console.log('[ProfileRow] Settings tapped');
    router.push('/settings');
  };

  return (
    <View style={styles.row}>
      {/* Left: constellation logo + brand text */}
      <View style={styles.leftSide}>
        <Svg width={34} height={34} viewBox="0 0 64 64" fill="none">
          {/* Outer circle */}
          <Circle
            cx={32}
            cy={32}
            r={29}
            stroke={colors.accent}
            strokeWidth={2}
            fill="none"
            opacity={0.95}
          />
          {/* Triangle / mountain */}
          <Path
            d="M32 12 L52 48 L12 48 Z"
            stroke={colors.accent}
            strokeWidth={2.2}
            strokeLinejoin="round"
            fill="none"
          />
          {/* Heartbeat / pulse line */}
          <Path
            d="M19 40 L24 40 L27 33 L31 46 L35 30 L38 40 L45 40"
            stroke={colors.accent}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </Svg>
        <View style={styles.brandTextCol}>
          <Text style={styles.brandName}>
            after
            <Text style={styles.brandAccent}>stay</Text>
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            Hey {firstName} {'\u00B7'} {tripLabel}
          </Text>
        </View>
      </View>

      {/* Right: bell + avatar (opens settings) */}
      <View style={styles.rightSide}>
        {/* Notifications bell */}
        <AnimatedPressable
          onPress={onBellPress}
          style={styles.iconButton}
          accessibilityLabel="Notifications"
          accessibilityRole="button"
        >
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
            <Path
              d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9"
              stroke={colors.text2}
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <Path
              d="M13.7 21a2 2 0 01-3.4 0"
              stroke={colors.text2}
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
          {notificationCount > 0 && (
            <View style={styles.badge} pointerEvents="none">
              <Text style={styles.badgeText}>{notificationCount > 9 ? '9+' : notificationCount}</Text>
            </View>
          )}
        </AnimatedPressable>

        {/* Avatar — opens settings */}
        <AnimatedPressable
          onPress={goToSettings}
          style={styles.avatarButton}
          accessibilityLabel="Profile"
          accessibilityRole="button"
        >
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarInitial}>{initial}</Text>
            </View>
          )}
        </AnimatedPressable>
      </View>
    </View>
  );
}

const getStyles = (colors: ReturnType<typeof import('@/constants/ThemeContext').useTheme>['colors']) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: 4,
      paddingBottom: 10,
    },
    leftSide: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      flex: 1,
      marginRight: 8,
    },
    brandTextCol: {
      flexDirection: 'column',
    },
    brandName: {
      color: colors.text,
      fontSize: 19,
      fontWeight: '600',
      letterSpacing: -0.025 * 19,
    },
    brandAccent: {
      color: colors.accent,
      fontStyle: 'italic',
      fontWeight: '500',
    },
    subtitle: {
      fontSize: 9,
      color: colors.text3,
      fontWeight: '600',
      letterSpacing: 0.18 * 9,
      marginTop: 3,
      textTransform: 'uppercase',
    },
    rightSide: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    iconButton: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 22,
    },
    badge: {
      position: 'absolute',
      top: 6,
      right: 4,
      minWidth: 16,
      height: 16,
      borderRadius: 8,
      backgroundColor: colors.danger,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 3,
    },
    badgeText: {
      color: '#fff',
      fontSize: 9,
      fontWeight: '800',
      lineHeight: 12,
    },
    avatarButton: {
      width: 44,
      height: 44,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatar: {
      width: 36,
      height: 36,
      borderRadius: 999,
    },
    avatarFallback: {
      width: 36,
      height: 36,
      borderRadius: 999,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarInitial: {
      color: '#fff',
      fontSize: 14,
      fontWeight: '600',
    },
  });
