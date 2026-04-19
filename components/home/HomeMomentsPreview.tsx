import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { useTheme } from '@/constants/ThemeContext';
import type { GroupMember, Moment } from '@/lib/types';

type ThemeColors = ReturnType<typeof useTheme>['colors'];

interface HomeMomentsPreviewProps {
  moments: Moment[];
  members: GroupMember[];
  onViewAll?: () => void;
}

const THUMBNAIL_SIZE = 60;
const THUMBNAIL_RADIUS = 10;
const THUMBNAIL_GAP = 8;
const MAX_THUMBNAILS = 4;
const HERO_ASPECT_RATIO = 10 / 16; // height = width * 10/16

function getAuthorAvatar(
  takenBy: string | undefined,
  members: GroupMember[],
): string | undefined {
  if (!takenBy) return undefined;
  const member = members.find(
    (m) => m.name.toLowerCase() === takenBy.toLowerCase(),
  );
  return member?.profilePhoto ?? undefined;
}

export function HomeMomentsPreview({
  moments,
  members,
  onViewAll,
}: HomeMomentsPreviewProps) {
  const { colors } = useTheme();
  const styles = getStyles(colors);

  if (moments.length === 0) {
    return (
      <View style={styles.wrapper}>
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>
            No moments yet {'\u2014'} capture your first
          </Text>
        </View>
      </View>
    );
  }

  const latestMoment = moments[0];
  const thumbnailMoments = moments.slice(1, MAX_THUMBNAILS + 1);
  const overflowCount = moments.length - 1 - MAX_THUMBNAILS;
  const authorAvatar = getAuthorAvatar(latestMoment.takenBy, members);

  return (
    <View style={styles.wrapper}>
      {/* Hero card — latest moment */}
      <TouchableOpacity
        style={styles.heroCard}
        activeOpacity={0.85}
        onPress={onViewAll}
        accessibilityRole="button"
        accessibilityLabel={`View moment: ${latestMoment.caption}`}
      >
        {latestMoment.photo ? (
          <Image
            source={{ uri: latestMoment.photo }}
            style={styles.heroImage}
            accessibilityLabel={latestMoment.caption || 'Trip moment'}
          />
        ) : (
          <View style={[styles.heroImage, { backgroundColor: colors.card2 }]} />
        )}

        {/* Caption overlay with gradient */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.65)']}
          style={styles.heroGradient}
        >
          <View style={styles.heroCaptionRow}>
            {authorAvatar ? (
              <Image
                source={{ uri: authorAvatar }}
                style={styles.authorAvatar}
                accessibilityLabel={latestMoment.takenBy ?? 'Author'}
              />
            ) : latestMoment.takenBy ? (
              <View style={[styles.authorAvatar, styles.authorFallback]}>
                <Text style={styles.authorFallbackText}>
                  {latestMoment.takenBy.charAt(0).toUpperCase()}
                </Text>
              </View>
            ) : null}
            <Text style={styles.heroCaption} numberOfLines={2}>
              {latestMoment.caption || 'Untitled moment'}
            </Text>
          </View>
        </LinearGradient>
      </TouchableOpacity>

      {/* Thumbnail row */}
      {thumbnailMoments.length > 0 && (
        <View style={styles.thumbnailRow}>
          {thumbnailMoments.map((moment, index) => {
            const isLastVisible =
              index === thumbnailMoments.length - 1 && overflowCount > 0;

            return (
              <TouchableOpacity
                key={moment.id}
                style={styles.thumbnailContainer}
                activeOpacity={0.7}
                onPress={onViewAll}
                accessibilityRole="button"
                accessibilityLabel={
                  isLastVisible
                    ? `${overflowCount} more moments`
                    : moment.caption || 'Trip moment'
                }
              >
                {moment.photo ? (
                  <Image
                    source={{ uri: moment.photo }}
                    style={styles.thumbnail}
                  />
                ) : (
                  <View
                    style={[styles.thumbnail, { backgroundColor: colors.card2 }]}
                  />
                )}
                {isLastVisible && (
                  <View style={styles.overflowBadge}>
                    <Text style={styles.overflowText}>
                      +{overflowCount}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* View all link */}
      <TouchableOpacity
        onPress={onViewAll}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="View all moments"
        style={styles.viewAllBtn}
      >
        <Text style={styles.viewAllText}>View all</Text>
      </TouchableOpacity>
    </View>
  );
}

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    wrapper: {
      paddingHorizontal: 16,
      gap: 10,
    },

    /* Empty state */
    emptyCard: {
      paddingVertical: 32,
      paddingHorizontal: 20,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 14,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    emptyText: {
      fontSize: 13,
      color: colors.text3,
      fontWeight: '500',
    },

    /* Hero card */
    heroCard: {
      borderRadius: 14,
      overflow: 'hidden',
      backgroundColor: colors.card,
    },
    heroImage: {
      width: '100%',
      aspectRatio: 16 / 10,
      borderRadius: 14,
    },
    heroGradient: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      paddingTop: 40,
      paddingBottom: 12,
      paddingHorizontal: 14,
      borderBottomLeftRadius: 14,
      borderBottomRightRadius: 14,
    },
    heroCaptionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    authorAvatar: {
      width: 24,
      height: 24,
      borderRadius: 999,
      borderWidth: 1.5,
      borderColor: 'rgba(255,255,255,0.4)',
    },
    authorFallback: {
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    authorFallbackText: {
      fontSize: 11,
      fontWeight: '700',
      color: '#fff',
    },
    heroCaption: {
      flex: 1,
      fontSize: 13,
      fontWeight: '600',
      color: '#fff',
      lineHeight: 17,
    },

    /* Thumbnails */
    thumbnailRow: {
      flexDirection: 'row',
      gap: THUMBNAIL_GAP,
    },
    thumbnailContainer: {
      width: THUMBNAIL_SIZE,
      height: THUMBNAIL_SIZE,
      borderRadius: THUMBNAIL_RADIUS,
      overflow: 'hidden',
    },
    thumbnail: {
      width: THUMBNAIL_SIZE,
      height: THUMBNAIL_SIZE,
      borderRadius: THUMBNAIL_RADIUS,
    },
    overflowBadge: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.55)',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: THUMBNAIL_RADIUS,
    },
    overflowText: {
      fontSize: 15,
      fontWeight: '700',
      color: '#fff',
    },

    /* View all */
    viewAllBtn: {
      alignSelf: 'flex-start',
    },
    viewAllText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.accent,
    },
  });
