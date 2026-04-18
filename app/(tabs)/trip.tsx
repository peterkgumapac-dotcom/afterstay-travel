import { useFocusEffect, useRouter } from 'expo-router';
import { Plus, MessageCircle } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
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
import { hoursUntil, formatCurrency } from '@/lib/utils';

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

const TAB_KEYS = ['Overview', 'Flights', 'Packing', 'Files'] as const;
type TabKey = (typeof TAB_KEYS)[number];

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

  const [activeTab, setActiveTab] = useState<TabKey>('Overview');
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

  const onTogglePacked = async (item: PackingItem, packed: boolean) => {
    setPacking(list => list.map(p => (p.id === item.id ? { ...p, packed } : p)));
    try {
      await togglePacked(item.id, packed);
    } catch {
      setPacking(list => list.map(p => (p.id === item.id ? { ...p, packed: !packed } : p)));
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
        <ActivityIndicator color={colors.accentLt} />
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

  const currency = trip.costCurrency ?? 'PHP';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.headerSection}>
        <Text style={styles.pageTitle}>Our Trip</Text>
        <Text style={styles.pageSub}>
          {trip.destination || 'Boracay'} {'\u00B7'} Apr 20 {'\u2013'} 27
        </Text>
      </View>

      {/* Segmented control */}
      <View style={styles.segmented}>
        {TAB_KEYS.map((tab) => (
          <Pressable
            key={tab}
            style={[styles.segBtn, activeTab === tab && styles.segBtnActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.segText, activeTab === tab && styles.segTextActive]}>
              {tab}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor={colors.accentLt}
          />
        }
      >
        {activeTab === 'Overview' && (
          <>
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
                          list.map(gm => gm.id === id ? { ...gm, email } : gm)
                        );
                      }}
                      onPhotoUpdate={async (id, uri) => {
                        setMembers(list =>
                          list.map(gm => gm.id === id ? { ...gm, profilePhoto: uri } : gm)
                        );
                        try {
                          await updateMemberPhoto(id, uri);
                        } catch {
                          setMembers(list =>
                            list.map(gm => gm.id === id ? { ...gm, profilePhoto: m.profilePhoto } : gm)
                          );
                        }
                      }}
                    />
                  ))
                )}
              </View>
            </Section>

            {/* Accommodation card */}
            {trip.accommodation && (
              <Section title="Accommodation">
                <View style={styles.accomCard}>
                  <Text style={styles.accomName}>{trip.accommodation}</Text>
                  {trip.address ? <Text style={styles.accomAddr}>{trip.address}</Text> : null}
                  {trip.roomType ? <Text style={styles.accomRoom}>{trip.roomType}</Text> : null}
                  <View style={styles.accomGrid}>
                    <View style={styles.accomGridItem}>
                      <Text style={styles.accomGridLabel}>CHECK-IN</Text>
                      <Text style={styles.accomGridValue}>{trip.checkIn || '3:00 PM'}</Text>
                    </View>
                    <View style={styles.accomGridItem}>
                      <Text style={styles.accomGridLabel}>CHECKOUT</Text>
                      <Text style={styles.accomGridValue}>{trip.checkOut || '12:00 PM'}</Text>
                    </View>
                  </View>
                  {trip.cost ? (
                    <View style={styles.accomCostRow}>
                      <Text style={styles.accomCostLabel}>Total</Text>
                      <Text style={styles.accomCostValue}>
                        {formatCurrency(trip.cost, currency)}
                      </Text>
                    </View>
                  ) : null}
                  {trip.cost && members.length > 1 ? (
                    <Text style={styles.accomSplit}>
                      {formatCurrency(trip.cost / members.length, currency)} per person
                    </Text>
                  ) : null}
                </View>
              </Section>
            )}

            {/* Mini flight cards */}
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
            </Section>
          </>
        )}

        {activeTab === 'Flights' && (
          <>
            {outboundDeduped.length > 0 && (
              <Section title="Outbound">
                <View style={{ gap: spacing.sm }}>
                  {outboundDeduped.map(({ flight: f, passengers }) => (
                    <FlightCard key={f.id} flight={f} passengers={passengers} />
                  ))}
                </View>
              </Section>
            )}
            {returnDeduped.length > 0 && (
              <Section title="Return">
                <View style={{ gap: spacing.sm }}>
                  {returnDeduped.map(({ flight: f, passengers }) => (
                    <FlightCard key={f.id} flight={f} passengers={passengers} />
                  ))}
                </View>
              </Section>
            )}
            {flights.length === 0 && (
              <Text style={styles.muted}>No flights saved yet.</Text>
            )}
            {flights.length > 0 && (
              <CalendarSync trip={trip} flights={flights} packingItems={packing} members={members} />
            )}
          </>
        )}

        {activeTab === 'Packing' && (
          <>
            <View style={styles.packingHeader}>
              <Text style={styles.packingProgress}>
                {packingStats.done} of {packingStats.total} packed
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
                placeholder="Add an item\u2026"
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
          </>
        )}

        {activeTab === 'Files' && (
          <>
            <View style={styles.filesHeader}>
              <Text style={styles.filesCount}>{files.length} files</Text>
            </View>
            <View style={{ gap: spacing.sm }}>
              {files.length === 0 ? (
                <Text style={styles.muted}>No files attached yet.</Text>
              ) : (
                files.map(f => <TripFileRow key={f.id} file={f} />)
              )}
              <Pressable
                style={({ pressed }) => [styles.addFileBtn, pressed && { opacity: 0.7 }]}
                onPress={() => router.push('/add-file')}
              >
                <Plus size={16} color={colors.accentLt} />
                <Text style={styles.addFileText}>Upload</Text>
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>
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
  const color = tone === 'green' ? colors.accent : colors.amber;
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
  errorText: { color: colors.danger, fontSize: 13 },
  headerSection: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  pageTitle: { color: colors.text, fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  pageSub: { color: colors.text2, fontSize: 13, marginTop: 2 },
  segmented: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: colors.bg3,
    borderRadius: radius.md,
    padding: 3,
  },
  segBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: radius.sm,
  },
  segBtnActive: {
    backgroundColor: colors.card,
  },
  segText: {
    color: colors.text3,
    fontSize: 13,
    fontWeight: '600',
  },
  segTextActive: {
    color: colors.accentLt,
  },
  content: { padding: spacing.lg, paddingBottom: 100, gap: spacing.xl },
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
  // Accommodation card
  accomCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  accomName: { color: colors.text, fontSize: 16, fontWeight: '700' },
  accomAddr: { color: colors.text2, fontSize: 12, marginTop: 2 },
  accomRoom: { color: colors.text3, fontSize: 12, marginTop: 4 },
  accomGrid: {
    flexDirection: 'row',
    marginTop: spacing.md,
    gap: spacing.md,
  },
  accomGridItem: {
    flex: 1,
    backgroundColor: colors.bg3,
    borderRadius: radius.sm,
    padding: spacing.md,
  },
  accomGridLabel: {
    color: colors.text3,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
  },
  accomGridValue: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    marginTop: 4,
  },
  accomCostRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  accomCostLabel: { color: colors.text2, fontSize: 13 },
  accomCostValue: { color: colors.text, fontSize: 18, fontWeight: '700' },
  accomSplit: { color: colors.text3, fontSize: 12, marginTop: 4, textAlign: 'right' },
  // Packing
  packingHeader: { gap: 6 },
  packingProgress: { color: colors.text2, fontSize: 14, fontWeight: '600' },
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
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  packingCategoryHeader: {
    color: colors.text3,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  // Files
  filesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  filesCount: { color: colors.text2, fontSize: 13, fontWeight: '600' },
  addFileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.accent + '40',
    borderStyle: 'dashed',
  },
  addFileText: {
    color: colors.accentLt,
    fontSize: 14,
    fontWeight: '600',
  },
});
