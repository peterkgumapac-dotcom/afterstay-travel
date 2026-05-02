import { Image } from 'expo-image';
import { Plus } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { PAPER } from '@/components/feed/feedTheme';
import { getStories } from '@/lib/moments/exploreMomentsService';
import type { Story } from '@/lib/types';
import { supabase } from '@/lib/supabase';

interface ExploreStoryRowProps {
  onStoryPress: (stories: Story[], startIndex: number) => void;
  onAddStory: () => void;
  isUploading?: boolean;
  refreshKey?: number;
}

interface StoryGroup {
  userId: string;
  userName: string;
  userAvatar?: string;
  previewUrl?: string;
  stories: Story[];
  hasUnviewed: boolean;
}

const STORY_TIMEOUT_MS = 10000;

function withTimeout<T>(promise: Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Stories timed out')), STORY_TIMEOUT_MS);
    promise
      .then(resolve)
      .catch(reject)
      .finally(() => clearTimeout(timer));
  });
}

function groupByUser(stories: Story[]): StoryGroup[] {
  const map = new Map<string, StoryGroup>();
  for (const s of stories) {
    const existing = map.get(s.userId);
    if (existing) {
      existing.stories.push(s);
      if (!s.viewed) existing.hasUnviewed = true;
    } else {
      map.set(s.userId, {
        userId: s.userId,
        userName: s.userName ?? 'Traveler',
        userAvatar: s.userAvatar,
        previewUrl: s.mediaUrl,
        stories: [s],
        hasUnviewed: !s.viewed,
      });
    }
  }
  return Array.from(map.values());
}

export default function ExploreStoryRow({ onStoryPress, onAddStory, isUploading = false, refreshKey = 0 }: ExploreStoryRowProps) {
  const [groups, setGroups] = useState<StoryGroup[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [failedImages, setFailedImages] = useState<Set<string>>(() => new Set());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id ?? null));
    let cancelled = false;
    setLoading(true);
    setFailedImages(new Set());
    withTimeout(getStories())
      .then((stories) => { if (!cancelled) setGroups(groupByUser(stories)); })
      .catch((err) => {
        if (!cancelled) setGroups([]);
        if (__DEV__) console.error('[ExploreStoryRow] getStories failed:', err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [refreshKey]);

  const myGroup = groups.find((g) => g.userId === currentUserId);
  const otherGroups = groups.filter((g) => g.userId !== currentUserId);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {/* Your Story bubble */}
      <TouchableOpacity
        style={styles.bubble}
        onPress={myGroup ? () => onStoryPress(myGroup.stories, 0) : onAddStory}
        disabled={isUploading}
        activeOpacity={0.7}
      >
        {isUploading ? (
          <View style={[styles.ring, styles.ringAdd]}>
            <ActivityIndicator color={PAPER.stamp} />
          </View>
        ) : myGroup && (myGroup.userAvatar || myGroup.previewUrl) && !failedImages.has(myGroup.userId) ? (
          <View style={[styles.ring, myGroup.hasUnviewed ? styles.ringActive : styles.ringViewed]}>
            <Image
              source={{ uri: myGroup.userAvatar ?? myGroup.previewUrl }}
              style={styles.avatar}
              contentFit="cover"
              onError={() => setFailedImages((prev) => new Set(prev).add(myGroup.userId))}
            />
          </View>
        ) : (
          <View style={[styles.ring, styles.ringAdd]}>
            <View style={styles.addCircle}>
              <Plus size={18} color={PAPER.stamp} strokeWidth={2.5} />
            </View>
          </View>
        )}
        <Text style={styles.name} numberOfLines={1}>Your Story</Text>
      </TouchableOpacity>

      {loading && otherGroups.length === 0 && (
        <View style={styles.loadingBubble}>
          <ActivityIndicator color={PAPER.stamp} />
        </View>
      )}

      {/* Other users' stories */}
      {otherGroups.map((group) => (
        <TouchableOpacity
          key={group.userId}
          style={styles.bubble}
          onPress={() => onStoryPress(group.stories, 0)}
          activeOpacity={0.7}
        >
          <View style={[styles.ring, group.hasUnviewed ? styles.ringActive : styles.ringViewed]}>
            {(group.userAvatar || group.previewUrl) && !failedImages.has(group.userId) ? (
              <Image
                source={{ uri: group.userAvatar ?? group.previewUrl }}
                style={styles.avatar}
                contentFit="cover"
                onError={() => setFailedImages((prev) => new Set(prev).add(group.userId))}
              />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Text style={styles.avatarLetter}>{(group.userName || 'T')[0].toUpperCase()}</Text>
              </View>
            )}
          </View>
          <Text style={styles.name} numberOfLines={1}>{(group.userName || 'Traveler').split(' ')[0]}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const RING_SIZE = 64;
const AVATAR_SIZE = 56;

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 12,
  },
  bubble: {
    alignItems: 'center',
    width: 68,
  },
  loadingBubble: {
    width: 68,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
  },
  ringActive: {
    borderColor: PAPER.stamp,
  },
  ringViewed: {
    borderColor: PAPER.rule,
  },
  ringAdd: {
    borderColor: PAPER.rule,
    borderStyle: 'dashed',
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
  },
  avatarPlaceholder: {
    backgroundColor: PAPER.stamp,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  addCircle: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: PAPER.ivory,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    fontSize: 11,
    color: PAPER.inkDark,
    marginTop: 4,
    textAlign: 'center',
  },
});
