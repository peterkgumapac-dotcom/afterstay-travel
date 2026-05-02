import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { PAPER, SERIF_ITALIC } from './feedTheme';
import { SepiaPhoto } from './SepiaPhoto';

interface ContactSheetItem {
  photo: string;
  time: string;
  rotation: number;
}

interface ContactSheetProps {
  items: ContactSheetItem[];
  onPress?: (index: number) => void;
}

export function ContactSheet({ items, onPress }: ContactSheetProps) {
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        {items.map((item, i) => (
          <TouchableOpacity
            key={i}
            style={styles.itemWrap}
            activeOpacity={0.8}
            onPress={() => onPress?.(i)}
          >
            <View
              style={[
                styles.photoFrame,
                { transform: [{ rotate: `${item.rotation}deg` }] },
              ]}
            >
              <SepiaPhoto
                uri={item.photo}
                style={styles.photo}
                imageStyle={StyleSheet.absoluteFillObject}
              />
            </View>
            <Text style={styles.index}>{i + 1}</Text>
            <Text style={styles.time}>{item.time}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 24,
    paddingTop: 4,
    paddingBottom: 18,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 14,
  },
  itemWrap: {
    flex: 1,
    alignItems: 'center',
  },
  photoFrame: {
    width: '100%',
    aspectRatio: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PAPER.photoBorder,
    borderRadius: 2,
    overflow: 'hidden',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  index: {
    fontFamily: SERIF_ITALIC,
    fontSize: 12,
    color: PAPER.inkLight,
    marginTop: 8,
    lineHeight: 14,
  },
  time: {
    fontSize: 10,
    color: PAPER.inkLight,
    marginTop: 3,
    letterSpacing: 0.3,
  },
});
