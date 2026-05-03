import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { Check, ChevronDown, Image as ImageIcon, MessageCircle, Pencil, Plus, Send, Sparkles } from 'lucide-react-native';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { CachedImage } from '@/components/CachedImage';
import { TripCollage } from '@/components/trip/TripCollage';
import { lightColors, useTheme } from '@/constants/ThemeContext';
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
  followBusy?: boolean;
  stats: LifetimeStats;
  topTrip?: Trip | null;
  onCustomize: () => void;
  onToggleFollow: () => void;
  onMessage?: () => void;
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
  coverPhotoUrl,
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
  onMessage,
}: ProfileCoverHeaderProps) {
  const { width } = useWindowDimensions();
  const colors = lightColors;
  const s = getStyles(colors);
  const initial = (fullName || 'Traveler').charAt(0).toUpperCase();
  const tags = buildTags(stats, homeBase);
  const level = Math.max(1, Math.min(8, Math.floor(stats.totalTrips / 2) + 1));
  const hasCoverVisual = !!coverPhotoUrl || !!topTrip?.id;
  const coverHeight = hasCoverVisual ? Math.min(280, Math.max(248, width * 0.64)) : 232;

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
        {hasCoverVisual ? (
          <LinearGradient
            colors={['rgba(0,0,0,0.02)', 'rgba(0,0,0,0.26)']}
            style={StyleSheet.absoluteFill}
          />
        ) : null}
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
          <Text style={s.name}>{fullName || 'Traveler'}</Text>
          {companionStatus === 'companion' ? (
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
              ) : isFollowing ? (
                <Check size={16} color={colors.canvas} />
              ) : (
                <Plus size={16} color={colors.canvas} />
              )}
              <Text style={s.primaryText}>{isFollowing ? 'Following' : 'Follow'}</Text>
            </TouchableOpacity>
          )}
          {!isSelf ? (
            <TouchableOpacity style={s.secondaryBtn} onPress={onMessage} activeOpacity={0.75}>
              <Send size={16} color={colors.accent} />
              <Text style={s.secondaryText}>Message</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={s.secondaryBtn} onPress={onCustomize} activeOpacity={0.75}>
              <MessageCircle size={16} color={colors.accent} />
              <Text style={s.secondaryText}>Edit details</Text>
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
    bottom: 32,
    zIndex: 4,
    minHeight: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(42,29,13,0.72)',
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
    top: 82,
    zIndex: 4,
    minHeight: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(42,29,13,0.66)',
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
    marginTop: 0,
    paddingHorizontal: 18,
    paddingTop: 54,
    paddingBottom: 10,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    backgroundColor: colors.canvas,
  },
  avatarWrap: {
    position: 'absolute',
    top: -58,
    left: 18,
    width: 94,
    height: 94,
    borderRadius: 47,
    borderWidth: 4,
    borderColor: colors.canvas,
    backgroundColor: colors.canvas,
  },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: 47,
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
    fontSize: 30,
    fontWeight: '800',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  name: {
    color: colors.text,
    fontSize: 26,
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
    fontSize: 14,
    fontWeight: '700',
    marginTop: 4,
  },
  aboutInline: {
    marginTop: 9,
    gap: 3,
  },
  aboutLabel: {
    color: colors.text3,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  bio: {
    color: colors.text2,
    fontSize: 13,
    lineHeight: 18,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginTop: 10,
  },
  tag: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  tagText: {
    color: colors.text2,
    fontSize: 11,
    fontWeight: '700',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  primaryBtn: {
    flex: 1,
    minHeight: 42,
    borderRadius: 15,
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
    minHeight: 42,
    borderRadius: 15,
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
    width: 42,
    height: 42,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
