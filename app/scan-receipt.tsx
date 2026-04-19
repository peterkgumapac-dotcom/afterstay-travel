import { useRouter } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useRef, useState } from 'react';
import {
  ActionSheetIOS,
  Alert,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import AfterStayLoader from '@/components/AfterStayLoader';
import { useTheme } from '@/constants/ThemeContext';
import { radius, spacing } from '@/constants/theme';
import { scanReceipt } from '@/lib/anthropic';

type Phase = 'picking' | 'scanning' | 'error';

export default function ScanReceiptScreen() {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('picking');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const didLaunch = useRef(false);

  const pickImage = async (source: 'camera' | 'gallery') => {
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
      source === 'camera'
        ? await ImagePicker.launchCameraAsync(opts)
        : await ImagePicker.launchImageLibraryAsync(opts);

    if (result.canceled || !result.assets?.[0]) {
      router.back();
      return;
    }

    const asset = result.assets[0];
    setImageUri(asset.uri);
    setPhase('scanning');

    try {
      const base64 = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: 'base64' as any,
      });

      const ext = asset.uri.split('.').pop()?.toLowerCase() ?? 'jpeg';
      const mimeMap: Record<string, string> = {
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        png: 'image/png',
        gif: 'image/gif',
        webp: 'image/webp',
      };
      const mimeType = mimeMap[ext] ?? 'image/jpeg';

      const scanned = await scanReceipt(base64, mimeType);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      router.replace({
        pathname: '/add-expense',
        params: {
          description: scanned.description,
          amount: String(scanned.amount),
          currency: scanned.currency,
          category: scanned.category,
          placeName: scanned.placeName,
          date: scanned.date,
          notes: scanned.items.join(', '),
          photoUri: asset.uri,
        },
      });
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

  if (phase === 'scanning') {
    return (
      <View style={styles.container}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.preview} resizeMode="contain" />
        ) : null}
        <View style={styles.overlay}>
          <AfterStayLoader message="Scanning receipt..." />
        </View>
      </View>
    );
  }

  if (phase === 'error') {
    return (
      <View style={styles.container}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.preview} resizeMode="contain" />
        ) : null}
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
  return <View style={styles.container} />;
}

const getStyles = (colors: any) => StyleSheet.create({
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
    alignItems: 'center',
    paddingTop: spacing.xl,
    gap: spacing.md,
  },
  scanningText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
    marginTop: spacing.md,
  },
  errorText: {
    color: colors.red,
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
    backgroundColor: colors.green,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
  },
  retryText: {
    color: colors.white,
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
});
