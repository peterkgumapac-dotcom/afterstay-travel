import { useRouter } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { Camera, FileText, Plane, Hotel, X } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useLocalSearchParams } from 'expo-router';

import { useTheme } from '@/constants/ThemeContext';
import { radius, spacing } from '@/constants/theme';
import { scanTripDocuments, type ScannedTripDetails } from '@/lib/anthropic';
import { compressImage } from '@/lib/compressImage';
import {
  createTrip,
  finalizeDraftTrip,
  updateTripFromScan,
  replaceTripFlights,
  updateHotelCoordinates,
} from '@/lib/supabase';
import { clearTripLocalData } from '@/lib/cache';
import { invalidateHomeCache } from '@/hooks/useTabHomeData';
import { invalidateTripCache } from '@/lib/tabDataCache';
import { searchPlace } from '@/lib/google-places';

type Phase = 'upload' | 'scanning' | 'review' | 'saving' | 'error';

type ScannedFlight = NonNullable<ScannedTripDetails['flights']>[number];
const SCAN_TIMEOUT_MS = 90_000;
const TRIP_SAVE_TIMEOUT_MS = 45_000;
const FLIGHT_SAVE_TIMEOUT_MS = 60_000;
const TRIP_SCAN_STEPS = [
  'Preparing screenshots',
  'Compressing images',
  'Reading booking details',
  'Checking route and dates',
  'Preparing review',
];

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      const timer = setTimeout(() => reject(new Error(message)), ms);
      promise.then(
        () => clearTimeout(timer),
        () => clearTimeout(timer),
      );
    }),
  ]);
}

function scanErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? '');
  if (/request entity too large|payload too large|body size|413/i.test(message)) {
    return 'Those screenshots are too large to scan. Try one clearer screenshot, or crop closer to the flight/hotel details.';
  }
  if (/edge function returned a non-2xx|non-2xx status/i.test(message)) {
    return 'The trip scanner hit a server error before it could read the itinerary. Please try again with one clearer screenshot.';
  }
  if (/AI service not configured|missing auth|unauthorized/i.test(message)) {
    return 'The trip scanner is not available for this session. Please sign out and back in, then try again.';
  }
  if (/schema cache|arrive_time|arrival_time|departure_time|depart_time/i.test(message)) {
    return 'The flight table schema is still refreshing. Please try again in a minute.';
  }
  if (/timed out/i.test(message)) {
    return message;
  }
  return message || 'Something went wrong while saving your trip.';
}

function airportCode(value?: string) {
  if (!value) return '';
  const paren = value.match(/\(([A-Z]{3})\)/i)?.[1];
  if (paren) return paren.toUpperCase();
  const standalone = value.match(/\b[A-Z]{3}\b/i)?.[0];
  return standalone ? standalone.toUpperCase() : '';
}

function dayPart(value?: string) {
  return value?.slice(0, 10) ?? '';
}

function routeKey(flight: ScannedFlight) {
  return `${airportCode(flight.from) || flight.from?.toLowerCase()}-${airportCode(flight.to) || flight.to?.toLowerCase()}`;
}

function reverseRouteKey(flight: ScannedFlight) {
  return `${airportCode(flight.to) || flight.to?.toLowerCase()}-${airportCode(flight.from) || flight.from?.toLowerCase()}`;
}

function mentionsDestination(value: string | undefined, destination: string | undefined) {
  if (!value || !destination) return false;
  const haystack = value.toLowerCase();
  return destination
    .toLowerCase()
    .split(/[\s,()/-]+/)
    .filter((part) => part.length >= 4)
    .some((part) => haystack.includes(part));
}

function canonicalDirection(value?: string): 'Outbound' | 'Return' {
  const direction = (value ?? '').trim().toLowerCase();
  if (['return', 'inbound', 'arrival', 'arrive', 'back', 'homebound'].some((token) => direction.includes(token))) {
    return 'Return';
  }
  return 'Outbound';
}

