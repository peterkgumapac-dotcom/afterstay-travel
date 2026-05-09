import { Image } from 'expo-image';
import { Link, type Href } from 'expo-router';
import { CheckCircle, MapPin, Newspaper, Users } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Dimensions, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { PAPER } from '@/components/feed/feedTheme';
import MomentEngagementBar from '@/components/discover/MomentEngagementBar';
import PostOptionsMenu from '@/components/discover/PostOptionsMenu';
import PolaroidCollage from '@/components/discover/PolaroidCollage';
import type { MomentDisplay } from '@/components/moments/types';
import { smallUrl } from '@/lib/imageUrl';
import { isOfficialAfterStayPost, isTravelPulsePost } from '@/lib/officialAccount';
import { resolveRenderableStorageUrl } from '@/lib/storageMedia';
import type { FeedPost, PostTag } from '@/lib/types';

const SCREEN_W = Dimensions.get('window').width;
const CARD_PAD = 16;
const MEDIA_W = SCREEN_W - CARD_PAD * 2;

interface ExploreMomentCardProps {
  post: FeedPost;
  onLike: () => Promise<void> | void;
  onComment: () => void;
  onShare: () => void;
  onSave: () => Promise<void> | void;
  onProfilePress?: () => void;
  tags?: PostTag[];
  isOwner?: boolean;
  onDeleted?: () => void;
  onHidden?: () => void;
}

function PhotoZoomLink({ href, children }: { href: Href; children: React.ReactElement }) {
  return (
    <Link href={href} asChild>
      <Link.AppleZoom>{children}</Link.AppleZoom>
    </Link>
  );
}

function PaperTexture() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[styles.paperFiber, styles.paperFiberOne]} />
      <View style={[styles.paperFiber, styles.paperFiberTwo]} />
      <View style={[styles.paperFiber, styles.paperFiberThree]} />
      <View style={[styles.paperStain, styles.paperStainTop]} />
      <View style={[styles.paperStain, styles.paperStainBottom]} />
      <View style={styles.innerPaperRule} />
    </View>
  );
}

function timeSince(dateStr: string): string {
  const time = new Date(dateStr).getTime();
  if (!Number.isFinite(time)) return 'just now';
  const seconds = Math.floor((Date.now() - time) / 1000);
  if (seconds < 60) return 'just now';
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return `${Math.floor(days / 7)}w`;
}

