import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import Svg, { Path, Circle as SvgCircle } from 'react-native-svg';
import { useTheme } from '@/constants/ThemeContext';
import { getMoments, getGroupMembers } from '@/lib/supabase';
import { formatDatePHT } from '@/lib/utils';
import type { Moment, GroupMember } from '@/lib/types';
import type { MomentDisplay, PeopleMap } from './types';
import { StatBlock } from './StatBlock';
import { DayChips } from './DayChips';
import { BentoLayout } from './BentoLayout';
import { MosaicLayout } from './MosaicLayout';
import { DiaryLayout } from './DiaryLayout';
import { MapLayout } from './MapLayout';
import { MomentLightbox } from './MomentLightbox';
import { PhotoActionSheet } from './PhotoActionSheet';
import { PhotoEditSheet } from './PhotoEditSheet';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LAYOUT_STORAGE_KEY = 'afterstay_moments_layout';
const PEOPLE_COLORS = ['#a64d1e', '#b8892b', '#c66a36', '#7f3712', '#9a7d52'];

type LayoutMode = 'bento' | 'mosaic' | 'diary' | 'map';

const LAYOUT_OPTIONS: { value: LayoutMode; label: string }[] = [
  { value: 'bento', label: 'Bento' },
  { value: 'mosaic', label: 'Grid' },
  { value: 'diary', label: 'Diary' },
  { value: 'map', label: 'Map' },
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface MomentsTabProps {
  tripId?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildPeopleMap(
  members: GroupMember[],
): PeopleMap {
  const people: PeopleMap = {};
  members.forEach((m, i) => {
    const initial = m.name.charAt(0).toUpperCase();
    people[initial] = {
      name: m.name,
      color: PEOPLE_COLORS[i % PEOPLE_COLORS.length],
    };
    people[m.name] = {
      name: m.name,
      color: PEOPLE_COLORS[i % PEOPLE_COLORS.length],
    };
  });
  return people;
}

function buildMomentDisplays(moments: Moment[]): MomentDisplay[] {
  return moments.map((m) => {
    const authorKey = m.takenBy
      ? m.takenBy.charAt(0).toUpperCase()
      : '';
    return {
      ...m,
      place: m.location,
      authorKey,
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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MomentsTab({ tripId }: MomentsTabProps) {
  const { colors } = useTheme();
  const router = useRouter();
  const s = useMemo(() => getStyles(colors), [colors]);

  const [rawMoments, setRawMoments] = useState<Moment[]>([]);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeDay, setActiveDay] = useState('all');
  const [layout, setLayout] = useState<LayoutMode>('bento');
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const selectMode = selectedIds.size > 0;
  const [actionMomentId, setActionMomentId] = useState<string | null>(null);
  const [editMomentId, setEditMomentId] = useState<string | null>(null);
  const actionMoment = actionMomentId ? rawMoments.find((m) => m.id === actionMomentId) ?? null : null;
  const editMoment = editMomentId ? rawMoments.find((m) => m.id === editMomentId) ?? null : null;

  // Load persisted layout preference
  useEffect(() => {
    AsyncStorage.getItem(LAYOUT_STORAGE_KEY).then((stored) => {
      if (stored === 'bento' || stored === 'mosaic' || stored === 'diary' || stored === 'map') {
        setLayout(stored);
      }
    });
  }, []);

  // Multi-select handlers
  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleLongPress = useCallback((id: string) => {
    setActionMomentId(id);
  }, []);

  const handleActionShare = useCallback(() => {
    if (!actionMoment?.photo) return;
    import('react-native').then(({ Share }) => {
      Share.share({
        message: actionMoment.caption
          ? `${actionMoment.caption} — ${actionMoment.location ?? ''}`
          : 'Trip moment',
        url: actionMoment.photo,
      });
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
          try { await deletePage(id); } catch { /* skip */ }
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
    } catch { /* ignore */ }
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
              try { await deletePage(id); } catch { /* skip */ }
            }
            setRawMoments((prev) => prev.filter((m) => !selectedIds.has(m.id)));
            setSelectedIds(new Set());
          },
        },
      ],
    );
  }, [selectedIds]);

  // Fetch moments + group members
  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [moments, groupMembers] = await Promise.all([
        getMoments(tripId).catch(() => [] as Moment[]),
        getGroupMembers(tripId).catch(() => [] as GroupMember[]),
      ]);
      setRawMoments(moments);
      setMembers(groupMembers);
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    load();
  }, [load]);

  // Build derived data
  const people = useMemo(() => buildPeopleMap(members), [members]);
  const allMoments = useMemo(() => buildMomentDisplays(rawMoments), [rawMoments]);
  const dayCounts = useMemo(() => computeDayCounts(allMoments), [allMoments]);
  const uniquePlaces = useMemo(
    () => new Set(allMoments.map((m) => m.place ?? m.location).filter(Boolean)).size,
    [allMoments],
  );
  const dayCount = useMemo(() => Object.keys(dayCounts).length, [dayCounts]);

  const filtered = useMemo(
    () =>
      activeDay === 'all'
        ? allMoments
        : allMoments.filter((m) => m.date === activeDay),
    [allMoments, activeDay],
  );

  // Layout persistence
  const handleLayoutChange = useCallback((newLayout: LayoutMode) => {
    setLayout(newLayout);
    AsyncStorage.setItem(LAYOUT_STORAGE_KEY, newLayout);
  }, []);

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
      <ScrollView
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ---- Stats strip ---- */}
        <View style={s.statsRow}>
          <StatBlock label="Moments" value={allMoments.length} />
          <StatBlock label="Places" value={uniquePlaces} />
          <StatBlock label="Days" value={dayCount} />
        </View>

        {/* ---- Day filter chips ---- */}
        <DayChips
          active={activeDay}
          onChange={setActiveDay}
          counts={dayCounts}
          total={allMoments.length}
        />

        {/* ---- Layout switcher ---- */}
        <View style={s.switcherRow}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => router.push('/moments-slideshow' as never)}
          >
            <Text style={s.momentCountText}>
              {filtered.length} {filtered.length === 1 ? 'moment' : 'moments'}
              {activeDay !== 'all' ? ` · ${formatDatePHT(activeDay)}` : ''}
              {' →'}
            </Text>
          </TouchableOpacity>

          <View style={s.segmented}>
            {LAYOUT_OPTIONS.map((opt) => (
              <Pressable
                key={opt.value}
                onPress={() => handleLayoutChange(opt.value)}
                style={[
                  s.segBtn,
                  layout === opt.value && s.segBtnActive,
                ]}
              >
                <Text
                  style={[
                    s.segText,
                    { color: layout === opt.value ? colors.text : colors.text3 },
                  ]}
                >
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* ---- Select mode toolbar ---- */}
        {selectMode && (
          <View style={s.selectBar}>
            <Pressable onPress={() => setSelectedIds(new Set())}>
              <Text style={s.selectBarCancel}>Cancel</Text>
            </Pressable>
            <Text style={s.selectBarCount}>{selectedIds.size} selected</Text>
            <Pressable onPress={handleDeleteSelected}>
              <Text style={s.selectBarDelete}>Delete</Text>
            </Pressable>
          </View>
        )}

        {/* ---- Layout content ---- */}
        {layout === 'bento' && (
          <BentoLayout
            items={filtered}
            onOpen={handleOpen}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
            selectMode={selectMode}
            onLongPress={handleLongPress}
          />
        )}

        {layout === 'mosaic' && (
          <MosaicLayout
            items={filtered}
            onOpen={handleOpen}
            people={people}
          />
        )}

        {layout === 'diary' && (
          <DiaryLayout
            items={filtered}
            onOpen={handleOpen}
            people={people}
          />
        )}

        {layout === 'map' && (
          <MapLayout
            items={filtered}
            onOpen={handleOpen}
            people={people}
          />
        )}

        {/* ---- Upload CTA ---- */}
        <View style={s.ctaWrapper}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => router.push('/add-moment' as never)}
            style={s.addButton}
          >
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
              <Path
                d="M14.5 4l1.5 2h3a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h3l1.5-2z"
                stroke={colors.text2}
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
              <SvgCircle
                cx={12}
                cy={13}
                r={3.5}
                stroke={colors.text2}
                strokeWidth={1.8}
                fill="none"
              />
            </Svg>
            <Text style={s.addButtonText}>Add moment</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* ---- Lightbox ---- */}
      <MomentLightbox
        moment={openItem}
        index={openIdx ?? 0}
        total={filtered.length}
        onClose={() => setOpenIdx(null)}
        onPrev={() =>
          setOpenIdx((prev) =>
            prev != null
              ? (prev - 1 + filtered.length) % filtered.length
              : 0,
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
    statsRow: {
      flexDirection: 'row',
      paddingHorizontal: 16,
      paddingBottom: 14,
      gap: 8,
    },
    switcherRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingBottom: 14,
    },
    momentCountText: {
      fontSize: 11,
      color: colors.text3,
    },
    segmented: {
      flexDirection: 'row',
      padding: 2,
      backgroundColor: colors.card2,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      gap: 2,
    },
    segBtn: {
      paddingVertical: 5,
      paddingHorizontal: 10,
      borderRadius: 9,
    },
    segBtnActive: {
      backgroundColor: colors.card,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.30,
      shadowRadius: 6,
      elevation: 4,
    },
    segText: {
      fontSize: 10.5,
      fontWeight: '600',
      letterSpacing: -0.1,
    },
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
      backgroundColor: colors.card,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: colors.border2,
      borderRadius: 14,
    },
    addButtonText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text2,
    },
    selectBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 10,
      backgroundColor: colors.card,
      borderRadius: 12,
      marginHorizontal: 16,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    selectBarCancel: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text2,
    },
    selectBarCount: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.text,
    },
    selectBarDelete: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.danger,
    },
  });
