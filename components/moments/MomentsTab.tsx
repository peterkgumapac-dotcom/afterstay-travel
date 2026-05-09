import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Haptics from 'expo-haptics';
import * as MediaLibrary from 'expo-media-library';
import { useIsFocused } from '@react-navigation/native';
import {
  Alert,
  Image,
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  Share,
  Modal,
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { useRouter } from 'expo-router';
import { Camera, Filter, Eye, EyeOff, X } from 'lucide-react-native';
import { useTheme } from '@/constants/ThemeContext';
import { useAuth } from '@/lib/auth';
import { pushProfile } from '@/lib/profileNavigation';
import { useTabBarVisibility } from '@/app/(tabs)/_layout';
import { CurationLightbox } from '@/components/curation/CurationLightbox';
import { getMomentFavorites, getCommentCounts, toggleFavorite, toggleMomentVisibility as toggleVisibility, setMomentVisibility, batchSetMomentVisibility, batchDeleteMoments, getDismissedMomentIds, dismissMoment, undismissMoment, batchDismissMoments, saveGroupPhotoToPrivate, publishMomentToExplore, unpublishMomentFromExplore } from '@/lib/supabase';
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
import type { Moment, GroupMember } from '@/lib/types';
import { getMomentImageUri, hasMomentImage, type MomentDisplay, type PeopleMap } from './types';
import type { PhotoAction } from './PhotoActionsSheet';
import { PersonChips } from './PersonChips';
import { ScopeChips } from './ScopeChips';
import type { ScopeFilter } from './ScopeChips';
import { AlbumsGrid } from './AlbumsGrid';
import { BentoLayout } from './BentoLayout';
import { PhotoCarousel } from './PhotoCarousel';
import { PhotoEditSheet } from './PhotoEditSheet';
import { BatchActionBar, type BatchAction } from './BatchActionBar';
import { PolaroidCollage } from './PolaroidCollage';

const MOMENTS_LOAD_TIMEOUT_MS = 10000;

function withLoadTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out`)), MOMENTS_LOAD_TIMEOUT_MS);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PEOPLE_COLORS = ['#a64d1e', '#b8892b', '#c66a36', '#7f3712', '#9a7d52'];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface MomentsTabProps {
  tripId?: string;
}

type AlbumMode = 'timeline' | 'people' | 'places' | 'favorites';

const ALBUM_MODES: { id: AlbumMode; label: string }[] = [
  { id: 'timeline', label: 'Timeline' },
  { id: 'people', label: 'People' },
  { id: 'places', label: 'Places' },
  { id: 'favorites', label: 'Favorites' },
];

function buildPeopleMap(members: GroupMember[]): PeopleMap {
  const people: PeopleMap = {};
  members.forEach((m, i) => {
    const entry = {
      name: m.name,
      color: PEOPLE_COLORS[i % PEOPLE_COLORS.length],
      avatar: m.profilePhoto,
    };
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
    const personEntry = m.userId ? people[m.userId] : undefined;
    const fav = m.id ? favorites[m.id] : undefined;
    return {
      ...m,
      place: m.location,
      authorKey,
      authorColor: personEntry?.color,
      authorAvatar: personEntry?.avatar,
      isMine: !!(currentUserId && m.userId === currentUserId),
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
  const rawMomentsRef = useRef<Moment[]>([]);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [activePerson, setActivePerson] = useState<string | null>(null);
  const [showContributors, setShowContributors] = useState(false);
  const [filterSheetVisible, setFilterSheetVisible] = useState(false);
  const [albumMode, setAlbumMode] = useState<AlbumMode>('timeline');
  const [activeScope, setActiveScope] = useState<ScopeFilter>('all');
  const [favoriteMap, setFavoriteMap] = useState<MomentFavoriteMap>({});
  const [commentCountMap, setCommentCountMap] = useState<Record<string, number>>({});
  const [commentMomentId, setCommentMomentId] = useState<string | null>(null);

  const [editMomentId, setEditMomentId] = useState<string | null>(null);
  const [curationDay, setCurationDay] = useState<{ dateLabel: string; photos: { id: string; uri: string }[] } | null>(null);

  // Bento grid selection + carousel state
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [collageVisible, setCollageVisible] = useState(false);
  const [carouselVisible, setCarouselVisible] = useState(false);
  const [carouselIndex, setCarouselIndex] = useState(0);

  // Per-user dismissals (hide/show group photos)
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [showHidden, setShowHidden] = useState(false);

  useEffect(() => {
    rawMomentsRef.current = rawMoments;
  }, [rawMoments]);

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
    const imageUrl = getMomentImageUri(moment);
    if (action === 'share') {
      Share.share({
        message: [moment.caption, moment.location].filter(Boolean).join(' — '),
        url: imageUrl,
      });
    } else if (action === 'share-hd') {
      const hdUrl = getMomentImageUri(moment, { preferHd: true });
      Share.share({
        message: [moment.caption, moment.location].filter(Boolean).join(' — '),
        url: hdUrl,
      });
    } else if (action === 'download-hd') {
      const hdUrl = getMomentImageUri(moment, { preferHd: true });
      if (hdUrl) {
        (async () => {
          try {
            const { status } = await MediaLibrary.requestPermissionsAsync();
            if (status !== 'granted') {
              Alert.alert('Permission needed', 'Allow photo library access to save photos.');
              return;
            }
            const cleanUrl = hdUrl.split('?')[0] ?? hdUrl;
            const ext = cleanUrl.match(/\.(jpe?g|png|heic|webp)$/i)?.[0] || '.jpeg';
            const localPath = `${FileSystem.cacheDirectory}moment-${moment.id}${ext}`;
            const download = await FileSystem.downloadAsync(hdUrl, localPath);
            await MediaLibrary.saveToLibraryAsync(download.uri);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert('Saved', 'Photo saved to your gallery.');
          } catch (err) {
            Alert.alert('Save failed', 'Could not save this photo. Please try again.');
            if (__DEV__) console.warn('[Moments] photo save failed:', err);
          }
        })();
      }
    } else if (action === 'edit-photo') {
      return;
    } else if (action === 'reel') {
      return;
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
      .filter(hasMomentImage)
      .map((m) => ({ id: m.id, uri: getMomentImageUri(m, { preferHd: true }) }));
    if (photosForCuration.length === 0) return;
    const dateLabel = day === 'all' ? 'All Days' : formatDatePHT(day);
    setCurationDay({ dateLabel, photos: photosForCuration });
  }, [rawMoments]);

  const handleCurationComplete = useCallback((favorites: string[]) => {
    void favorites;
    setCurationDay(null);
  }, []);

  // Fetch moments + group members + favorites
  const load = useCallback(async (silent = false, forceRefresh = false) => {
    try {
      if (!silent) setLoading(true);
      if (!silent || forceRefresh) setLoadError(null);

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

      const moments = await withLoadTimeout(getMomentsPromise(tripId ?? '', forceRefresh), 'Moments');
      const [groupMembers, favs] = await Promise.all([
        withLoadTimeout(getGroupMembersPromise(tripId ?? '', forceRefresh), 'Trip members').catch((error) => {
          if (__DEV__) console.warn('[Moments] member load failed:', error);
          return getGroupMembersCached(tripId) ?? [];
        }),
        withLoadTimeout(getMomentFavorites(tripId), 'Favorites').catch((error) => {
          if (__DEV__) console.warn('[Moments] favorite load failed:', error);
          return {} as MomentFavoriteMap;
        }),
      ]);
      setRawMoments(moments);
      setMembers(groupMembers);
      setFavoriteMap(favs);
      setLoadError(null);

      // Keep first paint light; enrich counts, dismissals, cache writes, and
      // image warmup after navigation/scroll interactions settle.
      const momentIds = moments.map(m => m.id).filter(Boolean) as string[];
      setTimeout(() => {
        if (momentIds.length > 0) {
          getCommentCounts(momentIds).then(setCommentCountMap).catch(() => {});
        }
        if (tripId) {
          getDismissedMomentIds(tripId).then(setDismissedIds).catch(() => {});
        }

        if (tripId && moments.length > 0) {
          cachePhotoMeta(
            moments.map((m) => ({
              id: m.id,
              tripId,
              photoUrl: getMomentImageUri(m) || undefined,
              caption: m.caption ?? undefined,
              location: m.location ?? undefined,
              date: m.date ?? undefined,
              takenBy: m.takenBy ?? undefined,
              visibility: m.visibility ?? undefined,
            }))
          ).catch(() => {});
        }

        setTimeout(() => {
          moments.filter(hasMomentImage).slice(0, 3).forEach((m) => {
            Image.prefetch(getMomentImageUri(m)).catch(() => {});
          });
        }, 800);
      }, 400);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not load moments';
      if (__DEV__) console.warn('[Moments] load failed:', error);
      setLoadError(message);
      if (rawMomentsRef.current.length === 0) {
        setRawMoments([]);
      }
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

  const favoriteCount = useMemo(
    () => allMoments.filter((m) => (m.favoriteCount ?? 0) > 0 || m.isFavorited).length,
    [allMoments],
  );
  const modeCounts = useMemo<Record<AlbumMode, number>>(() => ({
    timeline: allMoments.length,
    people: contributorCount,
    places: uniquePlaces,
    favorites: favoriteCount,
  }), [allMoments.length, contributorCount, favoriteCount, uniquePlaces]);
  const activeFiltersCount = (activePerson ? 1 : 0) + (activeScope !== 'all' ? 1 : 0) + (showHidden ? 1 : 0);

  const filtered = useMemo(() => {
    let result = allMoments;
    if (albumMode === 'places') result = result.filter((m) => !!(m.place ?? m.location));
    if (albumMode === 'favorites') {
      result = result.filter((m) => (m.favoriteCount ?? 0) > 0 || m.isFavorited);
    } else {
      if (activePerson) result = result.filter((m) => m.userId === activePerson);
      if (activeScope === 'group') result = result.filter((m) => m.visibility === 'shared' || m.visibility === 'public');
      else if (activeScope === 'me') result = result.filter((m) => m.visibility === 'private');
      else if (activeScope === 'album') result = result.filter((m) => m.visibility === 'album');
      else if (activeScope === 'favorites') result = result.filter((m) => (m.favoriteCount ?? 0) > 0 || m.isFavorited);
    }
    // Per-user dismissals — hide unless toggle is on
    if (!showHidden && dismissedIds.size > 0) {
      result = result.filter((m) => !dismissedIds.has(m.id));
    }
    return result;
  }, [allMoments, activePerson, activeScope, albumMode, showHidden, dismissedIds]);

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
                {dayCount} days · {uniquePlaces} places · {contributorCount || 1} contributor{(contributorCount || 1) === 1 ? '' : 's'}
              </Text>
            </View>
          </View>
          <Pressable
            style={[s.filterButton, { borderColor: colors.border, backgroundColor: colors.card }]}
            onPress={() => setFilterSheetVisible(true)}
            accessibilityRole="button"
            accessibilityLabel="Filter and manage moments"
          >
            <Filter size={15} color={colors.text2} strokeWidth={2} />
            <Text style={[s.filterButtonText, { color: colors.text2 }]}>Filter</Text>
            {activeFiltersCount > 0 ? (
              <View style={[s.filterCount, { backgroundColor: colors.accent }]}>
                <Text style={s.filterCountText}>{activeFiltersCount}</Text>
              </View>
            ) : null}
          </Pressable>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.modeRow}>
          {ALBUM_MODES.map((mode) => {
            const active = albumMode === mode.id;
            return (
              <Pressable
                key={mode.id}
                onPress={() => {
                  Haptics.selectionAsync();
                  setAlbumMode(mode.id);
                  if (mode.id !== 'timeline') setActiveScope('all');
                  if (mode.id === 'people') setShowContributors(true);
                }}
                style={[s.modeChip, { borderColor: active ? colors.accent : colors.border, backgroundColor: active ? colors.accent : colors.card }]}
              >
                <Text style={[s.modeLabel, { color: active ? colors.onBlack : colors.text2 }]}>{mode.label}</Text>
                <Text style={[s.modeCount, { color: active ? colors.onBlack : colors.text3 }]}>{modeCounts[mode.id]}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* ---- Expandable contributor row ---- */}
        {(showContributors || albumMode === 'people') && members.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 10, paddingVertical: 8 }}>
            {members.map((m, i) => {
              const count = m.userId ? (personCounts[m.userId] ?? 0) : 0;
              return (
                <Pressable
                  key={m.id}
                  onPress={() => {
                    if (m.userId) {
                      pushProfile(router, m.userId, user?.id);
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

        {activeScope === 'album' ? (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 100 }}>
            <AlbumsGrid
              tripId={tripId}
              totalMoments={allMoments.length}
              privateMoments={scopeCounts.me}
              onSwitchScope={setActiveScope}
            />
          </ScrollView>
        ) : loadError && allMoments.length === 0 ? (
          <View style={s.emptyWrap}>
            <Text style={[s.emptyTitle, { color: colors.text }]}>Could not load moments</Text>
            <Text style={[s.emptySub, { color: colors.text3 }]}>
              {loadError}. Check your connection, then try again.
            </Text>
            <View style={s.emptyActions}>
              <Pressable
                style={[s.emptyActionBtn, { backgroundColor: colors.accent, borderColor: colors.accent }]}
                onPress={() => { setRefreshing(true); load(false, true); }}
              >
                <Text style={[s.emptyActionText, { color: colors.ink }]}>Retry</Text>
              </Pressable>
            </View>
          </View>
        ) : filtered.length === 0 ? (
          <View style={s.emptyWrap}>
            <Text style={[s.emptyTitle, { color: colors.text }]}>No moments yet</Text>
            <Text style={[s.emptySub, { color: colors.text3 }]}>
              Add photos for this trip to build your private and group memory library.
            </Text>
            <View style={s.emptyActions}>
              <Pressable
                style={[s.emptyActionBtn, { backgroundColor: colors.accent, borderColor: colors.accent }]}
                onPress={() => router.push({ pathname: '/add-moment', params: tripId ? { tripId } : {} } as never)}
              >
                <Camera size={15} color={colors.ink} strokeWidth={2} />
                <Text style={[s.emptyActionText, { color: colors.ink }]}>Add photos</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <BentoLayout
            key={`bento-${activeScope}-${activePerson ?? 'all'}`}
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
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(true, true); }}
            contentContainerStyle={{ paddingBottom: 100 }}
          />
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

        <Modal
          visible={filterSheetVisible}
          transparent
          animationType="slide"
          statusBarTranslucent
          onRequestClose={() => setFilterSheetVisible(false)}
        >
          <Pressable style={s.sheetBackdrop} onPress={() => setFilterSheetVisible(false)} />
          <View style={[s.filterSheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={s.sheetHandle} />
            <View style={s.sheetHeader}>
              <View>
                <Text style={[s.sheetKicker, { color: colors.text3 }]}>Moments controls</Text>
                <Text style={[s.sheetTitle, { color: colors.text }]}>Filter and manage</Text>
              </View>
              <Pressable
                style={[s.sheetClose, { backgroundColor: colors.card2 }]}
                onPress={() => setFilterSheetVisible(false)}
                accessibilityRole="button"
                accessibilityLabel="Close filters"
              >
                <X size={17} color={colors.text2} />
              </Pressable>
            </View>

            <Text style={[s.sheetSectionLabel, { color: colors.text3 }]}>People</Text>
            <PersonChips
              active={activePerson}
              onChange={setActivePerson}
              members={members}
              counts={personCounts}
              total={allMoments.length}
            />

            <Text style={[s.sheetSectionLabel, { color: colors.text3 }]}>Visibility</Text>
            <ScopeChips
              active={activeScope}
              onChange={setActiveScope}
              counts={scopeCounts}
            />

            <View style={s.sheetActionRow}>
              {dismissedIds.size > 0 && (
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setShowHidden((v) => !v);
                  }}
                  style={[s.sheetAction, { borderColor: colors.border, backgroundColor: showHidden ? colors.accentBg : colors.card2 }]}
                >
                  {showHidden ? (
                    <Eye size={17} color={colors.accent} />
                  ) : (
                    <EyeOff size={17} color={colors.text3} />
                  )}
                  <Text style={[s.sheetActionText, { color: showHidden ? colors.accent : colors.text2 }]}>
                    {showHidden ? 'Showing hidden' : 'Hidden off'}
                  </Text>
                </Pressable>
              )}
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync();
                  setSelectMode((v) => !v);
                  setSelectedIds(new Set());
                  setFilterSheetVisible(false);
                }}
                style={[s.sheetAction, { borderColor: colors.border, backgroundColor: selectMode ? colors.accentBg : colors.card2 }]}
              >
                <Text style={[s.sheetActionText, { color: selectMode ? colors.accent : colors.text2 }]}>
                  {selectMode ? 'Exit manage' : 'Manage photos'}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  handleCurationLongPress('all');
                  setFilterSheetVisible(false);
                }}
                style={[s.sheetAction, { borderColor: colors.border, backgroundColor: colors.card2 }]}
              >
                <Text style={[s.sheetActionText, { color: colors.text2 }]}>Curate highlights</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setActivePerson(null);
                  setActiveScope('all');
                  setShowHidden(false);
                  setAlbumMode('timeline');
                }}
                style={[s.sheetAction, { borderColor: colors.border, backgroundColor: colors.card2 }]}
              >
                <Text style={[s.sheetActionText, { color: colors.text2 }]}>Reset</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      </View>

      {/* ---- Edit details sheet ---- */}
      <PhotoEditSheet
        visible={editMomentId !== null}
        moment={editMoment}
        onSave={handleEditSave}
        onClose={() => setEditMomentId(null)}
      />

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
    filterButton: {
      minHeight: 38,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      borderRadius: 999,
      borderWidth: 1,
    },
    filterButtonText: {
      fontSize: 12,
      fontWeight: '800',
    },
    filterCount: {
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 5,
    },
    filterCountText: {
      color: '#fff',
      fontSize: 10,
      fontWeight: '800',
      fontVariant: ['tabular-nums'],
    },
    modeRow: {
      paddingHorizontal: 16,
      paddingBottom: 12,
      gap: 7,
      flexDirection: 'row',
    },
    modeChip: {
      minHeight: 38,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      paddingHorizontal: 13,
      borderRadius: 999,
      borderWidth: 1,
    },
    modeLabel: {
      fontSize: 12,
      fontWeight: '800',
    },
    modeCount: {
      fontSize: 10,
      fontWeight: '800',
      opacity: 0.78,
      fontVariant: ['tabular-nums'],
    },
    sheetBackdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.36)',
    },
    filterSheet: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      borderTopLeftRadius: 26,
      borderTopRightRadius: 26,
      borderWidth: 1,
      paddingTop: 10,
      paddingBottom: 30,
      shadowColor: '#000',
      shadowOpacity: 0.24,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: -8 },
      elevation: 20,
    },
    sheetHandle: {
      alignSelf: 'center',
      width: 44,
      height: 4,
      borderRadius: 99,
      backgroundColor: colors.border,
      marginBottom: 14,
    },
    sheetHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 18,
      marginBottom: 14,
    },
    sheetKicker: {
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 1.5,
      textTransform: 'uppercase',
      marginBottom: 3,
    },
    sheetTitle: {
      fontSize: 21,
      fontWeight: '800',
      letterSpacing: -0.5,
    },
    sheetClose: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sheetSectionLabel: {
      paddingHorizontal: 18,
      paddingTop: 8,
      paddingBottom: 8,
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 1.4,
      textTransform: 'uppercase',
    },
    sheetActionRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      paddingHorizontal: 18,
      paddingTop: 6,
    },
    sheetAction: {
      minHeight: 42,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      paddingHorizontal: 13,
      borderRadius: 14,
      borderWidth: 1,
    },
    sheetActionText: {
      fontSize: 12,
      fontWeight: '800',
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
