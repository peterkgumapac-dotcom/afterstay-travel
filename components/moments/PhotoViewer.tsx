import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Dimensions, Pressable } from 'react-native';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Heart, Share2, Download, MoreHorizontal } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { CachedImage } from '@/components/CachedImage';
import { PhotoCarousel } from './PhotoCarousel';
import { PhotoActionsSheet, type PhotoAction } from './PhotoActionsSheet';
import type { MomentDisplay, PeopleMap } from './types';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

interface PhotoViewerProps {
  moments: MomentDisplay[];
  initialIndex: number;
  people: PeopleMap;
  onClose: () => void;
  onFavorite?: (id: string) => void;
  onAction?: (action: PhotoAction, moment: MomentDisplay) => void;
}

/** Native sheet-presented photo viewer using Expo Router Stack + PhotoCarousel.
 *
 * Use this component inside a route configured with:
 *   presentation: 'fullScreenModal'
 *   sheetAllowedDetents: [1.0]
 *   sheetGrabberVisible: true
 *
 * Or call it directly as a modal overlay.
 */
export function PhotoViewer({
  moments,
  initialIndex,
  people,
  onClose,
  onFavorite,
  onAction,
}: PhotoViewerProps) {
  const insets = useSafeAreaInsets();
  const [actionsVisible, setActionsVisible] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(initialIndex);

  const current = moments[currentIdx];

  const handleIndexChange = useCallback((idx: number) => {
    setCurrentIdx(idx);
  }, []);

  const handleAction = useCallback(
    (action: PhotoAction) => {
      setActionsVisible(false);
      if (current && onAction) {
        onAction(action, current);
      }
    },
    [current, onAction],
  );

  return (
    <GestureHandlerRootView style={styles.root}>
      {/* Expo Router Stack screen options (when used as a route) */}
      <Stack.Screen
        options={{
          presentation: 'fullScreenModal',
          animation: 'slide_from_bottom',
          headerShown: false,
          contentStyle: { backgroundColor: '#000' },
        }}
      />

      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            onClose();
          }}
          style={styles.topBtn}
          accessibilityLabel="Close"
        >
          <ChevronLeft size={20} color="#fff" strokeWidth={2.5} />
        </Pressable>

        <View style={styles.counter}>
          <Text style={styles.counterText}>
            {currentIdx + 1} of {moments.length}
          </Text>
        </View>

        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            setActionsVisible(true);
          }}
          style={styles.topBtn}
          accessibilityLabel="More options"
        >
          <MoreHorizontal size={18} color="#fff" strokeWidth={1.8} />
        </Pressable>
      </View>

      {/* Carousel */}
      <PhotoCarousel
        moments={moments}
        initialIndex={initialIndex}
        people={people}
        onClose={onClose}
        onFavorite={onFavorite}
        onAction={onAction}
        onIndexChange={handleIndexChange}
      />

      {/* Bottom action bar */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
        <Pressable
          onPress={() => current && onFavorite?.(current.id)}
          style={styles.bottomBtn}
        >
          <Heart
            size={22}
            color={current?.isFavorited ? '#e55' : '#fff'}
            fill={current?.isFavorited ? '#e55' : 'transparent'}
            strokeWidth={2}
          />
        </Pressable>

        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            if (current && onAction) onAction('share', current);
          }}
          style={styles.bottomBtn}
        >
          <Share2 size={22} color="#fff" strokeWidth={2} />
        </Pressable>

        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            if (current && onAction) onAction('reel', current);
          }}
          style={styles.bottomBtn}
        >
          <Download size={22} color="#fff" strokeWidth={2} />
        </Pressable>
      </View>

      {/* Actions Sheet */}
      <PhotoActionsSheet
        visible={actionsVisible}
        onAction={handleAction}
        onClose={() => setActionsVisible(false)}
        photoId={current?.id ?? ''}
      />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
    zIndex: 10,
  },
  topBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  counter: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  counterText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 32,
    paddingTop: 16,
    paddingHorizontal: 16,
    zIndex: 10,
  },
  bottomBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
