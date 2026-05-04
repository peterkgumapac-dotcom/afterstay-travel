import { useRouter } from 'expo-router';
import { Camera, Plus } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { CreateBar, type CreateType } from '@/components/feed/CreateBar';
import { FeedCard } from '@/components/feed/FeedCard';
import { FEED } from '@/components/feed/feedTheme';
import type { useFeedPosts } from '@/hooks/useFeedPosts';
import { useAuth } from '@/lib/auth';
import { togglePostLike, getPostComments, addPostComment, getPublicProfiles } from '@/lib/supabase';
import type { FeedPost, FeedPostComment } from '@/lib/types';

// ── Profile fetcher for feed posts ──────────────────────────────
type ProfileMap = Record<string, { name: string; avatar?: string }>;

export function useProfilesForPosts(posts: FeedPost[]): ProfileMap {
  const [profiles, setProfiles] = useState<ProfileMap>({});
  const [checkedIds, setCheckedIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    const userIds = [...new Set(posts.map(p => p.userId).filter(Boolean))];
    const missing = userIds.filter(id => !profiles[id] && !checkedIds.has(id));
    if (missing.length === 0) return;

    getPublicProfiles(missing)
      .then((data) => {
        setProfiles(prev => {
          const next = { ...prev };
          for (const p of data) {
            next[p.id] = {
              name: p.fullName,
              avatar: p.avatarUrl,
            };
          }
          return next;
        });
        setCheckedIds(prev => {
          const next = new Set(prev);
          missing.forEach(id => next.add(id));
          return next;
        });
      })
      .catch(() => {
        setCheckedIds(prev => {
          const next = new Set(prev);
          missing.forEach(id => next.add(id));
          return next;
        });
      });
  }, [posts, profiles, checkedIds]);

  return profiles;
}

// ── Shared feed list ──────────────────────────────────────────
interface PostFeedListProps {
  feed: ReturnType<typeof useFeedPosts>;
  profiles: ProfileMap;
  header?: React.ReactElement;
}

export function PostFeedList({ feed, profiles, header }: PostFeedListProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [commentCache, setCommentCache] = useState<Record<string, FeedPostComment[]>>({});

  const handleCreate = useCallback((type: CreateType) => {
    switch (type) {
      case 'photo': router.push('/add-moment'); break;
      case 'text': router.push('/create-post' as never); break;
      case 'trip': router.push('/create-post' as never); break;
      case 'budget': router.push('/create-post' as never); break;
      case 'summary': router.push('/create-post' as never); break;
    }
  }, [router]);

  return (
    <View style={styles.root}>
      <FlatList
        data={feed.posts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const enriched: FeedPost = {
            ...item,
            userName: profiles[item.userId]?.name ?? item.userName,
            userAvatar: profiles[item.userId]?.avatar ?? item.userAvatar,
          };
          const canOpenProfile = Boolean(
            item.userId && (item.userId === user?.id || enriched.userName || enriched.userAvatar),
          );
          return (
            <FeedCard
              post={enriched}
              comments={commentCache[item.id] ?? []}
              onLike={() => togglePostLike(item.id).catch(() => {})}
              onComment={async (text) => {
                try {
                  const c = await addPostComment(item.id, text);
                  setCommentCache((prev) => ({
                    ...prev,
                    [item.id]: [...(prev[item.id] ?? []), c],
                  }));
                } catch {}
              }}
              onProfilePress={canOpenProfile ? () => router.push({ pathname: '/profile/[userId]', params: { userId: item.userId } } as never) : undefined}
              onPhotoPress={async () => {
                if (!commentCache[item.id]) {
                  try {
                    const c = await getPostComments(item.id);
                    setCommentCache((prev) => ({ ...prev, [item.id]: c }));
                  } catch {}
                }
              }}
            />
          );
        }}
        ListHeaderComponent={
          <>
            {header}
            <CreateBar onSelect={handleCreate} />
          </>
        }
        ListEmptyComponent={
          !feed.isLoading && !feed.isRefreshing ? (
            <View style={styles.emptyWrap}>
              <Camera size={48} color={FEED.inkLight} strokeWidth={1.2} />
              <Text style={styles.emptyTitle}>{feed.error ? 'Feed did not load' : 'No posts yet'}</Text>
              <Text style={styles.emptyText}>
                {feed.error ?? 'Share a photo, write a thought, or post your trip summary.'}
              </Text>
              {feed.error ? (
                <TouchableOpacity
                  style={styles.uploadBtn}
                  onPress={feed.refresh}
                  activeOpacity={0.7}
                >
                  <Text style={styles.uploadBtnText}>Retry</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.uploadBtn}
                  onPress={() => router.push('/add-moment')}
                  activeOpacity={0.7}
                >
                  <Plus size={16} color="#fff" strokeWidth={2.5} />
                  <Text style={styles.uploadBtnText}>Share a Moment</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : null
        }
        ListFooterComponent={
          feed.isLoading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={FEED.terracotta} />
            </View>
          ) : null
        }
        onEndReached={() => {
          if (feed.hasMore) feed.loadMore();
        }}
        onEndReachedThreshold={0.5}
        refreshing={feed.isRefreshing}
        onRefresh={feed.refresh}
        contentContainerStyle={{ paddingBottom: 90, paddingTop: 4 }}
        showsVerticalScrollIndicator={false}
      />

      {/* Upload FAB */}
      {feed.posts.length > 0 && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => router.push('/add-moment')}
          activeOpacity={0.8}
        >
          <Plus size={24} color="#fff" strokeWidth={2.5} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: FEED.bg },
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingTop: 80,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: FEED.ink,
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 14,
    color: FEED.inkLight,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 20,
  },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: FEED.terracotta,
  },
  uploadBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  loadingWrap: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 90,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: FEED.terracotta,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
});
