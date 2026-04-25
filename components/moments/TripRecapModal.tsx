import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { X } from 'lucide-react-native';

const { width: SW, height: SH } = Dimensions.get('window');

// Layout
const MAX = 16;
const GRID_COLS = 3;
const GRID_GAP = 6;
const GRID_PAD = 16;
const GRID_CELL = (SW - GRID_PAD * 2 - GRID_GAP * (GRID_COLS - 1)) / GRID_COLS;

// Polaroid card
const CARD_W = SW * 0.34;
const CARD_PAD = 8;
const CARD_BOTTOM = 24;
const PHOTO_SIZE = CARD_W - CARD_PAD * 2;

// Timing
const SCATTER_STAGGER = 80;
const SCATTER_HOLD = 1000;
const TIDY_DUR = 600;
const GRID_FADE = 400;
const WIPE_DUR = 500;
const SLIDE_DUR = 2500;
const END_HOLD = 2000;
const END_FADE = 1000;

const SPRING_LAND = { damping: 14, stiffness: 90 };

export interface RecapPhoto { uri: string; placeName?: string }
interface Props { photos: RecapPhoto[]; dayLabel: string; visible: boolean; onClose: () => void }

function shuffle<T>(a: T[]): T[] {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

type Phase = 'loading' | 'scatter' | 'tidy' | 'slideshow' | 'end';
type WipeType = 'horizontal' | 'vertical' | 'diagonal';
const WIPE_CYCLE: WipeType[] = ['horizontal', 'vertical', 'diagonal'];

// ── ImagePreloader ────────────────────────────────────────────────────
// Renders invisible images to warm the native cache, fires onReady when all loaded.

function ImagePreloader({ uris, onReady }: { uris: string[]; onReady: () => void }) {
  const loaded = useRef(new Set<number>());
  const total = uris.length;

  const handleLoad = useCallback((idx: number) => {
    loaded.current.add(idx);
    if (loaded.current.size >= total) onReady();
  }, [total, onReady]);

  // Timeout fallback — don't wait forever for slow images
  useEffect(() => {
    const t = setTimeout(onReady, 6000);
    return () => clearTimeout(t);
  }, [onReady]);

  return (
    <View style={S.preloader}>
      {uris.map((uri, i) => (
        <Image
          key={i}
          source={{ uri }}
          style={S.preloadImg}
          onLoad={() => handleLoad(i)}
          onError={() => handleLoad(i)} // count errors as loaded to not block
        />
      ))}
    </View>
  );
}

// ── PolaroidCard ──────────────────────────────────────────────────────

interface CardLayout {
  scatterX: number; scatterY: number; scatterRot: number;
  gridX: number; gridY: number;
}

const PolaroidCard = React.memo(function PolaroidCard({
  uri, index, layout, phase,
}: {
  uri: string; index: number; layout: CardLayout; phase: Phase;
}) {
  const tx = useSharedValue(SW / 2 - CARD_W / 2);
  const ty = useSharedValue(-CARD_W - 100);
  const rot = useSharedValue(0);
  const sc = useSharedValue(0.3);
  const op = useSharedValue(0);

  useEffect(() => {
    if (phase === 'scatter') {
      const d = index * SCATTER_STAGGER;
      tx.value = withDelay(d, withSpring(layout.scatterX, SPRING_LAND));
      ty.value = withDelay(d, withSpring(layout.scatterY, SPRING_LAND));
      rot.value = withDelay(d, withSpring(layout.scatterRot, SPRING_LAND));
      sc.value = withDelay(d, withSpring(1, SPRING_LAND));
      op.value = withDelay(d, withTiming(1, { duration: 200 }));
    } else if (phase === 'tidy') {
      const ease = Easing.inOut(Easing.cubic);
      const gridScale = GRID_CELL / CARD_W;
      tx.value = withTiming(layout.gridX, { duration: TIDY_DUR, easing: ease });
      ty.value = withTiming(layout.gridY, { duration: TIDY_DUR, easing: ease });
      rot.value = withTiming(0, { duration: TIDY_DUR, easing: ease });
      sc.value = withTiming(gridScale, { duration: TIDY_DUR, easing: ease });
    }
    return () => {
      cancelAnimation(tx); cancelAnimation(ty);
      cancelAnimation(rot); cancelAnimation(sc); cancelAnimation(op);
    };
  }, [phase]);

  const style = useAnimatedStyle(() => {
    'worklet';
    return {
      position: 'absolute' as const,
      left: tx.value, top: ty.value,
      width: CARD_W,
      opacity: op.value,
      transform: [{ scale: sc.value }, { rotateZ: `${rot.value}deg` }],
    };
  });

  return (
    <Animated.View style={[style, S.polaroid]}>
      <Image source={{ uri }} style={S.polaroidPhoto} resizeMode="cover" />
    </Animated.View>
  );
});

// ── WipeSlide ─────────────────────────────────────────────────────────

const WipeSlide = React.memo(function WipeSlide({
  uri, wipeType, revealing,
}: {
  uri: string; wipeType: WipeType; revealing: boolean;
}) {
  const clip = useSharedValue(revealing ? 0 : 1);
  const kenBurns = useSharedValue(1);

  useEffect(() => {
    cancelAnimation(clip);
    cancelAnimation(kenBurns);
    if (revealing) {
      clip.value = 0;
      clip.value = withTiming(1, { duration: WIPE_DUR, easing: Easing.inOut(Easing.cubic) });
      kenBurns.value = 1;
      kenBurns.value = withTiming(1.05, { duration: SLIDE_DUR, easing: Easing.linear });
    } else {
      clip.value = 1;
    }
    return () => { cancelAnimation(clip); cancelAnimation(kenBurns); };
  }, [revealing, uri]);

  const maskStyle = useAnimatedStyle(() => {
    'worklet';
    const t = clip.value;
    if (wipeType === 'horizontal') {
      return { position: 'absolute' as const, top: 0, left: 0, width: interpolate(t, [0, 1], [0, SW]), height: SH, overflow: 'hidden' as const };
    } else if (wipeType === 'vertical') {
      return { position: 'absolute' as const, top: 0, left: 0, width: SW, height: interpolate(t, [0, 1], [0, SH]), overflow: 'hidden' as const };
    }
    return { position: 'absolute' as const, top: 0, left: 0, width: interpolate(t, [0, 1], [0, SW]), height: interpolate(t, [0, 1], [0, SH]), overflow: 'hidden' as const };
  });

  const imgStyle = useAnimatedStyle(() => {
    'worklet';
    return { width: SW, height: SH, transform: [{ scale: kenBurns.value }] };
  });

  return (
    <Animated.View style={maskStyle}>
      <Animated.View style={imgStyle}>
        <Image source={{ uri }} style={{ width: SW, height: SH }} resizeMode="cover" />
      </Animated.View>
    </Animated.View>
  );
});

// ── Main ──────────────────────────────────────────────────────────────

export default function TripRecapModal({ photos: raw, visible, onClose }: Props) {
  const photos = useMemo(() => {
    const valid = raw.filter((p) => p.uri);
    if (valid.length === 0) return [];
    return valid.length > MAX ? shuffle(valid).slice(0, MAX) : shuffle(valid);
  }, [raw]);

  const cardLayouts = useMemo<CardLayout[]>(() => {
    return photos.map((_, i) => ({
      scatterX: SW / 2 + (Math.random() - 0.5) * (SW - CARD_W) - CARD_W / 2,
      scatterY: SH / 2 + (Math.random() - 0.5) * (SH * 0.45) - CARD_W / 2,
      scatterRot: (Math.random() - 0.5) * 16,
      gridX: GRID_PAD + (i % GRID_COLS) * (GRID_CELL + GRID_GAP),
      gridY: 80 + Math.floor(i / GRID_COLS) * (GRID_CELL + GRID_GAP),
    }));
  }, [photos]);

  const [phase, setPhase] = useState<Phase>('loading');
  const [slideIdx, setSlideIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const gridOp = useSharedValue(1);
  const screenOp = useSharedValue(1);
  const progressW = useSharedValue(0);

  const addT = useCallback((t: ReturnType<typeof setTimeout>) => { timers.current.push(t); }, []);
  const clearT = useCallback(() => { timers.current.forEach(clearTimeout); timers.current = []; }, []);

  // Reset
  useEffect(() => {
    if (!visible) {
      clearT(); setPhase('loading'); setSlideIdx(0); setPaused(false);
      gridOp.value = 1; screenOp.value = 1; progressW.value = 0;
    }
  }, [visible]);

  // Empty
  useEffect(() => {
    if (visible && photos.length === 0) { const t = setTimeout(onClose, 1000); return () => clearTimeout(t); }
  }, [visible, photos.length, onClose]);

  // Called when images are warmed in native cache
  const handleImagesReady = useCallback(() => {
    setPhase('scatter');
  }, []);

  // Scatter → tidy → slideshow chain
  useEffect(() => {
    if (phase !== 'scatter') return;
    const scatterEnd = photos.length * SCATTER_STAGGER + 400;
    const t1 = setTimeout(() => {
      const t2 = setTimeout(() => {
        setPhase('tidy');
        const t3 = setTimeout(() => {
          gridOp.value = withTiming(0, { duration: GRID_FADE, easing: Easing.inOut(Easing.quad) });
          const t4 = setTimeout(() => { setPhase('slideshow'); setSlideIdx(0); }, GRID_FADE);
          addT(t4);
        }, TIDY_DUR);
        addT(t3);
      }, SCATTER_HOLD);
      addT(t2);
    }, scatterEnd);
    addT(t1);
  }, [phase, photos.length]);

  // Progress bar
  useEffect(() => {
    if (phase !== 'slideshow') return;
    cancelAnimation(progressW);
    progressW.value = 0;
    progressW.value = withTiming(1, { duration: photos.length * (SLIDE_DUR + WIPE_DUR), easing: Easing.linear });
  }, [phase, photos.length]);

  // Auto-advance
  useEffect(() => {
    if (phase !== 'slideshow' || paused) return;
    const t = setTimeout(() => {
      if (slideIdx + 1 >= photos.length) {
        setPhase('end');
        const t1 = setTimeout(() => {
          screenOp.value = withTiming(0, { duration: END_FADE, easing: Easing.inOut(Easing.quad) });
          const t2 = setTimeout(onClose, END_FADE + 50);
          addT(t2);
        }, END_HOLD);
        addT(t1);
      } else {
        setSlideIdx((i) => i + 1);
      }
    }, SLIDE_DUR);
    addT(t);
    return () => { const idx = timers.current.indexOf(t); if (idx >= 0) { clearTimeout(t); timers.current.splice(idx, 1); } };
  }, [phase, slideIdx, paused, photos.length, onClose]);

  // Navigation
  const goNext = useCallback(() => {
    if (phase !== 'slideshow') return;
    clearT();
    if (slideIdx + 1 >= photos.length) {
      setPhase('end');
      const t1 = setTimeout(() => { screenOp.value = withTiming(0, { duration: END_FADE }); const t2 = setTimeout(onClose, END_FADE + 50); addT(t2); }, END_HOLD);
      addT(t1);
    } else { setSlideIdx((i) => i + 1); }
  }, [phase, slideIdx, photos.length, onClose]);

  const goPrev = useCallback(() => {
    if (phase !== 'slideshow' || slideIdx <= 0) return;
    clearT(); setSlideIdx((i) => i - 1);
  }, [phase, slideIdx]);

  // Gestures
  const tap = Gesture.Tap().onEnd((e) => { 'worklet'; if (e.absoluteX > SW * 0.5) runOnJS(goNext)(); else runOnJS(goPrev)(); });
  const longPress = Gesture.LongPress().minDuration(400)
    .onStart(() => { 'worklet'; runOnJS(setPaused)(true); })
    .onEnd(() => { 'worklet'; runOnJS(setPaused)(false); });
  const pan = Gesture.Pan().activeOffsetY(50).onEnd((e) => { 'worklet'; if (e.translationY > 100) runOnJS(onClose)(); });
  const gesture = Gesture.Race(pan, Gesture.Exclusive(longPress, tap));

  const gridStyle = useAnimatedStyle(() => { 'worklet'; return { opacity: gridOp.value }; });
  const fadeStyle = useAnimatedStyle(() => { 'worklet'; return { opacity: screenOp.value }; });
  const barStyle = useAnimatedStyle(() => { 'worklet'; return { width: `${progressW.value * 100}%` }; });

  return (
    <Modal visible={visible} animationType="fade" transparent={false} onRequestClose={onClose}>
      <Animated.View style={[S.root, fadeStyle]}>
        <GestureDetector gesture={gesture}>
          <View style={S.content}>
            {/* Preload images into native cache */}
            {phase === 'loading' && photos.length > 0 && (
              <>
                <View style={S.center}><Text style={S.loadingText}>Loading...</Text></View>
                <ImagePreloader uris={photos.map((p) => p.uri)} onReady={handleImagesReady} />
              </>
            )}

            {photos.length === 0 && (
              <View style={S.center}><Text style={S.loadingText}>No photos</Text></View>
            )}

            {/* Polaroid scatter + tidy */}
            {(phase === 'scatter' || phase === 'tidy') && (
              <Animated.View style={[StyleSheet.absoluteFill, gridStyle]}>
                {photos.map((p, i) => (
                  <PolaroidCard key={`p-${i}`} uri={p.uri} index={i} layout={cardLayouts[i]} phase={phase} />
                ))}
              </Animated.View>
            )}

            {/* Slideshow */}
            {(phase === 'slideshow' || phase === 'end') && (
              <View style={StyleSheet.absoluteFill}>
                {slideIdx > 0 && (
                  <WipeSlide key={`cur-${slideIdx - 1}`} uri={photos[slideIdx - 1]?.uri ?? photos[0].uri} wipeType={WIPE_CYCLE[(slideIdx - 1) % 3]} revealing={false} />
                )}
                <WipeSlide key={`inc-${slideIdx}`} uri={photos[slideIdx]?.uri ?? photos[0].uri} wipeType={WIPE_CYCLE[slideIdx % 3]} revealing={true} />
              </View>
            )}
          </View>
        </GestureDetector>

        {(phase === 'slideshow' || phase === 'end') && (
          <View style={S.progressTrack}><Animated.View style={[S.progressFill, barStyle]} /></View>
        )}

        {paused && <View style={S.pausedWrap} pointerEvents="none"><Text style={S.pausedText}>PAUSED</Text></View>}

        <Pressable style={S.closeBtn} onPress={onClose} hitSlop={12}>
          <X size={28} color="#fff" strokeWidth={2} />
        </Pressable>
      </Animated.View>
    </Modal>
  );
}

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  content: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: '#555', fontSize: 14 },
  preloader: { position: 'absolute', width: 1, height: 1, opacity: 0, overflow: 'hidden' },
  preloadImg: { width: 1, height: 1 },
  polaroid: {
    backgroundColor: '#fff',
    paddingTop: CARD_PAD, paddingHorizontal: CARD_PAD, paddingBottom: CARD_BOTTOM,
    borderRadius: 3,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 8,
  },
  polaroidPhoto: { width: PHOTO_SIZE, height: PHOTO_SIZE, borderRadius: 1 },
  progressTrack: { position: 'absolute', top: 0, left: 0, right: 0, height: 2, backgroundColor: 'rgba(255,255,255,0.15)' },
  progressFill: { height: 2, backgroundColor: '#fff' },
  pausedWrap: { position: 'absolute', top: SH / 2 - 12, left: 0, right: 0, alignItems: 'center' },
  pausedText: { color: 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: '700', letterSpacing: 3 },
  closeBtn: { position: 'absolute', top: 50, right: 16, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
