import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import {
  getDiscoverTabLabel,
  getDiscoverTabs,
  type TabId,
} from '@/features/discover/lib/screenConfig';

import type { getDiscoverStyles } from './discoverScreenStyles';

type DiscoverStyles = ReturnType<typeof getDiscoverStyles>;

interface Props {
  activeTab: TabId;
  hasTrip: boolean;
  savedCount: number;
  wishlistCount: number;
  styles: DiscoverStyles;
  onTabChange: (tab: TabId) => void;
}

export default function DiscoverTabSwitcher({
  activeTab,
  hasTrip,
  savedCount,
  wishlistCount,
  styles,
  onTabChange,
}: Props) {
  return (
    <View style={styles.segWrapper}>
      <View style={styles.seg}>
        {getDiscoverTabs(hasTrip).map((id) => {
          const active = activeTab === id;
          const label = getDiscoverTabLabel(id, { hasTrip, savedCount, wishlistCount });
          return (
            <TouchableOpacity
              key={id}
              style={[styles.segBtn, active && styles.segBtnActive]}
              onPress={() => onTabChange(id)}
              activeOpacity={0.7}
            >
              <Text style={[styles.segText, active && styles.segTextActive]}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}
