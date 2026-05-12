import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated as RNAnimated,
  Dimensions,
  Easing,
  PanResponder,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  ChevronRight,
  Images,
  MapPin,
  Route,
  Share2,
  Sparkles,
  Users,
} from 'lucide-react-native';

import type { ThemeColors } from '@/constants/ThemeContext';
import type { Expense, GroupMember, Moment, Place, Trip } from '@/lib/types';
import type { MomentFavoriteMap } from '@/lib/supabase';
import { formatCurrency } from '@/lib/utils';

const { width: SCREEN_W } = Dimensions.get('window');
const PAGE_W = SCREEN_W - 40;
const PAGE_H = 440;
const SNAP_W = SCREEN_W;
const MAX_PHOTO_PAGES = 15;

type AlbumPage =
  | { type: 'cover' }
  | { type: 'bestMoments'; title: string; photos: AlbumPhoto[]; caption: string }
  | { type: 'timeline' }
  | { type: 'favorite'; photo: AlbumPhoto }
  | { type: 'places' }
  | { type: 'people' }
  | { type: 'stats' }
  | { type: 'closing' };

export interface AlbumPhoto {
  id: string;
  uri: string;
  hdUri?: string;
  caption?: string;
  location?: string;
  date?: string;
  moment?: Moment;
}

