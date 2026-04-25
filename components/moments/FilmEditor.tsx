import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Keyboard,
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
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Download,
  ListPlus,
  Share2,
} from 'lucide-react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import {
  Canvas,
  Image as SkiaImage,
  useImage,
  useCanvasRef,
  ColorMatrix,
  Blur,
  Fill,
  Rect,
} from '@shopify/react-native-skia';

import { useTheme } from '@/constants/ThemeContext';
import { formatDatePHT } from '@/lib/utils';
import { FilmFilterStrip } from './FilmFilterStrip';
import { CaptionOverlay, type CaptionMode } from './CaptionOverlay';
import { FILM_FILTERS, type FilmFilter } from '@/hooks/useFilmFilters';
import type { MomentDisplay } from './types';

const { width: SCREEN_W } = Dimensions.get('window');
const PHOTO_ASPECT = 4 / 3;
const PHOTO_H = SCREEN_W / PHOTO_ASPECT;
const CINEMATIC_BAR_H = PHOTO_H * 0.12;

// Skia encodeToBase64 quality (0-100). We use PNG for reliability —
// the JPEG enum (3) isn't re-exported from the main package entry and
// passing raw numerics causes native bridge errors on some devices.
const EXPORT_QUALITY = 100;

// ── Queue item ──────────────────────────────────────────────────────────────

interface QueueItem {
  momentId: string;
  filterId: string;
  captionMode: CaptionMode;
  captionText: string;
}

// ── Props ───────────────────────────────────────────────────────────────────

interface FilmEditorProps {
  visible: boolean;
  moments: MomentDisplay[];
  initialIndex: number;
  onClose: () => void;
}

