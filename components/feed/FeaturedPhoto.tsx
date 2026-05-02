import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Heart, MessageCircle, Share2 } from 'lucide-react-native';

import { PAPER, SERIF, SERIF_ITALIC } from './feedTheme';
import { SepiaPhoto } from './SepiaPhoto';

interface FeaturedPhotoProps {
  photo: string;
  title: string;
  time: string;
  likes: number;
  comments: number;
  liked?: boolean;
  userName?: string;
  userAvatar?: string;
  onLike?: () => void;
  onComment?: () => void;
  onShare?: () => void;
  onPress?: () => void;
  onProfilePress?: () => void;
}

export function FeaturedPhoto({
  photo, title, time, likes, comments,
  liked, userName, userAvatar,
  onLike, onComment, onShare, onPress, onProfilePress,
}: FeaturedPhotoProps) {
  return (
    <View style={styles.container}>
      {/* User attribution */}
      {userName ? (
        <TouchableOpacity
          style={styles.attribution}
          onPress={onProfilePress}
          activeOpacity={0.7}
        >
          {userAvatar ? (
            <Image source={{ uri: userAvatar }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarInitial}>
                {userName.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <Text style={styles.userName}>{userName}</Text>
        </TouchableOpacity>
      ) : null}

      <TouchableOpacity
        activeOpacity={0.9}
        onPress={onPress}
        style={styles.photoWrap}
      >
        <SepiaPhoto
          uri={photo}
          style={styles.photo}
          imageStyle={StyleSheet.absoluteFillObject}
        />
        {/* Caption gradient */}
        <LinearGradient
          colors={['transparent', 'rgba(20,12,6,0.62)']}
          style={styles.captionGradient}
          pointerEvents="none"
        />
        <View style={styles.captionWrap}>
          <Text style={styles.captionTitle}>{title}</Text>
          <Text style={styles.captionTime}>{time}</Text>
        </View>
      </TouchableOpacity>

      {/* Action strip */}
      <View style={styles.actions}>
        <TouchableOpacity onPress={onLike} style={styles.actionBtn} hitSlop={8}>
          <Heart
            size={14}
            color={liked ? PAPER.inkDark : PAPER.inkMid}
            fill={liked ? PAPER.inkDark : 'none'}
            strokeWidth={1.4}
          />
          <Text style={styles.actionCount}>{likes}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={onComment} style={styles.actionBtn} hitSlop={8}>
          <MessageCircle size={14} color={PAPER.inkMid} strokeWidth={1.4} />
          <Text style={styles.actionCount}>{comments}</Text>
        </TouchableOpacity>

        <View style={{ flex: 1 }} />

        <TouchableOpacity onPress={onShare} style={styles.actionBtn} hitSlop={8}>
          <Share2 size={14} color={PAPER.inkMid} strokeWidth={1.4} />
          <Text style={styles.actionLabel}>Share</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 24,
    paddingTop: 6,
    paddingBottom: 12,
  },
  attribution: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PAPER.rule,
  },
  avatarFallback: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: PAPER.inkDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontFamily: SERIF,
    fontSize: 13,
    color: PAPER.inkDark,
  },
  userName: {
    fontFamily: SERIF_ITALIC,
    fontSize: 13,
    color: PAPER.inkDark,
    letterSpacing: 0.2,
  },
  photoWrap: {
    width: '100%',
    aspectRatio: 16 / 11,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PAPER.photoBorder,
    borderRadius: 2,
    overflow: 'hidden',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  captionGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 92,
  },
  captionWrap: {
    position: 'absolute',
    left: 14,
    bottom: 12,
  },
  captionTitle: {
    fontFamily: SERIF,
    fontSize: 16,
    color: '#fff',
    letterSpacing: -0.1,
    lineHeight: 18,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  captionTime: {
    fontSize: 11,
    color: '#fff',
    marginTop: 4,
    letterSpacing: 0.5,
    opacity: 0.92,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 22,
    paddingTop: 14,
    paddingHorizontal: 2,
    paddingBottom: 4,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  actionCount: {
    fontSize: 12,
    color: PAPER.inkMid,
    fontVariant: ['tabular-nums'],
  },
  actionLabel: {
    fontSize: 12,
    color: PAPER.inkMid,
    letterSpacing: 0.3,
  },
});
