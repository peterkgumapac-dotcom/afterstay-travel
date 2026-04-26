import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Haptics from 'expo-haptics';
import { useIsFocused } from '@react-navigation/native';
import {
  Alert,
  View,
  Text,
  RefreshControl,
  ScrollView,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Film as FilmIcon, Star, Trash2, X as XIcon } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useTheme } from '@/constants/ThemeContext';
import { useAuth } from '@/lib/auth';
import { getMoments, getGroupMembers, getMomentFavorites, toggleFavorite, toggleMomentVisibility as toggleVisibility, promoteMomentsToGroup, batchFavorite } from '@/lib/supabase';
import type { MomentFavoriteMap } from '@/lib/supabase';
import { formatDatePHT } from '@/lib/utils';
import type { Moment, GroupMember, MomentVisibility } from '@/lib/types';
import type { MomentDisplay, PeopleMap } from './types';
import { PersonChips } from './PersonChips';
import { ScopeChips } from './ScopeChips';
import type { ScopeFilter } from './ScopeChips';
import { DaySectionHeader } from './DaySectionHeader';
import { DayRail } from './DayRail';
import { AlbumsGrid } from './AlbumsGrid';
import { BentoLayout } from './BentoLayout';
import { MomentLightbox } from './MomentLightbox';
import { PhotoActionSheet } from './PhotoActionSheet';
import { PhotoEditSheet } from './PhotoEditSheet';
import { FilmEditor } from './FilmEditor';
import { PhotoGridPicker } from './PhotoGridPicker';
import { CurationLightbox } from '@/components/curation/CurationLightbox';
import { Modal } from 'react-native';

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

/** Build day entries for the DayRail from date keys. */
function buildDayEntries(dayCounts: Record<string, number>): { key: string; dayNum: string; count: number }[] {
  return Object.keys(dayCounts)
    .sort((a, b) => b.localeCompare(a))
    .map((key) => {
      const d = new Date(key + 'T00:00:00+08:00');
      return {
        key,
        dayNum: String(d.getDate()),
        count: dayCounts[key],
      };
    });
}

