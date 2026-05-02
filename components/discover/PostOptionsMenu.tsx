import * as Haptics from 'expo-haptics';
import { EyeOff, MoreVertical, Trash2 } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import { Alert, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { PAPER } from '@/components/feed/feedTheme';
import { deleteFeedPost } from '@/lib/supabase';
import { hidePost } from '@/lib/moments/exploreMomentsService';

interface PostOptionsMenuProps {
  postId: string;
  onDeleted?: () => void;
  onHidden?: () => void;
}

export default function PostOptionsMenu({ postId, onDeleted, onHidden }: PostOptionsMenuProps) {
  const [visible, setVisible] = useState(false);

  const handleDelete = useCallback(() => {
    setVisible(false);
    Alert.alert('Delete post?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteFeedPost(postId);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            onDeleted?.();
          } catch (err) {
            Alert.alert('Error', err instanceof Error ? err.message : 'Failed to delete');
          }
        },
      },
    ]);
  }, [postId, onDeleted]);

  const handleHide = useCallback(async () => {
    setVisible(false);
    try {
      await hidePost(postId);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onHidden?.();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to hide');
    }
  }, [postId, onHidden]);

  return (
    <>
      <TouchableOpacity
        onPress={() => setVisible(true)}
        activeOpacity={0.7}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <MoreVertical size={18} color={PAPER.inkLight} strokeWidth={2} />
      </TouchableOpacity>

      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <TouchableOpacity style={styles.backdrop} onPress={() => setVisible(false)} activeOpacity={1}>
          <View style={styles.sheet}>
            <TouchableOpacity style={styles.option} onPress={handleHide} activeOpacity={0.7}>
              <EyeOff size={18} color={PAPER.inkMid} strokeWidth={1.8} />
              <Text style={styles.optionText}>Hide from feed</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.option} onPress={handleDelete} activeOpacity={0.7}>
              <Trash2 size={18} color="#c4554a" strokeWidth={1.8} />
              <Text style={[styles.optionText, styles.deleteText]}>Delete post</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelOption} onPress={() => setVisible(false)} activeOpacity={0.7}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  sheet: {
    backgroundColor: PAPER.ivoryClean,
    borderRadius: 16,
    overflow: 'hidden',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: PAPER.rule,
  },
  optionText: {
    fontSize: 15,
    fontWeight: '500',
    color: PAPER.inkDark,
  },
  deleteText: {
    color: '#c4554a',
  },
  cancelOption: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: PAPER.inkLight,
  },
});
