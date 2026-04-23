import { useRouter } from 'expo-router';
import { Share2, X } from 'lucide-react-native';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/constants/ThemeContext';
import { radius, spacing } from '@/constants/theme';
import { formatDatePHT } from '@/lib/utils';
import { deletePage, getActiveTrip, getMoments } from '@/lib/supabase';
import type { Moment } from '@/lib/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const NUM_COLUMNS = 3;
const GAP = 2;
const THUMB_SIZE = (SCREEN_WIDTH - GAP * (NUM_COLUMNS + 1)) / NUM_COLUMNS;

/** Group moments by date, sorted newest first */
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
  const styles = getStyles(colors);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [moments, setMoments] = useState<Moment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | 'all'>('all');
  const mountedRef = useRef(true);
  const touchStartX = useRef(0);
  const SWIPE_THRESHOLD = 50;

  useEffect(() => {
    mountedRef.current = true;

    (async () => {
      try {
        const trip = await getActiveTrip();
        if (!mountedRef.current || !trip) return;
        const ms = await getMoments(trip.id);
        if (!mountedRef.current) return;
        setMoments(ms.filter((m) => m.photo));
      } catch {
        // fall back to empty
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    })();

    return () => {
      mountedRef.current = false;
    };
  }, []);

  const days = useMemo(() => groupByDay(moments), [moments]);

  const filteredMoments = useMemo(
    () => selectedDay === 'all' ? moments : moments.filter((m) => m.date === selectedDay),
    [moments, selectedDay],
  );


  const handleDelete = useCallback(
    (moment: Moment) => {
      Alert.alert('Delete Photo', `Delete "${moment.caption || 'Untitled'}"?`, [
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
              Alert.alert('Error', 'Failed to delete. Try again.');
            }
          },
        },
      ]);
    },
    [],
  );

  const renderThumb = useCallback(
    ({ item, index }: { item: Moment; index: number }) => (
      <Pressable
        onPress={() => setSelectedIdx(index)}
        onLongPress={() => handleDelete(item)}
        style={styles.thumbWrapper}
      >
        <Image source={{ uri: item.photo }} style={styles.thumb} resizeMode="cover" />
      </Pressable>
    ),
    [handleDelete],
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.green2} size="large" />
      </View>
    );
  }

  if (moments.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>No photos yet.</Text>
        <Pressable onPress={() => router.back()} style={styles.closeTextBtn}>
          <Text style={styles.closeTextBtnLabel}>Close</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          {filteredMoments.length} Photo{filteredMoments.length !== 1 ? 's' : ''}
          {selectedDay !== 'all' ? ` · ${formatDatePHT(selectedDay)}` : ''}
        </Text>
      </View>

      {/* Day filter chips */}
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

      <FlatList
        data={filteredMoments}
        renderItem={renderThumb}
        keyExtractor={(item) => item.id}
        numColumns={NUM_COLUMNS}
        contentContainerStyle={styles.grid}
        showsVerticalScrollIndicator={false}
      />

      {/* Fullscreen overlay — swipe left/right to navigate */}
      <Modal visible={selectedIdx !== null} transparent animationType="fade" onRequestClose={() => setSelectedIdx(null)}>
        {selectedIdx !== null && filteredMoments[selectedIdx] && (() => {
          const current = filteredMoments[selectedIdx];
          return (
            <View style={styles.overlay}>
              {/* Top bar */}
              <View style={[styles.overlayTopBar, { paddingTop: insets.top + spacing.sm }]}>
                <Pressable
                  style={styles.overlayClose}
                  onPress={() => setSelectedIdx(null)}
                >
                  <X size={22} color={colors.white} />
                </Pressable>
                <Text style={styles.overlayCounter}>
                  {selectedIdx + 1} / {filteredMoments.length}
                </Text>
                <Pressable
                  style={styles.overlayClose}
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
                  <Share2 size={18} color={colors.white} strokeWidth={1.8} />
                </Pressable>
              </View>

              {/* Swipeable photo — touch start/end detection */}
              <View
                style={styles.photoArea}
                onTouchStart={(e) => { touchStartX.current = e.nativeEvent.pageX; }}
                onTouchEnd={(e) => {
                  const dx = e.nativeEvent.pageX - touchStartX.current;
                  if (dx < -SWIPE_THRESHOLD) {
                    // Swipe left → next
                    setSelectedIdx((prev) =>
                      prev !== null ? Math.min(prev + 1, filteredMoments.length - 1) : 0
                    );
                  } else if (dx > SWIPE_THRESHOLD) {
                    // Swipe right → prev
                    setSelectedIdx((prev) =>
                      prev !== null ? Math.max(prev - 1, 0) : 0
                    );
                  }
                }}
              >
                <Image
                  source={{ uri: current.photo }}
                  style={styles.fullImage}
                  resizeMode="contain"
                />
              </View>

              {/* Meta */}
              <View style={[styles.overlayMeta, { paddingBottom: insets.bottom + spacing.lg }]}>
                {current.caption && current.caption !== 'Untitled' ? (
                  <Text style={styles.overlayCaption}>{current.caption}</Text>
                ) : null}
                <View style={styles.overlayRow}>
                  {current.takenBy ? (
                    <Text style={styles.overlayDetail}>by {current.takenBy}</Text>
                  ) : null}
                  {current.location ? (
                    <Text style={styles.overlayDetail}>{current.location}</Text>
                  ) : null}
                  <Text style={styles.overlayDetail}>{formatDatePHT(current.date)}</Text>
                </View>
              </View>
            </View>
          );
        })()}
      </Modal>
    </View>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  center: {
    flex: 1,
    backgroundColor: colors.bg,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.lg,
  },
  emptyText: {
    color: colors.text2,
    fontSize: 15,
  },
  closeTextBtn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: radius.md,
  },
  closeTextBtnLabel: {
    color: colors.text,
    fontWeight: '600',
  },

  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerTitle: {
    color: colors.text2,
    fontSize: 13,
    fontWeight: '600',
  },

  /* Day filter chips */
  dayChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  dayChip: {
    height: 30,
    paddingHorizontal: 12,
    borderRadius: 15,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayChipActive: {
    backgroundColor: colors.accent + '1A',
    borderColor: colors.accent,
  },
  dayChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text3,
  },
  dayChipTextActive: {
    color: colors.accent,
  },

  grid: {
    gap: GAP,
    paddingHorizontal: GAP,
  },
  thumbWrapper: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    margin: GAP / 2,
  },
  thumb: {
    width: '100%',
    height: '100%',
    borderRadius: radius.sm,
  },

  // fullscreen overlay
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
  },
  overlayTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  overlayClose: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayCounter: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '600',
  },
  photoArea: {
    flex: 1,
    justifyContent: 'center',
  },
  fullImage: {
    width: '100%',
    height: '100%',
  },
  overlayMeta: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    gap: spacing.xs,
  },
  overlayCaption: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '700',
  },
  overlayRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  overlayDetail: {
    color: colors.text2,
    fontSize: 13,
  },
});
