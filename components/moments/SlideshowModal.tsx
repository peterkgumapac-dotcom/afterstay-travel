import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, Image, TouchableOpacity, Modal, TextInput,
  StyleSheet, Dimensions, Animated, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { CONFIG } from '../../lib/config';
import { colors } from '@/constants/theme';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const AUTO_ADVANCE_MS = 4000;

interface Moment {
  id: string;
  photoUrl: string;
  caption: string;
  location: string;
  date: string;
}

interface Props {
  visible: boolean;
  moments: Moment[];
  startIndex: number;
  onClose: () => void;
  onRefresh: () => void;
}

export const SlideshowModal: React.FC<Props> = ({
  visible, moments, startIndex, onClose, onRefresh,
}) => {
  const [index, setIndex] = useState(startIndex);
  const [autoPlay, setAutoPlay] = useState(false);
  const [editingCaption, setEditingCaption] = useState(false);
  const [draftCaption, setDraftCaption] = useState('');
  const [shuffled, setShuffled] = useState<Moment[]>(moments);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    setShuffled(moments);
    setIndex(startIndex);
  }, [moments, startIndex]);

  useEffect(() => {
    if (!autoPlay || shuffled.length === 0) return;

    const timer = setTimeout(() => {
      Animated.sequence([
        Animated.timing(fadeAnim, { toValue: 0.3, duration: 400, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]).start();
      setIndex((i) => (i + 1) % shuffled.length);
    }, AUTO_ADVANCE_MS);

    return () => clearTimeout(timer);
  }, [index, autoPlay, shuffled.length]);

  const current = shuffled[index];
  if (!current) return null;

  const handleShuffle = () => {
    Haptics.selectionAsync();
    const shuf = [...shuffled].sort(() => Math.random() - 0.5);
    setShuffled(shuf);
    setIndex(0);
  };

  const handlePrev = () => {
    Haptics.selectionAsync();
    setIndex((i) => (i - 1 + shuffled.length) % shuffled.length);
  };

  const handleNext = () => {
    Haptics.selectionAsync();
    setIndex((i) => (i + 1) % shuffled.length);
  };

  const toggleAutoPlay = () => {
    Haptics.selectionAsync();
    setAutoPlay(!autoPlay);
  };

  const saveCaption = async () => {
    try {
      await fetch(`https://api.notion.com/v1/pages/${current.id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${CONFIG.NOTION_KEY}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          properties: {
            'Caption': {
              rich_text: [{ text: { content: draftCaption } }],
            },
          },
        }),
      });
      setEditingCaption(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onRefresh();
    } catch (e) {
      console.error('Save caption error:', e);
      Alert.alert('Error', 'Could not save caption');
    }
  };

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.container}>
        <Animated.View style={[styles.imageWrap, { opacity: fadeAnim }]}>
          <Image source={{ uri: current.photoUrl }} style={styles.image} resizeMode="contain" />
        </Animated.View>

        <View style={styles.topBar}>
          <TouchableOpacity onPress={onClose} style={styles.topBtn}>
            <Text style={styles.topBtnText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.counter}>
            {index + 1} / {shuffled.length}
          </Text>
          <TouchableOpacity onPress={handleShuffle} style={styles.topBtn}>
            <Text style={styles.topBtnText}>🔀</Text>
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.bottomBar}
        >
          <View style={styles.metaRow}>
            {current.location ? (
              <Text style={styles.location}>📍 {current.location}</Text>
            ) : null}
            {current.date ? (
              <Text style={styles.date}>
                {new Date(current.date).toLocaleDateString('en-US', {
                  month: 'short', day: 'numeric',
                })}
              </Text>
            ) : null}
          </View>

          {editingCaption ? (
            <View>
              <TextInput
                style={styles.captionInput}
                value={draftCaption}
                onChangeText={setDraftCaption}
                placeholder="Add a caption..."
                placeholderTextColor={colors.text3}
                multiline
                autoFocus
              />
              <View style={styles.editActions}>
                <TouchableOpacity onPress={() => setEditingCaption(false)}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={saveCaption}>
                  <Text style={styles.saveText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              onPress={() => {
                setDraftCaption(current.caption);
                setEditingCaption(true);
              }}
            >
              <Text style={current.caption ? styles.caption : styles.captionPlaceholder}>
                {current.caption || '+ Add caption'}
              </Text>
            </TouchableOpacity>
          )}

          <View style={styles.controls}>
            <TouchableOpacity onPress={handlePrev} style={styles.ctrlBtn}>
              <Text style={styles.ctrlText}>‹</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={toggleAutoPlay}
              style={[styles.ctrlBtn, styles.playBtn, autoPlay && styles.playBtnActive]}
            >
              <Text style={styles.ctrlText}>{autoPlay ? '⏸' : '▶'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleNext} style={styles.ctrlBtn}>
              <Text style={styles.ctrlText}>›</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  imageWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  image: { width: SCREEN_W, height: SCREEN_H * 0.7 },
  topBar: {
    position: 'absolute',
    top: 48,
    left: 0, right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  topBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center', justifyContent: 'center',
  },
  topBtnText: { color: colors.text, fontSize: 18 },
  counter: { color: colors.text, fontSize: 13, fontWeight: '600' },
  bottomBar: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    paddingHorizontal: 20,
    paddingBottom: 32,
    paddingTop: 20,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  metaRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 10,
  },
  location: { color: 'rgba(255,255,255,0.8)', fontSize: 12 },
  date: { color: 'rgba(255,255,255,0.6)', fontSize: 12 },
  caption: { color: colors.text, fontSize: 15, lineHeight: 22 },
  captionPlaceholder: { color: colors.text3, fontSize: 14, fontStyle: 'italic' },
  captionInput: {
    color: colors.text,
    fontSize: 15,
    borderBottomWidth: 1,
    borderBottomColor: colors.accent,
    paddingVertical: 8,
    minHeight: 40,
  },
  editActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 20,
    marginTop: 10,
  },
  cancelText: { color: colors.text2, fontSize: 13 },
  saveText: { color: colors.accent, fontSize: 13, fontWeight: '700' },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
    marginTop: 20,
  },
  ctrlBtn: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  playBtn: { width: 60, height: 60, borderRadius: 30 },
  playBtnActive: { backgroundColor: colors.accent },
  ctrlText: { color: colors.text, fontSize: 24, fontWeight: '300' },
});
