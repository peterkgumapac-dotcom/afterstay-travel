import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MapPin } from 'lucide-react-native';
import { Linking } from 'react-native';
import { colors, spacing } from '@/constants/theme';
import { HOTEL_COORDS, NEARBY_ESSENTIALS } from '@/lib/boracayData';

const NEARBY_ITEMS = [
  { name: 'CityMall Boracay', type: 'Mall', distance: '470m' },
  { name: "D'Mall", type: 'Shopping', distance: '1.6km' },
  { name: 'Island Clinic', type: 'Medical', distance: '830m' },
];

export const NearbySection: React.FC = () => {
  const openMap = () => {
    const url = `https://www.google.com/maps/search/essentials/@${HOTEL_COORDS.lat},${HOTEL_COORDS.lng},15z`;
    Linking.openURL(url);
  };

  return (
    <View style={styles.section}>
      <View style={styles.headerRow}>
        <Text style={styles.header}>
          Nearby {'\u00B7'} Around the hotel
        </Text>
        <Pressable onPress={openMap} hitSlop={8}>
          <Text style={styles.mapLink}>Map →</Text>
        </Pressable>
      </View>

      <View style={styles.list}>
        {NEARBY_ITEMS.map((item) => (
          <View key={item.name} style={styles.row}>
            <View style={styles.pinWrap}>
              <MapPin size={16} color={colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{item.name}</Text>
            </View>
            <View style={styles.tag}>
              <Text style={styles.tagText}>{item.type}</Text>
            </View>
            <Text style={styles.distance}>{item.distance}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  section: {
    marginHorizontal: 16,
    marginTop: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  header: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  mapLink: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '600',
  },
  list: {
    backgroundColor: colors.bg2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pinWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.accentDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  tag: {
    backgroundColor: colors.bg3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  tagText: {
    color: colors.text3,
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  distance: {
    color: colors.text2,
    fontSize: 12,
    fontWeight: '600',
    minWidth: 40,
    textAlign: 'right',
  },
});
