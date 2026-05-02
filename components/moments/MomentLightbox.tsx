import * as Haptics from 'expo-haptics';
import { ArrowUpRight, Bookmark, ChevronLeft, Download, Edit3, Eye, EyeOff, Film, Heart, MapPin, MoreHorizontal, Share2, Trash2 } from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Dimensions,
  FlatList,
  Modal,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { CachedImage } from '@/components/CachedImage';
import Animated, {
  type SharedValue,
  FadeIn,
  FadeInDown,
  FadeOut,
  FadeOutDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { GestureDetector, Gesture, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/constants/ThemeContext';
import { formatDatePHT } from '@/lib/utils';
import { spacing } from '@/constants/theme';
import { useCurationGesture, type CurationAction } from '@/hooks/useCurationGesture';
import { GlowOverlay } from '@/components/curation/GlowOverlay';
import { Avatar } from './Avatar';
import type { MomentDisplay, PeopleMap } from './types';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

interface MomentLightboxProps {
  moment: MomentDisplay | null;
  index: number;
  total: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  people: PeopleMap;
  allMoments?: MomentDisplay[];
  onDelete?: (id: string) => void;
  onEdit?: (id: string) => void;
  onFilm?: (moment: MomentDisplay) => void;
  /** Called when user swipes up (favorite) or down (skip) on a photo */
  onCurate?: (id: string, action: CurationAction) => void;
  /** Called when user taps the favorite button */
  onFavorite?: (id: string) => void;
  /** Called when user toggles visibility (own photos only) */
  onToggleVisibility?: (id: string) => void;
}

export function MomentLightbox({
  moment,
  index,
  total,
  onClose,
  onPrev,
  onNext,
  people,
  allMoments,
  onDelete,
  onEdit,
  onFilm,
  onCurate,
  onFavorite,
  onToggleVisibility,
}: MomentLightboxProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const moments = allMoments ?? (moment ? [moment] : []);
  const safeIndex = moments.length > 0 ? Math.min(index, moments.length - 1) : 0;
  const [currentIdx, setCurrentIdx] = useState(safeIndex);
  const [menuVisible, setMenuVisible] = useState(false);
  const [viewingHd, setViewingHd] = useState(false);
  const [favToast, setFavToast] = useState<string | null>(null);
  const favToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flatListRef = useRef<FlatList<MomentDisplay>>(null);

  // Sync index when moments array changes (e.g. after filter/delete)
  useEffect(() => {
    if (moments.length === 0) return;
    if (currentIdx >= moments.length) {
      setCurrentIdx(moments.length - 1);
    }
  }, [moments.length, currentIdx]);

  const current = moments[currentIdx] ?? moment;

  const showFavToast = useCallback((msg: string) => {
    if (favToastTimer.current) clearTimeout(favToastTimer.current);
    setFavToast(msg);
    favToastTimer.current = setTimeout(() => setFavToast(null), 1500);
  }, []);

  // Swipe-up/down curation gesture — swipe up = favorite + toast
  const handleCurationCommit = useCallback(
    (action: CurationAction) => {
      const m = moments[currentIdx];
      if (!m) return;

      if (action === 'favorite') {
        // Trigger favorite via onFavorite (persists to DB)
        if (onFavorite) onFavorite(m.id);
        showFavToast('Added to favorites');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      // Also fire the curation callback if present
      if (onCurate) onCurate(m.id, action);

      // Advance to next photo or close if last
      if (currentIdx < moments.length - 1) {
        const nextIdx = currentIdx + 1;
        setCurrentIdx(nextIdx);
        flatListRef.current?.scrollToIndex({ index: nextIdx, animated: true });
      } else {
        onClose();
      }
    },
    [moments, currentIdx, onCurate, onFavorite, onClose, showFavToast],
  );

  const { gesture: curationGesture, cardStyle, glowStyle } = useCurationGesture({
    onCommit: handleCurationCommit,
    favoriteCount: 0,
    maxFavorites: 999,
    enabled: !!onCurate,
  });

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0 && viewableItems[0].index != null) {
      setCurrentIdx(viewableItems[0].index);
    }
  }).current;

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 }).current;

  const renderPhoto = useCallback(({ item }: { item: MomentDisplay }) => {
    const photoUrl = viewingHd && item.hdPhoto ? item.hdPhoto : item.photo;
    return (
      <View style={{ width: SCREEN_W, flex: 1, justifyContent: 'center' }}>
        {photoUrl ? (
          <CachedImage remoteUrl={photoUrl} style={styles.photo} resizeMode="contain" />
        ) : (
          <View style={styles.photo} />
        )}
      </View>
    );
  }, [viewingHd]);


  const doShare = useCallback((url: string) => {
    Share.share({
      message: [current?.caption, current?.location, current ? formatDatePHT(current.date) : '']
        .filter(Boolean)
        .join(' — '),
      url,
    });
  }, [current]);

  const handleShare = useCallback(() => {
    if (!current?.photo) return;
    setMenuVisible(false);
    if (current.hdPhoto) {
      Alert.alert('Share Quality', 'Choose photo quality to share', [
        { text: 'Standard', onPress: () => doShare(current.photo!) },
        { text: 'HD', style: 'default', onPress: () => doShare(current.hdPhoto!) },
        { text: 'Cancel', style: 'cancel' },
      ]);
    } else {
      doShare(current.photo);
    }
  }, [current, doShare]);

  const handleDelete = useCallback(() => {
    setMenuVisible(false);
    if (onDelete && current) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      onDelete(current.id);
      onClose();
    }
  }, [current, onDelete, onClose]);

  const doDownload = useCallback(async (url: string) => {
    try {
      const FileSystem = require('expo-file-system');
      const MediaLibrary = require('expo-media-library');
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') return;
      const filename = `afterstay_${Date.now()}.jpg`;
      const fileUri = (FileSystem.documentDirectory ?? FileSystem.cacheDirectory ?? '') + filename;
      const result = await FileSystem.downloadAsync(url, fileUri);
      await MediaLibrary.saveToLibraryAsync(result.uri);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      // ignore
    }
  }, []);

  const handleDownload = useCallback(() => {
    if (!current?.photo) return;
    setMenuVisible(false);
    if (current.hdPhoto) {
      Alert.alert('Save Quality', 'Choose photo quality to save', [
        { text: 'Standard', onPress: () => doDownload(current.photo!) },
        { text: 'HD', style: 'default', onPress: () => doDownload(current.hdPhoto!) },
        { text: 'Cancel', style: 'cancel' },
      ]);
    } else {
      doDownload(current.photo);
    }
  }, [current, doDownload]);

  const handleEdit = useCallback(() => {
    setMenuVisible(false);
    if (onEdit && current) onEdit(current.id);
  }, [current, onEdit]);

  const handleFilm = useCallback(() => {
    setMenuVisible(false);
    if (onFilm && current) {
      onClose();
      // Small delay so the lightbox closes before FilmEditor opens
      setTimeout(() => onFilm(current), 200);
    }
  }, [current, onFilm, onClose]);

  const isVisible = moment !== null;

  if (!isVisible) return null;
  if (!current || moments.length === 0) return null;

  const authorKey = current.authorKey ?? current.takenBy ?? '';
  const person = people[authorKey] ?? { name: authorKey, color: colors.accent };

  return (
    <Modal visible={isVisible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <GestureHandlerRootView style={styles.overlay}>
        {/* Top bar — overlaid on photo */}
        <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
          <Pressable onPress={onClose} style={styles.topBtn} accessibilityLabel="Close">
            <ChevronLeft size={20} color="#fff" strokeWidth={2.5} />
          </Pressable>
          <View style={styles.topCenter}>
            <Text style={styles.counter}>{moments.length > 0 ? `${currentIdx + 1} of ${moments.length}` : ''}</Text>
            {current?.hdPhoto && (
              <Pressable
                onPress={() => { Haptics.selectionAsync(); setViewingHd((v) => !v); }}
                style={[styles.hdPill, viewingHd && styles.hdPillActive]}
                accessibilityLabel={viewingHd ? 'Viewing HD' : 'View HD'}
              >
                <Text style={[styles.hdPillText, viewingHd && styles.hdPillTextActive]}>HD</Text>
              </Pressable>
            )}
          </View>
          <Pressable onPress={() => { Haptics.selectionAsync(); setMenuVisible(true); }} style={styles.topBtn} accessibilityLabel="More options">
            <MoreHorizontal size={18} color="#fff" strokeWidth={1.8} />
          </Pressable>
        </View>

        {/* Photo pager — takes most of the screen */}
        <Animated.View style={[{ flex: 1 }, onCurate ? cardStyle : undefined]}>
          <FlatList
            ref={flatListRef}
            data={moments}
            renderItem={renderPhoto}
            keyExtractor={(item) => item.id}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={Math.min(index, moments.length - 1)}
            getItemLayout={(_, idx) => ({
              length: SCREEN_W,
              offset: SCREEN_W * idx,
              index: idx,
            })}
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={viewabilityConfig}
            decelerationRate="fast"
            scrollEnabled
            style={{ flex: 1 }}
          />
          {onCurate && <GlowOverlay glowStyle={glowStyle} />}
        </Animated.View>

        {/* Favorite toast */}
        {favToast && (
          <Animated.View
            entering={FadeIn.duration(200)}
            exiting={FadeOut.duration(300)}
            style={styles.favToast}
          >
            <Text style={styles.favToastText}>{favToast}</Text>
          </Animated.View>
        )}

        {/* Attribution panel */}
        <View style={[styles.attrPanel, { paddingBottom: insets.bottom + 12 }]}>
          {/* Author row: avatar + name/meta + scope pill */}
          <View style={styles.attrAuthorRow}>
            <Avatar authorKey={authorKey} people={people} size={32} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.attrName}>
                {person.name || 'Unknown'}
                <Text style={styles.attrNameSub}> captured this</Text>
              </Text>
              <Text style={styles.attrMeta}>
                {formatDatePHT(current.date)}
                {current.location ? ` · ${current.location}` : ''}
              </Text>
            </View>
            <Pressable
              onPress={() => {
                if (!current.isMine || !onToggleVisibility) return;
                Haptics.selectionAsync();
                onToggleVisibility(current.id);
                showFavToast(
                  current.visibility === 'private'
                    ? 'Shared with the group'
                    : 'Moved to Just me',
                );
              }}
              style={[
                styles.scopePill,
                current.visibility === 'private' && styles.scopePillPrivate,
                current.isMine && styles.scopePillTappable,
              ]}
            >
              <Text style={[
                styles.scopePillText,
                current.visibility === 'private' && { color: '#ffd6d2' },
              ]}>
                {current.visibility === 'private' ? 'JUST ME' : current.visibility === 'album' ? 'ALBUM' : 'GROUP'}
              </Text>
              {current.isMine && (
                <Text style={[styles.scopePillText, { fontSize: 8, opacity: 0.6, marginLeft: 2 }]}>TAP</Text>
              )}
            </Pressable>
          </View>

          {/* Caption */}
          {current.caption ? (
            <Text style={styles.attrCaption}>"{current.caption}"</Text>
          ) : null}

          {/* Shared with row */}
          {current.visibility !== 'private' && (
            <View style={styles.sharedWithRow}>
              <Text style={styles.sharedWithLabel}>SHARED WITH</Text>
              <View style={styles.sharedWithAvatars}>
                {Object.entries(people)
                  .filter(([key]) => key.length === 1)
                  .slice(0, 4)
                  .map(([key, p], i) => (
                    <View
                      key={key}
                      style={[
                        styles.sharedAvatar,
                        { backgroundColor: p.color, marginLeft: i === 0 ? 0 : -6 },
                      ]}
                    >
                      <Text style={styles.sharedAvatarText}>{key}</Text>
                    </View>
                  ))}
                <Text style={styles.sharedWithNames}>
                  {Object.entries(people)
                    .filter(([key]) => key.length === 1)
                    .slice(0, 4)
                    .map(([, p]) => p.name)
                    .join(', ')}
                </Text>
              </View>
            </View>
          )}

          {/* Reaction pills */}
          <View style={styles.reactionRow}>
            <Pressable
              onPress={() => { if (onFavorite) { Haptics.selectionAsync(); onFavorite(current.id); } }}
              style={[styles.reactionBtn, current.isFavorited && styles.reactionBtnActive]}
            >
              <Heart size={14} color={current.isFavorited ? '#e55' : '#f1ebe2'} fill={current.isFavorited ? '#e55' : 'transparent'} strokeWidth={2} />
              <Text style={[styles.reactionText, current.isFavorited && { color: '#e55' }]}>
                {(current.favoriteCount ?? 0) > 0 ? String(current.favoriteCount) : ''}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => { Haptics.selectionAsync(); handleDownload(); }}
              style={styles.reactionBtn}
            >
              <Bookmark size={14} color="#f1ebe2" strokeWidth={2} />
              <Text style={styles.reactionText}>Save</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                Share.share({
                  message: [current.caption, current.location].filter(Boolean).join(' · '),
                  url: current.photo,
                });
              }}
              style={styles.reactionBtn}
            >
              <ArrowUpRight size={14} color="#f1ebe2" strokeWidth={2} />
              <Text style={styles.reactionText}>Send</Text>
            </Pressable>
          </View>
        </View>

        {/* iOS-style pull-up menu */}
        {menuVisible && (
          <Animated.View
            entering={FadeIn.duration(150)}
            exiting={FadeOut.duration(100)}
            style={styles.menuBackdrop}
          >
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setMenuVisible(false)} />
            <Animated.View
              entering={FadeInDown.duration(280)}
              exiting={FadeOutDown.duration(200)}
              style={[styles.menuSheet, { paddingBottom: insets.bottom + 20 }]}
            >
              <View style={styles.menuHandle} />

              {/* Photo info */}
              <View style={styles.menuInfoRow}>
                <Avatar authorKey={authorKey} people={people} size={36} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.menuName}>{person.name || 'Unknown'}</Text>
                  <Text style={styles.menuMeta}>
                    {formatDatePHT(current.date)}
                    {current.location ? ` · ${current.location}` : ''}
                  </Text>
                </View>
              </View>

              {current.caption ? (
                <Text style={styles.menuCaption}>{current.caption}</Text>
              ) : null}

              {/* Actions */}
              <View style={styles.menuActions}>
                {onFavorite && (
                  <MenuAction
                    icon={Heart}
                    label={current.isFavorited ? 'Unfavorite' : 'Favorite'}
                    onPress={() => { onFavorite(current.id); setMenuVisible(false); }}
                  />
                )}
                <MenuAction icon={Share2} label="Share" onPress={handleShare} />
                <MenuAction icon={Download} label="Save to Device" onPress={handleDownload} />
                {onFilm && current?.photo && <MenuAction icon={Film} label="Film Editor" onPress={handleFilm} />}
                {onEdit && <MenuAction icon={Edit3} label="Edit Details" onPress={handleEdit} />}
                {onToggleVisibility && current.isMine && (
                  <MenuAction
                    icon={current.visibility === 'private' ? Eye : EyeOff}
                    label={current.visibility === 'private' ? 'Make Shared' : 'Make Private'}
                    onPress={() => { onToggleVisibility(current.id); setMenuVisible(false); }}
                  />
                )}
                {onDelete && <MenuAction icon={Trash2} label="Delete" onPress={handleDelete} danger />}
              </View>

              <Pressable onPress={() => setMenuVisible(false)} style={styles.menuCancel}>
                <Text style={styles.menuCancelText}>Cancel</Text>
              </Pressable>
            </Animated.View>
          </Animated.View>
        )}
      </GestureHandlerRootView>
    </Modal>
  );
}

