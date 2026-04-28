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
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import {
  Gesture,
  GestureDetector,
} from 'react-native-gesture-handler';
import {
  Share2,
  Film,
  Archive,
  Trash2,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { springPresets } from '@/constants/animations';
import { useTheme } from '@/constants/ThemeContext';

const { height: SCREEN_H } = Dimensions.get('window');

export type PhotoAction = 'share' | 'reel' | 'archive' | 'delete';

interface PhotoActionsSheetProps {
  visible: boolean;
  onAction: (action: PhotoAction) => void;
  onClose: () => void;
  photoId: string;
}

interface ActionItemProps {
  icon: React.ElementType;
  label: string;
  color: string;
  bgColor: string;
  onPress: () => void;
}

function ActionItem({ icon: Icon, label, color, bgColor, onPress }: ActionItemProps) {
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      style={({ pressed }) => [
        styles.actionItem,
        { backgroundColor: bgColor },
        pressed && styles.actionItemPressed,
      ]}
    >
      <Icon size={20} color={color} strokeWidth={2} />
      <Text style={[styles.actionLabel, { color }]}>{label}</Text>
    </Pressable>
  );
}

export function PhotoActionsSheet({ visible, onAction, onClose }: PhotoActionsSheetProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(SCREEN_H);
  const backdropOpacity = useSharedValue(0);

  React.useEffect(() => {
    if (visible) {
      translateY.value = withSpring(0, springPresets.SHEET_REVEAL);
      backdropOpacity.value = withTiming(1, { duration: 200 });
    } else {
      translateY.value = withSpring(SCREEN_H, springPresets.SHEET_REVEAL);
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
        translateY.value = withSpring(SCREEN_H, springPresets.SHEET_REVEAL);
        backdropOpacity.value = withTiming(0, { duration: 200 });
        runOnJS(onClose)();
      } else {
        translateY.value = withSpring(0, springPresets.SHEET_REVEAL);
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
            { paddingBottom: insets.bottom + 20 },
            sheetStyle,
          ]}
        >
          {/* Handle */}
          <View style={styles.handleContainer}>
            <View style={[styles.handle, { backgroundColor: colors.accent }]} />
          </View>

          {/* Title */}
          <Text style={styles.title}>Actions</Text>

          {/* Actions */}
          <View style={styles.actionsGrid}>
            <ActionItem
              icon={Share2}
              label="Share Moment"
              color="#4CAF50"
              bgColor="rgba(76, 175, 80, 0.12)"
              onPress={() => onAction('share')}
            />
            <ActionItem
              icon={Film}
              label="Add to Reel"
              color="#9C27B0"
              bgColor="rgba(156, 39, 176, 0.12)"
              onPress={() => onAction('reel')}
            />
            <ActionItem
              icon={Archive}
              label="Archive"
              color="#d8ab7a"
              bgColor="rgba(216, 171, 122, 0.12)"
              onPress={() => onAction('archive')}
            />
            <ActionItem
              icon={Trash2}
              label="Delete"
              color="#ff4444"
              bgColor="rgba(255, 68, 68, 0.12)"
              onPress={() => onAction('delete')}
            />
          </View>

          {/* Cancel */}
          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              onClose();
            }}
            style={styles.cancelBtn}
          >
            <Text style={styles.cancelText}>Cancel</Text>
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
    backgroundColor: '#1a1a1a',
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
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f1ebe2',
    textAlign: 'center',
    marginBottom: 20,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  actionItem: {
    width: '47%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 16,
  },
  actionItemPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.97 }],
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  cancelBtn: {
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    marginTop: 4,
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f1ebe2',
  },
});
