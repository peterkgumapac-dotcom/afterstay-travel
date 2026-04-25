import React, { useCallback, useMemo, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Check, Grid3x3, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Canvas, Image as SkiaImage, useImage } from '@shopify/react-native-skia';

import { useTheme } from '@/constants/ThemeContext';
import type { MomentDisplay } from './types';

const { width: SCREEN_W } = Dimensions.get('window');
const GRID_GAP = 3;
const NUM_COLS = 3;
const THUMB_SIZE = (SCREEN_W - 32 - GRID_GAP * (NUM_COLS - 1)) / NUM_COLS;

interface PhotoGridPickerProps {
  visible: boolean;
  moments: MomentDisplay[];
  onConfirm: (selected: MomentDisplay[]) => void;
  onClose: () => void;
}

export function PhotoGridPicker({ visible, moments, onConfirm, onClose }: PhotoGridPickerProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const s = useMemo(() => getStyles(colors), [colors]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelect = useCallback((id: string) => {
    Haptics.selectionAsync();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    Haptics.selectionAsync();
    setSelectedIds(new Set(moments.map((m) => m.id)));
  }, [moments]);

  const handleConfirm = useCallback(() => {
    const selected = moments.filter((m) => selectedIds.has(m.id));
    if (selected.length === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onConfirm(selected);
    setSelectedIds(new Set());
  }, [moments, selectedIds, onConfirm]);

  const handleClose = useCallback(() => {
    setSelectedIds(new Set());
    onClose();
  }, [onClose]);

  const renderItem = useCallback(
    ({ item }: { item: MomentDisplay }) => {
      const isSelected = selectedIds.has(item.id);
      return (
        <Pressable
          onPress={() => toggleSelect(item.id)}
          style={[s.thumb, isSelected && s.thumbSelected]}
          accessibilityLabel={`${item.caption || 'Photo'}${isSelected ? ', selected' : ''}`}
        >
          <SkiaThumb uri={item.photo ?? ''} size={THUMB_SIZE} />
          {isSelected && (
            <View style={s.checkBadge}>
              <Check size={14} color="#000" strokeWidth={3} />
            </View>
          )}
          {!isSelected && <View style={s.unselectedOverlay} />}
        </Pressable>
      );
    },
    [selectedIds, toggleSelect, s],
  );

  if (!visible) return null;

  const count = selectedIds.size;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" statusBarTranslucent onRequestClose={handleClose}>
      <View style={[s.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        {/* Header */}
        <View style={s.header}>
          <Pressable onPress={handleClose} style={s.headerBtn} accessibilityLabel="Close">
            <X size={20} color="#fff" strokeWidth={2} />
          </Pressable>
          <Text style={s.headerTitle}>
            {count > 0 ? `${count} selected` : 'Select Photos'}
          </Text>
          <Pressable onPress={selectAll} style={s.headerBtn} accessibilityLabel="Select all">
            <Grid3x3 size={18} color={colors.accent} strokeWidth={2} />
          </Pressable>
        </View>

        {/* Grid */}
        <FlatList
          data={moments}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          numColumns={NUM_COLS}
          contentContainerStyle={s.grid}
          columnWrapperStyle={s.gridRow}
          showsVerticalScrollIndicator={false}
        />

        {/* Bottom action */}
        <View style={[s.footer, { paddingBottom: insets.bottom + 12 }]}>
          <Pressable
            onPress={handleConfirm}
            disabled={count === 0}
            style={[s.confirmBtn, count === 0 && s.confirmBtnDisabled]}
            accessibilityLabel={`Edit ${count} photos`}
          >
            <Text style={[s.confirmText, count === 0 && s.confirmTextDisabled]}>
              {count === 0 ? 'Select photos' : count === 1 ? 'Edit Photo' : `Edit ${count} Photos`}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function SkiaThumb({ uri, size }: { uri: string; size: number }) {
  const img = useImage(uri);
  if (!img) return <View style={{ width: size, height: size, backgroundColor: '#1a1a1a' }} />;
  return (
    <Canvas style={{ width: size, height: size }}>
      <SkiaImage image={img} fit="cover" x={0} y={0} width={size} height={size} />
    </Canvas>
  );
}

const getStyles = (colors: ReturnType<typeof useTheme>['colors']) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: '#000',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    headerBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: '#fff',
      letterSpacing: -0.3,
    },
    grid: {
      paddingHorizontal: 16,
      paddingBottom: 16,
    },
    gridRow: {
      gap: GRID_GAP,
      marginBottom: GRID_GAP,
    },
    thumb: {
      width: THUMB_SIZE,
      height: THUMB_SIZE,
      borderRadius: 8,
      overflow: 'hidden',
    },
    thumbSelected: {
      borderWidth: 2,
      borderColor: colors.accent,
    },
    checkBadge: {
      position: 'absolute',
      top: 6,
      right: 6,
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    unselectedOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.15)',
    },
    footer: {
      paddingHorizontal: 20,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: 'rgba(255,255,255,0.08)',
    },
    confirmBtn: {
      backgroundColor: colors.accent,
      paddingVertical: 15,
      borderRadius: 14,
      alignItems: 'center',
    },
    confirmBtnDisabled: {
      backgroundColor: 'rgba(255,255,255,0.08)',
    },
    confirmText: {
      fontSize: 15,
      fontWeight: '700',
      color: '#000',
    },
    confirmTextDisabled: {
      color: 'rgba(255,255,255,0.3)',
    },
  });
