import React, { useMemo } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Lock } from 'lucide-react-native';
import { useTheme, ThemeColors } from '@/constants/ThemeContext';
import type { UserTier } from '@/lib/types';

interface PremiumGateProps {
  tier: UserTier;
  children: React.ReactNode;
  feature?: string;
}

export function PremiumGate({ tier, children, feature = 'this feature' }: PremiumGateProps) {
  const { colors } = useTheme();
  const s = useMemo(() => getStyles(colors), [colors]);

  if (tier === 'premium') return <>{children}</>;

  return (
    <View style={s.container}>
      <View style={s.overlay}>
        <Lock size={24} color={colors.text3} />
        <Text style={s.title}>Premium Feature</Text>
        <Text style={s.subtitle}>Upgrade to unlock {feature}</Text>
        <TouchableOpacity
          style={s.upgradeBtn}
          onPress={() => Alert.alert('Premium', 'Upgrade coming soon!')}
          activeOpacity={0.7}
        >
          <Text style={s.upgradeBtnText}>Upgrade</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const getStyles = (c: ThemeColors) => StyleSheet.create({
  container: {
    borderRadius: 16, overflow: 'hidden',
    backgroundColor: c.card, borderWidth: 1, borderColor: c.border,
  },
  overlay: {
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 32, paddingHorizontal: 20,
  },
  title: { fontSize: 16, fontWeight: '600', color: c.text, marginTop: 12 },
  subtitle: { fontSize: 13, color: c.text3, marginTop: 4 },
  upgradeBtn: {
    marginTop: 16, backgroundColor: c.accent, borderRadius: 12,
    paddingVertical: 10, paddingHorizontal: 24,
  },
  upgradeBtnText: { fontSize: 14, fontWeight: '600', color: c.bg },
});
