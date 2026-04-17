import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import MomentForm from '@/components/MomentForm';
import { colors, radius, spacing } from '@/constants/theme';
import { addMoment } from '@/lib/notion';
import type { MomentTag } from '@/lib/types';

export default function AddMomentScreen() {
  const router = useRouter();
  const [photoUri, setPhotoUri] = useState<string | null>(null);

  useEffect(() => {
    pickImage();
  }, []);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });

    if (result.canceled) {
      router.back();
      return;
    }

    setPhotoUri(result.assets[0].uri);
  };

  const handleSave = async (data: {
    caption: string;
    location: string;
    tags: MomentTag[];
    takenBy: string;
    date: string;
  }) => {
    try {
      // For now, save the local file URI as the photo URL.
      // TODO: Add imgbb or similar image hosting upload here for cloud persistence.
      await addMoment({
        caption: data.caption,
        photo: photoUri ?? undefined,
        location: data.location || undefined,
        takenBy: data.takenBy || undefined,
        date: data.date,
        tags: data.tags,
      });
      router.back();
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to save moment.');
    }
  };

  const handleCancel = () => {
    router.back();
  };

  if (!photoUri) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.loadingText}>Selecting photo...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <MomentForm
        photoUri={photoUri}
        onSave={handleSave}
        onCancel={handleCancel}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  centered: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: colors.text2,
    fontSize: 13,
  },
});
