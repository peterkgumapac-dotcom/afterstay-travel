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
import type { SavingsGoal } from '@/lib/types';

type ThemeColors = ReturnType<typeof useTheme>['colors'];

interface SavingsGoalSetupProps {
  visible: boolean;
  onClose: () => void;
  onSave: (input: { title: string; targetAmount: number; targetCurrency: string; targetDate?: string; destination?: string }) => void;
  existing?: SavingsGoal | null;
}

const CURRENCIES = ['PHP', 'USD', 'EUR', 'JPY', 'IDR', 'THB'];

export function SavingsGoalSetup({ visible, onClose, onSave, existing }: SavingsGoalSetupProps) {
  const { colors } = useTheme();
  const s = getStyles(colors);

  const [title, setTitle] = useState(existing?.title ?? 'Next Trip Fund');
  const [amount, setAmount] = useState(existing ? String(existing.targetAmount) : '');
  const [currency, setCurrency] = useState(existing?.targetCurrency ?? 'PHP');
  const [destination, setDestination] = useState(existing?.destination ?? '');
  const [targetDate, setTargetDate] = useState(existing?.targetDate ?? '');

  const handleSave = () => {
    const num = parseFloat(amount);
    if (!num || num <= 0) return;
    onSave({
      title: title.trim() || 'Next Trip Fund',
      targetAmount: num,
      targetCurrency: currency,
      targetDate: targetDate || undefined,
      destination: destination.trim() || undefined,
    });
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Pressable style={s.overlay} onPress={onClose}>
          <Pressable style={s.card} onPress={() => {}}>
            <ScrollView bounces={false} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={s.headerRow}>
              <Text style={s.modalTitle}>{existing ? 'Edit Goal' : 'Set Savings Goal'}</Text>
              <TouchableOpacity onPress={onClose} hitSlop={8}>
                <X size={20} color={colors.text3} />
              </TouchableOpacity>
            </View>

            <Text style={s.label}>Goal Name</Text>
            <TextInput
              style={s.input}
              value={title}
              onChangeText={setTitle}
              placeholder="e.g., Boracay Fund"
              placeholderTextColor={colors.text3}
            />

            <Text style={s.label}>Target Amount</Text>
            <TextInput
              style={s.input}
              value={amount}
              onChangeText={setAmount}
              placeholder="50000"
              placeholderTextColor={colors.text3}
              keyboardType="decimal-pad"
            />

            <Text style={s.label}>Currency</Text>
            <View style={s.chipRow}>
              {CURRENCIES.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[s.chip, currency === c && s.chipActive]}
                  onPress={() => setCurrency(c)}
                  activeOpacity={0.7}
                >
                  <Text style={[s.chipText, currency === c && s.chipTextActive]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={s.label}>Destination (optional)</Text>
            <TextInput
              style={s.input}
              value={destination}
              onChangeText={setDestination}
              placeholder="e.g., Bali, Indonesia"
              placeholderTextColor={colors.text3}
            />

            <Text style={s.label}>Target Date (optional)</Text>
            <TextInput
              style={s.input}
              value={targetDate}
              onChangeText={setTargetDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.text3}
              keyboardType="numbers-and-punctuation"
            />

            <TouchableOpacity
              style={[s.saveBtn, (!amount || parseFloat(amount) <= 0) && { opacity: 0.4 }]}
              onPress={handleSave}
              disabled={!amount || parseFloat(amount) <= 0}
              activeOpacity={0.7}
            >
              <Text style={s.saveBtnText}>{existing ? 'Update Goal' : 'Create Goal'}</Text>
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
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
    card: { width: '88%', maxHeight: '80%', backgroundColor: c.bg2, borderRadius: radius.lg, padding: 24, borderWidth: 1, borderColor: c.border },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalTitle: { fontSize: 18, fontWeight: '700', color: c.text },
    label: { fontSize: 12, fontWeight: '600', color: c.text2, marginTop: 14, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.8 },
    input: { backgroundColor: c.bg, borderRadius: radius.sm, borderWidth: 1, borderColor: c.border, color: c.text, fontSize: 15, paddingHorizontal: 14, paddingVertical: 12 },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: c.card, borderWidth: 1, borderColor: c.border },
    chipActive: { backgroundColor: c.accent, borderColor: c.accent },
    chipText: { fontSize: 12, fontWeight: '600', color: c.text2 },
    chipTextActive: { color: '#fff' },
    saveBtn: { marginTop: 24, backgroundColor: c.accent, borderRadius: radius.sm, paddingVertical: 14, alignItems: 'center' },
    saveBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  });
