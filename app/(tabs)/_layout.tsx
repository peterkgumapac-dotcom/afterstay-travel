// Note: guide and settings are routable screens outside the tab bar.
// They are configured as hidden triggers below per NativeTabs requirements.
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import React, { createContext, useContext, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FloatingActionButton } from '@/components/shared/FloatingActionButton';
import { useTheme } from '@/constants/ThemeContext';
import { useUserSegment } from '@/contexts/UserSegmentContext';

/* ---------- Tab bar visibility context (kept for backward compat) ---------- */

interface TabBarVisibilityContextValue {
  visible: boolean;
  setVisible: (v: boolean) => void;
  fabVisible: boolean;
  setFabVisible: (v: boolean) => void;
  compactTab: CompactTabName | null;
  setCompactTab: (tab: CompactTabName | null) => void;
}

const TabBarVisibilityContext = createContext<TabBarVisibilityContextValue>({
  visible: true,
  setVisible: () => {},
  fabVisible: true,
  setFabVisible: () => {},
  compactTab: null,
  setCompactTab: () => {},
});

export function useTabBarVisibility(): TabBarVisibilityContextValue {
  return useContext(TabBarVisibilityContext);
}

/* ---------- Icon mapping: lucide → MaterialCommunityIcons ---------- */

export type CompactTabName = 'home' | 'moments' | 'discover' | 'budget' | 'trip';

const TAB_ICON_MAP: Record<CompactTabName, keyof typeof MaterialCommunityIcons.glyphMap> = {
  home: 'home-outline',
  moments: 'camera-outline',
  discover: 'compass-outline',
  budget: 'wallet-outline',
  trip: 'airplane',
};

const TAB_LABELS: Record<CompactTabName, string> = {
  home: 'Home',
  moments: 'Moments',
  discover: 'Discover',
  budget: 'Budget',
  trip: 'My Trips',
};

/* ---------- Native Tabs Layout ---------- */

export default function TabLayout() {
  const { colors } = useTheme();
  const [tabBarVisible, setTabBarVisible] = useState(true);
  const [fabVisible, setFabVisible] = useState(true);
  const [compactTab, setCompactTab] = useState<CompactTabName | null>(null);

  const visibilityValue = useMemo(
    () => ({
      visible: tabBarVisible,
      setVisible: setTabBarVisible,
      fabVisible,
      setFabVisible,
      compactTab,
      setCompactTab,
    }),
    [tabBarVisible, fabVisible, compactTab],
  );

  return (
      <TabBarVisibilityContext.Provider value={visibilityValue}>
        <NativeTabs
          backgroundColor={colors.card}
          tintColor={colors.accent}
          iconColor={{ default: colors.text3, selected: colors.accent }}
          blurEffect="systemChromeMaterial"
          shadowColor={colors.border}
          hidden={!tabBarVisible}
          minimizeBehavior="onScrollDown"
        >
          <NativeTabs.Trigger name="home">
            <NativeTabs.Trigger.Icon
              src={
                <NativeTabs.Trigger.VectorIcon
                  family={MaterialCommunityIcons}
                  name={TAB_ICON_MAP.home}
                />
              }
            />
            <NativeTabs.Trigger.Label>{TAB_LABELS.home}</NativeTabs.Trigger.Label>
          </NativeTabs.Trigger>

          <NativeTabs.Trigger name="moments">
            <NativeTabs.Trigger.Icon
              src={
                <NativeTabs.Trigger.VectorIcon
                  family={MaterialCommunityIcons}
                  name={TAB_ICON_MAP.moments}
                />
              }
            />
            <NativeTabs.Trigger.Label>{TAB_LABELS.moments}</NativeTabs.Trigger.Label>
          </NativeTabs.Trigger>

          <NativeTabs.Trigger name="discover">
            <NativeTabs.Trigger.Icon
              src={
                <NativeTabs.Trigger.VectorIcon
                  family={MaterialCommunityIcons}
                  name={TAB_ICON_MAP.discover}
                />
              }
            />
            <NativeTabs.Trigger.Label>{TAB_LABELS.discover}</NativeTabs.Trigger.Label>
          </NativeTabs.Trigger>

          <NativeTabs.Trigger name="budget">
            <NativeTabs.Trigger.Icon
              src={
                <NativeTabs.Trigger.VectorIcon
                  family={MaterialCommunityIcons}
                  name={TAB_ICON_MAP.budget}
                />
              }
            />
            <NativeTabs.Trigger.Label>{TAB_LABELS.budget}</NativeTabs.Trigger.Label>
          </NativeTabs.Trigger>

          <NativeTabs.Trigger name="trip">
            <NativeTabs.Trigger.Icon
              src={
                <NativeTabs.Trigger.VectorIcon
                  family={MaterialCommunityIcons}
                  name={TAB_ICON_MAP.trip}
                />
              }
            />
            <NativeTabs.Trigger.Label>{TAB_LABELS.trip}</NativeTabs.Trigger.Label>
          </NativeTabs.Trigger>

          {/* Hidden tabs — still routable but not shown in tab bar */}
          <NativeTabs.Trigger name="guide" hidden>
            <NativeTabs.Trigger.Label>Guide</NativeTabs.Trigger.Label>
          </NativeTabs.Trigger>
        </NativeTabs>

        {/* Global FAB — rendered above native tabs */}
        {tabBarVisible && fabVisible && <FloatingActionButton />}
        {!tabBarVisible && compactTab && (
          <CompactTabShortcut
            tab={compactTab}
            onPress={() => {
              setCompactTab(null);
              setTabBarVisible(true);
              setFabVisible(true);
            }}
          />
        )}
        <TestModeBanner />
      </TabBarVisibilityContext.Provider>
  );
}

function CompactTabShortcut({
  tab,
  onPress,
}: {
  tab: CompactTabName;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Show ${TAB_LABELS[tab]} tab bar`}
      onPress={onPress}
      style={[
        compactTabStyles.button,
        {
          bottom: Math.max(insets.bottom, 16) + 16,
          backgroundColor: colors.card,
          shadowColor: colors.accent,
        },
      ]}
    >
      <MaterialCommunityIcons
        name={TAB_ICON_MAP[tab]}
        size={30}
        color={colors.accent}
      />
    </Pressable>
  );
}

/* ---------- Test Mode Banner ---------- */

function TestModeBanner() {
  const { isTestMode, mockKeyLabel } = useUserSegment();
  const insets = useSafeAreaInsets();
  if (!isTestMode) return null;
  return (
    <View style={[testStyles.banner, { top: insets.top }]}>
      <Text style={testStyles.text}>
        TEST: {mockKeyLabel ?? 'unknown'}
      </Text>
    </View>
  );
}

const testStyles = StyleSheet.create({
  banner: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 9999,
    backgroundColor: '#c4554a',
    paddingVertical: 4,
    alignItems: 'center',
  },
  text: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
});

const compactTabStyles = StyleSheet.create({
  button: {
    position: 'absolute',
    left: 64,
    zIndex: 9000,
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.16,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
});
