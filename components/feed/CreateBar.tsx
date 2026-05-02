import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Camera, PenLine, Plane, Wallet, BarChart3 } from 'lucide-react-native';

import { FEED } from './feedTheme';

export type CreateType = 'photo' | 'text' | 'trip' | 'budget' | 'summary';

interface CreateBarProps {
  onSelect: (type: CreateType) => void;
}

const ITEMS: { type: CreateType; label: string; Icon: React.ElementType }[] = [
  { type: 'photo', label: 'Photo', Icon: Camera },
  { type: 'text', label: 'Text', Icon: PenLine },
  { type: 'trip', label: 'Trip', Icon: Plane },
  { type: 'budget', label: 'Budget', Icon: Wallet },
  { type: 'summary', label: 'Summary', Icon: BarChart3 },
];

export function CreateBar({ onSelect }: CreateBarProps) {
  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {ITEMS.map(({ type, label, Icon }) => (
          <TouchableOpacity
            key={type}
            style={styles.chip}
            onPress={() => onSelect(type)}
            activeOpacity={0.7}
          >
            <Icon size={14} color={FEED.ink} strokeWidth={1.8} />
            <Text style={styles.chipText}>{label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: FEED.cardBorder,
    backgroundColor: FEED.card,
  },
  scroll: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: FEED.cardBorder,
    backgroundColor: '#faf8f4',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '500',
    color: FEED.ink,
    letterSpacing: 0.2,
  },
});
