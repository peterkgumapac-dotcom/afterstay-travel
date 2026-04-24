import { useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Pencil, Trash2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import type { ThemeColors } from '@/constants/ThemeContext';
import { spacing } from '@/constants/theme';

interface SwipeableExpenseRowProps {
  children: React.ReactNode;
  colors: ThemeColors;
  onEdit: () => void;
  onDelete: () => void;
}

const ACTION_WIDTH = 72;

export default function SwipeableExpenseRow({
  children,
  colors,
  onEdit,
  onDelete,
}: SwipeableExpenseRowProps) {
  const swipeRef = useRef<Swipeable>(null);

  const close = () => swipeRef.current?.close();

  const renderRightActions = () => (
    <Animated.View entering={FadeIn.duration(150)} style={styles.actionsContainer}>
      <Pressable
        style={[styles.iconCircle, { backgroundColor: colors.accent }]}
        onPress={() => { close(); onEdit(); }}
        accessibilityLabel="Edit"
      >
        <Pencil size={16} color={colors.bg} strokeWidth={2.5} />
      </Pressable>
      <Pressable
        style={[styles.iconCircle, { backgroundColor: colors.danger }]}
        onPress={() => { close(); onDelete(); }}
        accessibilityLabel="Delete"
      >
        <Trash2 size={16} color="#fff" strokeWidth={2.5} />
      </Pressable>
    </Animated.View>
  );

  return (
    <Swipeable
      ref={swipeRef}
      renderRightActions={renderRightActions}
      overshootRight={false}
      friction={2}
      rightThreshold={40}
      onSwipeableOpen={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
    >
      {children}
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 10,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
