import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { useTheme } from '@/constants/ThemeContext';

import { PAPER, SERIF } from './feedTheme';

export type FeedTab = 'your' | 'public' | 'newsfeed';

interface FeedHeaderProps {
  activeTab: FeedTab;
  onTabChange: (tab: FeedTab) => void;
}

const TABS: { id: FeedTab; label: string }[] = [
  { id: 'your', label: 'Your Trip' },
  { id: 'public', label: 'Public' },
  { id: 'newsfeed', label: 'Newsfeed AS' },
];

export function FeedHeader({ activeTab, onTabChange }: FeedHeaderProps) {
  const { colors } = useTheme();
  const isPaper = activeTab !== 'your';

  // Use paper colors on Public/Newsfeed, theme colors on Your Trip
  const textColor = isPaper ? PAPER.inkDark : colors.text;
  const borderColor = isPaper ? PAPER.rule : colors.border;
  const bgColor = isPaper ? PAPER.ivory : colors.bg;

  return (
    <View style={[styles.container, { borderBottomColor: borderColor, backgroundColor: bgColor }]}>
      <Text style={[styles.title, { color: textColor }]}>Moments</Text>
      <View style={styles.tabRow}>
        {TABS.map(({ id, label }) => {
          const active = activeTab === id;
          return (
            <TouchableOpacity
              key={id}
              onPress={() => onTabChange(id)}
              activeOpacity={0.7}
              style={[styles.tab, active && { borderBottomColor: textColor }]}
            >
              <Text style={[
                styles.tabText,
                { color: textColor },
                active && styles.tabTextActive,
              ]}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: {
    textAlign: 'center',
    fontFamily: SERIF,
    fontSize: 30,
    letterSpacing: -0.5,
    lineHeight: 34,
  },
  tabRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    marginTop: 14,
  },
  tab: {
    paddingBottom: 4,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '400',
    letterSpacing: 0.2,
  },
  tabTextActive: {
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
