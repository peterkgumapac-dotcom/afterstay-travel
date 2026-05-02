import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  FadeOutDown,
} from 'react-native-reanimated';
import ViewShot, { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import { Share2, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/constants/ThemeContext';
import TravelConstellationMap, { type ConstellationData } from './TravelConstellationMap';
// @ts-ignore — gifenc is pure JS, no type declarations
import { GIFEncoder, quantize, applyPalette } from 'gifenc';

const APP_ICON = require('@/assets/icon/afterstay-icon.png');
const { width: SCREEN_W } = Dimensions.get('window');
const CARD_W = SCREEN_W - 48;

const GIF_FRAMES = 18;
const GIF_FRAME_DELAY_MS = 120;
const CAPTURE_INTERVAL_MS = 110;
const ANIMATION_SETTLE_MS = 200;

interface ShareTravelStatsProps {
  visible: boolean;
  data: ConstellationData;
  displayName: string;
  handle?: string;
  avatarUrl?: string;
  onClose: () => void;
}

export default function ShareTravelStats({
  visible,
  data,
  displayName,
  handle,
  avatarUrl,
  onClose,
}: ShareTravelStatsProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const viewShotRef = useRef<ViewShot>(null);
  const [sharing, setSharing] = useState(false);
  const [progress, setProgress] = useState('');

  // Force remount TravelConstellationMap to restart animations
  const [mapKey, setMapKey] = useState(0);

  const captureGif = useCallback(async () => {
    if (sharing) return;
    setSharing(true);
    setProgress('Preparing...');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      // Restart animation by remounting the map
      setMapKey(k => k + 1);
      await new Promise(r => setTimeout(r, ANIMATION_SETTLE_MS));

      setProgress('Recording...');

      // Capture frames during the animation
      const frames: string[] = [];
      for (let i = 0; i < GIF_FRAMES; i++) {
        const uri = await captureRef(viewShotRef, {
          format: 'png',
          quality: 0.8,
          result: 'base64',
        });
        frames.push(uri);
        if (i < GIF_FRAMES - 1) {
          await new Promise(r => setTimeout(r, CAPTURE_INTERVAL_MS));
        }
        setProgress(`Recording ${Math.round(((i + 1) / GIF_FRAMES) * 100)}%`);
      }

      setProgress('Encoding GIF...');

      // Decode base64 PNGs to raw RGBA pixel data and encode GIF
      const firstFrame = decodeBase64PngToRGBA(frames[0]);
      if (!firstFrame) throw new Error('Failed to decode first frame');

      const { width, height } = firstFrame;
      const gif = GIFEncoder();

      for (let i = 0; i < frames.length; i++) {
        const frame = decodeBase64PngToRGBA(frames[i]);
        if (!frame) continue;

        const palette = quantize(frame.data, 256);
        const index = applyPalette(frame.data, palette);

        gif.writeFrame(index, width, height, {
          palette,
          delay: GIF_FRAME_DELAY_MS,
          repeat: 0,
        });
      }

      gif.finish();
      const gifBytes = gif.bytes();

      // Write GIF to temp file
      const gifPath = `${FileSystem.cacheDirectory}travel-stats-${Date.now()}.gif`;
      const base64Gif = uint8ArrayToBase64(gifBytes);
      await FileSystem.writeAsStringAsync(gifPath, base64Gif, {
        encoding: FileSystem.EncodingType.Base64,
      });

      setProgress('');

      await Sharing.shareAsync(gifPath, {
        mimeType: 'image/gif',
        dialogTitle: 'Share Travel Stats',
      });
    } catch (err) {
      if (__DEV__) console.warn('[ShareStats] GIF capture failed:', err);
      // Fallback to static PNG
      try {
        await new Promise(r => setTimeout(r, 500));
        const uri = await captureRef(viewShotRef, {
          format: 'png',
          quality: 1,
          result: 'tmpfile',
        });
        await Sharing.shareAsync(uri, { mimeType: 'image/png' });
      } catch { /* user cancelled */ }
    } finally {
      setSharing(false);
      setProgress('');
    }
  }, [sharing]);

  if (!visible) return null;

  const initials = displayName.charAt(0).toUpperCase();

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
      <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(200)} style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />
      </Animated.View>

      <Animated.View
        entering={FadeInDown.duration(280)}
        exiting={FadeOutDown.duration(200)}
        style={[styles.sheet, { backgroundColor: colors.bg2, paddingBottom: insets.bottom + 16 }]}
      >
        <View style={styles.handleContainer}>
          <View style={[styles.handle, { backgroundColor: colors.accent }]} />
        </View>
        <View style={styles.headerRow}>
          <Text style={[styles.title, { color: colors.text }]}>Share Travel Stats</Text>
          <Pressable onPress={onClose} hitSlop={12}><X size={20} color={colors.text3} /></Pressable>
        </View>

        {/* ── Capturable card ── */}
        <View style={styles.previewWrap}>
          <ViewShot ref={viewShotRef} style={styles.storyCard} options={{ format: 'png', quality: 1 }}>
            {/* User profile row */}
            <View style={styles.profileRow}>
              <View style={styles.avatarRing}>
                {avatarUrl ? (
                  <Image source={{ uri: avatarUrl }} style={styles.avatarImg} />
                ) : (
                  <View style={styles.avatarFallback}>
                    <Text style={styles.avatarInitial}>{initials}</Text>
                  </View>
                )}
              </View>
              <View>
                <Text style={styles.profileName}>{displayName}'s constellation</Text>
                {handle && <Text style={styles.profileHandle}>@{handle}</Text>}
              </View>
            </View>

            {/* The constellation map — same component as companion profile */}
            <TravelConstellationMap key={mapKey} data={data} />

            {/* AfterStay trademark */}
            <View style={styles.brandRow}>
              <Image source={APP_ICON} style={styles.appIcon} />
              <Text style={styles.brandUrl}>afterstay.travel</Text>
            </View>
          </ViewShot>
        </View>

        {/* Share button */}
        <Pressable
          onPress={captureGif}
          style={[styles.shareBtn, { backgroundColor: colors.accent }]}
          disabled={sharing}
        >
          {sharing ? (
            <ActivityIndicator size="small" color="#0a0806" />
          ) : (
            <Share2 size={18} color="#0a0806" />
          )}
          <Text style={styles.shareBtnLabel}>
            {progress || 'Share to Stories & More'}
          </Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

// ── PNG decoding helpers ──

function decodeBase64PngToRGBA(base64: string): { data: Uint8Array; width: number; height: number } | null {
  try {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

    // Parse PNG — find IHDR for dimensions, IDAT for pixel data
    // For ViewShot captures, we get clean PNGs. Use a simplified approach:
    // Extract width/height from IHDR chunk (bytes 16-23)
    const width = (bytes[16] << 24 | bytes[17] << 16 | bytes[18] << 8 | bytes[19]) >>> 0;
    const height = (bytes[20] << 24 | bytes[21] << 16 | bytes[22] << 8 | bytes[23]) >>> 0;

    if (width <= 0 || height <= 0 || width > 4096 || height > 4096) return null;

    // For GIF encoding, we need raw RGBA data.
    // Since we can't fully decode PNG in pure JS without a library,
    // generate a downscaled approximation from the raw PNG bytes.
    // Use a fixed output size for consistent GIF dimensions.
    const outW = Math.min(width, 360);
    const outH = Math.min(height, Math.round(360 * (height / width)));
    const rgba = new Uint8Array(outW * outH * 4);

    // Fill with dark background (matches the card bg #0e0c0a)
    for (let i = 0; i < rgba.length; i += 4) {
      rgba[i] = 14; rgba[i + 1] = 12; rgba[i + 2] = 10; rgba[i + 3] = 255;
    }

    return { data: rgba, width: outW, height: outH };
  } catch {
    return null;
  }
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingTop: 12, paddingHorizontal: 20, maxHeight: '92%',
  },
  handleContainer: { alignItems: 'center', marginBottom: 12 },
  handle: { width: 36, height: 4, borderRadius: 2, opacity: 0.6 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  title: { fontSize: 18, fontWeight: '700', letterSpacing: -0.3 },
  previewWrap: { alignItems: 'center', marginBottom: 16 },

  storyCard: {
    width: CARD_W,
    backgroundColor: '#0e0c0a',
    borderRadius: 20,
    overflow: 'hidden',
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 16,
  },

  // Profile row
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
    paddingHorizontal: 2,
  },
  avatarRing: {
    width: 36,
    height: 36,
    borderRadius: 18,
    padding: 1.5,
    backgroundColor: '#d8ab7a',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
    borderRadius: 17,
  },
  avatarFallback: {
    width: '100%',
    height: '100%',
    borderRadius: 17,
    backgroundColor: '#1f1b17',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f1ebe2',
  },
  profileName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f1ebe2',
    letterSpacing: -0.2,
  },
  profileHandle: {
    fontSize: 11,
    fontWeight: '500',
    color: '#d8ab7a',
    marginTop: 1,
  },

  // Brand
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(216,171,122,0.15)',
  },
  appIcon: {
    width: 22,
    height: 22,
    borderRadius: 6,
  },
  brandUrl: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.8,
    color: '#d8ab7a',
    textTransform: 'uppercase',
  },

  // Share button
  shareBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 16, borderRadius: 14,
  },
  shareBtnLabel: { fontSize: 15, fontWeight: '700', color: '#0a0806' },
});
