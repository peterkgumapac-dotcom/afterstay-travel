import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { CheckCircle, Plane, UserPlus } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';

import FormField from '@/components/FormField';
import { useTheme } from '@/constants/ThemeContext';
import { radius, spacing } from '@/constants/theme';
import { joinTripByCode, addFlight } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { formatDatePHT } from '@/lib/utils';
import type { Trip } from '@/lib/types';

type Phase = 'code' | 'welcome' | 'flight';

export default function JoinTripScreen() {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const router = useRouter();
  const { code: initialCode } = useLocalSearchParams<{ code?: string }>();
  const { user } = useAuth();

  const [phase, setPhase] = useState<Phase>('code');
  const [code, setCode] = useState(initialCode?.toUpperCase() ?? '');
  const [name, setName] = useState(
    user?.user_metadata?.full_name ?? user?.email?.split('@')[0] ?? '',
  );
  const [joining, setJoining] = useState(false);
  const [tripInfo, setTripInfo] = useState<Trip | null>(null);

  // Flight fields
  const [flightNumber, setFlightNumber] = useState('');
  const [airline, setAirline] = useState('');
  const [departTime, setDepartTime] = useState('');
  const [arriveTime, setArriveTime] = useState('');
  const [savingFlight, setSavingFlight] = useState(false);

  const handleJoin = async () => {
    if (!code.trim()) return Alert.alert('Enter an invite code');
    if (!name.trim()) return Alert.alert('Enter your name');

    setJoining(true);
    try {
      const result = await joinTripByCode(code.trim(), name.trim());
      setTripInfo(result.trip);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setPhase('welcome');
    } catch (e: any) {
      Alert.alert('Could not join', e?.message ?? 'Invalid or expired code');
    } finally {
      setJoining(false);
    }
  };

  const handleAddFlight = async () => {
    if (!flightNumber.trim() || !tripInfo) return;
    setSavingFlight(true);
    try {
      await addFlight({
        tripId: tripInfo.id,
        direction: 'Outbound',
        flightNumber: flightNumber.trim(),
        airline: airline.trim() || undefined,
        departTime: departTime.trim() || undefined,
        arriveTime: arriveTime.trim() || undefined,
        passenger: name,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/(tabs)/home' as never);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to save flight');
    } finally {
      setSavingFlight(false);
    }
  };

  const handleSkipFlight = () => {
    router.replace('/(tabs)/home' as never);
  };

  // ── Phase: Enter code ──
  if (phase === 'code') {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.content}>
          <View style={styles.header}>
            <View style={[styles.iconCircle, { backgroundColor: colors.accentBg }]}>
              <UserPlus size={28} color={colors.accent} strokeWidth={1.8} />
            </View>
            <Text style={styles.title}>Join a trip</Text>
            <Text style={styles.subtitle}>
              Enter the invite code shared by your travel group.
            </Text>
          </View>

          <FormField
            label="Invite Code"
            placeholder="e.g. A1B2C3"
            value={code}
            onChangeText={(t) => setCode(t.toUpperCase())}
            autoCapitalize="characters"
            autoFocus={!initialCode}
          />
          <FormField
            label="Your Name"
            placeholder="e.g. Jane"
            value={name}
            onChangeText={setName}
          />

          <Pressable
            style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.8 }]}
            onPress={handleJoin}
            disabled={joining}
          >
            {joining ? (
              <ActivityIndicator color={colors.ink} />
            ) : (
              <Text style={styles.primaryText}>Join trip</Text>
            )}
          </Pressable>

          <Pressable onPress={() => router.back()} style={styles.cancelBtn}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ── Phase: Welcome ──
  if (phase === 'welcome' && tripInfo) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScrollView contentContainerStyle={styles.content}>
          <Animated.View entering={FadeInDown.duration(400)} style={styles.header}>
            <View style={[styles.iconCircle, { backgroundColor: 'rgba(79,179,114,0.15)' }]}>
              <CheckCircle size={28} color="#4fb372" strokeWidth={1.8} />
            </View>
            <Text style={styles.title}>You're in!</Text>
            <Text style={styles.subtitle}>
              Welcome to the trip, {name}
            </Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.duration(350).delay(150)} style={styles.tripCard}>
            <Text style={styles.tripCardLabel}>YOUR TRIP</Text>
            <Text style={styles.tripCardDest}>{tripInfo.destination}</Text>
            <Text style={styles.tripCardDates}>
              {formatDatePHT(tripInfo.startDate)} – {formatDatePHT(tripInfo.endDate)}
            </Text>
            {tripInfo.accommodation && (
              <Text style={styles.tripCardHotel}>{tripInfo.accommodation}</Text>
            )}
          </Animated.View>

          <Animated.View entering={FadeInDown.duration(350).delay(300)}>
            <Pressable
              style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.8 }]}
              onPress={() => setPhase('flight')}
            >
              <Plane size={16} color={colors.ink} strokeWidth={2} />
              <Text style={styles.primaryText}>Add my flight details</Text>
            </Pressable>
          </Animated.View>

          <Animated.View entering={FadeInDown.duration(300).delay(400)}>
            <Pressable onPress={handleSkipFlight} style={styles.cancelBtn}>
              <Text style={styles.cancelText}>Skip for now</Text>
            </Pressable>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Phase: Add flight ──
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.title}>Your flight</Text>
          <Text style={styles.subtitle}>
            Add your outbound flight to {tripInfo?.destination ?? 'the trip'}
          </Text>
        </View>

        <FormField
          label="Flight Number"
          placeholder="e.g. 5J 123"
          value={flightNumber}
          onChangeText={setFlightNumber}
          autoFocus
        />
        <FormField
          label="Airline (optional)"
          placeholder="e.g. Cebu Pacific"
          value={airline}
          onChangeText={setAirline}
        />
        <FormField
          label="Departure Time (optional)"
          placeholder="e.g. 2026-04-20 06:00"
          value={departTime}
          onChangeText={setDepartTime}
        />
        <FormField
          label="Arrival Time (optional)"
          placeholder="e.g. 2026-04-20 07:05"
          value={arriveTime}
          onChangeText={setArriveTime}
        />

        <Pressable
          style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.8 }]}
          onPress={handleAddFlight}
          disabled={savingFlight}
        >
          {savingFlight ? (
            <ActivityIndicator color={colors.ink} />
          ) : (
            <Text style={styles.primaryText}>Save flight</Text>
          )}
        </Pressable>

        <Pressable onPress={handleSkipFlight} style={styles.cancelBtn}>
          <Text style={styles.cancelText}>Skip</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (colors: ReturnType<typeof import('@/constants/ThemeContext').useTheme>['colors']) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    content: {
      flexGrow: 1,
      padding: spacing.xl,
      justifyContent: 'center',
      gap: spacing.lg,
    },
    header: { alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
    iconCircle: {
      width: 64,
      height: 64,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.sm,
    },
    title: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.text,
      letterSpacing: -0.3,
    },
    subtitle: {
      fontSize: 13,
      color: colors.text3,
      textAlign: 'center',
      lineHeight: 18,
      maxWidth: 280,
    },
    primaryBtn: {
      flexDirection: 'row',
      backgroundColor: colors.accent,
      paddingVertical: 14,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      marginTop: spacing.sm,
    },
    primaryText: { fontSize: 15, fontWeight: '700', color: colors.ink },
    cancelBtn: { alignItems: 'center', paddingVertical: spacing.md },
    cancelText: { fontSize: 14, color: colors.text2 },

    // Trip card
    tripCard: {
      padding: spacing.xl,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.lg,
      alignItems: 'center',
      gap: spacing.xs,
    },
    tripCardLabel: {
      fontSize: 10,
      fontWeight: '700',
      color: colors.text3,
      letterSpacing: 1.5,
      marginBottom: spacing.xs,
    },
    tripCardDest: {
      fontSize: 20,
      fontWeight: '600',
      color: colors.text,
      letterSpacing: -0.3,
    },
    tripCardDates: {
      fontSize: 13,
      color: colors.text2,
    },
    tripCardHotel: {
      fontSize: 12,
      color: colors.text3,
      marginTop: spacing.xs,
    },
  });
