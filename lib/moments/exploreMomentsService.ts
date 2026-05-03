import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import { base64ToBytes } from '@/lib/base64';
import { compressImage } from '@/lib/compressImage';
import { getPublicProfiles, searchProfiles as searchPublicProfiles, supabase } from '@/lib/supabase';
import type { FeedPost, PostMedia, PostTag, Story } from '@/lib/types';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_KEY ?? '';

// ── Feed ────────────────────────────────────────────────────────

interface ExploreFeedParams {
  mode?: 'recent' | 'trending';
  locationName?: string;
  limit?: number;
  offset?: number;
}

function mapRpcPost(row: Record<string, unknown>): FeedPost {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    type: row.type as FeedPost['type'],
    caption: (row.caption as string) ?? undefined,
    photoUrl: (row.photo_url as string) ?? undefined,
    locationName: (row.location_name as string) ?? undefined,
    latitude: row.latitude as number | undefined,
    longitude: row.longitude as number | undefined,
    layoutType: (row.layout_type as FeedPost['layoutType']) ?? undefined,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    media: Array.isArray(row.media) ? (row.media as PostMedia[]) : [],
    likesCount: (row.likes_count as number) ?? 0,
    commentsCount: (row.comments_count as number) ?? 0,
    saveCount: (row.save_count as number) ?? 0,
    shareCount: (row.share_count as number) ?? 0,
    isPublic: true,
    createdAt: row.created_at as string,
    userName: (row.user_name as string) ?? undefined,
    userAvatar: (row.user_avatar as string) ?? undefined,
    viewerHasLiked: (row.viewer_has_liked as boolean) ?? false,
    viewerHasSaved: (row.viewer_has_saved as boolean) ?? false,
  };
}

