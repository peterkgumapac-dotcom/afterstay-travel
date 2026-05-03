import React from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { useTheme } from '@/constants/ThemeContext';
import { radius } from '@/constants/theme';
import { formatCurrency } from '@/lib/utils';
import type { SavingsMilestone } from '@/lib/types';

type ThemeColors = ReturnType<typeof useTheme>['colors'];

const MESSAGES: Record<SavingsMilestone, { emoji: string; title: string; sub: string }> = {
  25: { emoji: '\uD83C\uDF1F', title: 'Quarter way there!', sub: 'Great start — keep the momentum going.' },
  50: { emoji: '\uD83C\uDF89', title: 'Halfway there!', sub: 'You\'re crushing it. The trip is getting closer.' },
  75: { emoji: '\uD83D\uDE80', title: 'Almost there!', sub: 'Just a little more and you\'re ready to go.' },
  100: { emoji: '\uD83C\uDF0D', title: 'Goal reached!', sub: 'Time to turn that savings into an adventure.' },
};

interface SavingsMilestoneModalProps {
  visible: boolean;
  milestone: SavingsMilestone | null;
  currentAmount: number;
  currency: string;
  onClose: () => void;
}

export function SavingsMilestoneModal({ visible, milestone, currentAmount, currency, onClose }: SavingsMilestoneModalProps) {
  const { colors } = useTheme();
  const s = getStyles(colors);

  if (!milestone) return null;
  const msg = MESSAGES[milestone];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.overlay} onPress={onClose}>
        <Animated.View entering={ZoomIn.springify().damping(15)} style={s.card}>
          <Animated.Text entering={FadeIn.delay(200)} style={s.emoji}>
            {msg.emoji}
          </Animated.Text>
          <Text style={s.pct}>{milestone}%</Text>
          <Text style={s.title}>{msg.title}</Text>
          <Text style={s.amount}>{formatCurrency(currentAmount, currency)} saved</Text>
          <Text style={s.sub}>{msg.sub}</Text>
          <TouchableOpacity style={s.btn} onPress={onClose} activeOpacity={0.7}>
            <Text style={s.btnText}>{milestone === 100 ? 'Plan My Trip' : 'Keep Going'}</Text>
          </TouchableOpacity>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

export default SavingsMilestoneModal;

const getStyles = (c: ThemeColors) =>
  StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
    card: { width: '80%', backgroundColor: c.bg2, borderRadius: radius.xl, padding: 32, alignItems: 'center', borderWidth: 1, borderColor: c.accentBorder },
    emoji: { fontSize: 48, marginBottom: 8 },
    pct: { fontSize: 36, fontWeight: '800', color: c.accent, letterSpacing: -1 },
    title: { fontSize: 20, fontWeight: '700', color: c.text, marginTop: 8, textAlign: 'center' },
    amount: { fontSize: 14, fontWeight: '600', color: c.accent, marginTop: 6 },
    sub: { fontSize: 13, color: c.text2, textAlign: 'center', marginTop: 8, lineHeight: 19 },
    btn: { marginTop: 24, backgroundColor: c.accent, borderRadius: radius.sm, paddingVertical: 12, paddingHorizontal: 32 },
    btnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  });
