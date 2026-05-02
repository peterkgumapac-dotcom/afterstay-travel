import { Image } from 'expo-image';
import { Check, MapPin, Pencil, Star } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { useTheme } from '@/constants/ThemeContext';
import type { CompanionStatus } from '@/lib/types';

interface ProfileHeaderProps {
  fullName: string;
  handle?: string;
  avatarUrl?: string;
  bio?: string;
  homeBase?: string;
  isSelf: boolean;
  companionStatus: CompanionStatus;
  isFollowing: boolean;
  onCustomize: () => void;
  onToggleFollow: () => void;
}

export default function ProfileHeader({
  fullName,
  handle,
  avatarUrl,
  bio,
  homeBase,
  isSelf,
  companionStatus,
  isFollowing,
  onCustomize,
  onToggleFollow,
}: ProfileHeaderProps) {
  const { colors } = useTheme();
  const s = getStyles(colors);
  const initial = (fullName || 'Traveler').charAt(0).toUpperCase();

  return (
    <View style={s.container}>
      {avatarUrl ? (
        <Image source={{ uri: avatarUrl }} style={s.avatar} contentFit="cover" />
      ) : (
        <View style={[s.avatar, s.avatarFallback]}>
          <Text style={s.initial}>{initial}</Text>
        </View>
      )}
      <View style={s.nameRow}>
        <Text style={s.name}>{fullName || 'Traveler'}</Text>
        {companionStatus === 'companion' && !isSelf ? (
          <View style={s.verifiedDot}>
            <Check size={10} color={colors.canvas} strokeWidth={3} />
          </View>
        ) : null}
      </View>
      {handle ? <Text style={s.handle}>@{handle}</Text> : null}
      {bio ? <Text style={s.bio}>{bio}</Text> : null}
      {homeBase ? (
        <View style={s.homeRow}>
          <MapPin size={12} color={colors.text3} strokeWidth={2} />
          <Text style={s.homeText}>{homeBase}</Text>
        </View>
      ) : null}

      <View style={s.actionRow}>
        {isSelf ? (
          <TouchableOpacity style={s.primaryBtn} onPress={onCustomize} activeOpacity={0.75}>
            <Pencil size={16} color={colors.canvas} strokeWidth={2} />
            <Text style={s.primaryText}>Customize Profile</Text>
          </TouchableOpacity>
        ) : companionStatus === 'companion' ? (
          <View style={s.primaryBtn}>
            <Check size={16} color={colors.canvas} strokeWidth={2.4} />
            <Text style={s.primaryText}>Companion</Text>
          </View>
        ) : (
          <TouchableOpacity style={s.primaryBtn} onPress={onToggleFollow} activeOpacity={0.75}>
            <Star size={16} color={colors.canvas} strokeWidth={2} />
            <Text style={s.primaryText}>{isFollowing ? 'Following' : 'Follow'}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const getStyles = (colors: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 18,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 3,
    borderColor: colors.accent,
  },
  avatarFallback: {
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: {
    color: colors.text,
    fontSize: 34,
    fontWeight: '700',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 16,
  },
  name: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.6,
  },
  verifiedDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  handle: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '600',
    marginTop: 3,
  },
  bio: {
    color: colors.text2,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 12,
    maxWidth: 320,
  },
  homeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
  homeText: {
    color: colors.text3,
    fontSize: 12,
    fontWeight: '600',
  },
  actionRow: {
    flexDirection: 'row',
    marginTop: 18,
  },
  primaryBtn: {
    minHeight: 44,
    minWidth: 176,
    borderRadius: 16,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 18,
  },
  primaryText: {
    color: colors.canvas,
    fontSize: 14,
    fontWeight: '700',
  },
});