function withUploadTimeout<T>(promise: Promise<T>, message: string, ms = 45_000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then((value) => {
      clearTimeout(timer);
      resolve(value);
    }, (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

function encodeStoragePath(path: string): string {
  return path.split('/').map(encodeURIComponent).join('/');
}

async function readFileAsBytes(uri: string): Promise<Uint8Array> {
  if (uri.startsWith('file://') || uri.startsWith('/')) {
    const fetchUri = uri.startsWith('/') ? `file://${uri}` : uri;
    try {
      const response = await fetch(fetchUri);
      if (typeof response.arrayBuffer === 'function') {
        const buffer = await response.arrayBuffer();
        return new Uint8Array(buffer);
      }
    } catch {
      // Fall through to FileSystem for Android file/content URI edge cases.
    }
  }
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return base64ToBytes(base64);
}

async function uploadLocalFileToStorage(input: {
  bucket: string;
  path: string;
  fileUri: string;
  contentType: string;
  upsert?: boolean;
  timeoutMs?: number;
}): Promise<void> {
  const fileUri = input.fileUri.startsWith('/') ? `file://${input.fileUri}` : input.fileUri;
  const uploadAsync = (FileSystem as typeof FileSystem & {
    uploadAsync?: typeof FileSystem.uploadAsync;
  }).uploadAsync;
  const binaryUploadType = (FileSystem as typeof FileSystem & {
    FileSystemUploadType?: { BINARY_CONTENT?: FileSystem.FileSystemUploadType };
  }).FileSystemUploadType?.BINARY_CONTENT;

  if (typeof uploadAsync === 'function' && binaryUploadType) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token || SUPABASE_KEY;
    const url = `${SUPABASE_URL}/storage/v1/object/${input.bucket}/${encodeStoragePath(input.path)}`;
    const result = await withUploadTimeout(
      uploadAsync(url, fileUri, {
        httpMethod: 'POST',
        uploadType: binaryUploadType,
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${token}`,
          'Content-Type': input.contentType,
          'x-upsert': input.upsert ? 'true' : 'false',
        },
      }),
      'Photo upload timed out. Please check your connection and try again.',
      input.timeoutMs ?? 150_000,
    );
    if (result.status < 200 || result.status >= 300) {
      let message = result.body || `HTTP ${result.status}`;
      try {
        const parsed = JSON.parse(result.body) as { message?: string; error?: string };
        message = parsed.message || parsed.error || message;
      } catch {
        // Storage may return plain text.
      }
      throw new Error(message);
    }
    return;
  }

  const bytes = await withUploadTimeout(
    readFileAsBytes(fileUri),
    'Photo upload timed out. Please check your connection and try again.',
    input.timeoutMs ?? 150_000,
  );
  const { error } = await withUploadTimeout(
    supabase.storage.from(input.bucket).upload(input.path, bytes, {
      contentType: input.contentType,
      upsert: input.upsert ?? false,
    }),
    'Photo upload timed out. Please check your connection and try again.',
    input.timeoutMs ?? 150_000,
  );
  if (error) throw new Error(error.message);
}

export async function getExploreFeed(params: ExploreFeedParams = {}): Promise<FeedPost[]> {
  const { mode = 'recent', locationName, limit = 20, offset = 0 } = params;

  const { data, error } = await supabase.rpc('get_explore_feed', {
    p_mode: mode,
    p_location: locationName ?? null,
    p_limit: limit,
    p_offset: offset,
  });

  if (error) throw new Error(`getExploreFeed: ${error.message}`);
  return ((data as Record<string, unknown>[]) ?? []).map(mapRpcPost);
}

// ── Create Post ─────────────────────────────────────────────────

interface CreatePostInput {
  caption?: string;
  locationName?: string;
  placeId?: string;
  tripId?: string;
  layoutType?: FeedPost['layoutType'];
  localMediaUris: string[];
}

async function uploadMedia(
  userId: string,
  postId: string,
  uri: string,
  index: number,
): Promise<{ storagePath: string; mediaUrl: string }> {
  if (/\.(mp4|mov|avi|webm|m4v)(\?|#|$)/i.test(uri)) {
    throw new Error('Explore photo posts do not support videos yet. Save videos to a Trip Album instead.');
  }
  const uploadUri = await compressImage(uri, 1000, 0.68).catch(() => uri);
  const storagePath = `posts/${userId}/${postId}/${index}.jpg`;
  const contentType = 'image/jpeg';

  await uploadLocalFileToStorage({
    bucket: 'moments',
    path: storagePath,
    fileUri: uploadUri,
    contentType,
    upsert: true,
    timeoutMs: 150_000,
  });

  const { data: urlData } = supabase.storage.from('moments').getPublicUrl(storagePath);
  return { storagePath, mediaUrl: urlData.publicUrl };
}

function resolvePostType(count: number, layoutType?: FeedPost['layoutType']): FeedPost['type'] {
  if (count <= 1) return 'photo';
  if (layoutType === 'polaroid_stack') return 'collage';
  return 'carousel';
}

function resolveLayoutType(count: number): FeedPost['layoutType'] {
  if (count <= 1) return 'single';
  if (count <= 5) return 'polaroid_stack';
  return 'carousel';
}

export async function createExplorePost(input: CreatePostInput): Promise<FeedPost> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('createExplorePost: not authenticated');

  const layout = input.layoutType ?? resolveLayoutType(input.localMediaUris.length);
  const postType = resolvePostType(input.localMediaUris.length, layout);

  // Create post row first
  const { data: post, error: postErr } = await supabase
    .from('feed_posts')
    .insert({
      user_id: user.id,
      type: postType,
      caption: input.caption ?? null,
      location_name: input.locationName ?? null,
      trip_id: input.tripId ?? null,
      layout_type: layout,
      photo_url: null,
      is_public: true,
    })
    .select()
    .single();

  if (postErr || !post) throw new Error(`createExplorePost: ${postErr?.message ?? 'insert failed'}`);

  const postId = post.id as string;

  // Upload media + insert rows — clean up post on failure
  let uploads: { storagePath: string; mediaUrl: string }[] = [];
  try {
    for (let i = 0; i < input.localMediaUris.length; i++) {
      const uri = input.localMediaUris[i];
      uploads.push(await withUploadTimeout(
        uploadMedia(user.id, postId, uri, i),
        'Photo upload timed out. Please check your connection and try again.',
        150_000,
      ));
    }

    const mediaRows = uploads.map((u, i) => ({
      post_id: postId,
      media_url: u.mediaUrl,
      storage_path: u.storagePath,
      media_type: 'image',
      order_index: i,
    }));

    const { error: mediaErr } = await supabase.from('post_media').insert(mediaRows);
    if (mediaErr) throw new Error(`createExplorePost media: ${mediaErr.message}`);

    const { count, error: verifyErr } = await supabase
      .from('post_media')
      .select('id', { count: 'exact', head: true })
      .eq('post_id', postId);
    if (verifyErr) throw new Error(`createExplorePost verify: ${verifyErr.message}`);
    if ((count ?? 0) < mediaRows.length) throw new Error('createExplorePost verify: media rows were not saved');
  } catch (err) {
    // Clean up orphaned post row on upload/insert failure
    if (uploads.length > 0) {
      await supabase.storage.from('moments').remove(uploads.map((upload) => upload.storagePath)).catch(() => {});
    }
    await supabase.from('feed_posts').delete().eq('id', postId);
    throw err;
  }

  // Update photo_url on post with the first image (non-critical fallback field)
  if (uploads.length > 0) {
    try {
      await supabase.from('feed_posts').update({ photo_url: uploads[0].mediaUrl }).eq('id', postId);
    } catch (err) {
      // photo_url is a fallback — post_media is the source of truth
      if (__DEV__) console.warn('[exploreMoments] photo_url update failed (non-critical):', err);
    }
  }

  return {
    id: postId,
    userId: user.id,
    type: postType,
    caption: input.caption,
    locationName: input.locationName,
    layoutType: layout,
    photoUrl: uploads[0]?.mediaUrl,
    metadata: {},
    media: uploads.map((u, i) => ({
      id: '',
      mediaUrl: u.mediaUrl,
      storagePath: u.storagePath,
      mediaType: 'image',
      orderIndex: i,
    })),
    likesCount: 0,
    commentsCount: 0,
    saveCount: 0,
    shareCount: 0,
    isPublic: true,
    createdAt: new Date().toISOString(),
  };
}

// ── Save / Bookmark ─────────────────────────────────────────────

export async function toggleSave(postId: string): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('toggleSave: not authenticated');

  // Atomic: try insert first, delete on conflict (unique constraint handles race)
  const { error } = await supabase
    .from('post_saves')
    .insert({ user_id: user.id, post_id: postId });

  if (error) {
    // Unique violation = already saved → unsave
    if (error.code === '23505') {
      await supabase.from('post_saves').delete().eq('user_id', user.id).eq('post_id', postId);
      return false;
    }
    throw new Error(`toggleSave: ${error.message}`);
  }
  return true;
}

// ── Share ───────────────────────────────────────────────────────

export async function sharePost(postId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();

  // Record share in DB if authenticated
  if (user) {
    try {
      await supabase.from('post_shares').insert({ user_id: user.id, post_id: postId });
    } catch {
      // Non-critical — don't block native share if DB insert fails
    }
  }

  const available = await Sharing.isAvailableAsync();
  if (available) {
    await Sharing.shareAsync(`https://afterstay.travel/post/${postId}`);
  }
}

// ── Stories ─────────────────────────────────────────────────────

function mapStory(row: Record<string, unknown>, viewed: boolean): Story {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    mediaUrl: row.media_url as string,
    storagePath: row.storage_path as string,
    caption: (row.caption as string) ?? undefined,
    placeId: (row.place_id as string) ?? undefined,
    locationName: (row.location_name as string) ?? undefined,
    visibility: (row.visibility as string) ?? 'public',
    createdAt: row.created_at as string,
    expiresAt: row.expires_at as string,
    userName: (row.user_name as string) ?? (row.full_name as string) ?? undefined,
    userAvatar: (row.user_avatar as string) ?? (row.avatar_url as string) ?? undefined,
    viewed,
  };
}

async function getProfilesById(userIds: string[]): Promise<Map<string, { fullName?: string; avatarUrl?: string }>> {
  const profilesById = new Map<string, { fullName?: string; avatarUrl?: string }>();
  const publicProfiles = await getPublicProfiles(userIds).catch(() => []);
  for (const profile of publicProfiles) {
    profilesById.set(profile.id, {
      fullName: profile.fullName,
      avatarUrl: profile.avatarUrl,
    });
  }
  return profilesById;
}

export async function getStories(): Promise<Story[]> {
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id;

  const { data: stories, error } = await supabase
    .from('stories')
    .select('*')
    .gt('expires_at', new Date().toISOString())
    .eq('visibility', 'public')
    .order('created_at', { ascending: false });

  if (error) throw new Error(`getStories: ${error.message}`);

  const userIds = [...new Set((stories ?? []).map((s) => s.user_id as string).filter(Boolean))];
  const profilesById = await getProfilesById(userIds);

  // Get viewed story IDs for current user
  let viewedIds = new Set<string>();
  if (userId) {
    const { data: views } = await supabase
      .from('story_views')
      .select('story_id')
      .eq('user_id', userId);
    viewedIds = new Set((views ?? []).map((v) => v.story_id as string));
  }

  return (stories ?? []).map((s) => {
    const profile = profilesById.get(s.user_id as string);
    const row = {
      ...s,
      full_name: profile?.fullName,
      avatar_url: profile?.avatarUrl,
    };
    return mapStory(row as Record<string, unknown>, viewedIds.has(s.id as string));
  });
}

export async function getUserStories(userId: string): Promise<Story[]> {
  const { data: { user } } = await supabase.auth.getUser();
  const viewerId = user?.id;

  let query = supabase
    .from('stories')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (viewerId !== userId) {
    query = query
      .gt('expires_at', new Date().toISOString())
      .eq('visibility', 'public');
  }

  const { data: stories, error } = await query;
  if (error) throw new Error(`getUserStories: ${error.message}`);

  const profile = (await getPublicProfiles([userId]).catch(() => []))[0];

  let viewedIds = new Set<string>();
  if (viewerId) {
    const ids = (stories ?? []).map((s) => s.id as string);
    if (ids.length > 0) {
      const { data: views } = await supabase
        .from('story_views')
        .select('story_id')
        .eq('user_id', viewerId)
        .in('story_id', ids);
      viewedIds = new Set((views ?? []).map((v) => v.story_id as string));
    }
  }

  return (stories ?? []).map((story) => mapStory({
    ...story,
    full_name: profile?.fullName,
    avatar_url: profile?.avatarUrl,
  } as Record<string, unknown>, viewedIds.has(story.id as string)));
}

export async function createStory(input: {
  localUri: string;
  caption?: string;
  locationName?: string;
}): Promise<Story> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('createStory: not authenticated');
  const localUri = input.localUri?.trim();
  if (!localUri) throw new Error('createStory: localUri is required');

  const storyId = 'xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
  const compressedUri = await compressImage(localUri, 1200, 0.8);
  const ext = 'jpg';
  const storagePath = `stories/${user.id}/${storyId}.${ext}`;
  const contentType = 'image/jpeg';

  await uploadLocalFileToStorage({
    bucket: 'moments',
    path: storagePath,
    fileUri: compressedUri,
    contentType,
    upsert: true,
    timeoutMs: 150_000,
  });

  const { data: urlData } = supabase.storage.from('moments').getPublicUrl(storagePath);
  if (!urlData.publicUrl) throw new Error('createStory: public URL could not be generated');

  let story: Record<string, unknown> | null = null;
  try {
    const { data, error } = await supabase
      .from('stories')
      .insert({
        id: storyId,
        user_id: user.id,
        media_url: urlData.publicUrl,
        storage_path: storagePath,
        caption: input.caption ?? null,
        location_name: input.locationName ?? null,
        visibility: 'public',
      })
      .select()
      .single();

    if (error || !data) throw new Error(`createStory: ${error?.message ?? 'insert failed'}`);
    story = data as Record<string, unknown>;
  } catch (error) {
    await supabase.storage.from('moments').remove([storagePath]).catch(() => {});
    throw error;
  }

  return mapStory(story, false);
}

export async function deleteStory(storyId: string, storagePath?: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('deleteStory: not authenticated');

  const { error } = await supabase
    .from('stories')
    .delete()
    .eq('id', storyId)
    .eq('user_id', user.id);

  if (error) throw new Error(`deleteStory: ${error.message}`);

  if (storagePath) {
    await supabase.storage.from('moments').remove([storagePath]).catch(() => {});
  }
}

export async function markStoryViewed(storyId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from('story_views')
    .upsert({ user_id: user.id, story_id: storyId });
}

// ── Photo Tagging ───────────────────────────────────────────────

export async function tagUsersInPost(postId: string, userIds: string[]): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('tagUsersInPost: not authenticated');

  const rows = userIds.map((uid) => ({
    post_id: postId,
    tagged_user_id: uid,
    tagged_by_user_id: user.id,
  }));

  const { error } = await supabase.from('post_tags').upsert(rows, { onConflict: 'post_id,tagged_user_id' });
  if (error) throw new Error(`tagUsersInPost: ${error.message}`);
}

export async function removeTag(postId: string, taggedUserId: string): Promise<void> {
  await supabase.from('post_tags').delete().eq('post_id', postId).eq('tagged_user_id', taggedUserId);
}

export async function getPostTags(postId: string): Promise<PostTag[]> {
  const { data, error } = await supabase
    .from('post_tags')
    .select('*, profiles(full_name, avatar_url)')
    .eq('post_id', postId)
    .order('created_at');

  if (error) throw new Error(`getPostTags: ${error.message}`);

  return (data ?? []).map((row) => {
    const profile = (row as Record<string, unknown>).profiles as Record<string, unknown> | null;
    return {
      id: row.id as string,
      postId: row.post_id as string,
      taggedUserId: row.tagged_user_id as string,
      taggedByUserId: row.tagged_by_user_id as string,
      userName: (profile?.full_name as string) ?? undefined,
      userAvatar: (profile?.avatar_url as string) ?? undefined,
      createdAt: row.created_at as string,
    };
  });
}

export async function getPostTagsForPosts(postIds: string[]): Promise<Record<string, PostTag[]>> {
  const ids = [...new Set(postIds.filter(Boolean))];
  if (ids.length === 0) return {};

  const { data, error } = await supabase
    .from('post_tags')
    .select('id, post_id, tagged_user_id, tagged_by_user_id, created_at')
    .in('post_id', ids)
    .order('created_at');

  if (error) throw new Error(`getPostTagsForPosts: ${error.message}`);

  const userIds = [...new Set((data ?? []).map((row) => row.tagged_user_id as string).filter(Boolean))];
  const profilesById = await getProfilesById(userIds);

  return (data ?? []).reduce<Record<string, PostTag[]>>((acc, row) => {
    const postId = row.post_id as string;
    const taggedUserId = row.tagged_user_id as string;
    const profile = profilesById.get(taggedUserId);
    const tag: PostTag = {
      id: row.id as string,
      postId,
      taggedUserId,
      taggedByUserId: row.tagged_by_user_id as string,
      userName: profile?.fullName,
      userAvatar: profile?.avatarUrl,
      createdAt: row.created_at as string,
    };
    acc[postId] = [...(acc[postId] ?? []), tag];
    return acc;
  }, {});
}

// ── Saved Posts ─────────────────────────────────────────────────

export async function getSavedPosts(limit = 20, offset = 0): Promise<FeedPost[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('getSavedPosts: not authenticated');

  const { data, error } = await supabase
    .from('post_saves')
    .select('post_id, feed_posts(*)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw new Error(`getSavedPosts: ${error.message}`);

  const rows = (data ?? [])
    .map((row) => (row as Record<string, unknown>).feed_posts as Record<string, unknown> | null)
    .filter((post): post is Record<string, unknown> => !!post);
  const postIds = rows.map((post) => post.id as string).filter(Boolean);

  let mediaByPost: Record<string, PostMedia[]> = {};
  if (postIds.length > 0) {
    const { data: mediaRows, error: mediaError } = await supabase
      .from('post_media')
      .select('id, post_id, media_url, storage_path, media_type, order_index, created_at')
      .in('post_id', postIds)
      .order('order_index', { ascending: true });
    if (mediaError) throw new Error(`getSavedPosts media: ${mediaError.message}`);
    mediaByPost = (mediaRows ?? []).reduce<Record<string, PostMedia[]>>((acc, row) => {
      const postId = row.post_id as string;
      const media: PostMedia = {
        id: row.id as string,
        mediaUrl: row.media_url as string,
        storagePath: row.storage_path as string,
        mediaType: (row.media_type as string) ?? 'image',
        orderIndex: row.order_index as number,
      };
      acc[postId] = [...(acc[postId] ?? []), media];
      return acc;
    }, {});
  }

  return rows.map((post) => mapRpcPost({
    ...post,
    media: mediaByPost[post.id as string] ?? [],
    viewer_has_saved: true,
  }));
}

// ── User Posts (for profile) ────────────────────────────────────

export async function getUserPosts(userId: string, limit = 20, offset = 0): Promise<FeedPost[]> {
  const { data, error } = await supabase
    .from('feed_posts')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw new Error(`getUserPosts: ${error.message}`);
  return (data ?? []).map((row) => mapRpcPost(row as Record<string, unknown>));
}

export async function hidePost(postId: string): Promise<void> {
  const { error } = await supabase
    .from('feed_posts')
    .update({ is_public: false })
    .eq('id', postId);
  if (error) throw new Error(`hidePost: ${error.message}`);
}

export async function searchProfiles(query: string, limit = 10): Promise<{ id: string; name: string; avatar?: string }[]> {
  const data = await searchPublicProfiles(query);
  return data.slice(0, limit).map((p) => ({
    id: p.id,
    name: p.fullName,
    avatar: p.avatarUrl,
  }));
}
