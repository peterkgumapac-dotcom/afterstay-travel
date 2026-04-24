import * as Haptics from 'expo-haptics';
import { X } from 'lucide-react-native';
import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useTheme } from '@/constants/ThemeContext';
import { radius, spacing } from '@/constants/theme';
import type { Moment } from '@/lib/types';

interface PhotoEditSheetProps {
  visible: boolean;
  moment: Moment | null;
  onSave: (id: string, updates: { caption?: string; location?: string }) => void;
  onClose: () => void;
}

export function PhotoEditSheet({ visible, moment, onSave, onClose }: PhotoEditSheetProps) {
  const { colors } = useTheme();
  const [caption, setCaption] = useState(moment?.caption ?? '');
  const [location, setLocation] = useState(moment?.location ?? '');

  // Reset when moment changes
  React.useEffect(() => {
    if (moment) {
      setCaption(moment.caption ?? '');
      setLocation(moment.location ?? '');
    }
  }, [moment?.id]);

  const handleSave = () => {
    if (!moment) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onSave(moment.id, {
      caption: caption.trim() || undefined,
      location: location.trim() || undefined,
    });
    onClose();
  };

  if (!moment) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: colors.card }]} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>Edit Details</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <X size={20} color={colors.text3} strokeWidth={2} />
            </Pressable>
          </View>

          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.text3 }]}>CAPTION</Text>
            <TextInput
              value={caption}
              onChangeText={setCaption}
              placeholder="Add a caption..."
              placeholderTextColor={colors.text3}
              style={[styles.input, { color: colors.text, backgroundColor: colors.bg, borderColor: colors.border }]}
              multiline
              maxLength={200}
            />
          </View>

          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.text3 }]}>LOCATION</Text>
            <TextInput
              value={location}
              onChangeText={setLocation}
              placeholder="Where was this taken?"
              placeholderTextColor={colors.text3}
              style={[styles.input, { color: colors.text, backgroundColor: colors.bg, borderColor: colors.border }]}
              maxLength={100}
            />
          </View>

          <Pressable
            onPress={handleSave}
            style={[styles.saveBtn, { backgroundColor: colors.accent }]}
          >
            <Text style={[styles.saveBtnText, { color: colors.bg }]}>Save</Text>
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
    paddingTop: 16,
    paddingBottom: 40,
    paddingHorizontal: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
  },
  field: {
    marginBottom: 16,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
  },
  saveBtn: {
    paddingVertical: 14,
    borderRadius: radius.md,
    alignItems: 'center',
    marginTop: 8,
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
