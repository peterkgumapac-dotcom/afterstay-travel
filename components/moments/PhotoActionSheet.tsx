import * as Haptics from 'expo-haptics';
import { Edit3, Share2, CheckSquare, Trash2, X } from 'lucide-react-native';
import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/constants/ThemeContext';
import { radius, spacing } from '@/constants/theme';

interface PhotoActionSheetProps {
  visible: boolean;
  title?: string;
  onShare: () => void;
  onEdit: () => void;
  onSelectMultiple: () => void;
  onDelete: () => void;
  onClose: () => void;
}

export function PhotoActionSheet({
  visible,
  title,
  onShare,
  onEdit,
  onSelectMultiple,
  onDelete,
  onClose,
}: PhotoActionSheetProps) {
  const { colors } = useTheme();

  const actions = [
    { label: 'Share', icon: Share2, onPress: onShare, color: colors.text },
    { label: 'Edit Details', icon: Edit3, onPress: onEdit, color: colors.text },
    { label: 'Select Multiple', icon: CheckSquare, onPress: onSelectMultiple, color: colors.text },
    { label: 'Delete', icon: Trash2, onPress: onDelete, color: colors.danger },
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: colors.card }]} onPress={(e) => e.stopPropagation()}>
          {/* Handle bar */}
          <View style={[styles.handle, { backgroundColor: colors.border2 }]} />

          {title ? (
            <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>{title}</Text>
          ) : null}

          {actions.map(({ label, icon: Icon, onPress, color }) => (
            <Pressable
              key={label}
              onPress={() => {
                Haptics.selectionAsync();
                onClose();
                onPress();
              }}
              style={({ pressed }) => [
                styles.action,
                { borderBottomColor: colors.border },
                pressed && { backgroundColor: colors.bg },
              ]}
            >
              <Icon size={18} color={color} strokeWidth={1.8} />
              <Text style={[styles.actionLabel, { color }]}>{label}</Text>
            </Pressable>
          ))}

          <Pressable
            onPress={onClose}
            style={[styles.cancelBtn, { backgroundColor: colors.bg, borderColor: colors.border }]}
          >
            <Text style={[styles.cancelText, { color: colors.text }]}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 8,
    paddingBottom: 34,
    paddingHorizontal: spacing.lg,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  actionLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  cancelBtn: {
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