interface TimelineHighlight {
  id: string;
  title: string;
  subtitle: string;
  meta: string;
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
  timeline: TimelineHighlight[];
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

function buildTimelineHighlights(moments: Moment[], albumPhotos: AlbumPhoto[]): TimelineHighlight[] {
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

  return Array.from(groups.values())
    .sort((a, b) => a.sortValue - b.sortValue)
    .slice(0, 4)
    .map((group, index) => {
      const topLocation = mostCommon(group.moments.map((moment) => moment.location));
      const topTag = mostCommon(group.moments.flatMap((moment) => moment.tags ?? []));
      const dateLabel = formatAlbumDate(group.moments[0]?.date);
      return {
        id: `${group.title}-${index}`,
        title: group.title,
        subtitle: topLocation ?? topTag ?? 'A day worth remembering',
        meta: `${group.moments.length} moment${group.moments.length !== 1 ? 's' : ''}${dateLabel ? ` · ${dateLabel}` : ''}`,
        photo: group.photos[0],
      };
    });
}

function buildAhaCards(data: {
  moments: Moment[];
  places: Place[];
  members: GroupMember[];
  nights: number;
  spentLabel: string;
  topLocation?: string;
  topTag?: string;
  favoritePhoto?: AlbumPhoto;
}): AhaCard[] {
  return [
    {
      id: 'moments',
      label: 'Captured',
      value: String(data.moments.length),
      detail: `${data.nights || 1} night${data.nights !== 1 ? 's' : ''} turned into a full camera roll.`,
    },
    {
      id: 'place',
      label: 'Most remembered',
      value: data.topLocation ?? data.places[0]?.name ?? 'The trip',
      detail: data.topLocation ? 'This place kept showing up in your memories.' : 'Your places and moments built the story.',
    },
    {
      id: 'mood',
      label: 'Trip mood',
      value: data.topTag ?? 'Travel story',
      detail: data.topTag ? 'Your photos leaned into this feeling.' : 'A mix of places, people, and small details.',
    },
    {
      id: 'group',
      label: 'Together with',
      value: `${Math.max(1, data.members.length)} traveler${Math.max(1, data.members.length) !== 1 ? 's' : ''}`,
      detail: data.favoritePhoto?.location ? `The favorite frame came from ${data.favoritePhoto.location}.` : `Logged spend: ${data.spentLabel}.`,
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
  const timeline = buildTimelineHighlights(moments, photos);

  return {
    title: trip.name || trip.destination || 'Trip Album',
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
    timeline,
    topPlaces,
    travelers,
    ahaCards: buildAhaCards({
      moments,
      places,
      members,
      nights: trip.nights,
      spentLabel,
      topLocation,
      topTag,
      favoritePhoto,
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
  timeline: [
    {
      id: 'mock-day-1',
      title: 'Day 1',
      subtitle: 'Shibuya Crossing',
      meta: '18 moments · Apr 12',
      photo: {
        id: 'mock-hero',
        uri: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?auto=format&fit=crop&w=1200&q=80',
        location: 'Shibuya',
      },
    },
    {
      id: 'mock-day-2',
      title: 'Day 2',
      subtitle: 'Asakusa',
      meta: '22 moments · Apr 13',
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
    { id: 'moments', label: 'Captured', value: '128', detail: '7 nights turned into a full camera roll.' },
    { id: 'place', label: 'Most remembered', value: 'Shibuya Crossing', detail: 'This place kept showing up in your memories.' },
    { id: 'mood', label: 'Trip mood', value: 'Food', detail: 'Your photos leaned into this feeling.' },
    { id: 'group', label: 'Together with', value: '4 travelers', detail: 'The favorite frame came from Asakusa.' },
  ],
};

function buildPages(data: TripAlbumData): AlbumPage[] {
  if (data.photos.length === 0) return [{ type: 'cover' }, { type: 'closing' }];
  const pages: AlbumPage[] = [{ type: 'cover' }];

  pages.push({
    type: 'bestMoments',
    title: data.topLocation ? `Moments from ${data.topLocation}` : 'Best moments',
    photos: data.photos.slice(0, 5),
    caption: data.photos.length < 5 ? 'A small album from the moments captured so far.' : 'The frames that make this trip easy to remember.',
  });

  if (data.timeline.length > 0) pages.push({ type: 'timeline' });
  if (data.favoritePhoto) pages.push({ type: 'favorite', photo: data.favoritePhoto });
  if (data.topPlaces.length > 0) pages.push({ type: 'places' });
  if (data.travelers.length > 0 || data.memberCount > 0) pages.push({ type: 'people' });
  pages.push({ type: 'stats' }, { type: 'closing' });
  return pages.slice(0, 8);
}

export default function TripAlbumPreview({ data, colors, onBack, onOpenAlbum, onAddPhoto, onOpenPhoto }: Props) {
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const scrollX = useRef(new RNAnimated.Value(0)).current;
  const [pageIndex, setPageIndex] = useState(0);
  const pages = useMemo(() => buildPages(data), [data]);
  const canTurnPage = pageIndex < pages.length - 1;
  const maxPageIndex = pages.length - 1;

  useEffect(() => {
    const urls = data.photos.slice(Math.max(0, pageIndex - 1), pageIndex + 4).map((photo) => photo.uri);
    urls.forEach((url) => void Image.prefetch(url).catch(() => {}));
  }, [data.photos, pageIndex]);

  const handleShare = async () => {
    await Share.share({
      message: `${data.title} — ${data.momentCount} moments, ${data.placesCount} places, ${data.spentLabel}`,
    });
  };

  const animateToPage = useCallback(
    (nextIndex: number, duration = 280) => {
      const targetIndex = Math.max(0, Math.min(nextIndex, maxPageIndex));
      setPageIndex(targetIndex);
      RNAnimated.timing(scrollX, {
        toValue: targetIndex * SNAP_W,
        duration,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    },
    [maxPageIndex, scrollX],
  );

  const openNextPage = useCallback(() => {
    if (!canTurnPage) return;
    animateToPage(pageIndex + 1, 360);
  }, [animateToPage, canTurnPage, pageIndex]);

  const pagePanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) =>
          Math.abs(gestureState.dx) > 8 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.25,
        onMoveShouldSetPanResponderCapture: (_, gestureState) =>
          Math.abs(gestureState.dx) > 8 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.25,
        onPanResponderGrant: () => {
          scrollX.stopAnimation();
        },
        onPanResponderMove: (_, gestureState) => {
          const nextOffset = Math.max(0, Math.min(maxPageIndex * SNAP_W, pageIndex * SNAP_W - gestureState.dx));
          scrollX.setValue(nextOffset);
        },
        onPanResponderRelease: (_, gestureState) => {
          const shouldGoNext = gestureState.dx < -58 || gestureState.vx < -0.45;
          const shouldGoPrev = gestureState.dx > 58 || gestureState.vx > 0.45;
          const nextIndex = shouldGoNext ? pageIndex + 1 : shouldGoPrev ? pageIndex - 1 : pageIndex;
          animateToPage(nextIndex);
        },
        onPanResponderTerminate: () => {
          animateToPage(pageIndex, 200);
        },
      }),
    [animateToPage, maxPageIndex, pageIndex, scrollX],
  );

  const renderAlbumPageContent = (item: AlbumPage) => (
    <>
      {item.type === 'cover' ? (
        <AlbumCoverPage data={data} styles={styles} colors={colors} onOpenAlbum={openNextPage} onAddPhoto={onAddPhoto} />
      ) : null}
      {item.type === 'bestMoments' ? (
        <AlbumBestMomentsPage page={item} styles={styles} onOpenPhoto={onOpenPhoto} />
      ) : null}
      {item.type === 'timeline' ? <AlbumTimelinePage data={data} styles={styles} onOpenPhoto={onOpenPhoto} /> : null}
      {item.type === 'favorite' ? (
        <AlbumFavoritePage photo={item.photo} styles={styles} onOpenPhoto={onOpenPhoto} />
      ) : null}
      {item.type === 'places' ? <AlbumPlacesPage data={data} styles={styles} /> : null}
      {item.type === 'people' ? <AlbumPeoplePage data={data} styles={styles} /> : null}
      {item.type === 'stats' ? <AlbumStatsPage data={data} styles={styles} /> : null}
      {item.type === 'closing' ? (
        <AlbumClosingPage data={data} styles={styles} onOpenAlbum={onOpenAlbum} onShare={handleShare} />
      ) : null}
    </>
  );

  const renderPage = ({ item, index }: { item: AlbumPage; index: number }) => {
    const inputRange = [(index - 1) * SNAP_W, index * SNAP_W, (index + 1) * SNAP_W];
    const pageScale = scrollX.interpolate({ inputRange, outputRange: [0.94, 1, 0.94], extrapolate: 'clamp' });
    const rotateY = scrollX.interpolate({ inputRange, outputRange: ['-9deg', '0deg', '9deg'], extrapolate: 'clamp' });
    const rotateZ = scrollX.interpolate({ inputRange, outputRange: ['-0.6deg', '0deg', '0.6deg'], extrapolate: 'clamp' });
    const translateX = scrollX.interpolate({ inputRange, outputRange: [20, 0, -20], extrapolate: 'clamp' });
    const translateY = scrollX.interpolate({ inputRange, outputRange: [14, 0, 14], extrapolate: 'clamp' });
    const opacity = scrollX.interpolate({ inputRange, outputRange: [0.72, 1, 0.72], extrapolate: 'clamp' });
    const pageShadeOpacity = scrollX.interpolate({ inputRange, outputRange: [0.18, 0.015, 0.18], extrapolate: 'clamp' });
    const liftShadowOpacity = scrollX.interpolate({ inputRange, outputRange: [0.2, 0.46, 0.2], extrapolate: 'clamp' });

    return (
      <View style={styles.pageFrame}>
        <View style={styles.bookStackBack} />
        <View style={styles.bookStackMid} />
        <View style={styles.bookBindingShadow} />
        <RNAnimated.View style={[styles.pageLiftShadow, { opacity: liftShadowOpacity, transform: [{ translateY }, { scale: pageScale }] }]} />
        <RNAnimated.View
          style={[
            styles.pageShell,
            {
              opacity,
              transform: [{ perspective: 900 }, { translateX }, { translateY }, { rotateY }, { rotateZ }, { scale: pageScale }],
            },
          ]}
        >
          {renderAlbumPageContent(item)}
          <LinearGradient colors={['rgba(255,255,255,0.22)', 'rgba(255,255,255,0)', 'rgba(71,41,20,0.16)']} style={styles.pageEdge} />
          <RNAnimated.View style={[styles.turnShade, { opacity: pageShadeOpacity }]} />
          <View style={styles.pageCorner} />
        </RNAnimated.View>
      </View>
    );
  };

  const pagerTranslateX = scrollX.interpolate({
    inputRange: [0, Math.max(1, maxPageIndex) * SNAP_W],
    outputRange: [0, -(Math.max(1, maxPageIndex) * SNAP_W)],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.container}>
      {onBack ? (
        <Pressable
          onPress={onBack}
          style={[styles.backBtn, { top: insets.top + 8 }]}
          accessibilityLabel="Go back"
          accessibilityRole="button"
          hitSlop={10}
        >
          <ArrowLeft size={20} color="#fff" />
        </Pressable>
      ) : null}

      <View style={styles.headerRow}>
        <View>
          <Text style={styles.kicker}>TRIP ALBUM</Text>
          <Text style={styles.headerTitle}>Browse the recap</Text>
        </View>
        <View style={styles.pagePill}>
          <Text style={styles.pagePillText}>{pageIndex + 1}/{pages.length}</Text>
        </View>
      </View>

      <View style={styles.bookViewport} {...pagePanResponder.panHandlers}>
          <RNAnimated.View style={[styles.albumPager, { transform: [{ translateX: pagerTranslateX }] }]}>
            {pages.map((item, index) => (
              <React.Fragment key={`${item.type}-${index}`}>
                {renderPage({ item, index })}
              </React.Fragment>
            ))}
          </RNAnimated.View>
          {canTurnPage ? (
            <Pressable
              onPress={openNextPage}
              style={styles.turnPageControl}
              accessibilityLabel="Turn album page"
              accessibilityRole="button"
              hitSlop={12}
            >
              <ChevronRight size={21} color="#21160f" strokeWidth={2.5} />
            </Pressable>
          ) : null}
      </View>

      <View style={styles.dots}>
        {pages.map((_, index) => (
          <View key={index} style={[styles.dot, index === pageIndex && styles.dotActive]} />
        ))}
      </View>
    </View>
  );
}

function AlbumCoverPage({
  data,
  styles,
  colors,
  onOpenAlbum,
  onAddPhoto,
}: {
  data: TripAlbumData;
  styles: ReturnType<typeof getStyles>;
  colors: ThemeColors;
  onOpenAlbum: () => void;
  onAddPhoto: () => void;
}) {
  return (
    <View style={styles.coverPage}>
      {data.heroPhoto ? (
        <Image source={{ uri: data.heroPhoto.uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={180} />
      ) : (
        <LinearGradient colors={[colors.accent + '45', colors.card]} style={StyleSheet.absoluteFill} />
      )}
      <LinearGradient
        colors={['rgba(0,0,0,0.08)', 'rgba(0,0,0,0.2)', 'rgba(0,0,0,0.78)']}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.albumSpine} />
      <View style={styles.coverPageEdges}>
        <View style={styles.coverPageEdgeLine} />
        <View style={styles.coverPageEdgeLine} />
        <View style={styles.coverPageEdgeLine} />
      </View>
      <View style={styles.coverInsetBorder} />
      <View style={styles.coverCornerStamp}>
        <Sparkles size={14} color="#e3bd8c" />
      </View>
      <View style={styles.coverContent}>
        <View style={styles.coverBadge}>
          <BookOpen size={13} color="#f8eee1" />
          <Text style={styles.coverBadgeText}>AfterStay album</Text>
        </View>
        <Text style={styles.coverTitle} numberOfLines={2}>{data.title}</Text>
        <Text style={styles.coverSubtitle} numberOfLines={2}>{data.subtitle}</Text>
        <View style={styles.coverMetaRow}>
          <Text style={styles.coverMeta}>{data.momentCount} moments</Text>
          <Text style={styles.coverMetaDot}>·</Text>
          <Text style={styles.coverMeta}>{data.placesCount} places</Text>
          <Text style={styles.coverMetaDot}>·</Text>
          <Text style={styles.coverMeta}>{data.memberCount || 1} traveler{(data.memberCount || 1) !== 1 ? 's' : ''}</Text>
        </View>
        <View style={styles.coverActions}>
          <Pressable style={styles.primaryBtn} onPress={data.photos.length > 0 ? onOpenAlbum : onAddPhoto}>
            {data.photos.length > 0 ? <BookOpen size={16} color="#21160f" /> : <Images size={16} color="#21160f" />}
            <Text style={styles.primaryBtnText}>{data.photos.length > 0 ? 'Turn Page' : 'Add Photos'}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function AlbumBestMomentsPage({
  page,
  styles,
  onOpenPhoto,
}: {
  page: Extract<AlbumPage, { type: 'bestMoments' }>;
  styles: ReturnType<typeof getStyles>;
  onOpenPhoto?: (photo: AlbumPhoto) => void;
}) {
  const [hero, ...rest] = page.photos;
  return (
    <View style={styles.paperPage}>
      <Text style={styles.spreadKicker}>PHOTO SPREAD</Text>
      <Text style={styles.spreadTitle} numberOfLines={2}>{page.title}</Text>
      <View style={styles.collageGrid}>
        {hero ? (
          <Pressable style={styles.collageHero} onPress={() => onOpenPhoto?.(hero)}>
            <Image source={{ uri: hero.uri }} style={styles.imageFill} contentFit="cover" transition={140} />
          </Pressable>
        ) : null}
        <View style={styles.collageSide}>
          {rest.slice(0, 4).map((photo) => (
            <Pressable key={photo.id} style={styles.collageThumb} onPress={() => onOpenPhoto?.(photo)}>
              <Image source={{ uri: photo.uri }} style={styles.imageFill} contentFit="cover" transition={140} />
            </Pressable>
          ))}
        </View>
      </View>
      <Text style={styles.caption} numberOfLines={2}>{page.caption}</Text>
    </View>
  );
}

function AlbumFavoritePage({
  photo,
  styles,
  onOpenPhoto,
}: {
  photo: AlbumPhoto;
  styles: ReturnType<typeof getStyles>;
  onOpenPhoto?: (photo: AlbumPhoto) => void;
}) {
  return (
    <Pressable style={styles.paperPage} onPress={() => onOpenPhoto?.(photo)}>
      <View style={styles.singlePhotoWrap}>
        <Image source={{ uri: photo.uri }} style={styles.imageFill} contentFit="cover" transition={160} />
      </View>
      <View style={styles.photoCaptionRow}>
        <View style={styles.photoCaptionTextWrap}>
          <Text style={styles.photoCaption} numberOfLines={2}>{photo.caption ?? 'A favorite frame from the trip'}</Text>
          {photo.location ? (
            <View style={styles.locationRow}>
              <MapPin size={11} color="#8b7766" />
              <Text style={styles.locationText} numberOfLines={1}>{photo.location}</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.photoDate}>{photo.date ? new Date(photo.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'Photo'}</Text>
      </View>
    </Pressable>
  );
}

function AlbumTimelinePage({
  data,
  styles,
  onOpenPhoto,
}: {
  data: TripAlbumData;
  styles: ReturnType<typeof getStyles>;
  onOpenPhoto?: (photo: AlbumPhoto) => void;
}) {
  return (
    <View style={styles.paperPage}>
      <Text style={styles.spreadKicker}>TRIP TIMELINE</Text>
      <Text style={styles.spreadTitle}>The days that shaped it</Text>
      <View style={styles.timelineList}>
        {data.timeline.map((item, index) => (
          <Pressable
            key={item.id}
            style={styles.timelineRow}
            onPress={() => (item.photo ? onOpenPhoto?.(item.photo) : undefined)}
            disabled={!item.photo}
          >
            <View style={styles.timelineMarker}>
              <Text style={styles.timelineMarkerText}>{index + 1}</Text>
            </View>
            {item.photo ? (
              <Image source={{ uri: item.photo.uri }} style={styles.timelinePhoto} contentFit="cover" transition={140} />
            ) : (
              <View style={styles.timelinePhotoFallback}>
                <CalendarDays size={16} color="#8d6c52" />
              </View>
            )}
            <View style={styles.timelineCopy}>
              <Text style={styles.timelineTitle}>{item.title}</Text>
              <Text style={styles.timelineSubtitle} numberOfLines={1}>{item.subtitle}</Text>
              <Text style={styles.timelineMeta} numberOfLines={1}>{item.meta}</Text>
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function AlbumPlacesPage({ data, styles }: { data: TripAlbumData; styles: ReturnType<typeof getStyles> }) {
  return (
    <View style={styles.paperPage}>
      <Text style={styles.spreadKicker}>PLACES</Text>
      <Text style={styles.spreadTitle}>Where the trip lived</Text>
      <View style={styles.placesHero}>
        <Route size={20} color="#6d4a2f" />
        <View style={styles.placesHeroCopy}>
          <Text style={styles.placesHeroTitle} numberOfLines={1}>{data.topLocation ?? data.destination}</Text>
          <Text style={styles.placesHeroText}>{data.placesCount} saved place{data.placesCount !== 1 ? 's' : ''} across the trip</Text>
        </View>
      </View>
      <View style={styles.placeList}>
        {data.topPlaces.slice(0, 4).map((place, index) => (
          <View key={place.id} style={styles.placeRow}>
            {place.photoUrl ? (
              <Image source={{ uri: place.photoUrl }} style={styles.placePhoto} contentFit="cover" transition={140} />
            ) : (
              <View style={styles.placeNumber}>
                <Text style={styles.placeNumberText}>{index + 1}</Text>
              </View>
            )}
            <View style={styles.placeCopy}>
              <Text style={styles.placeName} numberOfLines={1}>{place.name}</Text>
              <Text style={styles.placeMeta} numberOfLines={1}>{place.category ?? 'Saved place'}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

function AlbumPeoplePage({ data, styles }: { data: TripAlbumData; styles: ReturnType<typeof getStyles> }) {
  const visibleTravelers = data.travelers.length > 0 ? data.travelers : [{ id: 'solo', name: 'You' }];
  return (
    <View style={styles.paperPage}>
      <Text style={styles.spreadKicker}>PEOPLE</Text>
      <Text style={styles.spreadTitle}>Who made it feel real</Text>
      <View style={styles.peopleHero}>
        <Users size={28} color="#6d4a2f" />
        <Text style={styles.peopleHeroTitle}>
          {Math.max(1, data.memberCount)} traveler{Math.max(1, data.memberCount) !== 1 ? 's' : ''}
        </Text>
        <Text style={styles.peopleHeroText}>The recap works best when the people are part of the story.</Text>
      </View>
      <View style={styles.peopleGrid}>
        {visibleTravelers.slice(0, 5).map((traveler) => (
          <View key={traveler.id} style={styles.personChip}>
            {traveler.photo ? (
              <Image source={{ uri: traveler.photo }} style={styles.personPhoto} contentFit="cover" transition={140} />
            ) : (
              <View style={styles.personInitial}>
                <Text style={styles.personInitialText}>{traveler.name.trim().charAt(0).toUpperCase() || 'A'}</Text>
              </View>
            )}
            <Text style={styles.personName} numberOfLines={1}>{traveler.name}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function AlbumStatsPage({ data, styles }: { data: TripAlbumData; styles: ReturnType<typeof getStyles> }) {
  return (
    <View style={styles.paperPage}>
      <Text style={styles.spreadKicker}>AHA MOMENTS</Text>
      <Text style={styles.spreadTitle}>What the trip says back</Text>
      <View style={styles.ahaGrid}>
        {data.ahaCards.map((card) => (
          <View key={card.id} style={styles.ahaCard}>
            <Text style={styles.ahaLabel}>{card.label}</Text>
            <Text style={styles.ahaValue} numberOfLines={2}>{card.value}</Text>
            <Text style={styles.ahaDetail} numberOfLines={2}>{card.detail}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function AlbumClosingPage({
  data,
  styles,
  onOpenAlbum,
  onShare,
}: {
  data: TripAlbumData;
  styles: ReturnType<typeof getStyles>;
  onOpenAlbum: () => void;
  onShare: () => void;
}) {
  return (
    <View style={styles.closingPage}>
      <View style={styles.closingIcon}>
        <BookOpen size={30} color="#21160f" />
      </View>
      <Text style={styles.closingTitle}>Ready to relive it</Text>
      <Text style={styles.closingText}>
        {data.title} has {data.momentCount} moments, {data.placesCount} places, and a few memories worth sharing.
      </Text>
      <View style={styles.closingActions}>
        <Pressable style={styles.primaryBtn} onPress={onOpenAlbum}>
          <Images size={16} color="#21160f" />
          <Text style={styles.primaryBtnText}>View All Photos</Text>
        </Pressable>
        <Pressable style={styles.secondaryBtn} onPress={onShare}>
          <Share2 size={16} color="#f8eee1" />
          <Text style={styles.secondaryBtnText}>Share Cover</Text>
        </Pressable>
      </View>
    </View>
  );
}

const getStyles = (_colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      width: SCREEN_W,
      marginLeft: -20,
      paddingTop: 0,
      paddingBottom: 16,
      marginBottom: 4,
      backgroundColor: '#1a130f',
    },
    backBtn: {
      position: 'absolute',
      left: 16,
      zIndex: 20,
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: 'rgba(0,0,0,0.45)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingLeft: 78,
      paddingRight: 20,
      paddingTop: 58,
      paddingBottom: 14,
    },
    kicker: {
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 1.8,
      color: '#d9b88f',
    },
    headerTitle: {
      marginTop: 3,
      fontSize: 20,
      fontWeight: '800',
      color: '#f8eee1',
      letterSpacing: 0,
    },
    pagePill: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: 'rgba(255,255,255,0.1)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.14)',
    },
    pagePillText: {
      fontSize: 11,
      fontWeight: '700',
      color: '#f8eee1',
    },
    pageFrame: {
      width: SNAP_W,
      height: PAGE_H + 24,
      alignItems: 'center',
      justifyContent: 'center',
    },
    bookViewport: {
      height: PAGE_H + 24,
      overflow: 'hidden',
    },
    albumPager: {
      flexDirection: 'row',
    },
    turnPageControl: {
      position: 'absolute',
      right: 38,
      bottom: 24,
      zIndex: 8,
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#f3c996',
      borderWidth: 1,
      borderColor: 'rgba(70,42,23,0.18)',
      shadowColor: '#000',
      shadowOpacity: 0.18,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 6 },
      elevation: 6,
    },
    bookStackBack: {
      position: 'absolute',
      width: PAGE_W,
      height: PAGE_H - 8,
      borderRadius: 20,
      backgroundColor: '#c4ad93',
      transform: [{ translateX: 22 }, { translateY: 12 }, { rotate: '1.15deg' }],
      opacity: 0.72,
    },
    bookStackMid: {
      position: 'absolute',
      width: PAGE_W,
      height: PAGE_H - 4,
      borderRadius: 21,
      backgroundColor: '#eadcc8',
      transform: [{ translateX: 12 }, { translateY: 6 }, { rotate: '0.55deg' }],
      opacity: 0.88,
    },
    bookBindingShadow: {
      position: 'absolute',
      left: 26,
      top: 18,
      bottom: 22,
      width: 22,
      borderRadius: 18,
      backgroundColor: 'rgba(0,0,0,0.24)',
    },
    pageLiftShadow: {
      position: 'absolute',
      width: PAGE_W - 18,
      height: PAGE_H - 8,
      borderRadius: 22,
      backgroundColor: '#000',
      shadowColor: '#000',
      shadowOpacity: 0.42,
      shadowRadius: 26,
      shadowOffset: { width: 0, height: 18 },
      elevation: 8,
    },
    pageShell: {
      width: PAGE_W,
      height: PAGE_H,
      borderRadius: 18,
      overflow: 'hidden',
      backgroundColor: '#f4eadb',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.42)',
      shadowColor: '#000',
      shadowOpacity: 0.36,
      shadowRadius: 22,
      shadowOffset: { width: 0, height: 16 },
      elevation: 9,
      backfaceVisibility: 'hidden',
    },
    pageEdge: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      left: 0,
      width: 34,
      opacity: 0.92,
    },
    turnShade: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      backgroundColor: '#2a1609',
    },
    pageCorner: {
      position: 'absolute',
      right: 0,
      bottom: 0,
      width: 38,
      height: 38,
      borderTopLeftRadius: 24,
      backgroundColor: 'rgba(255,255,255,0.22)',
      borderLeftWidth: 1,
      borderTopWidth: 1,
      borderColor: 'rgba(91,62,37,0.18)',
    },
    coverPage: {
      flex: 1,
      backgroundColor: '#0a0806',
    },
    albumSpine: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      left: 0,
      width: 22,
      backgroundColor: 'rgba(26,13,4,0.55)',
      borderRightWidth: 1,
      borderRightColor: 'rgba(255,255,255,0.12)',
    },
    coverPageEdges: {
      position: 'absolute',
      top: 16,
      right: 0,
      bottom: 16,
      width: 16,
      justifyContent: 'center',
      gap: 7,
      backgroundColor: 'rgba(255,248,235,0.3)',
      borderLeftWidth: 1,
      borderLeftColor: 'rgba(255,248,235,0.22)',
    },
    coverPageEdgeLine: {
      height: 1,
      marginLeft: 3,
      backgroundColor: 'rgba(55,34,20,0.22)',
    },
    coverInsetBorder: {
      position: 'absolute',
      top: 14,
      right: 14,
      bottom: 14,
      left: 30,
      borderRadius: 15,
      borderWidth: 1,
      borderColor: 'rgba(255,248,235,0.32)',
    },
    coverCornerStamp: {
      position: 'absolute',
      top: 28,
      right: 26,
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.34)',
      borderWidth: 1,
      borderColor: 'rgba(255,248,235,0.22)',
    },
    coverContent: {
      position: 'absolute',
      left: 34,
      right: 22,
      bottom: 26,
    },
    coverBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: 'rgba(0,0,0,0.35)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.18)',
      marginBottom: 12,
    },
    coverBadgeText: {
      fontSize: 11,
      fontWeight: '700',
      color: '#f8eee1',
    },
    coverTitle: {
      fontSize: 38,
      lineHeight: 41,
      fontWeight: '900',
      color: '#fff8eb',
      letterSpacing: 0,
    },
    coverSubtitle: {
      marginTop: 8,
      fontSize: 14,
      lineHeight: 19,
      fontWeight: '600',
      color: 'rgba(255,248,235,0.78)',
    },
    coverMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 6,
      marginTop: 12,
    },
    coverMeta: {
      fontSize: 12,
      fontWeight: '700',
      color: 'rgba(255,248,235,0.75)',
    },
    coverMetaDot: {
      fontSize: 12,
      color: 'rgba(255,248,235,0.55)',
    },
    coverActions: {
      flexDirection: 'row',
      marginTop: 18,
    },
    primaryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 14,
      backgroundColor: '#e3bd8c',
    },
    primaryBtnText: {
      fontSize: 13,
      fontWeight: '800',
      color: '#21160f',
    },
    paperPage: {
      flex: 1,
      padding: 20,
      backgroundColor: '#f4eadb',
    },
    spreadKicker: {
      fontSize: 10,
      fontWeight: '900',
      letterSpacing: 1.7,
      color: '#9b7356',
    },
    spreadTitle: {
      marginTop: 5,
      marginBottom: 16,
      fontSize: 25,
      lineHeight: 29,
      fontWeight: '900',
      color: '#2b2119',
      letterSpacing: 0,
    },
    collageGrid: {
      flex: 1,
      flexDirection: 'row',
      gap: 8,
      minHeight: 260,
    },
    collageHero: {
      flex: 1.45,
      borderRadius: 16,
      overflow: 'hidden',
      backgroundColor: '#dacbbb',
    },
    collageSide: {
      flex: 1,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    collageThumb: {
      width: '47%',
      flexGrow: 1,
      minHeight: 120,
      borderRadius: 14,
      overflow: 'hidden',
      backgroundColor: '#dacbbb',
    },
    imageFill: {
      width: '100%',
      height: '100%',
    },
    caption: {
      marginTop: 14,
      fontSize: 13,
      lineHeight: 18,
      fontWeight: '600',
      color: '#6d5a49',
    },
    singlePhotoWrap: {
      flex: 1,
      borderRadius: 18,
      overflow: 'hidden',
      backgroundColor: '#dacbbb',
      borderWidth: 8,
      borderColor: '#fffaf1',
    },
    photoCaptionRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 12,
      marginTop: 14,
    },
    photoCaptionTextWrap: {
      flex: 1,
    },
    photoCaption: {
      fontSize: 15,
      lineHeight: 20,
      fontWeight: '800',
      color: '#2b2119',
    },
    locationRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: 5,
    },
    locationText: {
      fontSize: 12,
      fontWeight: '700',
      color: '#8b7766',
    },
    photoDate: {
      fontSize: 12,
      fontWeight: '800',
      color: '#9b7356',
    },
    timelineList: {
      gap: 10,
      marginTop: 8,
    },
    timelineRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 10,
      borderRadius: 16,
      backgroundColor: '#fff6e9',
      borderWidth: 1,
      borderColor: '#e5d3bd',
    },
    timelineMarker: {
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: '#ead4bb',
      alignItems: 'center',
      justifyContent: 'center',
    },
    timelineMarkerText: {
      fontSize: 11,
      fontWeight: '900',
      color: '#6d4a2f',
    },
    timelinePhoto: {
      width: 54,
      height: 54,
      borderRadius: 14,
      backgroundColor: '#dacbbb',
    },
    timelinePhotoFallback: {
      width: 54,
      height: 54,
      borderRadius: 14,
      backgroundColor: '#ead4bb',
      alignItems: 'center',
      justifyContent: 'center',
    },
    timelineCopy: {
      flex: 1,
      minWidth: 0,
    },
    timelineTitle: {
      fontSize: 13,
      fontWeight: '900',
      color: '#2b2119',
    },
    timelineSubtitle: {
      marginTop: 2,
      fontSize: 13,
      fontWeight: '800',
      color: '#6d4a2f',
    },
    timelineMeta: {
      marginTop: 2,
      fontSize: 11,
      fontWeight: '700',
      color: '#9b7356',
    },
    placesHero: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 14,
      borderRadius: 18,
      backgroundColor: '#fff6e9',
      borderWidth: 1,
      borderColor: '#e5d3bd',
    },
    placesHeroCopy: {
      flex: 1,
      minWidth: 0,
    },
    placesHeroTitle: {
      fontSize: 16,
      fontWeight: '900',
      color: '#2b2119',
    },
    placesHeroText: {
      marginTop: 3,
      fontSize: 12,
      fontWeight: '700',
      color: '#8b7766',
    },
    placeList: {
      gap: 10,
      marginTop: 14,
    },
    placeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 10,
      borderRadius: 16,
      backgroundColor: '#fffaf1',
      borderWidth: 1,
      borderColor: '#e5d3bd',
    },
    placePhoto: {
      width: 48,
      height: 48,
      borderRadius: 14,
      backgroundColor: '#dacbbb',
    },
    placeNumber: {
      width: 48,
      height: 48,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#ead4bb',
    },
    placeNumberText: {
      fontSize: 17,
      fontWeight: '900',
      color: '#6d4a2f',
    },
    placeCopy: {
      flex: 1,
      minWidth: 0,
    },
    placeName: {
      fontSize: 15,
      fontWeight: '900',
      color: '#2b2119',
    },
    placeMeta: {
      marginTop: 3,
      fontSize: 12,
      fontWeight: '700',
      color: '#8b7766',
    },
    peopleHero: {
      alignItems: 'center',
      padding: 18,
      borderRadius: 22,
      backgroundColor: '#fff6e9',
      borderWidth: 1,
      borderColor: '#e5d3bd',
    },
    peopleHeroTitle: {
      marginTop: 8,
      fontSize: 24,
      fontWeight: '900',
      color: '#2b2119',
      letterSpacing: 0,
    },
    peopleHeroText: {
      marginTop: 6,
      fontSize: 13,
      lineHeight: 18,
      fontWeight: '700',
      color: '#8b7766',
      textAlign: 'center',
    },
    peopleGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      marginTop: 16,
    },
    personChip: {
      width: '47%',
      flexGrow: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      padding: 9,
      borderRadius: 16,
      backgroundColor: '#fffaf1',
      borderWidth: 1,
      borderColor: '#e5d3bd',
    },
    personPhoto: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: '#dacbbb',
    },
    personInitial: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#ead4bb',
    },
    personInitialText: {
      fontSize: 13,
      fontWeight: '900',
      color: '#6d4a2f',
    },
    personName: {
      flex: 1,
      minWidth: 0,
      fontSize: 13,
      fontWeight: '800',
      color: '#2b2119',
    },
    ahaGrid: {
      flex: 1,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      marginTop: 4,
    },
    ahaCard: {
      width: '47%',
      flexGrow: 1,
      minHeight: 132,
      padding: 14,
      borderRadius: 18,
      backgroundColor: '#fff6e9',
      borderWidth: 1,
      borderColor: '#e5d3bd',
      justifyContent: 'space-between',
    },
    ahaLabel: {
      fontSize: 10,
      fontWeight: '900',
      color: '#9b7356',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    ahaValue: {
      marginTop: 8,
      fontSize: 22,
      lineHeight: 25,
      fontWeight: '900',
      color: '#2b2119',
      letterSpacing: 0,
    },
    ahaDetail: {
      marginTop: 8,
      fontSize: 12,
      lineHeight: 16,
      fontWeight: '700',
      color: '#7d6857',
    },
    closingPage: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      backgroundColor: '#21160f',
    },
    closingIcon: {
      width: 66,
      height: 66,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#e3bd8c',
      marginBottom: 18,
    },
    closingTitle: {
      fontSize: 30,
      lineHeight: 34,
      fontWeight: '900',
      color: '#fff8eb',
      textAlign: 'center',
      letterSpacing: 0,
    },
    closingText: {
      marginTop: 10,
      fontSize: 14,
      lineHeight: 20,
      fontWeight: '600',
      color: 'rgba(255,248,235,0.7)',
      textAlign: 'center',
    },
    closingActions: {
      alignSelf: 'stretch',
      gap: 10,
      marginTop: 24,
    },
    secondaryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 14,
      backgroundColor: 'rgba(255,255,255,0.1)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.18)',
    },
    secondaryBtnText: {
      fontSize: 13,
      fontWeight: '800',
      color: '#f8eee1',
    },
    dots: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 6,
      marginTop: 14,
    },
    dot: {
      width: 5,
      height: 5,
      borderRadius: 3,
      backgroundColor: 'rgba(255,255,255,0.24)',
    },
    dotActive: {
      width: 18,
      backgroundColor: '#e3bd8c',
    },
  });
