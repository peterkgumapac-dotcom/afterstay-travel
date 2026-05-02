import { useCallback } from 'react';
import { Alert, Share } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system/legacy';

import { PhotoViewer } from '@/components/moments/PhotoViewer';
import type { PhotoAction } from '@/components/moments/PhotoActionsSheet';
import type { MomentDisplay, PeopleMap } from '@/components/moments/types';
import { shareMomentToGroup, deleteMoment, toggleMomentVisibility } from '@/lib/supabase';

export default function PhotoViewerRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{ moments: string; initialIndex: string; people: string }>();

  const moments: MomentDisplay[] = params.moments ? JSON.parse(params.moments) : [];
  const initialIndex = params.initialIndex ? Number(params.initialIndex) : 0;
  const people: PeopleMap = params.people ? JSON.parse(params.people) : {};

  const handleAction = useCallback(async (action: PhotoAction, moment: MomentDisplay) => {
    switch (action) {
      case 'share': {
        Alert.alert('Share Photo', '', [
          {
            text: 'Share with Group',
            onPress: async () => {
              try {
                await shareMomentToGroup(moment.id);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                Alert.alert('Shared', 'Photo shared with your group');
              } catch (e: unknown) {
                Alert.alert('Error', e instanceof Error ? e.message : 'Could not share');
              }
            },
          },
          {
            text: 'Share Externally',
            onPress: () => {
              if (!moment.photo) return;
              Share.share({
                message: [moment.caption, moment.location].filter(Boolean).join(' — '),
                url: moment.photo,
              });
            },
          },
          { text: 'Cancel', style: 'cancel' },
        ]);
        break;
      }

      case 'share-hd': {
        const url = moment.hdPhoto ?? moment.photo;
        if (!url) return;
        Share.share({ url });
        break;
      }

      case 'download-hd': {
        try {
          const url = moment.hdPhoto ?? moment.photo;
          if (!url) return;
          const { status } = await MediaLibrary.requestPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert('Permission needed', 'Allow photo library access to save photos');
            return;
          }
          const filename = url.split('/').pop() ?? 'photo.jpg';
          const localUri = `${FileSystem.cacheDirectory}${filename}`;
          await FileSystem.downloadAsync(url, localUri);
          await MediaLibrary.saveToLibraryAsync(localUri);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          Alert.alert('Saved', 'Photo saved to your gallery');
        } catch {
          Alert.alert('Error', 'Could not save photo');
        }
        break;
      }

      case 'archive': {
        try {
          const newVis = await toggleMomentVisibility(moment.id);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          Alert.alert(newVis === 'private' ? 'Archived' : 'Unarchived', newVis === 'private' ? 'Photo is now private' : 'Photo is now shared');
        } catch (e: unknown) {
          Alert.alert('Error', e instanceof Error ? e.message : 'Could not archive');
        }
        break;
      }

      case 'delete': {
        Alert.alert('Delete Photo', 'This cannot be undone.', [
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                await deleteMoment(moment.id);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                router.back();
              } catch (e: unknown) {
                Alert.alert('Error', e instanceof Error ? e.message : 'Could not delete');
              }
            },
          },
          { text: 'Cancel', style: 'cancel' },
        ]);
        break;
      }

      case 'reel':
      case 'edit':
        break;
    }
  }, [router]);

  return (
    <PhotoViewer
      moments={moments}
      initialIndex={initialIndex}
      people={people}
      onClose={() => router.back()}
      onAction={handleAction}
    />
  );
}
