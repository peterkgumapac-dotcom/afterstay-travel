import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Easing, Image, Pressable, StyleSheet, Text, View } from 'react-native';

const { width: SCREEN_W } = Dimensions.get('window');
const HERO_H = 380;

interface Props {
  photos: string[];
  hotelName: string;
  destination: string;
  dateRange: string;
  verified?: boolean;
  countdown: {
    status: 'upcoming' | 'active' | 'completed';
    days?: number;
    hours?: number;
    minutes?: number;
    dayNumber?: number;
    totalDays: number;
  };
  quote: string;
  tripStartISO?: string;
}

export const AnticipationHero: React.FC<Props> = ({
  photos,
  hotelName,
  destination,
  dateRange,
  verified,
  countdown,
  quote,
  tripStartISO,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [nextIndex, setNextIndex] = useState(1);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0.3)).current;
  const [now, setNow] = useState(Date.now());

  // Tick every second for live countdown
  useEffect(() => {
    if (countdown.status !== 'upcoming') return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [countdown.status]);

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

  // Pulse animation on days digit
  useEffect(() => {
    if (countdown.status !== 'upcoming') return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.04,
          duration: 1000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [countdown.status]);

  // Glow animation
  useEffect(() => {
    if (countdown.status !== 'upcoming') return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 0.6,
          duration: 1500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
        Animated.timing(glowAnim, {
          toValue: 0.3,
          duration: 1500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [countdown.status]);

  const handleDotPress = (i: number) => {
    Haptics.selectionAsync();
    setCurrentIndex(i);
    setNextIndex((i + 1) % photos.length);
  };

  if (photos.length === 0) return null;

  // Compute live countdown from tripStartISO or use props
  let liveDays = countdown.days ?? 0;
  let liveHours = countdown.hours ?? 0;
  let liveMinutes = countdown.minutes ?? 0;
  let liveSeconds = 0;

  if (countdown.status === 'upcoming' && tripStartISO) {
    const tripStart = new Date(tripStartISO).getTime();
    const diff = Math.max(0, tripStart - now);
    liveDays = Math.floor(diff / 86400000);
    liveHours = Math.floor((diff % 86400000) / 3600000);
    liveMinutes = Math.floor((diff % 3600000) / 60000);
    liveSeconds = Math.floor((diff % 60000) / 1000);
  }

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
        colors={['rgba(8,11,18,0.65)', 'transparent', 'rgba(8,11,18,0.4)', 'rgba(8,11,18,0.95)']}
        locations={[0, 0.25, 0.55, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <View style={styles.dots}>
        {photos.map((_, i) => (
          <Pressable key={i} onPress={() => handleDotPress(i)} hitSlop={8}>
            <View style={[styles.dot, i === currentIndex && styles.dotActive]} />
          </Pressable>
        ))}
      </View>

      {countdown.status === 'upcoming' && (
        <View style={styles.countdownContainer}>
          <Animated.View style={[styles.countdownBackdrop, { shadowOpacity: glowAnim }]}>
            <Text style={styles.countdownLabel}>ARRIVING IN</Text>
            <View style={styles.digitsRow}>
              <Animated.View style={[styles.digitCell, { transform: [{ scale: pulseAnim }] }]}>
                <Text style={styles.digitLarge}>{liveDays}</Text>
                <Text style={styles.digitLabel}>DAYS</Text>
              </Animated.View>
              <Text style={styles.separator}>:</Text>
              <View style={styles.digitCell}>
                <Text style={styles.digit}>{String(liveHours).padStart(2, '0')}</Text>
                <Text style={styles.digitLabel}>HRS</Text>
              </View>
              <Text style={styles.separator}>:</Text>
              <View style={styles.digitCell}>
                <Text style={styles.digit}>{String(liveMinutes).padStart(2, '0')}</Text>
                <Text style={styles.digitLabel}>MIN</Text>
              </View>
              <Text style={styles.separator}>:</Text>
              <View style={styles.digitCell}>
                <Text style={styles.digitMuted}>{String(liveSeconds).padStart(2, '0')}</Text>
                <Text style={styles.digitLabel}>SEC</Text>
              </View>
            </View>
          </Animated.View>
        </View>
      )}

      {countdown.status === 'active' && (
        <View style={styles.countdownContainer}>
          <View style={styles.countdownBackdrop}>
            <Text style={styles.activeLabel}>
              Day {countdown.dayNumber} of {countdown.totalDays}
            </Text>
            <Text style={styles.activeSubLabel}>
              You're in {destination.split(',')[0]}
            </Text>
          </View>
        </View>
      )}

      <View style={styles.bottomInfo}>
        <Text style={styles.hotelName}>{hotelName}</Text>
        <Text style={styles.destination}>{destination}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.dates}>{dateRange}</Text>
          {verified && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{'\u2713'} Confirmed</Text>
            </View>
          )}
        </View>
        {quote ? <Text style={styles.quote}>{quote}</Text> : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: SCREEN_W - 32,
    height: HERO_H,
    borderRadius: 20,
    overflow: 'hidden',
    marginHorizontal: 16,
    backgroundColor: '#0f1318',
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
  countdownContainer: {
    position: 'absolute',
    top: 20,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 3,
  },
  countdownBackdrop: {
    backgroundColor: 'rgba(8, 11, 18, 0.6)',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(45, 212, 160, 0.3)',
    shadowColor: '#2dd4a0',
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 24,
    elevation: 8,
  },
  countdownLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 2,
    marginBottom: 8,
  },
  digitsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  digitCell: {
    alignItems: 'center',
    minWidth: 44,
  },
  digitLarge: {
    color: '#2dd4a0',
    fontSize: 34,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    letterSpacing: -1,
    lineHeight: 38,
  },
  digit: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    lineHeight: 32,
  },
  digitMuted: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 22,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    lineHeight: 26,
  },
  digitLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: 2,
  },
  separator: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 24,
    fontWeight: '200',
    marginTop: -14,
  },
  activeLabel: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
  },
  activeSubLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    marginTop: 6,
    textAlign: 'center',
  },
  bottomInfo: {
    position: 'absolute',
    bottom: 20,
    left: 18,
    right: 18,
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
    marginTop: 3,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  dates: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
  },
  badge: {
    backgroundColor: 'rgba(45,212,160,0.2)',
    borderColor: '#2dd4a0',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  badgeText: {
    color: '#2dd4a0',
    fontSize: 10,
    fontWeight: '600',
  },
  quote: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 8,
  },
});
