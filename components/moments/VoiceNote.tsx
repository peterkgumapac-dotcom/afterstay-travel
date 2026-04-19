import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useTheme } from '@/constants/ThemeContext';
import { spacing, radius } from '@/constants/theme';

interface VoiceNoteProps {
  duration: number;
  authorColor: string;
}

const BAR_COUNT = 36;

export function VoiceNote({ duration, authorColor }: VoiceNoteProps) {
  const { colors } = useTheme();
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const startRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const bars = useMemo(() => {
    const seed = duration * 7.1;
    return Array.from({ length: BAR_COUNT }, (_, i) => {
      const s =
        Math.sin(i * 1.3 + seed) * 0.5 +
        Math.sin(i * 0.41 + seed * 1.7) * 0.5;
      return 0.25 + Math.abs(s) * 0.75;
    });
  }, [duration]);

  const stopPlayback = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!playing) {
      stopPlayback();
      return;
    }

    startRef.current = Date.now();
    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startRef.current;
      const p = Math.min(1, elapsed / (duration * 1000));
      setProgress(p);
      if (p >= 1) {
        setPlaying(false);
        setTimeout(() => setProgress(0), 400);
      }
    }, 50);

    return stopPlayback;
  }, [playing, duration, stopPlayback]);

  const handlePress = () => {
    if (playing) {
      setPlaying(false);
      setProgress(0);
    } else {
      setProgress(0);
      setPlaying(true);
    }
  };

  const curSec = Math.round(progress * duration);
  const shown = playing
    ? `0:${String(curSec).padStart(2, '0')}`
    : `0:${String(duration).padStart(2, '0')}`;

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.8}
      style={[
        styles.container,
        {
          backgroundColor: colors.card2,
          borderColor: colors.border,
          borderLeftColor: authorColor,
          borderLeftWidth: 3,
        },
      ]}
    >
      {/* Play / Pause button */}
      <View
        style={[
          styles.playButton,
          { backgroundColor: authorColor },
        ]}
      >
        {playing ? (
          <View style={styles.pauseIconContainer}>
            <View style={[styles.pauseBar, { backgroundColor: '#0b0f14' }]} />
            <View style={[styles.pauseBar, { backgroundColor: '#0b0f14' }]} />
          </View>
        ) : (
          <View style={styles.playIcon} />
        )}
      </View>

      {/* Waveform bars */}
      <View style={styles.waveformContainer}>
        {bars.map((h, i) => {
          const pos = i / (BAR_COUNT - 1);
          const active = pos <= progress;
          return (
            <View
              key={i}
              style={[
                styles.waveformBar,
                {
                  height: `${h * 100}%`,
                  backgroundColor: active ? authorColor : colors.border2,
                  opacity: active ? 1 : 0.55,
                },
              ]}
            />
          );
        })}
      </View>

      {/* Duration label */}
      <Text
        style={[
          styles.durationText,
          { color: colors.text3 },
        ]}
      >
        {shown}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: spacing.sm,
    paddingRight: spacing.md,
    paddingLeft: 10,
    borderWidth: 1,
    borderRadius: radius.sm,
    marginTop: spacing.sm,
  },
  playButton: {
    width: 26,
    height: 26,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  pauseIconContainer: {
    flexDirection: 'row',
    gap: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pauseBar: {
    width: 3,
    height: 10,
    borderRadius: 1,
  },
  playIcon: {
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderTopWidth: 5,
    borderBottomWidth: 5,
    borderLeftColor: '#0b0f14',
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    marginLeft: 2,
  },
  waveformContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    height: 22,
  },
  waveformBar: {
    width: 2,
    borderRadius: 1,
  },
  durationText: {
    fontSize: 10.5,
    fontFamily: 'SpaceMono',
    fontVariant: ['tabular-nums'],
    flexShrink: 0,
  },
});
