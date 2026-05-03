import { Globe2, Moon, Plane, WalletCards } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Ellipse, Path, Text as SvgText } from 'react-native-svg';

import { lightColors, useTheme } from '@/constants/ThemeContext';
import {
  formatProfileCurrency,
  type ProfileMapCoordinate,
  type ProfileMapData,
} from '@/lib/profileStats';
import type { LifetimeStats } from '@/lib/types';

interface ProfileFlightMapCardProps {
  mapData: ProfileMapData;
  stats: LifetimeStats;
}

const VIEW_W = 360;
const VIEW_H = 210;
const PAD = 34;

function buildBounds(points: ProfileMapCoordinate[]) {
  const lats = points.map((point) => point.lat);
  const lngs = points.map((point) => point.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  return {
    minLat: minLat === maxLat ? minLat - 1 : minLat,
    maxLat: minLat === maxLat ? maxLat + 1 : maxLat,
    minLng: minLng === maxLng ? minLng - 1 : minLng,
    maxLng: minLng === maxLng ? maxLng + 1 : maxLng,
  };
}

function project(point: ProfileMapCoordinate, bounds: ReturnType<typeof buildBounds>) {
  const x = PAD + ((point.lng - bounds.minLng) / (bounds.maxLng - bounds.minLng)) * (VIEW_W - PAD * 2);
  const y = PAD + ((bounds.maxLat - point.lat) / (bounds.maxLat - bounds.minLat)) * (VIEW_H - PAD * 2);
  return { x, y };
}

function curvePath(from: { x: number; y: number }, to: { x: number; y: number }) {
  const cx = (from.x + to.x) / 2;
  const cy = Math.min(from.y, to.y) - 28;
  return `M ${from.x} ${from.y} Q ${cx} ${cy} ${to.x} ${to.y}`;
}

export default function ProfileFlightMapCard({ mapData, stats }: ProfileFlightMapCardProps) {
  const colors = lightColors;
  const s = getStyles(colors);
  const allPoints = [
    mapData.homeCoordinates,
    ...mapData.destinations,
    ...mapData.routes.flatMap((route) => [
      { lat: route.fromLat, lng: route.fromLng },
      { lat: route.toLat, lng: route.toLng },
    ]),
  ];
  const bounds = buildBounds(allPoints.length > 1 ? allPoints : [mapData.homeCoordinates, { lat: mapData.homeCoordinates.lat + 1, lng: mapData.homeCoordinates.lng + 1 }]);
  const home = project(mapData.homeCoordinates, bounds);
  const totalKm = mapData.totalKm || Math.round(stats.totalMiles * 1.60934);
  const hasMapData = mapData.routes.length > 0 || mapData.destinations.length > 0;
  const isEmptyProfile = !hasMapData && stats.totalTrips === 0 && stats.totalCountries === 0 && stats.totalNights === 0;

  return (
    <View style={[s.card, isEmptyProfile && s.compactCard]}>
      <View style={s.head}>
        <Text style={s.kicker}>Lifetime · Since {stats.earliestTripDate ? new Date(stats.earliestTripDate).getFullYear() : 'now'}</Text>
        <View style={s.distanceRow}>
          <Text style={s.distance}>{totalKm.toLocaleString()}</Text>
          <Text style={s.distanceUnit}>km traveled</Text>
        </View>
      </View>

      <View style={[s.mapWrap, isEmptyProfile && s.mapWrapCompact]}>
        <Svg width="100%" height={isEmptyProfile ? 136 : 210} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}>
          <Ellipse cx={104} cy={92} rx={70} ry={34} fill={colors.accentBg} opacity={0.45} />
          <Ellipse cx={238} cy={86} rx={92} ry={38} fill={colors.accentBg} opacity={0.36} />
          <Ellipse cx={210} cy={144} rx={48} ry={24} fill={colors.accentBg} opacity={0.32} />
          <Path
            d="M22 68 C82 28 128 48 168 78 C214 110 258 52 338 84 M38 148 C98 112 150 143 196 128 C242 114 282 150 334 124"
            fill="none"
            stroke={colors.border2}
            strokeWidth={1}
            strokeDasharray="4 7"
          />
          {mapData.routes.map((route) => {
            const from = project({ lat: route.fromLat, lng: route.fromLng }, bounds);
            const to = project({ lat: route.toLat, lng: route.toLng }, bounds);
            return (
              <Path
                key={route.flightId}
                d={curvePath(from, to)}
                fill="none"
                stroke={colors.accent}
                strokeWidth={1.3}
                strokeDasharray="5 5"
                strokeLinecap="round"
              />
            );
          })}
          {mapData.routes.length === 0 && mapData.destinations.map((destination) => {
            const point = project(destination, bounds);
            return (
              <Path
                key={`fallback-route-${destination.code}`}
                d={curvePath(home, point)}
                fill="none"
                stroke={colors.accent}
                strokeWidth={1}
                strokeDasharray="5 5"
                strokeLinecap="round"
              />
            );
          })}
          <Circle cx={home.x} cy={home.y} r={6} fill={colors.accent} />
          <Circle cx={home.x} cy={home.y} r={3} fill={colors.canvas} />
          <SvgText x={home.x} y={home.y + 20} fontSize={9} fill={colors.text3} textAnchor="middle">HOME</SvgText>
          {mapData.destinations.map((destination) => {
            const point = project(destination, bounds);
            return (
              <React.Fragment key={destination.code}>
                <Circle cx={point.x} cy={point.y} r={5} fill={colors.text} />
                <SvgText x={point.x} y={point.y - 12} fontSize={9} fill={colors.text3} textAnchor="middle">{destination.code}</SvgText>
              </React.Fragment>
            );
          })}
        </Svg>
        {mapData.destinations.map((destination) => {
          const point = project(destination, bounds);
          return destination.flag ? (
            <Text
              key={`flag-${destination.code}`}
              style={[s.flag, { left: point.x - 2, top: point.y + 6 }]}
            >
              {destination.flag}
            </Text>
          ) : null;
        })}
        {!hasMapData ? (
          <View style={[s.emptyMap, isEmptyProfile && s.emptyMapCompact]}>
            <Plane size={16} color={colors.accent} strokeWidth={1.8} />
            <Text style={s.emptyMapText}>
              {isEmptyProfile ? 'Add completed trips or flights to light up this map.' : 'Add flights to light up this map.'}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={s.footer}>
        <View style={s.fcell}>
          <Plane size={16} color={colors.accent} />
          <Text style={s.fvalue}>{stats.totalTrips}</Text>
          <Text style={s.flabel}>Trips</Text>
        </View>
        <View style={s.fcell}>
          <Globe2 size={16} color={colors.accent} strokeWidth={1.8} />
          <Text style={s.fvalue}>{stats.totalCountries}</Text>
          <Text style={s.flabel}>Countries</Text>
        </View>
        <View style={s.fcell}>
          <Moon size={16} color={colors.accent} />
          <Text style={s.fvalue}>{stats.totalNights}</Text>
          <Text style={s.flabel}>Nights</Text>
        </View>
        <View style={[s.fcell, s.lastCell]}>
          <WalletCards size={16} color={colors.accent} />
          <Text style={s.fvalue}>{formatProfileCurrency(stats.totalSpent)}</Text>
          <Text style={s.flabel}>Spent</Text>
        </View>
      </View>
    </View>
  );
}

const getStyles = (colors: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  card: {
    marginHorizontal: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    overflow: 'hidden',
  },
  compactCard: {
    borderRadius: 20,
  },
  head: {
    paddingHorizontal: 18,
    paddingTop: 18,
  },
  kicker: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  distanceRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginTop: 12,
  },
  distance: {
    color: colors.text,
    fontSize: 38,
    fontWeight: '800',
    letterSpacing: 0,
  },
  distanceUnit: {
    color: colors.text2,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 8,
  },
  mapWrap: {
    height: 218,
    position: 'relative',
  },
  mapWrapCompact: {
    height: 148,
  },
  emptyMap: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: 12,
    minHeight: 38,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.canvas,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  emptyMapCompact: {
    bottom: 18,
  },
  emptyMapText: {
    color: colors.text3,
    fontSize: 12,
    fontWeight: '700',
  },
  flag: {
    position: 'absolute',
    fontSize: 21,
  },
  footer: {
    minHeight: 82,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: 'row',
  },
  fcell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
  lastCell: {
    borderRightWidth: 0,
  },
  fvalue: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
  },
  flabel: {
    color: colors.text3,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});
