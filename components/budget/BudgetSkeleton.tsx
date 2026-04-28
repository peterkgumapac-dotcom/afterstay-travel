import { View, StyleSheet } from 'react-native';
import { Skeleton, SkeletonRow } from '@/components/shared/Skeleton';

export function BudgetSkeleton() {
  return (
    <View style={s.container}>
      {/* Banner */}
      <Skeleton width="100%" height={80} borderRadius={16} style={s.banner} />

      {/* Category bars */}
      {[0, 1, 2, 3].map((i) => (
        <SkeletonRow key={i} style={s.catRow}>
          <Skeleton width={32} height={32} borderRadius={10} />
          <View style={{ flex: 1, gap: 6 }}>
            <Skeleton width={100} height={12} />
            <Skeleton width="80%" height={8} borderRadius={4} />
          </View>
          <Skeleton width={70} height={12} />
        </SkeletonRow>
      ))}

      {/* Expense rows */}
      <Skeleton width={120} height={10} style={s.label} />
      {[0, 1, 2, 3, 4].map((i) => (
        <SkeletonRow key={i} style={s.expRow}>
          <View style={{ flex: 1, gap: 4 }}>
            <Skeleton width={160} height={13} />
            <Skeleton width={100} height={10} />
          </View>
          <Skeleton width={70} height={14} />
        </SkeletonRow>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  container: { paddingHorizontal: 16, paddingTop: 8 },
  banner: { marginBottom: 16 },
  catRow: { marginBottom: 14, alignItems: 'center', gap: 12 },
  label: { marginTop: 8, marginBottom: 12 },
  expRow: { marginBottom: 16, alignItems: 'center', gap: 12 },
});
