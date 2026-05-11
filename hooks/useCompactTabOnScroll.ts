import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

import { type CompactTabName, useTabBarVisibility } from '@/app/(tabs)/_layout';

export function useCompactTabOnScroll(_tab: CompactTabName) {
  const { setVisible, setFabVisible, setCompactTab } = useTabBarVisibility();

  const restoreTabBar = useCallback(() => {
    setCompactTab(null);
    setVisible(true);
    setFabVisible(true);
  }, [setCompactTab, setFabVisible, setVisible]);

  useFocusEffect(
    useCallback(() => {
      restoreTabBar();
      return restoreTabBar;
    }, [restoreTabBar]),
  );

  const handleScrollY = useCallback((_value: number) => {}, []);

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    handleScrollY(event.nativeEvent.contentOffset.y);
  }, [handleScrollY]);

  return { handleScroll, handleScrollY, restoreTabBar };
}
