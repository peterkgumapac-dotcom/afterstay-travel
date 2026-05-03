import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { PostMedia } from '@/lib/types';

interface PolaroidCollageProps {
  media: PostMedia[];
  maxVisible?: number;
}

type CollageLayout = 'single' | 'duo' | 'triptych' | 'grid' | 'stack';

function getLayout(count: number): CollageLayout {
  if (count <= 1) return 'single';
  if (count === 2) return 'duo';
  if (count === 3) return 'triptych';
  if (count === 4) return 'grid';
  return 'stack';
}

const ROTATIONS = [-2, 1.8, -1.2, 2.2, -1.5];

export default function PolaroidCollage({ media, maxVisible = 4 }: PolaroidCollageProps) {
  const layout = getLayout(media.length);
  const visible = media.slice(0, maxVisible);
  const overflow = media.length - maxVisible;

  if (layout === 'single') {
    return (
      <View style={styles.singleWrap}>
        <View style={styles.polaroid}>
          <Image source={{ uri: media[0]?.mediaUrl }} style={styles.singleImg} contentFit="cover" />
        </View>
      </View>
    );
  }

  if (layout === 'duo') {
    return (
      <View style={styles.duoWrap}>
        {visible.map((m, i) => (
          <View
            key={m.id || i}
            style={[styles.polaroid, styles.duoCard, { transform: [{ rotate: `${ROTATIONS[i]}deg` }] }]}
          >
            <Image source={{ uri: m.mediaUrl }} style={styles.duoImg} contentFit="cover" />
          </View>
        ))}
      </View>
    );
  }

  if (layout === 'triptych') {
    return (
      <View style={styles.triptychWrap}>
        <View style={[styles.polaroid, styles.heroCard, { transform: [{ rotate: `${ROTATIONS[0]}deg` }] }]}>
          <Image source={{ uri: visible[0]?.mediaUrl }} style={styles.heroImg} contentFit="cover" />
        </View>
        <View style={styles.triptychSide}>
          {visible.slice(1).map((m, i) => (
            <View
              key={m.id || i}
              style={[styles.polaroid, styles.smallCard, { transform: [{ rotate: `${ROTATIONS[i + 1]}deg` }] }]}
            >
              <Image source={{ uri: m.mediaUrl }} style={styles.smallImg} contentFit="cover" />
            </View>
          ))}
        </View>
      </View>
    );
  }

  // grid / stack
  return (
    <View style={styles.gridWrap}>
      {visible.map((m, i) => (
        <View
          key={m.id || i}
          style={[styles.polaroid, styles.gridCard, { transform: [{ rotate: `${ROTATIONS[i]}deg` }] }]}
        >
          <Image source={{ uri: m.mediaUrl }} style={styles.gridImg} contentFit="cover" />
          {i === maxVisible - 1 && overflow > 0 && (
            <View style={styles.overflowOverlay}>
              <Text style={styles.overflowText}>+{overflow}</Text>
            </View>
          )}
        </View>
      ))}
    </View>
  );
}

const BORDER = 6;
const SHADOW = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.12,
  shadowRadius: 6,
  elevation: 4,
};

const styles = StyleSheet.create({
  // Single
  singleWrap: { alignItems: 'center', paddingVertical: 4 },
  polaroid: {
    backgroundColor: '#fff',
    padding: BORDER,
    paddingBottom: BORDER + 8,
    borderRadius: 2,
    ...SHADOW,
  },
  singleImg: { width: '100%', aspectRatio: 4 / 3, borderRadius: 1 },

  // Duo
  duoWrap: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: -20,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  duoCard: { width: '48%' },
  duoImg: { width: '100%', aspectRatio: 3 / 4, borderRadius: 1 },

  // Triptych
  triptychWrap: {
    flexDirection: 'row',
    gap: 4,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  heroCard: { flex: 1.6 },
  heroImg: { width: '100%', aspectRatio: 3 / 4, borderRadius: 1 },
  triptychSide: { flex: 1, gap: 4 },
  smallCard: {},
  smallImg: { width: '100%', aspectRatio: 1, borderRadius: 1 },

  // Grid / Stack
  gridWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  gridCard: { width: '46%' },
  gridImg: { width: '100%', aspectRatio: 1, borderRadius: 1 },

  // Overflow
  overflowOverlay: {
    ...StyleSheet.absoluteFillObject,
    margin: BORDER,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 1,
  },
  overflowText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
  },
});
