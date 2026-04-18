import { useRouter } from 'expo-router';
import { Settings } from 'lucide-react-native';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '@/constants/theme';

interface Props {
  userName: string;
  avatarUrl?: string;
}

export default function ProfileRow({ userName, avatarUrl }: Props) {
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
        <Text style={styles.greeting}>Hey {firstName}</Text>
      </View>

      <Pressable
        onPress={() => router.push('/(tabs)/settings')}
        style={styles.gearButton}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <Settings color={colors.text2} size={22} strokeWidth={2} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
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
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.card,
  },
  avatarFallback: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.accentDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    color: colors.accentLt,
    fontSize: 15,
    fontWeight: '700',
  },
  greeting: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '600',
  },
  gearButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
