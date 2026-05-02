import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowLeft,
  Bed,
  CheckSquare,
  ChevronDown,
  ChevronLeft,
  ClipboardList,
  Copy,
  DollarSign,
  MapPin,
  Plane,
  Luggage,
  Users,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme, ThemeColors } from '@/constants/ThemeContext';
import { elevation, radius, spacing, typography } from '@/constants/theme';
import {
  getActiveTrip,
  getTripById,
  getChecklist,
  getExpenses,
  getFlights,
  getGroupMembers,
  getPackingList,
  getSavedPlaces,
  updateTripProperty,
} from '@/lib/supabase';
import type {
  ChecklistItem,
  Expense,
  Flight,
  GroupMember,
  PackingItem,
  Place,
  PlaceCategory,
  Trip,
} from '@/lib/types';
import { safeParse, MS_PER_DAY } from '@/lib/utils';
import { inferFlightLeg, sortFlightsByTime } from '@/lib/tripState';

// ---------- helpers ----------

function formatDate(iso: string): string {
  if (!iso) return '—';
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const d = safeParse(iso);
  const utcMs = d.getTime() + d.getTimezoneOffset() * 60000;
  const pht = new Date(utcMs + 8 * 60 * 60 * 1000);
  return `${MONTHS[pht.getMonth()]} ${pht.getDate()}`;
}

