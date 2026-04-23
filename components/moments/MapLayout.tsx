import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Image,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  LinearGradient,
  Path,
  Polygon,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import { useTheme } from '@/constants/ThemeContext';
import { Avatar } from './Avatar';
import type { MomentDisplay, PeopleMap } from './types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface MapLayoutProps {
  items: MomentDisplay[];
  onOpen: (moment: MomentDisplay) => void;
  people: PeopleMap;
}

// ---------------------------------------------------------------------------
// GPS -> map-percentage conversion
// ---------------------------------------------------------------------------

const BOUNDS = {
  north: 11.99,
  south: 11.95,
  west: 121.915,
  east: 121.935,
};

function gpsToMapPos(lat: number, lng: number): { x: number; y: number } {
  const x = 38 + ((lng - BOUNDS.west) / (BOUNDS.east - BOUNDS.west)) * 32;
  const y = 10 + ((BOUNDS.north - lat) / (BOUNDS.north - BOUNDS.south)) * 84;
  return {
    x: Math.max(20, Math.min(80, x)),
    y: Math.max(8, Math.min(95, y)),
  };
}

// Fallback positions by location name keywords (matching prototype posByImg)
const FALLBACK_POSITIONS: Record<string, { x: number; y: number }> = {
  puka: { x: 55, y: 16 },
  'mt. luho': { x: 62, y: 28 },
  'mt luho': { x: 62, y: 28 },
  luho: { x: 62, y: 28 },
  diniwid: { x: 44, y: 40 },
  crystal: { x: 70, y: 36 },
  ariel: { x: 34, y: 46 },
  nonie: { x: 54, y: 48 },
  canyon: { x: 56, y: 52 },
  "d'mall": { x: 50, y: 54 },
  dmall: { x: 50, y: 54 },
  'station 2': { x: 46, y: 60 },
  willy: { x: 44, y: 66 },
  mandala: { x: 58, y: 62 },
  'station 1': { x: 45, y: 82 },
  'white beach': { x: 46, y: 60 },
};

