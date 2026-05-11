import React, { memo, useCallback, useMemo } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type ListRenderItemInfo,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Image } from 'expo-image';
import { Check } from 'lucide-react-native';

import { useTheme } from '@/constants/ThemeContext';
import { radius } from '@/constants/theme';
import { smallUrl, thumbUrl } from '@/lib/imageUrl';
import { getMomentImageUri, type MomentDisplay } from './types';

const GAP = 3;
const LARGE_ALBUM_THRESHOLD = 40;

type BentoRow =
  | { key: string; kind: 'hero'; items: [MomentDisplay, MomentDisplay, MomentDisplay] }
  | { key: string; kind: 'pair'; items: [MomentDisplay, MomentDisplay] }
  | { key: string; kind: 'single'; items: [MomentDisplay] };

interface BentoLayoutProps {
  items: MomentDisplay[];
  onOpen: (moment: MomentDisplay) => void;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  selectMode: boolean;
  onLongPress: (id: string) => void;
  tripId?: string;
  refreshing?: boolean;
  onRefresh?: () => void;
  contentContainerStyle?: StyleProp<ViewStyle>;
  onScrollY?: (y: number) => void;
  ListHeaderComponent?: React.ReactElement | null;
}

function buildRows(items: MomentDisplay[]): BentoRow[] {
  const rows: BentoRow[] = [];
  let i = 0;

  while (i < items.length) {
    const remaining = items.length - i;
    const pattern = Math.floor(i / 3) % 2;

    if (remaining >= 3 && pattern === 0) {
      rows.push({
        key: `row-${items[i].id}`,
        kind: 'hero',
        items: [items[i], items[i + 1], items[i + 2]],
      });
      i += 3;
    } else if (remaining >= 2) {
      rows.push({
        key: `row-${items[i].id}`,
        kind: 'pair',
        items: [items[i], items[i + 1]],
      });
      i += 2;
    } else {
      rows.push({
        key: `row-${items[i].id}`,
        kind: 'single',
        items: [items[i]],
      });
      i += 1;
    }
  }

  return rows;
}

export function BentoLayout({
  items,
  onOpen,
  selectedIds,
  onToggleSelect,
  selectMode,
  onLongPress,
  tripId,
  refreshing = false,
  onRefresh,
  contentContainerStyle,
  onScrollY,
  ListHeaderComponent,
}: BentoLayoutProps) {
  const { colors } = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const useGalleryGrid = items.length >= LARGE_ALBUM_THRESHOLD;
  const galleryCellSize = useMemo(() => Math.floor((screenWidth - GAP * 5) / 3), [screenWidth]);
  const rows = useMemo(() => (useGalleryGrid ? [] : buildRows(items)), [items, useGalleryGrid]);

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

  const renderGalleryItem = useCallback(
    ({ item }: ListRenderItemInfo<MomentDisplay>) => (
      <View style={styles.galleryCell}>
        <BentoCell
          moment={item}
          width={galleryCellSize}
          height={galleryCellSize}
          selected={selectedIds.has(item.id)}
          selectMode={selectMode}
          onPress={() => handlePress(item)}
          onLongPress={() => onLongPress(item.id)}
          colors={colors}
          tripId={tripId}
          compact
        />
      </View>
    ),
    [colors, galleryCellSize, handlePress, onLongPress, selectMode, selectedIds, tripId],
  );

  const getGalleryItemLayout = useCallback((_: ArrayLike<MomentDisplay> | null | undefined, index: number) => {
    const row = Math.floor(index / 3);
    const length = galleryCellSize + GAP;
    return { length, offset: row * length, index };
  }, [galleryCellSize]);

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    onScrollY?.(event.nativeEvent.contentOffset.y);
  }, [onScrollY]);

  const renderRow = useCallback(
    ({ item: row }: ListRenderItemInfo<BentoRow>) => {
      if (row.kind === 'hero') {
        const [m0, m1, m2] = row.items;
        const bigW = (screenWidth - GAP * 3) * 0.6;
        const smallW = (screenWidth - GAP * 3) * 0.4;
      const rowH = bigW;

        return (
          <View style={styles.row}>
          <BentoCell
            moment={m0}
            width={bigW}
            height={rowH}
            selected={selectedIds.has(m0.id)}
            selectMode={selectMode}
            onPress={() => handlePress(m0)}
            onLongPress={() => onLongPress(m0.id)}
            colors={colors}
            tripId={tripId}
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
              tripId={tripId}
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
              tripId={tripId}
            />
          </View>
          </View>
        );
      }

      if (row.kind === 'pair') {
        const [m0, m1] = row.items;
        const w = (screenWidth - GAP * 3) / 2;
        const h = w * 0.85;

        return (
          <View style={styles.row}>
          <BentoCell
            moment={m0}
            width={w}
            height={h}
            selected={selectedIds.has(m0.id)}
            selectMode={selectMode}
            onPress={() => handlePress(m0)}
            onLongPress={() => onLongPress(m0.id)}
            colors={colors}
            tripId={tripId}
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
            tripId={tripId}
          />
          </View>
        );
      }

      const [m0] = row.items;
      const w = screenWidth - GAP * 2;

      return (
        <View style={{ marginBottom: GAP, paddingHorizontal: GAP }}>
          <BentoCell
            moment={m0}
            width={w}
            height={w * 0.56}
            selected={selectedIds.has(m0.id)}
            selectMode={selectMode}
            onPress={() => handlePress(m0)}
            onLongPress={() => onLongPress(m0.id)}
            colors={colors}
            tripId={tripId}
          />
        </View>
      );
    },
    [colors, handlePress, onLongPress, screenWidth, selectMode, selectedIds, tripId],
  );

  return (
    useGalleryGrid ? (
      <FlatList
        key="gallery-grid"
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={renderGalleryItem}
        numColumns={3}
        ListHeaderComponent={ListHeaderComponent}
        getItemLayout={getGalleryItemLayout}
        contentContainerStyle={[styles.galleryContainer, contentContainerStyle]}
        initialNumToRender={12}
        maxToRenderPerBatch={6}
        updateCellsBatchingPeriod={60}
        windowSize={7}
        removeClippedSubviews
        refreshing={refreshing}
        onRefresh={onRefresh}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        contentInsetAdjustmentBehavior="automatic"
      />
    ) : (
      <FlatList
        key="bento-grid"
        data={rows}
        keyExtractor={(row) => row.key}
        renderItem={renderRow}
        ListHeaderComponent={ListHeaderComponent}
        contentContainerStyle={[styles.container, contentContainerStyle]}
        initialNumToRender={3}
        maxToRenderPerBatch={2}
        updateCellsBatchingPeriod={50}
        windowSize={5}
        removeClippedSubviews
        refreshing={refreshing}
        onRefresh={onRefresh}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        contentInsetAdjustmentBehavior="automatic"
      />
    )
  );
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
  tripId?: string;
  compact?: boolean;
}

