import { Image } from 'expo-image';
import { MoreHorizontal, Trash2, X } from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, Modal, StyleSheet, Text, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, { type SharedValue, runOnJS, useAnimatedStyle, useDerivedValue, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PAPER } from '@/components/feed/feedTheme';
import { markStoryViewed } from '@/lib/moments/exploreMomentsService';
import type { Story } from '@/lib/types';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const STORY_DURATION = 5000;

// Extracted to fix Rules of Hooks — useAnimatedStyle cannot be inside .map()
function ProgressSegment({ segmentIndex, activeIndex, progress }: {
  segmentIndex: number;
  activeIndex: number;
  progress: SharedValue<number>;
}) {
  const width = useDerivedValue(() => {
    if (segmentIndex < activeIndex) return 100;
    if (segmentIndex === activeIndex) return progress.value * 100;
    return 0;
  });

  const barStyle = useAnimatedStyle(() => ({
    width: `${width.value}%` as unknown as number,
  }));

  return (
    <View style={styles.progressTrack}>
      <Animated.View style={[styles.progressFill, barStyle]} />
    </View>
  );
}

interface StoryViewerProps {
  visible: boolean;
  stories: Story[];
  initialIndex?: number;
  currentUserId?: string;
  onClose: () => void;
  onDeleteStory?: (story: Story) => Promise<void> | void;
  onProfilePress?: (userId: string) => void;
}

