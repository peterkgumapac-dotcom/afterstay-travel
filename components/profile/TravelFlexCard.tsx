import { Globe2, Moon, Plane, WalletCards } from 'lucide-react-native';
import React, { useEffect, useMemo } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Ellipse, Path, Text as SvgText } from 'react-native-svg';

import { lightColors, useTheme } from '@/constants/ThemeContext';
import {
  formatTravelFlexSpent,
  visibleTravelFlexFlags,
  type TravelFlexAnimationMode,
  type TravelFlexRoute,
  type TravelFlexTemplate,
  type TravelFlexVisual,
} from '@/lib/profileTravelVisual';

interface TravelFlexCardProps {
  visual: TravelFlexVisual;
}

type Point = {
  id: string;
  x: number;
  y: number;
  label: string;
  flag?: string;
};

const VIEW_W = 360;
const VIEW_H = 190;

const TEMPLATE_POINTS: Record<TravelFlexTemplate, Point[]> = {
  empty: [],
  first_place: [
    { id: 'home', x: 50, y: 112, label: 'HOME' },
    { id: 'one', x: 296, y: 130, label: 'FIRST' },
  ],
  local_explorer: [
    { id: 'home', x: 48, y: 118, label: 'HOME' },
    { id: 'local-1', x: 118, y: 84, label: 'STOP 1' },
    { id: 'local-2', x: 208, y: 124, label: 'STOP 2' },
    { id: 'local-3', x: 304, y: 82, label: 'STOP 3' },
  ],
  first_abroad: [
    { id: 'home', x: 52, y: 116, label: 'HOME' },
    { id: 'abroad', x: 298, y: 80, label: 'ABROAD' },
  ],
  regional_traveler: [
    { id: 'home', x: 54, y: 104, label: 'HOME' },
    { id: 'r1', x: 116, y: 72, label: '1' },
    { id: 'r2', x: 190, y: 132, label: '2' },
    { id: 'r3', x: 260, y: 64, label: '3' },
    { id: 'r4', x: 314, y: 124, label: '4' },
  ],
  global_flex: [
    { id: 'home', x: 54, y: 112, label: 'HOME' },
    { id: 'g1', x: 98, y: 58, label: '1' },
    { id: 'g2', x: 162, y: 132, label: '2' },
    { id: 'g3', x: 222, y: 72, label: '3' },
    { id: 'g4', x: 302, y: 50, label: '4' },
    { id: 'g5', x: 318, y: 140, label: '5' },
  ],
};

function routePath(from: Point, to: Point, mode: TravelFlexAnimationMode) {
  const midX = (from.x + to.x) / 2;
  const arc = mode === 'local_hops' ? -26 : mode === 'route_constellation' ? -54 : -42;
  const midY = Math.min(from.y, to.y) + arc;
  return `M ${from.x} ${from.y} Q ${midX} ${midY} ${to.x} ${to.y}`;
}

function templateTitle(template: TravelFlexTemplate) {
  switch (template) {
    case 'empty':
      return 'Travel starts here';
    case 'first_place':
      return 'First place unlocked';
    case 'local_explorer':
      return 'Local explorer trail';
    case 'first_abroad':
      return 'First abroad arc';
    case 'regional_traveler':
      return 'Regional travel flex';
    case 'global_flex':
      return 'Global flex route';
    default:
      return 'Travel flex';
  }
}

function labelForRoute(route: TravelFlexRoute, index: number) {
  return route.toCode || route.toLabel || `${index + 1}`;
}

function buildPoints(visual: TravelFlexVisual): Point[] {
  if (visual.template === 'empty') return [];
  const seed = TEMPLATE_POINTS[visual.template];
  const home = {
    ...seed[0],
    label: visual.home.code || 'HOME',
    flag: visual.home.flag,
  };
  const routePoints = visual.routes.slice(0, seed.length - 1).map((route, index) => ({
    ...seed[index + 1],
    label: labelForRoute(route, index),
    flag: visibleTravelFlexFlags(visual.flags, 8).visible[index]?.flag,
  }));
  const placePoints = visual.routes.length === 0
    ? visual.places.slice(0, seed.length - 1).map((place, index) => ({
      ...seed[index + 1],
      label: place.countryCode || place.label,
      flag: place.flag,
    }))
    : [];
  const fallbackFlags = visual.flags.slice(0, seed.length - 1).map((flag, index) => ({
    ...seed[index + 1],
    label: flag.countryCode,
    flag: flag.flag,
  }));
  const destinations = routePoints.length > 0 ? routePoints : placePoints.length > 0 ? placePoints : fallbackFlags;
  return [home, ...destinations].slice(0, seed.length);
}

