import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  ArrowLeft, Plane, Hotel, MapPin, Users, Wallet, Calendar,
} from 'lucide-react-native';
import { getActiveTrip, getExpenses, getFlights, getGroupMembers } from '../lib/supabase';
import type { Expense, Flight, GroupMember, Trip } from '../lib/types';
import { useTheme } from '@/constants/ThemeContext';
import { formatDatePHT, formatTimePHT, safeParse } from '@/lib/utils';

export default function TripSummary() {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const router = useRouter();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [flights, setFlights] = useState<Flight[]>([]);
  const [tripSpent, setTripSpent] = useState(0);
  const [total, setTotal] = useState(0);
  const [members, setMembers] = useState<GroupMember[]>([]);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const t = await getActiveTrip();
        if (cancelled || !t) return;
        setTrip(t);

        const [fs, expenses, grp] = await Promise.all([
          getFlights(t.id).catch(() => [] as Flight[]),
          getExpenses(t.id).catch(() => [] as Expense[]),
          getGroupMembers(t.id).catch(() => [] as GroupMember[]),
        ]);
        if (cancelled) return;

        setFlights(fs);

        const isAccommodation = (e: Expense) => {
          const desc = (e.description ?? '').toLowerCase();
          return e.category === 'Accommodation' || desc.includes('hotel') || desc.includes('canyon');
        };
        const dailyTotal = expenses
          .filter(e => !isAccommodation(e))
          .reduce((sum, e) => sum + e.amount, 0);

        setTripSpent(dailyTotal);
        setTotal(t.budgetLimit ?? 0);
        setMembers(grp);
      } catch {}
    })();
    return () => { cancelled = true; };
  }, []);

  const outbound = flights.find((f) => f.direction === 'Outbound');
  const returnFlight = flights.find((f) => f.direction === 'Return');

  const tripStart = trip ? safeParse(trip.startDate) : new Date();
  const tripEnd = trip ? safeParse(trip.endDate) : new Date();
  const tripDays = Math.max(1, Math.ceil((tripEnd.getTime() - tripStart.getTime()) / 86400000) + 1);
  const days = Array.from({ length: tripDays }, (_, i) => {
    const d = new Date(tripStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft color={colors.text} size={22} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Trip Summary</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>{trip?.destination ?? 'Trip'} {tripEnd.getFullYear()}</Text>
          <Text style={styles.heroDates}>
            {trip ? `${formatDatePHT(trip.startDate)} \u2013 ${formatDatePHT(trip.endDate)} \u00B7 ${tripDays - 1} nights` : ''}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Day by day</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.calendarRow}>
            {days.map((d, i) => (
              <View key={i} style={styles.dayChip}>
                <Text style={styles.dayWeekday}>
                  {d.toLocaleDateString('en-US', { weekday: 'short' })}
                </Text>
                <Text style={styles.dayNumber}>{d.getDate()}</Text>
                <Text style={styles.dayMonth}>
                  {d.toLocaleDateString('en-US', { month: 'short' })}
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Flights</Text>

          {outbound && (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Plane color={colors.accent} size={18} strokeWidth={2} />
                <Text style={styles.cardTitle}>Outbound</Text>
              </View>
              <Text style={styles.cardLine}>{outbound.airline} {outbound.flightNumber}</Text>
              <Text style={styles.cardSubLine}>
                {outbound.from} {formatTimePHT(outbound.departTime)} {'\u2192'} {outbound.to} {formatTimePHT(outbound.arriveTime)}
              </Text>
              {outbound.bookingRef && <Text style={styles.cardMeta}>Ref: {outbound.bookingRef}</Text>}
            </View>
          )}

          {returnFlight && (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Plane color={colors.accent} size={18} strokeWidth={2} style={{ transform: [{ rotate: '180deg' }] }} />
                <Text style={styles.cardTitle}>Return</Text>
              </View>
              <Text style={styles.cardLine}>{returnFlight.airline} {returnFlight.flightNumber}</Text>
              <Text style={styles.cardSubLine}>
                {returnFlight.from} {formatTimePHT(returnFlight.departTime)} {'\u2192'} {returnFlight.to} {formatTimePHT(returnFlight.arriveTime)}
              </Text>
              {returnFlight.bookingRef && <Text style={styles.cardMeta}>Ref: {returnFlight.bookingRef}</Text>}
            </View>
          )}

          {!outbound && !returnFlight && (
            <View style={styles.card}>
              <Text style={styles.cardSubLine}>No flights added yet</Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Stay</Text>
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Hotel color={colors.accent} size={18} strokeWidth={2} />
              <Text style={styles.cardTitle}>Canyon Hotels & Resorts</Text>
            </View>
            <View style={styles.metaRow}>
              <MapPin color={colors.text3} size={14} />
              <Text style={styles.cardSubLine}>Station B, Sitio Sinagpa, Balabag</Text>
            </View>
            <Text style={styles.cardMeta}>Check-in 3:00 PM · Check-out 12:00 PM</Text>
          </View>
        </View>

        {total > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Budget</Text>
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Wallet color={colors.accent} size={18} strokeWidth={2} />
                <Text style={styles.cardTitle}>Trip spending</Text>
              </View>
              <View style={styles.budgetRow}>
                <Text style={styles.budgetSpent}>{'\u20B1'}{tripSpent.toLocaleString()}</Text>
                <Text style={styles.budgetTotal}> / {'\u20B1'}{total.toLocaleString()}</Text>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${Math.min(100, total > 0 ? (tripSpent / total) * 100 : 0)}%` }]} />
              </View>
              <Text style={styles.cardMeta}>
                {total > 0 ? Math.round((tripSpent / total) * 100) : 0}% used · {'\u20B1'}{Math.max(0, total - tripSpent).toLocaleString()} remaining
              </Text>
            </View>
          </View>
        )}

        {members.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Travelers</Text>
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Users color={colors.accent} size={18} strokeWidth={2} />
                <Text style={styles.cardTitle}>{members.length} people</Text>
              </View>
              {members.map((m) => (
                <View key={m.id} style={styles.memberRow}>
                  {m.profilePhoto ? (
                    <Image source={{ uri: m.profilePhoto }} style={styles.avatar} />
                  ) : (
                    <View style={[styles.avatar, styles.avatarPlaceholder]}>
                      <Text style={{ color: colors.accent }}>{m.name.charAt(0)}</Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.memberName}>{m.name}</Text>
                    <Text style={styles.memberRole}>{m.role}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 10,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.card,
  },
  headerTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  hero: { paddingHorizontal: 16, paddingVertical: 16 },
  heroTitle: { color: colors.text, fontSize: 32, fontWeight: '800' },
  heroDates: { color: colors.text2, fontSize: 14, marginTop: 4 },
  section: { paddingHorizontal: 16, paddingTop: 16 },
  sectionLabel: {
    color: colors.text3, fontSize: 11, fontWeight: '700',
    letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10,
  },
  calendarRow: { gap: 8, paddingVertical: 4 },
  dayChip: {
    backgroundColor: colors.bg2, borderWidth: 1, borderColor: colors.border,
    borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14,
    alignItems: 'center', minWidth: 60,
  },
  dayWeekday: { color: colors.text3, fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  dayNumber: { color: colors.text, fontSize: 22, fontWeight: '700', marginVertical: 2 },
  dayMonth: { color: colors.text3, fontSize: 10 },
  card: {
    backgroundColor: colors.bg2, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: colors.border, marginBottom: 10,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  cardTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  cardLine: { color: colors.text, fontSize: 14, marginVertical: 2 },
  cardSubLine: { color: colors.text2, fontSize: 13, marginVertical: 2 },
  cardMeta: { color: colors.text3, fontSize: 11, marginTop: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginVertical: 2 },
  budgetRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 4 },
  budgetSpent: { color: colors.accent, fontSize: 24, fontWeight: '800', fontVariant: ['tabular-nums'] },
  budgetTotal: { color: colors.text3, fontSize: 14, fontVariant: ['tabular-nums'] },
  progressTrack: {
    height: 4, backgroundColor: colors.card, borderRadius: 2,
    overflow: 'hidden', marginTop: 10,
  },
  progressFill: { height: '100%', backgroundColor: colors.accent, borderRadius: 2 },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.card },
  avatarPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  memberName: { color: colors.text, fontSize: 14, fontWeight: '600' },
  memberRole: { color: colors.text3, fontSize: 11 },
});
