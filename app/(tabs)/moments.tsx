import { useRouter } from 'expo-router';
import { Plus } from 'lucide-react-native';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MomentsTab } from '@/components/moments/MomentsTab';
import { useTheme } from '@/constants/ThemeContext';

export default function MomentsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={[styles.container, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
      <MomentsTab />

      {/* FAB to add moment */}
      <Pressable
        onPress={() => router.push('/add-moment' as never)}
        style={[styles.fab, { backgroundColor: colors.accent, bottom: insets.bottom + 80 }]}
        accessibilityRole="button"
        accessibilityLabel="Add moment"
      >
        <Plus size={24} color={colors.bg} strokeWidth={2.5} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  fab: {
    position: 'absolute',
    right: 20,
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
});
