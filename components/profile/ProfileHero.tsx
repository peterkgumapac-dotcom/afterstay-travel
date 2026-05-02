import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { useTheme } from '@/constants/ThemeContext';
import CompanionButton from './CompanionButton';
import type { CompanionStatus } from '@/lib/types';

interface ProfileHeroProps {
  fullName: string;
  handle?: string;
  avatarUrl?: string;
  companionStatus: CompanionStatus;
  isSelf: boolean;
  onAddCompanion: () => void;
  onRemoveCompanion: () => void;
}

export default function ProfileHero({
  fullName,
  handle,
  avatarUrl,
  companionStatus,
  isSelf,
  onAddCompanion,
  onRemoveCompanion,
}: ProfileHeroProps) {
  const { colors } = useTheme();
  const s = getStyles(colors);
  const isCompanion = companionStatus === 'companion';
  const initials = fullName
    .split(' ')
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <View style={s.container}>
      <View style={[s.avatarRing, !isCompanion && !isSelf && s.avatarDimmed]}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={s.avatarImage} />
        ) : (
          <View style={s.avatarFallback}>
            <Text style={s.initials}>{initials}</Text>
          </View>
        )}
      </View>
      <Text style={s.name}>{fullName}</Text>
      <Text style={s.handle}>@{handle || fullName.toLowerCase().replace(/\s+/g, '')}</Text>
      {!isSelf && (
        <CompanionButton
          status={companionStatus}
          onAdd={onAddCompanion}
          onRemove={onRemoveCompanion}
        />
      )}
    </View>
  );
}

const getStyles = (colors: ReturnType<typeof useTheme>['colors']) =>
  StyleSheet.create({
    container: {
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: 6,
      paddingBottom: 4,
    },
    avatarRing: {
      width: 80,
      height: 80,
      borderRadius: 40,
      padding: 2,
      backgroundColor: colors.accent,
    },
    avatarDimmed: {
      opacity: 0.55,
    },
    avatarImage: {
      width: '100%',
      height: '100%',
      borderRadius: 38,
    },
    avatarFallback: {
      width: '100%',
      height: '100%',
      borderRadius: 38,
      backgroundColor: colors.card,
      alignItems: 'center',
      justifyContent: 'center',
    },
    initials: {
      fontSize: 28,
      fontWeight: '600',
      color: colors.text,
      letterSpacing: 0.5,
    },
    name: {
      fontSize: 22,
      fontWeight: '600',
      color: colors.text,
      letterSpacing: -0.4,
      marginTop: 14,
      textAlign: 'center',
    },
    handle: {
      fontSize: 12,
      fontWeight: '500',
      color: colors.accent,
      marginTop: 4,
    },
  });
