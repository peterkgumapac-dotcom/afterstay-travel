import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';

import { fateColors } from '@/constants/fateTheme';

interface WheelPointerProps {
  wheelSize: number;
}

export default function WheelPointer({ wheelSize }: WheelPointerProps) {
  const pointerWidth = 24;
  const pointerHeight = 28;

  return (
    <View
      style={[
        styles.pointer,
        {
          left: wheelSize / 2 - pointerWidth / 2,
          top: -pointerHeight / 2 + 2,
        },
      ]}
    >
      <Svg width={pointerWidth} height={pointerHeight} viewBox="0 0 24 28">
        <Polygon
          points="12,28 0,0 24,0"
          fill={fateColors.textPrimary}
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  pointer: {
    position: 'absolute',
    zIndex: 10,
  },
});