function formatTime(iso: string): string {
  if (!iso) return '—';
  const d = safeParse(iso);
  const utcMs = d.getTime() + d.getTimezoneOffset() * 60000;
  const pht = new Date(utcMs + 8 * 60 * 60 * 1000);
  let h = pht.getHours();
  const m = pht.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`;
}

function getCountdown(startDate: string, endDate: string): string {
  const now = new Date();
  const start = safeParse(startDate);
  const end = safeParse(endDate);
  if (now >= start && now <= end) return 'Trip in progress!';
  if (now > end) return 'Trip completed';
  const diffMs = start.getTime() - now.getTime();
  const days = Math.ceil(diffMs / MS_PER_DAY);
  if (days === 1) return '1 day to go!';
  return `${days} days to go!`;
}

function progressColor(pct: number, colors: any): string {
  if (pct >= 80) return colors.green;
  if (pct >= 50) return colors.amber;
  return colors.red;
}

// ---------- collapsible card ----------

function CollapsibleCard({
  icon,
  title,
  children,
  defaultOpen = true,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [open, setOpen] = useState(defaultOpen);
  const rotation = useRef(new Animated.Value(defaultOpen ? 1 : 0)).current;

  const toggle = () => {
    Animated.timing(rotation, {
      toValue: open ? 0 : 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
    setOpen(!open);
  };

  const rotate = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  return (
    <View style={styles.card}>
      <Pressable onPress={toggle} style={styles.cardHeader} accessibilityLabel={`${open ? 'Collapse' : 'Expand'} ${title}`} accessibilityRole="button">
        {icon}
        <Text style={[styles.cardTitle, { flex: 1 }]}>{title}</Text>
        <Animated.View style={{ transform: [{ rotate }] }}>
          <ChevronDown size={16} color={colors.text2} />
        </Animated.View>
      </Pressable>
      {open && children}
    </View>
  );
}

// ---------- non-collapsible card (header only) ----------

function SimpleCard({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  return <View style={styles.card}>{children}</View>;
}

function ProgressBar({ pct, color }: { pct: number; color: string }) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${Math.min(pct, 100)}%`, backgroundColor: color }]} />
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  if (!value) return null;
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function CopyRow({
  label,
  value,
  fieldKey,
  tripId,
  onUpdate,
}: {
  label: string;
  value: string;
  fieldKey?: string;
  tripId?: string;
  onUpdate?: (newValue: string) => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);

  const handleCopy = () => {
    if (value) Clipboard.setStringAsync(value);
  };

  const handleSave = async () => {
    if (!fieldKey || !tripId) return;
    setSaving(true);
    try {
      await updateTripProperty(tripId, fieldKey, draft);
      onUpdate?.(draft);
      setEditing(false);
      Alert.alert('Saved!', `${label} updated successfully.`);
    } catch (err: any) {
      Alert.alert('Error', `Failed to save ${label}: ${err?.message ?? 'Unknown error'}. Try again.`);
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <View style={styles.editRow}>
        <Text style={styles.infoLabel}>{label}</Text>
        <View style={styles.editInputRow}>
          <TextInput
            style={styles.editInput}
            value={draft}
            onChangeText={setDraft}
            autoFocus
            placeholderTextColor={colors.text3}
            placeholder={`Enter ${label.toLowerCase()}`}
          />
          <Pressable onPress={handleSave} disabled={saving} style={styles.editSaveBtn}>
            {saving ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Text style={styles.editSaveText}>Save</Text>
            )}
          </Pressable>
          <Pressable onPress={() => { setDraft(value); setEditing(false); }}>
            <Text style={styles.editCancelText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (!value && !fieldKey) return null;

  return (
    <Pressable onPress={fieldKey ? () => { setDraft(value); setEditing(true); } : undefined} style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <View style={styles.copyRow}>
        <Text style={[styles.infoValue, !value && styles.emptyValue]}>
          {value || 'Tap to add'}
        </Text>
        {value ? (
          <Pressable onPress={handleCopy} hitSlop={8}>
            <Copy size={14} color={colors.text2} />
          </Pressable>
        ) : null}
      </View>
    </Pressable>
  );
}

function EditableInfoRow({
  label,
  value,
  fieldKey,
  tripId,
  onUpdate,
}: {
  label: string;
  value: string;
  fieldKey: string;
  tripId: string;
  onUpdate?: (newValue: string) => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateTripProperty(tripId, fieldKey, draft);
      onUpdate?.(draft);
      setEditing(false);
      Alert.alert('Saved!', `${label} updated successfully.`);
    } catch (err: any) {
      Alert.alert('Error', `Failed to save ${label}: ${err?.message ?? 'Unknown error'}. Try again.`);
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <View style={styles.editRow}>
        <Text style={styles.infoLabel}>{label}</Text>
        <View style={styles.editInputRow}>
          <TextInput
            style={styles.editInput}
            value={draft}
            onChangeText={setDraft}
            autoFocus
            placeholderTextColor={colors.text3}
          />
          <Pressable onPress={handleSave} disabled={saving} style={styles.editSaveBtn}>
            {saving ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Text style={styles.editSaveText}>Save</Text>
            )}
          </Pressable>
          <Pressable onPress={() => { setDraft(value); setEditing(false); }}>
            <Text style={styles.editCancelText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <Pressable onPress={() => { setDraft(value); setEditing(true); }} style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, !value && styles.emptyValue]}>
        {value || 'Tap to add'}
      </Text>
    </Pressable>
  );
}

// ---------- main screen ----------

interface OverviewData {
  trip: Trip;
  flights: Flight[];
  members: GroupMember[];
  packing: PackingItem[];
  expenses: Expense[];
  checklist: ChecklistItem[];
  places: Place[];
}