function positionOf(m: MomentDisplay): { x: number; y: number } {
  const moment = m as MomentDisplay & { latitude?: number; longitude?: number };
  if (moment.latitude && moment.longitude) {
    return gpsToMapPos(moment.latitude, moment.longitude);
  }
  const loc = (m.place ?? m.location ?? '').toLowerCase();
  for (const [key, pos] of Object.entries(FALLBACK_POSITIONS)) {
    if (loc.includes(key)) return pos;
  }
  return { x: 50, y: 50 };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseHour(t?: string): number {
  if (!t) return 0;
  const match = t.match(/(\d+):?(\d*)\s*(am|pm)?/i);
  if (!match) return 0;
  let h = parseInt(match[1], 10);
  const min = match[2] ? parseInt(match[2], 10) : 0;
  const ampm = match[3]?.toLowerCase();
  if (ampm === 'pm' && h < 12) h += 12;
  if (ampm === 'am' && h === 12) h = 0;
  return h * 60 + min;
}

const HOME = { x: 55, y: 52 };

// ---------------------------------------------------------------------------
// Area labels — matching prototype positions verbatim
// ---------------------------------------------------------------------------

const AREA_LABELS = [
  { label: 'Puka Beach', x: 76, y: 15, align: 'left' as const },
  { label: 'Mt. Luho', x: 75, y: 28, align: 'left' as const },
  { label: 'Diniwid', x: 27, y: 40, align: 'right' as const },
  { label: 'Station 2', x: 76, y: 52, align: 'left' as const },
  { label: 'Station 1', x: 24, y: 82, align: 'right' as const },
  { label: 'Crystal Cove', x: 78, y: 38, align: 'left' as const },
  { label: "Ariel's Pt.", x: 24, y: 48, align: 'right' as const },
];

// ---------------------------------------------------------------------------
// Island SVG path — verbatim from prototype
// ---------------------------------------------------------------------------

const ISLAND_PATH =
  'M 52 10 Q 62 11 64 18 Q 66 24 62 28 Q 60 32 64 34 Q 68 38 66 44 Q 64 48 58 50 Q 54 52 54 56 Q 56 62 54 68 Q 52 74 56 80 Q 60 86 58 90 Q 54 94 48 92 Q 42 88 42 82 Q 44 74 42 68 Q 40 62 44 56 Q 46 52 42 50 Q 36 48 38 42 Q 42 36 44 32 Q 46 28 42 24 Q 40 18 44 14 Q 48 10 52 10 Z';

// ---------------------------------------------------------------------------
// Animated Pin
// ---------------------------------------------------------------------------

interface PinProps {
  cluster: { x: number; y: number; items: MomentDisplay[] };
  isRevealed: boolean;
  isCurrent: boolean;
  authorColor: string;
  onPress: () => void;
  people: PeopleMap;
}

function AnimatedPin({ cluster, isRevealed, isCurrent, authorColor, onPress, people }: PinProps) {
  const { colors } = useTheme();
  const anim = useRef(new Animated.Value(isRevealed ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(anim, {
      toValue: isRevealed ? 1 : 0,
      friction: 6,
      tension: 80,
      useNativeDriver: true,
    }).start();
  }, [isRevealed, anim]);

  const opacity = anim;
  const scale = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.5, 1],
  });

  const stackSize = cluster.items.length;
  const primary = cluster.items[0];
  const photoUri = primary.photo;

  return (
    <Animated.View
      style={[
        styles.pinContainer,
        {
          left: `${cluster.x}%` as unknown as number,
          top: `${cluster.y}%` as unknown as number,
          opacity,
          transform: [{ scale }],
          zIndex: isCurrent ? 20 : 10,
        },
      ]}
    >
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.85}
        style={styles.pinTouchable}
      >
        {/* Stacked back tiles */}
        <View style={styles.pinPhotoWrapper}>
          {stackSize > 2 && (
            <View
              style={[
                styles.stackTile,
                {
                  transform: [
                    { translateX: -3 },
                    { translateY: -2 },
                    { rotate: '-5deg' },
                  ],
                },
              ]}
            />
          )}
          {stackSize > 1 && (
            <View
              style={[
                styles.stackTile,
                {
                  transform: [
                    { translateX: 4 },
                    { translateY: -3 },
                    { rotate: '4deg' },
                  ],
                },
              ]}
            />
          )}
          {/* Primary photo tile */}
          <View
            style={[
              styles.primaryTile,
              {
                borderColor: '#fff',
                ...(isCurrent
                  ? {
                      shadowColor: authorColor,
                      shadowOffset: { width: 0, height: 0 },
                      shadowOpacity: 0.8,
                      shadowRadius: 6,
                      elevation: 8,
                    }
                  : {
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.22,
                      shadowRadius: 4,
                      elevation: 4,
                    }),
              },
            ]}
          >
            {photoUri ? (
              <Image
                source={{ uri: photoUri }}
                style={styles.pinPhoto}
                resizeMode="cover"
              />
            ) : (
              <View
                style={[styles.pinPhoto, { backgroundColor: colors.card2 }]}
              />
            )}
          </View>
          {/* Count badge */}
          {stackSize > 1 && (
            <View
              style={[
                styles.countBadge,
                { backgroundColor: authorColor, borderColor: '#fff' },
              ]}
            >
              <Text style={styles.countBadgeText}>+{stackSize - 1}</Text>
            </View>
          )}
        </View>
        {/* Pin tail */}
        <Svg width={10} height={8} viewBox="0 0 10 8" style={styles.pinTail}>
          <Path d="M 0 0 L 10 0 L 5 8 Z" fill="#fff" />
        </Svg>
        {/* Anchor dot */}
        <View
          style={[
            styles.anchorDot,
            {
              backgroundColor: authorColor,
              borderColor: '#fff',
            },
          ]}
        />
      </TouchableOpacity>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Custom Slider
// ---------------------------------------------------------------------------

interface CustomSliderProps {
  value: number;
  max: number;
  onValueChange: (v: number) => void;
  accentColor: string;
  trackColor: string;
}

