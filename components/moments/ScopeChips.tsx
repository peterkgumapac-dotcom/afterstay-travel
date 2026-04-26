import React from 'react';
import { ScrollView, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/constants/ThemeContext';

export type ScopeFilter = 'all' | 'group' | 'me' | 'album' | 'favorites';

interface ScopeChipsProps {
  active: ScopeFilter;
  onChange: (scope: ScopeFilter) => void;
  counts: Record<ScopeFilter, number>;
}

const SCOPES: { id: ScopeFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'group', label: 'Group' },
  { id: 'me', label: 'Just me' },
  { id: 'favorites', label: 'Favorites' },
  { id: 'album', label: 'Album' },
];

export function ScopeChips({ active, onChange, counts }: ScopeChipsProps) {
  const { colors } = useTheme();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
      style={styles.scrollView}
    >
      {SCOPES.map((s) => {
        const isActive = active === s.id;
        const count = counts[s.id] ?? 0;
        // Always show All, Album (entry to albums grid), and Favorites; hide others if empty
        if (s.id !== 'all' && s.id !== 'album' && s.id !== 'favorites' && count === 0) return null;
        return (
          <TouchableOpacity
            key={s.id}
            onPress={() => onChange(s.id)}
            activeOpacity={0.7}
            style={[
              styles.chip,
              {
                backgroundColor: isActive ? colors.accent : 'transparent',
                borderColor: isActive ? colors.accent : colors.border,
              },
            ]}
          >
            <Text
              style={[
                styles.label,
                { color: isActive ? colors.onBlack : colors.text2 },
              ]}
            >
              {s.label}
            </Text>
            <Text
              style={[
                styles.count,
                {
                  color: isActive ? colors.onBlack : colors.text3,
                  opacity: isActive ? 0.78 : 0.55,
                },
              ]}
            >
              {count}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: { flexGrow: 0 },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 6,
    flexDirection: 'row',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
  },
  label: {
    fontSize: 11.5,
    fontWeight: '600',
    letterSpacing: 0.1,
    textTransform: 'uppercase',
  },
  count: {
    fontSize: 10,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
});
