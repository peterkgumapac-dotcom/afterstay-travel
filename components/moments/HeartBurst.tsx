import React, { useEffect, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  withDelay,
  withRepeat,
  Easing,
  runOnJS,
  type SharedValue,
} from 'react-native-reanimated';
import { Heart } from 'lucide-react-native';
import { springPresets, particleConfig } from '@/constants/animations';

interface HeartBurstProps {
  visible: boolean;
  onComplete?: () => void;
  centerX?: number;
  centerY?: number;
}

interface ParticleProps {
  angle: number;
  distance: number;
  color: string;
  delay: number;
  active: SharedValue<boolean>;
}

function Particle({ angle, distance, color, delay, active }: ParticleProps) {
  const progress = useSharedValue(0);
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0);

  useEffect(() => {
    if (active.value) {
      progress.value = withDelay(
        delay,
        withTiming(1, { duration: 600, easing: Easing.out(Easing.quad) })
      );
      opacity.value = withDelay(
        delay,
        withSequence(
          withTiming(1, { duration: 100 }),
          withTiming(0, { duration: 400, easing: Easing.in(Easing.quad) })
        )
      );
      scale.value = withDelay(
        delay,
        withSequence(
          withSpring(1.5, springPresets.HEART_BURST),
          withTiming(0, { duration: 200 })
        )
      );
    }
  }, []);

  const style = useAnimatedStyle(() => {
    const rad = (angle * Math.PI) / 180;
    const x = Math.cos(rad) * distance * progress.value;
    const y = Math.sin(rad) * distance * progress.value;
    return {
      transform: [
        { translateX: x },
        { translateY: y },
        { scale: scale.value },
      ],
      opacity: opacity.value,
    };
  });

  return (
    <Animated.View style={[styles.particle, { backgroundColor: color }, style]} />
  );
}

export function HeartBurst({ visible, onComplete, centerX = 0, centerY = 0 }: HeartBurstProps) {
  const heartScale = useSharedValue(0);
  const heartOpacity = useSharedValue(0);
  const containerScale = useSharedValue(1);
  const active = useSharedValue(false);

  const triggerComplete = useCallback(() => {
    onComplete?.();
  }, [onComplete]);

  useEffect(() => {
    if (visible) {
      active.value = true;
      // Container pulse
      containerScale.value = withSequence(
        withSpring(1.1, { stiffness: 400, damping: 10, mass: 0.5 }),
        withSpring(1, springPresets.SNAPPY)
      );
      // Heart burst animation
      heartScale.value = withSequence(
        withTiming(0, { duration: 0 }),
        withSpring(1.5, springPresets.HEART_BURST),
        withTiming(0, { duration: 200, easing: Easing.in(Easing.quad) })
      );
      heartOpacity.value = withSequence(
        withTiming(1, { duration: 100 }),
        withTiming(0, { duration: 500, easing: Easing.in(Easing.quad) })
      );

      // Cleanup after animation
      const timer = setTimeout(() => {
        active.value = false;
        triggerComplete();
      }, 700);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: containerScale.value }],
  }));

  const heartStyle = useAnimatedStyle(() => ({
    transform: [{ scale: heartScale.value }],
    opacity: heartOpacity.value,
  }));

  if (!visible) return null;

  const particles = Array.from({ length: particleConfig.count }, (_, i) => ({
    angle: i * particleConfig.angleInterval + (Math.random() * 10 - 5),
    distance:
      particleConfig.distanceMin +
      Math.random() * (particleConfig.distanceMax - particleConfig.distanceMin),
    color: particleConfig.colors[i % particleConfig.colors.length],
    delay: i * 30,
  }));

  return (
    <Animated.View
      style={[
        styles.container,
        { left: centerX - 60, top: centerY - 60 },
        containerStyle,
      ]}
      pointerEvents="none"
    >
      {/* Central heart */}
      <Animated.View style={[styles.heartContainer, heartStyle]}>
        <Heart size={48} color="#e55" fill="#e55" strokeWidth={0} />
      </Animated.View>

      {/* Particles */}
      {particles.map((p, i) => (
        <Particle
          key={i}
          angle={p.angle}
          distance={p.distance}
          color={p.color}
          delay={p.delay}
          active={active}
        />
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  heartContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  particle: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
