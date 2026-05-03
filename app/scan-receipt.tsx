import { useLocalSearchParams, useRouter } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActionSheetIOS, Alert, Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { X } from 'lucide-react-native';
import AfterStayLoader from '@/components/AfterStayLoader';
import { ReceiptItemReview } from '@/components/budget/ReceiptItemReview';
import { useTheme, ThemeColors } from '@/constants/ThemeContext';
import { radius, spacing } from '@/constants/theme';
import { scanReceipt, type ScannedReceipt } from '@/lib/anthropic';
import { compressImage } from '@/lib/compressImage';
import { getActiveTrip, getGroupMembers } from '@/lib/supabase';
import { getQuickTripCompanions } from '@/lib/quickTrips';
import type { GroupMember } from '@/lib/types';

type Phase = 'picking' | 'scanning' | 'review' | 'error';
const RECEIPT_SCAN_STEPS = [
  'Preparing the photo',
  'Compressing for faster OCR',
  'Reading receipt text',
  'Finding total, items, and place',
  'Building expense details',
];

function normalizeExpenseTarget(expenseType?: string): 'trip' | 'quick-trip' | 'standalone' | 'daily-tracker' | undefined {
  if (expenseType === 'daily-tracker') return 'daily-tracker';
  if (expenseType === 'personal' || expenseType === 'standalone') return 'standalone';
  if (expenseType === 'quick-trip') return 'quick-trip';
  if (expenseType === 'trip') return 'trip';
  return undefined;
}

