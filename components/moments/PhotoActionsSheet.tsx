import React from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Dimensions,
  Platform,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import {
  Gesture,
  GestureDetector,
} from 'react-native-gesture-handler';
import {
  Share2,
  Download,
  BookmarkPlus,
  EyeOff,
  Film,
  Trash2,
  Edit3,
  Lock,
  Images,
  Users,
  Globe,
  Sparkles,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, type ThemeColors } from '@/constants/ThemeContext';
import { spacing, radius } from '@/constants/theme';
import type { MomentVisibility } from '@/lib/types';

const { height: SCREEN_H } = Dimensions.get('window');

export type PhotoAction =
  | 'share'
  | 'share-hd'
  | 'download-hd'
  | 'reel'
  | 'archive'       // legacy — kept for compat
  | 'delete'
  | 'edit'
  | 'set-private'
  | 'set-album'
  | 'set-shared'
  | 'set-public'
  | 'hide'
  | 'unhide'
  | 'save-to-mine';

interface PhotoActionsSheetProps {
  visible: boolean;
  onAction: (action: PhotoAction) => void;
  onClose: () => void;
  photoId: string;
  currentVisibility?: MomentVisibility;
  hasHd?: boolean;
  isMine?: boolean;
  isDismissed?: boolean;
}

interface ActionItemProps {
  icon: React.ElementType;
  label: string;
  color: string;
  bgColor: string;
  active?: boolean;
  onPress: () => void;
}

function ActionItem({ icon: Icon, label, color, bgColor, active, onPress }: ActionItemProps) {
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      style={({ pressed }) => [
        styles.actionItem,
        { backgroundColor: bgColor },
        active && styles.actionItemActive,
        pressed && styles.actionItemPressed,
      ]}
    >
      <Icon size={20} color={color} strokeWidth={2} />
      <Text style={[styles.actionLabel, { color }]} numberOfLines={1}>{label}</Text>
      {active && <View style={[styles.activeDot, { backgroundColor: color }]} />}
    </Pressable>
  );
}

