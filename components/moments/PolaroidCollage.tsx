import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Download, Share2, Shuffle, Users, X } from 'lucide-react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import {
  Canvas,
  Fill,
  Group,
  Image as SkiaImage,
  RoundedRect,
  Shadow,
  ColorMatrix,
  useCanvasRef,
  useFont,
  useImage,
  Text as SkiaText,
} from '@shopify/react-native-skia';

import { useTheme, type ThemeColors } from '@/constants/ThemeContext';
import { spacing, radius } from '@/constants/theme';
import { formatDatePHT } from '@/lib/utils';
import { usePolaroidLayout } from '@/hooks/usePolaroidLayout';
import { FilmFilterStrip } from './FilmFilterStrip';
import { FILM_FILTERS, type FilmFilter } from '@/hooks/useFilmFilters';
import type { MomentDisplay } from './types';

const { width: SCREEN_W } = Dimensions.get('window');

// Export dimensions — 4:5 aspect for Instagram
const CANVAS_W = 1080;
const CANVAS_H = 1350;
const PREVIEW_W = SCREEN_W - 32;
const PREVIEW_H = PREVIEW_W * (CANVAS_H / CANVAS_W);

// ── Background options ─────────────────────────────────────────────────────

interface BgOption {
  key: string;
  label: string;
  color: string;
  usesTheme?: boolean;
}

const BG_OPTIONS: BgOption[] = [
  { key: 'dark', label: 'Dark', color: '#231e19', usesTheme: true },
  { key: 'cork', label: 'Cork', color: '#C4A265' },
  { key: 'kraft', label: 'Kraft', color: '#B89B7A' },
  { key: 'linen', label: 'Linen', color: '#E8E0D4' },
];

// ── Toast ──────────────────────────────────────────────────────────────────

function useToast() {
  const [msg, setMsg] = useState<string | null>(null);
  const show = useCallback((text: string) => {
    setMsg(text);
    setTimeout(() => setMsg(null), 2200);
  }, []);
  return { msg, show };
}

// ── Single image loader (one hook call per slot) ───────────────────────────

function useSlotImage(uri: string | undefined) {
  return useImage(uri ?? '');
}

// ── Props ──────────────────────────────────────────────────────────────────

interface PolaroidCollageProps {
  visible: boolean;
  moments: MomentDisplay[];
  onClose: () => void;
}

// ── Wrapper: only mounts inner when visible (fixes Rules of Hooks) ─────────

export function PolaroidCollage({ visible, moments, onClose }: PolaroidCollageProps) {
  if (!visible || moments.length === 0) return null;
  return <PolaroidCollageInner moments={moments} onClose={onClose} />;
}

// ── Inner component (safe to call variable hooks — moment count is stable) ─

