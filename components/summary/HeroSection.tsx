import React from 'react';
import { Dimensions, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Calendar, MapPin, Users } from 'lucide-react-native';
import type { ThemeColors } from '@/constants/ThemeContext';
import type { GroupMember } from '@/lib/types';

const { width: SCREEN_W } = Dimensions.get('window');
const HERO_H = 340;
const AVATAR_COLORS = ['#a64d1e', '#b8892b', '#c66a36', '#8a5a2b', '#7e9f5b'];

interface Props {
  photoUrl?: string;
  tripName: string;
  destination: string;
  dateLabel: string;
  nights: number;
  members: GroupMember[];
  personality?: string;
  colors: ThemeColors;
  onBack: () => void;
}

export default function HeroSection({
  photoUrl,
  tripName,
  destination,
  dateLabel,
  nights,
  members,
  personality,
  colors,
  onBack,
}: Props) {
  const styles = getStyles(colors);

  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      {photoUrl ? (
        <Image source={{ uri: photoUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : (
        <LinearGradient
          colors={[colors.accent + '30', colors.bg]}
          style={StyleSheet.absoluteFill}
        />
      )}

      {/* Dark gradient for text readability */}
      <LinearGradient
        colors={['rgba(0,0,0,0.3)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.7)']}
        locations={[0, 0.35, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* Back button */}
      <TouchableOpacity onPress={onBack} style={[styles.backBtn, { top: insets.top + 8 }]} activeOpacity={0.7}>
        <ArrowLeft size={20} color="#fff" />
      </TouchableOpacity>

      {/* Bottom info */}
      <View style={styles.bottomInfo}>
        {personality ? (
          <View style={styles.personalityPill}>
            <Text style={styles.personalityText}>{personality}</Text>
          </View>
        ) : null}

        <Text style={styles.tripName}>{tripName}</Text>

        <View style={styles.metaRow}>
          <MapPin size={12} color="rgba(255,255,255,0.7)" />
          <Text style={styles.metaText}>{destination}</Text>
        </View>

        <View style={styles.metaRow}>
          <Calendar size={12} color="rgba(255,255,255,0.7)" />
          <Text style={styles.metaText}>{dateLabel} · {nights} nights</Text>
        </View>

        {members.length > 0 && (
          <View style={styles.membersRow}>
            {members.slice(0, 5).map((m, i) => (
              <View
                key={m.id}
                style={[
                  styles.avatar,
                  {
                    backgroundColor: AVATAR_COLORS[i % AVATAR_COLORS.length],
                    marginLeft: i === 0 ? 0 : -8,
                    zIndex: members.length - i,
                  },
                ]}
              >
                {m.profilePhoto ? (
                  <Image source={{ uri: m.profilePhoto }} style={styles.avatarImg} />
                ) : (
                  <Text style={styles.avatarInitial}>
                    {(m.name ?? '?')[0].toUpperCase()}
                  </Text>
                )}
              </View>
            ))}
            <Text style={styles.memberCount}>
              {members.length} traveler{members.length !== 1 ? 's' : ''}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const getStyles = (_colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      width: SCREEN_W,
      height: HERO_H,
      marginLeft: -20,
      marginTop: -8,
      marginBottom: 20,
    },
    backBtn: {
      position: 'absolute',
      left: 16,
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: 'rgba(0,0,0,0.4)',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10,
    },
    bottomInfo: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      paddingHorizontal: 20,
      paddingBottom: 20,
    },
    personalityPill: {
      alignSelf: 'flex-start',
      backgroundColor: 'rgba(216,171,122,0.85)',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
      marginBottom: 8,
    },
    personalityText: {
      fontSize: 11,
      fontWeight: '700',
      color: '#1a1410',
      textTransform: 'uppercase',
      letterSpacing: 1.2,
    },
    tripName: {
      fontSize: 26,
      fontWeight: '700',
      color: '#fff',
      letterSpacing: -0.8,
      marginBottom: 6,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      marginTop: 3,
    },
    metaText: {
      fontSize: 13,
      color: 'rgba(255,255,255,0.8)',
    },
    membersRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 10,
    },
    avatar: {
      width: 28,
      height: 28,
      borderRadius: 14,
      borderWidth: 2,
      borderColor: 'rgba(0,0,0,0.3)',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    avatarImg: {
      width: 28,
      height: 28,
      borderRadius: 14,
    },
    avatarInitial: {
      fontSize: 11,
      fontWeight: '700',
      color: '#fff',
    },
    memberCount: {
      fontSize: 12,
      color: 'rgba(255,255,255,0.75)',
      marginLeft: 10,
      fontWeight: '600',
    },
  });
