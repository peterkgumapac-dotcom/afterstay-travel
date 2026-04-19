import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/constants/ThemeContext';
import { MosaicTile } from './MosaicTile';
import type { MomentDisplay, PeopleMap } from './types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MosaicLayoutProps {
  items: MomentDisplay[];
  onOpen: (moment: MomentDisplay) => void;
  people: PeopleMap;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function reactionScore(m: MomentDisplay): number {
  return Object.values(m.reactions || {}).reduce((a, b) => a + b, 0);
}

interface DayGroup {
  day: string;
  items: MomentDisplay[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MosaicLayout({ items, onOpen, people }: MosaicLayoutProps) {
  const { colors } = useTheme();

  // Group by day, preserving chronological order.
  const byDay = useMemo<DayGroup[]>(() => {
    const groups: DayGroup[] = [];
    const dayIndex: Record<string, number> = {};

    items.forEach((m) => {
      const key = m.date;
      if (dayIndex[key] == null) {
        dayIndex[key] = groups.length;
        groups.push({ day: key, items: [] });
      }
      groups[dayIndex[key]].items.push(m);
    });

    return groups;
  }, [items]);

  return (
    <View style={styles.root}>
      {byDay.map((grp, gIdx) => {
        const ms = grp.items;

        // Hero = highest reaction-score item in the day (with voice tie-break).
        let heroIdx = 0;
        let bestScore = -1;
        ms.forEach((m, i) => {
          const s = reactionScore(m) + (m.voice ? 1 : 0);
          if (s > bestScore) {
            bestScore = s;
            heroIdx = i;
          }
        });

        const hero = ms[heroIdx];
        const rest = ms.filter((_, i) => i !== heroIdx);

        // Chunk rest into pairs of 2.
        const pairs: MomentDisplay[][] = [];
        for (let i = 0; i < rest.length; i += 2) {
          pairs.push(rest.slice(i, i + 2));
        }

        return (
          <View key={grp.day} style={styles.dayGroup}>
            {/* Day divider (skip first group) */}
            {gIdx > 0 && (
              <View style={styles.dividerRow}>
                <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
                <Text
                  style={[
                    styles.dividerText,
                    { color: colors.text3 },
                  ]}
                >
                  {grp.day}
                </Text>
                <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
              </View>
            )}

            {/* Hero photo — 16:10 full width */}
            <MosaicTile
              moment={hero}
              onOpen={onOpen}
              aspect={16 / 10}
              people={people}
            />

            {/* Supporting pairs */}
            {pairs.map((pr, pIdx) => {
              if (pr.length === 2) {
                return (
                  <View key={pIdx} style={styles.pairRow}>
                    {pr.map((m) => (
                      <View key={m.id} style={styles.pairItem}>
                        <MosaicTile
                          moment={m}
                          onOpen={onOpen}
                          aspect={1}
                          people={people}
                        />
                      </View>
                    ))}
                  </View>
                );
              }
              // Single orphan — render as wide 16:10 tile.
              return (
                <MosaicTile
                  key={pIdx}
                  moment={pr[0]}
                  onOpen={onOpen}
                  aspect={16 / 10}
                  people={people}
                />
              );
            })}
          </View>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  root: {
    paddingHorizontal: 16,
    gap: 14,
  },
  dayGroup: {
    gap: 8,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 4,
    paddingBottom: 2,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: 9,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1.8,
  },
  pairRow: {
    flexDirection: 'row',
    gap: 8,
  },
  pairItem: {
    flex: 1,
  },
});
