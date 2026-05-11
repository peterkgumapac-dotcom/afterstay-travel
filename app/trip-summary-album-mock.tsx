import React, { useMemo } from 'react';
import { Alert, ScrollView, Share, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import TripAlbumPreview, { mockTripAlbumData } from '@/components/summary/TripAlbumPreview';
import { useTheme } from '@/constants/ThemeContext';

export default function TripSummaryAlbumMockScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    scroll: {
      paddingHorizontal: 20,
      paddingBottom: 28,
    },
  }), [colors]);

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <TripAlbumPreview
          data={mockTripAlbumData}
          colors={colors}
          onBack={() => router.back()}
          onOpenAlbum={() => Alert.alert('Mock album', 'This opens the real photo browser after data wiring.')}
          onAddPhoto={() => Alert.alert('Mock album', 'Add Photo is disabled in the mock preview.')}
          onOpenPhoto={(photo) => {
            Share.share({
              message: [photo.caption, photo.location].filter(Boolean).join(' — '),
              url: photo.uri,
            });
          }}
        />
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}
