import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Haptics from 'expo-haptics';
import { useIsFocused } from '@react-navigation/native';
import {
  Alert,
  Image,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  Share,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Camera, Compass, Eye, EyeOff } from 'lucide-react-native';
import { useTheme } from '@/constants/ThemeContext';
import { useAuth } from '@/lib/auth';
import { useTabBarVisibility } from '@/app/(tabs)/_layout';
const ExploreMomentsFeed = React.lazy(() => import('@/components/discover/ExploreMomentsFeed'));
import { getMoments, getGroupMembers, getMomentFavorites, getCommentCounts, toggleFavorite, toggleMomentVisibility as toggleVisibility, setMomentVisibility, batchSetMomentVisibility, batchDeleteMoments, getDismissedMomentIds, dismissMoment, undismissMoment, batchDismissMoments, saveGroupPhotoToPrivate, publishMomentToExplore, unpublishMomentFromExplore } from '@/lib/supabase';
import CommentSheet from './CommentSheet';
import {
  getMomentsPromise,
  getGroupMembersPromise,
  getMomentsCached,
  getGroupMembersCached,
} from '@/hooks/useTabMoments';
import { cachePhotoMeta, getCachedPhotosByTrip } from '@/lib/cache/sqliteCache';
import type { MomentFavoriteMap } from '@/lib/supabase';
import { formatDatePHT } from '@/lib/utils';
import type { Moment, GroupMember, MomentVisibility } from '@/lib/types';
import type { MomentDisplay, PeopleMap } from './types';
import { PersonChips } from './PersonChips';
import { ScopeChips } from './ScopeChips';
import type { ScopeFilter } from './ScopeChips';
import { AlbumsGrid } from './AlbumsGrid';
import { BentoLayout } from './BentoLayout';
import { PhotoCarousel } from './PhotoCarousel';
import { PhotoEditSheet } from './PhotoEditSheet';
import { FilmEditor } from './FilmEditor';
import { PhotoGridPicker } from './PhotoGridPicker';
import { BatchActionBar, type BatchAction } from './BatchActionBar';
import { PolaroidCollage } from './PolaroidCollage';

const MOMENTS_LOAD_TIMEOUT_MS = 10000;

function withTimeout<T>(promise: Promise<T>, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), MOMENTS_LOAD_TIMEOUT_MS);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      }, () => {
        clearTimeout(timer);
        resolve(fallback);
      });
  });
}
import { CurationLightbox } from '@/components/curation/CurationLightbox';
import { Modal, RefreshControl } from 'react-native';
import type { PhotoAction } from './PhotoActionsSheet';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PEOPLE_COLORS = ['#a64d1e', '#b8892b', '#c66a36', '#7f3712', '#9a7d52'];

type TabMode = 'trip' | 'public';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface MomentsTabProps {
  tripId?: string;
}

function buildPeopleMap(members: GroupMember[]): PeopleMap {
  const people: PeopleMap = {};
  members.forEach((m, i) => {
    const initial = m.name.charAt(0).toUpperCase();
    const entry = {
      name: m.name,
      color: PEOPLE_COLORS[i % PEOPLE_COLORS.length],
      avatar: m.profilePhoto,
    };
    people[initial] = entry;
    people[m.name] = entry;
    if (m.userId) people[m.userId] = entry;
  });
  return people;
}

function buildMomentDisplays(
  moments: Moment[],
  people: PeopleMap,
  currentUserId: string | undefined,
  favorites: MomentFavoriteMap,
  commentCounts?: Record<string, number>,
): MomentDisplay[] {
  return moments.map((m) => {
    const authorKey = m.takenBy ? m.takenBy.charAt(0).toUpperCase() : '';
    const personEntry = m.userId ? people[m.userId] : people[authorKey];
    const fav = m.id ? favorites[m.id] : undefined;
    return {
      ...m,
      place: m.location,
      authorKey,
      authorColor: personEntry?.color,
      authorAvatar: personEntry?.avatar,
      isMine: !!(currentUserId && (m.userId === currentUserId || !m.userId)),
      favoriteCount: fav?.count ?? 0,
      isFavorited: !!(currentUserId && fav?.userIds.includes(currentUserId)),
      commentCount: m.id ? (commentCounts?.[m.id] ?? 0) : 0,
    };
  });
}