function normalizeScannedFlights(result: ScannedTripDetails): ScannedTripDetails {
  const flights = result.flights;
  if (!flights?.length) return result;

  const sorted = [...flights].sort((a, b) => {
    const at = a.departTime ? new Date(a.departTime).getTime() : Number.POSITIVE_INFINITY;
    const bt = b.departTime ? new Date(b.departTime).getTime() : Number.POSITIVE_INFINITY;
    return at - bt;
  });

  const normalized = sorted.map((flight, index) => {
    let direction = canonicalDirection(flight.direction);
    const departDay = dayPart(flight.departTime);

    if (result.startDate && departDay === result.startDate) {
      direction = 'Outbound';
    } else if (result.endDate && departDay === result.endDate) {
      direction = 'Return';
    } else if (
      mentionsDestination(flight.from, result.destination) &&
      !mentionsDestination(flight.to, result.destination)
    ) {
      direction = 'Return';
    } else if (
      mentionsDestination(flight.to, result.destination) &&
      !mentionsDestination(flight.from, result.destination)
    ) {
      direction = 'Outbound';
    }

    const hasReverseEarlier = sorted.slice(0, index).some((other) => routeKey(other) === reverseRouteKey(flight));
    if (hasReverseEarlier) direction = 'Return';

    return { ...flight, direction };
  });

  const outboundCount = normalized.filter((f) => canonicalDirection(f.direction) === 'Outbound').length;
  const returnCount = normalized.filter((f) => canonicalDirection(f.direction) === 'Return').length;
  if (normalized.length >= 2 && returnCount === 0 && outboundCount === normalized.length) {
    normalized[0] = { ...normalized[0], direction: 'Outbound' };
    normalized[normalized.length - 1] = { ...normalized[normalized.length - 1], direction: 'Return' };
  }

  return { ...result, flights: normalized };
}

function looksLikeMultiDayTrip(result: ScannedTripDetails): boolean {
  if (!result.startDate || !result.endDate) return false;
  return result.startDate !== result.endDate;
}

function hasText(value?: string | null) {
  return typeof value === 'string' && value.trim().length > 0;
}

function missingCreateFields(result: ScannedTripDetails) {
  const missing: string[] = [];
  if (!hasText(result.destination)) missing.push('destination');
  if (!hasText(result.startDate)) missing.push('start date');
  if (!hasText(result.endDate)) missing.push('end date');
  return missing;
}

function getUsableScannedFlights(result: ScannedTripDetails) {
  return (result.flights ?? []).filter((flight) => hasText(flight.flightNumber));
}

function hasAnyReadableTripDetails(result: ScannedTripDetails) {
  return (
    hasText(result.destination) ||
    hasText(result.startDate) ||
    hasText(result.endDate) ||
    hasText(result.accommodation) ||
    hasText(result.address) ||
    getUsableScannedFlights(result).length > 0
  );
}

const TIPS = [
  { icon: Plane, text: 'Flight booking confirmation with dates, times, and flight numbers' },
  { icon: Hotel, text: 'Hotel reservation showing check-in/out dates and address' },
  { icon: FileText, text: 'Trip itinerary or travel plan with dates and destination' },
  { icon: Camera, text: 'Screenshots from booking apps (Agoda, Booking.com, Airbnb, etc.)' },
];

const GUIDELINES = [
  'Make sure text is clearly readable — no blurry screenshots',
  'Include the full booking page, not just a portion',
  'Dates, destination, and names should be visible',
  '1-3 screenshots is ideal — one per booking type',
];

