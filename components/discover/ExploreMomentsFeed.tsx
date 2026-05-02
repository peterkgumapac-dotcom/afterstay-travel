import { useRouter } from 'expo-router';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { Camera, Search } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';

import ExploreMomentCard from '@/components/discover/ExploreMomentCard';
import ExploreStoryRow from '@/components/discover/ExploreStoryRow';
import StoryViewer from '@/components/discover/StoryViewer';
import PostCommentSheet from '@/components/discover/PostCommentSheet';
import ProfileSearchSheet from '@/components/discover/ProfileSearchSheet';
import { PAPER } from '@/components/feed/feedTheme';
import { useProfilesForPosts } from '@/components/feed/PostFeedList';
import { useExploreFeed } from '@/hooks/useExploreFeed';
import { useUserSegment } from '@/contexts/UserSegmentContext';
import { useAuth } from '@/lib/auth';
import { togglePostLike } from '@/lib/supabase';
import { sharePost, toggleSave, createStory, deleteStory, getPostTagsForPosts } from '@/lib/moments/exploreMomentsService';
import type { FeedPost, PostTag, Story } from '@/lib/types';

type FeedMode = 'recent' | 'trending' | 'saved';

const CHIPS: { id: FeedMode; label: string }[] = [
  { id: 'recent', label: 'Recent' },
  { id: 'trending', label: 'Trending' },
  { id: 'saved', label: 'Saved' },
];

