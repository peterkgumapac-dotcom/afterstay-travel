import { View, StyleSheet } from 'react-native';
import { Skeleton, SkeletonRow } from '@/components/shared/Skeleton';

export function MomentsSkeleton() {
  return (
    <View style={s.container}>
      {/* Filter tabs */}
      <SkeletonRow style={s.tabs}>
        <Skeleton width={50} height={28} borderRadius={999} />
        <Skeleton width={60} height={28} borderRadius={999} />
        <Skeleton width={55} height={28} borderRadius={999} />
        <Skeleton width={70} height={28} borderRadius={999} />
      </SkeletonRow>

      {/* Date header */}
      <Skeleton width={80} height={12} style={s.dateHeader} />

      {/* Photo grid — 2 columns */}
      <View style={s.grid}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} width="48%" height={180} borderRadius={12} />
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { paddingHorizontal: 16, paddingTop: 8 },
  tabs: { marginBottom: 16, gap: 8 },
  dateHeader: { marginBottom: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
