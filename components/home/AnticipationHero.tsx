import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/constants/ThemeContext';

const { width: SCREEN_W } = Dimensions.get('window');
const HERO_H = 320;

interface Props {
  photos: string[];
  hotelName: string;
  destination: string;
  dateRange: string;
  verified?: boolean;
  roomInfo?: string;
  bookingRef?: string;
}

export const AnticipationHero: React.FC<Props> = ({
  photos,
  hotelName,
  destination,
  dateRange,
  verified,
  roomInfo,
  bookingRef,
}) => {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [nextIndex, setNextIndex] = useState(1);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Photo cross-fade every 5s
  useEffect(() => {
    if (photos.length <= 1) return;
    const interval = setInterval(() => {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 900,
        useNativeDriver: true,
      }).start(() => {
        setCurrentIndex((p) => (p + 1) % photos.length);
        setNextIndex((p) => (p + 2) % photos.length);
        fadeAnim.setValue(0);
      });
    }, 5000);
    return () => clearInterval(interval);
  }, [photos.length]);

  const handleDotPress = (i: number) => {
    Haptics.selectionAsync();
    setCurrentIndex(i);
    setNextIndex((i + 1) % photos.length);
  };

  if (photos.length === 0) return null;

  return (
    <View style={styles.container}>
      <Image source={{ uri: photos[currentIndex] }} style={styles.image} resizeMode="cover" />

      {photos.length > 1 && (
        <Animated.Image
          source={{ uri: photos[nextIndex] }}
          style={[styles.image, styles.imageOverlay, { opacity: fadeAnim }]}
          resizeMode="cover"
        />
      )}

      <LinearGradient
        colors={['rgba(20,18,16,0.3)', 'transparent', 'rgba(20,18,16,0.5)', 'rgba(20,18,16,0.95)']}
        locations={[0, 0.2, 0.5, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* Dots top-right */}
      <View style={styles.dots}>
        {photos.map((_, i) => (
          <Pressable key={i} onPress={() => handleDotPress(i)} hitSlop={8}>
            <View style={[styles.dot, i === currentIndex && styles.dotActive]} />
          </Pressable>
        ))}
      </View>

      {/* Bottom info overlay */}
      <View style={styles.bottomInfo}>
        <Text style={styles.hotelName}>{hotelName}</Text>
        <Text style={styles.destination}>{destination}</Text>

        {roomInfo ? (
          <Text style={styles.roomInfo}>{roomInfo}</Text>
        ) : null}

        <View style={styles.metaRow}>
          <Text style={styles.dates}>{dateRange}</Text>
          {verified && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{'\u2713'} Confirmed</Text>
            </View>
          )}
        </View>

        {bookingRef ? (
          <Text style={styles.refText}>{bookingRef}</Text>
        ) : null}

        {/* Group member avatars */}
        <View style={styles.groupRow}>
          <View style={styles.avatarStack}>
            {['P', 'A', 'J'].map((initial, i) => (
              <View key={initial} style={[styles.groupAvatar, { marginLeft: i > 0 ? -8 : 0, zIndex: 3 - i }]}>
                <Text style={styles.groupAvatarText}>{initial}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.groupText}>You + 2 travelers</Text>
        </View>
      </View>
    </View>
  );
};

const getStyles = (colors: any) => StyleSheet.create({
  container: {
    width: SCREEN_W - 32,
    height: HERO_H,
    borderRadius: 20,
    overflow: 'hidden',
    marginHorizontal: 16,
    backgroundColor: colors.bg2,
  },
  image: {
    ...StyleSheet.absoluteFillObject,
  },
  imageOverlay: {
    zIndex: 1,
  },
  dots: {
    position: 'absolute',
    top: 14,
    right: 14,
    flexDirection: 'row',
    gap: 4,
    zIndex: 3,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  dotActive: {
    backgroundColor: '#fff',
    width: 20,
  },
  bottomInfo: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    zIndex: 3,
  },
  hotelName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  destination: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    marginTop: 2,
  },
  roomInfo: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    marginTop: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 8,
  },
  dates: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
  },
  badge: {
    backgroundColor: colors.accentDim,
    borderColor: colors.accent,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  badgeText: {
    color: colors.accent,
    fontSize: 10,
    fontWeight: '600',
  },
  refText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 10,
    marginTop: 4,
    fontFamily: 'SpaceMono',
  },
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  avatarStack: {
    flexDirection: 'row',
  },
  groupAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.accentDim,
    borderWidth: 2,
    borderColor: 'rgba(20,18,16,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupAvatarText: {
    color: colors.accentLt,
    fontSize: 10,
    fontWeight: '700',
  },
  groupText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
  },
});
