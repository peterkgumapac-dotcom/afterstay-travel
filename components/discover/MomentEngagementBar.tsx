import * as Haptics from 'expo-haptics';
import { Bookmark, Heart, MessageCircle, Share2 } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';

import { PAPER } from '@/components/feed/feedTheme';

const ACTIVE_COLOR = PAPER.stamp;

interface MomentEngagementBarProps {
  likesCount: number;
  commentsCount: number;
  saveCount: number;
  shareCount: number;
  viewerHasLiked?: boolean;
  viewerHasSaved?: boolean;
  onLike: () => Promise<void> | void;
  onComment: () => void;
  onShare: () => void;
  onSave: () => Promise<void> | void;
}

export default function MomentEngagementBar({
  likesCount,
  commentsCount,
  saveCount,
  shareCount,
  viewerHasLiked = false,
  viewerHasSaved = false,
  onLike,
  onComment,
  onShare,
  onSave,
}: MomentEngagementBarProps) {
  const [liked, setLiked] = useState(viewerHasLiked);
  const [saved, setSaved] = useState(viewerHasSaved);
  const [localLikes, setLocalLikes] = useState(likesCount);
  const [localSaves, setLocalSaves] = useState(saveCount);

  const heartScale = useSharedValue(1);

  const heartStyle = useAnimatedStyle(() => ({
    transform: [{ scale: heartScale.value }],
  }));

  const handleLike = useCallback(async () => {
    const wasLiked = liked;
    setLiked(!wasLiked);
    setLocalLikes((c) => c + (wasLiked ? -1 : 1));

    if (!wasLiked) {
      heartScale.value = withSequence(
        withSpring(1.3, { damping: 4, stiffness: 300 }),
        withTiming(1, { duration: 150 }),
      );
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    try {
      await onLike();
    } catch {
      setLiked(wasLiked);
      setLocalLikes((c) => c + (wasLiked ? 1 : -1));
    }
  }, [liked, onLike, heartScale]);

  const handleSave = useCallback(async () => {
    const wasSaved = saved;
    setSaved(!wasSaved);
    setLocalSaves((c) => c + (wasSaved ? -1 : 1));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      await onSave();
    } catch {
      setSaved(wasSaved);
      setLocalSaves((c) => c + (wasSaved ? 1 : -1));
    }
  }, [saved, onSave]);

  return (
    <View style={styles.bar}>
      <View style={styles.left}>
        <TouchableOpacity style={styles.action} onPress={handleLike} activeOpacity={0.7}>
          <Animated.View style={heartStyle}>
            <Heart
              size={20}
              color={liked ? ACTIVE_COLOR : PAPER.inkMid}
              fill={liked ? ACTIVE_COLOR : 'none'}
              strokeWidth={1.8}
            />
          </Animated.View>
          {localLikes > 0 && <Text style={[styles.count, liked && styles.countActive]}>{localLikes}</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={styles.action} onPress={onComment} activeOpacity={0.7}>
          <MessageCircle size={20} color={PAPER.inkMid} strokeWidth={1.8} />
          {commentsCount > 0 && <Text style={styles.count}>{commentsCount}</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={styles.action} onPress={onShare} activeOpacity={0.7}>
          <Share2 size={18} color={PAPER.inkMid} strokeWidth={1.8} />
          {shareCount > 0 && <Text style={styles.count}>{shareCount}</Text>}
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.action} onPress={handleSave} activeOpacity={0.7}>
        <Bookmark
          size={20}
          color={saved ? ACTIVE_COLOR : PAPER.inkMid}
          fill={saved ? ACTIVE_COLOR : 'none'}
          strokeWidth={1.8}
        />
        {localSaves > 0 && <Text style={[styles.count, saved && styles.countActive]}>{localSaves}</Text>}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  count: {
    fontSize: 13,
    fontWeight: '600',
    color: PAPER.inkMid,
  },
  countActive: {
    color: ACTIVE_COLOR,
  },
});
