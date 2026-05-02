import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EyeOff, Images, X, Trash2, Lock, Users } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme, type ThemeColors } from '@/constants/ThemeContext';
import { spacing, radius } from '@/constants/theme';

const MIN_COLLAGE = 3;
const MAX_COLLAGE = 7;

export type BatchAction = 'collage' | 'delete' | 'hide' | 'set-private' | 'set-album' | 'set-shared';

interface BatchActionBarProps {
  count: number;
  onAction: (action: BatchAction) => void;
  onCancel: () => void;
}

export function BatchActionBar({ count, onAction, onCancel }: BatchActionBarProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const s = useMemo(() => getStyles(colors), [colors]);

  const canCollage = count >= MIN_COLLAGE && count <= MAX_COLLAGE;

  return (
    <Animated.View
      entering={FadeInDown.duration(250)}
      exiting={FadeOutDown.duration(180)}
      style={[s.container, { paddingBottom: insets.bottom + 8 }]}
    >
      {/* Top row: count + cancel */}
      <View style={s.topRow}>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onCancel();
          }}
          hitSlop={12}
          style={s.cancelBtn}
        >
          <X size={18} color={colors.text2} />
        </Pressable>
        <Text style={s.count}>{count} selected</Text>
      </View>

      {/* Action buttons */}
      <View style={s.actionsRow}>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onAction('set-private');
          }}
          style={s.actionBtn}
          accessibilityLabel="Set to just me"
        >
          <Lock size={18} color={colors.warn} strokeWidth={2} />
          <Text style={[s.actionLabel, { color: colors.warn }]}>Just Me</Text>
        </Pressable>

        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onAction('set-album');
          }}
          style={s.actionBtn}
          accessibilityLabel="Move to album"
        >
          <Images size={18} color={colors.accentLt} strokeWidth={2} />
          <Text style={[s.actionLabel, { color: colors.accentLt }]}>Album</Text>
        </Pressable>

        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onAction('set-shared');
          }}
          style={s.actionBtn}
          accessibilityLabel="Share in group"
        >
          <Users size={18} color={colors.accent} strokeWidth={2} />
          <Text style={[s.actionLabel, { color: colors.accent }]}>Group</Text>
        </Pressable>

        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onAction('hide');
          }}
          style={s.actionBtn}
          accessibilityLabel="Hide selected"
        >
          <EyeOff size={18} color={colors.text3} strokeWidth={2} />
          <Text style={[s.actionLabel, { color: colors.text3 }]}>Hide</Text>
        </Pressable>

        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onAction('delete');
          }}
          style={s.actionBtn}
          accessibilityLabel="Delete selected"
        >
          <Trash2 size={18} color={colors.danger} strokeWidth={2} />
          <Text style={[s.actionLabel, { color: colors.danger }]}>Delete</Text>
        </Pressable>

        {canCollage && (
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onAction('collage');
            }}
            style={s.collageBtn}
            accessibilityLabel="Create collage"
          >
            <Images size={16} color={colors.bg} />
            <Text style={[s.collageBtnLabel, { color: colors.bg }]}>Collage</Text>
          </Pressable>
        )}
      </View>
    </Animated.View>
  );
}

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 200,
      elevation: 20,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      backgroundColor: colors.bg2,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    topRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: 10,
    },
    cancelBtn: {
      width: 32,
      height: 32,
      borderRadius: radius.sm,
      backgroundColor: colors.card,
      alignItems: 'center',
      justifyContent: 'center',
    },
    count: {
      flex: 1,
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    actionsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    actionBtn: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      paddingVertical: 10,
      borderRadius: radius.sm,
      backgroundColor: colors.card,
    },
    actionLabel: {
      fontSize: 10,
      fontWeight: '600',
    },
    collageBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 18,
      borderRadius: radius.sm,
      backgroundColor: colors.accent,
    },
    collageBtnLabel: {
      fontSize: 12,
      fontWeight: '700',
    },
  });
