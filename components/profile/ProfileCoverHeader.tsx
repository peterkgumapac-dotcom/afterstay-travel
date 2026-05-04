import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { Check, ChevronDown, Image as ImageIcon, MessageCircle, Pencil, Plus, Send, Sparkles } from 'lucide-react-native';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { CachedImage } from '@/components/CachedImage';
import { TripCollage } from '@/components/trip/TripCollage';
import { lightColors, useTheme } from '@/constants/ThemeContext';
import type { ProfileBadge } from '@/lib/profileIntelligence';
import type { CompanionStatus, LifetimeStats, Trip } from '@/lib/types';

interface ProfileCoverHeaderProps {
  fullName: string;
  handle?: string;
  avatarUrl?: string;
  coverPhotoUrl?: string;
  bio?: string;
  homeBase?: string;
  companionStatus: CompanionStatus;
  isSelf: boolean;
  isFollowing: boolean;
  isCompanion?: boolean;
  canMessage?: boolean;
  badges?: ProfileBadge[];
  followBusy?: boolean;
  stats: LifetimeStats;
  topTrip?: Trip | null;
  onCustomize: () => void;
  onToggleFollow: () => void;
  onMessage?: () => void;
  onMore?: () => void;
}

function buildTags(stats: LifetimeStats, homeBase?: string, badges?: ProfileBadge[]): string[] {
  const factBadges = (badges ?? []).map((badge) => badge.label).filter(Boolean);
  if (factBadges.length > 0) return factBadges.slice(0, 3);

  const tags = ['Travel Flex'];
  if (stats.totalMoments >= 10) tags.push('Memory Maker');
  if (stats.totalCountries > 1) tags.push('Globetrotter');
  if (homeBase) tags.push(homeBase);
  return tags.slice(0, 3);
}