function textMeta(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function getPostBadge(post: FeedPost): string | undefined {
  const explicit = textMeta(post.metadata?.badgeLabel);
  if (explicit) return explicit;
  const postType = textMeta(post.metadata?.postType);
  if (postType === 'hidden_gem') return 'Hidden Gem';
  if (postType === 'food_find') return 'Food Find';
  if (postType === 'trip_highlight') return 'Trip Highlight';
  if (isTravelPulsePost(post)) return 'Travel Pulse';
  if (isOfficialAfterStayPost(post)) return 'AfterStay Pick';
  return undefined;
}

function getTravelNote(post: FeedPost): { label: string; value: string } | null {
  const postType = textMeta(post.metadata?.postType);
  const fromMetadata =
    textMeta(post.metadata?.whySave) ??
    textMeta(post.metadata?.whyUnderrated) ??
    textMeta(post.metadata?.whatToOrder) ??
    textMeta(post.metadata?.tip) ??
    textMeta(post.metadata?.bestTime);

  if (postType === 'hidden_gem') {
    const value = fromMetadata ?? post.caption;
    return value ? { label: 'Why save it', value } : null;
  }
  if (postType === 'food_find') {
    const value = textMeta(post.metadata?.whatToOrder) ?? fromMetadata ?? post.caption;
    return value ? { label: 'What to try', value } : null;
  }
  if (postType === 'trip_highlight') {
    const value = fromMetadata;
    return value ? { label: 'Trip note', value } : null;
  }
  return null;
}

type TravelPulseItem = {
  title?: string;
  summary?: string;
  sourceName?: string;
  publishedAt?: string;
};

function getTravelPulseItems(post: FeedPost): TravelPulseItem[] {
  const items = post.metadata?.items;
  if (!Array.isArray(items)) return [];
  return items
    .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    .slice(0, 4)
    .map((item) => ({
      title: textMeta(item.title),
      summary: textMeta(item.summary),
      sourceName: textMeta(item.sourceName) ?? textMeta(item.source),
      publishedAt: textMeta(item.publishedAt),
    }));
}

export default function ExploreMomentCard({
  post,
  onLike,
  onComment,
  onShare,
  onSave,
  onProfilePress,
  tags,
  isOwner,
  onDeleted,
  onHidden,
}: ExploreMomentCardProps) {
  const hasMedia = (post.media?.length ?? 0) > 0;
  const isCarousel = post.type === 'carousel' || (post.layoutType === 'carousel' && hasMedia);
  const isCollage = post.type === 'collage' || post.layoutType === 'polaroid_stack';
  const isOfficial = isOfficialAfterStayPost(post);
  const isTravelPulse = isTravelPulsePost(post);
  const postBadge = getPostBadge(post);
  const travelNote = getTravelNote(post);
  const pulseItems = isTravelPulse ? getTravelPulseItems(post) : [];
  const lastChecked = textMeta(post.metadata?.lastChecked);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [resolvedAvatarUrl, setResolvedAvatarUrl] = useState<string | undefined>();
  const [failedMedia, setFailedMedia] = useState<Set<string>>(() => new Set());
  const [resolvedMediaUrls, setResolvedMediaUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    setAvatarFailed(false);
    setResolvedAvatarUrl(undefined);
    if (!post.userAvatar) return () => { cancelled = true; };
    resolveRenderableStorageUrl(post.userAvatar, 'avatars')
      .then((url) => {
        if (!cancelled) setResolvedAvatarUrl(url);
      })
      .catch(() => {
        if (!cancelled) setResolvedAvatarUrl(post.userAvatar);
      });
    return () => { cancelled = true; };
  }, [post.userAvatar]);

  useEffect(() => {
    let cancelled = false;
    setFailedMedia(new Set());
    const entries = [
      ...(post.media ?? []).map((media, index) => [`media:${media.id || index}`, media.mediaUrl] as const),
      ...(post.photoUrl ? [['photo', post.photoUrl] as const] : []),
    ].filter(([, url]) => !!url);

    if (entries.length === 0) {
      setResolvedMediaUrls({});
      return () => { cancelled = true; };
    }

    Promise.all(entries.map(async ([key, url]) => {
      try {
        return [key, await resolveRenderableStorageUrl(url)] as const;
      } catch {
        return [key, url] as const;
      }
    }))
      .then((resolved) => {
        if (cancelled) return;
        const nextUrls = resolved.reduce<Record<string, string>>((acc, [key, url]) => {
          if (url) acc[key] = url;
          return acc;
        }, {});
        setResolvedMediaUrls(nextUrls);
      })
    return () => { cancelled = true; };
  }, [post.media, post.photoUrl]);

  const mediaWithResolvedUrls = useMemo(() => (post.media ?? []).map((media, index) => {
    const key = `media:${media.id || index}`;
    return {
      ...media,
      resolvedUrl: resolvedMediaUrls[key] ?? media.mediaUrl,
      renderKey: key,
    };
  }), [post.media, resolvedMediaUrls]);

  const resolvedPhotoUrl = resolvedMediaUrls.photo ?? post.photoUrl;
  const allPhotos = useMemo(() => (hasMedia
    ? mediaWithResolvedUrls.map((m) => m.resolvedUrl).filter(Boolean)
    : resolvedPhotoUrl ? [resolvedPhotoUrl] : []), [hasMedia, mediaWithResolvedUrls, resolvedPhotoUrl]);

  const viewerMoments = useMemo<MomentDisplay[]>(() => allPhotos.map((url, index) => ({
    id: `${post.id}-media-${index}`,
    caption: post.caption ?? '',
    photo: url,
    hdPhoto: url,
    location: post.locationName,
    date: post.createdAt,
    tags: [],
    visibility: 'public',
    isPublic: post.isPublic,
    isMine: isOwner,
    takenBy: post.userName,
    userId: post.userId,
    authorAvatar: resolvedAvatarUrl,
    place: post.locationName,
  })), [allPhotos, isOwner, post.caption, post.createdAt, post.id, post.isPublic, post.locationName, post.userId, post.userName, resolvedAvatarUrl]);

  const viewerHref = useCallback((index: number): Href => ({
    pathname: '/photo-viewer',
    params: {
      moments: JSON.stringify(viewerMoments),
      people: JSON.stringify({}),
      initialIndex: String(Math.max(0, index)),
    },
  }), [viewerMoments]);

  const onCarouselSettle = useCallback((e: { nativeEvent: { contentOffset: { x: number } } }) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / (MEDIA_W - 32));
    setCarouselIndex(idx);
  }, []);

  const collageMedia = useMemo(() => mediaWithResolvedUrls.map((media) => ({
    ...media,
    mediaUrl: smallUrl(media.resolvedUrl) ?? media.resolvedUrl,
  })), [mediaWithResolvedUrls]);

  return (
    <View style={[styles.card, isOfficial && styles.officialCard, isTravelPulse && styles.pulseCard]}>
      <PaperTexture />
      {isOfficial ? (
        <View style={styles.officialRail}>
          <View style={styles.officialRailIcon}>
            <Newspaper size={11} color={PAPER.stamp} strokeWidth={2.2} />
          </View>
          <Text style={styles.officialRailText}>
            {isTravelPulse ? 'Travel Pulse briefing' : 'Official AfterStay'}
          </Text>
          {lastChecked ? <Text style={styles.officialRailTime}>Checked {lastChecked}</Text> : null}
        </View>
      ) : null}

      {/* Header: avatar + name + time */}
      <TouchableOpacity
        style={styles.header}
        onPress={onProfilePress}
        activeOpacity={onProfilePress ? 0.7 : 1}
        disabled={!onProfilePress}
      >
        {resolvedAvatarUrl && !avatarFailed ? (
          <Image
            source={{ uri: resolvedAvatarUrl }}
            style={styles.avatar}
            contentFit="cover"
            onError={() => setAvatarFailed(true)}
          />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Text style={styles.avatarLetter}>
              {(post.userName ?? 'T')[0].toUpperCase()}
            </Text>
          </View>
        )}
        <View style={styles.headerText}>
          <View style={styles.nameLine}>
            <Text style={styles.userName}>{post.userName ?? 'Traveler'}</Text>
            {isOfficial ? (
              <View style={styles.verifiedMark} accessibilityLabel="Verified AfterStay account">
                <CheckCircle size={14} color="#fff" fill={PAPER.stamp} strokeWidth={2.4} />
              </View>
            ) : null}
          </View>
          <Text style={styles.timeAgo}>{timeSince(post.createdAt)}</Text>
        </View>
        {isOwner && (
          <PostOptionsMenu postId={post.id} onDeleted={onDeleted} onHidden={onHidden} />
        )}
      </TouchableOpacity>

      {postBadge ? (
        <View style={[styles.badgePill, isTravelPulse && styles.pulseBadge]}>
          <Text style={[styles.badgeText, isTravelPulse && styles.pulseBadgeText]}>{postBadge}</Text>
        </View>
      ) : null}

      {/* Caption — above media */}
      {post.caption && (!travelNote || travelNote.value !== post.caption) ? (
        <View style={styles.captionWrap}>
          <Text style={styles.caption}>
            {post.caption}
          </Text>
        </View>
      ) : null}

      {isTravelPulse && pulseItems.length > 0 ? (
        <View style={styles.pulseItems}>
          {pulseItems.map((item, index) => (
            <View key={`${item.title ?? 'pulse'}-${index}`} style={styles.pulseItem}>
              <Text style={styles.pulseItemKicker}>Signal {index + 1}</Text>
              {item.title ? <Text style={styles.pulseItemTitle}>{item.title}</Text> : null}
              {item.summary ? <Text style={styles.pulseItemSummary}>{item.summary}</Text> : null}
              {item.sourceName || item.publishedAt ? (
                <Text style={styles.pulseItemSource} numberOfLines={1}>
                  {[item.sourceName, item.publishedAt].filter(Boolean).join(' · ')}
                </Text>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}

      {/* Location tag — above media */}
      {post.locationName && (
        <View style={styles.locationRow}>
          <MapPin size={12} color={PAPER.stamp} strokeWidth={2} />
          <Text style={styles.locationText} numberOfLines={1}>{post.locationName}</Text>
        </View>
      )}

      {/* Tagged people */}
      {tags && tags.length > 0 && (
        <View style={styles.tagRow}>
          <Users size={12} color={PAPER.inkLight} strokeWidth={2} />
          <Text style={styles.tagText} numberOfLines={1}>
            with {tags.map((t) => t.userName ?? 'someone').join(', ')}
          </Text>
        </View>
      )}

      {/* Media */}
      <View style={styles.mediaWrap}>
        {isCollage && hasMedia ? (
          <PhotoZoomLink href={viewerHref(0)}>
            <TouchableOpacity activeOpacity={0.9}>
              <PolaroidCollage media={collageMedia} />
            </TouchableOpacity>
          </PhotoZoomLink>
        ) : isCarousel && hasMedia ? (
          <View>
            <FlatList
              data={mediaWithResolvedUrls}
              keyExtractor={(m) => m.id || String(m.orderIndex)}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={onCarouselSettle}
              initialNumToRender={1}
              maxToRenderPerBatch={1}
              windowSize={3}
              removeClippedSubviews
              renderItem={({ item, index }) => (
                <PhotoZoomLink href={viewerHref(index)}>
                  <TouchableOpacity activeOpacity={0.9}>
                    {item.resolvedUrl && !failedMedia.has(item.renderKey) ? (
                      <Image
                        source={{ uri: smallUrl(item.resolvedUrl) ?? item.resolvedUrl }}
                        style={styles.carouselImg}
                        contentFit="cover"
                        cachePolicy="memory-disk"
                        recyclingKey={item.renderKey}
                        transition={0}
                        onError={() => setFailedMedia((prev) => new Set(prev).add(item.renderKey))}
                      />
                    ) : (
                      <View style={[styles.carouselImg, styles.mediaFallback]}>
                        <Text style={styles.mediaFallbackText}>Photo unavailable</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </PhotoZoomLink>
              )}
            />
            {(post.media?.length ?? 0) > 1 && (
              <View style={styles.dotRow}>
                {post.media!.map((_, i) => (
                  <View key={i} style={[styles.dot, i === carouselIndex && styles.dotActive]} />
                ))}
              </View>
            )}
          </View>
        ) : resolvedPhotoUrl ? (
          <PhotoZoomLink href={viewerHref(0)}>
            <TouchableOpacity activeOpacity={0.9}>
              {!failedMedia.has('photo') ? (
                <Image
                  source={{ uri: smallUrl(resolvedPhotoUrl) ?? resolvedPhotoUrl }}
                  style={styles.singleImg}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                  recyclingKey={`single-${post.id}-${resolvedPhotoUrl}`}
                  transition={0}
                  onError={() => setFailedMedia((prev) => new Set(prev).add('photo'))}
                />
              ) : (
                <View style={[styles.singleImg, styles.mediaFallback]}>
                  <Text style={styles.mediaFallbackText}>Photo unavailable</Text>
                </View>
              )}
            </TouchableOpacity>
          </PhotoZoomLink>
        ) : null}
      </View>

      {travelNote ? (
        <View style={styles.travelNote}>
          <View pointerEvents="none" style={styles.travelNoteLines}>
            <View style={styles.travelNoteLine} />
            <View style={styles.travelNoteLine} />
          </View>
          <Text style={styles.travelNoteLabel}>{travelNote.label}</Text>
          <Text style={styles.travelNoteText}>{travelNote.value}</Text>
        </View>
      ) : null}

      {/* Engagement bar */}
      <MomentEngagementBar
        likesCount={post.likesCount}
        commentsCount={post.commentsCount}
        saveCount={post.saveCount}
        shareCount={post.shareCount}
        viewerHasLiked={post.viewerHasLiked}
        viewerHasSaved={post.viewerHasSaved}
        onLike={onLike}
        onComment={onComment}
        onShare={onShare}
        onSave={onSave}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: PAPER.ivoryClean,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PAPER.rule,
    shadowColor: '#3d2a12',
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  paperFiber: {
    position: 'absolute',
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(61, 42, 18, 0.055)',
    transform: [{ rotate: '-3deg' }],
  },
  paperFiberOne: {
    width: '76%',
    top: 76,
    left: -18,
  },
  paperFiberTwo: {
    width: '62%',
    top: 214,
    right: -10,
    backgroundColor: 'rgba(255, 255, 255, 0.24)',
  },
  paperFiberThree: {
    width: '86%',
    bottom: 92,
    left: 24,
  },
  paperStain: {
    position: 'absolute',
    width: 148,
    height: 148,
    borderRadius: 74,
    backgroundColor: 'rgba(157, 112, 55, 0.045)',
  },
  paperStainTop: {
    top: 0,
    right: 0,
  },
  paperStainBottom: {
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
  },
  innerPaperRule: {
    position: 'absolute',
    top: 5,
    left: 5,
    right: 5,
    bottom: 5,
    borderRadius: 9,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.34)',
  },
  officialCard: {
    borderColor: 'rgba(157, 112, 55, 0.38)',
    shadowColor: '#5b3b18',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  pulseCard: {
    backgroundColor: '#fffaf0',
  },
  officialRail: {
    minHeight: 38,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(157, 112, 55, 0.30)',
    backgroundColor: 'rgba(239, 230, 207, 0.88)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
  },
  officialRailIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 250, 240, 0.86)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(157, 112, 55, 0.38)',
  },
  officialRailText: {
    flex: 1,
    color: PAPER.stamp,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.35,
    textTransform: 'uppercase',
  },
  officialRailTime: {
    color: PAPER.inkLight,
    fontSize: 10.5,
    fontWeight: '800',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  avatarPlaceholder: {
    backgroundColor: PAPER.postcardEdge,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    color: PAPER.postcardInk,
    fontSize: 15,
    fontWeight: '700',
  },
  headerText: {
    flex: 1,
  },
  nameLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  userName: {
    fontSize: 14,
    fontWeight: '600',
    color: PAPER.inkDark,
  },
  verifiedMark: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeAgo: {
    fontSize: 11,
    color: PAPER.inkLight,
    marginTop: 1,
  },
  badgePill: {
    alignSelf: 'flex-start',
    marginHorizontal: 14,
    marginBottom: 8,
    borderRadius: 999,
    backgroundColor: PAPER.stamp,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeText: {
    color: PAPER.ivoryClean,
    fontSize: 11,
    fontWeight: '800',
  },
  pulseBadge: {
    backgroundColor: '#2a1d0d',
  },
  pulseBadgeText: {
    color: '#f7dfb5',
  },

  // Caption — above media
  captionWrap: {
    paddingHorizontal: 14,
    paddingBottom: 8,
  },
  caption: {
    fontSize: 14,
    color: PAPER.inkDark,
    lineHeight: 20,
  },
  pulseItems: {
    marginHorizontal: 14,
    marginBottom: 10,
    gap: 8,
  },
  pulseItem: {
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(157, 112, 55, 0.24)',
    backgroundColor: 'rgba(255,255,255,0.58)',
    padding: 10,
  },
  pulseItemKicker: {
    color: PAPER.stamp,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  pulseItemTitle: {
    color: PAPER.inkDark,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 17,
  },
  pulseItemSummary: {
    color: PAPER.inkMid,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },
  pulseItemSource: {
    color: PAPER.inkLight,
    fontSize: 10.5,
    fontWeight: '700',
    marginTop: 5,
  },

  // Location — above media
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingBottom: 8,
  },
  locationText: {
    fontSize: 12,
    color: PAPER.stamp,
    fontWeight: '500',
  },

  // Tags
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingBottom: 8,
  },
  tagText: {
    fontSize: 12,
    color: PAPER.inkLight,
    fontStyle: 'italic',
  },

  // Media
  mediaWrap: {
    overflow: 'hidden',
    borderRadius: 8,
    marginHorizontal: 8,
    marginBottom: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.70)',
    backgroundColor: PAPER.photoBorder,
  },
  mediaFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(232, 228, 219, 0.78)',
  },
  mediaFallbackText: {
    color: PAPER.inkLight,
    fontSize: 12,
    fontWeight: '700',
  },
  travelNote: {
    marginHorizontal: 10,
    marginTop: 8,
    marginBottom: 2,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(184, 169, 140, 0.55)',
    backgroundColor: 'rgba(255, 250, 240, 0.72)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    overflow: 'hidden',
  },
  travelNoteLines: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    gap: 18,
    paddingHorizontal: 12,
    opacity: 0.55,
  },
  travelNoteLine: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(184, 169, 140, 0.42)',
  },
  travelNoteLabel: {
    color: PAPER.stamp,
    fontSize: 11,
    fontWeight: '900',
    marginBottom: 4,
  },
  travelNoteText: {
    color: PAPER.inkDark,
    fontSize: 14,
    lineHeight: 20,
  },
  singleImg: {
    width: '100%',
    aspectRatio: 4 / 3,
  },
  carouselImg: {
    width: MEDIA_W - 32,
    aspectRatio: 4 / 3,
  },
  dotRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: PAPER.rule,
  },
  dotActive: {
    backgroundColor: PAPER.inkDark,
  },
});
