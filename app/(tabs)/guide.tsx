import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  Linking,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  ArrowLeft,
  Hotel,
  Phone,
  Wifi,
  Key,
  MapPin,
  Clock,
  ExternalLink,
  Copy,
} from 'lucide-react-native';

import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';

import { useTheme } from '@/constants/ThemeContext';
import { useUserSegment } from '@/contexts/UserSegmentContext';
import EmptyState from '@/components/shared/EmptyState';
import { TabErrorBoundary } from '@/components/shared/TabErrorBoundary';
import { getActiveTrip } from '@/lib/supabase';
import { formatDatePHT } from '@/lib/utils';
import type { Trip } from '@/lib/types';

type ThemeColors = ReturnType<typeof useTheme>['colors'];

export default function GuideScreenWithBoundary() {
  return (
    <TabErrorBoundary name="Guide">
      <GuideScreen />
    </TabErrorBoundary>
  );
}

function GuideScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { isTestMode, mockData } = useUserSegment();
  const testModeRef = useRef(isTestMode);
  testModeRef.current = isTestMode;
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Dev test mode: apply mock trip
  useEffect(() => {
    if (!isTestMode || !mockData) return;
    setTrip(mockData.trip);
  }, [isTestMode, mockData]);

  const prevTestModeGuide = useRef(isTestMode);
  useEffect(() => {
    if (prevTestModeGuide.current && !isTestMode) {
      loadTrip(true);
    }
    prevTestModeGuide.current = isTestMode;
  }, [isTestMode]);

  const loadTrip = useCallback((force = false) => {
    if (testModeRef.current) { setRefreshing(false); return; }
    getActiveTrip(force)
      .then((t) => {
        if (t) setTrip(t);
        setRefreshing(false);
      }, (err) => {
        if (__DEV__) console.warn('[Guide] loadTrip failed:', err);
        setRefreshing(false);
      });
  }, []);

  useEffect(() => { loadTrip(); }, [loadTrip]);

  const hotelName = trip?.accommodation ?? '';
  const hotelAddr = trip?.address ?? '';
  const checkInTime = trip?.checkIn ?? '';
  const checkOutTime = trip?.checkOut ?? '';
  const destLabel = trip?.destination ?? '';
  const checkInDate = trip ? formatDatePHT(trip.startDate) : '';
  const checkOutDate = trip ? formatDatePHT(trip.endDate) : '';

  const hotelPhotoUrl = (() => {
    if (!trip?.hotelPhotos) return '';
    try {
      const parsed = JSON.parse(trip.hotelPhotos);
      return Array.isArray(parsed) && parsed.length > 0 ? parsed[0] : '';
    } catch { return ''; }
  })();

  const copyToClipboard = async (text: string) => {
    await Clipboard.setStringAsync(text);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const hasHotelData = !!(trip?.accommodation || trip?.address);

  if (!trip) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.push('/(tabs)/home')} hitSlop={12}>
            <ArrowLeft size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Guide</Text>
          <View style={{ width: 22 }} />
        </View>
        <EmptyState
          icon={Hotel}
          title="Your property guide"
          subtitle="Book a trip to see WiFi, check-in times, door codes, house rules, and everything about your stay."
          actionLabel="Plan a Trip"
          onAction={() => router.push('/onboarding')}
        />
      </SafeAreaView>
    );
  }

  if (!hasHotelData) {
    const fields = [
      { label: 'Accommodation', filled: !!trip.accommodation },
      { label: 'Address', filled: !!trip.address },
      { label: 'Check-in time', filled: !!trip.checkIn },
      { label: 'Check-out time', filled: !!trip.checkOut },
      { label: 'WiFi', filled: !!trip.wifiSsid },
      { label: 'Door code', filled: !!trip.doorCode },
    ];
    const filledCount = fields.filter((f) => f.filled).length;
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.push('/(tabs)/home')} hitSlop={12}>
            <ArrowLeft size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Guide</Text>
          <View style={{ width: 22 }} />
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
          <View style={{ alignItems: 'center', paddingVertical: 20, gap: 8 }}>
            <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: colors.accentBg, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.accentBorder }}>
              <Hotel size={26} color={colors.accent} />
            </View>
            <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text, marginTop: 8 }}>
              Complete your stay details
            </Text>
            <Text style={{ fontSize: 13, color: colors.text3, textAlign: 'center', lineHeight: 19 }}>
              {trip.destination ? `Add your ${trip.destination} accommodation details so your guide is ready when you arrive.` : 'Add your accommodation details so your guide is ready when you arrive.'}
            </Text>
          </View>

          <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 16, gap: 12 }}>
            <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1.4, textTransform: 'uppercase', color: colors.text3 }}>
              {filledCount}/{fields.length} DETAILS ADDED
            </Text>
            {fields.map((f) => (
              <View key={f.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: f.filled ? colors.accentBg : colors.card2, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: f.filled ? colors.accentBorder : colors.border }}>
                  {f.filled && <Text style={{ fontSize: 11, color: colors.accent }}>✓</Text>}
                </View>
                <Text style={{ fontSize: 13, fontWeight: '500', color: f.filled ? colors.text : colors.text3 }}>{f.label}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity
            style={{ backgroundColor: colors.accent, borderRadius: 14, paddingVertical: 14, alignItems: 'center' }}
            onPress={() => router.push({ pathname: '/scan-trip', params: { tripId: trip.id } } as never)}
            activeOpacity={0.7}
          >
            <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff' }}>Scan Hotel Booking</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={{ backgroundColor: colors.card, borderRadius: 14, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: colors.border }}
            onPress={() => router.push('/trip-overview')}
            activeOpacity={0.7}
          >
            <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>Add Manually</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <ArrowLeft size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Guide</Text>
          <Text style={styles.subtitle}>
            {hotelName || destLabel}{hotelName && destLabel ? ` · ${destLabel}` : ''}
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); loadTrip(true); }}
            tintColor={colors.accent}
          />
        }
      >
        {/* Hero image */}
        {hotelPhotoUrl ? (
          <View style={styles.heroWrapper}>
            <View style={styles.heroCard}>
              <View style={styles.heroImageBg}>
                <Image
                  source={{ uri: hotelPhotoUrl }}
                  style={StyleSheet.absoluteFillObject}
                  resizeMode="cover"
                />
                <View style={styles.heroGradient} />
                <View style={styles.heroTextBlock}>
                  <Text style={styles.heroName}>{hotelName}</Text>
                  {hotelAddr ? <Text style={styles.heroDesc}>{hotelAddr}</Text> : null}
                </View>
              </View>
            </View>
          </View>
        ) : hotelName ? (
          <View style={styles.section}>
            <View style={styles.infoCard}>
              <Hotel size={20} color={colors.accent} />
              <View style={{ flex: 1 }}>
                <Text style={styles.infoTitle}>{hotelName}</Text>
                {hotelAddr ? <Text style={styles.infoSub}>{hotelAddr}</Text> : null}
              </View>
            </View>
          </View>
        ) : null}

        {/* Check-in / Check-out */}
        {(checkInTime || checkOutTime) && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>CHECK-IN / CHECK-OUT</Text>
            <View style={styles.timesGrid}>
              <View style={styles.timeCard}>
                <Clock size={16} color={colors.accent} />
                <View>
                  <Text style={styles.timeLabel}>Check-in</Text>
                  <Text style={styles.timeValue}>{checkInTime || '—'}</Text>
                  <Text style={styles.timeDate}>{checkInDate}</Text>
                </View>
              </View>
              <View style={styles.timeCard}>
                <Clock size={16} color={colors.accent} />
                <View>
                  <Text style={styles.timeLabel}>Check-out</Text>
                  <Text style={styles.timeValue}>{checkOutTime || '—'}</Text>
                  <Text style={styles.timeDate}>{checkOutDate}</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Quick info — WiFi, Door code, Booking ref */}
        {(trip.wifiSsid || trip.doorCode || trip.bookingRef) && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>ESSENTIALS</Text>
            <View style={{ gap: 8 }}>
              {trip.wifiSsid && (
                <TouchableOpacity
                  style={styles.infoCard}
                  onPress={() => copyToClipboard(trip.wifiPassword ?? trip.wifiSsid!)}
                  activeOpacity={0.7}
                >
                  <Wifi size={18} color={colors.accent} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.infoTitle}>{trip.wifiSsid}</Text>
                    {trip.wifiPassword && (
                      <Text style={styles.infoSub}>Password: {trip.wifiPassword}</Text>
                    )}
                  </View>
                  <Copy size={14} color={colors.text3} />
                </TouchableOpacity>
              )}
              {trip.doorCode && (
                <TouchableOpacity
                  style={styles.infoCard}
                  onPress={() => copyToClipboard(trip.doorCode!)}
                  activeOpacity={0.7}
                >
                  <Key size={18} color={colors.accent} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.infoTitle}>Door Code</Text>
                    <Text style={styles.infoSub}>{trip.doorCode}</Text>
                  </View>
                  <Copy size={14} color={colors.text3} />
                </TouchableOpacity>
              )}
              {trip.bookingRef && (
                <TouchableOpacity
                  style={styles.infoCard}
                  onPress={() => copyToClipboard(trip.bookingRef!)}
                  activeOpacity={0.7}
                >
                  <Hotel size={18} color={colors.accent} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.infoTitle}>Booking Reference</Text>
                    <Text style={styles.infoSub}>{trip.bookingRef}</Text>
                  </View>
                  <Copy size={14} color={colors.text3} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Amenities */}
        {trip.amenities && trip.amenities.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>AMENITIES</Text>
            <View style={styles.amenityWrap}>
              {trip.amenities.map((a, i) => (
                <View key={i} style={styles.amenityChip}>
                  <Text style={styles.amenityText}>{a}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Contact */}
        {(trip.hotelPhone || trip.hotelUrl) && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>CONTACT</Text>
            <View style={{ gap: 8 }}>
              {trip.hotelPhone && (
                <TouchableOpacity
                  style={styles.infoCard}
                  onPress={() => Linking.openURL(`tel:${trip.hotelPhone!.replace(/[^+\d]/g, '')}`).catch(() => {})}
                  activeOpacity={0.7}
                >
                  <Phone size={18} color={colors.accent} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.infoTitle}>{trip.hotelPhone}</Text>
                    <Text style={styles.infoSub}>Reception</Text>
                  </View>
                  <ExternalLink size={14} color={colors.text3} />
                </TouchableOpacity>
              )}
              {trip.hotelUrl && (
                <TouchableOpacity
                  style={styles.infoCard}
                  onPress={() => Linking.openURL(trip.hotelUrl!).catch(() => {})}
                  activeOpacity={0.7}
                >
                  <ExternalLink size={18} color={colors.accent} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.infoTitle} numberOfLines={1}>Website</Text>
                    <Text style={styles.infoSub} numberOfLines={1}>{trip.hotelUrl}</Text>
                  </View>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Location — open in maps */}
        {(hotelAddr || hotelName || destLabel) && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>LOCATION</Text>
            <TouchableOpacity
              style={styles.infoCard}
              onPress={() => {
                const q = encodeURIComponent(hotelAddr || hotelName || destLabel);
                Linking.openURL(`https://maps.google.com/?q=${q}`).catch(() => {});
              }}
              activeOpacity={0.7}
            >
              <MapPin size={18} color={colors.accent} />
              <View style={{ flex: 1 }}>
                <Text style={styles.infoTitle}>{hotelAddr || hotelName || destLabel}</Text>
                <Text style={styles.infoSub}>Open in Maps</Text>
              </View>
              <ExternalLink size={14} color={colors.text3} />
            </TouchableOpacity>
          </View>
        )}

        {/* House rules / Notes */}
        {trip.houseRules && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>HOUSE RULES</Text>
            <View style={styles.notesCard}>
              <Text style={styles.notesText}>{trip.houseRules}</Text>
            </View>
          </View>
        )}

        {trip.notes && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>NOTES</Text>
            <View style={styles.notesCard}>
              <Text style={styles.notesText}>{trip.notes}</Text>
            </View>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────

const getStyles = (c: ThemeColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    scroll: { flex: 1 },
    scrollContent: { paddingBottom: 100 },

    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 8,
    },
    title: { fontSize: 22, fontWeight: '600', letterSpacing: -0.66, color: c.text },
    subtitle: {
      fontSize: 10, color: c.text3, letterSpacing: 1.5,
      textTransform: 'uppercase', fontWeight: '600', marginTop: 2,
    },

    section: { paddingHorizontal: 16, marginBottom: 20 },
    sectionLabel: {
      fontSize: 10, fontWeight: '700', letterSpacing: 1.6,
      color: c.text3, marginBottom: 10,
    },

    // Hero
    heroWrapper: { paddingHorizontal: 16, marginBottom: 20 },
    heroCard: {
      height: 200, borderRadius: 20, overflow: 'hidden',
      borderWidth: 1, borderColor: c.border, backgroundColor: c.card,
    },
    heroImageBg: { flex: 1, backgroundColor: c.card2 },
    heroGradient: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
    heroTextBlock: { position: 'absolute', left: 16, right: 16, bottom: 14 },
    heroName: {
      fontSize: 20, fontWeight: '500', letterSpacing: -0.6, color: '#fff',
      textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
    },
    heroDesc: {
      fontSize: 11, color: 'rgba(255,255,255,0.8)', marginTop: 3,
      textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3,
    },

    // Times
    timesGrid: { flexDirection: 'row', gap: 10 },
    timeCard: {
      flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10,
      backgroundColor: c.card, borderWidth: 1, borderColor: c.border,
      borderRadius: 16, padding: 14,
    },
    timeLabel: { fontSize: 10, fontWeight: '600', letterSpacing: 1, color: c.text3, textTransform: 'uppercase' },
    timeValue: { fontSize: 18, fontWeight: '600', color: c.text, marginTop: 2 },
    timeDate: { fontSize: 10, color: c.text3, marginTop: 1 },

    // Info cards
    infoCard: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      padding: 14, backgroundColor: c.card, borderWidth: 1,
      borderColor: c.border, borderRadius: 16,
    },
    infoTitle: { fontSize: 13, fontWeight: '600', color: c.text },
    infoSub: { fontSize: 11, color: c.text3, marginTop: 2 },

    // Amenities
    amenityWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    amenityChip: {
      paddingVertical: 8, paddingHorizontal: 14,
      backgroundColor: c.card, borderWidth: 1, borderColor: c.border,
      borderRadius: 12,
    },
    amenityText: { fontSize: 12, fontWeight: '600', color: c.text },

    // Notes
    notesCard: {
      padding: 16, backgroundColor: c.card, borderWidth: 1,
      borderColor: c.border, borderRadius: 16,
    },
    notesText: { fontSize: 13, color: c.text2, lineHeight: 20 },
  });