export function FilmEditor({ visible, moments, initialIndex, onClose }: FilmEditorProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const s = useMemo(() => getStyles(colors), [colors]);

  const [currentIdx, setCurrentIdx] = useState(initialIndex);
  const [activeFilter, setActiveFilter] = useState<FilmFilter>(FILM_FILTERS[0]);
  const [captionMode, setCaptionMode] = useState<CaptionMode>('auto');
  const [customCaption, setCustomCaption] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);

  const canvasRef = useCanvasRef();
  const toastTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const isBatchMode = moments.length > 1;
  const moment = moments[currentIdx];
  const photoUri = moment?.photo ?? '';
  const isLastPhoto = currentIdx >= moments.length - 1;

  // ── Toast helper ──────────────────────────────────────────────────────────

  const showToast = useCallback((msg: string) => {
    if (toastTimeout.current) clearTimeout(toastTimeout.current);
    setToast(msg);
    toastTimeout.current = setTimeout(() => setToast(null), 2500);
  }, []);

  useEffect(() => () => {
    if (toastTimeout.current) clearTimeout(toastTimeout.current);
  }, []);

  // ── Caption text builder ──────────────────────────────────────────────────

  const captionText = useMemo(() => {
    if (!moment) return '';
    if (captionMode === 'none') return '';
    if (captionMode === 'custom') return customCaption;
    const parts: string[] = [];
    if (moment.place ?? moment.location) parts.push((moment.place ?? moment.location)!);
    if (moment.date) parts.push(formatDatePHT(moment.date));
    return parts.join(' \u00B7 ');
  }, [captionMode, customCaption, moment]);

  // ── Export single image (HD JPEG) ─────────────────────────────────────────

  const exportImage = useCallback(async (): Promise<string | null> => {
    try {
      const canvas = canvasRef.current;
      if (!canvas) return null;

      const snapshot = canvas.makeImageSnapshot();
      if (!snapshot) return null;

      const base64 = snapshot.encodeToBase64();
      const path = `${FileSystem.cacheDirectory}afterstay_film_${Date.now()}.png`;
      await FileSystem.writeAsStringAsync(path, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });
      return path;
    } catch (err) {
      // Surface error for debugging instead of silent swallow
      const msg = err instanceof Error ? err.message : 'Unknown export error';
      showToast(`Export failed: ${msg}`);
      return null;
    }
  }, [canvasRef, showToast]);

  // ── Single photo: Save to camera roll ─────────────────────────────────────

  const handleSave = useCallback(async () => {
    try {
      Keyboard.dismiss();
      setExporting(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        showToast('Permission needed — allow photo library access');
        return;
      }

      const uri = await exportImage();
      if (!uri) return;

      await MediaLibrary.saveToLibraryAsync(uri);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast('Saved to camera roll');
    } catch {
      showToast('Could not save photo');
    } finally {
      setExporting(false);
    }
  }, [exportImage, showToast]);

  // ── Single photo: Share ───────────────────────────────────────────────────

  const handleShare = useCallback(async () => {
    try {
      Keyboard.dismiss();
      setExporting(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        showToast('Sharing not available on this device');
        return;
      }

      const uri = await exportImage();
      if (!uri) return;

      await Sharing.shareAsync(uri, {
        mimeType: 'image/png',
        dialogTitle: 'Share to Stories',
      });
    } catch {
      showToast('Could not share photo');
    } finally {
      setExporting(false);
    }
  }, [exportImage, showToast]);

  // ── Queue: add current edit ───────────────────────────────────────────────

  const handleAddToQueue = useCallback(() => {
    if (!moment) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    setQueue((prev) => {
      // Replace if already queued
      const filtered = prev.filter((q) => q.momentId !== moment.id);
      return [
        ...filtered,
        {
          momentId: moment.id,
          filterId: activeFilter.id,
          captionMode,
          captionText: captionMode === 'custom' ? customCaption : '',
        },
      ];
    });

    showToast(`Added to queue (${queue.length + 1})`);

    // Advance to next photo if not the last
    if (!isLastPhoto) {
      setCurrentIdx((i) => i + 1);
      setActiveFilter(FILM_FILTERS[0]);
      setCaptionMode('auto');
      setCustomCaption('');
    }
  }, [moment, activeFilter, captionMode, customCaption, queue.length, isLastPhoto, showToast]);

  // ── Queue: export all ─────────────────────────────────────────────────────

  const handleExportAll = useCallback(async () => {
    if (queue.length === 0) return;
    Keyboard.dismiss();
    setExporting(true);

    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== 'granted') {
      showToast('Permission needed — allow photo library access');
      setExporting(false);
      return;
    }

    let saved = 0;

    // For each queued item: switch to that photo+filter, wait for render,
    // snapshot the canvas, and save. We process sequentially.
    for (let i = 0; i < queue.length; i++) {
      const item = queue[i];
      const m = moments.find((mo) => mo.id === item.momentId);
      if (!m?.photo) continue;

      setExportProgress(`Saving ${i + 1} of ${queue.length}...`);

      // Switch canvas to this photo + filter
      setCurrentIdx(moments.indexOf(m));
      setActiveFilter(FILM_FILTERS.find((f) => f.id === item.filterId) ?? FILM_FILTERS[0]);

      // Wait for Skia to load the image and render — useImage is async.
      // We poll the canvas ref for a valid snapshot up to 2s.
      let uri: string | null = null;
      for (let attempt = 0; attempt < 10; attempt++) {
        await new Promise((r) => setTimeout(r, 300));
        uri = await exportImage();
        if (uri) break;
      }

      if (uri) {
        try {
          await MediaLibrary.saveToLibraryAsync(uri);
          saved++;
        } catch {
          // continue with remaining
        }
      }
    }

    setExportProgress('');
    setExporting(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    showToast(`${saved} photo${saved !== 1 ? 's' : ''} saved to camera roll`);
    setQueue([]);
  }, [queue, moments, exportImage, showToast]);

  // ── Filter handler ────────────────────────────────────────────────────────

  const handleFilterSelect = useCallback((filter: FilmFilter) => {
    setActiveFilter(filter);
  }, []);

  if (!visible || !moment) return null;

  const isQueued = queue.some((q) => q.momentId === moment.id);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={[s.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        {/* ── Header ──────────────────────────────────────────────────── */}
        <View style={s.header}>
          <Pressable onPress={onClose} style={s.headerBtn} accessibilityLabel="Close editor">
            <ArrowLeft size={20} color="#fff" strokeWidth={2} />
          </Pressable>
          <View style={s.headerCenter}>
            <Text style={s.headerTitle}>Film</Text>
            {isBatchMode && (
              <Text style={s.headerSubtitle}>
                Photo {currentIdx + 1} of {moments.length}
              </Text>
            )}
          </View>
          {isBatchMode && queue.length > 0 ? (
            <View style={s.queueBadge}>
              <Text style={s.queueBadgeText}>{queue.length}</Text>
            </View>
          ) : (
            <View style={s.headerBtn} />
          )}
        </View>

        {/* ── Photo preview ───────────────────────────────────────────── */}
        <View style={s.previewWrap}>
          <SkiaPhoto photoUri={photoUri} filter={activeFilter} canvasRef={canvasRef} />

          {activeFilter.letterbox && (
            <>
              <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(200)} style={[s.letterbox, s.letterboxTop]} />
              <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(200)} style={[s.letterbox, s.letterboxBottom]} />
            </>
          )}

          {activeFilter.border && <View style={s.polaroidBorder} pointerEvents="none" />}

          {captionMode !== 'none' && captionText.length > 0 && (
            <View style={s.captionOnPhoto}>
              <Text style={s.captionPhotoText}>{captionText}</Text>
            </View>
          )}

          {/* Queued badge on photo */}
          {isQueued && (
            <View style={[s.queuedOnPhoto, { backgroundColor: colors.accent }]}>
              <Check size={12} color="#000" strokeWidth={3} />
              <Text style={s.queuedOnPhotoText}>Queued</Text>
            </View>
          )}
        </View>

        {/* ── Controls ────────────────────────────────────────────────── */}
        <ScrollView
          style={s.controls}
          contentContainerStyle={s.controlsContent}
          bounces={false}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Step 1: Choose a Look */}
          <StepLabel step={1} title="Choose a Look" colors={colors} />
          <FilmFilterStrip
            photoUri={photoUri}
            activeFilterId={activeFilter.id}
            onSelect={handleFilterSelect}
          />

          {/* Step 2: Add Caption */}
          <StepLabel step={2} title="Add Caption" colors={colors} />
          <CaptionOverlay
            mode={captionMode}
            onModeChange={setCaptionMode}
            customText={customCaption}
            onCustomTextChange={setCustomCaption}
            location={moment.place ?? moment.location}
            date={moment.date}
          />

          {/* Step 3: Save / Queue */}
          <StepLabel step={3} title={isBatchMode ? 'Queue & Export' : 'Save & Share'} colors={colors} />

          {isBatchMode ? (
            /* ── Batch mode: Add to Queue + Export All ── */
            <View style={s.batchActions}>
              <Pressable
                onPress={handleAddToQueue}
                style={({ pressed }) => [s.exportBtn, s.queueBtn, pressed && s.exportBtnPressed]}
                accessibilityLabel="Add to queue"
              >
                <ListPlus size={16} color="#000" strokeWidth={2.2} />
                <Text style={s.exportBtnPrimaryText}>
                  {isQueued ? 'Update in Queue' : 'Add to Queue'}
                </Text>
                {!isLastPhoto && <ArrowRight size={14} color="#000" strokeWidth={2.5} />}
              </Pressable>

              {/* Photo navigation dots */}
              <View style={s.dotsRow}>
                {moments.map((_, i) => (
                  <Pressable
                    key={moments[i].id}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setCurrentIdx(i);
                      const qItem = queue.find((q) => q.momentId === moments[i].id);
                      if (qItem) {
                        setActiveFilter(FILM_FILTERS.find((f) => f.id === qItem.filterId) ?? FILM_FILTERS[0]);
                        setCaptionMode(qItem.captionMode);
                        setCustomCaption(qItem.captionText);
                      } else {
                        setActiveFilter(FILM_FILTERS[0]);
                        setCaptionMode('auto');
                        setCustomCaption('');
                      }
                    }}
                    style={s.dotHitArea}
                  >
                    <View
                      style={[
                        s.dot,
                        i === currentIdx && s.dotActive,
                        queue.some((q) => q.momentId === moments[i].id) && s.dotQueued,
                      ]}
                    />
                  </Pressable>
                ))}
              </View>

              {queue.length > 0 && (
                <Pressable
                  onPress={handleExportAll}
                  disabled={exporting}
                  style={({ pressed }) => [s.exportBtn, s.exportAllBtn, pressed && s.exportBtnPressed]}
                  accessibilityLabel={`Export ${queue.length} photos`}
                >
                  {exporting ? (
                    <View style={s.progressRow}>
                      <ActivityIndicator size="small" color="#fff" />
                      <Text style={s.exportBtnSecondaryText}>{exportProgress || 'Preparing...'}</Text>
                    </View>
                  ) : (
                    <>
                      <Download size={16} color="#fff" strokeWidth={2.2} />
                      <Text style={s.exportBtnSecondaryText}>
                        Export All ({queue.length})
                      </Text>
                    </>
                  )}
                </Pressable>
              )}
            </View>
          ) : (
            /* ── Single photo: Save + Share ── */
            <View style={s.exportRow}>
              <Pressable
                onPress={handleSave}
                disabled={exporting}
                style={({ pressed }) => [s.exportBtn, s.exportBtnPrimary, pressed && s.exportBtnPressed]}
                accessibilityLabel="Save to camera roll"
              >
                {exporting ? (
                  <ActivityIndicator size="small" color="#000" />
                ) : (
                  <>
                    <Download size={16} color="#000" strokeWidth={2.2} />
                    <Text style={s.exportBtnPrimaryText}>Save</Text>
                  </>
                )}
              </Pressable>

              <Pressable
                onPress={handleShare}
                disabled={exporting}
                style={({ pressed }) => [s.exportBtn, s.exportBtnSecondary, pressed && s.exportBtnPressed]}
                accessibilityLabel="Share to stories"
              >
                <Share2 size={16} color="#fff" strokeWidth={2} />
                <Text style={s.exportBtnSecondaryText}>Share</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>

        {/* ── Toast ────────────────────────────────────────────────────── */}
        {toast && (
          <Animated.View
            entering={SlideInDown.springify().damping(18).stiffness(200)}
            exiting={FadeOut.duration(200)}
            style={[s.toast, { bottom: insets.bottom + 16 }]}
          >
            <Check size={14} color={colors.accent} strokeWidth={2.5} />
            <Text style={s.toastText}>{toast}</Text>
          </Animated.View>
        )}
      </View>
    </Modal>
  );
}

