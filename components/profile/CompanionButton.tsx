import React from 'react';
import { TouchableOpacity, Text, StyleSheet, Alert } from 'react-native';
import { Check, Star } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/constants/ThemeContext';
import type { CompanionStatus } from '@/lib/types';

interface CompanionButtonProps {
  status: CompanionStatus;
  onAdd: () => void;
  onRemove: () => void;
}

export default function CompanionButton({ status, onAdd, onRemove }: CompanionButtonProps) {
  const { colors } = useTheme();
  const s = getStyles(colors);

  const handlePress = () => {
    if (status === 'none') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onAdd();
    }
  };

  const handleLongPress = () => {
    if (status === 'companion') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      Alert.alert('Remove Companion', 'You can always add them back later.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: onRemove },
      ]);
    }
  };

  if (status === 'companion') {
    return (
      <TouchableOpacity
        style={s.solid}
        activeOpacity={0.8}
        onLongPress={handleLongPress}
      >
        <Check size={13} color={colors.canvas} strokeWidth={2.6} />
        <Text style={s.solidText}>Companion</Text>
      </TouchableOpacity>
    );
  }

  if (status === 'pending') {
    return (
      <TouchableOpacity style={[s.solid, { opacity: 0.6 }]} activeOpacity={1} disabled>
        <Text style={s.solidText}>Request Sent</Text>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity style={s.outline} activeOpacity={0.7} onPress={handlePress}>
      <Star size={13} color={colors.accent} strokeWidth={1.8} />
      <Text style={s.outlineText}>Add Companion</Text>
    </TouchableOpacity>
  );
}

const getStyles = (colors: ReturnType<typeof useTheme>['colors']) =>
  StyleSheet.create({
    solid: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: 999,
      backgroundColor: colors.accent,
      marginTop: 14,
    },
    solidText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.canvas,
      letterSpacing: -0.1,
    },
    outline: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: 999,
      borderWidth: 1.5,
      borderColor: colors.accent,
      marginTop: 14,
    },
    outlineText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.accent,
      letterSpacing: -0.1,
    },
  });
