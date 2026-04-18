import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Pressable } from 'react-native';
import { ArrowUpDown, Clock, Star, SlidersHorizontal, Check } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { Filters, countActiveFilters } from '../../lib/filters';
import { colors } from '@/constants/theme';

interface Props {
  filters: Filters;
  onUpdate: (next: Partial<Filters>) => void;
  onOpenMore: () => void;
}

export const FilterBar: React.FC<Props> = ({ filters, onUpdate, onOpenMore }) => {
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const activeCount = countActiveFilters(filters);

  const tapChip = (action: () => void) => {
    Haptics.selectionAsync();
    action();
  };

  return (
    <>
      <View style={styles.bar}>
        {/* Sort chip with dropdown indicator */}
        <TouchableOpacity
          style={[styles.chip, styles.chipSort]}
          onPress={() => tapChip(() => setSortMenuOpen(true))}
        >
          <ArrowUpDown color={colors.accent} size={13} strokeWidth={2.5} />
          <Text style={styles.chipTextActive}>
            {filters.sortBy === 'distance' ? 'Distance' : 'Rating'}
          </Text>
        </TouchableOpacity>

        {/* Open now */}
        <TouchableOpacity
          style={[styles.chip, filters.openNow && styles.chipActive]}
          onPress={() => tapChip(() => onUpdate({ openNow: !filters.openNow }))}
        >
          <Clock
            color={filters.openNow ? colors.accent : colors.text2}
            size={13}
            strokeWidth={2}
          />
          <Text style={filters.openNow ? styles.chipTextActive : styles.chipText}>
            Open now
          </Text>
        </TouchableOpacity>

        {/* Min rating 4.0+ quick toggle */}
        <TouchableOpacity
          style={[styles.chip, filters.minRating >= 4.0 && styles.chipActive]}
          onPress={() => tapChip(() => onUpdate({
            minRating: filters.minRating >= 4.0 ? 0 : 4.0
          }))}
        >
          <Star
            color={filters.minRating >= 4.0 ? colors.accent : colors.text2}
            size={13}
            strokeWidth={2}
            fill={filters.minRating >= 4.0 ? colors.accent : 'transparent'}
          />
          <Text style={filters.minRating >= 4.0 ? styles.chipTextActive : styles.chipText}>
            4.0+
          </Text>
        </TouchableOpacity>

        {/* More — opens sheet */}
        <TouchableOpacity
          style={[styles.chip, activeCount > 0 && styles.chipActive]}
          onPress={() => tapChip(onOpenMore)}
        >
          <SlidersHorizontal
            color={activeCount > 0 ? colors.accent : colors.text2}
            size={13}
            strokeWidth={2}
          />
          <Text style={activeCount > 0 ? styles.chipTextActive : styles.chipText}>
            More
          </Text>
          {activeCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{activeCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Sort menu */}
      <Modal
        visible={sortMenuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setSortMenuOpen(false)}
      >
        <Pressable style={styles.menuBackdrop} onPress={() => setSortMenuOpen(false)}>
          <View style={styles.menu}>
            <Text style={styles.menuTitle}>Sort by</Text>
            {(['distance', 'rating'] as const).map(opt => (
              <TouchableOpacity
                key={opt}
                style={styles.menuItem}
                onPress={() => {
                  Haptics.selectionAsync();
                  onUpdate({ sortBy: opt });
                  setSortMenuOpen(false);
                }}
              >
                <Text style={[
                  styles.menuItemText,
                  filters.sortBy === opt && styles.menuItemTextActive,
                ]}>
                  {opt === 'distance' ? 'Distance (nearest first)' : 'Rating (highest first)'}
                </Text>
                {filters.sortBy === opt && (
                  <Check color={colors.accent} size={18} strokeWidth={2.5} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
    flexWrap: 'wrap',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border2,
  },
  chipSort: {
    borderColor: colors.accent,
    backgroundColor: colors.accentBg,
  },
  chipActive: {
    backgroundColor: colors.accentDim,
    borderColor: colors.accent,
  },
  chipText: {
    color: colors.text2,
    fontSize: 12,
    fontWeight: '600',
  },
  chipTextActive: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '700',
  },
  badge: {
    marginLeft: 2,
    backgroundColor: colors.accent,
    borderRadius: 8,
    minWidth: 16, height: 16,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: colors.bg,
    fontSize: 10,
    fontWeight: '800',
  },
  menuBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  menu: {
    backgroundColor: colors.bg2,
    borderRadius: 14,
    padding: 8,
    borderWidth: 1,
    borderColor: colors.border2,
  },
  menuTitle: {
    color: colors.text2,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderRadius: 8,
  },
  menuItemText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '500',
  },
  menuItemTextActive: {
    color: colors.text,
    fontWeight: '700',
  },
});
