import { useRouter } from 'expo-router';
import { Bell, Compass } from 'lucide-react-native';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/constants/ThemeContext';
import { spacing } from '@/constants/theme';

interface Props {
  userName: string;
  avatarUrl?: string;
}

export default function ProfileRow({ userName, avatarUrl }: Props) {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const router = useRouter();
  const firstName = userName.split(' ')[0];
  const initial = firstName.charAt(0).toUpperCase();

  return (
    <View style={styles.row}>
      <View style={styles.leftSide}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarFallback}>
            <Text style={styles.avatarInitial}>{initial}</Text>
          </View>
        )}
        <View>
          <Text style={styles.greeting}>Hey {firstName} {'\uD83D\uDC4B'}</Text>
          <Text style={styles.subtitle}>Ready for Boracay?</Text>
        </View>
      </View>

      <View style={styles.rightSide}>
        <Pressable
          onPress={() => {}}
          style={styles.iconButton}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Bell color={colors.text2} size={20} strokeWidth={2} />
        </Pressable>
        <Pressable
          onPress={() => router.push('/(tabs)/settings')}
          style={styles.iconButton}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Compass color={colors.text2} size={20} strokeWidth={2} />
        </Pressable>
      </View>
    </View>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  leftSide: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.card,
  },
  avatarFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accentDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    color: colors.accentLt,
    fontSize: 16,
    fontWeight: '700',
  },
  greeting: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '600',
  },
  subtitle: {
    color: colors.text3,
    fontSize: 12,
    marginTop: 1,
  },
  rightSide: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  iconButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: colors.bg2,
  },
});
