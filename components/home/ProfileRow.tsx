import { useRouter } from 'expo-router';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { useTheme } from '@/constants/ThemeContext';

interface Props {
  userName: string;
  avatarUrl?: string;
  tripLabel?: string;
}

export default function ProfileRow({
  userName,
  avatarUrl,
  tripLabel = 'Boracay trip',
}: Props) {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const router = useRouter();
  const firstName = userName.split(' ')[0];
  const initial = firstName.charAt(0).toUpperCase();

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
          <Text style={styles.subtitle}>
            Hey {firstName} {'\u00B7'} {tripLabel}
          </Text>
        </View>
      </View>

      {/* Right: bell + avatar */}
      <View style={styles.rightSide}>
        <Pressable
          onPress={() => {}}
          style={styles.iconButton}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
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
        </Pressable>
        <Pressable
          onPress={() => router.push('/(tabs)/settings')}
          style={styles.avatarButton}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
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
        </Pressable>
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
      width: 36,
      height: 36,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 18,
    },
    avatarButton: {
      width: 32,
      height: 32,
      borderRadius: 999,
    },
    avatar: {
      width: 32,
      height: 32,
      borderRadius: 999,
    },
    avatarFallback: {
      width: 32,
      height: 32,
      borderRadius: 999,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarInitial: {
      color: '#fff',
      fontSize: 12,
      fontWeight: '600',
    },
  });
