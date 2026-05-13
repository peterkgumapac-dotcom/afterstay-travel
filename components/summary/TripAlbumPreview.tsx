import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  ChevronRight,
  Images,
  MapPin,
  Pause,
  Play,
  Route,
  Share2,
  Sparkles,
  Users,
} from 'lucide-react-native';

import type { ThemeColors } from '@/constants/ThemeContext';
import type { Expense, GroupMember, Moment, Place, Trip } from '@/lib/types';
import type { MomentFavoriteMap } from '@/lib/supabase';
import { formatCurrency } from '@/lib/utils';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const PLAYER_H = Math.max(660, Math.min(820, Math.round(SCREEN_H * 0.9)));
const MAX_PHOTO_PAGES = 15;
const MAX_SCENES = 6;
const SWIPE_THRESHOLD = SCREEN_W * 0.22;
const SCENE_DURATIONS_MS = {
  cover: 6000,
  photo: 7000,
  highlights: 8000,
  aha: 6500,
} as const;

type PlaybackState = 'idle' | 'preparing' | 'playing' | 'paused' | 'complete';

type MemoryScene =
  | { type: 'cover' }
  | { type: 'arrival'; beat?: StoryBeat; photo?: AlbumPhoto }
  | { type: 'highlights'; title: string; photos: AlbumPhoto[]; caption: string }
  | { type: 'peakDay'; beat?: StoryBeat; photo?: AlbumPhoto }
  | { type: 'favoriteFrame'; photo: AlbumPhoto }
  | { type: 'peoplePlaces'; photo?: AlbumPhoto }
  | { type: 'aha'; photo?: AlbumPhoto }
  | { type: 'closing'; photo?: AlbumPhoto };

export interface AlbumPhoto {
  id: string;
  uri: string;
  hdUri?: string;
  caption?: string;
  location?: string;
  date?: string;
  moment?: Moment;
}

interface StoryBeat {
  id: string;
  label: string;
  title: string;
  detail: string;
  photo?: AlbumPhoto;
}

interface AlbumPlace {
  id: string;
  name: string;
  category?: string;
  photoUrl?: string;
}

interface AlbumTraveler {
  id: string;
  name: string;
  photo?: string;
}

interface AhaCard {
  id: string;
  label: string;
  value: string;
  detail: string;
}

interface TripAlbumData {
  title: string;
  subtitle: string;
  destination: string;
  nights: number;
  momentCount: number;
  placesCount: number;
  memberCount: number;
  spentLabel: string;
  topTag?: string;
  topLocation?: string;
  heroPhoto?: AlbumPhoto;
  favoritePhoto?: AlbumPhoto;
  photos: AlbumPhoto[];
  storyBeats: StoryBeat[];
  topPlaces: AlbumPlace[];
  travelers: AlbumTraveler[];
  ahaCards: AhaCard[];
}

interface BuildTripAlbumDataInput {
  trip: Trip;
  moments: Moment[];
  favorites: MomentFavoriteMap;
  places: Place[];
  expenses: Expense[];
  members: GroupMember[];
  dateLabel: string;
  currency: string;
}

interface Props {
  data: TripAlbumData;
  colors: ThemeColors;
  onBack?: () => void;
  onOpenAlbum: () => void;
  onAddPhoto: () => void;
  onOpenPhoto?: (photo: AlbumPhoto) => void;
}

function bestAlbumPhotos(moments: Moment[], favorites: MomentFavoriteMap): AlbumPhoto[] {
  const withPhotos = moments.reduce<AlbumPhoto[]>((acc, moment) => {
    const uri = moment.photo?.trim() || moment.hdPhoto?.trim();
    if (!uri) return acc;
    acc.push({
      id: moment.id,
      uri,
      hdUri: moment.hdPhoto,
      caption: moment.caption && moment.caption !== 'Untitled' ? moment.caption : undefined,
      location: moment.location,
      date: moment.date,
      moment,
    });
    return acc;
  }, []);

  const scored = withPhotos.map((photo, index) => {
    const favoriteCount = favorites[photo.id]?.count ?? 0;
    const detailScore = (photo.caption ? 2 : 0) + (photo.location ? 1 : 0);
    return { photo, score: favoriteCount * 10 + detailScore, index };
  });

  const top = scored
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, Math.min(MAX_PHOTO_PAGES, scored.length));

  const selected = new Map<string, AlbumPhoto>();
  for (const item of top) selected.set(item.photo.id, item.photo);

  if (selected.size < Math.min(MAX_PHOTO_PAGES, withPhotos.length)) {
    const step = Math.max(1, Math.floor(withPhotos.length / MAX_PHOTO_PAGES));
    for (let index = 0; index < withPhotos.length && selected.size < MAX_PHOTO_PAGES; index += step) {
      selected.set(withPhotos[index].id, withPhotos[index]);
    }
  }

  return Array.from(selected.values()).slice(0, MAX_PHOTO_PAGES);
}

function formatAlbumDate(value?: string, options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }) {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toLocaleDateString(undefined, options);
}