export default function ExploreMomentsFeed() {
  const router = useRouter();
  const { user } = useAuth();
  const { profile } = useUserSegment();
  const [mode, setMode] = useState<FeedMode>('recent');
  const [searchVisible, setSearchVisible] = useState(false);
  const recentFeed = useExploreFeed('recent', mode === 'recent');
  const trendingFeed = useExploreFeed('trending', mode === 'trending');
  const savedFeed = useExploreFeed('saved', mode === 'saved');
  const activeFeed = mode === 'saved' ? savedFeed : mode === 'trending' ? trendingFeed : recentFeed;
  const refreshActiveFeed = activeFeed.refresh;
  const updateActivePost = activeFeed.updateLocal;
  const profiles = useProfilesForPosts(activeFeed.posts);
  const activePostIdsKey = useMemo(() => activeFeed.posts.map((post) => post.id).join('|'), [activeFeed.posts]);
  const [tagsByPost, setTagsByPost] = useState<Record<string, PostTag[]>>({});

  // Story viewer state
  const [storyViewerVisible, setStoryViewerVisible] = useState(false);
  const [activeStories, setActiveStories] = useState<Story[]>([]);
  const [storyStartIndex, setStoryStartIndex] = useState(0);

  // Comment sheet state
  const [commentPostId, setCommentPostId] = useState<string | null>(null);

  useEffect(() => {
    const postIds = activePostIdsKey ? activePostIdsKey.split('|') : [];
    if (postIds.length === 0) {
      setTagsByPost({});
      return;
    }

    let cancelled = false;
    getPostTagsForPosts(postIds)
      .then((tags) => {
        if (!cancelled) setTagsByPost(tags);
      })
      .catch(() => {
        if (!cancelled) setTagsByPost({});
      });

    return () => {
      cancelled = true;
    };
  }, [activePostIdsKey]);

  const handleStoryPress = useCallback((stories: Story[], startIndex: number) => {
    setActiveStories(stories);
    setStoryStartIndex(startIndex);
    setStoryViewerVisible(true);
  }, []);

  const handleStoryDeleted = useCallback(async (story: Story) => {
    await deleteStory(story.id, story.storagePath);
    setActiveStories((prev) => {
      const next = prev.filter((item) => item.id !== story.id);
      if (next.length === 0) setStoryViewerVisible(false);
      return next;
    });
    setStoryRefreshKey((k) => k + 1);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  const [storyUploading, setStoryUploading] = useState(false);
  const [storyRefreshKey, setStoryRefreshKey] = useState(0);

  const handleAddStory = useCallback(async () => {
    if (storyUploading) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setStoryUploading(true);
      try {
        await createStory({ localUri: result.assets[0].uri });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setStoryRefreshKey((k) => k + 1);
      } catch (err) {
        Alert.alert('Story upload failed', err instanceof Error ? err.message : 'Please try again.');
      } finally {
        setStoryUploading(false);
      }
    }
  }, [storyUploading]);

  // Auto-refresh when returning from composer modal
  const navigation = useNavigation();
  const hasMounted = useRef(false);
  useEffect(() => {
    const unsub = navigation.addListener('focus', () => {
      if (hasMounted.current) {
        refreshActiveFeed();
      }
      hasMounted.current = true;
    });
    return unsub;
  }, [navigation, refreshActiveFeed]);

  const handleCompose = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/compose-moment' as never);
  }, [router]);

  const handlePhotoCompose = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsMultipleSelection: true,
      selectionLimit: 10,
    });
    if (!result.canceled && result.assets.length > 0) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const uris = result.assets.map((a) => a.uri).join(',');
      router.push({ pathname: '/compose-moment', params: { photoUris: uris } } as never);
    }
  }, [router]);

  const handleProfilePress = useCallback(() => {
    if (user?.id) {
      router.push({ pathname: '/profile/[userId]', params: { userId: user.id } } as never);
    }
  }, [user, router]);

  const renderItem = useCallback(({ item }: { item: FeedPost }) => {
    const enriched: FeedPost = {
      ...item,
      userName: profiles[item.userId]?.name ?? item.userName,
      userAvatar: profiles[item.userId]?.avatar ?? item.userAvatar,
    };
    return (
      <ExploreMomentCard
        post={enriched}
        onLike={async () => { await togglePostLike(item.id); }}
        onComment={() => setCommentPostId(item.id)}
        onShare={() => { sharePost(item.id).catch(() => {}); }}
        onSave={async () => { await toggleSave(item.id); }}
        onProfilePress={item.userId ? () => router.push({ pathname: '/profile/[userId]', params: { userId: item.userId } } as never) : undefined}
        tags={tagsByPost[item.id]}
        isOwner={item.userId === user?.id}
        onDeleted={() => refreshActiveFeed()}
        onHidden={() => refreshActiveFeed()}
      />
    );
  }, [profiles, router, user, tagsByPost, refreshActiveFeed]);

  const avatarUri = profile?.avatarUrl;
  const displayName = profile?.fullName?.split(' ')[0] ?? 'traveler';

  const headerContent = (
    <View>
      {/* Compose bar */}
      <View style={styles.composeBar}>
        <TouchableOpacity onPress={handleProfilePress} activeOpacity={0.7}>
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.composeAvatar} />
          ) : (
            <View style={[styles.composeAvatar, styles.composeAvatarPlaceholder]}>
              <Text style={styles.composeAvatarInitial}>
                {displayName.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.composeInput}
          onPress={handleCompose}
          activeOpacity={0.7}
        >
          <Text style={styles.composeInputText}>
            Share a moment, {displayName}...
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.composePhotoBtn}
          onPress={handlePhotoCompose}
          activeOpacity={0.7}
          accessibilityLabel="Add photo"
        >
          <Camera size={20} color={PAPER.inkMid} strokeWidth={1.8} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.composePhotoBtn}
          onPress={() => setSearchVisible(true)}
          activeOpacity={0.7}
          accessibilityLabel="Search travelers"
        >
          <Search size={18} color={PAPER.inkMid} strokeWidth={1.8} />
        </TouchableOpacity>
      </View>

      {/* My Day / Stories */}
      <ExploreStoryRow
        onStoryPress={handleStoryPress}
        onAddStory={handleAddStory}
        isUploading={storyUploading}
        refreshKey={storyRefreshKey}
      />

      {/* Mode chips */}
      <View style={styles.chipRow}>
        {CHIPS.map(({ id, label }) => {
          const active = mode === id;
          return (
            <TouchableOpacity
              key={id}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setMode(id)}
              activeOpacity={0.7}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  return (
    <View style={styles.root}>
      <FlatList
        data={activeFeed.posts}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={headerContent}
        ListEmptyComponent={
          !activeFeed.isLoading && !activeFeed.isRefreshing ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyTitle}>{activeFeed.error ? 'Moments did not load' : mode === 'saved' ? 'No saved moments' : 'No moments yet'}</Text>
              <Text style={styles.emptyText}>
                {activeFeed.error ?? (mode === 'saved' ? 'Bookmark posts to see them here.' : 'Be the first to share a travel moment!')}
              </Text>
              {activeFeed.error && (
                <TouchableOpacity style={styles.retryBtn} onPress={activeFeed.refresh} activeOpacity={0.75}>
                  <Text style={styles.retryText}>Retry</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : null
        }
        ListFooterComponent={
          activeFeed.isLoading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={PAPER.stamp} />
            </View>
          ) : null
        }
        onEndReached={() => {
          if (activeFeed.hasMore) activeFeed.loadMore();
        }}
        onEndReachedThreshold={0.5}
        refreshing={activeFeed.isRefreshing}
        onRefresh={activeFeed.refresh}
        contentContainerStyle={{ paddingBottom: 90 }}
        showsVerticalScrollIndicator={false}
      />

      <ProfileSearchSheet
        visible={searchVisible}
        onClose={() => setSearchVisible(false)}
      />

      {/* Story viewer */}
      <StoryViewer
        visible={storyViewerVisible}
        stories={activeStories}
        initialIndex={storyStartIndex}
        currentUserId={user?.id}
        onClose={() => setStoryViewerVisible(false)}
        onDeleteStory={handleStoryDeleted}
        onProfilePress={(storyUserId) => {
          router.push({ pathname: '/profile/[userId]', params: { userId: storyUserId } } as never);
        }}
      />

      {/* Comment sheet */}
      {commentPostId && (
        <PostCommentSheet
          visible={!!commentPostId}
          postId={commentPostId}
          onClose={() => setCommentPostId(null)}
          onCommentAdded={() => {
            updateActivePost(commentPostId, (post) => ({
              ...post,
              commentsCount: post.commentsCount + 1,
            }));
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: PAPER.ivory },

  /* ── Compose bar ── */
  composeBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    gap: 10,
  },
  composeAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  composeAvatarPlaceholder: {
    backgroundColor: PAPER.postcardEdge,
    alignItems: 'center',
    justifyContent: 'center',
  },
  composeAvatarInitial: {
    fontSize: 16,
    fontWeight: '700',
    color: PAPER.postcardInk,
  },
  composeInput: {
    flex: 1,
    height: 38,
    borderRadius: 19,
    backgroundColor: PAPER.ivoryClean,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PAPER.rule,
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  composeInputText: {
    fontSize: 14,
    color: PAPER.inkLight,
  },
  composePhotoBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: PAPER.ivoryClean,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PAPER.rule,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* ── Mode chips ── */
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: PAPER.rule,
    backgroundColor: PAPER.ivoryClean,
  },
  chipActive: {
    backgroundColor: PAPER.inkDark,
    borderColor: PAPER.inkDark,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '500',
    color: PAPER.inkMid,
  },
  chipTextActive: {
    color: PAPER.ivory,
    fontWeight: '700',
  },

  /* ── Empty / loading ── */
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingTop: 80,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: PAPER.inkDark,
    textAlign: 'center',
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 14,
    color: PAPER.inkLight,
    textAlign: 'center',
    lineHeight: 21,
  },
  retryBtn: {
    marginTop: 14,
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: PAPER.inkDark,
  },
  retryText: {
    fontSize: 13,
    fontWeight: '700',
    color: PAPER.ivory,
  },
  loadingWrap: {
    paddingVertical: 24,
    alignItems: 'center',
  },
});
