import { Image } from 'expo-image';
import { Link, type Href } from 'expo-router';
import { CheckCircle, MapPin, Newspaper, Users } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Dimensions, FlatList, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { PAPER } from '@/components/feed/feedTheme';
import MomentEngagementBar from '@/components/discover/MomentEngagementBar';
import PostOptionsMenu from '@/components/discover/PostOptionsMenu';
import PolaroidCollage from '@/components/discover/PolaroidCollage';
import type { MomentDisplay } from '@/components/moments/types';
import { isOfficialAfterStayPost, isTravelPulsePost } from '@/lib/officialAccount';
import { resolveRenderableStorageUrl } from '@/lib/storageMedia';
import type { FeedPost, PostMedia, PostTag } from '@/lib/types';

const SCREEN_W = Dimensions.get('window').width;
const CARD_PAD = 16;
const MEDIA_W = SCREEN_W - CARD_PAD * 2;
const AFTERSTAY_AUTHOR_NAME = 'AfterStay Travel';
const DIRECT_MEDIA_URI_RE = /^(https?:|file:|content:|data:)/i;
const SUPABASE_STORAGE_RE = /\/storage\/v1\/(object|render\/image)\//i;

interface ExploreMomentCardProps {
  post: FeedPost;
  onLike: (postId: string) => Promise<void> | void;
  onComment: (postId: string) => void;
  onShare: (postId: string) => void;
  onSave: (postId: string) => Promise<void> | void;
  onProfilePress?: (userId: string) => void;
  profileUserId?: string;
  tags?: PostTag[];
  isOwner?: boolean;
  onDeleted?: () => void;
  onHidden?: () => void;
}

function PhotoZoomLink({ href, children }: { href: Href; children: React.ReactElement }) {
  if (Platform.OS !== 'ios') {
    return (
      <Link href={href} asChild>
        {children}
      </Link>
    );
  }

  return (
    <Link href={href} asChild>
      <Link.AppleZoom>{children}</Link.AppleZoom>
    </Link>
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

function uniqueTexts(values: (string | undefined)[], limit: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
    if (out.length >= limit) break;
  }
  return out;
}

function directRenderableUri(value?: string): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed || !DIRECT_MEDIA_URI_RE.test(trimmed)) return undefined;
  return SUPABASE_STORAGE_RE.test(trimmed) ? undefined : trimmed;
}

function preferredMediaUrl(media: PostMedia): string | undefined {
  return media.mediaUrl?.trim() || media.storagePath?.trim() || undefined;
}

function renderableMediaUrl(value?: string): string | undefined {
  return directRenderableUri(value);
}