function MenuAction({
  icon: Icon,
  label,
  onPress,
  danger,
}: {
  icon: typeof Share2;
  label: string;
  onPress: () => void;
  danger?: boolean;
}) {
  return (
    <Pressable
      onPress={() => { Haptics.selectionAsync(); onPress(); }}
      style={({ pressed }) => [styles.menuAction, pressed && styles.menuActionPressed]}
    >
      <Icon size={18} color={danger ? '#e55' : '#fff'} strokeWidth={1.8} />
      <Text style={[styles.menuActionLabel, danger && { color: '#e55' }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: '#000' },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
    zIndex: 10,
  },
  topBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  counter: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '600',
  },
  hdPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  hdPillActive: {
    backgroundColor: '#d9a441',
    borderColor: '#d9a441',
  },
  hdPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 0.5,
  },
  hdPillTextActive: {
    color: '#000',
  },

  photo: { width: '100%', height: '100%' },
  _unused_starBtn: {
    position: 'absolute',
    top: 16,
    right: 18,
    width: 38,
    height: 38,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },

  // Attribution panel
  attrPanel: {
    paddingTop: 16,
    paddingHorizontal: 18,
    backgroundColor: '#16100a',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  attrAuthorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  attrName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f1ebe2',
  },
  attrNameSub: {
    color: '#857d70',
    fontWeight: '500',
  },
  attrMeta: {
    fontSize: 11,
    color: '#857d70',
    marginTop: 1,
  },
  scopePill: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(216,171,122,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(216,171,122,0.32)',
  },
  scopePillPrivate: {
    backgroundColor: 'rgba(196,85,74,0.18)',
    borderColor: 'rgba(196,85,74,0.32)',
  },
  scopePillTappable: {
    borderStyle: 'dashed',
  },
  scopePillText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.6,
    color: '#e6c196',
  },
  attrCaption: {
    fontSize: 14,
    color: '#f1ebe2',
    fontWeight: '500',
    lineHeight: 20,
    marginBottom: 14,
    letterSpacing: -0.05,
  },
  sharedWithRow: {
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    marginBottom: 14,
  },
  sharedWithLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: '#857d70',
    marginBottom: 8,
  },
  sharedWithAvatars: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sharedAvatar: {
    width: 28,
    height: 28,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#16100a',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 0.75,
  },
  sharedAvatarText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  sharedWithNames: {
    fontSize: 12,
    color: '#b8afa3',
    marginLeft: 6,
  },
  reactionRow: {
    flexDirection: 'row',
    gap: 6,
  },
  reactionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  reactionBtnActive: {
    backgroundColor: 'rgba(196,85,74,0.08)',
  },
  reactionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#f1ebe2',
    fontVariant: ['tabular-nums'] as const,
  },

  // Favorite toast
  favToast: {
    position: 'absolute',
    top: '50%',
    alignSelf: 'center',
    backgroundColor: 'rgba(216,171,122,0.92)',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 999,
    zIndex: 50,
  },
  favToastText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0b0f14',
    letterSpacing: -0.2,
  },

  // Pull-up menu
  menuBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  menuSheet: {
    backgroundColor: '#1c1c1e',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 8,
    paddingHorizontal: 20,
  },
  menuHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'center',
    marginBottom: 16,
  },
  menuInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  menuName: { fontSize: 15, fontWeight: '700', color: '#fff' },
  menuMeta: { fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 2 },
  menuCaption: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 16,
    lineHeight: 20,
  },
  menuActions: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    paddingTop: 8,
  },
  menuAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  menuActionPressed: { opacity: 0.6 },
  menuActionLabel: { fontSize: 15, fontWeight: '500', color: '#fff' },
  menuCancel: {
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
  },
  menuCancelText: { fontSize: 15, fontWeight: '600', color: '#fff' },
});