export default function ScanTripScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const router = useRouter();
  const params = useLocalSearchParams<{ tripId?: string }>();
  const existingTripId = params.tripId ?? null;
  const isUpdateMode = !!existingTripId;

  const [phase, setPhase] = useState<Phase>('upload');
  const [images, setImages] = useState<{ uri: string; base64?: string }[]>([]);
  const [result, setResult] = useState<ScannedTripDetails | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [progress, setProgress] = useState(0.1);

  const resetForRescan = useCallback((clearImages = false) => {
    setResult(null);
    setErrorMsg('');
    setStatusMessage('');
    setProgress(0.1);
    if (clearImages) setImages([]);
    setPhase('upload');
  }, []);

  const pickImages = useCallback(async () => {
    if (Platform.OS === 'ios') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Photo Library Access', 'Please enable photo library access in Settings.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openURL('app-settings:') },
        ]);
        return;
      }
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsMultipleSelection: true,
      selectionLimit: 3,
    });
    if (res.canceled || res.assets.length === 0) {
      if (images.length === 0) router.back();
      return;
    }
    setImages((prev) => [...prev, ...res.assets.slice(0, 3 - prev.length).map((a) => ({ uri: a.uri }))].slice(0, 3));
  }, [images.length, router]);

  const removeImage = (uri: string) => {
    setImages((prev) => prev.filter((img) => img.uri !== uri));
  };

  const handleScan = useCallback(async () => {
    if (images.length === 0) return;
    setPhase('scanning');
    setStatusMessage('Preparing screenshots...');
    setProgress(0.16);

    try {
      const prepared = await Promise.all(
        images.map(async (img) => {
          setProgress((current) => Math.max(current, 0.28));
          const compressed = await compressImage(img.uri, 1000, 0.6);
          setProgress((current) => Math.max(current, 0.42));
          const base64 = await FileSystem.readAsStringAsync(compressed, {
            encoding: 'base64' as any,
          });
          return { base64, mimeType: 'image/jpeg' };
        }),
      );
      const estimatedBytes = prepared.reduce((sum, img) => sum + Math.ceil(img.base64.length * 0.75), 0);
      if (estimatedBytes > 4_500_000) {
        throw new Error('Payload too large for trip scan');
      }

      setStatusMessage('Reading booking details...');
      setProgress(0.58);
      const scanned = normalizeScannedFlights(
        await withTimeout(
          scanTripDocuments(prepared),
          SCAN_TIMEOUT_MS,
          'Scanning timed out. Please try one clearer screenshot or crop closer to the itinerary.',
        ),
      );
      setProgress(0.82);
      if (!hasAnyReadableTripDetails(scanned)) {
        throw new Error(
          'Could not read enough trip details. Try a clearer full-page screenshot with the route, dates, and flight numbers visible.',
        );
      }
      setResult(scanned);
      setPhase('review');
      setStatusMessage('');
      setProgress(1);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      setErrorMsg(scanErrorMessage(e) || 'Failed to scan documents.');
      setProgress(0.1);
      setPhase('error');
    }
  }, [images]);

  // Geocode hotel/destination to get lat/lng — non-blocking, best-effort
  const geocodeHotel = useCallback(
    async (tripId: string, accommodation?: string, address?: string, destination?: string) => {
      const query = accommodation
        ? `${accommodation} ${address ?? destination ?? ''}`.trim()
        : (address ?? destination);
      if (!query) return;
      try {
        const place = await searchPlace(query);
        if (place?.lat && place?.lng) {
          await updateHotelCoordinates(tripId, place.lat, place.lng);
        }
      } catch {
        // Non-critical — coordinates are a nice-to-have
      }
    },
    [],
  );

  const finishTripUpdate = useCallback(
    async (tripId: string) => {
      invalidateTripCache(tripId);
      invalidateHomeCache();
      await clearTripLocalData();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    },
    [router],
  );

  const saveScannedTrip = useCallback(async () => {
    if (!result) return;
    if (!isUpdateMode) {
      const missing = missingCreateFields(result);
      if (missing.length > 0) {
        Alert.alert(
          'Missing trip details',
          `Before creating this trip, rescan with the ${missing.join(', ')} visible. You can also plan manually and scan bookings later.`,
        );
        return;
      }
    }
    const flightsToSave = getUsableScannedFlights(result);
    setPhase('saving');
    setStatusMessage(isUpdateMode ? 'Saving updated trip details...' : 'Creating your trip...');
    setProgress(0.18);
    try {
      if (isUpdateMode && existingTripId) {
        await withTimeout(
          updateTripFromScan(existingTripId, result),
          TRIP_SAVE_TIMEOUT_MS,
          'Updating trip details timed out. Please check your connection and try again.',
        );
        setProgress(0.46);

        // Replace scanned flights so re-scanning an itinerary updates outbound/return
        // details instead of stacking duplicates from old screenshots.
        if (flightsToSave.length > 0) {
          setStatusMessage('Replacing flight itinerary...');
          setProgress(0.62);
          await withTimeout(
            replaceTripFlights(
              existingTripId,
              flightsToSave.map((f) => ({
                direction: f.direction,
                flightNumber: f.flightNumber,
                airline: f.airline,
                fromCity: f.from,
                toCity: f.to,
                departTime: f.departTime,
                arriveTime: f.arriveTime,
                bookingRef: f.bookingRef,
                passenger: f.passenger,
              })),
            ),
            FLIGHT_SAVE_TIMEOUT_MS,
            'Replacing flights timed out. Please try again in a moment.',
          );
        }
        await finalizeDraftTrip(existingTripId).catch(() => {});

        geocodeHotel(existingTripId, result.accommodation, result.address, result.destination).catch(() => {});
        setStatusMessage('Refreshing trip...');
        setProgress(0.9);
        await finishTripUpdate(existingTripId);
      } else {
        const destination = result.destination?.trim();
        const startDate = result.startDate?.trim();
        const endDate = result.endDate?.trim();
        if (!destination || !startDate || !endDate) {
          throw new Error('Missing destination or dates from scan');
        }

        // Create new trip
        const newTripId = await withTimeout(
          createTrip({
            name: `Trip to ${destination}`,
            destination,
            startDate,
            endDate,
            members: result.members,
            accommodation: result.accommodation,
            address: result.address,
            checkIn: result.checkIn,
            checkOut: result.checkOut,
            roomType: result.roomType,
            bookingRef: result.bookingRef,
            cost: result.cost,
            costCurrency: result.costCurrency,
          }),
          TRIP_SAVE_TIMEOUT_MS,
          'Creating trip timed out. Please check your connection and try again.',
        );
        setProgress(0.5);

        // Save scanned flights in one batch so round-trip itineraries do not
        // get partially saved if outbound succeeds before return.
        if (flightsToSave.length > 0) {
          setStatusMessage('Saving flight itinerary...');
          setProgress(0.68);
          await withTimeout(
            replaceTripFlights(
              newTripId,
              flightsToSave.map((f) => ({
                direction: f.direction,
                flightNumber: f.flightNumber,
                airline: f.airline,
                fromCity: f.from,
                toCity: f.to,
                departTime: f.departTime,
                arriveTime: f.arriveTime,
                bookingRef: f.bookingRef,
                passenger: f.passenger,
              })),
            ),
            FLIGHT_SAVE_TIMEOUT_MS,
            'Saving flights timed out. Please try again in a moment.',
          );
        }

        // Geocode hotel address to set coordinates
        geocodeHotel(newTripId, result.accommodation, result.address, result.destination).catch(() => {});
        setStatusMessage('Refreshing trip...');
        setProgress(0.9);
        await finishTripUpdate(newTripId);
      }
    } catch (e: any) {
      setPhase('review');
      setStatusMessage('');
      setProgress(0.1);
      Alert.alert(isUpdateMode ? 'Failed to update trip' : 'Failed to create trip', scanErrorMessage(e));
    }
  }, [result, isUpdateMode, existingTripId, geocodeHotel, finishTripUpdate]);

  const handleConfirm = useCallback(() => {
    if (!result) return;
    const missing = !isUpdateMode ? missingCreateFields(result) : [];
    if (missing.length > 0) {
      Alert.alert(
        'Missing trip details',
        `The scan is missing ${missing.join(', ')}. Rescan with the full booking visible before creating this trip.`,
        [
          { text: 'Rescan', onPress: () => resetForRescan(false) },
          { text: 'Cancel', style: 'cancel' },
        ],
      );
      return;
    }
    const flightsToSave = getUsableScannedFlights(result);

    if (!flightsToSave.length) {
      Alert.alert(
        'No flights found',
        'This scan did not detect any flight segments. If your itinerary has outbound or return flights, add a clearer screenshot before saving.',
        [
          { text: 'Rescan', onPress: () => resetForRescan(false) },
          {
            text: 'Save without flights',
            style: 'destructive',
            onPress: () => {
              void saveScannedTrip();
            },
          },
        ],
      );
      return;
    }

    if (flightsToSave.length === 1 && looksLikeMultiDayTrip(result)) {
      Alert.alert(
        'Only one flight found',
        'This looks like a multi-day trip, but the scan found only one flight. If your screenshot includes a return flight, add or replace the screenshot before saving.',
        [
          { text: 'Add screenshots', onPress: () => resetForRescan(false) },
          {
            text: 'Save one-way',
            style: 'destructive',
            onPress: () => {
              void saveScannedTrip();
            },
          },
        ],
      );
      return;
    }

    void saveScannedTrip();
  }, [result, isUpdateMode, resetForRescan, saveScannedTrip]);

  // ── Scanning phase ──
  if (phase === 'scanning') {
    return (
      <SafeAreaView style={styles.safe}>
        <TripScanLoading
          message="Scanning your trip..."
          detail={
            statusMessage ||
            TRIP_SCAN_STEPS[Math.min(TRIP_SCAN_STEPS.length - 1, Math.floor(progress * TRIP_SCAN_STEPS.length))]
          }
          progress={progress}
          colors={colors}
        />
      </SafeAreaView>
    );
  }

  if (phase === 'saving') {
    return (
      <SafeAreaView style={styles.safe}>
        <TripScanLoading
          message={isUpdateMode ? 'Updating your trip...' : 'Creating your trip...'}
          detail={statusMessage || 'Saving trip details'}
          progress={progress}
          colors={colors}
        />
      </SafeAreaView>
    );
  }

  // ── Error phase ──
  if (phase === 'error') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <Text style={styles.errorText}>{errorMsg}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => setPhase('upload')}>
            <Text style={styles.retryText}>Try again</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Review phase ──
  if (phase === 'review' && result) {
    const flightsFound = result.flights ?? [];
    const hasFlights = flightsFound.length > 0;
    const createMissing = !isUpdateMode ? missingCreateFields(result) : [];

    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>{isUpdateMode ? 'Details found' : 'Trip detected'}</Text>
          <Text style={styles.subtitle}>
            {isUpdateMode ? 'Review and update your trip' : 'Review and confirm the details'}
          </Text>

          <View style={styles.reviewCard}>
            <ReviewRow label="Destination" value={result.destination || 'Not found'} colors={colors} />
            <ReviewRow
              label="Dates"
              value={result.startDate && result.endDate ? `${result.startDate} → ${result.endDate}` : 'Not found'}
              colors={colors}
            />
            {result.accommodation && <ReviewRow label="Hotel" value={result.accommodation} colors={colors} />}
            {result.address && <ReviewRow label="Address" value={result.address} colors={colors} />}
            {result.checkIn && <ReviewRow label="Check-in" value={result.checkIn} colors={colors} />}
            {result.checkOut && <ReviewRow label="Check-out" value={result.checkOut} colors={colors} />}
            {result.roomType && <ReviewRow label="Room" value={result.roomType} colors={colors} />}
            {result.bookingRef && <ReviewRow label="Booking ref" value={result.bookingRef} colors={colors} />}
            {result.cost != null && (
              <ReviewRow
                label="Cost"
                value={`${result.costCurrency ?? 'PHP'} ${result.cost.toLocaleString()}`}
                colors={colors}
              />
            )}
            {result.members && result.members.length > 0 && (
              <ReviewRow label="Travelers" value={result.members.join(', ')} colors={colors} />
            )}
          </View>

          {createMissing.length > 0 ? (
            <View style={styles.missingFlightCard}>
              <View style={styles.missingFlightIcon}>
                <FileText size={18} color={colors.accent} strokeWidth={1.9} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.missingFlightTitle}>Trip details are incomplete</Text>
                <Text style={styles.missingFlightText}>
                  Rescan with the {createMissing.join(', ')} visible before creating this trip.
                </Text>
              </View>
            </View>
          ) : null}

          {hasFlights ? (
            <>
              <Text style={[styles.sectionLabel, { color: colors.text3 }]}>
                {flightsFound.length > 1 ? `FLIGHTS (${flightsFound.length})` : 'ONE FLIGHT FOUND'}
              </Text>
              {flightsFound.length === 1 && looksLikeMultiDayTrip(result) ? (
                <View style={styles.missingFlightCard}>
                  <View style={styles.missingFlightIcon}>
                    <Plane size={18} color={colors.accent} strokeWidth={1.9} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.missingFlightTitle}>Return flight may be missing</Text>
                    <Text style={styles.missingFlightText}>
                      For screenshots like MNL - MPH plus MPH - MNL, both sections should appear here before saving.
                    </Text>
                  </View>
                </View>
              ) : null}
              {flightsFound.map((f, i) => (
                <View key={`${f.flightNumber}-${i}`} style={styles.reviewCard}>
                  <ReviewRow label="Flight" value={`${f.airline ?? ''} ${f.flightNumber}`.trim()} colors={colors} />
                  <ReviewRow label="Route" value={`${f.from} → ${f.to}`} colors={colors} />
                  <ReviewRow label="Direction" value={f.direction} colors={colors} />
                  <ReviewRow label="Depart" value={f.departTime} colors={colors} />
                  <ReviewRow label="Arrive" value={f.arriveTime} colors={colors} />
                  {f.bookingRef && <ReviewRow label="Booking ref" value={f.bookingRef} colors={colors} />}
                </View>
              ))}
            </>
          ) : (
            <View style={styles.missingFlightCard}>
              <View style={styles.missingFlightIcon}>
                <Plane size={18} color={colors.accent} strokeWidth={1.9} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.missingFlightTitle}>No flights found</Text>
                <Text style={styles.missingFlightText}>
                  If this booking has outbound and return flights, add or replace screenshots before saving.
                </Text>
              </View>
            </View>
          )}

          <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm} activeOpacity={0.85}>
            <Text style={styles.confirmText}>{isUpdateMode ? 'Update trip' : 'Create trip'}</Text>
          </TouchableOpacity>

          <View style={styles.reviewActionRow}>
            <TouchableOpacity onPress={() => resetForRescan(false)} style={styles.secondaryBtn}>
              <Text style={styles.secondaryBtnText}>Add screenshots</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => resetForRescan(true)} style={styles.secondaryBtn}>
              <Text style={styles.secondaryBtnText}>Replace all</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Upload phase ──
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Scan your trip</Text>
        <Text style={styles.subtitle}>Upload 1-3 screenshots and we'll auto-fill your trip details</Text>

        {/* Guidelines */}
        <View style={styles.guideCard}>
          <Text style={[styles.guideTitle, { color: colors.text }]}>What to upload</Text>
          {TIPS.map((tip, i) => (
            <View key={i} style={styles.guideRow}>
              <tip.icon size={16} color={colors.accent} strokeWidth={1.8} />
              <Text style={styles.guideText}>{tip.text}</Text>
            </View>
          ))}
        </View>

        <View style={styles.tipsCard}>
          <Text style={[styles.guideTitle, { color: colors.text }]}>For best results</Text>
          {GUIDELINES.map((g, i) => (
            <View key={i} style={styles.guideRow}>
              <Text style={styles.bulletNum}>{i + 1}</Text>
              <Text style={styles.guideText}>{g}</Text>
            </View>
          ))}
        </View>

        {/* Image previews */}
        {images.length > 0 && (
          <View style={styles.imageRow}>
            {images.map((img) => (
              <View key={img.uri} style={styles.imageThumb}>
                <Image source={{ uri: img.uri }} style={styles.thumbImage} />
                <Pressable style={styles.removeBtn} onPress={() => removeImage(img.uri)}>
                  <X size={12} color="#fff" strokeWidth={2.5} />
                </Pressable>
              </View>
            ))}
            {images.length < 3 && (
              <Pressable style={styles.addImageBtn} onPress={pickImages}>
                <Camera size={18} color={colors.text3} strokeWidth={1.8} />
                <Text style={styles.addImageText}>Add</Text>
              </Pressable>
            )}
          </View>
        )}

        {/* Actions */}
        {images.length === 0 ? (
          <TouchableOpacity style={styles.uploadBtn} onPress={pickImages} activeOpacity={0.85}>
            <Camera size={18} color={colors.ink} strokeWidth={2} />
            <Text style={styles.uploadBtnText}>Choose screenshots</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.scanBtn} onPress={handleScan} activeOpacity={0.85}>
            <Text style={styles.scanBtnText}>
              Scan {images.length} screenshot{images.length !== 1 ? 's' : ''}
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Cancel</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function TripScanLoading({
  message,
  detail,
  progress,
  colors,
}: {
  message: string;
  detail: string;
  progress: number;
  colors: ReturnType<typeof import('@/constants/ThemeContext').useTheme>['colors'];
}) {
  const safeProgress = Math.max(0.06, Math.min(progress, 1));

  return (
    <View style={[loadingStyles.container, { backgroundColor: colors.bg }]}>
      <View style={[loadingStyles.iconWrap, { backgroundColor: colors.accentBg, borderColor: colors.accentBorder }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
      <Text style={[loadingStyles.message, { color: colors.text }]}>{message}</Text>
      <Text style={[loadingStyles.detail, { color: colors.text3 }]}>{detail}</Text>
      <View style={[loadingStyles.progressTrack, { backgroundColor: colors.border }]}>
        <View
          style={[
            loadingStyles.progressFill,
            { backgroundColor: colors.accent, width: `${Math.round(safeProgress * 100)}%` },
          ]}
        />
      </View>
      <Text style={[loadingStyles.progressLabel, { color: colors.text3 }]}>
        {Math.round(safeProgress * 100)}%
      </Text>
    </View>
  );
}

function ReviewRow({
  label,
  value,
  colors,
}: {
  label: string;
  value: string;
  colors: ReturnType<typeof import('@/constants/ThemeContext').useTheme>['colors'];
}) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
      <Text style={{ fontSize: 12, color: colors.text3, fontWeight: '600' }}>{label}</Text>
      <Text style={{ fontSize: 12, color: colors.text, fontWeight: '500', maxWidth: '60%', textAlign: 'right' }}>
        {value}
      </Text>
    </View>
  );
}

const loadingStyles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: 28,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  message: {
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  detail: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    textAlign: 'center',
    minHeight: 36,
  },
  progressTrack: {
    width: '78%',
    maxWidth: 320,
    height: 7,
    borderRadius: 999,
    overflow: 'hidden',
    marginTop: spacing.md,
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
  progressLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
});

