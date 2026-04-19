import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import MomentForm from '@/components/MomentForm';
import { useTheme } from '@/constants/ThemeContext';
import { addMoment } from '@/lib/supabase';
import type { MomentTag } from '@/lib/types';

export default function AddMomentScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [allPhotos, setAllPhotos] = useState<string[]>([]);

  useEffect(() => {
    pickImages();
  }, []);

  const pickImages = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsMultipleSelection: true,
      selectionLimit: 10,
    });

    if (result.canceled || result.assets.length === 0) {
      router.back();
      return;
    }

    const uris = result.assets.map((a) => a.uri);
    setAllPhotos(uris);
    setPhotoUri(uris[0]);
  };

  const handleSave = async (data: {
    caption: string;
    location: string;
    tags: MomentTag[];
    takenBy: string;
    date: string;
  }) => {
    try {
      // Upload and save each photo as a separate moment
      for (const uri of allPhotos) {
        await addMoment({
          caption: data.caption,
          localUri: uri,
          location: data.location || undefined,
          takenBy: data.takenBy || undefined,
          date: data.date,
          tags: data.tags,
        });
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to save moment.');
    }
  };

  if (!photoUri) {
    return (
      <SafeAreaView style={[styles.centered, { backgroundColor: colors.bg }]}>
        <Text style={[styles.loadingText, { color: colors.text2 }]}>Selecting photos...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['top']}>
      <MomentForm
        photoUri={photoUri}
        onSave={handleSave}
        onCancel={() => router.back()}
      />
      {allPhotos.length > 1 && (
        <Text style={[styles.multiInfo, { color: colors.text2 }]}>
          {allPhotos.length} photos selected — same details will apply to all
        </Text>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { fontSize: 13 },
  multiInfo: {
    fontSize: 12,
    textAlign: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
});
