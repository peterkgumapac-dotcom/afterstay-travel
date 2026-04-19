import React from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useTheme } from '@/constants/ThemeContext';
import { HOTEL_COORDS } from '@/lib/boracayData';

const NEARBY_ITEMS = [
  { name: 'CityMall Boracay', type: 'Mall', distance: '470 m', walkTime: '6 min walk' },
  { name: "D'Mall", type: 'Shopping street', distance: '1.6 km', walkTime: '20 min walk' },
  { name: 'Island Clinic', type: 'Medical', distance: '830 m', walkTime: '10 min walk' },
];

export const NearbySection: React.FC = () => {
  const { colors } = useTheme();
  const styles = getStyles(colors);

  const openMap = () => {
    const url = `https://www.google.com/maps/search/essentials/@${HOTEL_COORDS.lat},${HOTEL_COORDS.lng},15z`;
    Linking.openURL(url);
  };

  return (
    <View style={styles.section}>
      <View style={styles.list}>
        {NEARBY_ITEMS.map((item) => (
          <View key={item.name} style={styles.row}>
            <View style={styles.pinWrap}>
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M12 22s-8-7.5-8-13a8 8 0 1116 0c0 5.5-8 13-8 13z"
                  stroke="currentColor"
                  strokeWidth={1.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <Circle cx={12} cy={9} r={2.8} stroke="currentColor" strokeWidth={1.8} />
              </Svg>
            </View>
            <View style={styles.textCol}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.meta}>{item.type}</Text>
            </View>
            <Text style={styles.distance}>{item.distance}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

const getStyles = (colors: ReturnType<typeof import('@/constants/ThemeContext').useTheme>['colors']) =>
  StyleSheet.create({
    section: {
      paddingHorizontal: 16,
      gap: 8,
    },
    list: {
      gap: 8,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      paddingVertical: 14,
      paddingHorizontal: 14,
    },
    pinWrap: {
      width: 32,
      height: 32,
      borderRadius: 10,
      backgroundColor: colors.card2,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    textCol: {
      flex: 1,
    },
    name: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '600',
    },
    meta: {
      color: colors.text3,
      fontSize: 11,
      marginTop: 1,
    },
    distance: {
      color: colors.text2,
      fontSize: 12,
      fontWeight: '600',
    },
  });
