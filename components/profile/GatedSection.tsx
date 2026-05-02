import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Lock } from 'lucide-react-native';
import { useTheme } from '@/constants/ThemeContext';
import CompanionButton from './CompanionButton';

interface GatedSectionProps {
  targetName: string;
  onAddCompanion: () => void;
  children: React.ReactNode;
}

export default function GatedSection({ targetName, onAddCompanion, children }: GatedSectionProps) {
  const { colors } = useTheme();
  const s = getStyles(colors);

  return (
    <View style={s.container}>
      {children}
      <View style={s.veil}>
        <Lock size={22} color={colors.text2} strokeWidth={1.7} />
        <Text style={s.blurb}>
          Travel together or add as a companion to see {targetName}'s trip history.
        </Text>
        <CompanionButton status="none" onAdd={onAddCompanion} onRemove={() => {}} />
      </View>
    </View>
  );
}

const getStyles = (colors: ReturnType<typeof useTheme>['colors']) =>
  StyleSheet.create({
    container: {
      position: 'relative',
      borderRadius: 16,
      overflow: 'hidden',
    },
    veil: {
      ...StyleSheet.absoluteFillObject,
      borderRadius: 16,
      backgroundColor: 'rgba(20,18,16,0.82)',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      padding: 20,
    },
    blurb: {
      color: colors.text2,
      fontSize: 12,
      maxWidth: 230,
      textAlign: 'center',
      lineHeight: 18,
    },
  });
