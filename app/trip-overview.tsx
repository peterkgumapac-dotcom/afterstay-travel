import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Bed,
  CheckSquare,
  ChevronDown,
  ChevronLeft,
  ClipboardList,
  Copy,
  DollarSign,
  FileText,
  ImagePlus,
  MapPin,
  Plane,
  Luggage,
  Settings,
  Share2,
  Sparkles,
  Users,
  UserPlus,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState, type ElementType } from 'react';
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
import { Image as ExpoImage } from 'expo-image';
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
  removeGroupMember,
  updateTripProperty,
  updateMyTripMemberPreferences,
} from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type {
  ChecklistItem,
  Expense,
  Flight,
  GroupMember,
  PackingItem,
  Place,
  Trip,
} from '@/lib/types';
import { safeParse, MS_PER_DAY } from '@/lib/utils';
import { inferFlightLeg, sortFlightsByTime } from '@/lib/tripState';
import { resolveRenderableStorageUrl } from '@/lib/storageMedia';

// ---------- helpers ----------

function formatDate(iso: string): string {
  if (!iso) return '—';
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const d = safeParse(iso);
  if (!Number.isFinite(d.getTime())) return '—';
  const utcMs = d.getTime() + d.getTimezoneOffset() * 60000;
  const pht = new Date(utcMs + 8 * 60 * 60 * 1000);
  return `${MONTHS[pht.getMonth()]} ${pht.getDate()}`;
}

