import { useRouter } from 'expo-router';
import { X } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, spacing } from '@/constants/theme';
import { deletePage, getActiveTrip, getMoments } from '@/lib/notion';
import type { Moment } from '@/lib/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const NUM_COLUMNS = 3;
const GAP = 2;
const THUMB_SIZE = (SCREEN_WIDTH - GAP * (NUM_COLUMNS + 1)) / NUM_COLUMNS;

export default function PhotoGallery() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [moments, setMoments] = useState<Moment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Moment | null>(null);
  const mountedRef = useRef(true);

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
              if (selected?.id === moment.id) setSelected(null);
            } catch {
              Alert.alert('Error', 'Failed to delete. Try again.');
            }
          },
        },
      ]);
    },
    [selected],
  );

  const renderThumb = useCallback(
    ({ item }: { item: Moment }) => (
      <Pressable
        onPress={() => setSelected(item)}
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
        <Text style={styles.headerTitle}>{moments.length} Photos</Text>
      </View>

      <FlatList
        data={moments}
        renderItem={renderThumb}
        keyExtractor={(item) => item.id}
        numColumns={NUM_COLUMNS}
        contentContainerStyle={styles.grid}
        showsVerticalScrollIndicator={false}
      />

      {/* Fullscreen overlay */}
      <Modal visible={selected !== null} transparent animationType="fade">
        {selected && (
          <View style={styles.overlay}>
            <Pressable
              style={[styles.overlayClose, { top: insets.top + spacing.sm }]}
              onPress={() => setSelected(null)}
            >
              <X size={22} color={colors.white} />
            </Pressable>

            <Image
              source={{ uri: selected.photo }}
              style={styles.fullImage}
              resizeMode="contain"
            />

            <View style={[styles.overlayMeta, { paddingBottom: insets.bottom + spacing.lg }]}>
              {selected.caption ? (
                <Text style={styles.overlayCaption}>{selected.caption}</Text>
              ) : null}
              <View style={styles.overlayRow}>
                {selected.location ? (
                  <Text style={styles.overlayDetail}>{selected.location}</Text>
                ) : null}
                <Text style={styles.overlayDetail}>{selected.date}</Text>
              </View>
            </View>
          </View>
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
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
    justifyContent: 'center',
  },
  overlayClose: {
    position: 'absolute',
    right: spacing.lg,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullImage: {
    width: '100%',
    height: '70%',
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