export default function StoryViewer({ visible, stories, initialIndex = 0, currentUserId, onClose, onDeleteStory, onProfilePress }: StoryViewerProps) {
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(initialIndex);
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [mediaFailed, setMediaFailed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progress = useSharedValue(0);
  const translateY = useSharedValue(0);

  const story = stories[index];
  const isOwner = !!story && story.userId === currentUserId;

  const startTimer = useCallback((ignorePause = false) => {
    if (!ignorePause && (menuOpen || deleting)) return;
    progress.value = 0;
    progress.value = withTiming(1, { duration: STORY_DURATION });

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (index < stories.length - 1) {
        setIndex(index + 1);
      } else {
        onClose();
      }
    }, STORY_DURATION);
  }, [index, stories.length, onClose, progress, menuOpen, deleting]);

  useEffect(() => {
    if (visible && story) {
      setMenuOpen(false);
      setMediaFailed(false);
      startTimer();
      markStoryViewed(story.id).catch(() => {});
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [visible, index, story, startTimer]);

  useEffect(() => {
    if (!visible) setIndex(initialIndex);
  }, [visible, initialIndex]);

  useEffect(() => {
    if (!visible) return;
    if (stories.length === 0) {
      onClose();
    } else if (index >= stories.length) {
      setIndex(Math.max(stories.length - 1, 0));
    }
  }, [visible, stories.length, index, onClose]);

  const goNext = useCallback(() => {
    if (index < stories.length - 1) {
      setIndex(index + 1);
    } else {
      onClose();
    }
  }, [index, stories.length, onClose]);

  const goPrev = useCallback(() => {
    if (index > 0) setIndex(index - 1);
  }, [index]);

  const handleTap = useCallback((x: number) => {
    if (menuOpen || deleting) return;
    if (x < SCREEN_W * 0.35) {
      goPrev();
    } else {
      goNext();
    }
  }, [goNext, goPrev, menuOpen, deleting]);

  const toggleOwnerMenu = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setMenuOpen((prev) => {
      const next = !prev;
      if (!next) setTimeout(() => startTimer(true), 0);
      return next;
    });
  }, [startTimer]);

  const handleDelete = useCallback(() => {
    if (!story || !onDeleteStory) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    setMenuOpen(false);
    Alert.alert(
      'Delete story?',
      'This story will be removed from AfterStay.',
      [
        { text: 'Cancel', style: 'cancel', onPress: () => setTimeout(() => startTimer(true), 0) },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await onDeleteStory(story);
            } finally {
              setDeleting(false);
            }
          },
        },
      ],
    );
  }, [story, onDeleteStory, startTimer]);

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      if (e.translationY > 0) {
        translateY.value = e.translationY;
      }
    })
    .onEnd((e) => {
      if (e.translationY > 100) {
        runOnJS(onClose)();
      }
      translateY.value = withTiming(0, { duration: 200 });
    });

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: 1 - translateY.value / (SCREEN_H * 0.5),
  }));

  if (!story) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <GestureDetector gesture={panGesture}>
        <Animated.View style={[styles.container, containerStyle]}>
          {mediaFailed ? (
            <View style={styles.mediaFallback}>
              <Text style={styles.mediaFallbackTitle}>Story unavailable</Text>
              <Text style={styles.mediaFallbackText}>The photo could not be loaded. Pull down to close or tap to try again.</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={() => setMediaFailed(false)} activeOpacity={0.75}>
                <Text style={styles.retryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <Image
              source={{ uri: story.mediaUrl }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              onError={() => setMediaFailed(true)}
            />
          )}

          {/* Progress bars — each segment is its own component (hooks-safe) */}
          <View style={[styles.progressRow, { top: insets.top + 8 }]}>
            {stories.map((_, i) => (
              <ProgressSegment key={i} segmentIndex={i} activeIndex={index} progress={progress} />
            ))}
          </View>

          {/* User info */}
          <View style={[styles.userRow, { top: insets.top + 24 }]}>
            <TouchableOpacity
              style={styles.userIdentity}
              onPress={() => {
                onClose();
                onProfilePress?.(story.userId);
              }}
              activeOpacity={onProfilePress ? 0.75 : 1}
              disabled={!onProfilePress}
            >
              {story.userAvatar ? (
                <Image source={{ uri: story.userAvatar }} style={styles.avatar} contentFit="cover" />
              ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                  <Text style={styles.avatarLetter}>{(story.userName ?? 'T')[0].toUpperCase()}</Text>
                </View>
              )}
              <Text style={styles.userName}>{story.userName ?? 'Traveler'}</Text>
            </TouchableOpacity>
            {isOwner && onDeleteStory && (
              <TouchableOpacity onPress={toggleOwnerMenu} style={styles.closeBtn} activeOpacity={0.7}>
                <MoreHorizontal size={24} color="#fff" strokeWidth={2} />
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <X size={24} color="#fff" strokeWidth={2} />
            </TouchableOpacity>
          </View>

          {menuOpen && (
            <View style={[styles.ownerMenu, { top: insets.top + 64 }]}>
              <TouchableOpacity style={styles.ownerMenuItem} onPress={handleDelete} activeOpacity={0.75}>
                <Trash2 size={16} color="#ffdfdf" strokeWidth={2} />
                <Text style={styles.ownerMenuText}>Delete story</Text>
              </TouchableOpacity>
            </View>
          )}

          {deleting && (
            <View style={styles.deletingOverlay}>
              <ActivityIndicator color="#fff" />
            </View>
          )}

          {/* Tap zones */}
          <TouchableWithoutFeedback onPress={(e) => handleTap(e.nativeEvent.locationX)}>
            <View style={styles.tapZone} />
          </TouchableWithoutFeedback>

          {/* Caption */}
          {story.caption && (
            <View style={[styles.captionWrap, { bottom: insets.bottom + 24 }]}>
              <Text style={styles.caption}>{story.caption}</Text>
            </View>
          )}

          {/* Location */}
          {story.locationName && (
            <View style={[styles.locationWrap, { bottom: insets.bottom + (story.caption ? 64 : 24) }]}>
              <Text style={styles.location}>{story.locationName}</Text>
            </View>
          )}
        </Animated.View>
      </GestureDetector>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  mediaFallback: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    backgroundColor: '#050505',
    zIndex: 6,
  },
  mediaFallbackTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  mediaFallbackText: {
    color: 'rgba(255,255,255,0.68)',
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 8,
  },
  retryBtn: {
    marginTop: 18,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.35)',
    backgroundColor: 'rgba(255,255,255,0.12)',
    zIndex: 7,
  },
  retryText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  progressRow: {
    position: 'absolute', left: 8, right: 8,
    flexDirection: 'row', gap: 3, zIndex: 10,
  },
  progressTrack: {
    flex: 1, height: 2.5, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.3)', overflow: 'hidden',
  },
  progressFill: {
    height: '100%', backgroundColor: '#fff', borderRadius: 2,
  },
  userRow: {
    position: 'absolute', left: 12, right: 12,
    flexDirection: 'row', alignItems: 'center', gap: 10, zIndex: 10,
  },
  userIdentity: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: { width: 32, height: 32, borderRadius: 16 },
  avatarPlaceholder: {
    backgroundColor: PAPER.stamp, alignItems: 'center', justifyContent: 'center',
  },
  avatarLetter: { color: '#fff', fontSize: 14, fontWeight: '700' },
  userName: { flex: 1, fontSize: 14, fontWeight: '600', color: '#fff' },
  closeBtn: { padding: 4 },
  ownerMenu: {
    position: 'absolute',
    right: 14,
    zIndex: 20,
    minWidth: 160,
    borderRadius: 12,
    backgroundColor: 'rgba(20,18,16,0.92)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.22)',
    overflow: 'hidden',
  },
  ownerMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  ownerMenuText: {
    color: '#ffdfdf',
    fontSize: 13,
    fontWeight: '700',
  },
  deletingOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  tapZone: { ...StyleSheet.absoluteFillObject, zIndex: 5 },
  captionWrap: { position: 'absolute', left: 16, right: 16, zIndex: 10 },
  caption: {
    fontSize: 15, color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
  },
  locationWrap: { position: 'absolute', left: 16, zIndex: 10 },
  location: { fontSize: 12, color: 'rgba(255,255,255,0.8)', fontWeight: '500' },
});
