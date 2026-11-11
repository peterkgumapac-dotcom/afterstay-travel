import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
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
        <View accessibilityRole="image" accessibilityLabel="Locked feature">
          <Lock size={24} color={colors.text3} />
        </View>
        <Text style={s.title}>Feature unavailable</Text>
        <Text style={s.subtitle}>{feature} is not enabled for this account.</Text>
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
});
