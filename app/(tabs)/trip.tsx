import { useFocusEffect, useRouter } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import CalendarSync from '@/components/CalendarSync';
import ChecklistItemRow from '@/components/ChecklistItem';
import FlightCard from '@/components/FlightCard';
import GroupMemberCard from '@/components/GroupMember';
import PackingItemRow from '@/components/PackingItem';
import Select from '@/components/Select';
import TripFileRow from '@/components/TripFileRow';
import { colors, radius, spacing, typography } from '@/constants/theme';
import {
  addPackingItem,
  getActiveTrip,
  getChecklist,
  getFlights,
  getGroupMembers,
  getPackingList,
  getSavedPlaces,
  getTripFiles,
  toggleChecklistItem,
  togglePacked,
  updateMemberPhoto,
} from '@/lib/notion';
import type {
  ChecklistItem,
  Flight,
  GroupMember,
  PackingItem,
  Place,
  PlaceCategory,
  Trip,
  TripFile,
} from '@/lib/types';
import { hoursUntil } from '@/lib/utils';

const PACKING_CATEGORIES = [
  'All',
  'Clothing',
  'Tech',
  'Toiletries',
  'Documents',
  'Gear',
  'Other',
] as const;

const ADD_CATEGORIES: PackingItem['category'][] = [
  'Clothing',
  'Tech',
  'Toiletries',
  'Documents',
  'Gear',
  'Other',
];

type PackingFilter = (typeof PACKING_CATEGORIES)[number];

const PLACE_CATEGORY_EMOJI: Record<PlaceCategory, string> = {
  Eat: '🍽',
  Coffee: '☕',
  Do: '🎯',
  Nature: '🌿',
  Nightlife: '🎉',
  Wellness: '💆',
  Culture: '🏛',
  Essentials: '🛒',
  Transport: '🚕',
};

