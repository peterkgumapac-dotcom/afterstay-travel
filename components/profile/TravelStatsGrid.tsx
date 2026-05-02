import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useTheme } from '@/constants/ThemeContext';
import type { LifetimeStats } from '@/lib/types';

// Custom SVG icons matching the design prototype exactly
function TripsIcon({ color }: { color: string }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
      <Rect x={3} y={7} width={18} height={13} rx={2} stroke={color} strokeWidth={1.7} />
      <Path d="M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2" stroke={color} strokeWidth={1.7} />
    </Svg>
  );
}

function CountriesIcon({ color }: { color: string }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={1.7} />
      <Path d="M3 12h18M12 3c2.5 3 2.5 15 0 18M12 3c-2.5 3-2.5 15 0 18" stroke={color} strokeWidth={1.5} />
    </Svg>
  );
}

function CameraIcon({ color }: { color: string }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
      <Rect x={3} y={7} width={18} height={13} rx={2} stroke={color} strokeWidth={1.7} />
      <Circle cx={12} cy={13.5} r={3.5} stroke={color} strokeWidth={1.7} />
      <Path d="M9 7l1.5-2.5h3L15 7" stroke={color} strokeWidth={1.7} />
    </Svg>
  );
}

function MoonIcon({ color }: { color: string }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
      <Path d="M20 14a8 8 0 11-10-10 7 7 0 0010 10z" stroke={color} strokeWidth={1.7} strokeLinejoin="round" />
    </Svg>
  );
}

function PesoIcon({ color }: { color: string }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
      <Path d="M7 4v16M7 4h6a4 4 0 010 8H7M5 9h11M5 13h11" stroke={color} strokeWidth={1.7} strokeLinecap="round" />
    </Svg>
  );
}

function StarIcon({ color }: { color: string }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill={color}>
      <Path d="M12 3l2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.4l6.1-.9L12 3z" />
    </Svg>
  );
}

interface TravelStatsGridProps {
  stats: LifetimeStats;
}

export default function TravelStatsGrid({ stats }: TravelStatsGridProps) {
  const { colors } = useTheme();
  const s = getStyles(colors);

  const formatSpent = (n: number) => {
    if (n >= 1000000) return `₱${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `₱${Math.round(n / 1000)}k`;
    return `₱${n}`;
  };

  const cells = [
    { icon: <TripsIcon color={colors.accent} />, value: String(stats.totalTrips), label: 'Trips' },
    { icon: <CountriesIcon color={colors.accent} />, value: String(stats.totalCountries), label: 'Countries' },
    { icon: <CameraIcon color={colors.accent} />, value: String(stats.totalMoments), label: 'Moments' },
    { icon: <MoonIcon color={colors.accent} />, value: String(stats.totalNights), label: 'Nights' },
    { icon: <PesoIcon color={colors.accent} />, value: formatSpent(stats.totalSpent), label: 'Spent' },
    { icon: <StarIcon color={colors.accent} />, value: '—', label: 'Avg Rating' },
  ];

  return (
    <View style={s.grid}>
      {cells.map((cell, i) => {
        const isRightEdge = (i + 1) % 3 === 0;
        const isBottomRow = i >= 3;
        return (
          <View
            key={cell.label}
            style={[
              s.cell,
              !isRightEdge && s.cellBorderRight,
              !isBottomRow && s.cellBorderBottom,
            ]}
          >
            {cell.icon}
            <Text style={s.value}>{cell.value}</Text>
            <Text style={s.label}>{cell.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

const getStyles = (colors: ReturnType<typeof useTheme>['colors']) =>
  StyleSheet.create({
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      overflow: 'hidden',
    },
    cell: {
      width: '33.333%',
      paddingVertical: 16,
      paddingHorizontal: 6,
      alignItems: 'center',
      gap: 4,
    },
    cellBorderRight: {
      borderRightWidth: 1,
      borderRightColor: colors.border,
    },
    cellBorderBottom: {
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    value: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      letterSpacing: -0.3,
      marginTop: 2,
    },
    label: {
      fontSize: 10,
      fontWeight: '600',
      letterSpacing: 1.2,
      textTransform: 'uppercase',
      color: colors.text3,
    },
  });
