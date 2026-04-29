import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { X } from 'lucide-react-native';
import { useTheme } from '@/constants/ThemeContext';
import { radius } from '@/constants/theme';

type ThemeColors = ReturnType<typeof useTheme>['colors'];

interface SavingsEntrySheetProps {
  visible: boolean;
  onClose: () => void;
  onSave: (amount: number, note?: string) => void;
  currency: string;
}

export function SavingsEntrySheet({ visible, onClose, onSave, currency }: SavingsEntrySheetProps) {
  const { colors } = useTheme();
  const s = getStyles(colors);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');

  const handleSave = () => {
    const num = parseFloat(amount);
    if (!num || num <= 0) return;
    onSave(num, note.trim() || undefined);
    setAmount('');
    setNote('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Pressable style={s.overlay} onPress={onClose}>
          <Pressable style={s.sheet} onPress={() => {}}>
            <ScrollView bounces={false} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <View style={s.headerRow}>
                <Text style={s.title}>Log Savings</Text>
                <TouchableOpacity onPress={onClose} hitSlop={8}>
                  <X size={20} color={colors.text3} />
                </TouchableOpacity>
              </View>

              <Text style={s.label}>Amount ({currency})</Text>
              <TextInput
                style={s.input}
                value={amount}
                onChangeText={setAmount}
                placeholder="0"
                placeholderTextColor={colors.text3}
                keyboardType="decimal-pad"
                autoFocus
              />

              <Text style={s.label}>Note (optional)</Text>
              <TextInput
                style={[s.input, { height: 60 }]}
                value={note}
                onChangeText={setNote}
                placeholder="e.g., Birthday money"
                placeholderTextColor={colors.text3}
                multiline
              />

              <TouchableOpacity
                style={[s.saveBtn, (!amount || parseFloat(amount) <= 0) && { opacity: 0.4 }]}
                onPress={handleSave}
                disabled={!amount || parseFloat(amount) <= 0}
                activeOpacity={0.7}
              >
                <Text style={s.saveBtnText}>Save</Text>
              </TouchableOpacity>
            </ScrollView>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const getStyles = (c: ThemeColors) =>
  StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
    sheet: { backgroundColor: c.bg2, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: 24, paddingBottom: 40, borderWidth: 1, borderColor: c.border },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    title: { fontSize: 18, fontWeight: '700', color: c.text },
    label: { fontSize: 11, fontWeight: '600', color: c.text3, marginTop: 12, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.8 },
    input: { backgroundColor: c.bg, borderRadius: radius.sm, borderWidth: 1, borderColor: c.border, color: c.text, fontSize: 18, paddingHorizontal: 14, paddingVertical: 12 },
    saveBtn: { marginTop: 20, backgroundColor: c.accent, borderRadius: radius.sm, paddingVertical: 14, alignItems: 'center' },
    saveBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  });