// ── Step label ──────────────────────────────────────────────────────────────

function StepLabel({
  step,
  title,
  colors,
}: {
  step: number;
  title: string;
  colors: ReturnType<typeof useTheme>['colors'];
}) {
  return (
    <View style={stepStyles.row}>
      <View style={[stepStyles.circle, { backgroundColor: colors.accent }]}>
        <Text style={stepStyles.circleText}>{step}</Text>
      </View>
      <Text style={[stepStyles.title, { color: colors.text2 }]}>{title}</Text>
    </View>
  );
}

const stepStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 2,
  },
  circle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#000',
  },
  title: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
});

// ── Skia photo with filter ──────────────────────────────────────────────────

function SkiaPhoto({
  photoUri,
  filter,
  canvasRef,
}: {
  photoUri: string;
  filter: FilmFilter;
  canvasRef: ReturnType<typeof useCanvasRef>;
}) {
  const skiaImage = useImage(photoUri);
  if (!skiaImage) return <View style={{ width: SCREEN_W, height: PHOTO_H, backgroundColor: '#111' }} />;

  return (
    <Canvas ref={canvasRef} style={{ width: SCREEN_W, height: PHOTO_H }}>
      <SkiaImage
        image={skiaImage}
        fit="cover"
        x={0}
        y={0}
        width={SCREEN_W}
        height={PHOTO_H}
      >
        <ColorMatrix matrix={filter.matrix} />
        {filter.softness > 0 && <Blur blur={filter.softness} />}
      </SkiaImage>

      {filter.grain > 0 && (
        <Rect x={0} y={0} width={SCREEN_W} height={PHOTO_H} opacity={filter.grain * 0.15}>
          <Fill color="rgba(128,128,128,0.3)" />
        </Rect>
      )}
    </Canvas>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

const getStyles = (colors: ReturnType<typeof useTheme>['colors']) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: '#000',
    },

    // Header
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    headerBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerCenter: {
      alignItems: 'center',
    },
    headerTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: '#fff',
      letterSpacing: -0.3,
    },
    headerSubtitle: {
      fontSize: 11,
      color: 'rgba(255,255,255,0.4)',
      marginTop: 1,
    },
    queueBadge: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    queueBadgeText: {
      fontSize: 12,
      fontWeight: '700',
      color: '#000',
    },

    // Photo preview
    previewWrap: {
      width: SCREEN_W,
      height: PHOTO_H,
      backgroundColor: '#000',
      overflow: 'hidden',
    },
    letterbox: {
      position: 'absolute',
      left: 0,
      right: 0,
      height: CINEMATIC_BAR_H,
      backgroundColor: '#000',
      zIndex: 5,
    },
    letterboxTop: { top: 0 },
    letterboxBottom: { bottom: 0 },
    polaroidBorder: {
      ...StyleSheet.absoluteFillObject,
      borderWidth: 12,
      borderColor: '#f5f0e8',
      borderBottomWidth: 40,
      borderRadius: 2,
      zIndex: 4,
    },
    captionOnPhoto: {
      position: 'absolute',
      bottom: 16,
      left: 20,
      right: 20,
      alignItems: 'center',
      zIndex: 10,
    },
    captionPhotoText: {
      fontSize: 14,
      fontWeight: '600',
      color: '#fff',
      letterSpacing: 0.3,
      textShadowColor: 'rgba(0,0,0,0.6)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 4,
      textAlign: 'center',
    },
    queuedOnPhoto: {
      position: 'absolute',
      top: 12,
      right: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 12,
      zIndex: 10,
    },
    queuedOnPhotoText: {
      fontSize: 11,
      fontWeight: '700',
      color: '#000',
    },

    // Controls
    controls: {
      flex: 1,
    },
    controlsContent: {
      paddingBottom: 20,
    },

    // Single-photo export row
    exportRow: {
      flexDirection: 'row',
      gap: 12,
      paddingHorizontal: 20,
      paddingTop: 8,
    },
    exportBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 14,
      borderRadius: 14,
    },
    exportBtnPrimary: {
      backgroundColor: colors.accent,
    },
    exportBtnSecondary: {
      backgroundColor: 'rgba(255,255,255,0.1)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.15)',
    },
    exportBtnPressed: {
      opacity: 0.7,
    },
    exportBtnPrimaryText: {
      fontSize: 14,
      fontWeight: '700',
      color: '#000',
    },
    exportBtnSecondaryText: {
      fontSize: 14,
      fontWeight: '600',
      color: '#fff',
    },

    // Batch mode
    batchActions: {
      paddingHorizontal: 20,
      paddingTop: 8,
      gap: 10,
    },
    queueBtn: {
      backgroundColor: colors.accent,
    },
    exportAllBtn: {
      backgroundColor: 'rgba(255,255,255,0.1)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.15)',
    },
    progressRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },

    // Photo dots
    dotsRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 2,
      paddingVertical: 4,
    },
    dotHitArea: {
      padding: 4,
    },
    dot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: 'rgba(255,255,255,0.2)',
    },
    dotActive: {
      width: 18,
      borderRadius: 3,
      backgroundColor: '#fff',
    },
    dotQueued: {
      backgroundColor: colors.accent,
    },

    // Toast
    toast: {
      position: 'absolute',
      left: 20,
      right: 20,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 14,
      backgroundColor: 'rgba(30,28,26,0.95)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.08)',
    },
    toastText: {
      fontSize: 13,
      fontWeight: '600',
      color: '#fff',
    },
  });