function CustomSlider({ value, max, onValueChange, accentColor, trackColor }: CustomSliderProps) {
  const trackWidth = useRef(0);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const x = evt.nativeEvent.locationX;
        const ratio = Math.max(0, Math.min(1, x / trackWidth.current));
        onValueChange(Math.round(ratio * max));
      },
      onPanResponderMove: (evt) => {
        const x = evt.nativeEvent.locationX;
        const ratio = Math.max(0, Math.min(1, x / trackWidth.current));
        onValueChange(Math.round(ratio * max));
      },
    }),
  ).current;

  const fraction = max > 0 ? value / max : 0;

  return (
    <View
      onLayout={(e) => {
        trackWidth.current = e.nativeEvent.layout.width;
      }}
      style={[styles.sliderTrack, { backgroundColor: trackColor }]}
      {...panResponder.panHandlers}
    >
      <View
        style={[
          styles.sliderFill,
          { width: `${fraction * 100}%` as unknown as number, backgroundColor: accentColor },
        ]}
      />
      <View
        style={[
          styles.sliderThumb,
          {
            left: `${fraction * 100}%` as unknown as number,
            backgroundColor: accentColor,
          },
        ]}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// MapLayout
// ---------------------------------------------------------------------------

export function MapLayout({ items, onOpen, people }: MapLayoutProps) {
  const { colors } = useTheme();

  // Sort chronologically
  const ordered = useMemo(() => {
    const dayOrder: Record<string, number> = {};
    items.forEach((m) => {
      if (dayOrder[m.date] == null) dayOrder[m.date] = Object.keys(dayOrder).length;
    });
    return [...items].sort((a, b) => {
      const d = (dayOrder[a.date] ?? 0) - (dayOrder[b.date] ?? 0);
      if (d !== 0) return d;
      return 0;
    });
  }, [items]);

  // Scrubber state
  const [cursor, setCursor] = useState(ordered.length);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    setCursor(ordered.length);
  }, [ordered.length]);

  useEffect(() => {
    if (!playing) return;
    if (cursor >= ordered.length) {
      setCursor(0);
      return;
    }
    const id = setTimeout(() => {
      setCursor((c) => {
        if (c >= ordered.length) {
          setPlaying(false);
          return c;
        }
        return c + 1;
      });
    }, 520);
    return () => clearTimeout(id);
  }, [playing, cursor, ordered.length]);

  const revealed = ordered.slice(0, cursor);
  const current = revealed[revealed.length - 1];

  // SVG route path
  const pathD = useMemo(() => {
    if (revealed.length === 0) return '';
    const pts = [HOME, ...revealed.map(positionOf)];
    return pts
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
      .join(' ');
  }, [revealed]);

  // Cluster nearby pins
  const clusters = useMemo(() => {
    const out: { x: number; y: number; items: MomentDisplay[] }[] = [];
    ordered.forEach((m) => {
      const p = positionOf(m);
      const nearIdx = out.findIndex((c) => {
        const dx = c.x - p.x;
        const dy = c.y - p.y;
        return dx * dx + dy * dy < 36;
      });
      if (nearIdx >= 0) {
        out[nearIdx].items.push(m);
      } else {
        out.push({ x: p.x, y: p.y, items: [m] });
      }
    });
    return out;
  }, [ordered]);

  const handlePlay = useCallback(() => {
    if (cursor >= ordered.length) setCursor(0);
    setPlaying((p) => !p);
  }, [cursor, ordered.length]);

  const handleSliderChange = useCallback((v: number) => {
    setPlaying(false);
    setCursor(v);
  }, []);

  const currentAuthorKey = current?.authorKey ?? current?.takenBy ?? '';
  const currentAuthorColor = people[currentAuthorKey]?.color ?? colors.accent;

  return (
    <View style={styles.wrapper}>
      {/* Map card */}
      <View
        style={[
          styles.mapCard,
          {
            borderColor: colors.border,
            borderWidth: 1,
            backgroundColor: colors.bg,
          },
        ]}
      >
        {/* Water background layer */}
        <View style={styles.waterLayer} />

        {/* Island SVG */}
        <Svg
          viewBox="0 0 100 140"
          preserveAspectRatio="none"
          style={styles.svgLayer}
        >
          <Defs>
            <LinearGradient id="land-fill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#d9c099" stopOpacity={0.85} />
              <Stop offset="0.5" stopColor="#c9a877" stopOpacity={0.85} />
              <Stop offset="1" stopColor="#b89160" stopOpacity={0.85} />
            </LinearGradient>
            <RadialGradient id="land-veg" cx="50%" cy="45%" r="60%">
              <Stop offset="0" stopColor="#7a9a6a" stopOpacity={0.45} />
              <Stop offset="0.7" stopColor="#7a9a6a" stopOpacity={0.12} />
              <Stop offset="1" stopColor="#7a9a6a" stopOpacity={0} />
            </RadialGradient>
          </Defs>

          {/* Coast ripple rings */}
          <Ellipse
            cx={50} cy={70} rx={42} ry={62}
            fill="none" stroke="rgba(120,180,200,0.12)" strokeWidth={0.25}
          />
          <Ellipse
            cx={50} cy={70} rx={38} ry={58}
            fill="none" stroke="rgba(120,180,200,0.08)" strokeWidth={0.25}
          />

          {/* Island silhouette */}
          <Path
            d={ISLAND_PATH}
            fill="url(#land-fill)"
            stroke="rgba(170, 130, 80, 0.5)"
            strokeWidth={0.25}
          />
          {/* Vegetation overlay */}
          <Path d={ISLAND_PATH} fill="url(#land-veg)" />

          {/* White Beach west coast strip */}
          <Path
            d="M 44 56 Q 42 66 42 78 Q 44 86 47 90"
            fill="none" stroke="#fff1d4" strokeWidth={1.1}
            strokeLinecap="round" opacity={0.6}
          />
          {/* Puka Beach north strip */}
          <Path
            d="M 48 12 Q 54 11 60 14"
            fill="none" stroke="#fff1d4" strokeWidth={1.1}
            strokeLinecap="round" opacity={0.55}
          />

          {/* Willy's Rock offshore */}
          <Circle cx={44} cy={64} r={0.6} fill="rgba(170, 130, 80, 0.7)" />
          <Circle cx={43.6} cy={64.3} r={0.4} fill="rgba(170, 130, 80, 0.5)" />

          {/* Crystal Cove offshore east */}
          <Ellipse
            cx={69} cy={36} rx={2} ry={1.3}
            fill="url(#land-fill)" stroke="rgba(170,130,80,0.4)" strokeWidth={0.15}
          />
          {/* Ariel's Point offshore west */}
          <Ellipse
            cx={34} cy={46} rx={1.8} ry={1.2}
            fill="url(#land-fill)" stroke="rgba(170,130,80,0.4)" strokeWidth={0.15}
          />

          {/* Dashed route path */}
          {pathD !== '' && (
            <Path
              d={pathD}
              fill="none"
              stroke={colors.accent}
              strokeWidth={0.5}
              strokeDasharray="1.2,1"
              strokeLinecap="round"
              opacity={0.85}
            />
          )}
        </Svg>

        {/* Compass chip — top left */}
        <View
          style={[
            styles.compassChip,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderWidth: 1,
            },
          ]}
        >
          <Svg width={9} height={9} viewBox="0 0 24 24" fill="none">
            <Path
              d="M12 22s-8-7.5-8-13a8 8 0 1116 0c0 5.5-8 13-8 13z"
              stroke={colors.text2}
              strokeWidth={2.2}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
            <Circle cx={12} cy={9} r={2.5} stroke={colors.text2} strokeWidth={2.2} fill="none" />
          </Svg>
          <Text style={[styles.compassText, { color: colors.text2 }]}>
            BORACAY {'\u00B7'} {items.length}
          </Text>
        </View>

        {/* North indicator — top right */}
        <View
          style={[
            styles.northIndicator,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderWidth: 1,
            },
          ]}
        >
          <Text style={[styles.northArrow, { color: colors.accent }]}>{'\u25B2'}</Text>
          <Text style={[styles.northLetter, { color: colors.text2 }]}>N</Text>
        </View>

        {/* Area labels */}
        {AREA_LABELS.map((l) => (
          <View
            key={l.label}
            style={[
              styles.areaLabel,
              {
                left: `${l.x}%` as unknown as number,
                top: `${l.y}%` as unknown as number,
              },
              l.align === 'right' ? styles.areaLabelRight : styles.areaLabelLeft,
            ]}
          >
            {l.align === 'left' && (
              <View style={[styles.labelLine, { backgroundColor: colors.text3 }]} />
            )}
            <Text style={[styles.areaLabelText, { color: colors.text3 }]}>
              {l.label}
            </Text>
            {l.align === 'right' && (
              <View style={[styles.labelLine, { backgroundColor: colors.text3 }]} />
            )}
          </View>
        ))}

        {/* Home base marker */}
        <View
          style={[
            styles.homeBase,
            {
              left: `${HOME.x}%` as unknown as number,
              top: `${HOME.y}%` as unknown as number,
            },
          ]}
        >
          <View
            style={[
              styles.homeDiamond,
              {
                backgroundColor: colors.accent,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.18,
                shadowRadius: 8,
                elevation: 4,
              },
            ]}
          >
            <Svg
              width={10}
              height={10}
              viewBox="0 0 24 24"
              style={{ transform: [{ rotate: '-45deg' }] }}
            >
              <Path
                d="M12 3 L3 11 L5 11 L5 20 L10 20 L10 14 L14 14 L14 20 L19 20 L19 11 L21 11 Z"
                fill={colors.onBlack}
              />
            </Svg>
          </View>
        </View>

        {/* Photo pins */}
        {clusters.map((cluster, cIdx) => {
          const primary = cluster.items[0];
          const primaryIdx = ordered.indexOf(primary);
          const isRevealed = primaryIdx < cursor;
          const isCurrent = primaryIdx === cursor - 1;
          const authorKey = primary.authorKey ?? primary.takenBy ?? '';
          const authorColor = people[authorKey]?.color ?? colors.accent;

          return (
            <AnimatedPin
              key={cIdx}
              cluster={cluster}
              isRevealed={isRevealed}
              isCurrent={isCurrent}
              authorColor={authorColor}
              onPress={() => onOpen(primary)}
              people={people}
            />
          );
        })}

        {/* Current-moment caption card */}
        {current && (
          <View
            style={[
              styles.captionCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderWidth: 1,
                borderLeftColor: currentAuthorColor,
                borderLeftWidth: 3,
              },
            ]}
          >
            <Text
              style={[styles.captionPlace, { color: colors.text }]}
              numberOfLines={1}
            >
              {current.place ?? current.location ?? ''}
            </Text>
            <Text style={[styles.captionDate, { color: colors.text3 }]}>
              {current.date}
                          </Text>
          </View>
        )}

        {/* Scrubber bar */}
        <View
          style={[
            styles.scrubberBar,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderWidth: 1,
            },
          ]}
        >
          <TouchableOpacity
            onPress={handlePlay}
            activeOpacity={0.8}
            style={[styles.playButton, { backgroundColor: colors.accent }]}
            accessibilityLabel={playing ? 'Pause' : 'Play'}
            accessibilityRole="button"
          >
            {playing ? (
              <Svg width={10} height={10} viewBox="0 0 24 24">
                <Rect x={6} y={5} width={4} height={14} rx={1} fill={colors.onBlack} />
                <Rect x={14} y={5} width={4} height={14} rx={1} fill={colors.onBlack} />
              </Svg>
            ) : (
              <Svg width={10} height={10} viewBox="0 0 24 24">
                <Polygon points="6,4 20,12 6,20" fill={colors.onBlack} />
              </Svg>
            )}
          </TouchableOpacity>

          <View style={styles.sliderContainer}>
            <CustomSlider
              value={cursor}
              max={ordered.length}
              onValueChange={handleSliderChange}
              accentColor={colors.accent}
              trackColor={colors.border}
            />
          </View>

          <Text style={[styles.counterText, { color: colors.text2 }]}>
            {cursor}/{ordered.length}
          </Text>
        </View>
      </View>

      {/* Chronological list below map */}
      <View style={styles.listContainer}>
        {ordered.map((m, i) => {
          const isRevealed = i < cursor;
          const authorKey = m.authorKey ?? m.takenBy ?? '';
          const authorColor = people[authorKey]?.color ?? colors.accent;

          return (
            <TouchableOpacity
              key={`${m.id}-${i}`}
              onPress={() => onOpen(m)}
              activeOpacity={0.8}
              style={[
                styles.listRow,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  borderWidth: 1,
                  borderLeftColor: authorColor,
                  borderLeftWidth: 3,
                  opacity: isRevealed ? 1 : 0.38,
                },
              ]}
            >
              <View
                style={[
                  styles.listThumb,
                  { borderColor: colors.border, borderWidth: 1 },
                ]}
              >
                {m.photo ? (
                  <Image
                    source={{ uri: m.photo }}
                    style={[
                      styles.listThumbImage,
                      !isRevealed && styles.listThumbGrayscale,
                    ]}
                    resizeMode="cover"
                  />
                ) : (
                  <View
                    style={[
                      styles.listThumbImage,
                      { backgroundColor: colors.card2 },
                    ]}
                  />
                )}
              </View>
              <View style={styles.listTextContainer}>
                <Text
                  style={[styles.listPlace, { color: colors.text }]}
                  numberOfLines={1}
                >
                  {m.place ?? m.location ?? ''}
                </Text>
                <Text style={[styles.listDate, { color: colors.text3 }]}>
                  {m.date}
                                  </Text>
              </View>
              <Avatar authorKey={authorKey} people={people} size={20} />
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 16,
  },
  mapCard: {
    position: 'relative',
    aspectRatio: 3 / 4,
    borderRadius: 18,
    overflow: 'hidden',
  },
  waterLayer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(120,180,200,0.06)',
  },
  svgLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },

  // Compass chip
  compassChip: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 99,
  },
  compassText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },

  // North indicator
  northIndicator: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 26,
    height: 26,
    borderRadius: 99,
    alignItems: 'center',
    justifyContent: 'center',
  },
  northArrow: {
    fontSize: 7,
    marginBottom: -2,
  },
  northLetter: {
    fontSize: 8,
    fontWeight: '700',
    lineHeight: 10,
  },

  // Area labels
  areaLabel: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    opacity: 0.6,
  },
  areaLabelLeft: {
    transform: [{ translateY: -6 }],
  },
  areaLabelRight: {
    transform: [{ translateX: -4 }, { translateY: -6 }],
  },
  areaLabelText: {
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  labelLine: {
    width: 8,
    height: 1,
    opacity: 0.5,
  },

  // Home base
  homeBase: {
    position: 'absolute',
    transform: [{ translateX: -9 }, { translateY: -9 }],
    zIndex: 5,
  },
  homeDiamond: {
    width: 18,
    height: 18,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '45deg' }],
  },

  // Pin
  pinContainer: {
    position: 'absolute',
    transform: [{ translateX: -18 }, { translateY: -52 }],
  },
  pinTouchable: {
    alignItems: 'center',
  },
  pinPhotoWrapper: {
    width: 36,
    height: 36,
    position: 'relative',
  },
  stackTile: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 10,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 3,
  },
  primaryTile: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 10,
    borderWidth: 2,
    overflow: 'hidden',
  },
  pinPhoto: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  countBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 99,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#0b0f14',
  },
  pinTail: {
    marginTop: -1,
  },
  anchorDot: {
    width: 6,
    height: 6,
    borderRadius: 99,
    borderWidth: 1.5,
    marginTop: -2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 2,
  },

  // Caption card
  captionCard: {
    position: 'absolute',
    left: 12,
    bottom: 56,
    maxWidth: '62%',
    borderRadius: 10,
    paddingVertical: 7,
    paddingHorizontal: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 4,
  },
  captionPlace: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  captionDate: {
    fontSize: 9,
    fontWeight: '600',
    marginTop: 1,
  },

  // Scrubber
  scrubberBar: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    paddingLeft: 6,
    paddingRight: 10,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 4,
  },
  playButton: {
    width: 26,
    height: 26,
    borderRadius: 99,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sliderContainer: {
    flex: 1,
    justifyContent: 'center',
    height: 26,
  },
  sliderTrack: {
    height: 3,
    borderRadius: 1.5,
    justifyContent: 'center',
  },
  sliderFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 1.5,
  },
  sliderThumb: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    marginLeft: -6,
    marginTop: -4.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 2,
    elevation: 3,
  },
  counterText: {
    fontSize: 10,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    minWidth: 32,
    textAlign: 'right',
    fontFamily: 'SpaceMono',
  },

  // Chronological list
  listContainer: {
    marginTop: 14,
    gap: 6,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  listThumb: {
    width: 40,
    height: 40,
    borderRadius: 8,
    overflow: 'hidden',
  },
  listThumbImage: {
    width: '100%',
    height: '100%',
  },
  listThumbGrayscale: {
    opacity: 0.5,
  },
  listTextContainer: {
    flex: 1,
    minWidth: 0,
  },
  listPlace: {
    fontSize: 12,
    fontWeight: '600',
  },
  listDate: {
    fontSize: 10.5,
    marginTop: 1,
  },
});
