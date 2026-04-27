import { useLocalSearchParams, useRouter } from 'expo-router';
import { Grid3X3, LayoutList, Share2, X } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  Modal,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme, ThemeColors } from '@/constants/ThemeContext';
import { radius, spacing } from '@/constants/theme';
import { formatDatePHT } from '@/lib/utils';
import { deletePage, getActiveTrip, getMoments, getTripById } from '@/lib/supabase';
import type { Moment } from '@/lib/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GAP = 2;

type ViewMode = 'bento' | 'grid' | 'list';

function groupByDay(moments: Moment[]): { date: string; label: string; moments: Moment[] }[] {
  const map = new Map<string, Moment[]>();
  for (const m of moments) {
    const list = map.get(m.date);
    if (list) list.push(m);
    else map.set(m.date, [m]);
  }
  const sorted = [...map.entries()].sort(([a], [b]) => b.localeCompare(a));
  return sorted.map(([date, moms]) => ({
    date,
    label: formatDatePHT(date),
    moments: moms,
  }));
}

export default function PhotoGallery() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const router = useRouter();
  const { tripId: paramTripId } = useLocalSearchParams<{ tripId?: string }>();
  const insets = useSafeAreaInsets();

  const [moments, setMoments] = useState<Moment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | 'all'>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('bento');
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    (async () => {
      try {
        // Use param tripId if provided (past trips), otherwise fall back to active trip
        let resolvedTripId = paramTripId;
        if (!resolvedTripId) {
          const trip = await getActiveTrip();
          if (!mountedRef.current || !trip) return;
          resolvedTripId = trip.id;
        }
        const ms = await getMoments(resolvedTripId);
        if (!mountedRef.current) return;
        setMoments(ms.filter((m) => m.photo));
      } catch {
        // empty
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    })();
    return () => { mountedRef.current = false; };
  }, [paramTripId]);

  const days = useMemo(() => groupByDay(moments), [moments]);
  const filteredMoments = useMemo(
    () => selectedDay === 'all' ? moments : moments.filter((m) => m.date === selectedDay),
    [moments, selectedDay],
  );

  const handleDelete = useCallback((moment: Moment) => {
    Alert.alert('Delete Photo', 'Delete this photo?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deletePage(moment.id);
            setMoments((prev) => prev.filter((m) => m.id !== moment.id));
            setSelectedIdx(null);
          } catch {
            Alert.alert('Error', 'Failed to delete.');
          }
        },
      },
    ]);
  }, []);

  // ── Bento layout ──────────────────────────────────────────────
  const renderBento = useCallback(() => {
    const items = filteredMoments;
    const rows: React.ReactElement[] = [];
    let i = 0;

    while (i < items.length) {
      const remaining = items.length - i;
      const pattern = i % 6; // alternate patterns

      if (remaining >= 3 && pattern < 3) {
        // 1 big + 2 small stacked — capture indices
        const idx0 = i, idx1 = i + 1, idx2 = i + 2;
        const big = items[idx0];
        const s1 = items[idx1];
        const s2 = items[idx2];
        const bigW = (SCREEN_WIDTH - GAP * 3) * 0.6;
        const smallW = (SCREEN_WIDTH - GAP * 3) * 0.4;
        const rowH = bigW * 0.75;
        rows.push(
          <View key={`row-${idx0}`} style={{ flexDirection: 'row', gap: GAP, marginBottom: GAP }}>
            <Pressable onPress={() => setSelectedIdx(idx0)} onLongPress={() => handleDelete(big)}>
              <Image source={{ uri: big.photo }} style={{ width: bigW, height: rowH, borderRadius: radius.sm }} resizeMode="cover" />
            </Pressable>
            <View style={{ gap: GAP }}>
              <Pressable onPress={() => setSelectedIdx(idx1)} onLongPress={() => handleDelete(s1)}>
                <Image source={{ uri: s1.photo }} style={{ width: smallW, height: (rowH - GAP) / 2, borderRadius: radius.sm }} resizeMode="cover" />
              </Pressable>
              <Pressable onPress={() => setSelectedIdx(idx2)} onLongPress={() => handleDelete(s2)}>
                <Image source={{ uri: s2.photo }} style={{ width: smallW, height: (rowH - GAP) / 2, borderRadius: radius.sm }} resizeMode="cover" />
              </Pressable>
            </View>
          </View>,
        );
        i += 3;
      } else if (remaining >= 2) {
        // 2 equal — capture indices
        const idx0 = i, idx1 = i + 1;
        const m0 = items[idx0], m1 = items[idx1];
        const w = (SCREEN_WIDTH - GAP * 3) / 2;
        const h = w * 0.75;
        rows.push(
          <View key={`row-${idx0}`} style={{ flexDirection: 'row', gap: GAP, marginBottom: GAP }}>
            <Pressable onPress={() => setSelectedIdx(idx0)} onLongPress={() => handleDelete(m0)}>
              <Image source={{ uri: m0.photo }} style={{ width: w, height: h, borderRadius: radius.sm }} resizeMode="cover" />
            </Pressable>
            <Pressable onPress={() => setSelectedIdx(idx1)} onLongPress={() => handleDelete(m1)}>
              <Image source={{ uri: m1.photo }} style={{ width: w, height: h, borderRadius: radius.sm }} resizeMode="cover" />
            </Pressable>
          </View>,
        );
        i += 2;
      } else {
        // 1 full width — capture index
        const idx0 = i;
        const m0 = items[idx0];
        const w = SCREEN_WIDTH - GAP * 2;
        rows.push(
          <View key={`row-${idx0}`} style={{ marginBottom: GAP }}>
            <Pressable onPress={() => setSelectedIdx(idx0)} onLongPress={() => handleDelete(m0)}>
              <Image source={{ uri: m0.photo }} style={{ width: w, height: w * 0.56, borderRadius: radius.sm }} resizeMode="cover" />
            </Pressable>
          </View>,
        );
        i += 1;
      }
    }
    return rows;
  }, [filteredMoments, handleDelete]);

  // ── Grid layout ───────────────────────────────────────────────
  const GRID_COLS = 3;
  const THUMB_SIZE = (SCREEN_WIDTH - GAP * (GRID_COLS + 1)) / GRID_COLS;

  const renderGridItem = useCallback(
    ({ item, index }: { item: Moment; index: number }) => (
      <Pressable
        onPress={() => setSelectedIdx(index)}
        onLongPress={() => handleDelete(item)}
        style={{ width: THUMB_SIZE, height: THUMB_SIZE, margin: GAP / 2 }}
      >
        <Image source={{ uri: item.photo }} style={{ width: '100%', height: '100%', borderRadius: radius.sm }} resizeMode="cover" />
      </Pressable>
    ),
    [handleDelete],
  );

  // ── List layout ───────────────────────────────────────────────
  const renderListItem = useCallback(
    ({ item, index }: { item: Moment; index: number }) => (
      <Pressable
        onPress={() => setSelectedIdx(index)}
        onLongPress={() => handleDelete(item)}
        style={styles.listRow}
      >
        <Image source={{ uri: item.photo }} style={styles.listThumb} resizeMode="cover" />
        <View style={styles.listText}>
          {item.caption && item.caption !== 'Untitled' ? (
            <Text style={styles.listCaption} numberOfLines={1}>{item.caption}</Text>
          ) : null}
          <Text style={styles.listMeta}>
            {[item.location, item.takenBy ? `by ${item.takenBy}` : null, formatDatePHT(item.date)]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        </View>
      </Pressable>
    ),
    [handleDelete, styles],
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  if (moments.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>No photos yet.</Text>
        <Pressable onPress={() => router.back()} style={styles.closeBtn}>
          <Text style={styles.closeBtnLabel}>Close</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <X size={20} color={colors.text} strokeWidth={2} />
          </Pressable>
          <Text style={styles.headerTitle}>
            {filteredMoments.length} Moment{filteredMoments.length !== 1 ? 's' : ''}
          </Text>
          <View style={styles.viewToggle}>
            {([
              { mode: 'bento' as const, Icon: Grid3X3 },
              { mode: 'list' as const, Icon: LayoutList },
            ]).map(({ mode, Icon }) => (
              <Pressable
                key={mode}
                onPress={() => setViewMode(mode)}
                style={[styles.viewBtn, viewMode === mode && styles.viewBtnActive]}
              >
                <Icon size={16} color={viewMode === mode ? colors.accent : colors.text3} strokeWidth={2} />
              </Pressable>
            ))}
          </View>
        </View>

        {/* Day chips */}
        {days.length > 1 && (
          <View style={styles.dayChipRow}>
            <Pressable
              style={[styles.dayChip, selectedDay === 'all' && styles.dayChipActive]}
              onPress={() => setSelectedDay('all')}
            >
              <Text style={[styles.dayChipText, selectedDay === 'all' && styles.dayChipTextActive]}>All</Text>
            </Pressable>
            {days.map((day) => {
              const active = selectedDay === day.date;
              return (
                <Pressable
                  key={day.date}
                  style={[styles.dayChip, active && styles.dayChipActive]}
                  onPress={() => setSelectedDay(day.date)}
                >
                  <Text style={[styles.dayChipText, active && styles.dayChipTextActive]}>
                    {day.label} ({day.moments.length})
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}

        {/* Content */}
        {viewMode === 'bento' ? (
          <FlatList
            data={[1]}
            renderItem={() => <View style={{ paddingHorizontal: GAP }}>{renderBento()}</View>}
            keyExtractor={() => 'bento'}
            showsVerticalScrollIndicator={false}
          />
        ) : viewMode === 'grid' ? (
          <FlatList
            data={filteredMoments}
            renderItem={renderGridItem}
            keyExtractor={(item) => item.id}
            numColumns={GRID_COLS}
            contentContainerStyle={{ gap: GAP, paddingHorizontal: GAP }}
            showsVerticalScrollIndicator={false}
          />
        ) : (
          <FlatList
            data={filteredMoments}
            renderItem={renderListItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingHorizontal: spacing.md, gap: 8 }}
            showsVerticalScrollIndicator={false}
          />
        )}

        {/* Fullscreen viewer with smooth swipe */}
        {selectedIdx !== null && (
          <SmoothViewer
            moments={filteredMoments}
            initialIndex={selectedIdx}
            onClose={() => setSelectedIdx(null)}
            onDelete={handleDelete}
            colors={colors}
            insets={insets}
          />
        )}
      </View>
    </GestureHandlerRootView>
  );
}

// ── Smooth fullscreen viewer with gesture-based swipe ────────────────────

interface SmoothViewerProps {
  moments: Moment[];
  initialIndex: number;
  onClose: () => void;
  onDelete: (m: Moment) => void;
  colors: any;
  insets: { top: number; bottom: number };
}

function SmoothViewer({ moments, initialIndex, onClose, onDelete, colors, insets }: SmoothViewerProps) {
  const [index, setIndex] = useState(initialIndex);
  const flatListRef = useRef<FlatList<Moment>>(null);
  const current = moments[index];

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0 && viewableItems[0].index != null) {
      setIndex(viewableItems[0].index);
    }
  }).current;

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 }).current;

  const renderPhoto = useCallback(({ item }: { item: Moment }) => (
    <View style={{ width: SCREEN_WIDTH, flex: 1, justifyContent: 'center' }}>
      <Image
        source={{ uri: item.photo }}
        style={viewerStyles.fullImage}
        resizeMode="contain"
      />
    </View>
  ), []);

  if (!current) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={viewerStyles.overlay}>
        <View style={[viewerStyles.topBar, { paddingTop: insets.top + spacing.sm }]}>
          <Pressable style={viewerStyles.btn} onPress={onClose}>
            <X size={22} color="#fff" />
          </Pressable>
          <Text style={viewerStyles.counter}>{index + 1} / {moments.length}</Text>
          <Pressable
            style={viewerStyles.btn}
            onPress={() => {
              if (!current.photo) return;
              Share.share({
                message: current.caption
                  ? `${current.caption} — ${current.location ?? formatDatePHT(current.date)}`
                  : `Trip moment from ${formatDatePHT(current.date)}`,
                url: current.photo,
              });
            }}
          >
            <Share2 size={18} color="#fff" strokeWidth={1.8} />
          </Pressable>
        </View>

        <FlatList
          ref={flatListRef}
          data={moments}
          renderItem={renderPhoto}
          keyExtractor={(item) => item.id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={initialIndex}
          getItemLayout={(_, idx) => ({
            length: SCREEN_WIDTH,
            offset: SCREEN_WIDTH * idx,
            index: idx,
          })}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          decelerationRate="fast"
          style={{ flex: 1 }}
        />

        <View style={[viewerStyles.meta, { paddingBottom: insets.bottom + spacing.lg }]}>
          {current.caption && current.caption !== 'Untitled' ? (
            <Text style={viewerStyles.caption}>{current.caption}</Text>
          ) : null}
          <Text style={viewerStyles.detail}>
            {[current.location, current.takenBy ? `by ${current.takenBy}` : null, formatDatePHT(current.date)]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const viewerStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)' },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  btn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  counter: { fontSize: 12, color: 'rgba(255,255,255,0.6)', fontWeight: '600' },
  photoArea: { flex: 1, justifyContent: 'center' },
  fullImage: { width: '100%', height: '100%' },
  meta: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: spacing.xl, paddingTop: spacing.md, gap: spacing.xs },
  caption: { color: '#fff', fontSize: 18, fontWeight: '700' },
  detail: { color: 'rgba(255,255,255,0.6)', fontSize: 13 },
});

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center', gap: spacing.lg },
  emptyText: { color: colors.text2, fontSize: 15 },
  closeBtn: { paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, backgroundColor: colors.card, borderRadius: radius.md },
  closeBtnLabel: { color: colors.text, fontWeight: '600' },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  headerTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  viewToggle: { flexDirection: 'row', gap: 4, backgroundColor: colors.card, borderRadius: 8, padding: 2 },
  viewBtn: { padding: 6, borderRadius: 6 },
  viewBtnActive: { backgroundColor: colors.bg },

  dayChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  dayChip: { height: 30, paddingHorizontal: 12, borderRadius: 15, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  dayChipActive: { backgroundColor: colors.accent + '1A', borderColor: colors.accent },
  dayChipText: { fontSize: 12, fontWeight: '600', color: colors.text3 },
  dayChipTextActive: { color: colors.accent },

  // List view
  listRow: { flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: colors.card, borderRadius: radius.md, padding: 10, borderWidth: 1, borderColor: colors.border },
  listThumb: { width: 64, height: 64, borderRadius: radius.sm },
  listText: { flex: 1, gap: 2 },
  listCaption: { fontSize: 14, fontWeight: '600', color: colors.text },
  listMeta: { fontSize: 12, color: colors.text3 },
});
