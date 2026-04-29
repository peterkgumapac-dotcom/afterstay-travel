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
import type { DailyExpenseCategory } from '@/lib/types';

type ThemeColors = ReturnType<typeof useTheme>['colors'];

const CATEGORIES: { key: DailyExpenseCategory; label: string; emoji: string }[] = [
  { key: 'Food', label: 'Food', emoji: '\uD83C\uDF5C' },
  { key: 'Transport', label: 'Transport', emoji: '\uD83D\uDE95' },
  { key: 'Bills', label: 'Bills', emoji: '\uD83D\uDCCB' },
  { key: 'Entertainment', label: 'Fun', emoji: '\uD83C\uDFAC' },
  { key: 'Groceries', label: 'Groceries', emoji: '\uD83D\uDED2' },
  { key: 'Other', label: 'Other', emoji: '\uD83D\uDCE6' },
];

interface DailyTrackerSheetProps {
  visible: boolean;
  onClose: () => void;
  onSave: (input: { description: string; amount: number; dailyCategory: DailyExpenseCategory; notes?: string }) => void;
}

export function DailyTrackerSheet({ visible, onClose, onSave }: DailyTrackerSheetProps) {
  const { colors } = useTheme();
  const s = getStyles(colors);

  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<DailyExpenseCategory>('Food');
  const [notes, setNotes] = useState('');

  const handleSave = () => {
    const num = parseFloat(amount);
    if (!num || num <= 0) return;
    onSave({
      description: description.trim() || category,
      amount: num,
      dailyCategory: category,
      notes: notes.trim() || undefined,
    });
    setAmount('');
    setDescription('');
    setCategory('Food');
    setNotes('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Pressable style={s.overlay} onPress={onClose}>
          <Pressable style={s.sheet} onPress={() => {}}>
            <ScrollView bounces={false} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <View style={s.headerRow}>
                <Text style={s.title}>Add Daily Expense</Text>
                <TouchableOpacity onPress={onClose} hitSlop={8}>
                  <X size={20} color={colors.text3} />
                </TouchableOpacity>
              </View>

              <Text style={s.label}>Amount</Text>
              <TextInput
                style={s.amountInput}
                value={amount}
                onChangeText={setAmount}
                placeholder="0"
                placeholderTextColor={colors.text3}
                keyboardType="decimal-pad"
                autoFocus
              />

              <Text style={s.label}>Category</Text>
              <View style={s.catGrid}>
                {CATEGORIES.map((c) => (
                  <TouchableOpacity
                    key={c.key}
                    style={[s.catChip, category === c.key && s.catChipActive]}
                    onPress={() => setCategory(c.key)}
                    activeOpacity={0.7}
                  >
                    <Text style={s.catEmoji}>{c.emoji}</Text>
                    <Text style={[s.catText, category === c.key && s.catTextActive]}>{c.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={s.label}>Description (optional)</Text>
              <TextInput
                style={s.input}
                value={description}
                onChangeText={setDescription}
                placeholder="e.g., Lunch at Jollibee"
                placeholderTextColor={colors.text3}
              />

              <TouchableOpacity
                style={[s.saveBtn, (!amount || parseFloat(amount) <= 0) && { opacity: 0.4 }]}
                onPress={handleSave}
                disabled={!amount || parseFloat(amount) <= 0}
                activeOpacity={0.7}
              >
                <Text style={s.saveBtnText}>Add Expense</Text>
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
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    title: { fontSize: 18, fontWeight: '700', color: c.text },
    label: { fontSize: 10, fontWeight: '600', color: c.text3, marginTop: 14, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 },
    amountInput: { backgroundColor: c.bg, borderRadius: radius.sm, borderWidth: 1, borderColor: c.border, color: c.text, fontSize: 28, fontWeight: '700', paddingHorizontal: 14, paddingVertical: 14, textAlign: 'center', letterSpacing: -0.5 },
    catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    catChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.sm, backgroundColor: c.card, borderWidth: 1, borderColor: c.border },
    catChipActive: { backgroundColor: c.accentDim, borderColor: c.accent },
    catEmoji: { fontSize: 16 },
    catText: { fontSize: 12, fontWeight: '600', color: c.text2 },
    catTextActive: { color: c.accent },
    input: { backgroundColor: c.bg, borderRadius: radius.sm, borderWidth: 1, borderColor: c.border, color: c.text, fontSize: 15, paddingHorizontal: 14, paddingVertical: 12 },
    saveBtn: { marginTop: 20, backgroundColor: c.accent, borderRadius: radius.sm, paddingVertical: 14, alignItems: 'center' },
    saveBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  });
