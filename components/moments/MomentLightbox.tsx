import React, { useEffect, useRef } from 'react';
import { formatDatePHT } from '@/lib/utils';
import {
  View,
  Text,
  Image,
  Modal,
  PanResponder,
  TouchableOpacity,
  ScrollView,
  Animated,
  StyleSheet,
  Dimensions,
} from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { useTheme } from '@/constants/ThemeContext';
import { Avatar } from './Avatar';
import type { MomentDisplay, PeopleMap } from './types';

const { width: SCREEN_W } = Dimensions.get('window');

interface MomentLightboxProps {
  moment: MomentDisplay | null;
  index: number;
  total: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  people: PeopleMap;
}

export function MomentLightbox({
  moment,
  index,
  total,
  onClose,
  onPrev,
  onNext,
  people,
}: MomentLightboxProps) {
  const { colors } = useTheme();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const SWIPE_THRESHOLD = 60;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gs) =>
        Math.abs(gs.dx) > 15 && Math.abs(gs.dx) > Math.abs(gs.dy),
      onPanResponderMove: (_, gs) => {
        translateX.setValue(gs.dx);
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dx < -SWIPE_THRESHOLD) {
          // Swipe left → next
          Animated.timing(translateX, {
            toValue: -SCREEN_W,
            duration: 150,
            useNativeDriver: true,
          }).start(() => {
            onNext();
            translateX.setValue(0);
          });
        } else if (gs.dx > SWIPE_THRESHOLD) {
          // Swipe right → prev
          Animated.timing(translateX, {
            toValue: SCREEN_W,
            duration: 150,
            useNativeDriver: true,
          }).start(() => {
            onPrev();
            translateX.setValue(0);
          });
        } else {
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    }),
  ).current;

  useEffect(() => {
    if (moment) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    } else {
      fadeAnim.setValue(0);
    }
  }, [moment, fadeAnim]);

  if (!moment) return null;

  const authorKey = moment.authorKey ?? moment.takenBy ?? '';
  const person = people[authorKey] ?? { name: authorKey, color: colors.accent };

  return (
    <Modal
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        {/* Top bar */}
        <View style={styles.topBar}>
          {/* Close button */}
          <TouchableOpacity
            onPress={onClose}
            style={styles.topButton}
            accessibilityLabel="Close"
            accessibilityRole="button"
          >
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
              <Path d="M18 6L6 18M6 6l12 12" stroke="#fff" strokeWidth={2} strokeLinecap="round" />
            </Svg>
          </TouchableOpacity>

          <Text style={styles.counter}>
            {index + 1} / {total}
          </Text>

          {/* Share button */}
          <TouchableOpacity
            style={styles.topButton}
            accessibilityLabel="Share"
            accessibilityRole="button"
          >
            <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
              <Path d="M16 6l-4-4-4 4M12 2v13" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              <Path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </TouchableOpacity>
        </View>

        {/* Photo area — swipe left/right to navigate */}
        <Animated.View
          style={[styles.photoArea, { transform: [{ translateX }] }]}
          {...panResponder.panHandlers}
        >
          {moment.photo && (
            <Image
              source={{ uri: moment.photo }}
              style={styles.photo}
              resizeMode="cover"
            />
          )}
        </Animated.View>

        {/* Meta sheet */}
        <ScrollView
          style={styles.metaScroll}
          contentContainerStyle={styles.metaContent}
          bounces={false}
        >
          <View style={styles.metaSheet}>
            {/* Author row */}
            <View style={styles.authorRow}>
              <Avatar authorKey={authorKey} people={people} size={28} />
              <View style={styles.authorInfo}>
                <Text style={styles.authorName}>{person.name}</Text>
                <Text style={styles.authorDate}>
                  {formatDatePHT(moment.date)}
                </Text>
              </View>
            </View>

            {/* Caption */}
            {moment.caption ? (
              <Text style={styles.caption}>{moment.caption}</Text>
            ) : null}

            {/* Location chip */}
            <View style={styles.chipsRow}>
              {(moment.place ?? moment.location) ? (
                <MetaChip
                  icon="pin"
                  label={moment.place ?? moment.location ?? ''}
                />
              ) : null}
            </View>
          </View>
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// MetaChip — SVG icons matching prototype verbatim
// ---------------------------------------------------------------------------

interface MetaChipProps {
  icon: 'pin';
  label: string;
}

function MetaChipIcon({ icon }: { icon: MetaChipProps['icon'] }) {
  const stroke = 'currentColor';
  switch (icon) {
    case 'pin':
      return (
        <Svg width={11} height={11} viewBox="0 0 24 24" fill="none">
          <Path
            d="M12 22s-8-7.5-8-13a8 8 0 1116 0c0 5.5-8 13-8 13z"
            stroke="rgba(255,255,255,0.85)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <Circle
            cx={12}
            cy={9}
            r={2.5}
            stroke="rgba(255,255,255,0.85)"
            strokeWidth={2}
            fill="none"
          />
        </Svg>
      );
  }
}

function MetaChip({ icon, label }: MetaChipProps) {
  return (
    <View style={[styles.metaChip, { backgroundColor: 'rgba(255,255,255,0.08)' }]}>
      <MetaChipIcon icon={icon} />
      <Text style={[styles.metaChipLabel, { color: 'rgba(255,255,255,0.85)' }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(5,7,10,0.92)',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingTop: 54,
    paddingBottom: 10,
  },
  topButton: {
    width: 32,
    height: 32,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  counter: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.65)',
    fontWeight: '600',
    letterSpacing: 0.4,
  },
  photoArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  photo: {
    width: SCREEN_W - 28,
    aspectRatio: 3 / 4,
    borderRadius: 14,
  },
  metaScroll: {
    maxHeight: 280,
  },
  metaContent: {
    padding: 14,
  },
  metaSheet: {
    padding: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    overflow: 'hidden',
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  authorInfo: {
    flex: 1,
    minWidth: 0,
  },
  authorName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  authorDate: {
    fontSize: 10.5,
    color: 'rgba(255,255,255,0.6)',
  },
  reactionsRow: {
    flexDirection: 'row',
    gap: 4,
  },
  reactionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  reactionEmoji: {
    fontSize: 11,
  },
  reactionCountText: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
  },
  caption: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 10,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: 999,
  },
  metaChipLabel: {
    fontSize: 10.5,
    fontWeight: '600',
    letterSpacing: -0.05,
  },
});