function computeDayCounts(moments: MomentDisplay[]): Record<string, number> {
  const counts: Record<string, number> = {};
  moments.forEach((m) => {
    const day = m.date;
    counts[day] = (counts[day] || 0) + 1;
  });
  return counts;
}

function computeScopeCounts(moments: MomentDisplay[]): Record<ScopeFilter, number> {
  const counts: Record<ScopeFilter, number> = { all: 0, group: 0, me: 0, album: 0, favorites: 0 };
  moments.forEach((m) => {
    counts.all++;
    if (m.visibility === 'private') counts.me++;
    else if (m.visibility === 'album') counts.album++;
    else counts.group++;
    if ((m.favoriteCount ?? 0) > 0 || m.isFavorited) counts.favorites++;
  });
  return counts;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MomentsTab({ tripId }: MomentsTabProps) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const s = useMemo(() => getStyles(colors), [colors]);

  const loadRef = useRef<((silent?: boolean, forceRefresh?: boolean) => Promise<void>) | null>(null);
  const [rawMoments, setRawMoments] = useState<Moment[]>([]);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [tabMode, setTabMode] = useState<TabMode>('trip');
  const [activePerson, setActivePerson] = useState<string | null>(null);
  const [showContributors, setShowContributors] = useState(false);
  const [activeScope, setActiveScope] = useState<ScopeFilter>('all');
  const [favoriteMap, setFavoriteMap] = useState<MomentFavoriteMap>({});
  const [commentCountMap, setCommentCountMap] = useState<Record<string, number>>({});
  const [commentMomentId, setCommentMomentId] = useState<string | null>(null);

  const [editMomentId, setEditMomentId] = useState<string | null>(null);
  const [filmMoments, setFilmMoments] = useState<MomentDisplay[] | null>(null);
  const [filmInitIdx, setFilmInitIdx] = useState(0);
  const [showPhotoPicker, setShowPhotoPicker] = useState(false);
  const [curationDay, setCurationDay] = useState<{ dateLabel: string; photos: { id: string; uri: string }[] } | null>(null);
  const [curatedDays, setCuratedDays] = useState<Set<string>>(new Set());
  const [favoritedIds, setFavoritedIds] = useState<Set<string>>(new Set());

  // Bento grid selection + carousel state
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [collageVisible, setCollageVisible] = useState(false);
  const [carouselVisible, setCarouselVisible] = useState(false);
  const [carouselIndex, setCarouselIndex] = useState(0);

  // Per-user dismissals (hide/show group photos)
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [showHidden, setShowHidden] = useState(false);

  // Hide FAB when select mode is active
  const { setFabVisible } = useTabBarVisibility();
  useEffect(() => {
    setFabVisible(!selectMode);
    return () => setFabVisible(true);
  }, [selectMode, setFabVisible]);

  const editMoment = editMomentId ? rawMoments.find((m) => m.id === editMomentId) ?? null : null;

  const handleEditSave = useCallback(async (id: string, updates: { caption?: string; location?: string }) => {
    try {
      const { supabase } = await import('@/lib/supabase');
      await supabase.from('moments').update({
        caption: updates.caption ?? null,
        location: updates.location ?? null,
      }).eq('id', id);
      setRawMoments((prev) =>
        prev.map((m) => m.id === id ? { ...m, caption: updates.caption ?? m.caption, location: updates.location ?? m.location } : m),
      );
    } catch (err) { if (__DEV__) console.warn('[Moments] edit failed:', err); }
  }, []);

  const handleFavorite = useCallback(async (momentId: string) => {
    try {
      const nowFavorited = await toggleFavorite(momentId);
      setFavoriteMap((prev) => {
        const next = { ...prev };
        if (!next[momentId]) next[momentId] = { count: 0, userIds: [] };
        if (nowFavorited && user?.id) {
          next[momentId] = {
            count: next[momentId].count + 1,
            userIds: [...next[momentId].userIds, user.id],
          };
        } else if (!nowFavorited && user?.id) {
          next[momentId] = {
            count: Math.max(0, next[momentId].count - 1),
            userIds: next[momentId].userIds.filter((uid) => uid !== user.id),
          };
        }
        return next;
      });
    } catch (err) { if (__DEV__) console.warn('[Moments] fav failed:', err); }
  }, [user]);

  const handleToggleVisibility = useCallback(async (momentId: string) => {
    try {
      const newVis = await toggleVisibility(momentId);
      setRawMoments((prev) =>
        prev.map((m) => m.id === momentId ? { ...m, visibility: newVis, isPublic: false } : m),
      );
    } catch (err) { if (__DEV__) console.warn('[Moments] visibility toggle failed:', err); }
  }, []);

  const handleSetVisibility = useCallback(async (momentId: string, vis: 'shared' | 'private' | 'album') => {
    try {
      await unpublishMomentFromExplore(momentId);
      await setMomentVisibility(momentId, vis);
      setRawMoments((prev) =>
        prev.map((m) => m.id === momentId ? { ...m, visibility: vis, isPublic: false } : m),
      );
    } catch (err) { if (__DEV__) console.warn('[Moments] set visibility failed:', err); }
  }, []);

  const handlePublishMoment = useCallback(async (momentId: string) => {
    try {
      await publishMomentToExplore(momentId);
      setRawMoments((prev) =>
        prev.map((m) => m.id === momentId ? { ...m, visibility: 'public', isPublic: true } : m),
      );
      Alert.alert('Shared to Explore', 'This photo is now visible in Explore Moments.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Please try again.';
      Alert.alert('Could not share photo', message);
      if (__DEV__) console.warn('[Moments] publish failed:', err);
    }
  }, []);

  const handlePhotoAction = useCallback((action: PhotoAction, moment: MomentDisplay) => {
    if (action === 'share') {
      Share.share({
        message: [moment.caption, moment.location].filter(Boolean).join(' — '),
        url: moment.photo,
      });
    } else if (action === 'share-hd') {
      const hdUrl = moment.hdPhoto || moment.photo;
      Share.share({
        message: [moment.caption, moment.location].filter(Boolean).join(' — '),
        url: hdUrl,
      });
    } else if (action === 'download-hd') {
      const hdUrl = moment.hdPhoto || moment.photo;
      if (hdUrl) {
        (async () => {
          try {
            const { shareAsync } = await import('expo-sharing');
            const FileSystem = await import('expo-file-system/legacy');
            const ext = hdUrl.match(/\.\w+$/)?.[0] || '.jpeg';
            const localPath = `${FileSystem.cacheDirectory}moment-hd-${moment.id}${ext}`;
            const download = await FileSystem.downloadAsync(hdUrl, localPath);
            await shareAsync(download.uri);
          } catch (err) { if (__DEV__) console.warn('[Moments] HD download failed:', err); }
        })();
      }
    } else if (action === 'reel') {
      setFilmMoments([moment]);
      setFilmInitIdx(0);
    } else if (action === 'archive') {
      handleToggleVisibility(moment.id);
    } else if (action === 'set-private') {
      handleSetVisibility(moment.id, 'private');
    } else if (action === 'set-album') {
      handleSetVisibility(moment.id, 'album');
    } else if (action === 'set-shared') {
      handleSetVisibility(moment.id, 'shared');
    } else if (action === 'set-public') {
      handlePublishMoment(moment.id);
    } else if (action === 'edit') {
      setEditMomentId(moment.id);
    } else if (action === 'delete') {
      Alert.alert('Delete photo?', 'This cannot be undone.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const { deleteMoment: deleteMomentFn } = await import('@/lib/supabase');
            try { await deleteMomentFn(moment.id); } catch (err) { if (__DEV__) console.warn('[Moments] delete failed:', err); }
            setRawMoments((prev) => prev.filter((m) => m.id !== moment.id));
          },
        },
      ]);
    } else if (action === 'hide') {
      dismissMoment(moment.id).catch((err) => { if (__DEV__) console.warn('[Moments] dismiss failed:', err); });
      setDismissedIds((prev) => new Set([...prev, moment.id]));
    } else if (action === 'unhide') {
      undismissMoment(moment.id).catch((err) => { if (__DEV__) console.warn('[Moments] undismiss failed:', err); });
      setDismissedIds((prev) => { const next = new Set(prev); next.delete(moment.id); return next; });
    } else if (action === 'save-to-mine') {
      saveGroupPhotoToPrivate(moment.id)
        .then(() => { loadRef.current?.(true, true); })
        .catch((err) => { if (__DEV__) console.warn('[Moments] save-to-mine failed:', err); });
    }
  }, [handleToggleVisibility, handleSetVisibility, handlePublishMoment]);

  const handleBatchAction = useCallback((action: BatchAction) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    const exitSelect = () => { setSelectMode(false); setSelectedIds(new Set()); };

    if (action === 'collage') {
      setCollageVisible(true);
      return;
    }

    if (action === 'hide') {
      batchDismissMoments(ids).catch((err) => { if (__DEV__) console.warn('[Moments] batch dismiss failed:', err); });
      setDismissedIds((prev) => new Set([...prev, ...ids]));
      exitSelect();
      return;
    }

    if (action === 'delete') {
      Alert.alert(`Delete ${ids.length} photos?`, 'This cannot be undone.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try { await batchDeleteMoments(ids); } catch (err) { if (__DEV__) console.warn('[Moments] batch delete failed:', err); }
            setRawMoments((prev) => prev.filter((m) => !selectedIds.has(m.id)));
            exitSelect();
          },
        },
      ]);
      return;
    }

    // Visibility actions
    const visMap: Record<string, 'private' | 'album' | 'shared'> = {
      'set-private': 'private',
      'set-album': 'album',
      'set-shared': 'shared',
    };
    const vis = visMap[action];
    if (vis) {
      (async () => {
        try { await batchSetMomentVisibility(ids, vis); } catch (err) { if (__DEV__) console.warn('[Moments] batch visibility failed:', err); }
        setRawMoments((prev) =>
          prev.map((m) => selectedIds.has(m.id) ? { ...m, visibility: vis } : m),
        );
        exitSelect();
      })();
    }
  }, [selectedIds]);

  // Curation: long-press a day chip to curate that day's photos
  const handleCurationLongPress = useCallback((day: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const source = day === 'all' ? rawMoments : rawMoments.filter((m) => m.date === day);
    const photosForCuration = source
      .filter((m) => m.photo)
      .map((m) => ({ id: m.id, uri: m.photo! }));
    if (photosForCuration.length === 0) return;
    const dateLabel = day === 'all' ? 'All Days' : formatDatePHT(day);
    setCurationDay({ dateLabel, photos: photosForCuration });
  }, [rawMoments]);

  const handleCurationComplete = useCallback((favorites: string[]) => {
    setFavoritedIds((prev) => new Set([...prev, ...favorites]));
    if (curationDay) {
      const dayKey = curationDay.dateLabel === 'All Days' ? 'all' : curationDay.dateLabel;
      setCuratedDays((prev) => {
        const next = new Set(prev);
        next.add(dayKey);
        return next;
      });
    }
    setCurationDay(null);
  }, [curationDay]);

  // Fetch moments + group members + favorites
  const load = useCallback(async (silent = false, forceRefresh = false) => {
    try {
      if (!silent) setLoading(true);

      // Try cache first for instant display
      if (tripId && silent) {
        const cachedMoments = getMomentsCached(tripId);
        const cachedMembers = getGroupMembersCached(tripId);
        if (cachedMoments) setRawMoments(cachedMoments);
        if (cachedMembers) setMembers(cachedMembers);
      }

      // Also try SQLite cache for photos
      if (tripId && !silent) {
        const cached = await getCachedPhotosByTrip(tripId).catch(() => []);
        if (cached.length > 0) {
          const cachedMoments = cached.map((c) => ({
            id: c.id,
            photo: c.photoUrl,
            caption: c.caption,
            location: c.location,
            date: c.date,
            takenBy: c.takenBy,
            visibility: c.visibility,
          }));
          setRawMoments(cachedMoments as Moment[]);
        }
      }

      const [moments, groupMembers, favs] = await Promise.all([
        withTimeout(getMomentsPromise(tripId ?? '', forceRefresh), [] as Moment[]),
        withTimeout(getGroupMembersPromise(tripId ?? '', forceRefresh), [] as GroupMember[]),
        withTimeout(getMomentFavorites(tripId), {} as MomentFavoriteMap),
      ]);
      setRawMoments(moments);
      setMembers(groupMembers);
      setFavoriteMap(favs);

      // Fetch comment counts + dismissals in parallel
      const momentIds = moments.map(m => m.id).filter(Boolean) as string[];
      if (momentIds.length > 0) {
        getCommentCounts(momentIds).then(setCommentCountMap).catch(() => {});
      }
      if (tripId) {
        getDismissedMomentIds(tripId).then(setDismissedIds).catch(() => {});
      }

      // Cache photo metadata to SQLite for offline
      if (tripId && moments.length > 0) {
        await cachePhotoMeta(
          moments.map((m) => ({
            id: m.id,
            tripId,
            photoUrl: m.photo ?? undefined,
            caption: m.caption ?? undefined,
            location: m.location ?? undefined,
            date: m.date ?? undefined,
            takenBy: m.takenBy ?? undefined,
            visibility: m.visibility ?? undefined,
          }))
        ).catch(() => {});
      }

      // Prefetch first 20 photos
      moments.filter((m) => m.photo).slice(0, 20).forEach((m) => {
        const { Image: ExpoImg } = require('expo-image');
        ExpoImg.prefetch(m.photo!).catch(() => {});
      });
    } finally {
      if (!silent) setLoading(false);
      setRefreshing(false);
    }
  }, [tripId]);
  loadRef.current = load;

  useEffect(() => {
    // Cache-first: load silently if we have cached data
    const cached = tripId ? getMomentsCached(tripId) : undefined;
    if (cached !== undefined) {
      setLoading(false);
      load(true, false);
    } else {
      load();
    }
  }, [load, tripId]);

  // Refresh when screen comes back into focus (e.g. after add-moment, new-album)
  const isFocused = useIsFocused();
  const prevFocused = useRef(isFocused);
  useEffect(() => {
    if (isFocused && !prevFocused.current) {
      load(true, false); // background refresh uses tab cache TTL
    }
    prevFocused.current = isFocused;
  }, [isFocused, load]);

  // Build derived data
  const currentUserId = user?.id;
  const people = useMemo(() => buildPeopleMap(members), [members]);
  const allMoments = useMemo(
    () => buildMomentDisplays(rawMoments, people, currentUserId, favoriteMap, commentCountMap),
    [rawMoments, people, currentUserId, favoriteMap, commentCountMap],
  );
  const dayCounts = useMemo(() => computeDayCounts(allMoments), [allMoments]);
  const scopeCounts = useMemo(() => computeScopeCounts(allMoments), [allMoments]);
  const uniquePlaces = useMemo(
    () => new Set(allMoments.map((m) => m.place ?? m.location).filter(Boolean)).size,
    [allMoments],
  );
  const dayCount = useMemo(() => Object.keys(dayCounts).length, [dayCounts]);
  const contributorCount = useMemo(
    () => new Set(allMoments.map((m) => m.userId).filter(Boolean)).size,
    [allMoments],
  );

  const personCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    allMoments.forEach((m) => {
      if (m.userId) counts[m.userId] = (counts[m.userId] || 0) + 1;
    });
    return counts;
  }, [allMoments]);

  const filtered = useMemo(() => {
    let result = allMoments;
    if (activePerson) result = result.filter((m) => m.userId === activePerson);
    if (activeScope === 'group') result = result.filter((m) => m.visibility === 'shared');
    else if (activeScope === 'me') result = result.filter((m) => m.visibility === 'private');
    else if (activeScope === 'album') result = result.filter((m) => m.visibility === 'album');
    else if (activeScope === 'favorites') result = result.filter((m) => (m.favoriteCount ?? 0) > 0 || m.isFavorited);
    // Per-user dismissals — hide unless toggle is on
    if (!showHidden && dismissedIds.size > 0) {
      result = result.filter((m) => !dismissedIds.has(m.id));
    }
    return result;
  }, [allMoments, activePerson, activeScope, showHidden, dismissedIds]);

  if (loading) {
    return (
      <View style={s.loadingContainer}>
        <ActivityIndicator color={colors.accentLt} />
      </View>
    );
  }

  return (
    <>
      <View style={{ flex: 1 }}>
        {/* ---- Header ---- */}
        <View style={s.header}>
          <View>
            <View style={s.titleRow}>
              <Text style={[s.title, { color: colors.text }]}>Moments</Text>
              <Text style={[s.titleCount, { color: colors.accent }]}>{allMoments.length}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={[s.subtitle, { color: colors.text3 }]}>
                {dayCount} days · {uniquePlaces} places
              </Text>
              {members.length > 1 && (
                <Pressable
                  onPress={() => setShowContributors(!showContributors)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                  hitSlop={8}
                >
                  {/* Stacked mini avatars */}
                  <View style={{ flexDirection: 'row', marginLeft: 2 }}>
                    {members.slice(0, 3).map((m, i) => (
                      <View key={m.id} style={{
                        width: 18, height: 18, borderRadius: 9,
                        marginLeft: i > 0 ? -6 : 0,
                        borderWidth: 1.5, borderColor: colors.canvas,
                        backgroundColor: PEOPLE_COLORS[i % PEOPLE_COLORS.length],
                        overflow: 'hidden', zIndex: 3 - i,
                      }}>
                        {m.profilePhoto ? (
                          <Image source={{ uri: m.profilePhoto }} style={{ width: '100%', height: '100%' }} />
                        ) : (
                          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                            <Text style={{ fontSize: 8, fontWeight: '700', color: '#fff' }}>{m.name.charAt(0)}</Text>
                          </View>
                        )}
                      </View>
                    ))}
                  </View>
                  <Text style={[s.subtitle, { color: colors.accent }]}>
                    {contributorCount}
                  </Text>
                </Pressable>
              )}
            </View>
          </View>
        </View>

        {/* ---- Expandable contributor row ---- */}
        {showContributors && members.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 10, paddingVertical: 8 }}>
            {members.map((m, i) => {
              const count = m.userId ? (personCounts[m.userId] ?? 0) : 0;
              return (
                <Pressable
                  key={m.id}
                  onPress={() => {
                    if (m.userId) {
                      router.push({ pathname: '/profile/[userId]', params: { userId: m.userId } } as never);
                    }
                  }}
                  style={{ alignItems: 'center', gap: 4, minWidth: 56 }}
                >
                  <View style={{
                    width: 40, height: 40, borderRadius: 20,
                    borderWidth: 2, borderColor: count > 0 ? colors.accent : colors.border,
                    overflow: 'hidden',
                    backgroundColor: PEOPLE_COLORS[i % PEOPLE_COLORS.length],
                  }}>
                    {m.profilePhoto ? (
                      <Image source={{ uri: m.profilePhoto }} style={{ width: '100%', height: '100%' }} />
                    ) : (
                      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontSize: 16, fontWeight: '600', color: '#fff' }}>{m.name.charAt(0)}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={{ fontSize: 11, fontWeight: '600', color: colors.text }} numberOfLines={1}>
                    {m.name.split(' ')[0]}
                  </Text>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: count > 0 ? colors.accent : colors.text3 }}>
                    {count}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        {/* ---- Trip / Public underline tabs ---- */}
        <View style={[s.tabRow, { borderBottomColor: colors.border }]}>
          <Pressable
            onPress={() => setTabMode('trip')}
            style={[s.tab, tabMode === 'trip' && s.tabActive]}
          >
            <Text style={[s.tabLabel, { color: tabMode === 'trip' ? colors.text : colors.text3 }]}>Your trip</Text>
            <Text style={[s.tabSub, { color: tabMode === 'trip' ? colors.accent : colors.text3 }]}>{allMoments.length}</Text>
          </Pressable>
          <Pressable
            onPress={() => setTabMode('public')}
            style={[s.tab, tabMode === 'public' && s.tabActive]}
          >
            <Text style={[s.tabLabel, { color: tabMode === 'public' ? colors.text : colors.text3 }]}>Explore</Text>
          </Pressable>
        </View>

        {tabMode === 'public' ? (
          <View style={{ flex: 1 }}>
            <React.Suspense fallback={<View style={{ padding: 40, alignItems: 'center' }}><Text style={{ color: colors.text3 }}>Loading...</Text></View>}>
              <ExploreMomentsFeed />
            </React.Suspense>
          </View>
        ) : (
          <>
            {/* ---- Person filter ---- */}
            <PersonChips
              active={activePerson}
              onChange={setActivePerson}
              members={members}
              counts={personCounts}
              total={allMoments.length}
            />

            {/* ---- Scope filter + hidden toggle ---- */}
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <ScopeChips
                  active={activeScope}
                  onChange={setActiveScope}
                  counts={scopeCounts}
                />
              </View>
              {dismissedIds.size > 0 && (
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setShowHidden((v) => !v);
                  }}
                  hitSlop={10}
                  style={{ paddingHorizontal: 14, paddingVertical: 6 }}
                >
                  {showHidden ? (
                    <Eye size={18} color={colors.accent} />
                  ) : (
                    <EyeOff size={18} color={colors.text3} />
                  )}
                </Pressable>
              )}
            </View>

            {activeScope === 'album' ? (
              <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 100 }}>
                <AlbumsGrid
                  tripId={tripId}
                  totalMoments={allMoments.length}
                  privateMoments={scopeCounts.me}
                  onSwitchScope={setActiveScope}
                />
              </ScrollView>
            ) : filtered.length === 0 ? (
              <View style={s.emptyWrap}>
                <Text style={[s.emptyTitle, { color: colors.text }]}>No moments yet</Text>
                <Text style={[s.emptySub, { color: colors.text3 }]}>
                  Add photos for this trip, or explore what other travelers are sharing.
                </Text>
                <View style={s.emptyActions}>
                  <Pressable
                    style={[s.emptyActionBtn, { backgroundColor: colors.accent, borderColor: colors.accent }]}
                    onPress={() => router.push({ pathname: '/add-moment', params: tripId ? { tripId } : {} } as never)}
                  >
                    <Camera size={15} color={colors.ink} strokeWidth={2} />
                    <Text style={[s.emptyActionText, { color: colors.ink }]}>Add photos</Text>
                  </Pressable>
                  <Pressable
                    style={[s.emptyActionBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
                    onPress={() => setTabMode('public')}
                  >
                    <Compass size={15} color={colors.text} strokeWidth={2} />
                    <Text style={[s.emptyActionText, { color: colors.text }]}>Explore</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <ScrollView
                key={`bento-${activeScope}-${activePerson ?? 'all'}`}
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingBottom: 100 }}
                refreshControl={
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={() => { setRefreshing(true); load(true, true); }}
                    tintColor={colors.accentLt}
                  />
                }
              >
                <BentoLayout
                  items={filtered}
                  onOpen={(m) => {
                    const idx = filtered.findIndex((f) => f.id === m.id);
                    setCarouselIndex(idx >= 0 ? idx : 0);
                    setCarouselVisible(true);
                  }}
                  selectedIds={selectedIds}
                  onToggleSelect={(id) => {
                    setSelectedIds((prev) => {
                      const next = new Set(prev);
                      if (next.has(id)) next.delete(id);
                      else next.add(id);
                      return next;
                    });
                  }}
                  selectMode={selectMode}
                  onLongPress={(id) => {
                    if (!selectMode) {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      setSelectMode(true);
                      setSelectedIds(new Set([id]));
                    }
                  }}
                  tripId={tripId}
                />
              </ScrollView>
            )}

            {/* Batch action bar (select mode) */}
            {selectMode && selectedIds.size > 0 && (
              <BatchActionBar
                count={selectedIds.size}
                onAction={handleBatchAction}
                onCancel={() => { setSelectMode(false); setSelectedIds(new Set()); }}
              />
            )}

            {/* Fullscreen Carousel */}
            <Modal
              visible={carouselVisible}
              transparent
              animationType="fade"
              statusBarTranslucent
              onRequestClose={() => setCarouselVisible(false)}
            >
              <PhotoCarousel
                moments={filtered}
                initialIndex={carouselIndex}
                people={people}
                onClose={() => setCarouselVisible(false)}
                onFavorite={handleFavorite}
                onComment={(momentId) => {
                  setCarouselVisible(false);
                  setTimeout(() => setCommentMomentId(momentId), 300);
                }}
                onAction={handlePhotoAction}
                dismissedIds={dismissedIds}
              />
            </Modal>

          </>
        )}
      </View>

      {/* ---- Edit details sheet ---- */}
      <PhotoEditSheet
        visible={editMomentId !== null}
        moment={editMoment}
        onSave={handleEditSave}
        onClose={() => setEditMomentId(null)}
      />

      {/* ---- Photo grid picker for Film ---- */}
      <PhotoGridPicker
        visible={showPhotoPicker}
        moments={filtered.filter((m) => m.photo)}
        onConfirm={(selected) => {
          setShowPhotoPicker(false);
          setFilmMoments(selected);
          setFilmInitIdx(0);
        }}
        onClose={() => setShowPhotoPicker(false)}
      />

      {/* ---- Film editor ---- */}
      {filmMoments && (
        <FilmEditor
          visible={filmMoments !== null}
          moments={filmMoments}
          initialIndex={filmInitIdx}
          onClose={() => setFilmMoments(null)}
        />
      )}

      {/* ---- Polaroid collage ---- */}
      <PolaroidCollage
        visible={collageVisible}
        moments={filtered.filter((m) => selectedIds.has(m.id))}
        onClose={() => {
          setCollageVisible(false);
          setSelectMode(false);
          setSelectedIds(new Set());
        }}
      />

      {/* ---- Curation lightbox ---- */}
      <Modal
        visible={curationDay !== null}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setCurationDay(null)}
      >
        {curationDay && (
          <CurationLightbox
            day={curationDay}
            maxFavorites={3}
            onComplete={handleCurationComplete}
            onDismiss={() => setCurationDay(null)}
          />
        )}
      </Modal>

      {/* Comment Sheet */}
      {commentMomentId && (
        <CommentSheet
          visible={!!commentMomentId}
          momentId={commentMomentId}
          members={members}
          onClose={() => setCommentMomentId(null)}
          onCountChange={(mid, count) => {
            setCommentCountMap(prev => ({ ...prev, [mid]: count }));
          }}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Styles — getStyles factory pattern per CLAUDE.md
// ---------------------------------------------------------------------------

const getStyles = (colors: ReturnType<typeof useTheme>['colors']) =>
  StyleSheet.create({
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: 60,
    },
    // Header
    header: {
      paddingHorizontal: 18,
      paddingTop: 6,
      paddingBottom: 8,
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 10,
    },
    title: {
      fontSize: 32,
      fontWeight: '600',
      letterSpacing: -1.1,
      lineHeight: 36,
    },
    titleCount: {
      fontSize: 13,
      fontWeight: '600',
      fontVariant: ['tabular-nums'],
    },
    subtitle: {
      fontSize: 11.5,
      fontWeight: '500',
      marginTop: 2,
    },
    // Member stats
    memberStatsRow: {
      paddingHorizontal: 16,
      gap: 8,
      paddingBottom: 10,
    },
    memberStatCard: {
      alignItems: 'center',
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 14,
      borderWidth: 1,
      minWidth: 72,
    },
    memberStatAvatar: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 6,
    },
    memberStatAvatarImg: {
      width: 32,
      height: 32,
      borderRadius: 16,
    },
    memberStatInitial: {
      fontSize: 13,
      fontWeight: '700',
      color: '#fff',
    },
    memberStatName: {
      fontSize: 11,
      fontWeight: '600',
      marginBottom: 2,
      maxWidth: 60,
    },
    memberStatCount: {
      fontSize: 16,
      fontWeight: '700',
      fontVariant: ['tabular-nums'] as any,
      marginBottom: 4,
    },
    memberStatBar: {
      width: 48,
      height: 3,
      borderRadius: 2,
      overflow: 'hidden' as const,
    },
    memberStatBarFill: {
      height: 3,
      borderRadius: 2,
    },
    // Underline tabs
    tabRow: {
      flexDirection: 'row',
      paddingHorizontal: 18,
      gap: 22,
      borderBottomWidth: 1,
      marginBottom: 12,
    },
    tab: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 7,
      paddingTop: 8,
      paddingBottom: 10,
      borderBottomWidth: 2,
      borderBottomColor: 'transparent',
      marginBottom: -1,
    },
    tabActive: {
      borderBottomColor: colors.accent,
    },
    tabLabel: {
      fontSize: 14,
      fontWeight: '600',
      letterSpacing: -0.15,
    },
    tabSub: {
      fontSize: 10.5,
      fontWeight: '600',
      fontVariant: ['tabular-nums'],
    },
    // Public placeholder
    publicPlaceholder: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: 80,
      paddingHorizontal: 40,
    },
    publicTitle: {
      fontSize: 20,
      fontWeight: '600',
      letterSpacing: -0.3,
      marginBottom: 8,
    },
    publicSub: {
      fontSize: 13,
      lineHeight: 20,
      textAlign: 'center',
    },
    // Empty state
    emptyWrap: {
      flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, paddingTop: 60,
    },
    emptyTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
    emptySub: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
    emptyActions: { flexDirection: 'row', gap: 10, marginTop: 18 },
    emptyActionBtn: {
      minHeight: 42,
      paddingHorizontal: 16,
      borderRadius: 12,
      borderWidth: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
    },
    emptyActionText: { fontSize: 13, fontWeight: '700' },
  });
