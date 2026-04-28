import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/constants/ThemeContext';
import { Skeleton, SkeletonRow } from '@/components/shared/Skeleton';

export function HomeSkeleton() {
  const { colors } = useTheme();
  return (
    <SafeAreaView style={[s.safe, { backgroundColor: colors.bg }]} edges={['top']}>
      {/* Profile row */}
      <SkeletonRow style={s.profileRow}>
        <Skeleton width={36} height={36} borderRadius={18} />
        <View style={{ flex: 1, gap: 4 }}>
          <Skeleton width={120} height={12} />
          <Skeleton width={80} height={10} />
        </View>
        <Skeleton width={36} height={36} borderRadius={18} />
      </SkeletonRow>

      {/* Hero */}
      <Skeleton width="100%" height={220} borderRadius={20} style={s.hero} />

      {/* Phase card */}
      <View style={s.section}>
        <Skeleton width="100%" height={120} borderRadius={20} />
      </View>

      {/* Section header */}
      <SkeletonRow style={s.sectionHeader}>
        <Skeleton width={100} height={10} />
        <Skeleton width={60} height={10} />
      </SkeletonRow>

      {/* Card row */}
      <SkeletonRow style={s.cardRow}>
        <Skeleton width={140} height={100} borderRadius={14} />
        <Skeleton width={140} height={100} borderRadius={14} />
        <Skeleton width={140} height={100} borderRadius={14} />
      </SkeletonRow>

      {/* Another section */}
      <SkeletonRow style={s.sectionHeader}>
        <Skeleton width={80} height={10} />
      </SkeletonRow>
      <Skeleton width="100%" height={80} borderRadius={16} style={s.section} />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  profileRow: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8, alignItems: 'center' },
  hero: { marginHorizontal: 16, marginBottom: 14 },
  section: { paddingHorizontal: 16, marginBottom: 14 },
  sectionHeader: { paddingHorizontal: 20, marginBottom: 10, justifyContent: 'space-between' },
  cardRow: { paddingHorizontal: 16, marginBottom: 14 },
});
