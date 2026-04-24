import React, { useCallback } from 'react';
import { Dimensions, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';

import { useTheme } from '@/constants/ThemeContext';
import { radius } from '@/constants/theme';
import type { MomentDisplay } from './types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GAP = 3;

interface BentoLayoutProps {
  items: MomentDisplay[];
  onOpen: (moment: MomentDisplay) => void;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  selectMode: boolean;
  onLongPress: (id: string) => void;
}

export function BentoLayout({
  items,
  onOpen,
  selectedIds,
  onToggleSelect,
  selectMode,
  onLongPress,
}: BentoLayoutProps) {
  const { colors } = useTheme();

  const handlePress = useCallback(
    (item: MomentDisplay) => {
      if (selectMode) {
        onToggleSelect(item.id);
      } else {
        onOpen(item);
      }
    },
    [selectMode, onOpen, onToggleSelect],
  );

  const rows: React.ReactElement[] = [];
  let i = 0;

  while (i < items.length) {
    const remaining = items.length - i;
    const pattern = Math.floor(i / 3) % 2; // alternate: big+2small, then 2 equal

    if (remaining >= 3 && pattern === 0) {
      const idx0 = i, idx1 = i + 1, idx2 = i + 2;
      const m0 = items[idx0], m1 = items[idx1], m2 = items[idx2];
      const bigW = (SCREEN_WIDTH - GAP * 3) * 0.6;
      const smallW = (SCREEN_WIDTH - GAP * 3) * 0.4;
      const rowH = bigW;

      rows.push(
        <View key={`row-${idx0}`} style={styles.row}>
          <BentoCell
            moment={m0}
            width={bigW}
            height={rowH}
            selected={selectedIds.has(m0.id)}
            selectMode={selectMode}
            onPress={() => handlePress(m0)}
            onLongPress={() => onLongPress(m0.id)}
            colors={colors}
          />
          <View style={{ gap: GAP }}>
            <BentoCell
              moment={m1}
              width={smallW}
              height={(rowH - GAP) / 2}
              selected={selectedIds.has(m1.id)}
              selectMode={selectMode}
              onPress={() => handlePress(m1)}
              onLongPress={() => onLongPress(m1.id)}
              colors={colors}
            />
            <BentoCell
              moment={m2}
              width={smallW}
              height={(rowH - GAP) / 2}
              selected={selectedIds.has(m2.id)}
              selectMode={selectMode}
              onPress={() => handlePress(m2)}
              onLongPress={() => onLongPress(m2.id)}
              colors={colors}
            />
          </View>
        </View>,
      );
      i += 3;
    } else if (remaining >= 2) {
      const idx0 = i, idx1 = i + 1;
      const m0 = items[idx0], m1 = items[idx1];
      const w = (SCREEN_WIDTH - GAP * 3) / 2;
      const h = w * 0.85;

      rows.push(
        <View key={`row-${idx0}`} style={styles.row}>
          <BentoCell
            moment={m0}
            width={w}
            height={h}
            selected={selectedIds.has(m0.id)}
            selectMode={selectMode}
            onPress={() => handlePress(m0)}
            onLongPress={() => onLongPress(m0.id)}
            colors={colors}
          />
          <BentoCell
            moment={m1}
            width={w}
            height={h}
            selected={selectedIds.has(m1.id)}
            selectMode={selectMode}
            onPress={() => handlePress(m1)}
            onLongPress={() => onLongPress(m1.id)}
            colors={colors}
          />
        </View>,
      );
      i += 2;
    } else {
      const idx0 = i;
      const m0 = items[idx0];
      const w = SCREEN_WIDTH - GAP * 2;

      rows.push(
        <View key={`row-${idx0}`} style={{ marginBottom: GAP, paddingHorizontal: GAP }}>
          <BentoCell
            moment={m0}
            width={w}
            height={w * 0.56}
            selected={selectedIds.has(m0.id)}
            selectMode={selectMode}
            onPress={() => handlePress(m0)}
            onLongPress={() => onLongPress(m0.id)}
            colors={colors}
          />
        </View>,
      );
      i += 1;
    }
  }

  return <View style={styles.container}>{rows}</View>;
}

interface BentoCellProps {
  moment: MomentDisplay;
  width: number;
  height: number;
  selected: boolean;
  selectMode: boolean;
  onPress: () => void;
  onLongPress: () => void;
  colors: any;
}

function BentoCell({ moment, width, height, selected, selectMode, onPress, onLongPress, colors }: BentoCellProps) {
  return (
    <Pressable onPress={onPress} onLongPress={onLongPress} delayLongPress={300}>
      <View style={{ width, height, borderRadius: radius.sm, overflow: 'hidden' }}>
        <Image
          source={{ uri: moment.photo }}
          style={{ width: '100%', height: '100%' }}
          resizeMode="cover"
        />
        {/* Selection overlay */}
        {selectMode && (
          <View style={[styles.selectOverlay, selected && styles.selectOverlayActive]}>
            <View style={[styles.selectCircle, selected && { backgroundColor: colors.accent, borderColor: colors.accent }]}>
              {selected && <Check size={14} color="#fff" strokeWidth={3} />}
            </View>
          </View>
        )}
        {/* Location label */}
        {moment.place && !selectMode && (
          <View style={styles.locationBadge}>
            <Text style={styles.locationText} numberOfLines={1}>{moment.place}</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: GAP },
  row: { flexDirection: 'row', gap: GAP, marginBottom: GAP },
  selectOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  selectOverlayActive: {
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  selectCircle: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.8)',
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationBadge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 6,
    paddingVertical: 3,
    paddingHorizontal: 6,
  },
  locationText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
  },
});