function mostCommon(values: (string | undefined)[]) {
  const counts = new Map<string, number>();
  for (const rawValue of values) {
    const value = rawValue?.trim();
    if (!value) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return Array.from(counts.entries()).sort(([, a], [, b]) => b - a)[0]?.[0];
}

function buildStoryBeats(moments: Moment[], albumPhotos: AlbumPhoto[], favoritePhoto?: AlbumPhoto): StoryBeat[] {
  if (moments.length === 0) return [];
  const photoByMoment = new Map(albumPhotos.map((photo) => [photo.id, photo]));
  const groups = new Map<
    string,
    {
      sortValue: number;
      title: string;
      moments: Moment[];
      photos: AlbumPhoto[];
    }
  >();

  for (const moment of moments) {
    const date = new Date(moment.date);
    const dayLabel = moment.dayNumber ? `Day ${moment.dayNumber}` : formatAlbumDate(moment.date) ?? 'A trip day';
    const key = moment.dayNumber ? `day-${moment.dayNumber}` : formatAlbumDate(moment.date, { year: 'numeric', month: '2-digit', day: '2-digit' }) ?? moment.id;
    const sortValue = moment.dayNumber ?? (Number.isNaN(date.getTime()) ? Number.MAX_SAFE_INTEGER : date.getTime());
    const existing = groups.get(key) ?? { sortValue, title: dayLabel, moments: [], photos: [] };
    existing.moments.push(moment);
    const photo = photoByMoment.get(moment.id);
    if (photo) existing.photos.push(photo);
    groups.set(key, existing);
  }

  const sortedGroups = Array.from(groups.values()).sort((a, b) => a.sortValue - b.sortValue);
  const firstGroup = sortedGroups[0];
  const lastGroup = sortedGroups[sortedGroups.length - 1];
  const peakGroup = sortedGroups.reduce((best, group) => (group.moments.length > best.moments.length ? group : best), firstGroup);
  const beats: (StoryBeat | undefined)[] = [
    firstGroup
      ? {
          id: 'arrival',
          label: 'Arrival',
          title: mostCommon(firstGroup.moments.map((moment) => moment.location)) ?? firstGroup.title,
          detail: `${firstGroup.moments.length} moment${firstGroup.moments.length !== 1 ? 's' : ''} started the trip${formatAlbumDate(firstGroup.moments[0]?.date) ? ` on ${formatAlbumDate(firstGroup.moments[0]?.date)}` : ''}.`,
          photo: firstGroup.photos[0],
        }
      : undefined,
    peakGroup && peakGroup !== firstGroup
      ? {
          id: 'peak',
          label: 'Peak day',
          title: mostCommon(peakGroup.moments.map((moment) => moment.location)) ?? peakGroup.title,
          detail: `${peakGroup.moments.length} captured moment${peakGroup.moments.length !== 1 ? 's' : ''} made this the fullest day.`,
          photo: peakGroup.photos[0],
        }
      : undefined,
    favoritePhoto
      ? {
          id: 'favorite',
          label: 'Favorite frame',
          title: favoritePhoto.location ?? favoritePhoto.caption ?? 'A photo worth keeping',
          detail: favoritePhoto.caption ?? 'One frame that carries the feeling of the trip.',
          photo: favoritePhoto,
        }
      : undefined,
    lastGroup && lastGroup !== firstGroup
      ? {
          id: 'final',
          label: 'Final memory',
          title: mostCommon(lastGroup.moments.map((moment) => moment.location)) ?? lastGroup.title,
          detail: `${lastGroup.moments.length} moment${lastGroup.moments.length !== 1 ? 's' : ''} closed the album.`,
          photo: lastGroup.photos[0],
        }
      : undefined,
  ];

  const unique = new Map<string, StoryBeat>();
  for (const beat of beats) {
    if (!beat) continue;
    unique.set(beat.id, beat);
  }
  return Array.from(unique.values()).slice(0, 4);
}

function buildAhaCards(data: {
  moments: Moment[];
  places: Place[];
  nights: number;
  spentLabel: string;
  topLocation?: string;
  topTag?: string;
}): AhaCard[] {
  return [
    {
      id: 'mood',
      label: 'Trip mood',
      value: data.topTag ?? 'Travel story',
      detail: data.topTag ? 'Your photos kept returning to this feeling.' : 'A mix of places, people, and small details.',
    },
    {
      id: 'place',
      label: 'Most remembered',
      value: data.topLocation ?? data.places[0]?.name ?? 'The trip',
      detail: data.topLocation ? 'This place showed up again and again.' : 'Your saved places shaped the story.',
    },
    {
      id: 'rhythm',
      label: data.spentLabel === 'No spend yet' ? 'Captured' : 'Trip rhythm',
      value: data.spentLabel === 'No spend yet' ? String(data.moments.length) : data.spentLabel,
      detail: data.spentLabel === 'No spend yet'
        ? `${data.nights || 1} night${data.nights !== 1 ? 's' : ''} turned into a camera roll.`
        : `Logged across ${data.nights || 1} night${data.nights !== 1 ? 's' : ''}.`,
    },
  ];
}

export function buildTripAlbumData({
  trip,
  moments,
  favorites,
  places,
  expenses,
  members,
  dateLabel,
  currency,
}: BuildTripAlbumDataInput): TripAlbumData {
  const photos = bestAlbumPhotos(moments, favorites);
  const byTag = new Map<string, number>();
  const byLocation = new Map<string, number>();
  let spent = 0;

  for (const moment of moments) {
    for (const tag of moment.tags ?? []) byTag.set(tag, (byTag.get(tag) ?? 0) + 1);
    if (moment.location) byLocation.set(moment.location, (byLocation.get(moment.location) ?? 0) + 1);
  }
  for (const expense of expenses) spent += expense.amount;

  const topTag = Array.from(byTag.entries()).sort(([, a], [, b]) => b - a)[0]?.[0];
  const topLocation = Array.from(byLocation.entries()).sort(([, a], [, b]) => b - a)[0]?.[0];
  const favoritePhoto = photos.find((photo) => (favorites[photo.id]?.count ?? 0) > 0) ?? photos[1] ?? photos[0];
  const topPlaces = places.slice(0, 4).map((place) => ({
    id: place.id,
    name: place.name,
    category: place.category,
    photoUrl: place.photoUrl,
  }));
  const travelers = members.slice(0, 5).map((member) => ({
    id: member.id,
    name: member.name,
    photo: member.profilePhoto,
  }));
  const spentLabel = spent > 0 ? formatCurrency(spent, currency) : 'No spend yet';
  const storyBeats = buildStoryBeats(moments, photos, favoritePhoto);

  return {
    title: trip.name || trip.destination || 'AfterStay Memory',
    subtitle: `${dateLabel} · ${trip.nights} night${trip.nights !== 1 ? 's' : ''}`,
    destination: trip.destination,
    nights: trip.nights,
    momentCount: moments.length,
    placesCount: places.length,
    memberCount: members.length,
    spentLabel,
    topTag,
    topLocation,
    heroPhoto: photos[0],
    favoritePhoto,
    photos,
    storyBeats,
    topPlaces,
    travelers,
    ahaCards: buildAhaCards({
      moments,
      places,
      nights: trip.nights,
      spentLabel,
      topLocation,
      topTag,
    }),
  };
}

export const mockTripAlbumData: TripAlbumData = {
  title: 'Tokyo Spring Escape',
  subtitle: 'Apr 12 - Apr 19, 2026 · 7 nights',
  destination: 'Tokyo, Japan',
  nights: 7,
  momentCount: 128,
  placesCount: 6,
  memberCount: 4,
  spentLabel: 'PHP 84,260',
  topTag: 'Food',
  topLocation: 'Shibuya Crossing',
  heroPhoto: {
    id: 'mock-hero',
    uri: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?auto=format&fit=crop&w=1200&q=80',
    caption: 'The first night felt electric.',
    location: 'Shibuya',
  },
  favoritePhoto: {
    id: 'mock-2',
    uri: 'https://images.unsplash.com/photo-1524413840807-0c3cb6fa808d?auto=format&fit=crop&w=1000&q=80',
    caption: 'Golden hour at Senso-ji',
    location: 'Asakusa',
  },
  photos: [
    {
      id: 'mock-hero',
      uri: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?auto=format&fit=crop&w=1200&q=80',
      caption: 'The first night felt electric.',
      location: 'Shibuya',
    },
    {
      id: 'mock-2',
      uri: 'https://images.unsplash.com/photo-1524413840807-0c3cb6fa808d?auto=format&fit=crop&w=1000&q=80',
      caption: 'Golden hour at Senso-ji',
      location: 'Asakusa',
    },
    {
      id: 'mock-3',
      uri: 'https://images.unsplash.com/photo-1554797589-7241bb691973?auto=format&fit=crop&w=1000&q=80',
      caption: 'Late train, bright signs, full camera roll.',
      location: 'Tokyo',
    },
    {
      id: 'mock-4',
      uri: 'https://images.unsplash.com/photo-1536098561742-ca998e48cbcc?auto=format&fit=crop&w=1000&q=80',
      caption: 'Tiny alleys, excellent snacks.',
      location: 'Shinjuku',
    },
    {
      id: 'mock-5',
      uri: 'https://images.unsplash.com/photo-1513407030348-c983a97b98d8?auto=format&fit=crop&w=1000&q=80',
      caption: 'A quiet pause between stations.',
      location: 'Ginza',
    },
  ],
  storyBeats: [
    {
      id: 'arrival',
      label: 'Arrival',
      title: 'Shibuya Crossing',
      detail: '18 moments started the trip on Apr 12.',
      photo: {
        id: 'mock-hero',
        uri: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?auto=format&fit=crop&w=1200&q=80',
        location: 'Shibuya',
      },
    },
    {
      id: 'peak',
      label: 'Peak day',
      title: 'Asakusa',
      detail: '22 captured moments made this the fullest day.',
      photo: {
        id: 'mock-2',
        uri: 'https://images.unsplash.com/photo-1524413840807-0c3cb6fa808d?auto=format&fit=crop&w=1000&q=80',
        location: 'Asakusa',
      },
    },
  ],
  topPlaces: [
    { id: 'place-1', name: 'Shibuya Crossing', category: 'Culture' },
    { id: 'place-2', name: 'Senso-ji', category: 'Culture' },
    { id: 'place-3', name: 'Golden Gai', category: 'Nightlife' },
  ],
  travelers: [
    { id: 'traveler-1', name: 'Peter' },
    { id: 'traveler-2', name: 'Mika' },
    { id: 'traveler-3', name: 'Jon' },
  ],
  ahaCards: [
    { id: 'mood', label: 'Trip mood', value: 'Food', detail: 'Your photos kept returning to this feeling.' },
    { id: 'place', label: 'Most remembered', value: 'Shibuya Crossing', detail: 'This place showed up again and again.' },
    { id: 'rhythm', label: 'Trip rhythm', value: 'PHP 84,260', detail: 'Logged across 7 nights.' },
  ],
};

function buildScenes(data: TripAlbumData): MemoryScene[] {
  if (data.photos.length === 0) return [{ type: 'cover' }, { type: 'closing' }];

  const chronologicalPhotos = [...data.photos].sort((a, b) => {
    const aTime = a.date ? new Date(a.date).getTime() : Number.MAX_SAFE_INTEGER;
    const bTime = b.date ? new Date(b.date).getTime() : Number.MAX_SAFE_INTEGER;
    return (Number.isNaN(aTime) ? Number.MAX_SAFE_INTEGER : aTime) - (Number.isNaN(bTime) ? Number.MAX_SAFE_INTEGER : bTime);
  });
  const addUniqueScene = (scenes: MemoryScene[], scene: MemoryScene) => {
    const photo = getScenePhoto(scene, data);
    if (photo && scenes.some((existing) => getScenePhoto(existing, data)?.id === photo.id)) return;
    scenes.push(scene);
  };
  const arrivalBeat = data.storyBeats.find((beat) => beat.id === 'arrival' && beat.photo) ?? data.storyBeats.find((beat) => beat.photo);
  const peakBeat = data.storyBeats.find((beat) => beat.id === 'peak' && beat.photo);
  const favoritePhoto = data.favoritePhoto ?? chronologicalPhotos[0];
  const scenes: MemoryScene[] = [{ type: 'cover' }];

  if (data.photos.length < 3) {
    addUniqueScene(scenes, { type: 'favoriteFrame', photo: favoritePhoto });
    scenes.push({ type: 'closing', photo: data.heroPhoto ?? favoritePhoto });
    return scenes;
  }

  addUniqueScene(scenes, { type: 'arrival', beat: arrivalBeat, photo: arrivalBeat?.photo ?? chronologicalPhotos[0] });
  if (peakBeat) addUniqueScene(scenes, { type: 'peakDay', beat: peakBeat, photo: peakBeat.photo });
  addUniqueScene(scenes, { type: 'favoriteFrame', photo: favoritePhoto });
  scenes.push({ type: 'aha', photo: chronologicalPhotos.find((photo) => photo.id !== favoritePhoto.id) ?? data.heroPhoto });
  scenes.push({ type: 'closing', photo: data.heroPhoto ?? favoritePhoto });

  return scenes.slice(0, MAX_SCENES);
}

function getScenePhoto(scene: MemoryScene, data: TripAlbumData) {
  if (scene.type === 'cover') return data.heroPhoto;
  if (scene.type === 'arrival') return scene.photo ?? data.heroPhoto;
  if (scene.type === 'highlights') return scene.photos[0] ?? data.heroPhoto;
  if (scene.type === 'peakDay') return scene.photo ?? data.heroPhoto;
  if (scene.type === 'favoriteFrame') return scene.photo;
  if (scene.type === 'peoplePlaces' || scene.type === 'aha' || scene.type === 'closing') return scene.photo ?? data.heroPhoto;
  return data.heroPhoto;
}

function getSceneDurationMs(scene: MemoryScene) {
  if (scene.type === 'cover') return SCENE_DURATIONS_MS.cover;
  if (scene.type === 'highlights') return SCENE_DURATIONS_MS.highlights;
  if (scene.type === 'aha') return SCENE_DURATIONS_MS.aha;
  if (scene.type === 'closing') return 0;
  return SCENE_DURATIONS_MS.photo;
}

function waitForNextFrame() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

function sceneTitleFromPhoto(photo?: AlbumPhoto, fallback = 'A memory from the trip') {
  return photo?.location ?? photo?.caption ?? fallback;
}

function sceneDetailFromPhoto(photo?: AlbumPhoto, fallback = 'A quiet part of the trip worth keeping.') {
  const date = formatAlbumDate(photo?.date);
  if (photo?.caption) return photo.caption;
  if (date) return `A moment from ${date}.`;
  return fallback;
}

export default function TripAlbumPreview({ data, colors, onBack, onOpenAlbum, onAddPhoto, onOpenPhoto }: Props) {
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const dragX = useSharedValue(0);
  const sceneProgress = useSharedValue(0);
  const transitionProgress = useSharedValue(0);
  const sceneEntryProgress = useSharedValue(1);
  const [sceneIndex, setSceneIndex] = useState(0);
  const [playbackSceneIndex, setPlaybackSceneIndex] = useState(0);
  const [playbackState, setPlaybackState] = useState<PlaybackState>('idle');
  const playbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playbackRunIdRef = useRef(0);
  const remainingSceneMsRef = useRef(0);
  const sceneStartedAtRef = useRef(0);
  const sceneCanAdvanceAtRef = useRef(0);
  const pauseReasonRef = useRef<'hold' | null>(null);
  const scenes = useMemo(() => buildScenes(data), [data]);
  const isPlaying = playbackState === 'playing';
  const isPaused = playbackState === 'paused';
  const isPreparing = playbackState === 'preparing';
  const isPlaybackComplete = playbackState === 'complete';
  const isPlaybackActive = isPreparing || isPlaying || isPaused;
  const visibleSceneIndex = isPlaybackActive || isPlaybackComplete ? playbackSceneIndex : sceneIndex;
  const canGoPrevious = visibleSceneIndex > 0;
  const canGoNext = visibleSceneIndex < scenes.length - 1;
  const currentScene = scenes[visibleSceneIndex];
  const previousScene = canGoPrevious ? scenes[visibleSceneIndex - 1] : undefined;
  const nextScene = canGoNext ? scenes[visibleSceneIndex + 1] : undefined;
  const currentPhoto = getScenePhoto(currentScene, data);

  useEffect(() => {
    const urls = data.photos.slice(Math.max(0, visibleSceneIndex - 1), visibleSceneIndex + 2).map((photo) => photo.uri);
    urls.forEach((url) => void Image.prefetch(url).catch(() => {}));
  }, [data.photos, visibleSceneIndex]);

  const clearPlaybackTimer = useCallback(() => {
    if (playbackTimerRef.current) {
      clearTimeout(playbackTimerRef.current);
      playbackTimerRef.current = null;
    }
  }, []);

  const stopPlayback = useCallback((nextState: PlaybackState = 'idle') => {
    playbackRunIdRef.current += 1;
    clearPlaybackTimer();
    cancelAnimation(sceneProgress);
    sceneProgress.value = 0;
    remainingSceneMsRef.current = 0;
    sceneCanAdvanceAtRef.current = 0;
    pauseReasonRef.current = null;
    setPlaybackState(nextState);
  }, [clearPlaybackTimer, sceneProgress]);

  const commitDirection = useCallback((direction: 1 | -1) => {
    setSceneIndex((current) => {
      const target = Math.max(0, Math.min(current + direction, scenes.length - 1));
      if (target !== current) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      return target;
    });
  }, [scenes.length]);

  const advancePlayback = useCallback((runId: number) => {
    if (runId !== playbackRunIdRef.current) return;
    const msUntilAdvance = sceneCanAdvanceAtRef.current - Date.now();
    if (msUntilAdvance > 120) {
      clearPlaybackTimer();
      playbackTimerRef.current = setTimeout(() => advancePlayback(runId), msUntilAdvance);
      return;
    }
    setPlaybackSceneIndex((current) => {
      const next = current + 1;
      if (next >= scenes.length) {
        setPlaybackState('complete');
        sceneProgress.value = 0;
        return current;
      }
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      if (scenes[next]?.type === 'closing') {
        setSceneIndex(next);
        setPlaybackState('complete');
      }
      return next;
    });
  }, [clearPlaybackTimer, sceneProgress, scenes]);

  useEffect(() => {
    sceneEntryProgress.value = 0;
    sceneEntryProgress.value = withTiming(1, { duration: 650, easing: Easing.out(Easing.cubic) });
    sceneProgress.value = 0;
    remainingSceneMsRef.current = 0;
  }, [sceneEntryProgress, sceneProgress, visibleSceneIndex]);

  useEffect(() => {
    clearPlaybackTimer();
    cancelAnimation(sceneProgress);
    if (playbackState !== 'playing') {
      if (playbackState === 'idle' || playbackState === 'complete') sceneProgress.value = 0;
      return;
    }
    if (currentScene.type === 'closing') {
      setPlaybackState('complete');
      sceneProgress.value = 0;
      return;
    }
    const isResumingScene = remainingSceneMsRef.current > 0;
    const remainingDuration = isResumingScene
      ? Math.max(800, remainingSceneMsRef.current)
      : Math.max(5500, getSceneDurationMs(currentScene));
    const runId = playbackRunIdRef.current;
    const startedAt = Date.now();
    const dueAt = startedAt + remainingDuration;
    sceneStartedAtRef.current = startedAt;
    sceneCanAdvanceAtRef.current = dueAt;
    remainingSceneMsRef.current = remainingDuration;
    sceneProgress.value = withTiming(1, { duration: remainingDuration, easing: Easing.linear }, (finished) => {
      if (!finished) return;
    });
    const scheduleAdvance = (delayMs: number) => {
      playbackTimerRef.current = setTimeout(() => {
        if (runId !== playbackRunIdRef.current) return;
        const remainingMs = dueAt - Date.now();
        if (remainingMs > 120) {
          scheduleAdvance(remainingMs);
          return;
        }
        remainingSceneMsRef.current = 0;
        advancePlayback(runId);
      }, Math.max(120, delayMs));
    };
    scheduleAdvance(remainingDuration);
  }, [advancePlayback, clearPlaybackTimer, currentScene, playbackState, sceneProgress]);

  useEffect(() => () => {
    clearPlaybackTimer();
    cancelAnimation(sceneProgress);
  }, [clearPlaybackTimer, sceneProgress]);

  const pausePlaybackForHold = useCallback(() => {
    if (playbackState !== 'playing') return;
    clearPlaybackTimer();
    cancelAnimation(sceneProgress);
    const elapsed = Date.now() - sceneStartedAtRef.current;
    const remaining = remainingSceneMsRef.current || getSceneDurationMs(currentScene);
    remainingSceneMsRef.current = Math.max(800, remaining - elapsed);
    pauseReasonRef.current = 'hold';
    setPlaybackState('paused');
  }, [clearPlaybackTimer, currentScene, playbackState, sceneProgress]);

  const resumePlaybackFromHold = useCallback(() => {
    if (playbackState !== 'paused' || pauseReasonRef.current !== 'hold') return;
    pauseReasonRef.current = null;
    setPlaybackState('playing');
  }, [playbackState]);

  const animateSceneTurn = useCallback((direction: 1 | -1) => {
    if ((direction === 1 && !canGoNext) || (direction === -1 && !canGoPrevious)) return;
    stopPlayback('idle');
    transitionProgress.value = withTiming(1, { duration: 210, easing: Easing.out(Easing.cubic) });
    dragX.value = withTiming(direction === 1 ? -SCREEN_W : SCREEN_W, { duration: 230, easing: Easing.out(Easing.cubic) }, (finished) => {
      if (finished) runOnJS(commitDirection)(direction);
      dragX.value = 0;
      transitionProgress.value = 0;
    });
  }, [canGoNext, canGoPrevious, commitDirection, dragX, stopPlayback, transitionProgress]);

  const openNextScene = useCallback(() => animateSceneTurn(1), [animateSceneTurn]);
  const openPreviousScene = useCallback(() => animateSceneTurn(-1), [animateSceneTurn]);

  const startMemory = useCallback(async () => {
    if (data.photos.length === 0 || scenes.length <= 1) return;
    stopPlayback('preparing');
    setSceneIndex(0);
    setPlaybackSceneIndex(0);
    sceneEntryProgress.value = 1;
    dragX.value = 0;
    transitionProgress.value = 0;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const urls = scenes
      .map((scene) => getScenePhoto(scene, data)?.uri)
      .filter((url): url is string => Boolean(url));
    await Promise.all(urls.map((url) => Image.prefetch(url).catch(() => false)));
    await waitForNextFrame();
    playbackRunIdRef.current += 1;
    remainingSceneMsRef.current = 0;
    setPlaybackState('playing');
  }, [data, dragX, sceneEntryProgress, scenes, stopPlayback, transitionProgress]);

  const handleShare = async () => {
    await Share.share({
      message: `${data.title} - ${data.momentCount} moments, ${data.placesCount} places, ${data.spentLabel}`,
    });
  };

  const pageGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(!isPlaybackActive)
        .activeOffsetX([-10, 10])
        .failOffsetY([-18, 18])
        .onUpdate((event) => {
          const blocked = (event.translationX < 0 && !canGoNext) || (event.translationX > 0 && !canGoPrevious);
          const rawX = blocked ? event.translationX * 0.18 : event.translationX;
          dragX.value = Math.max(-SCREEN_W, Math.min(SCREEN_W, rawX));
          transitionProgress.value = Math.min(1, Math.abs(dragX.value) / SCREEN_W);
        })
        .onEnd((event) => {
          const shouldGoNext = canGoNext && (dragX.value < -SWIPE_THRESHOLD || event.velocityX < -700);
          const shouldGoPrevious = canGoPrevious && (dragX.value > SWIPE_THRESHOLD || event.velocityX > 700);

          if (shouldGoNext || shouldGoPrevious) {
            const direction: 1 | -1 = shouldGoNext ? 1 : -1;
            runOnJS(stopPlayback)('idle');
            dragX.value = withTiming(direction === 1 ? -SCREEN_W : SCREEN_W, { duration: 190, easing: Easing.out(Easing.cubic) }, (finished) => {
              if (finished) runOnJS(commitDirection)(direction);
              dragX.value = 0;
              transitionProgress.value = 0;
            });
            return;
          }

          dragX.value = withSpring(0, { damping: 20, stiffness: 220, mass: 0.8 });
          transitionProgress.value = withTiming(0, { duration: 170, easing: Easing.out(Easing.cubic) });
        }),
    [canGoNext, canGoPrevious, commitDirection, dragX, isPlaybackActive, stopPlayback, transitionProgress],
  );

  const holdGesture = useMemo(
    () =>
      Gesture.LongPress()
        .minDuration(180)
        .onStart(() => {
          runOnJS(pausePlaybackForHold)();
        })
        .onFinalize(() => {
          runOnJS(resumePlaybackFromHold)();
        }),
    [pausePlaybackForHold, resumePlaybackFromHold],
  );

  const combinedGesture = useMemo(() => Gesture.Simultaneous(pageGesture, holdGesture), [holdGesture, pageGesture]);

  const activeSceneStyle = useAnimatedStyle(() => {
    const playbackZoom = isPlaying ? interpolate(sceneProgress.value, [0, 1], [1, 1.025], Extrapolation.CLAMP) : 1;
    return {
      opacity: interpolate(transitionProgress.value, [0, 1], [1, 0.24], Extrapolation.CLAMP) * sceneEntryProgress.value,
      transform: [
        { translateX: dragX.value },
        { scale: interpolate(transitionProgress.value, [0, 1], [1, 0.985], Extrapolation.CLAMP) },
        { scale: playbackZoom },
      ],
    };
  });

  const nextSceneStyle = useAnimatedStyle(() => {
    const reveal = Math.max(0, Math.min(1, -dragX.value / SCREEN_W));
    return {
      opacity: canGoNext ? interpolate(reveal, [0, 1], [0, 1], Extrapolation.CLAMP) : 0,
      transform: [
        { translateX: interpolate(reveal, [0, 1], [SCREEN_W * 0.18, 0], Extrapolation.CLAMP) },
        { scale: interpolate(reveal, [0, 1], [1.035, 1], Extrapolation.CLAMP) },
      ],
    };
  }, [canGoNext]);

  const previousSceneStyle = useAnimatedStyle(() => {
    const reveal = Math.max(0, Math.min(1, dragX.value / SCREEN_W));
    return {
      opacity: canGoPrevious ? interpolate(reveal, [0, 1], [0, 1], Extrapolation.CLAMP) : 0,
      transform: [
        { translateX: interpolate(reveal, [0, 1], [-SCREEN_W * 0.18, 0], Extrapolation.CLAMP) },
        { scale: interpolate(reveal, [0, 1], [1.035, 1], Extrapolation.CLAMP) },
      ],
    };
  }, [canGoPrevious]);

  const renderSceneContent = (scene: MemoryScene) => (
    <>
      {scene.type === 'cover' ? (
        <MemoryCoverScene data={data} styles={styles} colors={colors} playbackState={playbackState} onPlayMemory={startMemory} onAddPhoto={onAddPhoto} />
      ) : null}
      {scene.type === 'arrival' ? (
        <MemoryPhotoScene
          eyebrow={scene.beat?.label ?? 'First memory'}
          title={sceneTitleFromPhoto(scene.photo, 'The trip begins')}
          detail={sceneDetailFromPhoto(scene.photo, 'The first frame that brings the trip back.')}
          photo={scene.photo}
          styles={styles}
          onOpenPhoto={onOpenPhoto}
        />
      ) : null}
      {scene.type === 'highlights' ? (
        <MemoryHighlightsScene scene={scene} styles={styles} onOpenPhoto={onOpenPhoto} />
      ) : null}
      {scene.type === 'peakDay' ? (
        <MemoryPhotoScene
          eyebrow={scene.beat?.label ?? 'Peak day'}
          title={sceneTitleFromPhoto(scene.photo, 'The fullest day')}
          detail={sceneDetailFromPhoto(scene.photo, 'The day the camera roll filled up.')}
          photo={scene.photo}
          styles={styles}
          onOpenPhoto={onOpenPhoto}
        />
      ) : null}
      {scene.type === 'favoriteFrame' ? (
        <MemoryPhotoScene
          eyebrow="Favorite frame"
          title={sceneTitleFromPhoto(scene.photo, 'A photo worth keeping')}
          detail={sceneDetailFromPhoto(scene.photo, 'One frame that carries the feeling of the trip.')}
          photo={scene.photo}
          styles={styles}
          onOpenPhoto={onOpenPhoto}
          featured
        />
      ) : null}
      {scene.type === 'peoplePlaces' ? <MemoryPeoplePlacesScene data={data} styles={styles} /> : null}
      {scene.type === 'aha' ? <MemoryAhaScene data={data} styles={styles} /> : null}
      {scene.type === 'closing' ? (
        <MemoryClosingScene
          data={data}
          styles={styles}
          playbackState={playbackState}
          onViewPhotos={data.photos.length > 0 ? onOpenAlbum : onAddPhoto}
          onPlayMemory={startMemory}
          onShare={handleShare}
        />
      ) : null}
    </>
  );

  return (
    <View style={styles.container}>
      <GestureDetector gesture={combinedGesture}>
        <View style={styles.memoryViewport}>
          {previousScene ? (
            <Animated.View pointerEvents="none" style={[styles.sceneLayer, previousSceneStyle]}>
              <SceneBackground photo={getScenePhoto(previousScene, data)} fallbackColor={colors.accent} />
              {renderSceneContent(previousScene)}
            </Animated.View>
          ) : null}
          {nextScene ? (
            <Animated.View pointerEvents="none" style={[styles.sceneLayer, nextSceneStyle]}>
              <SceneBackground photo={getScenePhoto(nextScene, data)} fallbackColor={colors.accent} />
              {renderSceneContent(nextScene)}
            </Animated.View>
          ) : null}
          <Animated.View style={[styles.sceneLayer, styles.activeSceneLayer, activeSceneStyle]}>
            <SceneBackground photo={currentPhoto} fallbackColor={colors.accent} />
            {renderSceneContent(currentScene)}
          </Animated.View>

          <View style={[styles.progressRow, { top: insets.top + 10 }]}>
            {scenes.map((_, index) => (
              <MemoryProgressSegment
                key={index}
                state={index < visibleSceneIndex ? 'past' : index === visibleSceneIndex ? 'active' : 'future'}
                progress={sceneProgress}
                playbackState={playbackState}
                styles={styles}
              />
            ))}
          </View>

          {onBack ? (
            <Pressable
              onPress={onBack}
              style={[styles.backBtn, { top: insets.top + 26 }]}
              accessibilityLabel="Go back"
              accessibilityRole="button"
              hitSlop={10}
            >
              <ArrowLeft size={20} color="#fff" />
            </Pressable>
          ) : null}

          <View style={[styles.topMeta, { top: insets.top + 28 }]}>
            <Text style={styles.topMetaText}>{visibleSceneIndex + 1}/{scenes.length}</Text>
            {playbackState !== 'idle' && playbackState !== 'complete' ? (
              <View style={styles.playingPill}>
                {isPlaying ? <Play size={10} color="#fff" fill="#fff" /> : <Pause size={11} color="#fff" fill="#fff" />}
                <Text style={styles.playingText}>{isPreparing ? 'Preparing' : isPaused ? 'Paused' : 'Playing'}</Text>
              </View>
            ) : null}
          </View>

          <Pressable
            onPress={openPreviousScene}
            disabled={!canGoPrevious || isPlaybackActive}
            style={styles.tapZoneLeft}
            pointerEvents={isPlaybackActive ? 'none' : 'auto'}
            accessibilityLabel="Previous memory"
            accessibilityRole="button"
          />
          <Pressable
            onPress={openNextScene}
            disabled={!canGoNext || isPlaybackActive}
            style={styles.tapZoneRight}
            pointerEvents={isPlaybackActive ? 'none' : 'auto'}
            accessibilityLabel="Next memory"
            accessibilityRole="button"
          />
          {canGoNext && !isPlaybackActive ? (
            <Pressable
              onPress={openNextScene}
              style={styles.nextControl}
              accessibilityLabel="Next memory"
              accessibilityRole="button"
              hitSlop={12}
            >
              <ChevronRight size={21} color="#15110d" strokeWidth={2.6} />
            </Pressable>
          ) : null}
        </View>
      </GestureDetector>
    </View>
  );
}