export default function ProfileCoverHeader({
  fullName,
  handle,
  avatarUrl,
  coverPhotoUrl,
  bio,
  homeBase,
  companionStatus,
  isSelf,
  isFollowing,
  isCompanion = companionStatus === 'companion',
  canMessage = false,
  badges,
  followBusy = false,
  stats,
  topTrip,
  onCustomize,
  onToggleFollow,
  onMessage,
  onMore,
}: ProfileCoverHeaderProps) {
  const { width } = useWindowDimensions();
  const colors = lightColors;
  const s = getStyles(colors);
  const initial = (fullName || 'Traveler').charAt(0).toUpperCase();
  const tags = buildTags(stats, homeBase, badges);
  const level = Math.max(1, Math.min(8, Math.floor(stats.totalTrips / 2) + 1));
  const hasCoverVisual = !!coverPhotoUrl || !!topTrip?.id;
  const coverHeight = hasCoverVisual ? Math.min(224, Math.max(198, width * 0.5)) : 176;

  return (
    <View style={s.container}>
      <View style={[s.cover, { height: coverHeight }]}>
        {coverPhotoUrl ? (
          <CachedImage remoteUrl={coverPhotoUrl} style={StyleSheet.absoluteFill} />
        ) : topTrip?.id ? (
          <TripCollage tripId={topTrip.id} width={width} height={coverHeight} animated={false} />
        ) : (
          <LinearGradient
            colors={['#365f75', '#d7a86c', colors.canvas]}
            style={StyleSheet.absoluteFill}
          >
            <View style={s.coverPattern}>
              <Svg width="100%" height="100%" viewBox="0 0 390 236">
                <Path
                  d="M-30 168 C42 112 88 142 142 106 C202 66 252 104 310 66 C352 38 408 56 430 30 L430 236 L-30 236 Z"
                  fill="rgba(255,255,255,0.18)"
                />
                <Path
                  d="M18 150 C86 116 150 158 214 120 C268 88 330 114 390 78"
                  fill="none"
                  stroke="rgba(255,255,255,0.38)"
                  strokeWidth={1.2}
                  strokeDasharray="6 8"
                />
                <Circle cx={92} cy={130} r={4} fill="rgba(255,255,255,0.8)" />
                <Circle cx={286} cy={96} r={4} fill="rgba(255,255,255,0.8)" />
              </Svg>
            </View>
          </LinearGradient>
        )}
        <View style={s.levelBadge}>
          <Sparkles size={14} color="#fff" />
          <Text style={s.levelText}>Level {level}</Text>
        </View>
        {isSelf ? (
          <TouchableOpacity style={s.coverEditPill} onPress={onCustomize} activeOpacity={0.78}>
            <ImageIcon size={14} color="#fff" />
            <Text style={s.coverEditText}>Cover</Text>
          </TouchableOpacity>
        ) : null}
        <Svg
          width={width}
          height={34}
          viewBox={`0 0 ${width} 34`}
          style={s.wave}
          pointerEvents="none"
        >
          <Path
            d={`M0 22 C ${width * 0.24} 6 ${width * 0.56} 36 ${width} 18 L ${width} 34 L 0 34 Z`}
            fill={colors.canvas}
          />
        </Svg>
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
          <Text style={s.name} numberOfLines={1} ellipsizeMode="tail">
            {fullName || 'Traveler'}
          </Text>
          {isCompanion ? (
            <View style={s.verifiedDot}>
              <Check size={11} color={colors.canvas} strokeWidth={3} />
            </View>
          ) : null}
        </View>
        {handle ? <Text style={s.handle}>@{handle}</Text> : null}
        {bio ? (
          <View style={s.aboutInline}>
            <Text style={s.aboutLabel}>{isSelf ? 'About you' : 'About'}</Text>
            <Text style={s.bio}>{bio}</Text>
          </View>
        ) : null}

        <View style={s.tags}>
          {tags.map((tag) => (
            <View key={tag} style={s.tag}>
              <Text style={s.tagText}>{tag}</Text>
            </View>
          ))}
        </View>
        {!isSelf && isCompanion ? (
          <View style={s.companionPill}>
            <Check size={12} color={colors.accent} strokeWidth={2.4} />
            <Text style={s.companionText}>Companion from a shared trip</Text>
          </View>
        ) : null}

        <View style={s.actions}>
          {isSelf ? (
            <TouchableOpacity style={s.primaryBtn} onPress={onCustomize} activeOpacity={0.78}>
              <Pencil size={16} color={colors.canvas} />
              <Text style={s.primaryText}>Customize</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[s.primaryBtn, followBusy && { opacity: 0.7 }]}
              onPress={onToggleFollow}
              activeOpacity={0.78}
              disabled={followBusy}
            >
              {followBusy ? (
                <ActivityIndicator size="small" color={colors.canvas} />
              ) : isFollowing ? (
                <Check size={16} color={colors.canvas} />
              ) : (
                <Plus size={16} color={colors.canvas} />
              )}
              <Text style={s.primaryText}>{isFollowing ? 'Following' : 'Follow'}</Text>
            </TouchableOpacity>
          )}
          {isSelf ? (
            <TouchableOpacity style={s.secondaryBtn} onPress={onCustomize} activeOpacity={0.75}>
              <MessageCircle size={15} color={colors.accent} />
              <Text style={s.secondaryText}>Edit details</Text>
            </TouchableOpacity>
          ) : canMessage ? (
            <TouchableOpacity style={s.secondaryBtn} onPress={onMessage} activeOpacity={0.75}>
              <Send size={15} color={colors.accent} />
              <Text style={s.secondaryText}>Message</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={[s.secondaryBtn, s.secondaryDisabled]} activeOpacity={1} disabled>
              <MessageCircle size={15} color={colors.text3} />
              <Text style={[s.secondaryText, s.secondaryTextDisabled]}>Message</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={s.iconBtn} onPress={onMore} activeOpacity={0.75}>
            <ChevronDown size={18} color={colors.accent} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const getStyles = (colors: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  container: {
    marginBottom: 10,
  },
  cover: {
    overflow: 'hidden',
    backgroundColor: colors.card,
  },
  coverPattern: {
    flex: 1,
    opacity: 0.95,
  },
  wave: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: -1,
  },
  levelBadge: {
    position: 'absolute',
    right: 18,
    bottom: 18,
    zIndex: 4,
    minHeight: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(42,29,13,0.62)',
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
  coverEditPill: {
    position: 'absolute',
    right: 18,
    top: 58,
    zIndex: 4,
    minHeight: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(42,29,13,0.58)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 11,
  },
  coverEditText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
  sheet: {
    marginTop: -12,
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 4,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    backgroundColor: colors.canvas,
  },
  avatarWrap: {
    position: 'absolute',
    top: -34,
    left: 16,
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 3,
    borderColor: colors.canvas,
    backgroundColor: colors.canvas,
  },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: 29,
    borderWidth: 2.5,
    borderColor: colors.accent,
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
  },
  initial: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  name: {
    flexShrink: 1,
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0,
  },
  verifiedDot: {
    width: 17,
    height: 17,
    borderRadius: 8.5,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  handle: {
    color: colors.accent,
    fontSize: 11.5,
    fontWeight: '700',
    marginTop: 2,
  },
  aboutInline: {
    marginTop: 3,
  },
  aboutLabel: {
    display: 'none',
    color: colors.text3,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  bio: {
    color: colors.text2,
    fontSize: 11.5,
    lineHeight: 15,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    marginTop: 5,
  },
  tag: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tagText: {
    color: colors.text2,
    fontSize: 9.5,
    fontWeight: '700',
  },
  companionPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.accentBorder,
    backgroundColor: colors.accentBg,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  companionText: {
    color: colors.accent,
    fontSize: 10,
    fontWeight: '800',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 7,
  },
  primaryBtn: {
    flex: 1,
    minHeight: 29,
    borderRadius: 10,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 7,
  },
  primaryText: {
    color: colors.canvas,
    fontSize: 11.5,
    fontWeight: '800',
  },
  secondaryBtn: {
    flex: 1,
    minHeight: 29,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 7,
  },
  secondaryText: {
    color: colors.accent,
    fontSize: 11.5,
    fontWeight: '800',
  },
  secondaryDisabled: {
    opacity: 0.62,
  },
  secondaryTextDisabled: {
    color: colors.text3,
  },
  iconBtn: {
    width: 31,
    height: 31,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