function PolaroidCollageInner({ moments, onClose }: { moments: MomentDisplay[]; onClose: () => void }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const s = useMemo(() => getStyles(colors), [colors]);
  const canvasRef = useCanvasRef();
  const toast = useToast();

  // State
  const [activeBg, setActiveBg] = useState('dark');
  const [activeFilter, setActiveFilter] = useState<FilmFilter>(FILM_FILTERS[0]);
  const [exporting, setExporting] = useState(false);

  // Font for captions on Skia canvas
  const captionFont = useFont(require('@/assets/fonts/SpaceMono-Regular.ttf'), 22);

  // Build captions from moment data
  const captions = useMemo(
    () =>
      moments.map((m) => {
        const parts: string[] = [];
        if (m.place ?? m.location) parts.push((m.place ?? m.location)!);
        if (m.date) parts.push(formatDatePHT(m.date));
        return parts.join(' · ') || '';
      }),
    [moments],
  );

  // Layout — compute in logical 1080x1350 space; scaled down for preview via Group transform
  const { placements, shuffle } = usePolaroidLayout(
    moments.length,
    CANVAS_W,
    CANVAS_H,
    captions,
  );

  // Load Skia images — each slot is a stable hook call since moments.length
  // is fixed for the lifetime of this component (it unmounts on close).
  const img0 = useSlotImage(moments[0]?.photo);
  const img1 = useSlotImage(moments[1]?.photo);
  const img2 = useSlotImage(moments[2]?.photo);
  const img3 = useSlotImage(moments[3]?.photo);
  const img4 = useSlotImage(moments[4]?.photo);
  const img5 = useSlotImage(moments[5]?.photo);
  const img6 = useSlotImage(moments[6]?.photo);
  const skiaImages = useMemo(
    () => [img0, img1, img2, img3, img4, img5, img6].slice(0, moments.length),
    [img0, img1, img2, img3, img4, img5, img6, moments.length],
  );

  const allLoaded = skiaImages.every((img) => img !== null) && captionFont !== null;

  // Resolve background color
  const bgColor = useMemo(() => {
    const opt = BG_OPTIONS.find((o) => o.key === activeBg);
    if (opt?.usesTheme) return colors.bg3;
    return opt?.color ?? colors.bg3;
  }, [activeBg, colors.bg3]);

  // Is identity filter (no color matrix needed)?
  const isIdentity = activeFilter.id === 'original';

  // ── Export pipeline (reused from FilmEditor) ─────────────────────────────

  const exportImage = useCallback(async (): Promise<string | null> => {
    try {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const snapshot = canvas.makeImageSnapshot();
      if (!snapshot) return null;
      const base64 = snapshot.encodeToBase64();
      const path = `${FileSystem.cacheDirectory}afterstay_collage_${Date.now()}.png`;
      await FileSystem.writeAsStringAsync(path, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });
      return path;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown export error';
      toast.show(`Export failed: ${msg}`);
      return null;
    }
  }, [canvasRef, toast]);

  const handleSave = useCallback(async () => {
    try {
      setExporting(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        toast.show('Permission needed — allow photo library access');
        return;
      }
      const uri = await exportImage();
      if (!uri) return;
      await MediaLibrary.saveToLibraryAsync(uri);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.show('Saved to camera roll');
    } catch {
      toast.show('Could not save collage');
    } finally {
      setExporting(false);
    }
  }, [exportImage, toast]);

  const handleShare = useCallback(async () => {
    try {
      setExporting(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        toast.show('Sharing not available on this device');
        return;
      }
      const uri = await exportImage();
      if (!uri) return;
      await Sharing.shareAsync(uri, {
        mimeType: 'image/png',
        dialogTitle: 'Share Collage',
      });
    } catch {
      toast.show('Could not share collage');
    } finally {
      setExporting(false);
    }
  }, [exportImage, toast]);

  const handleShareToGroup = useCallback(async () => {
    try {
      setExporting(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const uri = await exportImage();
      if (!uri) return;
      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        toast.show('Sharing not available on this device');
        return;
      }
      await Sharing.shareAsync(uri, {
        mimeType: 'image/png',
        dialogTitle: 'Share Collage with Group',
      });
    } catch {
      toast.show('Could not share collage');
    } finally {
      setExporting(false);
    }
  }, [exportImage, toast]);

  // ── Truncate caption to fit frame ────────────────────────────────────────

  const truncateCaption = useCallback(
    (text: string, maxWidth: number): string => {
      if (!captionFont || !text) return '';
      const measured = captionFont.measureText(text);
      if (measured.width <= maxWidth) return text;
      let truncated = text;
      while (truncated.length > 0) {
        truncated = truncated.slice(0, -1);
        const w = captionFont.measureText(truncated + '…').width;
        if (w <= maxWidth) return truncated + '…';
      }
      return '';
    },
    [captionFont],
  );

  // ── Render ───────────────────────────────────────────────────────────────

  const firstPhotoUri = moments[0]?.photo ?? '';

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={[s.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        {/* Header */}
        <View style={s.header}>
          <Pressable onPress={onClose} hitSlop={12} style={s.headerBtn}>
            <X size={20} color={colors.text} />
          </Pressable>
          <Text style={s.headerTitle}>Polaroid Collage</Text>
          <Pressable
            onPress={handleShare}
            hitSlop={12}
            style={s.headerBtn}
            disabled={!allLoaded || exporting}
          >
            <Share2 size={20} color={allLoaded ? colors.accent : colors.text3} />
          </Pressable>
        </View>

        <ScrollView
          style={s.scroll}
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Canvas Preview */}
          <View style={s.canvasWrap}>
            {!allLoaded && (
              <View style={s.loadingOverlay}>
                <ActivityIndicator size="large" color={colors.accent} />
                <Text style={s.loadingText}>Loading photos…</Text>
              </View>
            )}
            <Canvas
              ref={canvasRef}
              style={{ width: PREVIEW_W, height: PREVIEW_H }}
            >
              <Group transform={[{ scale: PREVIEW_W / CANVAS_W }]}>
              {/* Background */}
              <Fill color={bgColor} />

              {/* Polaroid frames (z-ordered) */}
              {placements.map((p) => {
                const img = skiaImages[p.index];
                if (!img) return null;

                const frameX = p.x - p.frameW / 2;
                const frameY = p.y - p.frameH / 2;
                const photoX = frameX + p.sidePad;
                const photoY = frameY + p.topPad;

                const captionText = truncateCaption(
                  p.caption,
                  p.photoW - p.sidePad * 2,
                );
                const captionX = frameX + p.sidePad + 4;
                const captionY = frameY + p.topPad + p.photoH + p.bottomPad * 0.65;

                const rotRad = (p.rotation * Math.PI) / 180;

                return (
                  <Group
                    key={p.index}
                    transform={[
                      { translateX: p.x },
                      { translateY: p.y },
                      { rotate: rotRad },
                      { translateX: -p.x },
                      { translateY: -p.y },
                    ]}
                  >
                    {/* Shadow behind frame */}
                    <RoundedRect
                      x={frameX}
                      y={frameY}
                      width={p.frameW}
                      height={p.frameH}
                      r={4}
                      color="rgba(0,0,0,0.01)"
                    >
                      <Shadow dx={0} dy={6} blur={18} color="rgba(0,0,0,0.35)" />
                    </RoundedRect>

                    {/* White frame */}
                    <RoundedRect
                      x={frameX}
                      y={frameY}
                      width={p.frameW}
                      height={p.frameH}
                      r={4}
                      color="#f5f0e8"
                    />

                    {/* Photo */}
                    <SkiaImage
                      image={img}
                      x={photoX}
                      y={photoY}
                      width={p.photoW}
                      height={p.photoH}
                      fit="cover"
                    >
                      {!isIdentity && (
                        <ColorMatrix matrix={activeFilter.matrix} />
                      )}
                    </SkiaImage>

                    {/* Caption on bottom strip */}
                    {captionFont && captionText ? (
                      <SkiaText
                        x={captionX}
                        y={captionY}
                        text={captionText}
                        font={captionFont}
                        color="#3C2814"
                      />
                    ) : null}
                  </Group>
                );
              })}
              </Group>
            </Canvas>
          </View>

          {/* Background picker */}
          <View style={s.section}>
            <Text style={s.sectionLabel}>BACKGROUND</Text>
            <View style={s.bgRow}>
              {BG_OPTIONS.map((opt) => {
                const isActive = activeBg === opt.key;
                const swatch = opt.usesTheme ? colors.bg3 : opt.color;
                return (
                  <Pressable
                    key={opt.key}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setActiveBg(opt.key);
                    }}
                    style={s.bgItem}
                  >
                    <View
                      style={[
                        s.bgCircle,
                        { backgroundColor: swatch },
                        isActive && { borderColor: colors.accent, borderWidth: 2.5 },
                      ]}
                    />
                    <Text style={[s.bgLabel, isActive && { color: colors.accent }]}>
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Shuffle */}
          <View style={s.section}>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                shuffle();
              }}
              style={s.shuffleBtn}
            >
              <Shuffle size={16} color={colors.accent} />
              <Text style={s.shuffleLabel}>Shuffle Layout</Text>
            </Pressable>
          </View>

          {/* Filter strip */}
          <View style={s.section}>
            <Text style={s.sectionLabel}>FILTER</Text>
            <FilmFilterStrip
              photoUri={firstPhotoUri}
              activeFilterId={activeFilter.id}
              onSelect={setActiveFilter}
            />
          </View>

          {/* Footer actions */}
          <View style={s.footer}>
            <Pressable
              onPress={handleSave}
              disabled={!allLoaded || exporting}
              style={s.footerBtn}
            >
              <Download size={20} color={allLoaded ? colors.accent : colors.text3} />
              <Text style={[s.footerLabel, !allLoaded && s.footerLabelDim]}>Save</Text>
            </Pressable>

            <Pressable
              onPress={handleShare}
              disabled={!allLoaded || exporting}
              style={s.footerBtn}
            >
              <Share2 size={20} color={allLoaded ? '#4CAF50' : colors.text3} />
              <Text style={[s.footerLabel, !allLoaded && s.footerLabelDim]}>Share</Text>
            </Pressable>

            <Pressable
              onPress={handleShareToGroup}
              disabled={!allLoaded}
              style={s.footerBtn}
            >
              <Users size={20} color={allLoaded ? '#5B9BD5' : colors.text3} />
              <Text style={[s.footerLabel, !allLoaded && s.footerLabelDim]}>Group</Text>
            </Pressable>
          </View>
        </ScrollView>

        {/* Toast */}
        {toast.msg && (
          <Animated.View
            entering={FadeIn.duration(200)}
            exiting={FadeOut.duration(200)}
            style={s.toast}
          >
            <Text style={s.toastText}>{toast.msg}</Text>
          </Animated.View>
        )}
      </View>
    </Modal>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
    headerBtn: {
      width: 36,
      height: 36,
      borderRadius: radius.sm,
      backgroundColor: colors.card,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
      letterSpacing: -0.3,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: 40,
    },
    canvasWrap: {
      alignSelf: 'center',
      marginHorizontal: 16,
      borderRadius: radius.md,
      overflow: 'hidden',
      backgroundColor: colors.card,
    },
    loadingOverlay: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.5)',
      borderRadius: radius.md,
    },
    loadingText: {
      marginTop: 8,
      fontSize: 13,
      color: colors.text2,
    },
    section: {
      paddingHorizontal: spacing.lg,
      marginTop: spacing.xl,
    },
    sectionLabel: {
      fontSize: 10,
      fontWeight: '600',
      letterSpacing: 1.8,
      color: colors.text3,
      textTransform: 'uppercase',
      marginBottom: spacing.sm,
    },
    bgRow: {
      flexDirection: 'row',
      gap: spacing.xl,
    },
    bgItem: {
      alignItems: 'center',
      gap: 6,
    },
    bgCircle: {
      width: 40,
      height: 40,
      borderRadius: 20,
      borderWidth: 1.5,
      borderColor: colors.border,
    },
    bgLabel: {
      fontSize: 11,
      fontWeight: '500',
      color: colors.text2,
    },
    shuffleBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'center',
      gap: 8,
      paddingHorizontal: spacing.xl,
      paddingVertical: 10,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.accentBorder,
      backgroundColor: colors.accentBg,
    },
    shuffleLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.accent,
    },
    footer: {
      flexDirection: 'row',
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
      marginTop: spacing.xxl,
    },
    footerBtn: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      paddingVertical: 12,
      borderRadius: radius.sm,
      backgroundColor: colors.card,
    },
    footerLabel: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.text2,
    },
    footerLabelDim: {
      color: colors.text3,
    },
    toast: {
      position: 'absolute',
      bottom: 100,
      alignSelf: 'center',
      backgroundColor: colors.elevated,
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.border,
    },
    toastText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
    },
  });
