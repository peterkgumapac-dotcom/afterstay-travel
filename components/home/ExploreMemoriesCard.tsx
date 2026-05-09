import { useEffect, useMemo, useState } from 'react';
import { Link, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { Bookmark, Camera, ChevronDown, Compass, Images, MapPin, Plus } from 'lucide-react-native';
import { StyleSheet, Text, View, Pressable, TouchableOpacity } from 'react-native';

import { useTheme } from '@/constants/ThemeContext';
import { getExploreFeed } from '@/lib/moments/exploreMomentsService';
import { resolveRenderableStorageUrl } from '@/lib/storageMedia';

type ThemeColors = ReturnType<typeof useTheme>['colors'];
type ExplorePost = Awaited<ReturnType<typeof getExploreFeed>>[number];
type PostWithPhoto = { post: ExplorePost; rawPhoto: string };

type PreviewMoment = {
  id: string;
  photoUrl?: string;
};

type ExploreCardVariant = 'inspiration' | 'afterTrip' | 'nearby';
type ShortcutItem = {
  key: string;
  label: string;
  icon: typeof Compass;
  onPress: () => void;
};

const PREVIEW_LIMIT = 3;
const PREVIEW_TIMEOUT_MS = 7000;

function withTimeout<T>(promise: Promise<T>, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), PREVIEW_TIMEOUT_MS);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(fallback);
      },
    );
  });
}

function getPostPhoto(post: ExplorePost) {
  return post.photoUrl ?? post.media?.find((item) => item.mediaType !== 'video')?.mediaUrl;
}

