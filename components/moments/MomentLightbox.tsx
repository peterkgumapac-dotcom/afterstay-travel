import * as Haptics from 'expo-haptics';
import { Edit3, MapPin, Share2, Trash2, X } from 'lucide-react-native';
import React, { useCallback, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Image,
  Modal,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  type SharedValue,
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { GestureDetector, Gesture, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/constants/ThemeContext';
import { formatDatePHT } from '@/lib/utils';
import { spacing } from '@/constants/theme';
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
}: MomentLightboxProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [currentIdx, setCurrentIdx] = useState(index);
  const [menuVisible, setMenuVisible] = useState(false);
  const flatListRef = useRef<FlatList<MomentDisplay>>(null);

  const moments = allMoments ?? (moment ? [moment] : []);
  const current = moments[currentIdx] ?? moment;

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0 && viewableItems[0].index != null) {
      setCurrentIdx(viewableItems[0].index);
    }
  }).current;

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 }).current;

  const renderPhoto = useCallback(({ item }: { item: MomentDisplay }) => (
    <View style={{ width: SCREEN_W, flex: 1, justifyContent: 'center' }}>
      <Image
        source={{ uri: item.photo, cache: 'force-cache' }}
        style={styles.photo}
        resizeMode="contain"
      />
    </View>
  ), []);

  const handleShare = useCallback(() => {
    if (!current?.photo) return;
    setMenuVisible(false);
    Share.share({
      message: [current.caption, current.location, formatDatePHT(current.date)]
        .filter(Boolean)
        .join(' — '),
      url: current.photo,
    });
  }, [current]);

  const handleDelete = useCallback(() => {
    setMenuVisible(false);
    if (onDelete && current) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      onDelete(current.id);
      onClose();
    }
  }, [current, onDelete, onClose]);

  const handleEdit = useCallback(() => {
    setMenuVisible(false);
    if (onEdit && current) onEdit(current.id);
  }, [current, onEdit]);

  if (!moment && moments.length === 0) return null;
  if (!current) return null;

  const authorKey = current.authorKey ?? current.takenBy ?? '';
  const person = people[authorKey] ?? { name: authorKey, color: colors.accent };

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.overlay}>
        {/* Top bar */}
        <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
          <Pressable onPress={onClose} style={styles.topBtn} accessibilityLabel="Close">
            <X size={18} color="#fff" strokeWidth={2} />
          </Pressable>
          <Text style={styles.counter}>{currentIdx + 1} / {moments.length}</Text>
          <Pressable onPress={handleShare} style={styles.topBtn} accessibilityLabel="Share">
            <Share2 size={16} color="#fff" strokeWidth={1.8} />
          </Pressable>
        </View>

        {/* Photo pager */}
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
          style={{ flex: 1 }}
        />

        {/* Bottom info bar — tap to open menu */}
        <Pressable
          onPress={() => { Haptics.selectionAsync(); setMenuVisible(true); }}
          style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}
        >
          <View style={styles.bottomInfo}>
            <Avatar authorKey={authorKey} people={people} size={28} />
            <View style={styles.bottomText}>
              <Text style={styles.bottomDate}>{formatDatePHT(current.date)}</Text>
              {(current.place ?? current.location) ? (
                <View style={styles.locationRow}>
                  <MapPin size={10} color="rgba(255,255,255,0.5)" strokeWidth={2} />
                  <Text style={styles.bottomLocation} numberOfLines={1}>
                    {current.place ?? current.location}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
          <View style={styles.pullIndicator} />
        </Pressable>

        {/* iOS-style pull-up menu */}
        {menuVisible && (
          <Animated.View
            entering={FadeIn.duration(150)}
            exiting={FadeOut.duration(100)}
            style={styles.menuBackdrop}
          >
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setMenuVisible(false)} />
            <Animated.View
              entering={SlideInDown.springify().damping(18).stiffness(200)}
              exiting={SlideOutDown.duration(200)}
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
                <MenuAction icon={Share2} label="Share" onPress={handleShare} />
                {onEdit && <MenuAction icon={Edit3} label="Edit Details" onPress={handleEdit} />}
                {onDelete && <MenuAction icon={Trash2} label="Delete" onPress={handleDelete} danger />}
              </View>

              <Pressable onPress={() => setMenuVisible(false)} style={styles.menuCancel}>
                <Text style={styles.menuCancelText}>Cancel</Text>
              </Pressable>
            </Animated.View>
          </Animated.View>
        )}
      </View>
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
  counter: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '600',
  },

  photo: { width: '100%', height: '100%' },

  // Bottom info bar
  bottomBar: {
    paddingTop: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  bottomInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    alignSelf: 'stretch',
  },
  bottomText: { flex: 1, gap: 2 },
  bottomDate: { fontSize: 13, fontWeight: '600', color: '#fff' },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  bottomLocation: { fontSize: 11, color: 'rgba(255,255,255,0.5)' },
  pullIndicator: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginTop: 10,
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
