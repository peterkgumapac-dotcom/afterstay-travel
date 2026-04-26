import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Dimensions,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, MoreHorizontal, Plus } from 'lucide-react-native';

import { useTheme } from '@/constants/ThemeContext';
import { radius, spacing } from '@/constants/theme';
import { getAlbumMoments, getAlbumMembers, getPendingMoments, markMomentsViewed } from '@/lib/supabase';
import type { Moment, AlbumMember } from '@/lib/types';
import { formatDatePHT } from '@/lib/utils';
import { CachedImage } from '@/components/CachedImage';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_GAP = 4;
const GRID_COLS = 3;
const TILE_SIZE = (SCREEN_WIDTH - 32 - GRID_GAP * (GRID_COLS - 1)) / GRID_COLS;

const PEOPLE_COLORS = ['#a64d1e', '#b8892b', '#c66a36', '#7f3712', '#9a7d52'];

export default function AlbumDetailScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const s = useMemo(() => getStyles(colors), [colors]);
  const params = useLocalSearchParams<{ albumId?: string; name?: string; momentCount?: string }>();

  const albumId = params.albumId ?? '';
  const albumName = params.name ?? 'Album';
  const [moments, setMoments] = useState<Moment[]>([]);
  const [members, setMembers] = useState<AlbumMember[]>([]);
  const [pendingMoments, setPendingMoments] = useState<Moment[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!albumId) return;
    (async () => {
      try {
        const [m, mem, pending] = await Promise.all([
          getAlbumMoments(albumId).catch(() => []),
          getAlbumMembers(albumId).catch(() => []),
          getPendingMoments().catch(() => ({ moments: [], count: 0 })),
        ]);
        setMoments(m);
        setMembers(mem);
        setPendingMoments(pending.moments.slice(0, 6));
        setPendingCount(pending.count);
      } finally {
        setLoading(false);
      }
    })();
  }, [albumId]);

  const handleMarkSeen = useCallback(async () => {
    await markMomentsViewed().catch(() => {});
    setPendingMoments([]);
    setPendingCount(0);
  }, []);

  const coverPhoto = moments[0]?.photo;

  return (
    <View style={[s.container, { backgroundColor: colors.bg }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Cover hero */}
        <View style={s.coverContainer}>
          {coverPhoto ? (
            <CachedImage remoteUrl={coverPhoto} style={s.coverImage} />
          ) : (
            <View style={[s.coverImage, { backgroundColor: colors.card2 }]} />
          )}
          <View style={s.coverGradient} />

          {/* Top nav overlay */}
          <SafeAreaView edges={['top']} style={s.coverTopBar}>
            <Pressable onPress={() => router.back()} style={s.coverBtn}>
              <ChevronLeft size={18} color="#fff" strokeWidth={2.5} />
            </Pressable>
            <View style={s.coverTopRight}>
              <Pressable style={s.coverBtn}>
                <MoreHorizontal size={18} color="#fff" strokeWidth={2} />
              </Pressable>
            </View>
          </SafeAreaView>

          {/* Cover info overlay */}
          <View style={s.coverInfo}>
            <View style={s.scopeBadge}>
              <Text style={s.scopeBadgeText}>Private album</Text>
            </View>
            <Text style={s.coverTitle}>{albumName}</Text>
            <Text style={s.coverSub}>
              {moments.length} photos · {members.length} contributor{members.length !== 1 ? 's' : ''}
            </Text>
          </View>
        </View>

        {/* Contributors strip */}
        <View style={[s.contribRow, { borderBottomColor: colors.border }]}>
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={[s.contribLabel, { color: colors.text3 }]}>Contributors</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {members.map((m, i) => (
                <View key={m.id} style={[s.contribChip, { borderColor: colors.border, backgroundColor: colors.card }]}>
                  <View style={[s.contribAvatar, { backgroundColor: m.color ?? PEOPLE_COLORS[i % PEOPLE_COLORS.length] }]}>
                    <Text style={s.contribAvatarText}>{m.name.charAt(0).toUpperCase()}</Text>
                  </View>
                  <Text style={[s.contribName, { color: colors.text }]}>{m.name}</Text>
                  <Text style={[s.contribCount, { color: colors.text3 }]}>{m.momentCount}</Text>
                </View>
              ))}
              <Pressable
                onPress={() => router.push('/invite' as never)}
                style={[s.invitePill, { borderColor: colors.border2 }]}
              >
                <Plus size={12} color={colors.text2} strokeWidth={2} />
                <Text style={[s.inviteText, { color: colors.text2 }]}>Invite</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>

        {/* Pending intake */}
        {pendingCount > 0 && (
          <View style={[s.pendingCard, { backgroundColor: colors.accentBg, borderColor: colors.accentBorder }]}>
            <View style={s.pendingHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[s.pendingTitle, { color: colors.text }]}>
                  <Text style={{ color: colors.accent, fontWeight: '700' }}>{pendingCount} new</Text> since you last looked
                </Text>
                <Text style={[s.pendingSub, { color: colors.text3 }]}>Added recently</Text>
              </View>
              <Pressable
                onPress={handleMarkSeen}
                style={[s.pendingBtn, { backgroundColor: colors.accent }]}
              >
                <Text style={{ fontSize: 11, fontWeight: '600', color: colors.onBlack }}>Mark seen</Text>
              </Pressable>
            </View>
            {pendingMoments.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.pendingStrip}>
                {pendingMoments.map((m) => (
                  <View key={m.id} style={s.pendingThumb}>
                    {m.photo && <CachedImage remoteUrl={m.photo} style={s.pendingThumbImg} />}
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        )}

        {/* Photo grid */}
        <View style={s.grid}>
          {moments.map((m) => (
            <View key={m.id} style={s.gridTile}>
              {m.photo ? (
                <CachedImage remoteUrl={m.photo} style={s.gridTileImg} />
              ) : (
                <View style={[s.gridTileImg, { backgroundColor: colors.card }]} />
              )}
            </View>
          ))}
        </View>

        {moments.length === 0 && !loading && (
          <View style={s.emptyState}>
            <Text style={[s.emptyTitle, { color: colors.text }]}>No photos yet</Text>
            <Text style={[s.emptySub, { color: colors.text3 }]}>
              Add moments to this album from the Moments tab.
            </Text>
          </View>
        )}

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

type ThemeColors = ReturnType<typeof import('@/constants/ThemeContext').useTheme>['colors'];

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1 },
    // Cover
    coverContainer: {
      height: 280,
      position: 'relative',
      overflow: 'hidden',
    },
    coverImage: {
      ...StyleSheet.absoluteFillObject,
      width: '100%',
      height: '100%',
    },
    coverGradient: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'transparent',
      // Simulated gradient via layered views
      borderBottomWidth: 0,
    },
    coverTopBar: {
      position: 'absolute',
      top: 0,
      left: 14,
      right: 14,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      zIndex: 10,
    },
    coverBtn: {
      width: 36,
      height: 36,
      borderRadius: 999,
      backgroundColor: 'rgba(0,0,0,0.4)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    coverTopRight: {
      flexDirection: 'row',
      gap: 8,
    },
    coverInfo: {
      position: 'absolute',
      left: 18,
      right: 18,
      bottom: 16,
    },
    scopeBadge: {
      alignSelf: 'flex-start',
      paddingVertical: 4,
      paddingHorizontal: 10,
      borderRadius: 999,
      backgroundColor: 'rgba(0,0,0,0.42)',
      marginBottom: 8,
    },
    scopeBadgeText: {
      fontSize: 9.5,
      fontWeight: '700',
      letterSpacing: 1.4,
      textTransform: 'uppercase',
      color: '#fff',
    },
    coverTitle: {
      fontSize: 28,
      fontWeight: '600',
      letterSpacing: -0.5,
      color: '#fff',
    },
    coverSub: {
      fontSize: 11.5,
      color: 'rgba(255,255,255,0.9)',
      fontWeight: '500',
      marginTop: 4,
    },
    // Contributors
    contribRow: {
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderBottomWidth: 1,
    },
    contribLabel: {
      fontSize: 11,
      fontWeight: '600',
      letterSpacing: 1.2,
      textTransform: 'uppercase',
    },
    contribChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      paddingVertical: 5,
      paddingHorizontal: 12,
      paddingLeft: 5,
      borderRadius: 999,
      borderWidth: 1,
    },
    contribAvatar: {
      width: 22,
      height: 22,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
    },
    contribAvatarText: {
      fontSize: 10.5,
      fontWeight: '700',
      color: '#fff',
    },
    contribName: {
      fontSize: 12,
      fontWeight: '600',
    },
    contribCount: {
      fontSize: 11,
      fontWeight: '600',
      fontVariant: ['tabular-nums'],
    },
    invitePill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: 7,
      paddingHorizontal: 12,
      borderRadius: 999,
      borderWidth: 1,
      borderStyle: 'dashed',
    },
    inviteText: { fontSize: 11, fontWeight: '600' },
    // Pending intake
    pendingCard: {
      margin: 14,
      borderRadius: 14,
      borderWidth: 1,
      overflow: 'hidden',
    },
    pendingHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 12,
      paddingBottom: 10,
    },
    pendingTitle: { fontSize: 13, fontWeight: '600' },
    pendingSub: { fontSize: 10.5, marginTop: 1 },
    pendingBtn: {
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 999,
    },
    pendingStrip: {
      paddingHorizontal: 12,
      paddingBottom: 12,
      gap: 6,
    },
    pendingThumb: {
      width: 60,
      height: 60,
      borderRadius: 8,
      overflow: 'hidden',
    },
    pendingThumbImg: {
      width: 60,
      height: 60,
    },
    // Grid
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      padding: 16,
      gap: GRID_GAP,
    },
    gridTile: {
      width: TILE_SIZE,
      height: TILE_SIZE,
      borderRadius: 8,
      overflow: 'hidden',
    },
    gridTileImg: {
      width: '100%',
      height: '100%',
    },
    // Empty
    emptyState: {
      alignItems: 'center',
      paddingTop: 40,
      paddingHorizontal: 40,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: '600',
      marginBottom: 8,
    },
    emptySub: {
      fontSize: 13,
      textAlign: 'center',
      lineHeight: 20,
    },
  });