export function ExploreMemoriesCard({
  variant = 'inspiration',
  tripId,
}: {
  variant?: ExploreCardVariant;
  tripId?: string;
}) {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [moments, setMoments] = useState<PreviewMoment[]>([]);
  const [expanded, setExpanded] = useState(false);
  const copy = useMemo(() => {
    if (variant === 'afterTrip') {
      return {
        kicker: 'After Trip',
        title: 'Keep the trip alive',
        subtitle: 'Relive your memories, add missing photos, or get ideas for the next one.',
      };
    }
    if (variant === 'nearby') {
      return {
        kicker: 'Near You',
        title: 'Explore around your trip',
        subtitle: 'Food, places, and ideas nearby without turning Home into a feed.',
      };
    }
    return {
      kicker: 'Explore Memories',
      title: 'Explore memories from other travelers',
      subtitle: 'A little inspiration for where to eat, wander, and remember next.',
    };
  }, [variant]);

  const shortcuts = useMemo<ShortcutItem[]>(() => {
    if (variant === 'afterTrip') {
      return [
        {
          key: 'recap',
          label: 'View Recap',
          icon: Images,
          onPress: () => {
            if (tripId) router.push({ pathname: '/trip-recap', params: { tripId } } as never);
          },
        },
        {
          key: 'photos',
          label: 'Add Photos',
          icon: Camera,
          onPress: () => router.push({ pathname: '/add-moment', params: tripId ? { tripId } : undefined } as never),
        },
        {
          key: 'explore',
          label: 'Explore',
          icon: Compass,
          onPress: () => router.push({ pathname: '/(tabs)/discover', params: { mode: 'explore_moments' } } as never),
        },
      ];
    }
    if (variant === 'nearby') {
      return [
        {
          key: 'food',
          label: 'Nearby Food',
          icon: MapPin,
          onPress: () => router.push({ pathname: '/(tabs)/discover', params: { mode: 'plan' } } as never),
        },
        {
          key: 'saved',
          label: 'Saved Ideas',
          icon: Bookmark,
          onPress: () => router.push({ pathname: '/(tabs)/discover', params: { mode: 'plan' } } as never),
        },
        {
          key: 'moment',
          label: 'Add Moment',
          icon: Camera,
          onPress: () => router.push({ pathname: '/add-moment', params: tripId ? { tripId } : undefined } as never),
        },
      ];
    }
    return [
      {
        key: 'explore',
        label: 'Explore',
        icon: Compass,
        onPress: () => router.push({ pathname: '/(tabs)/discover', params: { mode: 'explore_moments' } } as never),
      },
      {
        key: 'places',
        label: 'Places',
        icon: MapPin,
        onPress: () => router.push({ pathname: '/(tabs)/discover', params: { mode: 'plan' } } as never),
      },
      {
        key: 'plan',
        label: 'Plan Trip',
        icon: Plus,
        onPress: () => router.push('/onboarding' as never),
      },
    ];
  }, [router, tripId, variant]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const posts = await withTimeout(getExploreFeed({ mode: 'recent', limit: PREVIEW_LIMIT, offset: 0 }), []);
      const resolved = await Promise.all(
        posts
          .map((post) => ({ post, rawPhoto: getPostPhoto(post) }))
          .filter((item): item is PostWithPhoto => Boolean(item.rawPhoto))
          .slice(0, PREVIEW_LIMIT)
          .map(async ({ post, rawPhoto }) => ({
            id: post.id,
            photoUrl: await resolveRenderableStorageUrl(rawPhoto, 'moments').catch(() => rawPhoto),
          })),
      );
      if (!cancelled) setMoments(resolved);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleExpanded = () => {
    Haptics.selectionAsync().catch(() => {});
    setExpanded((open) => !open);
  };

  return (
    <View style={styles.wrap}>
      <View style={[styles.card, expanded && styles.cardExpanded]}>
        <Pressable
          style={styles.mainRow}
          accessibilityRole="button"
          accessibilityLabel={expanded ? 'Collapse Explore shortcuts' : 'Expand Explore shortcuts'}
          onPress={toggleExpanded}
        >
          <View style={styles.copy}>
            <Text style={styles.kicker}>{copy.kicker}</Text>
            <Text style={styles.title}>{copy.title}</Text>
            <Text style={styles.subtitle}>{copy.subtitle}</Text>
          </View>
          <View style={styles.previewStack}>
            {moments.length > 0 ? (
              moments.map((moment, index) => (
                <Image
                  key={moment.id}
                  source={{ uri: moment.photoUrl }}
                  style={[
                    styles.previewPhoto,
                    index === 0 && styles.previewPhotoPrimary,
                    index === 1 && styles.previewPhotoSecond,
                    index === 2 && styles.previewPhotoThird,
                  ]}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                />
              ))
            ) : (
              <View style={styles.emptyPreview}>
                <Compass size={24} color={colors.accent} strokeWidth={1.8} />
              </View>
            )}
          </View>
        </Pressable>

        <View style={styles.inlineActionRow}>
          <Link
            href={{ pathname: '/(tabs)/discover', params: { mode: variant === 'nearby' ? 'plan' : 'explore_moments' } }}
            asChild
          >
            <Link.AppleZoom>
              <Pressable
                style={styles.ctaPill}
                accessibilityRole="button"
                accessibilityLabel={variant === 'nearby' ? 'Open nearby places' : 'Open Explore Memories'}
              >
                <Text style={styles.cta}>{variant === 'nearby' ? 'Open Places' : 'Open Explore'}</Text>
              </Pressable>
            </Link.AppleZoom>
          </Link>
          <Pressable
            style={[styles.expandPill, expanded && styles.expandPillActive]}
            accessibilityRole="button"
            accessibilityLabel={expanded ? 'Hide Explore shortcuts' : 'Show Explore shortcuts'}
            onPress={toggleExpanded}
          >
            <ChevronDown
              size={14}
              color={expanded ? colors.onBlack : colors.accent}
              strokeWidth={2.2}
              style={expanded ? styles.chevronOpen : undefined}
            />
          </Pressable>
        </View>

        {expanded && (
          <View style={styles.shortcutStack}>
            {shortcuts.map((item) => {
              const Icon = item.icon;
              return (
                <TouchableOpacity
                  key={item.key}
                  style={styles.shortcut}
                  activeOpacity={0.76}
                  onPress={(event) => {
                    event.stopPropagation();
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                    item.onPress();
                  }}
                >
                  <View style={styles.shortcutIcon}>
                    <Icon size={15} color={colors.accent} strokeWidth={2.1} />
                  </View>
                  <Text style={styles.shortcutText}>{item.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>
    </View>
  );
}

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    wrap: {
      marginTop: 18,
    },
    card: {
      minHeight: 128,
      padding: 16,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      overflow: 'hidden',
    },
    cardExpanded: {
      borderColor: colors.accentBorder,
    },
    mainRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
    },
    copy: {
      flex: 1,
      minWidth: 0,
    },
    kicker: {
      color: colors.text3,
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 1.4,
      textTransform: 'uppercase',
      marginBottom: 6,
    },
    title: {
      color: colors.text,
      fontSize: 18,
      fontWeight: '700',
      lineHeight: 22,
      letterSpacing: -0.3,
    },
    subtitle: {
      color: colors.text3,
      fontSize: 12,
      lineHeight: 17,
      marginTop: 6,
    },
    inlineActionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 10,
    },
    ctaPill: {
      flex: 1,
      minHeight: 32,
      paddingHorizontal: 12,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.accentBorder,
      backgroundColor: colors.accentBg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cta: {
      color: colors.accent,
      fontSize: 12,
      fontWeight: '800',
    },
    expandPill: {
      width: 32,
      height: 32,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.accentBorder,
      backgroundColor: colors.card,
      alignItems: 'center',
      justifyContent: 'center',
    },
    expandPillActive: {
      borderColor: colors.black,
      backgroundColor: colors.black,
    },
    chevronOpen: {
      transform: [{ rotate: '180deg' }],
    },
    previewStack: {
      width: 104,
      height: 94,
    },
    previewPhoto: {
      position: 'absolute',
      width: 68,
      height: 82,
      borderRadius: 16,
      borderWidth: 2,
      borderColor: colors.card,
      backgroundColor: colors.accentBg,
    },
    previewPhotoPrimary: {
      right: 20,
      top: 4,
      transform: [{ rotate: '-7deg' }],
    },
    previewPhotoSecond: {
      right: 0,
      top: 14,
      transform: [{ rotate: '8deg' }],
    },
    previewPhotoThird: {
      right: 38,
      top: 20,
      transform: [{ rotate: '3deg' }],
    },
    emptyPreview: {
      width: 86,
      height: 86,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: colors.accentBorder,
      backgroundColor: colors.accentBg,
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'flex-end',
    },
    shortcutStack: {
      marginTop: 14,
      paddingTop: 14,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      flexDirection: 'row',
      gap: 8,
    },
    shortcut: {
      flex: 1,
      minHeight: 64,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.canvas,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 8,
      gap: 6,
    },
    shortcutIcon: {
      width: 28,
      height: 28,
      borderRadius: 999,
      backgroundColor: colors.accentBg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    shortcutText: {
      color: colors.text,
      fontSize: 11,
      fontWeight: '800',
      textAlign: 'center',
    },
  });
