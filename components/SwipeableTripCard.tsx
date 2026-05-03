import React, { useCallback } from 'react';
import {
  Alert,
  Dimensions,
  LayoutAnimation,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  UIManager,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Archive, Pencil, Trash2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

const SCREEN_WIDTH = Dimensions.get('window').width;
const ACTION_WIDTH = 80;
const SNAP_THRESHOLD = -ACTION_WIDTH * 1.2;
const FULL_OPEN = -ACTION_WIDTH * 3;
const SPRING_CONFIG = { damping: 34, stiffness: 250 };

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface SwipeableTripCardProps {
  children: React.ReactNode;
  onEdit?: () => void;
  onArchive?: () => void;
  onDelete?: () => void;
  onRestore?: () => void;
  isDeleted?: boolean;
  isArchived?: boolean;
}

export default function SwipeableTripCard({
  children,
  onEdit,
  onArchive,
  onDelete,
  onRestore,
  isDeleted,
  isArchived,
}: SwipeableTripCardProps) {
  const translateX = useSharedValue(0);
  const rowHeight = useSharedValue<number | null>(null);
  const isRemoving = useSharedValue(false);

  const handleLayoutAnimation = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  }, []);

  const confirmDelete = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      'Delete trip?',
      'You can undo this for 30 days.',
      [
        { text: 'Cancel', style: 'cancel', onPress: () => {
          translateX.value = withSpring(0, SPRING_CONFIG);
        }},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            isRemoving.value = true;
            translateX.value = withTiming(-SCREEN_WIDTH, { duration: 300 }, () => {
              if (rowHeight.value !== null) {
                rowHeight.value = withTiming(0, { duration: 200 }, () => {
                  runOnJS(handleLayoutAnimation)();
                  if (onDelete) runOnJS(onDelete)();
                });
              } else {
                runOnJS(handleLayoutAnimation)();
                if (onDelete) runOnJS(onDelete)();
              }
            });
          },
        },
      ],
    );
  }, [onDelete, translateX, rowHeight, isRemoving, handleLayoutAnimation]);

  const pan = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .failOffsetY([-5, 5])
    .onUpdate((e) => {
      if (isRemoving.value) return;
      // Only allow swiping left
      if (e.translationX < 0) {
        translateX.value = Math.max(e.translationX, FULL_OPEN);
      } else {
        translateX.value = 0;
      }
    })
    .onEnd((e) => {
      if (isRemoving.value) return;
      if (e.translationX < SNAP_THRESHOLD) {
        // Snap open
        translateX.value = withSpring(FULL_OPEN, SPRING_CONFIG);
      } else {
        // Snap closed
        translateX.value = withSpring(0, SPRING_CONFIG);
      }
    });

  const contentStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const containerStyle = useAnimatedStyle(() => {
    if (rowHeight.value !== null && isRemoving.value) {
      return { height: rowHeight.value, overflow: 'hidden' as const };
    }
    return {};
  });

  // Action button opacities based on swipe position
  const editOpacityStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      [0, -ACTION_WIDTH * 0.5, -ACTION_WIDTH],
      [0, 0.5, 1],
      Extrapolation.CLAMP,
    ),
  }));

  const archiveOpacityStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      [-ACTION_WIDTH * 0.5, -ACTION_WIDTH, -ACTION_WIDTH * 2],
      [0, 0.5, 1],
      Extrapolation.CLAMP,
    ),
  }));

  const deleteOpacityStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      [-ACTION_WIDTH, -ACTION_WIDTH * 2, -ACTION_WIDTH * 3],
      [0, 0.5, 1],
      Extrapolation.CLAMP,
    ),
  }));

  const handleEdit = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    translateX.value = withSpring(0, SPRING_CONFIG);
    onEdit?.();
  };

  const handleArchive = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    translateX.value = withSpring(0, SPRING_CONFIG);
    onArchive?.();
  };

  const handleRestore = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    translateX.value = withSpring(0, SPRING_CONFIG);
    onRestore?.();
  };

  const handleDeletePress = () => {
    runOnJS(confirmDelete)();
  };

  const showActions = !isDeleted && (onEdit || onArchive || onDelete);
  const showRestore = isDeleted || isArchived;

  return (
    <Animated.View
      style={containerStyle}
      onLayout={(e) => {
        if (rowHeight.value === null) {
          rowHeight.value = e.nativeEvent.layout.height;
        }
      }}
    >
      <View style={styles.container}>
        {/* Action backdrop */}
        <View style={styles.backdrop}>
          {showRestore ? (
            <Pressable
              style={[styles.actionBtn, { backgroundColor: '#2d6a2e' }]}
              onPress={handleRestore}
            >
              <Archive size={18} color="#fff" />
              <Text style={styles.actionLabel}>Restore</Text>
            </Pressable>
          ) : showActions ? (
            <>
              {/* Edit */}
              {onEdit && (
                <Animated.View style={[styles.actionWrapper, editOpacityStyle]}>
                  <Pressable
                    style={[styles.actionBtn, { backgroundColor: '#4a90d9' }]}
                    onPress={handleEdit}
                  >
                    <Pencil size={18} color="#fff" />
                    <Text style={styles.actionLabel}>Edit</Text>
                  </Pressable>
                </Animated.View>
              )}
              {/* Archive */}
              {onArchive && (
                <Animated.View style={[styles.actionWrapper, archiveOpacityStyle]}>
                  <Pressable
                    style={[styles.actionBtn, { backgroundColor: '#d4a843' }]}
                    onPress={handleArchive}
                  >
                    <Archive size={18} color="#fff" />
                    <Text style={styles.actionLabel}>Archive</Text>
                  </Pressable>
                </Animated.View>
              )}
              {/* Delete */}
              {onDelete && (
                <Animated.View style={[styles.actionWrapper, deleteOpacityStyle]}>
                  <Pressable
                    style={[styles.actionBtn, { backgroundColor: '#c4554a' }]}
                    onPress={handleDeletePress}
                  >
                    <Trash2 size={18} color="#fff" />
                    <Text style={styles.actionLabel}>Delete</Text>
                  </Pressable>
                </Animated.View>
              )}
            </>
          ) : null}
        </View>

        {/* Swipeable content */}
        <GestureDetector gesture={pan}>
          <Animated.View style={contentStyle}>{children}</Animated.View>
        </GestureDetector>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingRight: 0,
    borderRadius: 14,
    overflow: 'hidden',
  },
  actionWrapper: {
    width: ACTION_WIDTH,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionBtn: {
    width: ACTION_WIDTH,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  actionLabel: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});