export default function TravelFlexCard({ visual }: TravelFlexCardProps) {
  const { width } = useWindowDimensions();
  const colors = lightColors;
  const s = getStyles(colors, width);
  const progress = useSharedValue(0);
  const points = useMemo(() => buildPoints(visual), [visual]);
  const routePoints = points.length > 1 ? points : TEMPLATE_POINTS.first_place;
  const flagRow = visibleTravelFlexFlags(visual.flags, visual.template === 'global_flex' ? 5 : 6);
  const hasTravel = visual.template !== 'empty' && (visual.counts.trips > 0 || visual.counts.places > 0 || visual.counts.countries > 0);
  const routeSegments = points.slice(1).map((point, index) => ({
    from: visual.animationMode === 'local_hops' && index > 0 ? points[index] : points[0],
    to: point,
    active: visual.template !== 'global_flex' || index >= Math.max(0, points.length - 3),
  }));
  const planeInput = routePoints.map((_, index) => index / Math.max(1, routePoints.length - 1));
  const planeX = routePoints.map((point) => point.x - 10);
  const planeY = routePoints.map((point) => point.y - 10);

  const planeStyle = useAnimatedStyle(() => {
    const x = interpolate(progress.value, planeInput, planeX);
    const y = interpolate(progress.value, planeInput, planeY);
    return {
      transform: [
        { translateX: x },
        { translateY: y },
        { rotate: visual.animationMode === 'local_hops' ? '-8deg' : '18deg' },
      ],
      opacity: hasTravel ? 1 : 0,
    };
  }, [hasTravel, planeInput, planeX, planeY, visual.animationMode]);

  useEffect(() => {
    progress.value = 0;
    if (!hasTravel) return;
    progress.value = withRepeat(
      withTiming(1, {
        duration: visual.animationMode === 'route_constellation' ? 5200 : 3800,
        easing: Easing.inOut(Easing.cubic),
      }),
      -1,
      false,
    );
  }, [hasTravel, progress, visual.animationMode]);

  return (
    <View style={s.card}>
      <View style={s.head}>
        <View>
          <Text style={s.kicker}>Travel Flex · Since {visual.since ?? 'now'}</Text>
          <View style={s.distanceRow}>
            <Text style={s.distance}>{Math.round(visual.counts.km).toLocaleString()}</Text>
            <Text style={s.distanceUnit}>km traveled</Text>
          </View>
        </View>
        <Text style={s.templatePill}>{templateTitle(visual.template)}</Text>
      </View>

      <View style={s.map}>
        <Svg width="100%" height="100%" viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}>
          <Ellipse cx={110} cy={116} rx={82} ry={36} fill={colors.accentBg} opacity={0.38} />
          <Ellipse cx={250} cy={104} rx={92} ry={42} fill={colors.accentBg} opacity={0.28} />
          <Ellipse cx={204} cy={154} rx={54} ry={24} fill={colors.accentBg} opacity={0.3} />
          <Path
            d="M24 86 C82 44 128 62 174 92 C222 124 270 58 338 92 M44 162 C96 128 152 150 194 138 C244 122 286 162 334 134"
            fill="none"
            stroke={colors.border2}
            strokeWidth={1}
            strokeDasharray="5 9"
            strokeLinecap="round"
          />
          {routeSegments.map((segment, index) => (
            <Path
              key={`${segment.from.id}-${segment.to.id}-${index}`}
              d={routePath(segment.from, segment.to, visual.animationMode)}
              fill="none"
              stroke={colors.accent}
              strokeWidth={segment.active ? 1.7 : 0.9}
              strokeDasharray={visual.animationMode === 'single_arc' ? undefined : '6 6'}
              strokeLinecap="round"
              opacity={segment.active ? 0.94 : 0.24}
            />
          ))}
          {points.map((point, index) => (
            <React.Fragment key={point.id}>
              <Circle
                cx={point.x}
                cy={point.y}
                r={index === 0 ? 7 : 6}
                fill={index === 0 ? colors.accent : colors.text}
                opacity={hasTravel || index === 0 ? 1 : 0.4}
              />
              <Circle cx={point.x} cy={point.y} r={index === 0 ? 3 : 0} fill={colors.canvas} />
              <SvgText
                x={point.x}
                y={point.y + 22}
                fontSize={8}
                fontWeight="700"
                fill={colors.text3}
                textAnchor="middle"
              >
                {index === 0 ? 'HOME' : point.label}
              </SvgText>
            </React.Fragment>
          ))}
        </Svg>

        {points.map((point, index) => (
          point.flag && index > 0 ? (
            <Text key={`flag-${point.id}`} style={[s.mapFlag, { left: point.x - 4, top: point.y + 18 }]}>
              {point.flag}
            </Text>
          ) : null
        ))}

        {hasTravel ? (
          <Animated.View style={[s.plane, planeStyle]}>
            <Plane size={18} color={colors.accent} strokeWidth={2.3} />
          </Animated.View>
        ) : (
          <View style={s.emptyCallout}>
            <Plane size={15} color={colors.accent} strokeWidth={2} />
            <Text style={s.emptyText}>Add trips to light up your map</Text>
          </View>
        )}
      </View>

      <View style={s.flagRow}>
        {flagRow.visible.length > 0 ? flagRow.visible.map((flag) => (
          <View key={flag.countryCode} style={s.flagChip}>
            <Text style={s.flagEmoji}>{flag.flag}</Text>
            <Text style={s.flagText} numberOfLines={1}>{flag.countryCode}</Text>
          </View>
        )) : (
          <Text style={s.flagHint}>Flags appear as trips become public or shared.</Text>
        )}
        {flagRow.extraCount > 0 ? (
          <View style={s.flagChip}>
            <Text style={s.flagMore}>+{flagRow.extraCount}</Text>
          </View>
        ) : null}
      </View>

      <View style={s.footer}>
        <View style={s.fcell}>
          <Plane size={16} color={colors.accent} />
          <Text style={s.fvalue}>{visual.counts.trips}</Text>
          <Text style={s.flabel}>Trips</Text>
        </View>
        <View style={s.fcell}>
          <Globe2 size={16} color={colors.accent} strokeWidth={1.8} />
          <Text style={s.fvalue}>{visual.counts.countries}</Text>
          <Text style={s.flabel}>Countries</Text>
        </View>
        <View style={s.fcell}>
          <Moon size={16} color={colors.accent} />
          <Text style={s.fvalue}>{visual.counts.nights}</Text>
          <Text style={s.flabel}>Nights</Text>
        </View>
        <View style={[s.fcell, s.lastCell]}>
          <WalletCards size={16} color={colors.accent} />
          <Text style={s.fvalue}>{formatTravelFlexSpent(visual.counts.spent)}</Text>
          <Text style={s.flabel}>Spent</Text>
        </View>
      </View>
    </View>
  );
}