export default function TripOverviewScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const router = useRouter();
  const params = useLocalSearchParams<{ tripId?: string }>();
  const tripId = typeof params.tripId === 'string' ? params.tripId : undefined;
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  const load = useCallback(async () => {
    try {
      setError(undefined);
      const trip = tripId ? await getTripById(tripId) : await getActiveTrip();
      if (!trip) {
        setError('No active trip found.');
        return;
      }
      const [flights, members, packing, expenses, checklist, places] = await Promise.all([
        getFlights(trip.id).catch(() => [] as Flight[]),
        getGroupMembers(trip.id).catch(() => [] as GroupMember[]),
        getPackingList(trip.id).catch(() => [] as PackingItem[]),
        getExpenses(trip.id).catch(() => [] as Expense[]),
        getChecklist(trip.id).catch(() => [] as ChecklistItem[]),
        getSavedPlaces(trip.id).catch(() => [] as Place[]),
      ]);
      setData({ trip, flights, members, packing, expenses, checklist, places });
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load overview');
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <TouchableOpacity style={styles.backPill} onPress={() => router.back()} activeOpacity={0.75}>
          <ChevronLeft size={18} color={colors.text} />
          <Text style={styles.backPillText}>Back</Text>
        </TouchableOpacity>
        <ActivityIndicator color={colors.green2} />
        <Text style={styles.loadingText}>Loading overview...</Text>
      </SafeAreaView>
    );
  }

  if (error || !data) {
    return (
      <SafeAreaView style={styles.center}>
        <TouchableOpacity style={styles.backPill} onPress={() => router.back()} activeOpacity={0.75}>
          <ChevronLeft size={18} color={colors.text} />
          <Text style={styles.backPillText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.errorTitle}>Could not load overview</Text>
        <Text style={styles.errorText}>{error ?? 'Unknown error'}</Text>
        <Pressable style={styles.retryBtn} onPress={() => { setLoading(true); load(); }}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const { trip, flights, members, packing, expenses, checklist, places } = data;

  const updateField = (field: keyof Trip, newValue: string) => {
    setData({ ...data, trip: { ...trip, [field]: newValue } });
  };

  // derived
  const orderedFlights = sortFlightsByTime(flights).map((flight) => ({
    flight,
    leg: inferFlightLeg(flight, flights),
  }));
  const packedCount = packing.filter(p => p.packed).length;
  const packPct = packing.length > 0 ? Math.round((packedCount / packing.length) * 100) : 0;
  const doneCount = checklist.filter(c => c.done).length;
  const checkPct = checklist.length > 0 ? Math.round((doneCount / checklist.length) * 100) : 0;
  const totalSpent = expenses.reduce((sum, e) => sum + e.amount, 0);
  const categoryCounts: Record<string, number> = {};
  for (const e of expenses) {
    categoryCounts[e.category] = (categoryCounts[e.category] ?? 0) + e.amount;
  }
  const topCategory = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0];
  const placeCategoryCounts: Record<string, number> = {};
  for (const p of places) {
    placeCategoryCounts[p.category] = (placeCategoryCounts[p.category] ?? 0) + 1;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header bar */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 }}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <ChevronLeft size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text, marginLeft: 10 }}>Trip Overview</Text>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      >
        {/* Header */}
        <SimpleCard>
          <Text style={styles.destination}>{trip.destination || trip.name}</Text>
          <Text style={styles.dateRange}>
            {formatDate(trip.startDate)} – {formatDate(trip.endDate)}  ·  {trip.nights} night{trip.nights !== 1 ? 's' : ''}
          </Text>
          <View style={styles.countdownBadge}>
            <Text style={styles.countdownText}>{getCountdown(trip.startDate, trip.endDate)}</Text>
          </View>
        </SimpleCard>

        <Pressable
          style={styles.scanDetailsBtn}
          onPress={() => router.push({ pathname: '/scan-trip', params: { tripId: trip.id } } as never)}
        >
          <View style={styles.scanDetailsIcon}>
            <ClipboardList size={18} color={colors.accent} strokeWidth={2} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.scanDetailsTitle}>Rescan booking details</Text>
            <Text style={styles.scanDetailsSub}>
              Replace hotel, dates, and outbound/return flights from new screenshots.
            </Text>
          </View>
        </Pressable>

        {/* Accommodation */}
        {trip.accommodation ? (
          <CollapsibleCard icon={<Bed size={18} color={colors.purple} />} title="Accommodation">
            <Text style={styles.accomName}>{trip.accommodation}</Text>
            {trip.address ? <Text style={styles.accomAddress}>{trip.address}</Text> : null}
            <View style={styles.divider} />
            <EditableInfoRow label="Check-in" value={trip.checkIn ?? ''} fieldKey="Check-in Time" tripId={trip.id} onUpdate={v => updateField('checkIn', v)} />
            <EditableInfoRow label="Check-out" value={trip.checkOut ?? ''} fieldKey="Check-out Time" tripId={trip.id} onUpdate={v => updateField('checkOut', v)} />
            <EditableInfoRow label="Room" value={trip.roomType} fieldKey="Room Type" tripId={trip.id} onUpdate={v => updateField('roomType', v)} />
            <CopyRow label="Booking ref" value={trip.bookingRef ?? ''} fieldKey="Booking Ref" tripId={trip.id} onUpdate={v => updateField('bookingRef', v)} />
            <CopyRow label="WiFi" value={trip.wifiSsid ?? ''} fieldKey="WiFi Network" tripId={trip.id} onUpdate={v => updateField('wifiSsid', v)} />
            <CopyRow label="Password" value={trip.wifiPassword ?? ''} fieldKey="WiFi Password" tripId={trip.id} onUpdate={v => updateField('wifiPassword', v)} />
            <CopyRow label="Door code" value={trip.doorCode ?? ''} fieldKey="Door Code" tripId={trip.id} onUpdate={v => updateField('doorCode', v)} />
          </CollapsibleCard>
        ) : null}

        {/* Flights */}
        {flights.length > 0 ? (
          <CollapsibleCard icon={<Plane size={18} color={colors.blue} />} title="Flights">
            {orderedFlights.map(({ flight, leg }, index) => (
              <View key={flight.id} style={[styles.flightRow, index > 0 && { marginTop: spacing.sm }]}>
                <Text style={[
                  styles.flightDir,
                  leg === 'return' && { backgroundColor: colors.amber + '20', color: colors.amber },
                ]}>
                  {leg === 'return' ? 'RET' : 'OUT'}
                </Text>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.flightRoute} numberOfLines={1}>
                    {flight.from} → {flight.to}
                  </Text>
                  <Text style={styles.flightMeta} numberOfLines={1}>
                    {flight.flightNumber}  ·  {formatDate(flight.departTime)} {formatTime(flight.departTime)}
                  </Text>
                </View>
              </View>
            ))}
          </CollapsibleCard>
        ) : null}

        {/* Group */}
        {members.length > 0 ? (
          <CollapsibleCard icon={<Users size={18} color={colors.green2} />} title={`Group (${members.length})`}>
            <View style={styles.memberList}>
              {members.map(m => (
                <View key={m.id} style={styles.memberChip}>
                  <Text style={styles.memberName}>{m.name}</Text>
                  {m.role === 'Primary' ? (
                    <View style={styles.roleBadge}>
                      <Text style={styles.roleBadgeText}>Primary</Text>
                    </View>
                  ) : null}
                </View>
              ))}
            </View>
          </CollapsibleCard>
        ) : null}

        {/* Packing */}
        {packing.length > 0 ? (
          <CollapsibleCard icon={<Luggage size={18} color={colors.amber} />} title="Packing" defaultOpen={false}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressLabel}>
                {packedCount} of {packing.length} packed
              </Text>
              <Text style={[styles.progressPct, { color: progressColor(packPct, colors) }]}>{packPct}%</Text>
            </View>
            <ProgressBar pct={packPct} color={progressColor(packPct, colors)} />
          </CollapsibleCard>
        ) : null}

        {/* Budget */}
        {expenses.length > 0 ? (
          <CollapsibleCard icon={<DollarSign size={18} color={colors.green} />} title="Budget" defaultOpen={false}>
            <Text style={styles.budgetTotal}>
              {expenses[0]?.currency ?? 'PHP'} {totalSpent.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
            </Text>
            <Text style={styles.budgetMeta}>
              {expenses.length} expense{expenses.length !== 1 ? 's' : ''}
              {topCategory ? `  ·  Top: ${topCategory[0]}` : ''}
            </Text>
          </CollapsibleCard>
        ) : null}

        {/* Checklist */}
        {checklist.length > 0 ? (
          <CollapsibleCard icon={<CheckSquare size={18} color={colors.green2} />} title="Checklist" defaultOpen={false}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressLabel}>
                {doneCount} of {checklist.length} done
              </Text>
              <Text style={[styles.progressPct, { color: progressColor(checkPct, colors) }]}>{checkPct}%</Text>
            </View>
            <ProgressBar pct={checkPct} color={progressColor(checkPct, colors)} />
          </CollapsibleCard>
        ) : null}

        {/* Places */}
        {places.length > 0 ? (
          <CollapsibleCard icon={<MapPin size={18} color={colors.pink} />} title={`Saved Places (${places.length})`} defaultOpen={false}>
            <View style={styles.placeCategories}>
              {Object.entries(placeCategoryCounts).map(([cat, count]) => (
                <View key={cat} style={styles.placeCatChip}>
                  <Text style={styles.placeCatText}>
                    {cat}: {count}
                  </Text>
                </View>
              ))}
            </View>
          </CollapsibleCard>
        ) : null}
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ---------- styles ----------

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: {
    flex: 1,
    backgroundColor: colors.bg,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  loadingText: { color: colors.text2, fontSize: 13 },
  backPill: {
    position: 'absolute',
    top: 18,
    left: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  backPillText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  errorTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
  errorText: { color: colors.text2, fontSize: 13, textAlign: 'center' },
  retryBtn: {
    marginTop: spacing.md,
    backgroundColor: colors.green,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: radius.md,
  },
  retryText: { color: colors.white, fontWeight: '700' },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl + 16,
    gap: spacing.md,
  },

  // card
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...elevation.card,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },

  // trip header
  destination: { ...typography.h1, color: colors.text },
  dateRange: { color: colors.text2, fontSize: 14, marginTop: spacing.xs },
  countdownBadge: {
    marginTop: spacing.md,
    alignSelf: 'flex-start',
    backgroundColor: colors.green + '20',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
  },
  countdownText: { color: colors.green2, fontSize: 14, fontWeight: '700' },
  scanDetailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    ...elevation.card,
  },
  scanDetailsIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.accentBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanDetailsTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  scanDetailsSub: {
    color: colors.text2,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },

  // accommodation
  accomName: { color: colors.text, fontSize: 16, fontWeight: '600' },
  accomAddress: { color: colors.text2, fontSize: 13, marginTop: 2 },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3,
  },
  infoLabel: { color: colors.text2, fontSize: 13 },
  infoValue: { color: colors.text, fontSize: 13, fontWeight: '500' },
  copyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  emptyValue: { color: colors.text3, fontStyle: 'italic' },
  editRow: { paddingVertical: spacing.xs, gap: spacing.xs },
  editInputRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  editInput: {
    flex: 1,
    color: colors.text,
    fontSize: 13,
    borderWidth: 1,
    borderColor: colors.border2,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.bg3,
  },
  editSaveBtn: {
    backgroundColor: colors.green,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.sm,
  },
  editSaveText: { color: colors.white, fontSize: 12, fontWeight: '600' },
  editCancelText: { color: colors.text2, fontSize: 12 },

  // flights
  flightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  flightDir: {
    backgroundColor: colors.blue + '20',
    color: colors.blue,
    fontSize: 11,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  flightRoute: { color: colors.text, fontSize: 14, fontWeight: '600' },
  flightMeta: { color: colors.text2, fontSize: 12, marginTop: 2 },

  // group
  memberList: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  memberChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.bg3,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
  },
  memberName: { color: colors.text, fontSize: 13, fontWeight: '500' },
  roleBadge: {
    backgroundColor: colors.purple + '30',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radius.sm,
  },
  roleBadgeText: { color: colors.purple, fontSize: 10, fontWeight: '700' },

  // progress
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  progressLabel: { color: colors.text2, fontSize: 13 },
  progressPct: { fontSize: 15, fontWeight: '700' },
  progressTrack: {
    height: 6,
    backgroundColor: colors.bg3,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: 6,
    borderRadius: 3,
  },

  // budget
  budgetTotal: { color: colors.text, fontSize: 22, fontWeight: '700' },
  budgetMeta: { color: colors.text2, fontSize: 13, marginTop: 2 },

  // places
  placeCategories: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  placeCatChip: {
    backgroundColor: colors.bg3,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
  },
  placeCatText: { color: colors.text2, fontSize: 12, fontWeight: '500' },
});
