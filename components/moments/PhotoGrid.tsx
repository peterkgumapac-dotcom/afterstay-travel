import React, {
  useCallback,
  useState,
  useRef,
  useMemo,
  useEffect,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
  runOnJS,
  interpolate,
  useAnimatedScrollHandler,
} from 'react-native-reanimated';
import {
  Gesture,
  GestureDetector,
} from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { Film, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/constants/ThemeContext';
import { springPresets, thresholds, scales } from '@/constants/animations';
import type { MomentDisplay, PeopleMap } from './types';
import { PhotoItem, THUMB_SIZE } from './PhotoItem';
import { PhotoCarousel } from './PhotoCarousel';
import { PhotoActionsSheet, type PhotoAction } from './PhotoActionsSheet';

const { width: SCREEN_W } = Dimensions.get('window');
const NUM_COLS = 3;
const GRID_GAP = 3;

interface PhotoGridProps {
  moments: MomentDisplay[];
  people: PeopleMap;
  onRefresh?: () => void;
  refreshing?: boolean;
  onFavorite?: (id: string) => void;
  onAction?: (action: PhotoAction, moment: MomentDisplay) => void;
  emptyTitle?: string;
  emptySubtitle?: string;
  ListFooterComponent?: React.ComponentType<any> | React.ReactElement | null;
}

interface EmptyStateProps {
  title: string;
  subtitle: string;
}

function EmptyState({ title, subtitle }: EmptyStateProps) {
  const floatY = useSharedValue(0);

  useEffect(() => {
    floatY.value = withRepeat(
      withSequence(
        withTiming(-scales.emptyFloatAmp, {
          duration: scales.emptyFloatPeriod / 2,
          easing: Easing.inOut(Easing.sin),
        }),
        withTiming(scales.emptyFloatAmp, {
          duration: scales.emptyFloatPeriod / 2,
          easing: Easing.inOut(Easing.sin),
        })
      ),
      -1,
      true
    );
  }, []);

  const floatStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: floatY.value }],
  }));

  return (
    <View style={styles.emptyContainer}>
      <Animated.View style={[styles.emptyIllustration, floatStyle]}>
        <View style={styles.emptyImagePlaceholder}>
          <Film size={48} color="rgba(216,171,122,0.3)" strokeWidth={1.5} />
        </View>
      </Animated.View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptySubtitle}>{subtitle}</Text>
    </View>
  );
}