function ExploreMomentCardComponent({
  post,
  onLike,
  onComment,
  onShare,
  onSave,
  onProfilePress,
  profileUserId,
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
  const isPlatformPost = isOfficial || isTravelPulse;
  const authorName = isTravelPulse ? AFTERSTAY_AUTHOR_NAME : post.userName ?? 'Traveler';
  const authorAvatarUrl = post.userAvatar;
  const postBadge = getPostBadge(post);
  const travelNote = getTravelNote(post);
  const pulseItems = isTravelPulse ? getTravelPulseItems(post) : [];
  const lastChecked = textMeta(post.metadata?.lastChecked);
  const pulseHeadline = isTravelPulse
    ? textMeta(post.metadata?.headline) ??
      textMeta(post.metadata?.title) ??
      (post.locationName ? `Travel Pulse for ${post.locationName}` : 'Travel Pulse')
    : undefined;
  const pulseTakeaway = isTravelPulse
    ? textMeta(post.metadata?.takeaway) ?? textMeta(post.metadata?.summary) ?? textMeta(post.caption)
    : undefined;
  const pulseSignals = pulseItems.slice(0, 2);
  const pulseSourceSummary = isTravelPulse
    ? uniqueTexts(pulseItems.map((item) => item.sourceName), 3).join(' · ')
    : '';
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [resolvedAvatarUrl, setResolvedAvatarUrl] = useState<string | undefined>();
  const [failedMedia, setFailedMedia] = useState<Set<string>>(() => new Set());
  const [resolvedMediaUrls, setResolvedMediaUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    setAvatarFailed(false);
    const directAvatarUrl = directRenderableUri(authorAvatarUrl);
    if (directAvatarUrl || !authorAvatarUrl) {
      setResolvedAvatarUrl(directAvatarUrl);
      return () => { cancelled = true; };
    }

    resolveRenderableStorageUrl(authorAvatarUrl, 'avatars')
      .then((url) => {
        if (!cancelled) setResolvedAvatarUrl(url);
      })
      .catch(() => {
        if (!cancelled) setResolvedAvatarUrl(authorAvatarUrl);
      });
    return () => { cancelled = true; };
  }, [authorAvatarUrl]);

  useEffect(() => {
    let cancelled = false;
    setFailedMedia(new Set());
    const entries = [
      ...(post.media ?? []).map((media, index) => [`media:${media.id || index}`, preferredMediaUrl(media)] as const),
      ...(post.photoUrl ? [['photo', post.photoUrl] as const] : []),
    ].filter(([, url]) => !!url && !directRenderableUri(url));

    if (entries.length === 0) {
      setResolvedMediaUrls({});
      return () => { cancelled = true; };
    }

    Promise.all(entries.map(async ([key, url]) => {
      try {
        return [key, await resolveRenderableStorageUrl(url, 'moments')] as const;
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
      });
    return () => { cancelled = true; };
  }, [post.media, post.photoUrl]);

  const mediaWithResolvedUrls = useMemo(() => (post.media ?? []).map((media, index) => {
    const key = `media:${media.id || index}`;
    const mediaUrl = preferredMediaUrl(media);
    return {
      ...media,
      resolvedUrl: resolvedMediaUrls[key] ?? renderableMediaUrl(mediaUrl),
      renderKey: key,
    };
  }), [post.media, resolvedMediaUrls]);

  const resolvedPhotoUrl = resolvedMediaUrls.photo ?? renderableMediaUrl(post.photoUrl);
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
    takenBy: authorName,
    userId: post.userId,
    authorAvatar: resolvedAvatarUrl,
    place: post.locationName,
  })), [allPhotos, authorName, isOwner, post.caption, post.createdAt, post.id, post.isPublic, post.locationName, post.userId, resolvedAvatarUrl]);

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
    mediaUrl: media.resolvedUrl ?? '',
  })).filter((media) => !!media.mediaUrl), [mediaWithResolvedUrls]);
  const handleLike = useCallback(() => onLike(post.id), [onLike, post.id]);
  const handleComment = useCallback(() => onComment(post.id), [onComment, post.id]);
  const handleShare = useCallback(() => onShare(post.id), [onShare, post.id]);
  const handleSave = useCallback(() => onSave(post.id), [onSave, post.id]);
  const handleProfilePress = useCallback(() => {
    if (profileUserId) onProfilePress?.(profileUserId);
  }, [onProfilePress, profileUserId]);
  const canPressProfile = Boolean(profileUserId && onProfilePress);

  return (
    <View style={[styles.card, isPlatformPost && styles.officialCard, isTravelPulse && styles.pulseCard]}>
      {isPlatformPost ? (
        <TouchableOpacity
          style={styles.officialRail}
          onPress={handleProfilePress}
          activeOpacity={canPressProfile ? 0.74 : 1}
          disabled={!canPressProfile}
        >
          <View style={styles.officialRailIcon}>
            <Newspaper size={11} color={PAPER.stamp} strokeWidth={2.2} />
          </View>
          <Text style={styles.officialRailText}>
            {isTravelPulse ? 'Travel Pulse' : 'Official AfterStay'}
          </Text>
          {lastChecked ? <Text style={styles.officialRailTime}>Checked {lastChecked}</Text> : null}
        </TouchableOpacity>
      ) : null}

      {/* Header: avatar + name + time */}
      <TouchableOpacity
        style={styles.header}
        onPress={handleProfilePress}
        activeOpacity={canPressProfile ? 0.7 : 1}
        disabled={!canPressProfile}
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
              {authorName[0].toUpperCase()}
            </Text>
          </View>
        )}
        <View style={styles.headerText}>
          <View style={styles.nameLine}>
            <Text style={styles.userName}>{authorName}</Text>
            {isPlatformPost ? (
              <View style={styles.verifiedMark} accessibilityLabel="Verified AfterStay account">
                <CheckCircle size={17} color="#fff" fill="#1877F2" strokeWidth={2.8} />
              </View>
            ) : null}
          </View>
          <Text style={styles.timeAgo}>
            {isTravelPulse ? `Official travel app · ${timeSince(post.createdAt)}` : timeSince(post.createdAt)}
          </Text>
        </View>
        {isOwner && (
          <PostOptionsMenu postId={post.id} onDeleted={onDeleted} onHidden={onHidden} />
        )}
      </TouchableOpacity>

      {postBadge && !isTravelPulse ? (
        <View style={[styles.badgePill, isTravelPulse && styles.pulseBadge]}>
          <Text style={[styles.badgeText, isTravelPulse && styles.pulseBadgeText]}>{postBadge}</Text>
        </View>
      ) : null}

      {isTravelPulse ? (
        <View style={styles.pulseBriefing}>
          <View style={styles.pulseBriefingTop}>
            <View style={styles.pulseBadge}>
              <Text style={styles.pulseBadgeText}>Official briefing</Text>
            </View>
            {lastChecked ? <Text style={styles.pulseChecked}>Checked {lastChecked}</Text> : null}
          </View>
          {pulseHeadline ? (
            <Text style={styles.pulseHeadline} numberOfLines={2}>
              {pulseHeadline}
            </Text>
          ) : null}
          {pulseTakeaway ? (
            <Text style={styles.pulseTakeaway} numberOfLines={2}>
              {pulseTakeaway}
            </Text>
          ) : null}
          {pulseSignals.length > 0 ? (
            <View style={styles.pulseSignalList}>
              <Text style={styles.pulseSectionLabel}>What to know</Text>
              {pulseSignals.map((item, index) => (
                <View key={`${item.title ?? 'pulse'}-${index}`} style={styles.pulseSignalRow}>
                  <View style={styles.pulseSignalDot}>
                    <Text style={styles.pulseSignalNumber}>{index + 1}</Text>
                  </View>
                  <View style={styles.pulseSignalText}>
                    {item.title ? <Text style={styles.pulseItemTitle} numberOfLines={2}>{item.title}</Text> : null}
                    {item.summary ? <Text style={styles.pulseItemSummary} numberOfLines={1}>{item.summary}</Text> : null}
                  </View>
                </View>
              ))}
            </View>
          ) : null}
          {pulseSourceSummary ? (
            <Text style={styles.pulseSources} numberOfLines={1}>
              Sources: {pulseSourceSummary}
            </Text>
          ) : null}
        </View>
      ) : null}

      {/* Caption — above media */}
      {!isTravelPulse && post.caption && (!travelNote || travelNote.value !== post.caption) ? (
        <View style={[styles.captionWrap, isTravelPulse && styles.pulseCaptionWrap]}>
          <Text style={[styles.caption, isTravelPulse && styles.pulseCaption]} numberOfLines={isTravelPulse ? 4 : undefined}>
            {post.caption}
          </Text>
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
              {collageMedia.length > 0 ? (
                <PolaroidCollage media={collageMedia} />
              ) : (
                <View style={[styles.singleImg, styles.mediaFallback]}>
                  <Text style={styles.mediaFallbackText}>Loading photos...</Text>
                </View>
              )}
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
                        source={{ uri: item.resolvedUrl }}
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
                  source={{ uri: resolvedPhotoUrl }}
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
        onLike={handleLike}
        onComment={handleComment}
        onShare={handleShare}
        onSave={handleSave}
      />
    </View>
  );
}

