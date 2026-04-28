import { useLocalSearchParams, useRouter } from 'expo-router';
import { PhotoViewer } from '@/components/moments/PhotoViewer';
import type { MomentDisplay, PeopleMap } from '@/components/moments/types';

/**
 * Photo Viewer route — native sheet presentation.
 *
 * Navigate here with:
 *   router.push({
 *     pathname: '/photo-viewer',
 *     params: {
 *       moments: JSON.stringify(moments),
 *       initialIndex: String(index),
 *       people: JSON.stringify(people),
 *     }
 *   })
 *
 * Or use Stack.Screen options directly in the parent layout:
 *   <Stack.Screen
 *     name="photo-viewer"
 *     options={{
 *       presentation: 'fullScreenModal',
 *       sheetAllowedDetents: [1.0],
 *       sheetGrabberVisible: false,
 *       headerShown: false,
 *     }}
 *   />
 */
export default function PhotoViewerRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{ moments: string; initialIndex: string; people: string }>();

  const moments: MomentDisplay[] = params.moments ? JSON.parse(params.moments) : [];
  const initialIndex = params.initialIndex ? Number(params.initialIndex) : 0;
  const people: PeopleMap = params.people ? JSON.parse(params.people) : {};

  return (
    <PhotoViewer
      moments={moments}
      initialIndex={initialIndex}
      people={people}
      onClose={() => router.back()}
    />
  );
}
