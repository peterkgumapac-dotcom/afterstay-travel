import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  ArrowLeft, Plane, Hotel, MapPin, Users, Wallet, Calendar,
} from 'lucide-react-native';
import { FLIGHTS } from '../lib/flightData';
import { getActiveTrip, getExpenses, getGroupMembers } from '../lib/notion';
import type { Expense, GroupMember, Trip } from '../lib/types';

export default function TripSummary() {
  const router = useRouter();
  const [tripSpent, setTripSpent] = useState(0);
  const [total, setTotal] = useState(0);
  const [members, setMembers] = useState<GroupMember[]>([]);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const trip = await getActiveTrip();
        if (cancelled || !trip) return;

        const [expenses, grp] = await Promise.all([
          getExpenses(trip.id).catch(() => [] as Expense[]),
          getGroupMembers(trip.id).catch(() => [] as GroupMember[]),
        ]);
        if (cancelled) return;

        const isAccommodation = (e: Expense) => {
          const desc = (e.description ?? '').toLowerCase();
          return e.category === 'Accommodation' || desc.includes('hotel') || desc.includes('canyon');
        };
        const dailyTotal = expenses
          .filter(e => !isAccommodation(e))
          .reduce((sum, e) => sum + e.amount, 0);

        setTripSpent(dailyTotal);
        setTotal(trip.budgetLimit ?? 0);
        setMembers(grp);
      } catch {}
    })();
    return () => { cancelled = true; };
  }, []);

  const TRIP_START = new Date('2026-04-20T00:00:00+08:00');
  const TRIP_DAYS = 7;
  const days = Array.from({ length: TRIP_DAYS }, (_, i) => {
    const d = new Date(TRIP_START);
    d.setDate(d.getDate() + i);
    return d;
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft color="#fff" size={22} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Trip Summary</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>Boracay 2026</Text>
          <Text style={styles.heroDates}>Apr 20 – Apr 27 · 7 nights</Text>
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

          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Plane color="#2dd4a0" size={18} strokeWidth={2} />
              <Text style={styles.cardTitle}>Outbound</Text>
            </View>
            <Text style={styles.cardLine}>{FLIGHTS.outbound.airline} {FLIGHTS.outbound.number}</Text>
            <Text style={styles.cardSubLine}>
              {FLIGHTS.outbound.depart.code} {FLIGHTS.outbound.depart.time} {'\u2192'} {FLIGHTS.outbound.arrive.code} {FLIGHTS.outbound.arrive.time}
            </Text>
            <Text style={styles.cardMeta}>Ref: {FLIGHTS.outbound.ref}</Text>
          </View>

          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Plane color="#2dd4a0" size={18} strokeWidth={2} style={{ transform: [{ rotate: '180deg' }] }} />
              <Text style={styles.cardTitle}>Return</Text>
            </View>
            <Text style={styles.cardLine}>{FLIGHTS.return.airline} {FLIGHTS.return.number}</Text>
            <Text style={styles.cardSubLine}>
              {FLIGHTS.return.depart.code} {FLIGHTS.return.depart.time} {'\u2192'} {FLIGHTS.return.arrive.code} {FLIGHTS.return.arrive.time}
            </Text>
            <Text style={styles.cardMeta}>Ref: {FLIGHTS.return.ref}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Stay</Text>
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Hotel color="#2dd4a0" size={18} strokeWidth={2} />
              <Text style={styles.cardTitle}>Canyon Hotels & Resorts</Text>
            </View>
            <View style={styles.metaRow}>
              <MapPin color="#5a6577" size={14} />
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
                <Wallet color="#2dd4a0" size={18} strokeWidth={2} />
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
                <Users color="#2dd4a0" size={18} strokeWidth={2} />
                <Text style={styles.cardTitle}>{members.length} people</Text>
              </View>
              {members.map((m) => (
                <View key={m.id} style={styles.memberRow}>
                  {m.profilePhoto ? (
                    <Image source={{ uri: m.profilePhoto }} style={styles.avatar} />
                  ) : (
                    <View style={[styles.avatar, styles.avatarPlaceholder]}>
                      <Text style={{ color: '#2dd4a0' }}>{m.name.charAt(0)}</Text>
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080b12' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 10,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#1a1f27',
  },
  headerTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  hero: { paddingHorizontal: 16, paddingVertical: 16 },
  heroTitle: { color: '#fff', fontSize: 32, fontWeight: '800' },
  heroDates: { color: '#8b95a5', fontSize: 14, marginTop: 4 },
  section: { paddingHorizontal: 16, paddingTop: 16 },
  sectionLabel: {
    color: '#5a6577', fontSize: 11, fontWeight: '700',
    letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10,
  },
  calendarRow: { gap: 8, paddingVertical: 4 },
  dayChip: {
    backgroundColor: '#0f1318', borderWidth: 1, borderColor: '#1e2530',
    borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14,
    alignItems: 'center', minWidth: 60,
  },
  dayWeekday: { color: '#5a6577', fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  dayNumber: { color: '#fff', fontSize: 22, fontWeight: '700', marginVertical: 2 },
  dayMonth: { color: '#5a6577', fontSize: 10 },
  card: {
    backgroundColor: '#0f1318', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: '#1e2530', marginBottom: 10,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  cardTitle: { color: '#fff', fontSize: 15, fontWeight: '700' },
  cardLine: { color: '#fff', fontSize: 14, marginVertical: 2 },
  cardSubLine: { color: '#8b95a5', fontSize: 13, marginVertical: 2 },
  cardMeta: { color: '#5a6577', fontSize: 11, marginTop: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginVertical: 2 },
  budgetRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 4 },
  budgetSpent: { color: '#2dd4a0', fontSize: 24, fontWeight: '800', fontVariant: ['tabular-nums'] },
  budgetTotal: { color: '#5a6577', fontSize: 14, fontVariant: ['tabular-nums'] },
  progressTrack: {
    height: 4, backgroundColor: '#1a1f27', borderRadius: 2,
    overflow: 'hidden', marginTop: 10,
  },
  progressFill: { height: '100%', backgroundColor: '#2dd4a0', borderRadius: 2 },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#1a1f27' },
  avatarPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  memberName: { color: '#fff', fontSize: 14, fontWeight: '600' },
  memberRole: { color: '#5a6577', fontSize: 11 },
});
