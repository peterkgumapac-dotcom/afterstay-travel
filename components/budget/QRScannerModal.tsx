import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Link2, X } from 'lucide-react-native';

import { useTheme } from '@/constants/ThemeContext';
import { isQRPhPayload, parseQRPh, type QRPhData } from '@/lib/qrph';

interface Props {
  visible: boolean;
  onScanned: (data: QRPhData) => void;
  onClose: () => void;
}

export default function QRScannerModal({ visible, onScanned, onClose }: Props) {
  const { colors } = useTheme();
  const [pasteInput, setPasteInput] = useState('');

  useEffect(() => {
    if (!visible) setPasteInput('');
  }, [visible]);

  const handleSubmit = useCallback(() => {
    const trimmed = pasteInput.trim();
    if (!trimmed) return;

    if (isQRPhPayload(trimmed)) {
      const parsed = parseQRPh(trimmed);
      if (parsed) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onScanned(parsed);
        return;
      }
    }

    Alert.alert(
      'Invalid QR Data',
      'This doesn\'t look like a Philippine payment QR code (QRPh/EMVCo). Please paste the full QR payload from your banking app.',
    );
  }, [pasteInput, onScanned]);

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={[S.root, { backgroundColor: colors.bg }]}>
        <View style={S.header}>
          <Text style={[S.headerTitle, { color: colors.text }]}>Add Payment QR</Text>
          <Pressable onPress={onClose} hitSlop={12} style={S.closeBtn}>
            <X size={24} color={colors.text2} strokeWidth={2} />
          </Pressable>
        </View>

        <View style={S.content}>
          <View style={[S.iconWrap, { backgroundColor: colors.accentBg }]}>
            <Link2 size={28} color={colors.accent} strokeWidth={1.8} />
          </View>

          <Text style={[S.title, { color: colors.text }]}>Paste QR Payment Data</Text>
          <Text style={[S.subtitle, { color: colors.text3 }]}>
            Open your banking app (GCash, Maya, BPI, etc.) → go to "Receive" or "My QR" → copy the QR data and paste it below.
          </Text>

          <TextInput
            style={[S.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
            value={pasteInput}
            onChangeText={setPasteInput}
            placeholder="Paste QR payload here..."
            placeholderTextColor={colors.text3}
            multiline
            autoFocus
            autoCapitalize="none"
            autoCorrect={false}
          />

          <View style={S.actions}>
            <Pressable
              style={[S.btn, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}
              onPress={onClose}
            >
              <Text style={[S.btnText, { color: colors.text2 }]}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[S.btn, { backgroundColor: colors.accent }]}
              onPress={handleSubmit}
            >
              <Text style={[S.btnText, { color: colors.bg }]}>Generate QR</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const S = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 56, paddingBottom: 12,
  },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  closeBtn: { padding: 4 },
  content: { flex: 1, paddingHorizontal: 20, paddingTop: 32, gap: 14 },
  iconWrap: {
    width: 56, height: 56, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center', alignSelf: 'center',
  },
  title: { fontSize: 20, fontWeight: '700', textAlign: 'center', letterSpacing: -0.5 },
  subtitle: { fontSize: 13, lineHeight: 19, textAlign: 'center' },
  input: {
    minHeight: 120, borderRadius: 14, borderWidth: 1,
    padding: 14, fontSize: 13, fontFamily: 'SpaceMono',
    textAlignVertical: 'top', marginTop: 4,
  },
  actions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  btn: { flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
  btnText: { fontSize: 15, fontWeight: '700' },
});
