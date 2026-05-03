import React, { useEffect, useState } from 'react';
import { Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image as ImageIcon, Lock, Plus, Users } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/constants/ThemeContext';
import { getAlbums } from '@/lib/supabase';
import { CachedImage } from '@/components/CachedImage';
import type { Album } from '@/lib/types';
import type { ScopeFilter } from './ScopeChips';

const { width: SCREEN_W } = Dimensions.get('window');
const GAP = 10;
const CARD_W = (SCREEN_W - 32 - GAP) / 2;

interface AlbumsGridProps {
  tripId?: string;
  totalMoments: number;
  privateMoments: number;
  onSwitchScope: (scope: ScopeFilter) => void;
}

export function AlbumsGrid({ tripId, totalMoments, privateMoments, onSwitchScope }: AlbumsGridProps) {
  const { colors } = useTheme();
  const router = useRouter();
  const [albums, setAlbums] = useState<Album[]>([]);

  useEffect(() => {
    getAlbums(tripId).then(setAlbums).catch(() => {});
  }, [tripId]);

  const sharedCount = totalMoments - privateMoments;

  return (
    <View style={styles.container}>
      {/* Pinned section */}
      <Text style={[styles.sectionLabel, { color: colors.text3 }]}>Pinned</Text>
      <View style={styles.grid}>
        {/* Everyone's trip */}
        <Pressable
          style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => onSwitchScope('group')}
        >
          <View style={[styles.cardCover, { backgroundColor: 'rgba(216,171,122,0.12)' }]}>
            <Users size={28} color={colors.accent} strokeWidth={1.5} />
          </View>
          <View style={styles.cardInfo}>
            <Text style={[styles.cardName, { color: colors.text }]}>Everyone's trip</Text>
            <Text style={[styles.cardSub, { color: colors.text3 }]}>
              {sharedCount} shared · all members
            </Text>
          </View>
          <View style={[styles.scopeTag, { backgroundColor: 'rgba(216,171,122,0.15)' }]}>
            <Text style={[styles.scopeTagText, { color: colors.accent }]}>Group</Text>
          </View>
        </Pressable>

        {/* Just me */}
        <Pressable
          style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => onSwitchScope('me')}
        >
          <View style={[styles.cardCover, { backgroundColor: 'rgba(196,85,74,0.10)' }]}>
            <Lock size={28} color={colors.danger} strokeWidth={1.5} />
          </View>
          <View style={styles.cardInfo}>
            <Text style={[styles.cardName, { color: colors.text }]}>Just me</Text>
            <Text style={[styles.cardSub, { color: colors.text3 }]}>
              {privateMoments} moments · only you
            </Text>
          </View>
          <View style={[styles.scopeTag, { backgroundColor: 'rgba(196,85,74,0.12)' }]}>
            <Text style={[styles.scopeTagText, { color: colors.danger }]}>Private</Text>
          </View>
        </Pressable>
      </View>

      {/* Custom albums */}
      {albums.length > 0 && (
        <>
          <Text style={[styles.sectionLabel, { color: colors.text3, marginTop: 20 }]}>
            Custom · {albums.length}
          </Text>
          <View style={styles.grid}>
            {albums.map((album) => (
              <Pressable
                key={album.id}
                style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => router.push({ pathname: '/album-detail', params: { albumId: album.id, name: album.name } } as never)}
              >
                {album.coverUrl ? (
                  <CachedImage remoteUrl={album.coverUrl} style={styles.cardCoverImg} />
                ) : (
                  <View style={[styles.cardCover, { backgroundColor: colors.card2 }]}>
                    <ImageIcon size={28} color={colors.text3} strokeWidth={1.5} />
                  </View>
                )}
                <View style={styles.cardInfo}>
                  <Text style={[styles.cardName, { color: colors.text }]} numberOfLines={1}>{album.name}</Text>
                  <Text style={[styles.cardSub, { color: colors.text3 }]}>
                    {album.momentCount} photos · {album.memberCount} member{album.memberCount !== 1 ? 's' : ''}
                  </Text>
                </View>
                {album.hideFromMosaic && (
                  <View style={[styles.scopeTag, { backgroundColor: 'rgba(217,164,65,0.15)' }]}>
                    <Text style={[styles.scopeTagText, { color: colors.warn }]}>Hidden</Text>
                  </View>
                )}
              </Pressable>
            ))}
          </View>
        </>
      )}

      {/* New album card */}
      <Pressable
        style={[styles.createCard, { borderColor: colors.border2 }]}
        onPress={() => router.push('/new-album' as never)}
      >
        <View style={[styles.createPlus, { backgroundColor: colors.accent }]}>
          <Plus size={22} color={colors.onBlack} strokeWidth={1.5} />
        </View>
        <Text style={[styles.createTitle, { color: colors.text }]}>New album</Text>
        <Text style={[styles.createSub, { color: colors.text3 }]}>
          Custom group · pick photos & people
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
  },
  card: {
    width: CARD_W,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardCover: {
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardCoverImg: {
    height: 100,
    width: '100%',
  },
  cardInfo: {
    padding: 12,
    gap: 2,
  },
  cardName: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.15,
  },
  cardSub: {
    fontSize: 10,
    fontWeight: '500',
  },
  scopeTag: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingVertical: 3,
    paddingHorizontal: 7,
    borderRadius: 99,
  },
  scopeTagText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  createCard: {
    marginTop: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 16,
    paddingVertical: 24,
    alignItems: 'center',
    gap: 6,
  },
  createPlus: {
    width: 44,
    height: 44,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  createTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  createSub: {
    fontSize: 10,
    textAlign: 'center',
    paddingHorizontal: 16,
    lineHeight: 14,
  },
});
