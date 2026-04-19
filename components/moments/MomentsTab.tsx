import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
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
import { Camera } from 'lucide-react-native';
import { useTheme } from '@/constants/ThemeContext';
import { spacing, radius } from '@/constants/theme';
import { getMoments, getGroupMembers } from '@/lib/supabase';
import type { Moment, GroupMember } from '@/lib/types';
import type { MomentDisplay } from './types';
import { StatBlock } from './StatBlock';
import { DayChips } from './DayChips';
import { MosaicLayout } from './MosaicLayout';
import { DiaryLayout } from './DiaryLayout';
import { MomentLightbox } from './MomentLightbox';
import { MapLayout } from './MapLayout';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LAYOUT_STORAGE_KEY = 'afterstay_moments_layout';
const PEOPLE_COLORS = ['#a64d1e', '#b8892b', '#c66a36', '#7f3712', '#9a7d52'];

type LayoutMode = 'mosaic' | 'diary' | 'map';

const LAYOUT_OPTIONS: { value: LayoutMode; label: string }[] = [
  { value: 'mosaic', label: 'Mosaic' },
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
): Record<string, { name: string; color: string }> {
  const people: Record<string, { name: string; color: string }> = {};
  members.forEach((m, i) => {
    const initial = m.name.charAt(0).toUpperCase();
    people[initial] = {
      name: m.name,
      color: PEOPLE_COLORS[i % PEOPLE_COLORS.length],
    };
    // Also map by full name for takenBy lookups
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

  const [rawMoments, setRawMoments] = useState<Moment[]>([]);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeDay, setActiveDay] = useState('all');
  const [layout, setLayout] = useState<LayoutMode>('mosaic');
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  // Load persisted layout preference
  useEffect(() => {
    AsyncStorage.getItem(LAYOUT_STORAGE_KEY).then((stored) => {
      if (stored === 'mosaic' || stored === 'diary' || stored === 'map') {
        setLayout(stored);
      }
    });
  }, []);

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
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={colors.accentLt} />
      </View>
    );
  }

  return (
    <>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ---- Stats strip ---- */}
        <View style={styles.statsRow}>
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
        <View style={styles.switcherRow}>
          <Text style={[styles.momentCountText, { color: colors.text3 }]}>
            {filtered.length} {filtered.length === 1 ? 'moment' : 'moments'}
            {activeDay !== 'all' ? ` on ${activeDay}` : ''}
          </Text>

          <View
            style={[
              styles.segmented,
              { backgroundColor: colors.bg3 },
            ]}
          >
            {LAYOUT_OPTIONS.map((opt) => (
              <Pressable
                key={opt.value}
                onPress={() => handleLayoutChange(opt.value)}
                style={[
                  styles.segBtn,
                  layout === opt.value && {
                    backgroundColor: colors.card,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.segText,
                    {
                      color:
                        layout === opt.value
                          ? colors.accentLt
                          : colors.text3,
                    },
                  ]}
                >
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* ---- Layout content ---- */}
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
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.xl }}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => router.push('/add-moment' as any)}
            style={[
              styles.addButton,
              {
                backgroundColor: colors.card,
                borderColor: colors.border2,
              },
            ]}
          >
            <Camera size={16} color={colors.text2} strokeWidth={1.8} />
            <Text style={[styles.addButtonText, { color: colors.text2 }]}>
              Add moment
            </Text>
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
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
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
    paddingHorizontal: spacing.lg,
    paddingBottom: 14,
    gap: 8,
  },
  switcherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: 14,
  },
  momentCountText: {
    fontSize: 11,
  },
  segmented: {
    flexDirection: 'row',
    borderRadius: radius.sm,
    padding: 2,
  },
  segBtn: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: radius.sm - 2,
  },
  segText: {
    fontSize: 10.5,
    fontWeight: '600',
  },
  mapPlaceholder: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapPlaceholderText: {
    fontSize: 14,
    fontWeight: '500',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: radius.sm + 2,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  addButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