export function PhotoGrid({
  moments,
  people,
  onRefresh,
  refreshing = false,
  onFavorite,
  onAction,
  emptyTitle = 'No moments yet',
  emptySubtitle = 'Photos you add will appear here',
  ListFooterComponent,
}: PhotoGridProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [carouselVisible, setCarouselVisible] = useState(false);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [favoritedDuringView, setFavoritedDuringView] = useState<Set<string>>(new Set());
  const flatListRef = useRef<FlatList<MomentDisplay>>(null);

  // Pull-to-refresh animation values
  const gridScaleY = useSharedValue(1);
  const gridTranslateY = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      'worklet';
      const y = event.contentOffset.y;
      if (y < 0) {
        const pullProgress = Math.min(Math.abs(y) / thresholds.pullToRefresh, 1);
        gridScaleY.value = 1 - pullProgress * (1 - scales.gridCompressY);
        gridTranslateY.value = Math.abs(y) * 0.3;
      } else {
        gridScaleY.value = withSpring(1, springPresets.SNAPPY);
        gridTranslateY.value = withSpring(0, springPresets.SNAPPY);
      }
    },
    onEndDrag: (event) => {
      'worklet';
      const y = event.contentOffset.y;
      if (y < -thresholds.pullToRefresh) {
        gridScaleY.value = withSpring(1, springPresets.BOUNCY);
        gridTranslateY.value = withSpring(0, springPresets.BOUNCY);
        if (onRefresh) {
          runOnJS(onRefresh)();
        }
      } else {
        gridScaleY.value = withSpring(1, springPresets.SNAPPY);
        gridTranslateY.value = withSpring(0, springPresets.SNAPPY);
      }
    },
  });

  const gridStyle = useAnimatedStyle(() => ({
    transform: [
      { scaleY: gridScaleY.value },
      { translateY: gridTranslateY.value },
    ],
  }));

  const enterSelectionMode = useCallback(() => {
    setSelectionMode(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }, []);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handlePress = useCallback((moment: MomentDisplay) => {
    if (selectionMode) {
      toggleSelect(moment.id);
    } else {
      const index = moments.findIndex((m) => m.id === moment.id);
      setCarouselIndex(index >= 0 ? index : 0);
      setCarouselVisible(true);
    }
  }, [selectionMode, moments, toggleSelect]);

  const handleLongPress = useCallback((moment: MomentDisplay) => {
    if (!selectionMode) {
      enterSelectionMode();
      setSelectedIds(new Set([moment.id]));
    }
  }, [selectionMode, enterSelectionMode]);

  const handleCarouselClose = useCallback(() => {
    setCarouselVisible(false);
  }, []);

  const handleCarouselFavorite = useCallback((id: string) => {
    setFavoritedDuringView(prev => new Set(prev).add(id));
    if (onFavorite) {
      onFavorite(id);
    }
  }, [onFavorite]);

  const handleCarouselAction = useCallback((action: PhotoAction, moment: MomentDisplay) => {
    if (onAction) {
      onAction(action, moment);
    }
  }, [onAction]);

  const handleAddToReel = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const selected = moments.filter((m) => selectedIds.has(m.id));
    if (selected.length > 0 && onAction) {
      onAction('reel', selected[0]);
    }
    exitSelectionMode();
  }, [selectedIds, moments, onAction, exitSelectionMode]);

  const renderItem = useCallback(
    ({ item, index }: { item: MomentDisplay; index: number }) => (
      <PhotoItem
        moment={item}
        index={index}
        selectionMode={selectionMode}
        selected={selectedIds.has(item.id)}
        onPress={handlePress}
        onLongPress={handleLongPress}
        onToggleSelect={toggleSelect}
        onDoubleTap={(m) => {
          if (onFavorite) onFavorite(m.id);
        }}
        isFavoritedDuringView={favoritedDuringView.has(item.id)}
      />
    ),
    [selectionMode, selectedIds, handlePress, handleLongPress, toggleSelect, onFavorite, favoritedDuringView]
  );

  // FAB animation
  const fabTranslateY = useSharedValue(100);
  const fabScale = useSharedValue(0);

  useEffect(() => {
    if (selectionMode && selectedIds.size > 0) {
      fabTranslateY.value = withSpring(0, springPresets.SHEET_REVEAL);
      fabScale.value = withSpring(1, springPresets.SHEET_REVEAL);
    } else {
      fabTranslateY.value = withSpring(100, springPresets.SHEET_REVEAL);
      fabScale.value = withSpring(0, springPresets.SHEET_REVEAL);
    }
  }, [selectionMode, selectedIds.size]);

  const fabStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: fabTranslateY.value },
      { scale: fabScale.value },
    ],
  }));

  // Selection header animation
  const headerHeight = useSharedValue(0);

  useEffect(() => {
    headerHeight.value = withSpring(selectionMode ? 56 : 0, springPresets.SNAPPY);
  }, [selectionMode]);

  const headerStyle = useAnimatedStyle(() => ({
    height: headerHeight.value,
    opacity: interpolate(headerHeight.value, [0, 56], [0, 1]),
  }));

  if (moments.length === 0) {
    return (
      <View style={styles.root}>
        <EmptyState title={emptyTitle} subtitle={emptySubtitle} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {/* Selection mode header */}
      <Animated.View style={[styles.selectionHeader, headerStyle]}>
        <Pressable onPress={exitSelectionMode} style={styles.headerBtn}>
          <X size={20} color="#fff" strokeWidth={2} />
        </Pressable>
        <Text style={styles.headerTitle}>
          {selectedIds.size} selected
        </Text>
        <Pressable
          onPress={() => {
            if (selectedIds.size === moments.length) {
              setSelectedIds(new Set());
            } else {
              setSelectedIds(new Set(moments.map((m) => m.id)));
            }
            Haptics.selectionAsync();
          }}
          style={styles.headerBtn}
        >
          <Text style={styles.selectAllText}>
            {selectedIds.size === moments.length ? 'None' : 'All'}
          </Text>
        </Pressable>
      </Animated.View>

      {/* Grid */}
      <GestureDetector
        gesture={Gesture.Native()}
      >
        <Animated.View style={[styles.gridContainer, gridStyle]}>
          <FlatList
            ref={flatListRef}
            data={moments}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            numColumns={NUM_COLS}
            contentContainerStyle={[
              styles.gridContent,
              { paddingBottom: insets.bottom + 20 },
            ]}
            columnWrapperStyle={styles.gridRow}
            showsVerticalScrollIndicator={false}
            ListFooterComponent={ListFooterComponent}
            initialNumToRender={12}
            maxToRenderPerBatch={12}
            windowSize={5}
            removeClippedSubviews
            getItemLayout={(_data, index) => ({
              length: THUMB_SIZE + GRID_GAP,
              offset: (THUMB_SIZE + GRID_GAP) * Math.floor(index / NUM_COLS),
              index,
            })}
            refreshControl={
              onRefresh ? (
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor={colors.accent}
                />
              ) : undefined
            }
            onScroll={scrollHandler}
            scrollEventThrottle={16}
          />
        </Animated.View>
      </GestureDetector>

      {/* Add to Reel FAB */}
      <Animated.View
        style={[
          styles.fab,
          { bottom: insets.bottom + 20 },
          fabStyle,
        ]}
      >
        <Pressable
          onPress={handleAddToReel}
          style={styles.fabBtn}
        >
          <Film size={20} color="#000" strokeWidth={2} />
          <Text style={styles.fabText}>Add to Reel</Text>
        </Pressable>
      </Animated.View>

      {/* Fullscreen Carousel */}
      <Modal
        visible={carouselVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={handleCarouselClose}
      >
        <PhotoCarousel
          moments={moments}
          initialIndex={carouselIndex}
          people={people}
          onClose={handleCarouselClose}
          onFavorite={handleCarouselFavorite}
          onAction={handleCarouselAction}
        />
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  gridContainer: {
    flex: 1,
  },
  gridContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 20,
  },
  gridRow: {
    gap: GRID_GAP,
    marginBottom: GRID_GAP,
  },
  selectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: '#0A0A0A',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  selectAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#d8ab7a',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyIllustration: {
    marginBottom: 24,
  },
  emptyImagePlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(216,171,122,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(216,171,122,0.15)',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f1ebe2',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#857d70',
    textAlign: 'center',
    lineHeight: 20,
  },
  fab: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  fabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#d8ab7a',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 999,
    shadowColor: '#d8ab7a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  fabText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000',
  },
});
