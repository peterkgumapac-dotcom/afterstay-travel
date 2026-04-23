import React from 'react';
import { Dimensions } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import Svg, { Circle, G, Line, Path, Text as SvgText } from 'react-native-svg';

import { colorForName, fateColors } from '@/constants/fateTheme';

interface WheelProps {
  names: string[];
  rotation: SharedValue<number>;
  size?: number;
}

const DEFAULT_SIZE = Math.min(Dimensions.get('window').width - 80, 300);

export default function Wheel({ names, rotation, size = DEFAULT_SIZE }: WheelProps) {
  const center = size / 2;
  const outerRadius = center - 4;
  const sliceAngle = 360 / names.length;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  // For 2 names, duplicate to 4 visual slices
  const visualNames = names.length === 2
    ? [names[0], names[1], names[0], names[1]]
    : names;
  const visualSliceAngle = 360 / visualNames.length;

  return (
    <Animated.View style={[{ width: size, height: size }, animatedStyle]}>
    <Svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
    >
      {/* Slices */}
      {visualNames.map((name, i) => {
        const colorIdx = names.length === 2 ? i % 2 : i;
        return (
          <SliceWedge
            key={`${name}-${i}`}
            index={i}
            name={name}
            color={colorForName(name, colorIdx)}
            center={center}
            radius={outerRadius}
            sliceAngle={visualSliceAngle}
            totalSlices={visualNames.length}
          />
        );
      })}

      {/* Divider lines */}
      {visualNames.map((_, i) => {
        const angle = (i * visualSliceAngle - 90) * (Math.PI / 180);
        const x2 = center + outerRadius * Math.cos(angle);
        const y2 = center + outerRadius * Math.sin(angle);
        return (
          <Line
            key={`div-${i}`}
            x1={center}
            y1={center}
            x2={x2}
            y2={y2}
            stroke="#FFFFFF"
            strokeWidth={2}
          />
        );
      })}

      {/* Center hub */}
      <Circle cx={center} cy={center} r={18} fill={fateColors.background} />
      <Circle cx={center} cy={center} r={6} fill={fateColors.primary} />
    </Svg>
    </Animated.View>
  );
}

interface SliceWedgeProps {
  index: number;
  name: string;
  color: string;
  center: number;
  radius: number;
  sliceAngle: number;
  totalSlices: number;
}

function SliceWedge({ index, name, color, center, radius, sliceAngle, totalSlices }: SliceWedgeProps) {
  const startAngle = index * sliceAngle - 90;
  const endAngle = startAngle + sliceAngle;

  const startRad = (startAngle * Math.PI) / 180;
  const endRad = (endAngle * Math.PI) / 180;

  const x1 = center + radius * Math.cos(startRad);
  const y1 = center + radius * Math.sin(startRad);
  const x2 = center + radius * Math.cos(endRad);
  const y2 = center + radius * Math.sin(endRad);

  const largeArc = sliceAngle > 180 ? 1 : 0;

  const d = [
    `M ${center} ${center}`,
    `L ${x1} ${y1}`,
    `A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`,
    'Z',
  ].join(' ');

  // Text position: 60% radius at slice center angle
  const textAngle = startAngle + sliceAngle / 2;
  const textRad = (textAngle * Math.PI) / 180;
  const textR = radius * 0.6;
  const tx = center + textR * Math.cos(textRad);
  const ty = center + textR * Math.sin(textRad);

  const initial = name.charAt(0).toUpperCase();
  const displayName = name.length > 8 ? name.slice(0, 8) : name;

  return (
    <G>
      <Path d={d} fill={color} />
      <SvgText
        x={tx}
        y={ty - 4}
        fill={fateColors.background}
        fontSize={22}
        fontFamily="Georgia"
        fontWeight="500"
        textAnchor="middle"
        alignmentBaseline="central"
        rotation={textAngle + 90}
        origin={`${tx}, ${ty - 4}`}
      >
        {initial}
      </SvgText>
      <SvgText
        x={tx}
        y={ty + 14}
        fill={fateColors.background}
        fontSize={10}
        fontWeight="600"
        textAnchor="middle"
        alignmentBaseline="central"
        rotation={textAngle + 90}
        origin={`${tx}, ${ty + 14}`}
      >
        {displayName.toUpperCase()}
      </SvgText>
    </G>
  );
}
