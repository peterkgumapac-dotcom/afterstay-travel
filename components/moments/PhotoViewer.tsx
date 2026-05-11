import React from 'react';
import { Stack } from 'expo-router';

import { PhotoCarousel } from './PhotoCarousel';
import type { PhotoAction } from './PhotoActionsSheet';
import type { MomentDisplay, PeopleMap } from './types';

interface PhotoViewerProps {
  moments: MomentDisplay[];
  initialIndex: number;
  people: PeopleMap;
  onClose: () => void;
  onFavorite?: (id: string) => void;
  onAction?: (action: PhotoAction, moment: MomentDisplay) => void;
}

/** Route wrapper around the shared fullscreen photo carousel. */
export function PhotoViewer({
  moments,
  initialIndex,
  people,
  onClose,
  onFavorite,
  onAction,
}: PhotoViewerProps) {
  return (
    <>
      <Stack.Screen
        options={{
          presentation: 'fullScreenModal',
          animation: 'slide_from_bottom',
          headerShown: false,
          contentStyle: { backgroundColor: '#000' },
        }}
      />
      <PhotoCarousel
        moments={moments}
        initialIndex={initialIndex}
        people={people}
        onClose={onClose}
        onFavorite={onFavorite}
        onAction={onAction}
      />
    </>
  );
}
