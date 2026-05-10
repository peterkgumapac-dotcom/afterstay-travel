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
import { useTheme } from '@/constants/ThemeContext';
import { useProfilesForPosts } from '@/components/feed/PostFeedList';
import { useExploreFeed } from '@/hooks/useExploreFeed';
import { useUserSegment } from '@/contexts/UserSegmentContext';
import { useAuth } from '@/lib/auth';
import { CONFIG } from '@/lib/config';
import { isTravelPulsePost } from '@/lib/officialAccount';
import { pushProfile } from '@/lib/profileNavigation';
import { togglePostLike } from '@/lib/supabase';
import { resolveRenderableStorageUrl } from '@/lib/storageMedia';
import { sharePost, toggleSave, createStory, deleteStory, getPostTagsForPosts } from '@/lib/moments/exploreMomentsService';
import type { FeedPost, PostTag, Story } from '@/lib/types';

type FeedMode = 'recent' | 'trending' | 'saved';

const CHIPS: { id: FeedMode; label: string }[] = [
  { id: 'recent', label: 'Recent' },
  { id: 'trending', label: 'Trending' },
  { id: 'saved', label: 'Saved Ideas' },
];

function PaperTexture() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[styles.paperFiber, styles.paperFiberOne]} />
      <View style={[styles.paperFiber, styles.paperFiberTwo]} />
      <View style={[styles.paperFiber, styles.paperFiberThree]} />
      <View style={[styles.paperStain, styles.paperStainTop]} />
      <View style={[styles.paperStain, styles.paperStainBottom]} />
    </View>
  );
}

function canOpenProfileIdentity(item: Pick<FeedPost, 'userId' | 'userName' | 'userAvatar'>, currentUserId?: string): boolean {
  if (!item.userId) return false;
  if (item.userId === currentUserId) return true;
  return Boolean(item.userName || item.userAvatar);
}

