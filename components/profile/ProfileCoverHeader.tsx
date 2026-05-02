import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { Check, ChevronDown, MessageCircle, Pencil, Plus, Send, Sparkles } from 'lucide-react-native';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';

import { TripCollage } from '@/components/trip/TripCollage';
import { useTheme } from '@/constants/ThemeContext';
import type { CompanionStatus, LifetimeStats, Trip } from '@/lib/types';

interface ProfileCoverHeaderProps {
  fullName: string;
  handle?: string;
  avatarUrl?: string;
  bio?: string;
  homeBase?: string;
  companionStatus: CompanionStatus;
  isSelf: boolean;
  isFollowing: boolean;
  followBusy?: boolean;
  stats: LifetimeStats;
  topTrip?: Trip | null;
  onCustomize: () => void;
  onToggleFollow: () => void;
}

function buildTags(stats: LifetimeStats, homeBase?: string): string[] {
  const tags = ['Travel flex'];
  if (stats.totalMoments > 0) tags.push('Photo enthusiast');
  if (stats.totalCountries > 1) tags.push('Country collector');
  if (homeBase) tags.push(homeBase);
  return tags.slice(0, 4);
}

export default function ProfileCoverHeader({
  fullName,
  handle,
  avatarUrl,
  bio,
  homeBase,
  companionStatus,
  isSelf,
  isFollowing,
  followBusy = false,
  stats,
  topTrip,
  onCustomize,
  onToggleFollow,
}: ProfileCoverHeaderProps) {
  const { width } = useWindowDimensions();
  const { colors } = useTheme();
  const s = getStyles(colors);
  const initial = (fullName || 'Traveler').charAt(0).toUpperCase();
  const tags = buildTags(stats, homeBase);
  const level = Math.max(1, Math.min(8, Math.floor(stats.totalTrips / 2) + 1));

  return (
    <View style={s.container}>
      <View style={s.cover}>
        {topTrip?.id ? (
          <TripCollage tripId={topTrip.id} width={width} height={235} animated={false} />
        ) : (
          <LinearGradient
            colors={[colors.accentDim, colors.card, colors.canvas]}
            style={StyleSheet.absoluteFill}
          />
        )}
        <LinearGradient
          colors={['rgba(0,0,0,0.08)', 'rgba(0,0,0,0.58)']}
          style={StyleSheet.absoluteFill}
        />
        <View style={s.levelBadge}>
          <Sparkles size={14} color="#fff" />
          <Text style={s.levelText}>Level {level}</Text>
        </View>
      </View>

      <View style={s.sheet}>
        <View style={s.avatarWrap}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={s.avatar} contentFit="cover" />
          ) : (
            <View style={[s.avatar, s.avatarFallback]}>
              <Text style={s.initial}>{initial}</Text>
            </View>
          )}
        </View>

        <View style={s.nameRow}>
          <Text style={s.name}>{fullName || 'Traveler'}</Text>
          {companionStatus === 'companion' ? (
            <View style={s.verifiedDot}>
              <Check size={11} color={colors.canvas} strokeWidth={3} />
            </View>
          ) : null}
        </View>
        {handle ? <Text style={s.handle}>@{handle}</Text> : null}
        {bio ? <Text style={s.bio}>{bio}</Text> : null}

        <View style={s.tags}>
          {tags.map((tag) => (
            <View key={tag} style={s.tag}>
              <Text style={s.tagText}>{tag}</Text>
            </View>
          ))}
        </View>

        <View style={s.actions}>
          {isSelf ? (
            <TouchableOpacity style={s.primaryBtn} onPress={onCustomize} activeOpacity={0.78}>
              <Pencil size={16} color={colors.canvas} />
              <Text style={s.primaryText}>Customize</Text>
            </TouchableOpacity>
          ) : companionStatus === 'companion' ? (
            <View style={s.primaryBtn}>
              <Check size={16} color={colors.canvas} />
              <Text style={s.primaryText}>Companion</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[s.primaryBtn, followBusy && { opacity: 0.7 }]}
              onPress={onToggleFollow}
              activeOpacity={0.78}
              disabled={followBusy}
            >
              {followBusy ? (
                <ActivityIndicator size="small" color={colors.canvas} />
              ) : (
                <Plus size={16} color={colors.canvas} />
              )}
              <Text style={s.primaryText}>{isFollowing ? 'Following' : 'Follow'}</Text>
            </TouchableOpacity>
          )}
          {!isSelf ? (
            <TouchableOpacity style={s.secondaryBtn} activeOpacity={0.75}>
              <Send size={16} color={colors.accent} />
              <Text style={s.secondaryText}>Message</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={s.secondaryBtn} onPress={onCustomize} activeOpacity={0.75}>
              <MessageCircle size={16} color={colors.accent} />
              <Text style={s.secondaryText}>View Profile</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={s.iconBtn} activeOpacity={0.75}>
            <ChevronDown size={18} color={colors.accent} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const getStyles = (colors: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  cover: {
    height: 235,
    overflow: 'hidden',
    backgroundColor: colors.card,
  },
  levelBadge: {
    position: 'absolute',
    right: 18,
    bottom: 18,
    minHeight: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.56)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 12,
  },
  levelText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  sheet: {
    marginTop: -28,
    paddingHorizontal: 20,
    paddingTop: 48,
    paddingBottom: 14,
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    backgroundColor: colors.canvas,
  },
  avatarWrap: {
    position: 'absolute',
    top: -58,
    left: 20,
    width: 116,
    height: 116,
    borderRadius: 58,
    borderWidth: 4,
    borderColor: colors.canvas,
    backgroundColor: colors.canvas,
  },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: 58,
    borderWidth: 3,
    borderColor: colors.accent,
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
  },
  initial: {
    color: colors.text,
    fontSize: 36,
    fontWeight: '800',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  name: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: 0,
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
    fontSize: 15,
    fontWeight: '700',
    marginTop: 4,
  },
  bio: {
    color: colors.text2,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 10,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  tag: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  tagText: {
    color: colors.text2,
    fontSize: 12,
    fontWeight: '700',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 18,
  },
  primaryBtn: {
    flex: 1,
    minHeight: 46,
    borderRadius: 16,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  primaryText: {
    color: colors.canvas,
    fontSize: 14,
    fontWeight: '800',
  },
  secondaryBtn: {
    flex: 1,
    minHeight: 46,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  secondaryText: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '800',
  },
  iconBtn: {
    width: 46,
    height: 46,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
