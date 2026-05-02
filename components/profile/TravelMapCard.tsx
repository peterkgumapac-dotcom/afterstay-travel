import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';

import { useTheme } from '@/constants/ThemeContext';
import type { LifetimeStats } from '@/lib/types';

interface TravelMapCardProps {
  stats: LifetimeStats;
}

export default function TravelMapCard({ stats }: TravelMapCardProps) {
  const { colors } = useTheme();
  const s = getStyles(colors);
  const countries = stats.countriesList.slice(0, 6);
  const points = countries.map((country, index) => ({
    label: country.slice(0, 3).toUpperCase(),
    x: 52 + index * 42,
    y: index % 2 === 0 ? 76 : 112,
  }));

  return (
    <View style={s.card}>
      <Svg width="100%" height={170} viewBox="0 0 320 170">
        <Path
          d="M32 68 C76 28 116 45 142 64 C170 88 216 52 288 78 M54 114 C112 88 155 118 188 108 C222 98 246 124 292 106"
          fill="none"
          stroke={colors.border2}
          strokeWidth={1.2}
          strokeDasharray="3 5"
        />
        <Circle cx={160} cy={92} r={5} fill={colors.accent} />
        <SvgText x={160} y={111} fontSize={9} fill={colors.text3} textAnchor="middle">HOME</SvgText>
        {points.map((point, index) => (
          <React.Fragment key={`${point.label}-${index}`}>
            <Line x1={160} y1={92} x2={point.x} y2={point.y} stroke={colors.accent} strokeWidth={0.8} strokeDasharray="3 4" />
            <Circle cx={point.x} cy={point.y} r={4} fill={colors.text} />
            <SvgText x={point.x} y={point.y - 10} fontSize={8} fill={colors.text3} textAnchor="middle">{point.label}</SvgText>
          </React.Fragment>
        ))}
      </Svg>
    </View>
  );
}

const getStyles = (colors: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginTop: 10,
    borderRadius: 18,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
});