export function PhotoActionsSheet({
  visible,
  onAction,
  onClose,
  currentVisibility = 'shared',
  hasHd = false,
  isMine = true,
  isDismissed = false,
}: PhotoActionsSheetProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(SCREEN_H);
  const backdropOpacity = useSharedValue(0);

  React.useEffect(() => {
    if (visible) {
      translateY.value = withTiming(0, { duration: 280, easing: Easing.out(Easing.cubic) });
      backdropOpacity.value = withTiming(1, { duration: 200 });
    } else {
      translateY.value = withTiming(SCREEN_H, { duration: 220, easing: Easing.in(Easing.cubic) });
      backdropOpacity.value = withTiming(0, { duration: 200 });
    }
  }, [visible]);

  const panGesture = Gesture.Pan()
    .activeOffsetY([-10, 10])
    .onUpdate((event) => {
      'worklet';
      if (event.translationY > 0) {
        translateY.value = event.translationY;
      }
    })
    .onEnd((event) => {
      'worklet';
      if (event.translationY > 120 || event.velocityY > 500) {
        translateY.value = withTiming(SCREEN_H, { duration: 220, easing: Easing.in(Easing.cubic) });
        backdropOpacity.value = withTiming(0, { duration: 200 });
        runOnJS(onClose)();
      } else {
        translateY.value = withTiming(0, { duration: 220, easing: Easing.out(Easing.cubic) });
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  if (!visible) return null;

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents={visible ? 'auto' : 'none'}>
      {/* Backdrop */}
      <Animated.View style={[styles.backdrop, backdropStyle]}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />
      </Animated.View>

      {/* Sheet */}
      <GestureDetector gesture={panGesture}>
        <Animated.View
          style={[
            styles.sheet,
            { backgroundColor: colors.bg2, paddingBottom: insets.bottom + 20 },
            sheetStyle,
          ]}
        >
          {/* Handle */}
          <View style={styles.handleContainer}>
            <View style={[styles.handle, { backgroundColor: colors.accent }]} />
          </View>

          {/* ── Visibility section ── */}
          <Text style={[styles.sectionLabel, { color: colors.text3 }]}>WHO CAN SEE</Text>
          <View style={styles.visibilityRow}>
            <Pressable
              onPress={() => { Haptics.selectionAsync(); onAction('set-private'); }}
              style={[
                styles.visPill,
                { borderColor: colors.border },
                currentVisibility === 'private' && { borderColor: colors.warn, backgroundColor: colors.accentDim },
              ]}
            >
              <Lock size={16} color={currentVisibility === 'private' ? colors.warn : colors.text3} strokeWidth={2} />
              <Text style={[styles.visPillLabel, { color: currentVisibility === 'private' ? colors.warn : colors.text2 }]}>Just Me</Text>
            </Pressable>

            <Pressable
              onPress={() => { Haptics.selectionAsync(); onAction('set-album'); }}
              style={[
                styles.visPill,
                { borderColor: colors.border },
                currentVisibility === 'album' && { borderColor: colors.accentLt, backgroundColor: colors.accentDim },
              ]}
            >
              <Images size={16} color={currentVisibility === 'album' ? colors.accentLt : colors.text3} strokeWidth={2} />
              <Text style={[styles.visPillLabel, { color: currentVisibility === 'album' ? colors.accentLt : colors.text2 }]}>Album</Text>
            </Pressable>

            <Pressable
              onPress={() => { Haptics.selectionAsync(); onAction('set-shared'); }}
              style={[
                styles.visPill,
                { borderColor: colors.border },
                currentVisibility === 'shared' && { borderColor: colors.accent, backgroundColor: colors.accentBg },
              ]}
            >
              <Users size={16} color={currentVisibility === 'shared' ? colors.accent : colors.text3} strokeWidth={2} />
              <Text style={[styles.visPillLabel, { color: currentVisibility === 'shared' ? colors.accent : colors.text2 }]}>Group</Text>
            </Pressable>

            <Pressable
              onPress={() => { Haptics.selectionAsync(); onAction('set-public'); }}
              style={[
                styles.visPill,
                { borderColor: colors.border },
                currentVisibility === 'public' && { borderColor: colors.success, backgroundColor: colors.accentBg },
              ]}
            >
              <Globe size={16} color={currentVisibility === 'public' ? colors.success : colors.text3} strokeWidth={2} />
              <Text style={[styles.visPillLabel, { color: currentVisibility === 'public' ? colors.success : colors.text2 }]}>Public</Text>
            </Pressable>
          </View>

          {/* ── Actions grid ── */}
          <Text style={[styles.sectionLabel, { color: colors.text3, marginTop: 16 }]}>ACTIONS</Text>
          <View style={styles.actionsGrid}>
            <ActionItem
              icon={Edit3}
              label="Edit"
              color={colors.info}
              bgColor={colors.accentDim}
              onPress={() => onAction('edit')}
            />
            <ActionItem
              icon={Film}
              label="Add to Reel"
              color={colors.accentLt}
              bgColor={colors.accentDim}
              onPress={() => onAction('reel')}
            />
            <ActionItem
              icon={Share2}
              label="Share"
              color={colors.accent}
              bgColor={colors.accentBg}
              onPress={() => onAction('share')}
            />
            {hasHd && (
              <ActionItem
                icon={Sparkles}
                label="Share HD"
                color={colors.accentLt}
                bgColor={colors.accentBg}
                onPress={() => onAction('share-hd')}
              />
            )}
            {hasHd && (
              <ActionItem
                icon={Download}
                label="Save HD"
                color={colors.accent}
                bgColor={colors.accentDim}
                onPress={() => onAction('download-hd')}
              />
            )}
            <ActionItem
              icon={Trash2}
              label="Delete"
              color={colors.danger}
              bgColor={colors.accentDim}
              onPress={() => onAction('delete')}
            />
            {!isMine && currentVisibility === 'shared' && (
              <ActionItem
                icon={isDismissed ? EyeOff : EyeOff}
                label={isDismissed ? 'Show Again' : 'Hide'}
                color={colors.text3}
                bgColor={colors.accentDim}
                onPress={() => onAction(isDismissed ? 'unhide' : 'hide')}
              />
            )}
            {!isMine && currentVisibility === 'shared' && (
              <ActionItem
                icon={BookmarkPlus}
                label="Save to Mine"
                color={colors.accent}
                bgColor={colors.accentBg}
                onPress={() => onAction('save-to-mine')}
              />
            )}
          </View>

          {/* Cancel */}
          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              onClose();
            }}
            style={[styles.cancelBtn, { backgroundColor: colors.card }]}
          >
            <Text style={[styles.cancelText, { color: colors.text }]}>Cancel</Text>
          </Pressable>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 12,
    paddingHorizontal: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.25,
        shadowRadius: 20,
      },
      android: {
        elevation: 20,
      },
    }),
  },
  handleContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    opacity: 0.6,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.7,
    marginBottom: 10,
  },
  // ── Visibility pills ──
  visibilityRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  visPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  visPillLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  // ── Actions grid ──
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  actionItem: {
    width: '47%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 14,
  },
  actionItemActive: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  actionItemPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.97 }],
  },
  actionLabel: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  cancelBtn: {
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