export default function TripScreen() {
  const router = useRouter();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [flights, setFlights] = useState<Flight[]>([]);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [packing, setPacking] = useState<PackingItem[]>([]);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [files, setFiles] = useState<TripFile[]>([]);
  const [savedPlaces, setSavedPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string>();

  const [packingFilter, setPackingFilter] = useState<PackingFilter>('All');
  const [newItem, setNewItem] = useState('');
  const [newCategory, setNewCategory] = useState<PackingItem['category']>('Clothing');
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(undefined);
      const t = await getActiveTrip();
      setTrip(t);
      if (!t) return;
      const [fs, gm, pk, cl, fl, places] = await Promise.all([
        getFlights(t.id).catch(() => [] as Flight[]),
        getGroupMembers(t.id).catch(() => [] as GroupMember[]),
        getPackingList(t.id).catch(() => [] as PackingItem[]),
        getChecklist(t.id).catch(() => [] as ChecklistItem[]),
        getTripFiles(t.id).catch(() => [] as TripFile[]),
        getSavedPlaces(t.id).catch(() => [] as Place[]),
      ]);
      setFlights(fs);
      setMembers(gm);
      setPacking(pk);
      setChecklist(cl);
      setFiles(fl);
      setSavedPlaces(places.filter(p => p.saved));
    } catch (e: any) {
      setError(e?.message ?? 'Unable to load');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Deduplicate flights by flight number + direction, collect passengers
  const deduplicateFlights = (list: Flight[]): { flight: Flight; passengers: string[] }[] => {
    const map = new Map<string, { flight: Flight; passengers: string[] }>();
    for (const f of list) {
      const key = `${f.flightNumber}-${f.direction}`;
      const existing = map.get(key);
      if (existing) {
        if (f.passenger && !existing.passengers.includes(f.passenger)) {
          existing.passengers.push(f.passenger);
        }
      } else {
        map.set(key, { flight: f, passengers: f.passenger ? [f.passenger] : [] });
      }
    }
    return Array.from(map.values());
  };

  const outboundDeduped = deduplicateFlights(flights.filter(f => f.direction === 'Outbound'));
  const returnDeduped = deduplicateFlights(flights.filter(f => f.direction === 'Return'));
  const returnFlight = flights.find(f => f.direction === 'Return');

  const filteredPacking = useMemo(
    () =>
      packingFilter === 'All'
        ? packing
        : packing.filter(p => p.category === packingFilter),
    [packing, packingFilter]
  );

  const packingStats = useMemo(() => {
    const done = packing.filter(p => p.packed).length;
    return { done, total: packing.length };
  }, [packing]);

  const showCheckout = returnFlight ? hoursUntil(returnFlight.departTime) <= 24 && hoursUntil(returnFlight.departTime) >= -2 : false;
  const checklistStats = useMemo(() => {
    const done = checklist.filter(c => c.done).length;
    return { done, total: checklist.length };
  }, [checklist]);

  const onTogglePacked = async (item: PackingItem, packed: boolean) => {
    setPacking(list => list.map(p => (p.id === item.id ? { ...p, packed } : p)));
    try {
      await togglePacked(item.id, packed);
    } catch {
      setPacking(list => list.map(p => (p.id === item.id ? { ...p, packed: !packed } : p)));
    }
  };

  const onToggleChecklist = async (item: ChecklistItem, done: boolean) => {
    const primary = members.find(m => m.role === 'Primary')?.name;
    setChecklist(list =>
      list.map(c => (c.id === item.id ? { ...c, done, doneBy: done ? primary : undefined } : c))
    );
    try {
      await toggleChecklistItem(item.id, done, done ? primary : undefined);
    } catch {
      setChecklist(list => list.map(c => (c.id === item.id ? { ...c, done: !done } : c)));
    }
  };

  const submitNewItem = async () => {
    if (!newItem.trim()) return;
    setAdding(true);
    try {
      await addPackingItem({ item: newItem.trim(), category: newCategory });
      setNewItem('');
      await load();
    } finally {
      setAdding(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator color={colors.green2} />
      </SafeAreaView>
    );
  }
  if (error || !trip) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.errorText}>{error ?? 'No trip found.'}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <FlatList
        data={[0]}
        keyExtractor={() => 'x'}
        renderItem={() => null}
        ListHeaderComponent={
          <ScrollView>
            <View style={styles.content}>
              <Text style={styles.pageTitle}>Our Trip</Text>

              {/* Group Members */}
              <Section title="Group">
                <View style={{ gap: spacing.sm }}>
                  {members.length === 0 ? (
                    <Text style={styles.muted}>No group members yet.</Text>
                  ) : (
                    members.map(m => (
                      <GroupMemberCard
                        key={m.id}
                        member={m}
                        onEmailUpdate={(id, email) => {
                          setMembers(list =>
                            list.map(gm =>
                              gm.id === id ? { ...gm, email } : gm
                            )
                          );
                        }}
                        onPhotoUpdate={async (id, uri) => {
                          setMembers(list =>
                            list.map(gm =>
                              gm.id === id ? { ...gm, profilePhoto: uri } : gm
                            )
                          );
                          try {
                            await updateMemberPhoto(id, uri);
                          } catch {
                            setMembers(list =>
                              list.map(gm =>
                                gm.id === id ? { ...gm, profilePhoto: m.profilePhoto } : gm
                              )
                            );
                          }
                        }}
                      />
                    ))
                  )}
                </View>
              </Section>

              {/* Flights */}
              <Section title="Flights">
                {outboundDeduped.length > 0 && (
                  <>
                    <Text style={styles.subLabel}>Outbound</Text>
                    <View style={{ gap: spacing.sm }}>
                      {outboundDeduped.map(({ flight: f, passengers }) => (
                        <FlightCard key={f.id} flight={f} passengers={passengers} />
                      ))}
                    </View>
                  </>
                )}
                {returnDeduped.length > 0 && (
                  <>
                    <Text style={[styles.subLabel, { marginTop: spacing.md }]}>Return</Text>
                    <View style={{ gap: spacing.sm }}>
                      {returnDeduped.map(({ flight: f, passengers }) => (
                        <FlightCard key={f.id} flight={f} passengers={passengers} />
                      ))}
                    </View>
                  </>
                )}
                {flights.length === 0 && (
                  <Text style={styles.muted}>No flights saved yet.</Text>
                )}
                {flights.length > 0 && (
                  <CalendarSync trip={trip} flights={flights} packingItems={packing} />
                )}
              </Section>

              {/* Files */}
              <Section title="Files">
                <View style={{ gap: spacing.sm }}>
                  {files.length === 0 ? (
                    <Text style={styles.muted}>No files attached yet. Tap + to add boarding passes, confirmations, etc.</Text>
                  ) : (
                    files.map(f => <TripFileRow key={f.id} file={f} />)
                  )}
                  <Pressable
                    style={({ pressed }) => [styles.addFileBtn, pressed && { opacity: 0.7 }]}
                    onPress={() => router.push('/add-file')}
                  >
                    <Plus size={16} color={colors.green2} />
                    <Text style={styles.addFileText}>Add File</Text>
                  </Pressable>
                </View>
              </Section>

              {/* Saved Places */}
              <Section title={`Saved for This Trip (${savedPlaces.length})`}>
                <View style={{ gap: spacing.sm }}>
                  {savedPlaces.length === 0 ? (
                    <Text style={styles.muted}>No saved places yet. Bookmark places in Discover.</Text>
                  ) : (
                    savedPlaces.map(p => (
                      <View key={p.id} style={styles.savedPlaceCard}>
                        <Text style={styles.savedPlaceEmoji}>
                          {PLACE_CATEGORY_EMOJI[p.category] ?? '📍'}
                        </Text>
                        <View style={{ flex: 1, gap: 2 }}>
                          <View style={styles.savedPlaceHeader}>
                            <Text style={styles.savedPlaceName} numberOfLines={1}>
                              {p.name}
                            </Text>
                            {p.rating ? (
                              <Text style={styles.savedPlaceRating}>
                                {'\u2B50'} {p.rating.toFixed(1)}
                              </Text>
                            ) : null}
                          </View>
                          {p.notes ? (
                            <Text style={styles.savedPlaceNotes} numberOfLines={2}>
                              {p.notes}
                            </Text>
                          ) : null}
                        </View>
                      </View>
                    ))
                  )}
                </View>
              </Section>

              {/* Packing List */}
              <Section title="Packing List">
                <View style={styles.progressRow}>
                  <Text style={styles.progressText}>
                    {packingStats.done} / {packingStats.total} packed
                  </Text>
                  <ProgressBar
                    value={packingStats.total === 0 ? 0 : packingStats.done / packingStats.total}
                  />
                </View>

                {/* Add item form */}
                <View style={styles.addRow}>
                  <TextInput
                    value={newItem}
                    onChangeText={setNewItem}
                    placeholder="Add an item…"
                    placeholderTextColor={colors.text3}
                    style={styles.addInput}
                    onSubmitEditing={submitNewItem}
                    returnKeyType="done"
                  />
                  <Pressable
                    onPress={submitNewItem}
                    disabled={adding || !newItem.trim()}
                    style={({ pressed }) => [
                      styles.addBtn,
                      (!newItem.trim() || adding) && { opacity: 0.4 },
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    <Plus size={18} color={colors.white} />
                  </Pressable>
                </View>
                <Select<PackingItem['category']>
                  options={ADD_CATEGORIES}
                  value={newCategory}
                  onChange={setNewCategory}
                />

                {/* Filter tabs */}
                <View style={{ marginTop: spacing.md }}>
                  <Select<PackingFilter>
                    label="Filter"
                    options={PACKING_CATEGORIES}
                    value={packingFilter}
                    onChange={setPackingFilter}
                  />
                </View>

                <View style={{ gap: spacing.md, marginTop: spacing.md }}>
                  {filteredPacking.length === 0 ? (
                    <Text style={styles.muted}>
                      {packing.length === 0 ? 'No packing items yet.' : 'Nothing in this category.'}
                    </Text>
                  ) : packingFilter !== 'All' ? (
                    <View style={{ gap: spacing.sm }}>
                      {filteredPacking.map(p => (
                        <PackingItemRow
                          key={p.id}
                          item={p}
                          onToggle={packed => onTogglePacked(p, packed)}
                        />
                      ))}
                    </View>
                  ) : (
                    ADD_CATEGORIES
                      .filter(cat => filteredPacking.some(p => p.category === cat))
                      .map(cat => (
                        <View key={cat} style={{ gap: spacing.sm }}>
                          <Text style={styles.packingCategoryHeader}>{cat}</Text>
                          {filteredPacking
                            .filter(p => p.category === cat)
                            .map(p => (
                              <PackingItemRow
                                key={p.id}
                                item={p}
                                onToggle={packed => onTogglePacked(p, packed)}
                              />
                            ))}
                        </View>
                      ))
                  )}
                </View>
              </Section>

              {/* Checkout Checklist — last 24h */}
              {showCheckout && (
                <Section title="Checkout Checklist">
                  <View style={styles.progressRow}>
                    <Text style={styles.progressText}>
                      {checklistStats.done} / {checklistStats.total} complete
                    </Text>
                    <ProgressBar
                      value={checklistStats.total === 0 ? 0 : checklistStats.done / checklistStats.total}
                      tone="amber"
                    />
                  </View>
                  <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
                    {checklist.length === 0 ? (
                      <Text style={styles.muted}>No checkout tasks configured.</Text>
                    ) : (
                      checklist.map(c => (
                        <ChecklistItemRow
                          key={c.id}
                          item={c}
                          doneBy={members.find(m => m.role === 'Primary')?.name}
                          onToggle={done => onToggleChecklist(c, done)}
                        />
                      ))
                    )}
                  </View>
                </Section>
              )}
            </View>
          </ScrollView>
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor={colors.green2}
          />
        }
      />
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function ProgressBar({ value, tone = 'green' }: { value: number; tone?: 'green' | 'amber' }) {
  const color = tone === 'green' ? colors.green : colors.amber;
  const pct = Math.max(0, Math.min(1, value));
  return (
    <View style={styles.bar}>
      <View style={[styles.barFill, { width: `${pct * 100}%`, backgroundColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  centered: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  errorText: { color: colors.red, fontSize: 13 },
  content: { padding: spacing.lg, paddingBottom: 100, gap: spacing.xl },
  pageTitle: { color: colors.text, fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  section: { gap: spacing.md },
  sectionTitle: { fontSize: 11, fontWeight: '800', color: colors.text2, textTransform: 'uppercase', letterSpacing: 0.7 },
  subLabel: {
    color: colors.text3,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  muted: { color: colors.text2, fontSize: 13 },
  progressRow: { gap: 6 },
  progressText: { color: colors.text2, fontSize: 12 },
  bar: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.bg3,
    overflow: 'hidden',
  },
  barFill: { height: '100%' },
  addRow: { flexDirection: 'row', gap: spacing.sm },
  addInput: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 14,
  },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addFileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.green + '40',
    borderStyle: 'dashed',
  },
  addFileText: {
    color: colors.green2,
    fontSize: 14,
    fontWeight: '600',
  },
  packingCategoryHeader: {
    color: colors.text3,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  savedPlaceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  savedPlaceEmoji: {
    fontSize: 22,
  },
  savedPlaceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  savedPlaceName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  savedPlaceRating: {
    color: colors.amber,
    fontSize: 12,
    fontWeight: '600',
  },
  savedPlaceNotes: {
    color: colors.text2,
    fontSize: 12,
    lineHeight: 16,
  },
});