const getStyles = (colors: ReturnType<typeof useTheme>['colors'], width: number) => StyleSheet.create({
  card: {
    marginHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    overflow: 'hidden',
  },
  head: {
    minHeight: 76,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  kicker: {
    color: colors.accent,
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  distanceRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 7,
    marginTop: 6,
  },
  distance: {
    color: colors.text,
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 0,
  },
  distanceUnit: {
    color: colors.text2,
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 7,
  },
  templatePill: {
    alignSelf: 'flex-start',
    maxWidth: width < 380 ? 116 : 146,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    color: colors.text2,
    fontSize: 10,
    fontWeight: '800',
    overflow: 'hidden',
  },
  map: {
    height: 172,
    position: 'relative',
  },
  plane: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(253,248,235,0.82)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#4b2d13',
    shadowOpacity: 0.16,
    shadowRadius: 7,
    elevation: 3,
  },
  mapFlag: {
    position: 'absolute',
    fontSize: 16,
  },
  emptyCallout: {
    position: 'absolute',
    left: 22,
    right: 22,
    bottom: 20,
    minHeight: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border2,
    backgroundColor: 'rgba(253,248,235,0.72)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyText: {
    color: colors.text3,
    fontSize: 12,
    fontWeight: '800',
  },
  flagRow: {
    minHeight: 42,
    paddingHorizontal: 12,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  flagChip: {
    minWidth: 42,
    height: 32,
    paddingHorizontal: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.canvas,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  flagEmoji: {
    fontSize: 14,
  },
  flagText: {
    color: colors.text2,
    fontSize: 9,
    fontWeight: '900',
  },
  flagMore: {
    color: colors.text2,
    fontSize: 11,
    fontWeight: '900',
  },
  flagHint: {
    color: colors.text3,
    fontSize: 11,
    fontWeight: '700',
  },
  footer: {
    minHeight: 58,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: 'row',
  },
  fcell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
  lastCell: {
    borderRightWidth: 0,
  },
  fvalue: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  flabel: {
    color: colors.text3,
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
});