export default function ExploreMomentsFeed() {
  const router = useRouter();
  const { colors } = useTheme();
  const { user } = useAuth();
  const { profile } = useUserSegment();
  const [mode, setMode] = useState<FeedMode>('recent');
  const [searchVisible, setSearchVisible] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [resolvedAvatarUri, setResolvedAvatarUri] = useState<string | undefined>();
  const recentFeed = useExploreFeed('recent', mode === 'recent');
  const trendingFeed = useExploreFeed('trending', mode === 'trending');
  const savedFeed = useExploreFeed('saved', mode === 'saved');
  const activeFeed = mode === 'saved' ? savedFeed : mode === 'trending' ? trendingFeed : recentFeed;
  const refreshActiveFeed = activeFeed.refresh;
  const updateActivePost = activeFeed.updateLocal;
  const officialAfterStayUserId = CONFIG.OFFICIAL_AFTERSTAY_USER_ID;
  const activeFeedHasTravelPulse = useMemo(
    () => activeFeed.posts.some((post) => isTravelPulsePost(post)),
    [activeFeed.posts],
  );
  const extraProfileIds = useMemo(
    () => (activeFeedHasTravelPulse && officialAfterStayUserId ? [officialAfterStayUserId] : []),
    [activeFeedHasTravelPulse, officialAfterStayUserId],
  );
  const profiles = useProfilesForPosts(activeFeed.posts, extraProfileIds);
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
    const task = setTimeout(() => {
      getPostTagsForPosts(postIds)
        .then((tags) => {
          if (!cancelled) setTagsByPost(tags);
        })
        .catch(() => {
          if (!cancelled) setTagsByPost({});
        });
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(task);
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
      // Direct route — skip the /profile/me redirect frame.
      router.push({ pathname: '/profile/[userId]', params: { userId: user.id, source: 'self' } } as never);
    }
  }, [user, router]);

  const renderItem = useCallback(({ item }: { item: FeedPost }) => {
    const isTravelPulse = isTravelPulsePost(item);
    const authorUserId = isTravelPulse && officialAfterStayUserId ? officialAfterStayUserId : item.userId;
    const authorProfile = authorUserId ? profiles[authorUserId] : undefined;
    const enriched: FeedPost = {
      ...item,
      userName: isTravelPulse ? authorProfile?.name ?? 'AfterStay' : authorProfile?.name ?? item.userName,
      userAvatar: authorProfile?.avatar ?? item.userAvatar,
    };
    const canOpenProfile = isTravelPulse
      ? Boolean(officialAfterStayUserId)
      : canOpenProfileIdentity(enriched, user?.id);
    return (
      <ExploreMomentCard
        post={enriched}
        onLike={async () => { await togglePostLike(item.id); }}
        onComment={() => setCommentPostId(item.id)}
        onShare={() => { sharePost(item.id).catch(() => {}); }}
        onSave={async () => { await toggleSave(item.id); }}
        onProfilePress={canOpenProfile ? () => pushProfile(router, authorUserId, user?.id) : undefined}
        tags={tagsByPost[item.id]}
        isOwner={item.userId === user?.id}
        onDeleted={() => refreshActiveFeed()}
        onHidden={() => refreshActiveFeed()}
      />
    );
  }, [officialAfterStayUserId, profiles, router, user, tagsByPost, refreshActiveFeed]);

  const avatarUri = profile?.avatarUrl;
  const displayName = profile?.fullName?.split(' ')[0] ?? 'traveler';
  const showAvatarPhoto = Boolean(resolvedAvatarUri && !avatarFailed);

  useEffect(() => {
    let cancelled = false;
    setAvatarFailed(false);
    setResolvedAvatarUri(undefined);
    if (!avatarUri) return () => { cancelled = true; };
    resolveRenderableStorageUrl(avatarUri, 'avatars')
      .then((url) => {
        if (!cancelled) setResolvedAvatarUri(url);
      })
      .catch(() => {
        if (!cancelled) setResolvedAvatarUri(avatarUri);
      });
    return () => { cancelled = true; };
  }, [avatarUri]);

  const headerContent = useMemo(() => (
    <View style={styles.headerPaper}>
      <PaperTexture />
      {/* Compose bar */}
      <View style={styles.composeBar}>
        <View style={styles.composeInputCluster}>
          <TouchableOpacity
            onPress={handleProfilePress}
            activeOpacity={0.7}
            style={styles.composeAvatarAnchor}
            accessibilityLabel="Open your profile"
          >
            {showAvatarPhoto ? (
              <Image
                source={{ uri: resolvedAvatarUri }}
                style={styles.composeAvatar}
                contentFit="cover"
                onError={() => setAvatarFailed(true)}
              />
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
            <Text style={styles.composeInputText} numberOfLines={1}>
              Share a moment, {displayName}...
            </Text>
          </TouchableOpacity>
        </View>

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
  ), [
    avatarFailed,
    displayName,
    handleAddStory,
    handleCompose,
    handlePhotoCompose,
    handleProfilePress,
    handleStoryPress,
    mode,
    resolvedAvatarUri,
    showAvatarPhoto,
    storyRefreshKey,
    storyUploading,
  ]);

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
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
        onEndReachedThreshold={0.25}
        initialNumToRender={3}
        maxToRenderPerBatch={3}
        updateCellsBatchingPeriod={80}
        windowSize={5}
        removeClippedSubviews
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
          const story = activeStories.find((item) => item.userId === storyUserId);
          if (!story || !canOpenProfileIdentity(story, user?.id)) return;
          pushProfile(router, storyUserId, user?.id);
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
  root: { flex: 1 },
  headerPaper: {
    marginHorizontal: 12,
    marginTop: 6,
    marginBottom: 10,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(184, 169, 140, 0.58)',
    backgroundColor: PAPER.ivory,
    overflow: 'hidden',
    shadowColor: '#3d2a12',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 1,
  },
  paperFiber: {
    position: 'absolute',
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(61, 42, 18, 0.08)',
    transform: [{ rotate: '-5deg' }],
  },
  paperFiberOne: {
    width: '74%',
    top: 42,
    left: -24,
  },
  paperFiberTwo: {
    width: '56%',
    top: 132,
    right: -12,
  },
  paperFiberThree: {
    width: '82%',
    bottom: 44,
    left: 34,
    backgroundColor: 'rgba(255, 255, 255, 0.20)',
  },
  paperStain: {
    position: 'absolute',
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: 'rgba(157, 112, 55, 0.06)',
  },
  paperStainTop: {
    top: -54,
    right: -26,
  },
  paperStainBottom: {
    bottom: -66,
    left: -30,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
  },

  /* ── Compose bar ── */
  composeBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 22,
    paddingBottom: 12,
    gap: 10,
  },
  composeInputCluster: {
    flex: 1,
    position: 'relative',
    justifyContent: 'center',
  },
  composeAvatarAnchor: {
    position: 'absolute',
    left: 0,
    top: 0,
    zIndex: 3,
    borderRadius: 23,
    borderWidth: 3,
    borderColor: PAPER.ivory,
    backgroundColor: PAPER.ivory,
  },
  composeAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
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
    height: 44,
    borderRadius: 22,
    backgroundColor: PAPER.ivoryClean,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PAPER.rule,
    justifyContent: 'center',
    paddingLeft: 58,
    paddingRight: 14,
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