const BentoCell = memo(function BentoCellComponent({ moment, width, height, selected, selectMode, onPress, onLongPress, colors, tripId: _tripId, compact = false }: BentoCellProps) {
  const rawImageUri = getMomentImageUri(moment);
  const imageUri = compact ? thumbUrl(rawImageUri) : smallUrl(rawImageUri);
  const cellContent = (
    <View style={{ width, height, borderRadius: radius.sm, overflow: 'hidden', backgroundColor: colors.card }}>
      {imageUri ? (
        <Image
          source={{ uri: imageUri }}
          style={{ width: '100%', height: '100%' }}
          contentFit="cover"
          cachePolicy="memory-disk"
          recyclingKey={moment.id}
          placeholder={moment.blurhash ? { blurhash: moment.blurhash } : undefined}
          transition={0}
        />
      ) : (
        <View style={{ width: '100%', height: '100%', backgroundColor: colors.card }} />
      )}
        {/* Selection overlay */}
        {selectMode && (
          <View style={[styles.selectOverlay, selected && styles.selectOverlayActive]}>
            <View style={[styles.selectCircle, selected && { backgroundColor: colors.accent, borderColor: colors.accent }]}>
              {selected && <Check size={14} color="#fff" strokeWidth={3} />}
            </View>
          </View>
        )}
        {/* Location label */}
        {!compact && moment.place && moment.place !== 'Untitled' && !selectMode && (
          <View style={styles.locationBadge}>
            <Text style={styles.locationText} numberOfLines={1}>{moment.place}</Text>
          </View>
        )}
        {/* Author avatar badge */}
        {!compact && moment.authorKey && !selectMode && (
          <View style={[styles.authorBadge, { backgroundColor: moment.authorColor ?? '#a64d1e' }]}>
            {moment.authorAvatar ? (
              <Image
                source={{ uri: moment.authorAvatar }}
                style={styles.authorAvatarImg}
                contentFit="cover"
                cachePolicy="memory-disk"
                recyclingKey={`author-${moment.authorAvatar}`}
              />
            ) : (
              <Text style={styles.authorInitial}>{moment.authorKey}</Text>
            )}
          </View>
        )}
      </View>
  );

  return (
    <Pressable onPress={onPress} onLongPress={onLongPress} delayLongPress={300}>
      {cellContent}
    </Pressable>
  );
}, (prev, next) => (
  prev.moment.id === next.moment.id &&
  prev.moment.photo === next.moment.photo &&
  prev.moment.hdPhoto === next.moment.hdPhoto &&
  prev.moment.blurhash === next.moment.blurhash &&
  prev.moment.place === next.moment.place &&
  prev.moment.authorAvatar === next.moment.authorAvatar &&
  prev.selected === next.selected &&
  prev.selectMode === next.selectMode &&
  prev.width === next.width &&
  prev.height === next.height &&
  prev.compact === next.compact &&
  prev.colors.card === next.colors.card &&
  prev.colors.accent === next.colors.accent
));

const styles = StyleSheet.create({
  container: { paddingHorizontal: GAP },
  galleryContainer: { paddingHorizontal: GAP, paddingTop: GAP },
  galleryCell: { paddingLeft: GAP, paddingBottom: GAP },
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
  authorBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.3)',
  },
  authorInitial: {
    fontSize: 9,
    fontWeight: '700',
    color: '#0b0f14',
  },
  authorAvatarImg: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
});