function formatTime(iso: string): string {
  if (!iso) return '—';
  const d = safeParse(iso);
  if (!Number.isFinite(d.getTime())) return '—';
  const utcMs = d.getTime() + d.getTimezoneOffset() * 60000;
  const pht = new Date(utcMs + 8 * 60 * 60 * 1000);
  let h = pht.getHours();
  const m = pht.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`;
}

function shortAirportCode(value?: string | null): string {
  const raw = (value ?? '').trim();
  if (!raw) return '---';
  const explicit = raw.match(/\b[A-Z]{3}\b/)?.[0];
  if (explicit) return explicit;
  const normalized = raw.toLowerCase();
  if (normalized.includes('boracay') || normalized.includes('caticlan') || normalized.includes('godofredo')) return 'MPH';
  if (normalized.includes('manila') || normalized.includes('ninoy')) return 'MNL';
  if (normalized.includes('cebu')) return 'CEB';
  if (normalized.includes('kalibo')) return 'KLO';
  const letters = raw.replace(/[^a-z]/gi, '').toUpperCase();
  return letters.length >= 3 ? letters.slice(0, 3) : (letters || '---');
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

async function resolveAvatarUrl(avatar?: string): Promise<string | undefined> {
  if (!avatar) return undefined;
  const primary = await resolveRenderableStorageUrl(avatar, 'avatars').catch(() => undefined);
  if (primary) return primary;
  return resolveRenderableStorageUrl(avatar, 'moments').catch(() => avatar);
}

function TripMemberAvatar({
  member,
  styles,
}: {
  member: GroupMember;
  styles: ReturnType<typeof getStyles>;
}) {
  const [resolvedAvatar, setResolvedAvatar] = useState<string | undefined>();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    setResolvedAvatar(undefined);
    if (!member.profilePhoto) return () => { cancelled = true; };

    resolveAvatarUrl(member.profilePhoto)
      .then((url) => {
        if (!cancelled) setResolvedAvatar(url ?? member.profilePhoto);
      })
      .catch(() => {
        if (!cancelled) setResolvedAvatar(member.profilePhoto);
      });

    return () => { cancelled = true; };
  }, [member.profilePhoto]);

  return (
    <View style={styles.memberAvatar}>
      {resolvedAvatar && !failed ? (
        <ExpoImage
          source={{ uri: resolvedAvatar }}
          style={styles.memberAvatarImage}
          contentFit="cover"
          cachePolicy="memory-disk"
          onError={() => setFailed(true)}
        />
      ) : (
        <Text style={styles.memberAvatarText}>
          {(member.name.trim().charAt(0) || '?').toUpperCase()}
        </Text>
      )}
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

type ControlSection = 'recap' | 'details' | 'companions' | 'essentials' | 'settings';

const CONTROL_SECTIONS: { key: ControlSection; label: string; icon: ElementType }[] = [
  { key: 'recap', label: 'Recap', icon: Sparkles },
  { key: 'details', label: 'Details', icon: ClipboardList },
  { key: 'companions', label: 'Companions', icon: Users },
  { key: 'essentials', label: 'Essentials', icon: Luggage },
  { key: 'settings', label: 'Settings', icon: Settings },
];

function normalizeSection(value: string | undefined, trip?: Trip | null): ControlSection {
  if (value === 'recap' || value === 'details' || value === 'companions' || value === 'essentials' || value === 'settings') {
    return value;
  }
  return trip?.status === 'Completed' ? 'recap' : 'details';
}

export default function TripOverviewScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ tripId?: string; section?: string }>();
  const tripId = typeof params.tripId === 'string' ? params.tripId : undefined;
  const requestedSection = typeof params.section === 'string' ? params.section : undefined;
  const scrollRef = useRef<ScrollView>(null);
  const flightsYRef = useRef(0);
  const didScrollToSectionRef = useRef(false);
  const [data, setData] = useState<OverviewData | null>(null);
  const [activeSection, setActiveSection] = useState<ControlSection>('details');
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
      setActiveSection(normalizeSection(requestedSection, trip));
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load overview');
    } finally {
      setLoading(false);
    }
  }, [requestedSection, tripId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (loading || !data || requestedSection !== 'flights' || didScrollToSectionRef.current) return;
    didScrollToSectionRef.current = true;
    const timer = setTimeout(() => {
      scrollRef.current?.scrollTo({
        y: Math.max(flightsYRef.current - spacing.md, 0),
        animated: true,
      });
    }, 180);
    return () => clearTimeout(timer);
  }, [data, loading, requestedSection]);

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

  const openRecap = () => router.push({ pathname: '/trip-summary', params: { tripId: trip.id } } as never);
  const openSummary = () => router.push({ pathname: '/trip-summary', params: { tripId: trip.id } } as never);
  const addPhoto = () => router.push({ pathname: '/add-moment', params: { tripId: trip.id } } as never);
  const uploadFile = () => router.push({ pathname: '/add-file', params: { tripId: trip.id } } as never);
  const rescanBooking = () => router.push({ pathname: '/scan-trip', params: { tripId: trip.id } } as never);
  const inviteCompanions = () => router.push('/invite' as never);
  const openProfile = (userId: string) => router.push({ pathname: '/profile/[userId]', params: { userId } } as never);

  const refreshMembers = async () => {
    const nextMembers = await getGroupMembers(trip.id).catch(() => members);
    setData({ ...data, members: nextMembers });
  };

  const handleRemoveMember = (member: GroupMember) => {
    if (member.role === 'Primary') {
      Alert.alert('Organizer stays on the trip', 'The primary traveler cannot be removed from this trip.');
      return;
    }
    Alert.alert(
      'Remove companion?',
      `${member.name} will be removed from this trip.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeGroupMember(member.id);
              await refreshMembers();
            } catch (e: any) {
              Alert.alert('Could not remove companion', e?.message ?? 'Please try again.');
            }
          },
        },
      ],
    );
  };

  const toggleMyStay = async (member: GroupMember) => {
    if (!user?.id || member.userId !== user.id) return;
    try {
      await updateMyTripMemberPreferences(trip.id, {
        sharesAccommodation: member.sharesAccommodation !== true,
        travelNotes: member.travelNotes,
      });
      await refreshMembers();
    } catch (e: any) {
      Alert.alert('Could not update stay preference', e?.message ?? 'Please try again.');
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header bar */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 }}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <ChevronLeft size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text, marginLeft: 10 }}>Trip Control Center</Text>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        ref={scrollRef}
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

        <View style={styles.controlTabs}>
          {CONTROL_SECTIONS.map((section) => {
            const active = activeSection === section.key;
            const Icon = section.icon;
            return (
              <Pressable
                key={section.key}
                style={[styles.controlTab, active && styles.controlTabActive]}
                onPress={() => setActiveSection(section.key)}
                accessibilityRole="button"
                accessibilityLabel={`Open ${section.label}`}
              >
                <Icon size={15} color={active ? colors.bg : colors.text2} strokeWidth={2} />
                <Text style={[styles.controlTabText, active && styles.controlTabTextActive]}>
                  {section.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {activeSection === 'recap' && (
          <>
            <View style={styles.memoryCard}>
              <View style={styles.memoryIcon}>
                <Sparkles size={22} color={colors.accent} />
              </View>
              <Text style={styles.memoryKicker}>Trip recap</Text>
              <Text style={styles.memoryTitle}>
                {trip.destination || trip.name} is ready to remember
              </Text>
              <Text style={styles.memoryBody}>
                Replay the trip, add missing photos, or open the full travel summary.
              </Text>
              <Pressable style={styles.primaryAction} onPress={openRecap}>
                <Text style={styles.primaryActionText}>View Recap</Text>
              </Pressable>
              <View style={styles.actionGrid}>
                <Pressable style={styles.secondaryAction} onPress={addPhoto}>
                  <ImagePlus size={16} color={colors.accent} />
                  <Text style={styles.secondaryActionText}>Add Photo</Text>
                </Pressable>
                <Pressable style={styles.secondaryAction} onPress={openSummary}>
                  <FileText size={16} color={colors.accent} />
                  <Text style={styles.secondaryActionText}>Full Summary</Text>
                </Pressable>
              </View>
            </View>
          </>
        )}

        {activeSection === 'details' && (
          <>
            <Pressable
              style={styles.scanDetailsBtn}
              onPress={rescanBooking}
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
          <View onLayout={(event) => { flightsYRef.current = event.nativeEvent.layout.y; }}>
          <CollapsibleCard icon={<Plane size={18} color={colors.blue} />} title="Flights">
            {orderedFlights.map(({ flight, leg }, index) => (
              <View key={flight.id} style={[styles.flightCard, index > 0 && { marginTop: spacing.sm }]}>
                <View style={styles.flightHeader}>
                  <Text style={[
                    styles.flightDir,
                    leg === 'return' && { backgroundColor: colors.amber + '20', color: colors.amber },
                  ]}>
                    {leg === 'return' ? 'Return' : 'Outbound'}
                  </Text>
                  <Text style={styles.flightNumber} numberOfLines={1}>
                    {[flight.airline, flight.flightNumber].filter(Boolean).join(' · ') || 'Flight'}
                  </Text>
                </View>
                <View style={styles.flightRouteRow}>
                  <View style={styles.flightEndpoint}>
                    <Text style={styles.flightAirportCode} numberOfLines={1} adjustsFontSizeToFit>
                      {shortAirportCode(flight.from)}
                    </Text>
                    <Text style={styles.flightAirportLabel} numberOfLines={2}>
                      {flight.from || 'Departure'}
                    </Text>
                    <Text style={styles.flightTime}>{formatTime(flight.departTime)}</Text>
                  </View>
                  <View style={styles.flightLine}>
                    <View style={styles.flightDot} />
                    <View style={styles.flightDash} />
                    <Plane size={15} color={colors.text3} strokeWidth={1.8} />
                    <View style={styles.flightDash} />
                    <View style={styles.flightDot} />
                  </View>
                  <View style={[styles.flightEndpoint, styles.flightEndpointRight]}>
                    <Text style={styles.flightAirportCode} numberOfLines={1} adjustsFontSizeToFit>
                      {shortAirportCode(flight.to)}
                    </Text>
                    <Text style={[styles.flightAirportLabel, styles.flightAirportLabelRight]} numberOfLines={2}>
                      {flight.to || 'Arrival'}
                    </Text>
                    <Text style={styles.flightTime}>{formatTime(flight.arriveTime)}</Text>
                  </View>
                </View>
                <Text style={styles.flightDate} numberOfLines={1}>
                  {formatDate(flight.departTime)}
                  {flight.bookingRef ? ` · Ref ${flight.bookingRef}` : ''}
                  {flight.baggage ? ` · ${flight.baggage}` : ''}
                </Text>
              </View>
            ))}
          </CollapsibleCard>
          </View>
        ) : null}
          </>
        )}

        {/* Group */}
        {activeSection === 'companions' && (
          <CollapsibleCard icon={<Users size={18} color={colors.green2} />} title={`Companions (${members.length})`}>
            {trip.status !== 'Completed' ? (
              <Pressable style={styles.scanDetailsBtn} onPress={inviteCompanions}>
                <View style={styles.scanDetailsIcon}>
                  <UserPlus size={18} color={colors.accent} strokeWidth={2} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.scanDetailsTitle}>Invite companions</Text>
                  <Text style={styles.scanDetailsSub}>
                    Share trip access and keep traveler details in sync.
                  </Text>
                </View>
              </Pressable>
            ) : (
              <Text style={styles.emptySectionText}>
                These are the travelers saved on this completed trip.
              </Text>
            )}
            <View style={styles.memberList}>
              {members.length > 0 ? members.map((m) => {
                const isSelf = !!user?.id && m.userId === user.id;
                return (
                <View key={m.id} style={styles.memberCard}>
                  <TripMemberAvatar member={m} styles={styles} />
                  <View style={styles.memberInfo}>
                    <View style={styles.memberNameRow}>
                      <Text style={styles.memberName} numberOfLines={1}>{m.name}</Text>
                      {isSelf ? <Text style={styles.youBadge}>You</Text> : null}
                    </View>
                    <View style={styles.memberBadgeRow}>
                      <View style={styles.roleBadge}>
                        <Text style={styles.roleBadgeText}>{m.role}</Text>
                      </View>
                      {m.userId ? (
                        <View style={styles.linkedBadge}>
                          <Text style={styles.linkedBadgeText}>On app</Text>
                        </View>
                      ) : (
                        <View style={styles.pendingBadge}>
                          <Text style={styles.pendingBadgeText}>Invite pending</Text>
                        </View>
                      )}
                      {m.sharesAccommodation !== undefined ? (
                        <View style={styles.stayBadge}>
                          <Text style={styles.stayBadgeText}>{m.sharesAccommodation ? 'Same stay' : 'Own stay'}</Text>
                        </View>
                      ) : null}
                      {m.flightId ? (
                        <View style={styles.stayBadge}>
                          <Text style={styles.stayBadgeText}>Flight linked</Text>
                        </View>
                      ) : null}
                    </View>
                    {m.travelNotes ? <Text style={styles.memberNote} numberOfLines={2}>{m.travelNotes}</Text> : null}
                    <View style={styles.memberActions}>
                      {m.userId ? (
                        <Pressable style={styles.memberActionBtn} onPress={() => openProfile(m.userId!)}>
                          <Text style={styles.memberActionText}>Profile</Text>
                        </Pressable>
                      ) : (
                        <Pressable style={styles.memberActionBtn} onPress={inviteCompanions}>
                          <Text style={styles.memberActionText}>Send invite</Text>
                        </Pressable>
                      )}
                      {isSelf ? (
                        <Pressable style={styles.memberActionBtn} onPress={() => toggleMyStay(m)}>
                          <Text style={styles.memberActionText}>
                            {m.sharesAccommodation === true ? 'Own stay' : 'Same stay'}
                          </Text>
                        </Pressable>
                      ) : null}
                      {m.role !== 'Primary' && trip.status !== 'Completed' ? (
                        <Pressable style={[styles.memberActionBtn, styles.memberDangerBtn]} onPress={() => handleRemoveMember(m)}>
                          <Text style={styles.memberDangerText}>Remove</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                </View>
              );}) : (
                <Text style={styles.emptySectionText}>No companions added yet.</Text>
              )}
            </View>
          </CollapsibleCard>
        )}

        {/* Packing */}
        {activeSection === 'essentials' && (
          <>
          <Pressable style={styles.scanDetailsBtn} onPress={uploadFile}>
            <View style={styles.scanDetailsIcon}>
              <FileText size={18} color={colors.accent} strokeWidth={2} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.scanDetailsTitle}>Upload travel files</Text>
              <Text style={styles.scanDetailsSub}>
                Save boarding passes, IDs, hotel bookings, and shared documents.
              </Text>
            </View>
          </Pressable>
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
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No saved essentials for this trip yet</Text>
              <Text style={styles.emptySectionText}>
                Upload files or add packing items when you want this trip record to keep them.
              </Text>
            </View>
          )}
          </>
        )}

        {/* Budget */}
        {activeSection === 'details' && expenses.length > 0 ? (
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
        {activeSection === 'essentials' && checklist.length > 0 ? (
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
        {activeSection === 'details' && places.length > 0 ? (
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

        {activeSection === 'settings' && (
          <>
            <Pressable style={styles.scanDetailsBtn} onPress={rescanBooking}>
              <View style={styles.scanDetailsIcon}>
                <ClipboardList size={18} color={colors.accent} strokeWidth={2} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.scanDetailsTitle}>Rescan Booking</Text>
                <Text style={styles.scanDetailsSub}>Refresh hotel, date, and flight details from a new screenshot.</Text>
              </View>
            </Pressable>
            <Pressable style={styles.scanDetailsBtn} onPress={() => setActiveSection('details')}>
              <View style={styles.scanDetailsIcon}>
                <Settings size={18} color={colors.accent} strokeWidth={2} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.scanDetailsTitle}>Edit Trip Details</Text>
                <Text style={styles.scanDetailsSub}>Update accommodation, flight, budget, and saved-place information.</Text>
              </View>
            </Pressable>
            <Pressable style={styles.scanDetailsBtn} onPress={openRecap}>
              <View style={styles.scanDetailsIcon}>
                <Share2 size={18} color={colors.accent} strokeWidth={2} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.scanDetailsTitle}>Open Share Recap</Text>
                <Text style={styles.scanDetailsSub}>Replay or share this trip’s memory card.</Text>
              </View>
            </Pressable>
          </>
        )}
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
  controlTabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.xs,
  },
  controlTab: {
    flexGrow: 1,
    minWidth: '30%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: radius.md,
  },
  controlTabActive: {
    backgroundColor: colors.accent,
  },
  controlTabText: {
    color: colors.text2,
    fontSize: 12,
    fontWeight: '800',
  },
  controlTabTextActive: {
    color: colors.bg,
  },
  memoryCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.sm,
    ...elevation.card,
  },
  memoryIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.accentBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memoryKicker: {
    color: colors.text3,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  memoryTitle: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '900',
    lineHeight: 30,
  },
  memoryBody: {
    color: colors.text2,
    fontSize: 14,
    lineHeight: 20,
  },
  primaryAction: {
    marginTop: spacing.sm,
    backgroundColor: colors.accent,
    borderRadius: radius.lg,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryActionText: {
    color: colors.bg,
    fontSize: 15,
    fontWeight: '900',
  },
  actionGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  secondaryAction: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg3,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  secondaryActionText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
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
  flightCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg3,
    padding: spacing.md,
    gap: spacing.sm,
  },
  flightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  flightDir: {
    backgroundColor: colors.blue + '20',
    color: colors.blue,
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.sm,
    overflow: 'hidden',
    textTransform: 'uppercase',
  },
  flightNumber: {
    flex: 1,
    minWidth: 0,
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  flightRouteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  flightEndpoint: {
    flex: 1,
    minWidth: 0,
  },
  flightEndpointRight: {
    alignItems: 'flex-end',
  },
  flightAirportCode: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 0,
  },
  flightAirportLabel: {
    color: colors.text2,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2,
  },
  flightAirportLabelRight: {
    textAlign: 'right',
  },
  flightTime: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 6,
  },
  flightLine: {
    flex: 0.8,
    minWidth: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  flightDot: {
    width: 5,
    height: 5,
    borderRadius: 999,
    backgroundColor: colors.text3,
  },
  flightDash: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border2,
  },
  flightDate: {
    color: colors.text3,
    fontSize: 11,
    lineHeight: 15,
  },

  // group
  memberList: { gap: spacing.sm },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    backgroundColor: colors.bg3,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  memberAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accentBg,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  memberAvatarImage: {
    width: '100%',
    height: '100%',
  },
  memberAvatarText: {
    color: colors.accent,
    fontSize: 16,
    fontWeight: '900',
  },
  memberInfo: {
    flex: 1,
    minWidth: 0,
  },
  memberNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  memberName: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  youBadge: {
    color: colors.accent,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  memberBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  emptyCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  emptySectionText: {
    color: colors.text2,
    fontSize: 13,
    lineHeight: 19,
  },
  roleBadge: {
    backgroundColor: colors.purple + '30',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  roleBadgeText: { color: colors.purple, fontSize: 10, fontWeight: '700' },
  linkedBadge: {
    backgroundColor: colors.green + '20',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  linkedBadgeText: { color: colors.green2, fontSize: 10, fontWeight: '700' },
  pendingBadge: {
    backgroundColor: colors.amber + '20',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  pendingBadgeText: { color: colors.amber, fontSize: 10, fontWeight: '700' },
  stayBadge: {
    backgroundColor: colors.card,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stayBadgeText: { color: colors.text2, fontSize: 10, fontWeight: '700' },
  memberNote: {
    color: colors.text2,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 8,
  },
  memberActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  memberActionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  memberActionText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '800',
  },
  memberDangerBtn: {
    borderColor: colors.danger + '40',
  },
  memberDangerText: {
    color: colors.danger,
    fontSize: 11,
    fontWeight: '800',
  },

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
