import { Image } from 'expo-image';
import React, { useState } from 'react';
import { StyleSheet, Text, type ImageStyle, type StyleProp, View } from 'react-native';

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

function CollageImage({
  uri,
  style,
  recyclingKey,
}: {
  uri?: string;
  style: StyleProp<ImageStyle>;
  recyclingKey?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (!uri || failed) {
    return (
      <View style={[style, styles.imageFallback]}>
        <Text style={styles.imageFallbackText}>Photo unavailable</Text>
      </View>
    );
  }

  return (
    <Image
      source={{ uri }}
      style={style}
      contentFit="cover"
      cachePolicy="memory-disk"
      recyclingKey={recyclingKey ?? uri}
      transition={0}
      onError={() => setFailed(true)}
    />
  );
}

export default function PolaroidCollage({ media, maxVisible = 4 }: PolaroidCollageProps) {
  const layout = getLayout(media.length);
  const visible = media.slice(0, maxVisible);
  const overflow = media.length - maxVisible;

  if (layout === 'single') {
    return (
      <View style={styles.singleWrap}>
        <View style={styles.polaroid}>
          <CollageImage
            uri={media[0]?.mediaUrl}
            style={styles.singleImg}
            recyclingKey={media[0]?.id || media[0]?.mediaUrl}
          />
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
            <CollageImage
              uri={m.mediaUrl}
              style={styles.duoImg}
              recyclingKey={m.id || m.mediaUrl}
            />
          </View>
        ))}
      </View>
    );
  }

  if (layout === 'triptych') {
    return (
      <View style={styles.triptychWrap}>
        <View style={[styles.polaroid, styles.heroCard, { transform: [{ rotate: `${ROTATIONS[0]}deg` }] }]}>
          <CollageImage
            uri={visible[0]?.mediaUrl}
            style={styles.heroImg}
            recyclingKey={visible[0]?.id || visible[0]?.mediaUrl}
          />
        </View>
        <View style={styles.triptychSide}>
          {visible.slice(1).map((m, i) => (
            <View
              key={m.id || i}
              style={[styles.polaroid, styles.smallCard, { transform: [{ rotate: `${ROTATIONS[i + 1]}deg` }] }]}
            >
              <CollageImage
                uri={m.mediaUrl}
                style={styles.smallImg}
                recyclingKey={m.id || m.mediaUrl}
              />
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
          <CollageImage
            uri={m.mediaUrl}
            style={styles.gridImg}
            recyclingKey={m.id || m.mediaUrl}
          />
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
  imageFallback: {
    backgroundColor: '#f0e8d8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageFallbackText: {
    color: '#8d7b63',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    paddingHorizontal: 8,
  },
});
