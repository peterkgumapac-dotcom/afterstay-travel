import React, { useState } from 'react';
import {
  Image,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  MapPin,
  Send,
  Tag,
  Wallet,
  Plane,
  Users,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSequence, Easing } from 'react-native-reanimated';

import type { FeedPost, FeedPostComment } from '@/lib/types';
import { FEED, SERIF, SERIF_ITALIC } from './feedTheme';

interface FeedCardProps {
  post: FeedPost;
  comments?: FeedPostComment[];
  liked?: boolean;
  onLike: () => void;
  onComment: (text: string) => void;
  onShare?: () => void;
  onProfilePress?: () => void;
  onPhotoPress?: () => void;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return `${Math.floor(days / 7)}w`;
}

export function FeedCard({
  post,
  comments = [],
  liked,
  onLike,
  onComment,
  onShare,
  onProfilePress,
  onPhotoPress,
}: FeedCardProps) {
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [isLiked, setIsLiked] = useState(liked ?? false);
  const [likeCount, setLikeCount] = useState(post.likesCount);

  // Double-tap heart animation
  const heartScale = useSharedValue(0);
  const heartStyle = useAnimatedStyle(() => ({
    transform: [{ scale: heartScale.value }],
    opacity: heartScale.value > 0 ? 1 : 0,
  }));

  const handleLike = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsLiked(!isLiked);
    setLikeCount((prev) => isLiked ? prev - 1 : prev + 1);
    onLike();
  };

  const handleDoubleTap = () => {
    if (!isLiked) handleLike();
    heartScale.value = withSequence(
      withTiming(1.2, { duration: 200, easing: Easing.out(Easing.cubic) }),
      withTiming(0, { duration: 400, easing: Easing.in(Easing.cubic) }),
    );
  };

  const handleSubmitComment = () => {
    const trimmed = commentText.trim();
    if (!trimmed) return;
    onComment(trimmed);
    setCommentText('');
  };

  const handleShare = () => {
    if (onShare) { onShare(); return; }
    Share.share({ message: `${post.caption ?? 'Check out this moment'} — on AfterStay` });
  };

  // Post type badge
  const typeBadge = {
    photo: null,
    text: null,
    carousel: null,
    collage: null,
    story_reference: null,
    trip_summary: { icon: Plane, label: 'Trip Summary', color: '#4a90d9' },
    budget: { icon: Wallet, label: `Spent: ${(post.metadata?.amount as string) ?? ''}`, color: '#d4a03c' },
    recommendation: { icon: MapPin, label: 'Recommendation', color: '#5cb85c' },
    trip_invite: { icon: Users, label: 'Looking for companions', color: FEED.terracotta },
  }[post.type];

  return (
    <View style={styles.card}>
      {/* ── Header ── */}
      <TouchableOpacity style={styles.header} onPress={onProfilePress} activeOpacity={0.7}>
        {post.userAvatar ? (
          <Image source={{ uri: post.userAvatar }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarFallback}>
            <Text style={styles.avatarInitial}>
              {(post.userName ?? '?').charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.userName}>{post.userName ?? 'Traveler'}</Text>
            <Text style={styles.timestamp}>{timeAgo(post.createdAt)}</Text>
          </View>
          {post.locationName ? (
            <View style={styles.locationRow}>
              <MapPin size={10} color={FEED.inkLight} strokeWidth={1.8} />
              <Text style={styles.locationText}>{post.locationName}</Text>
            </View>
          ) : null}
        </View>
        {post.dayNumber ? (
          <View style={styles.dayBadge}>
            <Tag size={10} color={FEED.terracotta} strokeWidth={2} />
            <Text style={styles.dayBadgeText}>Day {post.dayNumber}</Text>
          </View>
        ) : null}
      </TouchableOpacity>

      {/* ── Type badge ── */}
      {typeBadge ? (
        <View style={[styles.typeBadgeRow, { borderLeftColor: typeBadge.color }]}>
          <typeBadge.icon size={14} color={typeBadge.color} strokeWidth={1.8} />
          <Text style={[styles.typeBadgeText, { color: typeBadge.color }]}>{typeBadge.label}</Text>
        </View>
      ) : null}

      {/* ── Photo (for photo/trip_summary/recommendation posts) ── */}
      {(post.photoUrl || post.type === 'photo') && (post.photoUrl) ? (
        <TouchableOpacity
          activeOpacity={0.95}
          onPress={onPhotoPress}
          onLongPress={handleDoubleTap}
          delayLongPress={0}
          style={styles.photoWrap}
        >
          <Image source={{ uri: post.photoUrl }} style={styles.photo} resizeMode="cover" />
          {/* Double-tap heart overlay */}
          <Animated.View style={[styles.heartOverlay, heartStyle]} pointerEvents="none">
            <Heart size={72} color="#fff" fill="#fff" strokeWidth={0} />
          </Animated.View>
        </TouchableOpacity>
      ) : null}

      {/* ── Text-only post ── */}
      {post.type === 'text' && !post.photoUrl ? (
        <View style={styles.textPostWrap}>
          <Text style={styles.textPostContent}>{post.caption}</Text>
        </View>
      ) : null}

      {/* ── Trip invite CTA ── */}
      {post.type === 'trip_invite' ? (
        <View style={styles.inviteWrap}>
          <Text style={styles.inviteDestination}>
            {(post.metadata?.destination as string) ?? post.locationName ?? 'Adventure awaits'}
          </Text>
          <Text style={styles.inviteDates}>
            {(post.metadata?.dates as string) ?? ''}
          </Text>
          <TouchableOpacity style={styles.inviteBtn} activeOpacity={0.7}>
            <Text style={styles.inviteBtnText}>Join Trip</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* ── Actions ── */}
      <View style={styles.actions}>
        <TouchableOpacity onPress={handleLike} style={styles.actionBtn} hitSlop={8}>
          <Heart
            size={22}
            color={isLiked ? FEED.terracotta : FEED.ink}
            fill={isLiked ? FEED.terracotta : 'none'}
            strokeWidth={1.6}
          />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setShowComments(!showComments)} style={styles.actionBtn} hitSlop={8}>
          <MessageCircle size={22} color={FEED.ink} strokeWidth={1.6} />
        </TouchableOpacity>
        <TouchableOpacity onPress={handleShare} style={styles.actionBtn} hitSlop={8}>
          <Share2 size={20} color={FEED.ink} strokeWidth={1.6} />
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        <TouchableOpacity style={styles.actionBtn} hitSlop={8}>
          <Bookmark size={20} color={FEED.ink} strokeWidth={1.6} />
        </TouchableOpacity>
      </View>

      {/* ── Like count ── */}
      {likeCount > 0 ? (
        <Text style={styles.likeCount}>{likeCount} {likeCount === 1 ? 'like' : 'likes'}</Text>
      ) : null}

      {/* ── Caption (for non-text posts) ── */}
      {post.caption && post.type !== 'text' ? (
        <View style={styles.captionRow}>
          <Text style={styles.captionName}>{post.userName ?? 'Traveler'}</Text>
          <Text style={styles.captionText}> {post.caption}</Text>
        </View>
      ) : null}

      {/* ── Comment preview ── */}
      {post.commentsCount > 0 && !showComments ? (
        <TouchableOpacity onPress={() => setShowComments(true)}>
          <Text style={styles.viewComments}>View all {post.commentsCount} comments</Text>
        </TouchableOpacity>
      ) : null}

      {/* ── Comments ── */}
      {showComments && comments.length > 0 ? (
        <View style={styles.commentsSection}>
          {comments.map((c) => (
            <View key={c.id} style={styles.commentRow}>
              <Text style={styles.captionName}>{c.userName}</Text>
              <Text style={styles.captionText}> {c.text}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {/* ── Comment input ── */}
      <View style={styles.commentInputRow}>
        <TextInput
          style={styles.commentInput}
          placeholder="Add a comment..."
          placeholderTextColor={FEED.inkMuted}
          value={commentText}
          onChangeText={setCommentText}
          onSubmitEditing={handleSubmitComment}
          returnKeyType="send"
        />
        {commentText.trim().length > 0 ? (
          <TouchableOpacity onPress={handleSubmitComment} hitSlop={8}>
            <Send size={18} color={FEED.terracotta} strokeWidth={2} />
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: FEED.card,
    borderWidth: 1,
    borderColor: FEED.cardBorder,
    borderRadius: FEED.radius,
    marginHorizontal: 12,
    marginBottom: 12,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: FEED.cardBorder,
  },
  avatarFallback: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f0ebe3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 14,
    fontWeight: '700',
    color: FEED.ink,
  },
  userName: {
    fontSize: 14,
    fontWeight: '600',
    color: FEED.ink,
  },
  timestamp: {
    fontSize: 12,
    color: FEED.inkLight,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 1,
  },
  locationText: {
    fontSize: 11,
    color: FEED.inkLight,
  },
  dayBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: FEED.cardBorder,
  },
  dayBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: FEED.terracotta,
  },
  typeBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginHorizontal: 12,
    marginBottom: 8,
    borderLeftWidth: 3,
    backgroundColor: '#faf8f4',
    borderRadius: 4,
  },
  typeBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  photoWrap: {
    width: '100%',
    aspectRatio: 4 / 5,
    backgroundColor: '#f0ebe3',
    position: 'relative',
  },
  photo: {
    width: '100%',
    height: '100%',
    borderRadius: 2,
  },
  heartOverlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -36,
    marginLeft: -36,
  },
  textPostWrap: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    backgroundColor: '#faf8f4',
    marginHorizontal: 12,
    marginBottom: 8,
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: FEED.terracotta,
  },
  textPostContent: {
    fontFamily: SERIF_ITALIC,
    fontSize: 16,
    color: FEED.ink,
    lineHeight: 24,
  },
  inviteWrap: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginHorizontal: 12,
    marginBottom: 8,
    backgroundColor: '#faf8f4',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: FEED.cardBorder,
    alignItems: 'center',
  },
  inviteDestination: {
    fontFamily: SERIF,
    fontSize: 20,
    color: FEED.ink,
    textAlign: 'center',
  },
  inviteDates: {
    fontSize: 13,
    color: FEED.inkLight,
    marginTop: 4,
    marginBottom: 12,
  },
  inviteBtn: {
    backgroundColor: FEED.terracotta,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
  },
  inviteBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 6,
  },
  actionBtn: {
    padding: 2,
  },
  likeCount: {
    paddingHorizontal: 12,
    fontSize: 13,
    fontWeight: '600',
    color: FEED.ink,
    marginBottom: 4,
  },
  captionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    marginBottom: 4,
  },
  captionName: {
    fontSize: 13,
    fontWeight: '600',
    color: FEED.ink,
  },
  captionText: {
    fontSize: 13,
    color: FEED.ink,
  },
  viewComments: {
    paddingHorizontal: 12,
    fontSize: 13,
    color: FEED.inkLight,
    marginBottom: 4,
  },
  commentsSection: {
    paddingHorizontal: 12,
    marginBottom: 4,
  },
  commentRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 3,
  },
  commentInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: FEED.cardBorder,
    gap: 8,
  },
  commentInput: {
    flex: 1,
    fontSize: 13,
    color: FEED.ink,
    paddingVertical: 4,
  },
});
