import { useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
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
        style={[styles.action, { backgroundColor: colors.accent }]}
        onPress={() => {
          close();
          onEdit();
        }}
      >
        <Pencil size={18} color={colors.bg} strokeWidth={2} />
        <Text style={[styles.actionLabel, { color: colors.bg }]}>Edit</Text>
      </Pressable>
      <Pressable
        style={[styles.action, { backgroundColor: colors.danger }]}
        onPress={() => {
          close();
          onDelete();
        }}
      >
        <Trash2 size={18} color="#fff" strokeWidth={2} />
        <Text style={[styles.actionLabel, { color: '#fff' }]}>Delete</Text>
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
    alignItems: 'stretch',
  },
  action: {
    width: ACTION_WIDTH,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
    paddingVertical: spacing.sm,
  },
  actionLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
});
