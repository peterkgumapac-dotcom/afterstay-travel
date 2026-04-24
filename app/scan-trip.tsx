import { useRouter } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { Camera, FileText, Plane, Hotel, X } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import AfterStayLoader from '@/components/AfterStayLoader';
import { useTheme } from '@/constants/ThemeContext';
import { radius, spacing } from '@/constants/theme';
import { scanTripDocuments, type ScannedTripDetails } from '@/lib/anthropic';
import { compressImage } from '@/lib/compressImage';
import { createTrip } from '@/lib/supabase';

type Phase = 'upload' | 'scanning' | 'review' | 'error';

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

  const [phase, setPhase] = useState<Phase>('upload');
  const [images, setImages] = useState<{ uri: string; base64?: string }[]>([]);
  const [result, setResult] = useState<ScannedTripDetails | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const pickImages = useCallback(async () => {
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
    setImages((prev) => [
      ...prev,
      ...res.assets.slice(0, 3 - prev.length).map((a) => ({ uri: a.uri })),
    ].slice(0, 3));
  }, [images.length, router]);

  const removeImage = (uri: string) => {
    setImages((prev) => prev.filter((img) => img.uri !== uri));
  };

  const handleScan = useCallback(async () => {
    if (images.length === 0) return;
    setPhase('scanning');

    try {
      const prepared = await Promise.all(
        images.map(async (img) => {
          const compressed = await compressImage(img.uri, 1200, 0.7);
          const base64 = await FileSystem.readAsStringAsync(compressed, {
            encoding: 'base64' as any,
          });
          return { base64, mimeType: 'image/jpeg' };
        }),
      );

      const scanned = await scanTripDocuments(prepared);
      setResult(scanned);
      setPhase('review');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      setErrorMsg(e?.message ?? 'Failed to scan documents.');
      setPhase('error');
    }
  }, [images]);

  const handleConfirm = useCallback(async () => {
    if (!result) return;
    try {
      await createTrip({
        name: `Trip to ${result.destination}`,
        destination: result.destination,
        startDate: result.startDate,
        endDate: result.endDate,
        members: result.members,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (e: any) {
      Alert.alert('Failed to create trip', e?.message ?? 'Unknown error');
    }
  }, [result, router]);

  // ── Scanning phase ──
  if (phase === 'scanning') {
    return (
      <SafeAreaView style={styles.safe}>
        <AfterStayLoader message="Scanning your trip documents..." />
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
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>Trip detected</Text>
          <Text style={styles.subtitle}>Review and confirm the details</Text>

          <View style={styles.reviewCard}>
            <ReviewRow label="Destination" value={result.destination} colors={colors} />
            <ReviewRow label="Dates" value={`${result.startDate} → ${result.endDate}`} colors={colors} />
            {result.accommodation && <ReviewRow label="Hotel" value={result.accommodation} colors={colors} />}
            {result.address && <ReviewRow label="Address" value={result.address} colors={colors} />}
            {result.checkIn && <ReviewRow label="Check-in" value={result.checkIn} colors={colors} />}
            {result.checkOut && <ReviewRow label="Check-out" value={result.checkOut} colors={colors} />}
            {result.roomType && <ReviewRow label="Room" value={result.roomType} colors={colors} />}
            {result.bookingRef && <ReviewRow label="Booking ref" value={result.bookingRef} colors={colors} />}
            {result.cost != null && (
              <ReviewRow label="Cost" value={`${result.costCurrency ?? 'PHP'} ${result.cost.toLocaleString()}`} colors={colors} />
            )}
            {result.members && result.members.length > 0 && (
              <ReviewRow label="Travelers" value={result.members.join(', ')} colors={colors} />
            )}
          </View>

          {result.flights && result.flights.length > 0 && (
            <>
              <Text style={[styles.sectionLabel, { color: colors.text3 }]}>FLIGHTS</Text>
              {result.flights.map((f, i) => (
                <View key={`${f.flightNumber}-${i}`} style={styles.reviewCard}>
                  <ReviewRow label="Flight" value={`${f.airline ?? ''} ${f.flightNumber}`.trim()} colors={colors} />
                  <ReviewRow label="Route" value={`${f.from} → ${f.to}`} colors={colors} />
                  <ReviewRow label="Direction" value={f.direction} colors={colors} />
                  {f.bookingRef && <ReviewRow label="Booking ref" value={f.bookingRef} colors={colors} />}
                </View>
              ))}
            </>
          )}

          <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm} activeOpacity={0.85}>
            <Text style={styles.confirmText}>Create trip</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setPhase('upload')} style={styles.backBtn}>
            <Text style={styles.backBtnText}>Rescan</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Upload phase ──
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Scan your trip</Text>
        <Text style={styles.subtitle}>
          Upload 1-3 screenshots and we'll auto-fill your trip details
        </Text>

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

function ReviewRow({ label, value, colors }: {
  label: string;
  value: string;
  colors: ReturnType<typeof import('@/constants/ThemeContext').useTheme>['colors'];
}) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
      <Text style={{ fontSize: 12, color: colors.text3, fontWeight: '600' }}>{label}</Text>
      <Text style={{ fontSize: 12, color: colors.text, fontWeight: '500', maxWidth: '60%', textAlign: 'right' }}>{value}</Text>
    </View>
  );
}

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
  });