const getStyles = (colors: ReturnType<typeof import('@/constants/ThemeContext').useTheme>['colors']) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg, padding: spacing.xl },
    content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: 60 },
    title: { fontSize: 22, fontWeight: '700', color: colors.text, letterSpacing: -0.3 },
    subtitle: { fontSize: 13, color: colors.text3, marginTop: -spacing.sm, lineHeight: 18 },

    // Guidelines
    guideCard: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.lg,
      padding: spacing.lg,
      gap: spacing.md,
    },
    tipsCard: {
      backgroundColor: colors.accentBg,
      borderWidth: 1,
      borderColor: colors.accentBorder,
      borderRadius: radius.lg,
      padding: spacing.lg,
      gap: spacing.md,
    },
    guideTitle: { fontSize: 14, fontWeight: '600' },
    guideRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    guideText: { flex: 1, fontSize: 12, color: colors.text2, lineHeight: 17 },
    bulletNum: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.accent,
      width: 16,
      textAlign: 'center',
    },

    // Images
    imageRow: { flexDirection: 'row', gap: spacing.sm },
    imageThumb: {
      width: 90,
      height: 90,
      borderRadius: radius.sm,
      overflow: 'hidden',
    },
    thumbImage: { width: '100%', height: '100%' },
    removeBtn: {
      position: 'absolute',
      top: 4,
      right: 4,
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: 'rgba(0,0,0,0.6)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    addImageBtn: {
      width: 90,
      height: 90,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: colors.border,
      borderStyle: 'dashed',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
    },
    addImageText: { fontSize: 10, color: colors.text3, fontWeight: '600' },

    // Buttons
    uploadBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      backgroundColor: colors.accent,
      paddingVertical: 14,
      borderRadius: radius.md,
    },
    uploadBtnText: { fontSize: 15, fontWeight: '700', color: colors.ink },
    scanBtn: {
      backgroundColor: colors.accent,
      paddingVertical: 14,
      borderRadius: radius.md,
      alignItems: 'center',
    },
    scanBtnText: { fontSize: 15, fontWeight: '700', color: colors.ink },
    confirmBtn: {
      backgroundColor: colors.accent,
      paddingVertical: 14,
      borderRadius: radius.md,
      alignItems: 'center',
    },
    confirmText: { fontSize: 15, fontWeight: '700', color: colors.ink },
    secondaryBtn: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      paddingVertical: 12,
      borderRadius: radius.md,
      alignItems: 'center',
    },
    secondaryBtnText: { fontSize: 13, fontWeight: '700', color: colors.text },
    backBtn: { alignItems: 'center', paddingVertical: spacing.md },
    backBtnText: { fontSize: 14, color: colors.text2 },
    retryBtn: {
      backgroundColor: colors.accent,
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.md,
      borderRadius: radius.md,
    },
    retryText: { color: colors.ink, fontWeight: '700', fontSize: 14 },
    cancelText: { color: colors.text2, fontSize: 14, marginTop: spacing.sm },
    errorText: { color: colors.danger, fontSize: 14, textAlign: 'center' },

    // Review
    reviewCard: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.lg,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
    },
    sectionLabel: {
      fontSize: 10.5,
      fontWeight: '700',
      letterSpacing: 1.2,
      textTransform: 'uppercase',
    },
    missingFlightCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.md,
      backgroundColor: colors.accentBg,
      borderWidth: 1,
      borderColor: colors.accentBorder,
      borderRadius: radius.lg,
      padding: spacing.lg,
    },
    missingFlightIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.card,
    },
    missingFlightTitle: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '700',
      marginBottom: 3,
    },
    missingFlightText: {
      color: colors.text2,
      fontSize: 12,
      lineHeight: 17,
    },
    reviewActionRow: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
  });