function SceneBackground({ photo, fallbackColor }: { photo?: AlbumPhoto; fallbackColor: string }) {
  return (
    <View style={StyleSheet.absoluteFill}>
      {photo ? (
        <Image source={{ uri: photo.uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={180} />
      ) : (
        <LinearGradient colors={[fallbackColor + '55', '#100c0a', '#050403']} style={StyleSheet.absoluteFill} />
      )}
      <LinearGradient
        colors={['rgba(0,0,0,0.2)', 'rgba(0,0,0,0.1)', 'rgba(0,0,0,0.84)']}
        locations={[0, 0.42, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={stylesStatic.vignette} />
    </View>
  );
}

function MemoryProgressSegment({
  state,
  progress,
  playbackState,
  styles,
}: {
  state: 'past' | 'active' | 'future';
  progress: SharedValue<number>;
  playbackState: PlaybackState;
  styles: ReturnType<typeof getStyles>;
}) {
  const fillStyle = useAnimatedStyle(() => {
    if (state === 'past') return { width: '100%' };
    if (state === 'future') return { width: '0%' };
    if (playbackState === 'preparing') return { width: '0%' };
    if (playbackState === 'complete') return { width: '100%' };
    if (playbackState === 'playing' || playbackState === 'paused') {
      return { width: `${Math.max(3, Math.min(100, progress.value * 100))}%` };
    }
    return { width: `${Math.max(3, Math.min(100, progress.value * 100))}%` };
  }, [playbackState, state]);

  return (
    <View style={styles.progressTrack}>
      <Animated.View style={[styles.progressFill, fillStyle]} />
    </View>
  );
}

function MemoryCoverScene({
  data,
  styles,
  colors,
  playbackState,
  onPlayMemory,
  onAddPhoto,
}: {
  data: TripAlbumData;
  styles: ReturnType<typeof getStyles>;
  colors: ThemeColors;
  playbackState: PlaybackState;
  onPlayMemory: () => void;
  onAddPhoto: () => void;
}) {
  const isPreparing = playbackState === 'preparing';
  const isPlaybackActive = playbackState === 'preparing' || playbackState === 'playing' || playbackState === 'paused';
  const playLabel = isPreparing ? 'Preparing memory...' : playbackState === 'paused' ? 'Paused' : playbackState === 'playing' ? 'Playing memory...' : 'Play Memory';

  return (
    <View style={styles.sceneContent}>
      <View style={styles.coverBadge}>
        <Sparkles size={13} color="#f3c996" />
        <Text style={styles.coverBadgeText}>AfterStay Memory</Text>
      </View>
      <View style={styles.coverTitleWrap}>
        <Text style={styles.coverDestination} numberOfLines={1}>{data.destination || 'Trip recap'}</Text>
        <Text style={styles.coverTitle} numberOfLines={3}>{data.title}</Text>
        <Text style={styles.coverSubtitle} numberOfLines={2}>{data.subtitle}</Text>
      </View>
      <View style={styles.memoryMetaRow}>
        <MemoryMeta label="moments" value={String(data.momentCount)} />
        <MemoryMeta label="places" value={String(data.placesCount)} />
        <MemoryMeta label="travelers" value={String(data.memberCount || 1)} />
      </View>
      <Pressable
        style={[styles.primaryAction, { backgroundColor: data.photos.length > 0 ? '#f3c996' : colors.accent }]}
        onPress={data.photos.length > 0 ? onPlayMemory : onAddPhoto}
        disabled={isPlaybackActive}
        accessibilityRole="button"
      >
        {data.photos.length > 0 ? <Play size={17} color="#15110d" fill="#15110d" /> : <Images size={17} color="#15110d" />}
        <Text style={styles.primaryActionText}>{data.photos.length > 0 ? playLabel : 'Add Memories'}</Text>
      </Pressable>
    </View>
  );
}

function MemoryMeta({ value, label }: { value: string; label: string }) {
  return (
    <View style={stylesStatic.metaItem}>
      <Text style={stylesStatic.metaValue}>{value}</Text>
      <Text style={stylesStatic.metaLabel}>{label}</Text>
    </View>
  );
}

function MemoryPhotoScene({
  eyebrow,
  title,
  detail,
  photo,
  styles,
  onOpenPhoto,
  featured,
}: {
  eyebrow: string;
  title: string;
  detail: string;
  photo?: AlbumPhoto;
  styles: ReturnType<typeof getStyles>;
  onOpenPhoto?: (photo: AlbumPhoto) => void;
  featured?: boolean;
}) {
  return (
    <View style={styles.sceneContent}>
      <Pressable
        style={[styles.photoFocusFrame, featured && styles.photoFocusFrameFeatured]}
        onPress={() => (photo ? onOpenPhoto?.(photo) : undefined)}
        disabled={!photo}
      >
        {photo ? (
          <Image source={{ uri: photo.uri }} style={stylesStatic.imageFill} contentFit="cover" transition={160} />
        ) : (
          <View style={styles.emptyPhotoFrame}>
            <Images size={34} color="rgba(255,255,255,0.72)" />
          </View>
        )}
      </Pressable>
      <View style={styles.sceneCopyBlock}>
        <Text style={styles.sceneEyebrow}>{eyebrow}</Text>
        <Text style={styles.sceneTitle} numberOfLines={2}>{title}</Text>
        <Text style={styles.sceneDetail} numberOfLines={3}>{detail}</Text>
        {photo?.location ? (
          <View style={styles.sceneLocationRow}>
            <MapPin size={13} color="#f3c996" />
            <Text style={styles.sceneLocationText} numberOfLines={1}>{photo.location}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function MemoryHighlightsScene({
  scene,
  styles,
  onOpenPhoto,
}: {
  scene: Extract<MemoryScene, { type: 'highlights' }>;
  styles: ReturnType<typeof getStyles>;
  onOpenPhoto?: (photo: AlbumPhoto) => void;
}) {
  const [hero, second, third] = scene.photos;

  return (
    <View style={styles.sceneContent}>
      <View style={styles.highlightsHeader}>
        <Text style={styles.sceneEyebrow}>Highlights</Text>
        <Text style={styles.sceneTitle} numberOfLines={2}>{scene.title}</Text>
      </View>
      <View style={styles.cinematicCollage}>
        {hero ? (
          <Pressable style={styles.collageHero} onPress={() => onOpenPhoto?.(hero)}>
            <Image source={{ uri: hero.uri }} style={stylesStatic.imageFill} contentFit="cover" transition={150} />
          </Pressable>
        ) : null}
        {second ? (
          <Pressable style={styles.collageTop} onPress={() => onOpenPhoto?.(second)}>
            <Image source={{ uri: second.uri }} style={stylesStatic.imageFill} contentFit="cover" transition={150} />
          </Pressable>
        ) : null}
        {third ? (
          <Pressable style={styles.collageBottom} onPress={() => onOpenPhoto?.(third)}>
            <Image source={{ uri: third.uri }} style={stylesStatic.imageFill} contentFit="cover" transition={150} />
          </Pressable>
        ) : null}
      </View>
      <Text style={styles.sceneDetail} numberOfLines={2}>{scene.caption}</Text>
    </View>
  );
}

function MemoryPeoplePlacesScene({ data, styles }: { data: TripAlbumData; styles: ReturnType<typeof getStyles> }) {
  const visibleTravelers = data.travelers.length > 0 ? data.travelers : [{ id: 'solo', name: 'You' }];

  return (
    <View style={styles.sceneContent}>
      <View style={styles.sceneCopyBlockCompact}>
        <Text style={styles.sceneEyebrow}>People + Places</Text>
        <Text style={styles.sceneTitle} numberOfLines={2}>Who made it feel like a trip</Text>
      </View>
      <View style={styles.glassPanel}>
        <View style={styles.panelRow}>
          <Users size={17} color="#f3c996" />
          <Text style={styles.panelTitle} numberOfLines={1}>{visibleTravelers.slice(0, 4).map((traveler) => traveler.name).join(', ')}</Text>
        </View>
        <Text style={styles.panelText}>{data.memberCount || 1} traveler{(data.memberCount || 1) !== 1 ? 's' : ''} in this memory.</Text>
      </View>
      <View style={styles.placesStack}>
        <View style={styles.panelRow}>
          <Route size={17} color="#f3c996" />
          <Text style={styles.panelTitle}>{data.topLocation ?? data.destination}</Text>
        </View>
        {data.topPlaces.slice(0, 3).map((place) => (
          <View key={place.id} style={styles.placeChip}>
            <Text style={styles.placeChipName} numberOfLines={1}>{place.name}</Text>
            <Text style={styles.placeChipMeta} numberOfLines={1}>{place.category ?? 'Saved place'}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function MemoryAhaScene({ data, styles }: { data: TripAlbumData; styles: ReturnType<typeof getStyles> }) {
  return (
    <View style={styles.sceneContent}>
      <View style={styles.sceneCopyBlockCompact}>
        <Text style={styles.sceneEyebrow}>Aha moments</Text>
        <Text style={styles.sceneTitle} numberOfLines={2}>What the trip says back</Text>
      </View>
      <View style={styles.ahaStack}>
        {data.ahaCards.slice(0, 3).map((card) => (
          <View key={card.id} style={styles.ahaCard}>
            <Text style={styles.ahaLabel}>{card.label}</Text>
            <Text style={styles.ahaValue} numberOfLines={1}>{card.value}</Text>
            <Text style={styles.ahaDetail} numberOfLines={2}>{card.detail}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function MemoryClosingScene({
  data,
  styles,
  playbackState,
  onViewPhotos,
  onPlayMemory,
  onShare,
}: {
  data: TripAlbumData;
  styles: ReturnType<typeof getStyles>;
  playbackState: PlaybackState;
  onViewPhotos: () => void;
  onPlayMemory: () => void;
  onShare: () => void;
}) {
  const hasPhotos = data.photos.length > 0;
  const isPreparing = playbackState === 'preparing';

  return (
    <View style={styles.closingContent}>
      <View style={styles.posterMark}>
        <Sparkles size={28} color="#15110d" />
      </View>
      <Text style={styles.closingEyebrow}>Your memory is ready</Text>
      <Text style={styles.closingTitle} numberOfLines={2}>{data.title}</Text>
      <Text style={styles.closingText} numberOfLines={3}>
        {hasPhotos
          ? `${data.momentCount} moments, ${data.placesCount} places, and the parts worth coming back to.`
          : 'Add photos to turn this trip into a cinematic recap.'}
      </Text>
      <View style={styles.closingActions}>
        <Pressable style={styles.primaryAction} onPress={onViewPhotos} accessibilityRole="button">
          <Images size={17} color="#15110d" />
          <Text style={styles.primaryActionText}>{hasPhotos ? 'View Photos' : 'Add Memories'}</Text>
        </Pressable>
        {hasPhotos ? (
          <Pressable style={styles.secondaryAction} onPress={onPlayMemory} disabled={isPreparing} accessibilityRole="button">
            <Play size={17} color="#fff" fill="#fff" />
            <Text style={styles.secondaryActionText}>{isPreparing ? 'Preparing memory...' : 'Replay Memory'}</Text>
          </Pressable>
        ) : null}
        <Pressable style={styles.secondaryAction} onPress={onShare} accessibilityRole="button">
          <Share2 size={17} color="#fff" />
          <Text style={styles.secondaryActionText}>Share</Text>
        </Pressable>
      </View>
    </View>
  );
}

const stylesStatic = StyleSheet.create({
  vignette: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  metaItem: {
    flex: 1,
    minHeight: 58,
    paddingVertical: 10,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 0,
  },
  metaLabel: {
    marginTop: 2,
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.72)',
    letterSpacing: 0,
  },
  imageFill: {
    width: '100%',
    height: '100%',
  },
});

const getStyles = (_colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      width: SCREEN_W,
      marginLeft: -20,
      marginBottom: 4,
      backgroundColor: '#050403',
    },
    memoryViewport: {
      width: SCREEN_W,
      height: PLAYER_H,
      overflow: 'hidden',
      backgroundColor: '#050403',
    },
    sceneLayer: {
      ...StyleSheet.absoluteFillObject,
      overflow: 'hidden',
      backgroundColor: '#050403',
    },
    activeSceneLayer: {
      zIndex: 3,
    },
    sceneContent: {
      flex: 1,
      justifyContent: 'flex-end',
      paddingHorizontal: 24,
      paddingBottom: 88,
      paddingTop: 112,
      zIndex: 2,
    },
    progressRow: {
      position: 'absolute',
      left: 14,
      right: 14,
      zIndex: 20,
      flexDirection: 'row',
      gap: 4,
    },
    progressTrack: {
      flex: 1,
      height: 3,
      borderRadius: 999,
      overflow: 'hidden',
      backgroundColor: 'rgba(255,255,255,0.28)',
    },
    progressFill: {
      height: '100%',
      borderRadius: 999,
      backgroundColor: '#fff',
    },
    backBtn: {
      position: 'absolute',
      left: 16,
      zIndex: 20,
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: 'rgba(0,0,0,0.42)',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.12)',
    },
    topMeta: {
      position: 'absolute',
      right: 16,
      zIndex: 20,
      alignItems: 'flex-end',
      gap: 7,
    },
    topMetaText: {
      overflow: 'hidden',
      paddingHorizontal: 11,
      paddingVertical: 7,
      borderRadius: 999,
      backgroundColor: 'rgba(0,0,0,0.38)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.12)',
      color: '#fff',
      fontSize: 11,
      fontWeight: '800',
    },
    playingPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 9,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: 'rgba(0,0,0,0.34)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.12)',
    },
    playingText: {
      color: '#fff',
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 0,
    },
    tapZoneLeft: {
      position: 'absolute',
      top: 92,
      bottom: 210,
      left: 0,
      width: SCREEN_W * 0.24,
      zIndex: 10,
    },
    tapZoneRight: {
      position: 'absolute',
      top: 92,
      bottom: 210,
      right: 0,
      width: SCREEN_W * 0.24,
      zIndex: 10,
    },
    nextControl: {
      position: 'absolute',
      right: 22,
      bottom: 34,
      zIndex: 15,
      width: 52,
      height: 52,
      borderRadius: 26,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#f3c996',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.4)',
      shadowColor: '#000',
      shadowOpacity: 0.28,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 8 },
      elevation: 8,
    },
    coverBadge: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      paddingHorizontal: 11,
      paddingVertical: 7,
      borderRadius: 999,
      backgroundColor: 'rgba(0,0,0,0.38)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.14)',
    },
    coverBadgeText: {
      fontSize: 12,
      fontWeight: '800',
      color: '#fff',
      letterSpacing: 0,
    },
    coverTitleWrap: {
      marginTop: 18,
      marginBottom: 22,
    },
    coverDestination: {
      fontSize: 12,
      fontWeight: '900',
      letterSpacing: 1.8,
      color: '#f3c996',
      textTransform: 'uppercase',
    },
    coverTitle: {
      marginTop: 8,
      fontSize: 48,
      lineHeight: 50,
      fontWeight: '900',
      color: '#fff',
      letterSpacing: 0,
    },
    coverSubtitle: {
      marginTop: 12,
      fontSize: 16,
      lineHeight: 22,
      fontWeight: '700',
      color: 'rgba(255,255,255,0.82)',
      letterSpacing: 0,
    },
    memoryMetaRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 18,
    },
    primaryAction: {
      minHeight: 56,
      borderRadius: 18,
      paddingHorizontal: 18,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 9,
      backgroundColor: '#f3c996',
    },
    primaryActionText: {
      color: '#15110d',
      fontSize: 15,
      fontWeight: '900',
      letterSpacing: 0,
    },
    secondaryAction: {
      minHeight: 54,
      borderRadius: 18,
      paddingHorizontal: 18,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 9,
      backgroundColor: 'rgba(255,255,255,0.1)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.18)',
    },
    secondaryActionText: {
      color: '#fff',
      fontSize: 15,
      fontWeight: '800',
      letterSpacing: 0,
    },
    photoFocusFrame: {
      height: PLAYER_H * 0.43,
      borderRadius: 28,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.24)',
      backgroundColor: 'rgba(255,255,255,0.08)',
      shadowColor: '#000',
      shadowOpacity: 0.3,
      shadowRadius: 22,
      shadowOffset: { width: 0, height: 14 },
      elevation: 9,
    },
    photoFocusFrameFeatured: {
      height: PLAYER_H * 0.5,
    },
    emptyPhotoFrame: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.08)',
    },
    sceneCopyBlock: {
      marginTop: 22,
    },
    sceneCopyBlockCompact: {
      marginBottom: 18,
    },
    sceneEyebrow: {
      fontSize: 12,
      fontWeight: '900',
      letterSpacing: 1.9,
      color: '#f3c996',
      textTransform: 'uppercase',
    },
    sceneTitle: {
      marginTop: 8,
      fontSize: 36,
      lineHeight: 39,
      fontWeight: '900',
      color: '#fff',
      letterSpacing: 0,
    },
    sceneDetail: {
      marginTop: 10,
      fontSize: 16,
      lineHeight: 23,
      fontWeight: '700',
      color: 'rgba(255,255,255,0.84)',
      letterSpacing: 0,
    },
    sceneLocationRow: {
      marginTop: 14,
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: 999,
      backgroundColor: 'rgba(0,0,0,0.32)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.12)',
    },
    sceneLocationText: {
      maxWidth: SCREEN_W - 94,
      color: '#fff',
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 0,
    },
    highlightsHeader: {
      marginBottom: 18,
    },
    cinematicCollage: {
      height: PLAYER_H * 0.48,
      marginBottom: 18,
    },
    collageHero: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      left: 0,
      width: '61%',
      borderRadius: 28,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.22)',
    },
    collageTop: {
      position: 'absolute',
      top: 18,
      right: 0,
      width: '43%',
      height: '43%',
      borderRadius: 24,
      overflow: 'hidden',
      borderWidth: 4,
      borderColor: 'rgba(255,255,255,0.92)',
      transform: [{ rotate: '4deg' }],
      shadowColor: '#000',
      shadowOpacity: 0.25,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 8 },
    },
    collageBottom: {
      position: 'absolute',
      right: 10,
      bottom: 8,
      width: '45%',
      height: '42%',
      borderRadius: 24,
      overflow: 'hidden',
      borderWidth: 4,
      borderColor: 'rgba(255,255,255,0.92)',
      transform: [{ rotate: '-3deg' }],
      shadowColor: '#000',
      shadowOpacity: 0.25,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 8 },
    },
    glassPanel: {
      padding: 18,
      borderRadius: 24,
      backgroundColor: 'rgba(0,0,0,0.34)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.16)',
    },
    panelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    panelTitle: {
      flex: 1,
      fontSize: 18,
      fontWeight: '900',
      color: '#fff',
      letterSpacing: 0,
    },
    panelText: {
      marginTop: 8,
      fontSize: 14,
      lineHeight: 20,
      color: 'rgba(255,255,255,0.78)',
      fontWeight: '700',
      letterSpacing: 0,
    },
    placesStack: {
      marginTop: 14,
      gap: 10,
      padding: 18,
      borderRadius: 24,
      backgroundColor: 'rgba(0,0,0,0.28)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.14)',
    },
    placeChip: {
      paddingHorizontal: 13,
      paddingVertical: 11,
      borderRadius: 16,
      backgroundColor: 'rgba(255,255,255,0.12)',
    },
    placeChipName: {
      fontSize: 14,
      fontWeight: '900',
      color: '#fff',
      letterSpacing: 0,
    },
    placeChipMeta: {
      marginTop: 2,
      fontSize: 11,
      fontWeight: '800',
      color: 'rgba(255,255,255,0.68)',
      letterSpacing: 0,
    },
    ahaStack: {
      gap: 12,
    },
    ahaCard: {
      padding: 18,
      borderRadius: 24,
      backgroundColor: 'rgba(0,0,0,0.35)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.16)',
    },
    ahaLabel: {
      fontSize: 11,
      fontWeight: '900',
      color: '#f3c996',
      letterSpacing: 1.3,
      textTransform: 'uppercase',
    },
    ahaValue: {
      marginTop: 7,
      fontSize: 31,
      lineHeight: 34,
      fontWeight: '900',
      color: '#fff',
      letterSpacing: 0,
    },
    ahaDetail: {
      marginTop: 6,
      fontSize: 14,
      lineHeight: 20,
      fontWeight: '700',
      color: 'rgba(255,255,255,0.76)',
      letterSpacing: 0,
    },
    closingContent: {
      flex: 1,
      paddingHorizontal: 24,
      paddingTop: 132,
      paddingBottom: 86,
      justifyContent: 'center',
      zIndex: 2,
    },
    posterMark: {
      width: 74,
      height: 74,
      borderRadius: 24,
      backgroundColor: '#f3c996',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 22,
    },
    closingEyebrow: {
      fontSize: 12,
      fontWeight: '900',
      letterSpacing: 1.8,
      textTransform: 'uppercase',
      color: '#f3c996',
    },
    closingTitle: {
      marginTop: 8,
      fontSize: 42,
      lineHeight: 45,
      fontWeight: '900',
      color: '#fff',
      letterSpacing: 0,
    },
    closingText: {
      marginTop: 12,
      marginBottom: 22,
      fontSize: 16,
      lineHeight: 23,
      fontWeight: '700',
      color: 'rgba(255,255,255,0.82)',
      letterSpacing: 0,
    },
    closingActions: {
      gap: 10,
    },
  });