export default function ScanReceiptScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const router = useRouter();
  const { expenseType, quickTripId, receiptPeople } = useLocalSearchParams<{
    expenseType?: string;
    quickTripId?: string;
    receiptPeople?: string;
  }>();
  const receiptTarget = normalizeExpenseTarget(expenseType);
  const [phase, setPhase] = useState<Phase>('picking');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [scannedData, setScannedData] = useState<ScannedReceipt | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [scanStep, setScanStep] = useState(0);
  const didLaunch = useRef(false);

  // Load group members for item assignment
  useEffect(() => {
    (async () => {
      if (receiptTarget === 'quick-trip' && quickTripId) {
        const companions = await getQuickTripCompanions(quickTripId).catch(() => []);
        setMembers(companions.map((c) => ({
          id: c.id,
          name: c.displayName,
          role: 'Member',
          userId: c.userId ?? '',
        } satisfies GroupMember)));
        return;
      }
      if (receiptTarget === 'quick-trip' && !quickTripId) {
        setMembers([]);
        return;
      }
      if (receiptTarget === 'daily-tracker') {
        setMembers([]);
        return;
      }
      if (receiptTarget === 'standalone' && receiptPeople) {
        try {
          const names = JSON.parse(receiptPeople) as string[];
          setMembers(names.filter(Boolean).map((name, index) => ({
            id: `adhoc-${index}`,
            name,
            role: 'Member',
            userId: '',
          } satisfies GroupMember)));
        } catch {}
        return;
      }
      const trip = await getActiveTrip().catch(() => null);
      if (trip) {
        const mems = await getGroupMembers(trip.id).catch(() => []);
        setMembers(mems);
      }
    })();
  }, [quickTripId, receiptPeople, receiptTarget]);

  const pickImage = async (source: 'camera' | 'gallery') => {
    if (receiptTarget === 'quick-trip' && !quickTripId) {
      setErrorMsg('Choose or create a Quick Trip before scanning this receipt.');
      setPhase('error');
      return;
    }
    // Request permissions before launching
    if (source === 'camera') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Camera Access', 'Allow camera access to scan receipts');
        router.back();
        return;
      }
    } else {
      const { status: libStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (libStatus !== 'granted') {
        Alert.alert('Gallery Access', 'Allow photo library access to select receipts');
        router.back();
        return;
      }
    }

    const opts: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['images'],
      quality: 0.8,
      base64: false,
    };

    const result =
      source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);

    if (result.canceled || !result.assets?.[0]) {
      router.back();
      return;
    }

    const asset = result.assets[0];
    setImageUri(asset.uri);
    setPhase('scanning');
    setScanStep(0);

    try {
      // Compress to ~800px width for faster OCR (receipt doesn't need 4K)
      setScanStep(1);
      const compressed = await compressImage(asset.uri, 800, 0.7);
      setScanStep(2);
      const base64 = await FileSystem.readAsStringAsync(compressed, {
        encoding: 'base64' as any,
      });

      const mimeType = 'image/jpeg'; // compressImage always outputs JPEG

      setScanStep(3);
      const scanned = await scanReceipt(base64, mimeType);
      setScanStep(4);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      if (receiptTarget !== 'daily-tracker' && scanned.items.length > 0 && members.length >= 2) {
        // Show item review for assignment
        setScannedData(scanned);
        setPhase('review');
      } else {
        // No items or solo traveler — go straight to add-expense
        const itemLines = scanned.items
          .map((item) => {
            const qtyStr = item.qty > 1 ? `${item.qty}× ` : '';
            return `${qtyStr}${item.name} — ₱${item.amount.toFixed(2)}`;
          })
          .join('\n');

        router.replace({
          pathname: '/add-expense',
          params: {
            description: scanned.description,
            amount: String(scanned.amount),
            currency: scanned.currency,
            category: scanned.category,
            placeName: scanned.placeName,
            date: scanned.date,
            notes: itemLines,
            photoUri: asset.uri,
            ...(receiptTarget ? { target: receiptTarget } : {}),
            ...(receiptTarget === 'quick-trip' && quickTripId ? { quickTripId } : {}),
            ...(receiptTarget === 'standalone' && receiptPeople ? { receiptPeople } : {}),
          },
        });
      }
    } catch (e: any) {
      setErrorMsg(e?.message ?? 'Failed to scan receipt.');
      setPhase('error');
    }
  };

  const showPicker = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Take Photo', 'Choose from Gallery', 'Cancel'],
          cancelButtonIndex: 2,
        },
        (index) => {
          if (index === 0) pickImage('camera');
          else if (index === 1) pickImage('gallery');
          else router.back();
        },
      );
    } else {
      Alert.alert('Scan Receipt', 'Choose image source', [
        { text: 'Take Photo', onPress: () => pickImage('camera') },
        { text: 'Choose from Gallery', onPress: () => pickImage('gallery') },
        { text: 'Cancel', style: 'cancel', onPress: () => router.back() },
      ]);
    }
  };

  useEffect(() => {
    if (!didLaunch.current) {
      didLaunch.current = true;
      showPicker();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (phase === 'review' && scannedData) {
    return (
      <ReceiptItemReview
        items={scannedData.items}
        members={members}
        placeName={scannedData.placeName}
        category={scannedData.category}
        currency={scannedData.currency}
        onConfirm={(result) => {
          const itemLines = result.items
            .map((item) => {
              const qtyStr = item.qty > 1 ? `${item.qty}\u00D7 ` : '';
              const assignStr =
                item.assignedTo === 'shared' ? `(shared \u00F7${result.sharedCount})` : `(${item.assignedTo})`;
              return `${qtyStr}${item.name} \u2014 \u20B1${(item.amount * item.qty).toFixed(0)} ${assignStr}`;
            })
            .join('\n');

          // Build per-member split amounts from assignments
          const splitAmounts: Record<string, number> = {};
          const sharedTotal = result.items
            .filter((i) => i.assignedTo === 'shared')
            .reduce((s, i) => s + i.amount * i.qty, 0);
          const perHead = sharedTotal / result.sharedCount;
          for (const m of members) {
            splitAmounts[m.name] = perHead;
          }
          for (const item of result.items) {
            if (item.assignedTo !== 'shared') {
              splitAmounts[item.assignedTo] = (splitAmounts[item.assignedTo] ?? 0) + item.amount * item.qty;
            }
          }

          router.replace({
            pathname: '/add-expense',
            params: {
              description: scannedData.description,
              amount: String(scannedData.amount),
              currency: scannedData.currency,
              category: scannedData.category,
              placeName: scannedData.placeName,
              date: scannedData.date,
              notes: itemLines,
              photoUri: imageUri ?? '',
              splitType: 'Custom',
              receiptSplits: JSON.stringify(splitAmounts),
              ...(receiptTarget ? { target: receiptTarget } : {}),
              ...(receiptTarget === 'quick-trip' && quickTripId ? { quickTripId } : {}),
              ...(receiptTarget === 'standalone' && receiptPeople ? { receiptPeople } : {}),
            },
          });
        }}
        onCancel={() => router.back()}
      />
    );
  }

  if (phase === 'scanning') {
    return (
      <View style={styles.container}>
        {imageUri ? <Image source={{ uri: imageUri }} style={styles.preview} resizeMode="contain" /> : null}
        <View style={styles.overlay}>
          <AfterStayLoader
            message="Scanning receipt..."
            detail={RECEIPT_SCAN_STEPS[scanStep]}
            progress={(scanStep + 1) / RECEIPT_SCAN_STEPS.length}
          />
        </View>
      </View>
    );
  }

  if (phase === 'error') {
    return (
      <View style={styles.container}>
        {imageUri ? <Image source={{ uri: imageUri }} style={styles.preview} resizeMode="contain" /> : null}
        <View style={styles.overlay}>
          <Text style={styles.errorText}>{errorMsg}</Text>
          <View style={styles.errorActions}>
            <Pressable
              style={styles.retryBtn}
              onPress={() => {
                setPhase('picking');
                showPicker();
              }}
            >
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
            <Pressable style={styles.cancelBtn} onPress={() => router.back()}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  // 'picking' phase — blank while action sheet is visible
  return (
    <View style={styles.container}>
      <Pressable style={styles.closeBtn} onPress={() => router.back()}>
        <X size={22} color={colors.text2} strokeWidth={2} />
      </Pressable>
      <Text style={styles.pickingHint}>Choose an image to scan</Text>
      <Pressable style={styles.retryBtn} onPress={showPicker}>
        <Text style={styles.retryText}>Select image</Text>
      </Pressable>
    </View>
  );
}

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    preview: {
      width: '100%',
      height: '60%',
      borderRadius: radius.lg,
    },
    overlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(15, 13, 11, 0.88)',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.xl,
      gap: spacing.md,
    },
    scanningText: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '600',
      marginTop: spacing.md,
    },
    errorText: {
      color: colors.danger,
      fontSize: 14,
      textAlign: 'center',
      paddingHorizontal: spacing.xl,
      marginBottom: spacing.md,
    },
    errorActions: {
      flexDirection: 'row',
      gap: spacing.md,
    },
    retryBtn: {
      backgroundColor: colors.accent,
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.md,
      borderRadius: radius.md,
    },
    retryText: {
      color: colors.bg,
      fontWeight: '700',
      fontSize: 14,
    },
    cancelBtn: {
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cancelText: {
      color: colors.text2,
      fontSize: 14,
    },
    closeBtn: {
      position: 'absolute',
      top: spacing.xl,
      right: spacing.xl,
      padding: spacing.sm,
      borderRadius: radius.xs,
      backgroundColor: colors.card,
    },
    pickingHint: {
      color: colors.text3,
      fontSize: 14,
      marginBottom: spacing.lg,
    },
  });