/** Group moments by day for section headers. */
function groupByDay(moments: MomentDisplay[]): { date: string; label: string; sub: string; moments: MomentDisplay[] }[] {
  const groups: Record<string, MomentDisplay[]> = {};
  moments.forEach((m) => {
    if (!groups[m.date]) groups[m.date] = [];
    groups[m.date].push(m);
  });

  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  return Object.keys(groups)
    .sort((a, b) => b.localeCompare(a))
    .map((date) => {
      let label: string;
      if (date === today) label = 'Today';
      else if (date === yesterday) label = 'Yesterday';
      else label = formatDatePHT(date);

      // Build sub from unique locations
      const locations = [...new Set(groups[date].map((m) => m.place ?? m.location).filter(Boolean))];
      const sub = locations.slice(0, 2).join(' · ') || `${groups[date].length} moments`;

      return { date, label, sub, moments: groups[date] };
    });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MomentsTab({ tripId }: MomentsTabProps) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const s = useMemo(() => getStyles(colors), [colors]);

  const [rawMoments, setRawMoments] = useState<Moment[]>([]);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [tabMode, setTabMode] = useState<TabMode>('trip');
  const [activePerson, setActivePerson] = useState<string | null>(null);
  const [activeScope, setActiveScope] = useState<ScopeFilter>('all');
  const [activeDayRail, setActiveDayRail] = useState<string | null>(null);
  const [favoriteMap, setFavoriteMap] = useState<MomentFavoriteMap>({});

  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const selectMode = selectedIds.size > 0;
  const [actionMomentId, setActionMomentId] = useState<string | null>(null);
  const [editMomentId, setEditMomentId] = useState<string | null>(null);
  const [filmMoments, setFilmMoments] = useState<MomentDisplay[] | null>(null);
  const [filmInitIdx, setFilmInitIdx] = useState(0);
  const [showPhotoPicker, setShowPhotoPicker] = useState(false);
  const [curationDay, setCurationDay] = useState<{ dateLabel: string; photos: { id: string; uri: string }[] } | null>(null);
  const [curatedDays, setCuratedDays] = useState<Set<string>>(new Set());
  const [favoritedIds, setFavoritedIds] = useState<Set<string>>(new Set());

  const actionMoment = actionMomentId ? rawMoments.find((m) => m.id === actionMomentId) ?? null : null;
  const editMoment = editMomentId ? rawMoments.find((m) => m.id === editMomentId) ?? null : null;

  // Action handlers
  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const handleLongPress = useCallback((id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedIds(new Set([id]));
  }, []);

  const handleActionShare = useCallback(async () => {
    if (!actionMoment) return;
    const { Share } = await import('react-native');
    Share.share({
      message: [actionMoment.caption, actionMoment.location].filter(Boolean).join(' — '),
      url: actionMoment.photo,
    });
  }, [actionMoment]);

  const handleActionEdit = useCallback(() => {
    if (actionMomentId) setEditMomentId(actionMomentId);
  }, [actionMomentId]);

  const handleActionSelectMultiple = useCallback(() => {
    if (actionMomentId) setSelectedIds(new Set([actionMomentId]));
  }, [actionMomentId]);

  const handleActionDelete = useCallback(() => {
    if (!actionMomentId) return;
    const id = actionMomentId;
    Alert.alert('Delete photo?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { deletePage } = await import('@/lib/supabase');
          try { await deletePage(id); } catch (err) { if (__DEV__) console.warn('[Moments] operation failed:', err); }
          setRawMoments((prev) => prev.filter((m) => m.id !== id));
        },
      },
    ]);
  }, [actionMomentId]);

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

  const handleDeleteSelected = useCallback(async () => {
    const count = selectedIds.size;
    Alert.alert(
      `Delete ${count} photo${count > 1 ? 's' : ''}?`,
      'This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const { deletePage } = await import('@/lib/supabase');
            for (const id of selectedIds) {
              try { await deletePage(id); } catch (err) { if (__DEV__) console.warn('[Moments] operation failed:', err); }
            }
            setRawMoments((prev) => prev.filter((m) => !selectedIds.has(m.id)));
            setSelectedIds(new Set());
          },
        },
      ],
    );
  }, [selectedIds]);

  const handlePromoteToGroup = useCallback(async () => {
    const ids = [...selectedIds];
    try {
      await promoteMomentsToGroup(ids);
      setRawMoments((prev) =>
        prev.map((m) => ids.includes(m.id) ? { ...m, visibility: 'shared' as MomentVisibility } : m),
      );
      setSelectedIds(new Set());
    } catch (err) { if (__DEV__) console.warn('[Moments] promote failed:', err); }
  }, [selectedIds]);

  const handleBatchFavorite = useCallback(async () => {
    const ids = [...selectedIds];
    try {
      await batchFavorite(ids);
      const newMap = { ...favoriteMap };
      ids.forEach((id) => {
        if (!newMap[id]) newMap[id] = { count: 0, userIds: [] };
        if (user?.id && !newMap[id].userIds.includes(user.id)) {
          newMap[id].count++;
          newMap[id].userIds.push(user.id);
        }
      });
      setFavoriteMap(newMap);
      setSelectedIds(new Set());
    } catch (err) { if (__DEV__) console.warn('[Moments] batch fav failed:', err); }
  }, [selectedIds, favoriteMap, user]);

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
        prev.map((m) => m.id === momentId ? { ...m, visibility: newVis } : m),
      );
    } catch (err) { if (__DEV__) console.warn('[Moments] visibility toggle failed:', err); }
  }, []);

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
  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [moments, groupMembers, favs] = await Promise.all([
        getMoments(tripId).catch(() => [] as Moment[]),
        getGroupMembers(tripId).catch(() => [] as GroupMember[]),
        getMomentFavorites(tripId).catch(() => ({} as MomentFavoriteMap)),
      ]);
      setRawMoments(moments);
      setMembers(groupMembers);
      setFavoriteMap(favs);

      // Prefetch first 20 photos
      const { Image: RNImage } = require('react-native');
      moments.filter((m) => m.photo).slice(0, 20).forEach((m) => RNImage.prefetch(m.photo!).catch(() => {}));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tripId]);

  useEffect(() => { load(); }, [load]);

  // Refresh when screen comes back into focus (e.g. after add-moment, new-album)
  const isFocused = useIsFocused();
  const prevFocused = useRef(false);
  useEffect(() => {
    if (isFocused && !prevFocused.current) {
      load();
    }
    prevFocused.current = isFocused;
  }, [isFocused, load]);

  // Build derived data
  const currentUserId = user?.id;
  const people = useMemo(() => buildPeopleMap(members), [members]);
  const allMoments = useMemo(
    () => buildMomentDisplays(rawMoments, people, currentUserId, favoriteMap),
    [rawMoments, people, currentUserId, favoriteMap],
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
  const dayEntries = useMemo(() => buildDayEntries(dayCounts), [dayCounts]);

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
    if (activeDayRail) result = result.filter((m) => m.date === activeDayRail);
    return result;
  }, [allMoments, activePerson, activeScope, activeDayRail]);

  // Guard stale lightbox index when filtered array changes
  useEffect(() => {
    if (openIdx !== null && openIdx >= filtered.length) {
      setOpenIdx(filtered.length > 0 ? filtered.length - 1 : null);
    }
  }, [filtered.length, openIdx]);

  const dayGroups = useMemo(() => groupByDay(filtered), [filtered]);

  // Lightbox handlers
  const handleOpen = useCallback(
    (moment: MomentDisplay) => {
      const idx = filtered.indexOf(moment);
      setOpenIdx(idx >= 0 ? idx : 0);
    },
    [filtered],
  );

  const openItem = openIdx != null ? filtered[openIdx] ?? null : null;

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
        <ScrollView
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.accentLt} />}
        >
          {/* ---- Header ---- */}
          <View style={s.header}>
            <View>
              <View style={s.titleRow}>
                <Text style={[s.title, { color: colors.text }]}>Moments</Text>
                <Text style={[s.titleCount, { color: colors.accent }]}>{allMoments.length}</Text>
              </View>
              <Text style={[s.subtitle, { color: colors.text3 }]}>
                {dayCount} days · {uniquePlaces} places · {contributorCount} contributor{contributorCount !== 1 ? 's' : ''}
              </Text>
            </View>
            {!selectMode && (
              <TouchableOpacity
                onPress={() => {
                  Haptics.selectionAsync();
                  setSelectedIds(new Set(['__trigger__']));
                  setSelectedIds(new Set());
                }}
                style={[s.selectBtn, { borderColor: colors.border }]}
              >
                <Text style={[s.selectBtnText, { color: colors.text2 }]}>Select</Text>
              </TouchableOpacity>
            )}
          </View>

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
              <Text style={[s.tabLabel, { color: tabMode === 'public' ? colors.text : colors.text3 }]}>Public</Text>
              <Text style={[s.tabSub, { color: tabMode === 'public' ? colors.accent : colors.text3 }]}>Coming soon</Text>
            </Pressable>
          </View>

          {tabMode === 'public' ? (
            <View style={s.publicPlaceholder}>
              <Text style={[s.publicTitle, { color: colors.text }]}>Afterstay Public Feed</Text>
              <Text style={[s.publicSub, { color: colors.text3 }]}>
                See moments from travelers across Afterstay.{'\n'}Coming soon.
              </Text>
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

              {/* ---- Scope filter ---- */}
              <ScopeChips
                active={activeScope}
                onChange={setActiveScope}
                counts={scopeCounts}
              />

              {/* ---- Select mode floating bar ---- */}
              {selectMode && (
                <View style={[s.selBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Pressable onPress={() => setSelectedIds(new Set())} style={[s.selBarClose, { backgroundColor: colors.card2 }]}>
                    <XIcon size={14} color={colors.text2} strokeWidth={2} />
                  </Pressable>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.selBarCount, { color: colors.text }]}>{selectedIds.size} selected</Text>
                    <Text style={[s.selBarSub, { color: colors.text3 }]}>Promote · Album · Save · Delete</Text>
                  </View>
                  <Pressable onPress={handleBatchFavorite} style={[s.selBarAct, { borderColor: colors.border }]}>
                    <Star size={16} color={colors.accent} strokeWidth={2} />
                  </Pressable>
                  <Pressable onPress={handleDeleteSelected} style={[s.selBarAct, { borderColor: colors.border }]}>
                    <Trash2 size={16} color={colors.danger} strokeWidth={2} />
                  </Pressable>
                  <Pressable onPress={handlePromoteToGroup} style={[s.selBarActPrimary, { backgroundColor: colors.accent }]}>
                    <Text style={{ color: colors.onBlack, fontSize: 12, fontWeight: '700' }}>→ Group</Text>
                  </Pressable>
                </View>
              )}

              {/* ---- Albums grid (when Album scope selected) ---- */}
              {activeScope === 'album' ? (
                <AlbumsGrid
                  tripId={tripId}
                  totalMoments={allMoments.length}
                  privateMoments={scopeCounts.me}
                  onSwitchScope={setActiveScope}
                />
              ) : (
                /* ---- Day-grouped mosaic ---- */
                <View style={{ paddingRight: dayEntries.length > 1 ? 32 : 0, position: 'relative' }}>
                  {dayGroups.map((group) => (
                    <View key={group.date}>
                      <DaySectionHeader label={group.label} sub={group.sub} />
                      <BentoLayout
                        items={group.moments}
                        onOpen={handleOpen}
                        selectedIds={selectedIds}
                        onToggleSelect={handleToggleSelect}
                        selectMode={selectMode}
                        onLongPress={handleLongPress}
                      />
                    </View>
                  ))}

                  {/* Day rail (right side) */}
                  <DayRail
                    days={dayEntries}
                    active={activeDayRail}
                    onChange={setActiveDayRail}
                  />
                </View>
              )}

              {/* ---- Upload CTA ---- */}
              <View style={s.ctaWrapper}>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => router.push('/add-moment' as never)}
                  style={[s.addButton, { backgroundColor: colors.card, borderColor: colors.border2 }]}
                >
                  <Text style={[s.addButtonText, { color: colors.text2 }]}>+ Add moment</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </ScrollView>
      </View>

      {/* ---- Lightbox ---- */}
      <MomentLightbox
        moment={openItem}
        index={openIdx ?? 0}
        total={filtered.length}
        onClose={() => setOpenIdx(null)}
        onPrev={() =>
          setOpenIdx((prev) =>
            prev != null ? (prev - 1 + filtered.length) % filtered.length : 0,
          )
        }
        onNext={() =>
          setOpenIdx((prev) =>
            prev != null ? (prev + 1) % filtered.length : 0,
          )
        }
        people={people}
        allMoments={filtered}
        onDelete={(id) => {
          import('@/lib/supabase').then(({ deletePage }) => {
            deletePage(id).catch(() => {});
          });
          setRawMoments((prev) => prev.filter((m) => m.id !== id));
          setOpenIdx(null);
        }}
        onEdit={(id) => {
          setOpenIdx(null);
          setEditMomentId(id);
        }}
        onFilm={(m) => {
          setFilmMoments([m]);
          setFilmInitIdx(0);
        }}
        onFavorite={handleFavorite}
        onToggleVisibility={handleToggleVisibility}
        onCurate={(id, action) => {
          if (action === 'favorite') {
            setRawMoments((prev) =>
              prev.map((m) => (m.id === id ? { ...m, isFavorite: true } : m)),
            );
          } else {
            setRawMoments((prev) =>
              prev.map((m) => (m.id === id ? { ...m, isFavorite: false } : m)),
            );
          }
        }}
      />

      {/* ---- Themed action sheet ---- */}
      <PhotoActionSheet
        visible={actionMomentId !== null}
        title={actionMoment?.caption || actionMoment?.location || 'Photo'}
        onShare={handleActionShare}
        onEdit={handleActionEdit}
        onSelectMultiple={handleActionSelectMultiple}
        onDelete={handleActionDelete}
        onClose={() => setActionMomentId(null)}
      />

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
    scrollContent: {
      paddingBottom: 100,
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
    selectBtn: {
      borderWidth: 1,
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 999,
    },
    selectBtnText: {
      fontSize: 11,
      fontWeight: '600',
      letterSpacing: 0.4,
      textTransform: 'uppercase',
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
    // Selection bar
    selBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginHorizontal: 12,
      marginBottom: 10,
      padding: 10,
      paddingHorizontal: 12,
      borderRadius: 16,
      borderWidth: 1,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 12,
      elevation: 8,
    },
    selBarClose: {
      width: 32,
      height: 32,
      borderRadius: 99,
      alignItems: 'center',
      justifyContent: 'center',
    },
    selBarCount: {
      fontSize: 13,
      fontWeight: '600',
    },
    selBarSub: {
      fontSize: 10.5,
      marginTop: 1,
    },
    selBarAct: {
      width: 36,
      height: 36,
      borderRadius: 99,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    selBarActPrimary: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 99,
    },
    // CTA
    ctaWrapper: {
      paddingHorizontal: 16,
      paddingTop: 20,
    },
    addButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderRadius: 14,
    },
    addButtonText: {
      fontSize: 13,
      fontWeight: '600',
    },
  });