export default React.memo(ExploreMomentCardComponent);

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
    minHeight: 36,
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
    fontSize: 11.5,
    fontWeight: '900',
    letterSpacing: 0.7,
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
    paddingVertical: 9,
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
    fontSize: 14.5,
    fontWeight: '800',
    color: PAPER.inkDark,
  },
  verifiedMark: {
    width: 19,
    height: 19,
    borderRadius: 9.5,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1877F2',
    shadowOpacity: 0.22,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
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
    borderRadius: 999,
    backgroundColor: '#2a1d0d',
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  pulseBadgeText: {
    color: '#f7dfb5',
    fontSize: 10.5,
    fontWeight: '900',
    letterSpacing: 0.45,
    textTransform: 'uppercase',
  },

  // Caption — above media
  captionWrap: {
    paddingHorizontal: 14,
    paddingBottom: 8,
  },
  pulseCaptionWrap: {
    paddingBottom: 6,
  },
  caption: {
    fontSize: 14,
    color: PAPER.inkDark,
    lineHeight: 20,
  },
  pulseCaption: {
    fontSize: 13.5,
    lineHeight: 19,
    color: PAPER.inkMid,
  },
  pulseBriefing: {
    marginHorizontal: 14,
    marginBottom: 10,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(157, 112, 55, 0.22)',
    backgroundColor: 'rgba(255, 253, 247, 0.72)',
    padding: 12,
  },
  pulseBriefingTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 9,
  },
  pulseChecked: {
    flexShrink: 1,
    color: PAPER.inkLight,
    fontSize: 10.5,
    fontWeight: '800',
    textAlign: 'right',
  },
  pulseHeadline: {
    color: PAPER.inkDark,
    fontSize: 17,
    fontWeight: '900',
    lineHeight: 22,
    marginBottom: 5,
  },
  pulseTakeaway: {
    color: PAPER.inkMid,
    fontSize: 13,
    lineHeight: 18,
  },
  pulseSignalList: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(157, 112, 55, 0.20)',
    gap: 8,
  },
  pulseSectionLabel: {
    color: PAPER.stamp,
    fontSize: 10.5,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  pulseSignalRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
  },
  pulseSignalDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(157, 112, 55, 0.12)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(157, 112, 55, 0.28)',
  },
  pulseSignalNumber: {
    color: PAPER.stamp,
    fontSize: 11,
    fontWeight: '900',
  },
  pulseSignalText: {
    flex: 1,
    minWidth: 0,
  },
  pulseItemTitle: {
    color: PAPER.inkDark,
    fontSize: 13.5,
    fontWeight: '800',
    lineHeight: 18,
  },
  pulseItemSummary: {
    color: PAPER.inkMid,
    fontSize: 12.2,
    lineHeight: 17,
    marginTop: 2,
  },
  pulseSources: {
    color: PAPER.inkLight,
    fontSize: 10.5,
    fontWeight: '700',
    marginTop: 10,
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
