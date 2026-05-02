import { Image } from 'expo-image';
import { MapPin, Users } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import { Dimensions, FlatList, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { PAPER } from '@/components/feed/feedTheme';
import MomentEngagementBar from '@/components/discover/MomentEngagementBar';
import PostOptionsMenu from '@/components/discover/PostOptionsMenu';
import PolaroidCollage from '@/components/discover/PolaroidCollage';
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
  onPhotoPress?: (index: number) => void;
  tags?: PostTag[];
  isOwner?: boolean;
  onDeleted?: () => void;
  onHidden?: () => void;
}

function timeSince(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return `${Math.floor(days / 7)}w`;
}

export default function ExploreMomentCard({
  post,
  onLike,
  onComment,
  onShare,
  onSave,
  onProfilePress,
  onPhotoPress,
  tags,
  isOwner,
  onDeleted,
  onHidden,
}: ExploreMomentCardProps) {
  const hasMedia = (post.media?.length ?? 0) > 0;
  const isCarousel = post.type === 'carousel' || (post.layoutType === 'carousel' && hasMedia);
  const isCollage = post.type === 'collage' || post.layoutType === 'polaroid_stack';
  const [carouselIndex, setCarouselIndex] = useState(0);

  // Full-screen photo viewer
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);

  const allPhotos = hasMedia
    ? (post.media ?? []).map((m) => m.mediaUrl)
    : post.photoUrl ? [post.photoUrl] : [];

  const openViewer = useCallback((idx: number) => {
    setViewerIndex(idx);
    setViewerVisible(true);
    onPhotoPress?.(idx);
  }, [onPhotoPress]);

  const onScroll = useCallback((e: { nativeEvent: { contentOffset: { x: number } } }) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / (MEDIA_W - 32));
    setCarouselIndex(idx);
  }, []);

  return (
    <View style={styles.card}>
      {/* Header: avatar + name + time */}
      <TouchableOpacity
        style={styles.header}
        onPress={onProfilePress}
        activeOpacity={onProfilePress ? 0.7 : 1}
        disabled={!onProfilePress}
      >
        {post.userAvatar ? (
          <Image source={{ uri: post.userAvatar }} style={styles.avatar} contentFit="cover" />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Text style={styles.avatarLetter}>
              {(post.userName ?? 'T')[0].toUpperCase()}
            </Text>
          </View>
        )}
        <View style={styles.headerText}>
          <Text style={styles.userName}>{post.userName ?? 'Traveler'}</Text>
          <Text style={styles.timeAgo}>{timeSince(post.createdAt)}</Text>
        </View>
        {isOwner && (
          <PostOptionsMenu postId={post.id} onDeleted={onDeleted} onHidden={onHidden} />
        )}
      </TouchableOpacity>

      {/* Caption — above media */}
      {post.caption ? (
        <View style={styles.captionWrap}>
          <Text style={styles.caption}>
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
          <TouchableOpacity activeOpacity={0.9} onPress={() => openViewer(0)}>
            <PolaroidCollage media={post.media!} />
          </TouchableOpacity>
        ) : isCarousel && hasMedia ? (
          <View>
            <FlatList
              data={post.media}
              keyExtractor={(m) => m.id || String(m.orderIndex)}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onScroll={onScroll}
              scrollEventThrottle={16}
              renderItem={({ item, index }) => (
                <TouchableOpacity activeOpacity={0.9} onPress={() => openViewer(index)}>
                  <Image source={{ uri: item.mediaUrl }} style={styles.carouselImg} contentFit="cover" />
                </TouchableOpacity>
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
        ) : post.photoUrl ? (
          <TouchableOpacity activeOpacity={0.9} onPress={() => openViewer(0)}>
            <Image source={{ uri: post.photoUrl }} style={styles.singleImg} contentFit="cover" />
          </TouchableOpacity>
        ) : null}
      </View>

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

      {/* Full-screen photo viewer */}
      <Modal
        visible={viewerVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setViewerVisible(false)}
      >
        <View style={styles.viewerBg}>
          <TouchableOpacity
            style={styles.viewerClose}
            onPress={() => setViewerVisible(false)}
            activeOpacity={0.7}
          >
            <Text style={styles.viewerCloseText}>Close</Text>
          </TouchableOpacity>

          {allPhotos.length > 1 ? (
            <FlatList
              data={allPhotos}
              keyExtractor={(_, i) => String(i)}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              initialScrollIndex={viewerIndex}
              getItemLayout={(_, i) => ({ length: SCREEN_W, offset: SCREEN_W * i, index: i })}
              renderItem={({ item }) => (
                <Image source={{ uri: item }} style={styles.viewerImg} contentFit="contain" />
              )}
            />
          ) : allPhotos[0] ? (
            <Image source={{ uri: allPhotos[0] }} style={styles.viewerImg} contentFit="contain" />
          ) : null}
        </View>
      </Modal>
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
  userName: {
    fontSize: 14,
    fontWeight: '600',
    color: PAPER.inkDark,
  },
  timeAgo: {
    fontSize: 11,
    color: PAPER.inkLight,
    marginTop: 1,
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

  // Photo viewer
  viewerBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
  },
  viewerClose: {
    position: 'absolute',
    top: 54,
    right: 20,
    zIndex: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  viewerCloseText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  viewerImg: {
    width: SCREEN_W,
    height: '100%',
  },
});
