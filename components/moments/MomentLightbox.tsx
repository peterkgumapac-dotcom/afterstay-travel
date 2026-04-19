import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Image,
  Modal,
  TouchableOpacity,
  ScrollView,
  Animated,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { useTheme } from '@/constants/ThemeContext';
import { spacing, radius } from '@/constants/theme';
import { VoiceNote } from './VoiceNote';
import type { MomentDisplay } from './types';

const { width: SCREEN_W } = Dimensions.get('window');

interface MomentLightboxProps {
  moment: MomentDisplay | null;
  index: number;
  total: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  people: Record<string, { name: string; color: string }>;
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
  const authorInitial = person.name.charAt(0).toUpperCase();

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
          <TouchableOpacity
            onPress={onClose}
            style={styles.topButton}
            accessibilityLabel="Close"
            accessibilityRole="button"
          >
            <Text style={styles.closeIcon}>{'\u2715'}</Text>
          </TouchableOpacity>

          <Text style={styles.counter}>
            {index + 1} / {total}
          </Text>

          <TouchableOpacity
            style={styles.topButton}
            accessibilityLabel="Share"
            accessibilityRole="button"
          >
            <Text style={styles.shareIcon}>{'\u21E7'}</Text>
          </TouchableOpacity>
        </View>

        {/* Photo area */}
        <View style={styles.photoArea}>
          {moment.photo && (
            <Image
              source={{ uri: moment.photo }}
              style={styles.photo}
              resizeMode="cover"
            />
          )}

          {/* Prev button */}
          <TouchableOpacity
            onPress={onPrev}
            style={[styles.navButton, styles.navLeft]}
            accessibilityLabel="Previous photo"
            accessibilityRole="button"
          >
            <Text style={styles.navIcon}>{'\u2039'}</Text>
          </TouchableOpacity>

          {/* Next button */}
          <TouchableOpacity
            onPress={onNext}
            style={[styles.navButton, styles.navRight]}
            accessibilityLabel="Next photo"
            accessibilityRole="button"
          >
            <Text style={styles.navIcon}>{'\u203A'}</Text>
          </TouchableOpacity>
        </View>

        {/* Meta sheet */}
        <ScrollView
          style={styles.metaScroll}
          contentContainerStyle={styles.metaContent}
          bounces={false}
        >
          <View style={styles.metaSheet}>
            {/* Author row */}
            <View style={styles.authorRow}>
              <View
                style={[
                  styles.authorAvatar,
                  { backgroundColor: person.color },
                ]}
              >
                <Text style={styles.authorAvatarText}>{authorInitial}</Text>
              </View>
              <View style={styles.authorInfo}>
                <Text style={styles.authorName}>{person.name}</Text>
                <Text style={styles.authorDate}>
                  {moment.date}
                  {moment.time ? ` \u00B7 ${moment.time}` : ''}
                </Text>
              </View>
              {/* Reaction badges */}
              <View style={styles.reactionsRow}>
                {moment.reactions &&
                  Object.entries(moment.reactions).map(([emoji, count]) => (
                    <View key={emoji} style={styles.reactionBadge}>
                      <Text style={styles.reactionEmoji}>{emoji}</Text>
                      <Text style={styles.reactionCountText}>{count}</Text>
                    </View>
                  ))}
              </View>
            </View>

            {/* Caption */}
            {moment.caption ? (
              <Text style={styles.caption}>{moment.caption}</Text>
            ) : null}

            {/* Voice note */}
            {moment.voice && (
              <View style={styles.voiceContainer}>
                <VoiceNote
                  duration={moment.voice.duration}
                  authorColor={person.color ?? colors.accent}
                />
              </View>
            )}

            {/* Meta chips */}
            <View style={styles.chipsRow}>
              {(moment.place ?? moment.location) ? (
                <MetaChip
                  icon={'\uD83D\uDCCD'}
                  label={moment.place ?? moment.location ?? ''}
                />
              ) : null}
              {moment.weather ? (
                <MetaChip icon={'\u2600'} label={moment.weather} />
              ) : null}
              {moment.expense ? (
                <MetaChip
                  icon={'\uD83D\uDCB3'}
                  label={`${moment.expense.label} \u00B7 ${moment.expense.amt}`}
                  accent
                  accentColor={colors.accentLt}
                />
              ) : null}
            </View>
          </View>
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

interface MetaChipProps {
  icon: string;
  label: string;
  accent?: boolean;
  accentColor?: string;
}

function MetaChip({ icon, label, accent = false, accentColor }: MetaChipProps) {
  return (
    <View
      style={[
        styles.metaChip,
        {
          backgroundColor: accent
            ? 'rgba(216,171,122,0.18)'
            : 'rgba(255,255,255,0.08)',
        },
      ]}
    >
      <Text style={styles.metaChipIcon}>{icon}</Text>
      <Text
        style={[
          styles.metaChipLabel,
          {
            color: accent && accentColor
              ? accentColor
              : 'rgba(255,255,255,0.85)',
          },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

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
  closeIcon: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
  shareIcon: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
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
    borderRadius: radius.sm + 2,
  },
  navButton: {
    position: 'absolute',
    top: '50%',
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -18,
  },
  navLeft: {
    left: 18,
  },
  navRight: {
    right: 18,
  },
  navIcon: {
    fontSize: 20,
    color: '#fff',
    fontWeight: '300',
    marginTop: -2,
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
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  authorAvatar: {
    width: 28,
    height: 28,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  authorAvatarText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0b0f14',
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
    fontWeight: '550',
    color: '#fff',
    marginBottom: 10,
  },
  voiceContainer: {
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
  metaChipIcon: {
    fontSize: 11,
  },
  metaChipLabel: {
    fontSize: 10.5,
    fontWeight: '600',
    letterSpacing: -0.05,
  },
});
