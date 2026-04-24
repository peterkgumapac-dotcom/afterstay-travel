import { Audio, AVPlaybackSource } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';

export type SoundName =
  | 'rattle'
  | 'scratch'
  | 'drumroll'
  | 'reveal'
  | 'heartbeat'
  | 'boom'
  | 'chime';

const SOUND_FILES: Record<SoundName, AVPlaybackSource> = {
  rattle: require('@/assets/sounds/fate/spin-rattle.wav'),
  scratch: require('@/assets/sounds/fate/record-scratch.wav'),
  drumroll: require('@/assets/sounds/fate/drumroll.wav'),
  reveal: require('@/assets/sounds/fate/fate-reveal.wav'),
  heartbeat: require('@/assets/sounds/fate/heartbeat.wav'),
  boom: require('@/assets/sounds/fate/boom.wav'),
  chime: require('@/assets/sounds/fate/soft-chime.wav'),
};

const MUTE_KEY = 'fate_muted';

export interface UseSoundsReturn {
  play: (name: SoundName) => Promise<void>;
  stop: (name: SoundName) => Promise<void>;
  isLoaded: boolean;
  muted: boolean;
  setMuted: (muted: boolean) => void;
}

export function useSounds(): UseSoundsReturn {
  const soundsRef = useRef<Map<SoundName, Audio.Sound>>(new Map());
  const [isLoaded, setIsLoaded] = useState(false);
  const [muted, setMutedState] = useState(false);
  const mutedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      // Set audio mode for iOS silent switch
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
      });

      // Load mute preference
      const storedMute = await AsyncStorage.getItem(MUTE_KEY);
      if (storedMute === 'true') {
        setMutedState(true);
        mutedRef.current = true;
      }

      // Preload all sounds
      const entries = Object.entries(SOUND_FILES) as [SoundName, AVPlaybackSource][];
      for (const [name, source] of entries) {
        if (cancelled) return;
        try {
          const { sound } = await Audio.Sound.createAsync(source);
          soundsRef.current.set(name, sound);
        } catch {
          // Sound loading failed — continue without it
        }
      }
      if (!cancelled) setIsLoaded(true);
    }

    init();

    return () => {
      cancelled = true;
      for (const sound of soundsRef.current.values()) {
        sound.unloadAsync();
      }
      soundsRef.current.clear();
    };
  }, []);

  const play = useCallback(async (name: SoundName) => {
    if (mutedRef.current) return;
    const sound = soundsRef.current.get(name);
    if (!sound) return;
    try {
      await sound.setPositionAsync(0);
      await sound.playAsync();
    } catch {
      // Playback failed — ignore
    }
  }, []);

  const stop = useCallback(async (name: SoundName) => {
    const sound = soundsRef.current.get(name);
    if (!sound) return;
    try {
      await sound.stopAsync();
    } catch {
      // Already stopped or unloaded
    }
  }, []);

  const setMuted = useCallback((value: boolean) => {
    setMutedState(value);
    mutedRef.current = value;
    AsyncStorage.setItem(MUTE_KEY, String(value));
  }, []);

  return { play, stop, isLoaded, muted, setMuted };
}
