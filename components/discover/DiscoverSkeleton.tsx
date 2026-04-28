import { View, StyleSheet } from 'react-native';
import { Skeleton, SkeletonRow } from '@/components/shared/Skeleton';

export function DiscoverSkeleton() {
  return (
    <View style={s.container}>
      {/* Search bar */}
      <Skeleton width="100%" height={44} borderRadius={12} style={s.search} />

      {/* Category chips */}
      <SkeletonRow style={s.chips}>
        <Skeleton width={50} height={32} borderRadius={999} />
        <Skeleton width={60} height={32} borderRadius={999} />
        <Skeleton width={55} height={32} borderRadius={999} />
        <Skeleton width={65} height={32} borderRadius={999} />
        <Skeleton width={70} height={32} borderRadius={999} />
      </SkeletonRow>

      {/* Place cards */}
      {[0, 1, 2].map((i) => (
        <SkeletonRow key={i} style={s.card}>
          <Skeleton width={90} height={90} borderRadius={12} />
          <View style={s.cardContent}>
            <Skeleton width={140} height={14} />
            <Skeleton width={100} height={10} />
            <Skeleton width={120} height={10} />
            <SkeletonRow gap={6}>
              <Skeleton width={60} height={24} borderRadius={8} />
              <Skeleton width={60} height={24} borderRadius={8} />
            </SkeletonRow>
          </View>
        </SkeletonRow>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  container: { paddingHorizontal: 16, paddingTop: 8 },
  search: { marginBottom: 12 },
  chips: { marginBottom: 16, gap: 8 },
  card: { marginBottom: 12, gap: 12, alignItems: 'flex-start' },
  cardContent: { flex: 1, gap: 8, paddingTop: 4 },
});
