import { useCallback, useState } from 'react';
import { Alert, Share } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system/legacy';

import { PhotoViewer } from '@/components/moments/PhotoViewer';
import { PhotoEditSheet } from '@/components/moments/PhotoEditSheet';
import type { PhotoAction } from '@/components/moments/PhotoActionsSheet';
import type { MomentDisplay, PeopleMap } from '@/components/moments/types';
import { shareMomentToGroup, deleteMoment, toggleMomentVisibility, supabase } from '@/lib/supabase';

export default function PhotoViewerRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{ moments: string; initialIndex: string; people: string }>();

  const [moments, setMoments] = useState<MomentDisplay[]>(() => (
    params.moments ? JSON.parse(params.moments) : []
  ));
  const initialIndex = params.initialIndex ? Number(params.initialIndex) : 0;
  const people: PeopleMap = params.people ? JSON.parse(params.people) : {};
  const [editMoment, setEditMoment] = useState<MomentDisplay | null>(null);

  const handleEditSave = useCallback(async (id: string, updates: { caption?: string; location?: string }) => {
    const target = moments.find((m) => m.id === id);
    if (!target?.isMine) {
      Alert.alert('Read only', 'Only the uploader can edit this photo.');
      return;
    }
    try {
      const { error } = await supabase.from('moments').update({
        caption: updates.caption ?? null,
        location: updates.location ?? null,
      }).eq('id', id);
      if (error) throw error;
      setMoments((prev) =>
        prev.map((m) => m.id === id ? { ...m, caption: updates.caption ?? m.caption, location: updates.location ?? m.location } : m),
      );
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not update photo details');
    }
  }, [moments]);

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
          const filename = url.split('/').pop() ?? 'photo.jpg';
          const localUri = `${FileSystem.cacheDirectory}${filename}`;
          const download = await FileSystem.downloadAsync(url, localUri);
          try {
            await MediaLibrary.saveToLibraryAsync(download.uri);
          } catch {
            const { status } = await MediaLibrary.requestPermissionsAsync(true, ['photo']);
            if (status !== 'granted') {
              Alert.alert('Permission needed', 'Allow photo library access to save photos');
              return;
            }
            await MediaLibrary.saveToLibraryAsync(download.uri);
          }
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          Alert.alert('Saved', 'Photo saved to your gallery');
        } catch {
          Alert.alert('Error', 'Could not save photo');
        }
        break;
      }

      case 'archive': {
        if (!moment.isMine) {
          Alert.alert('Read only', 'Only the uploader can change photo visibility.');
          break;
        }
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
        if (!moment.isMine) {
          Alert.alert('Read only', 'Only the uploader can delete this photo.');
          break;
        }
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

      case 'edit-photo': {
        break;
      }

      case 'reel': {
        break;
      }

      case 'edit': {
        if (!moment.isMine) {
          Alert.alert('Read only', 'Only the uploader can edit this photo.');
          break;
        }
        setEditMoment(moment);
        break;
      }
    }
  }, [router]);

  return (
    <>
      <PhotoViewer
        moments={moments}
        initialIndex={initialIndex}
        people={people}
        onClose={() => router.back()}
        onAction={handleAction}
      />
      <PhotoEditSheet
        visible={editMoment !== null}
        moment={editMoment}
        onSave={handleEditSave}
        onClose={() => setEditMoment(null)}
      />
    </>
  );
}
