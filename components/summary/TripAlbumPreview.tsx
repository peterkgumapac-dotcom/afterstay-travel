import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  FlatList,
  PanResponder,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type NativeTouchEvent,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, BookOpen, Camera, ChevronRight, Images, MapPin, Share2, Sparkles, Wallet } from 'lucide-react-native';

import type { ThemeColors } from '@/constants/ThemeContext';
import type { Expense, GroupMember, Moment, Place, Trip } from '@/lib/types';
import type { MomentFavoriteMap } from '@/lib/supabase';
import { formatCurrency } from '@/lib/utils';

const { width: SCREEN_W } = Dimensions.get('window');
const PAGE_W = SCREEN_W - 40;
const PAGE_H = 440;
const SNAP_W = SCREEN_W;
const MAX_PHOTO_PAGES = 15;
const PAGE_TURN_DURATION_MS = 1550;
const CURL_W = PAGE_W * 0.38;

type AlbumPage =
  | { type: 'cover' }
  | { type: 'collage'; title: string; photos: AlbumPhoto[]; caption: string }
  | { type: 'photo'; photo: AlbumPhoto }
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
  photos: AlbumPhoto[];
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

  return {
    title: trip.name || trip.destination || 'Trip Album',
    subtitle: `${dateLabel} · ${trip.nights} night${trip.nights !== 1 ? 's' : ''}`,
    destination: trip.destination,
    nights: trip.nights,
    momentCount: moments.length,
    placesCount: places.length,
    memberCount: members.length,
    spentLabel: spent > 0 ? formatCurrency(spent, currency) : 'No spend yet',
    topTag,
    topLocation,
    heroPhoto: photos[0],
    photos,
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
};

function buildPages(data: TripAlbumData): AlbumPage[] {
  if (data.photos.length === 0) return [{ type: 'cover' }, { type: 'closing' }];
  if (data.photos.length < 5) {
    return [
      { type: 'cover' },
      { type: 'collage', title: 'Your first pages', photos: data.photos, caption: 'A small album from the moments captured so far.' },
      { type: 'stats' },
      { type: 'closing' },
    ];
  }

  const pages: AlbumPage[] = [{ type: 'cover' }];
  pages.push({
    type: 'collage',
    title: data.topLocation ? `Scenes from ${data.topLocation}` : 'Favorite scenes',
    photos: data.photos.slice(0, 5),
    caption: 'A spread of the moments that defined the trip.',
  });
  for (const photo of data.photos.slice(5, 11)) pages.push({ type: 'photo', photo });
  if (data.photos.length > 11) {
    pages.push({
      type: 'collage',
      title: 'More from the roll',
      photos: data.photos.slice(11, 15),
      caption: 'The extra little frames that made the album feel alive.',
    });
  }
  pages.push({ type: 'stats' }, { type: 'closing' });
  return pages;
}

function shouldTurnBySwipe(dx: number, dy: number, canTurnPage: boolean, isFlipping: boolean) {
  const horizontal = Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.15;
  return canTurnPage && !isFlipping && horizontal && dx < 0;
}

export default function TripAlbumPreview({ data, colors, onBack, onOpenAlbum, onAddPhoto, onOpenPhoto }: Props) {
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const scrollX = useRef(new Animated.Value(0)).current;
  const flipAnim = useRef(new Animated.Value(0)).current;
  const flatListRef = useRef<FlatList<AlbumPage>>(null);
  const swipeStartRef = useRef({ x: 0, y: 0, time: 0 });
  const [pageIndex, setPageIndex] = useState(0);
  const [flippingPage, setFlippingPage] = useState<AlbumPage | null>(null);
  const [flippingToPage, setFlippingToPage] = useState<AlbumPage | null>(null);
  const pages = useMemo(() => buildPages(data), [data]);
  const canTurnPage = pageIndex < pages.length - 1;

  useEffect(() => {
    const urls = data.photos.slice(Math.max(0, pageIndex - 1), pageIndex + 4).map((photo) => photo.uri);
    urls.forEach((url) => void Image.prefetch(url).catch(() => {}));
  }, [data.photos, pageIndex]);

  const handleShare = async () => {
    await Share.share({
      message: `${data.title} — ${data.momentCount} moments, ${data.placesCount} places, ${data.spentLabel}`,
    });
  };

  const openNextPage = useCallback(() => {
    if (pages.length <= 1 || flippingPage) return;
    const nextIndex = Math.min(pageIndex + 1, pages.length - 1);
    if (nextIndex === pageIndex) return;

    const fromPage = pages[pageIndex];
    const toPage = pages[nextIndex];
    setFlippingPage(fromPage);
    setFlippingToPage(toPage);
    flipAnim.setValue(0);

    Animated.timing(flipAnim, {
      toValue: 1,
      duration: PAGE_TURN_DURATION_MS,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      setPageIndex(nextIndex);
      flatListRef.current?.scrollToOffset({ offset: nextIndex * SNAP_W, animated: false });
      scrollX.setValue(nextIndex * SNAP_W);
      setFlippingPage(null);
      setFlippingToPage(null);
    });
  }, [flippingPage, flipAnim, pageIndex, pages, scrollX]);

  const pageSwipeResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) => shouldTurnBySwipe(gesture.dx, gesture.dy, canTurnPage, Boolean(flippingPage)),
        onMoveShouldSetPanResponderCapture: (_, gesture) => shouldTurnBySwipe(gesture.dx, gesture.dy, canTurnPage, Boolean(flippingPage)),
        onPanResponderTerminationRequest: () => true,
        onPanResponderRelease: (_, gesture) => {
          const leftSwipe = gesture.dx < -44 || gesture.vx < -0.35;
          const mostlyHorizontal = Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.15;
          if (canTurnPage && !flippingPage && leftSwipe && mostlyHorizontal) openNextPage();
        },
      }),
    [canTurnPage, flippingPage, openNextPage],
  );

  const handleTouchStart = useCallback((event: NativeSyntheticEvent<NativeTouchEvent>) => {
    const touch = event.nativeEvent;
    swipeStartRef.current = { x: touch.pageX, y: touch.pageY, time: Date.now() };
  }, []);

  const handleTouchEnd = useCallback(
    (event: NativeSyntheticEvent<NativeTouchEvent>) => {
      const touch = event.nativeEvent;
      const start = swipeStartRef.current;
      const dx = touch.pageX - start.x;
      const dy = touch.pageY - start.y;
      const elapsed = Date.now() - start.time;
      const mostlyHorizontal = Math.abs(dx) > Math.abs(dy) * 1.1;
      const intentionalSwipe = dx < -42 && mostlyHorizontal && elapsed < 900;

      if (canTurnPage && !flippingPage && intentionalSwipe) openNextPage();
    },
    [canTurnPage, flippingPage, openNextPage],
  );

  const handleScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    setPageIndex(Math.round(event.nativeEvent.contentOffset.x / SNAP_W));
  };

  const renderAlbumPageContent = (item: AlbumPage) => (
    <>
      {item.type === 'cover' ? (
        <AlbumCoverPage data={data} styles={styles} colors={colors} onOpenAlbum={openNextPage} onAddPhoto={onAddPhoto} />
      ) : null}
      {item.type === 'collage' ? (
        <AlbumCollagePage page={item} styles={styles} colors={colors} onOpenPhoto={onOpenPhoto} />
      ) : null}
      {item.type === 'photo' ? (
        <AlbumPhotoPage photo={item.photo} styles={styles} colors={colors} onOpenPhoto={onOpenPhoto} />
      ) : null}
      {item.type === 'stats' ? <AlbumStatsPage data={data} styles={styles} colors={colors} /> : null}
      {item.type === 'closing' ? (
        <AlbumClosingPage data={data} styles={styles} colors={colors} onOpenAlbum={onOpenAlbum} onShare={handleShare} />
      ) : null}
    </>
  );

  const renderPage = ({ item, index }: { item: AlbumPage; index: number }) => {
    const inputRange = [(index - 1) * SNAP_W, index * SNAP_W, (index + 1) * SNAP_W];
    const scale = scrollX.interpolate({ inputRange, outputRange: [0.9, 1, 0.9], extrapolate: 'clamp' });
    const rotateY = scrollX.interpolate({ inputRange, outputRange: ['-42deg', '0deg', '42deg'], extrapolate: 'clamp' });
    const rotateZ = scrollX.interpolate({ inputRange, outputRange: ['-1.5deg', '0deg', '1.5deg'], extrapolate: 'clamp' });
    const translateX = scrollX.interpolate({ inputRange, outputRange: [36, 0, -36], extrapolate: 'clamp' });
    const opacity = scrollX.interpolate({ inputRange, outputRange: [0.62, 1, 0.62], extrapolate: 'clamp' });
    const pageShadeOpacity = scrollX.interpolate({ inputRange, outputRange: [0.2, 0.02, 0.2], extrapolate: 'clamp' });

    return (
      <View style={styles.pageFrame}>
        <View style={styles.bookStackBack} />
        <View style={styles.bookStackMid} />
        <View style={styles.bookBindingShadow} />
        <Animated.View
          style={[
            styles.pageShell,
            {
              opacity,
              transform: [{ perspective: 900 }, { translateX }, { rotateY }, { rotateZ }, { scale }],
            },
          ]}
        >
          {renderAlbumPageContent(item)}
          <LinearGradient colors={['rgba(255,255,255,0.22)', 'rgba(255,255,255,0)', 'rgba(71,41,20,0.16)']} style={styles.pageEdge} />
          <Animated.View style={[styles.turnShade, { opacity: pageShadeOpacity }]} />
          <View style={styles.pageCorner} />
        </Animated.View>
      </View>
    );
  };

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

      <View style={styles.bookViewport} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd} {...pageSwipeResponder.panHandlers}>
        <Animated.FlatList
          ref={flatListRef}
          data={pages}
          renderItem={renderPage}
          keyExtractor={(item, index) => `${item.type}-${index}`}
          getItemLayout={(_, index) => ({ length: SNAP_W, offset: SNAP_W * index, index })}
          horizontal
          scrollEnabled={false}
          pagingEnabled
          snapToInterval={SNAP_W}
          decelerationRate="fast"
          showsHorizontalScrollIndicator={false}
          bounces={false}
          initialNumToRender={pages.length}
          maxToRenderPerBatch={pages.length}
          windowSize={pages.length}
          onMomentumScrollEnd={handleScrollEnd}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: true })}
          onScrollToIndexFailed={({ index }) => {
            const offset = index * SNAP_W;
            flatListRef.current?.scrollToOffset({ offset, animated: false });
            scrollX.setValue(offset);
          }}
          scrollEventThrottle={16}
        />
        {flippingPage ? (
          <View pointerEvents="none" style={styles.flipOverlay}>
            {flippingToPage ? (
              <Animated.View
                style={[
                  styles.pageShell,
                  styles.nextPageUnderlay,
                  {
                    opacity: 1,
                    transform: [
                      { scale: flipAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.995, 1, 1], extrapolate: 'clamp' }) },
                    ],
                  },
                ]}
              >
                {renderAlbumPageContent(flippingToPage)}
                <LinearGradient colors={['rgba(255,255,255,0.22)', 'rgba(255,255,255,0)', 'rgba(71,41,20,0.16)']} style={styles.pageEdge} />
                <Animated.View
                  style={[
                    styles.turnShade,
                    {
                      opacity: flipAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.18, 0.06, 0.01], extrapolate: 'clamp' }),
                    },
                  ]}
                />
                <View style={styles.pageCorner} />
              </Animated.View>
            ) : null}
            <Animated.View
              style={[
                styles.revealedPageShadow,
                {
                  opacity: flipAnim.interpolate({ inputRange: [0, 0.2, 0.7, 1], outputRange: [0, 0.28, 0.16, 0], extrapolate: 'clamp' }),
                  transform: [
                    { translateX: flipAnim.interpolate({ inputRange: [0, 0.52, 1], outputRange: [PAGE_W * 0.4, -PAGE_W * 0.06, -PAGE_W * 0.54], extrapolate: 'clamp' }) },
                    { scaleX: flipAnim.interpolate({ inputRange: [0, 0.46, 1], outputRange: [0.08, 0.38, 0.08], extrapolate: 'clamp' }) },
                  ],
                },
              ]}
            />
            <Animated.View
              style={[
                styles.curledPageSheet,
                {
                  opacity: flipAnim.interpolate({ inputRange: [0, 0.92, 0.99, 1], outputRange: [1, 1, 0.72, 0], extrapolate: 'clamp' }),
                  transform: [
                    { perspective: 1400 },
                    { translateX: flipAnim.interpolate({ inputRange: [0, 0.48, 1], outputRange: [PAGE_W * 0.31, -PAGE_W * 0.18, -PAGE_W * 0.56], extrapolate: 'clamp' }) },
                    { rotateY: flipAnim.interpolate({ inputRange: [0, 0.24, 0.72, 1], outputRange: ['0deg', '-38deg', '-96deg', '-132deg'], extrapolate: 'clamp' }) },
                    { scaleX: flipAnim.interpolate({ inputRange: [0, 0.42, 0.78, 1], outputRange: [1, 0.76, 0.44, 0.24], extrapolate: 'clamp' }) },
                    { scaleY: flipAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.01, 0.99], extrapolate: 'clamp' }) },
                  ],
                },
              ]}
            >
              <Animated.View
                style={[
                  styles.curledPageContent,
                  {
                    opacity: flipAnim.interpolate({ inputRange: [0, 0.34, 0.54, 1], outputRange: [1, 1, 0.08, 0], extrapolate: 'clamp' }),
                  },
                ]}
              >
                {renderAlbumPageContent(flippingPage)}
                <LinearGradient colors={['rgba(255,255,255,0.22)', 'rgba(255,255,255,0)', 'rgba(71,41,20,0.24)']} style={styles.pageEdge} />
                <View style={styles.pageCorner} />
              </Animated.View>
              <Animated.View
                style={[
                  styles.curledPageBackFace,
                  {
                    opacity: flipAnim.interpolate({ inputRange: [0, 0.18, 0.36, 0.96, 1], outputRange: [0, 0, 1, 1, 0.2], extrapolate: 'clamp' }),
                  },
                ]}
              >
                <LinearGradient colors={['#fff8ec', '#efe0c8', '#d9c3a4']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
                <View style={styles.pageBackFold} />
                <View style={styles.pageBackLine} />
                <View style={[styles.pageBackLine, styles.pageBackLineShort]} />
                <View style={styles.pageBackPhotoGhost} />
                <View style={styles.pageBackLine} />
                <View style={[styles.pageBackLine, styles.pageBackLineShort]} />
              </Animated.View>
              <Animated.View
                style={[
                  styles.curlFaceShade,
                  {
                    opacity: flipAnim.interpolate({ inputRange: [0, 0.46, 0.82, 1], outputRange: [0.02, 0.36, 0.2, 0], extrapolate: 'clamp' }),
                  },
                ]}
              />
              <Animated.View
                style={[
                  styles.flipCurlHighlight,
                  {
                    opacity: flipAnim.interpolate({ inputRange: [0, 0.2, 0.72, 1], outputRange: [0, 0.9, 0.52, 0], extrapolate: 'clamp' }),
                    transform: [
                      { translateX: flipAnim.interpolate({ inputRange: [0, 1], outputRange: [CURL_W * 0.54, -CURL_W * 0.34], extrapolate: 'clamp' }) },
                    ],
                  },
                ]}
              />
              <View style={styles.flipPageThickness} />
              <Animated.View
                style={[
                  styles.flipBackCurl,
                  {
                    opacity: flipAnim.interpolate({ inputRange: [0, 0.28, 0.78, 1], outputRange: [0, 0.92, 0.58, 0], extrapolate: 'clamp' }),
                    transform: [
                      { translateX: flipAnim.interpolate({ inputRange: [0, 1], outputRange: [CURL_W * 0.52, -CURL_W * 0.02], extrapolate: 'clamp' }) },
                    ],
                  },
                ]}
              />
            </Animated.View>
          </View>
        ) : null}
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

function AlbumCollagePage({
  page,
  styles,
  onOpenPhoto,
}: {
  page: Extract<AlbumPage, { type: 'collage' }>;
  styles: ReturnType<typeof getStyles>;
  colors: ThemeColors;
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

function AlbumPhotoPage({
  photo,
  styles,
  onOpenPhoto,
}: {
  photo: AlbumPhoto;
  styles: ReturnType<typeof getStyles>;
  colors: ThemeColors;
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

function AlbumStatsPage({ data, styles }: { data: TripAlbumData; styles: ReturnType<typeof getStyles>; colors: ThemeColors }) {
  return (
    <View style={styles.paperPage}>
      <Text style={styles.spreadKicker}>ALBUM NOTES</Text>
      <Text style={styles.spreadTitle}>The trip in pages</Text>
      <View style={styles.statsList}>
        <StatLine icon={<Camera size={18} color="#6d4a2f" />} label="Moments captured" value={String(data.momentCount)} styles={styles} />
        <StatLine icon={<MapPin size={18} color="#6d4a2f" />} label="Places remembered" value={String(data.placesCount)} styles={styles} />
        <StatLine icon={<Wallet size={18} color="#6d4a2f" />} label="Spending logged" value={data.spentLabel} styles={styles} />
        <StatLine icon={<Sparkles size={18} color="#6d4a2f" />} label="Album mood" value={data.topTag ?? data.topLocation ?? 'Travel story'} styles={styles} />
      </View>
    </View>
  );
}

function StatLine({
  icon,
  label,
  value,
  styles,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  styles: ReturnType<typeof getStyles>;
}) {
  return (
    <View style={styles.statLine}>
      <View style={styles.statIcon}>{icon}</View>
      <View style={styles.statCopy}>
        <Text style={styles.statLabel}>{label}</Text>
        <Text style={styles.statValue} numberOfLines={1}>{value}</Text>
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
  colors: ThemeColors;
  onOpenAlbum: () => void;
  onShare: () => void;
}) {
  return (
    <View style={styles.closingPage}>
      <View style={styles.closingIcon}>
        <BookOpen size={30} color="#21160f" />
      </View>
      <Text style={styles.closingTitle}>Your album is ready</Text>
      <Text style={styles.closingText}>{data.title} has {data.momentCount} moments ready to browse.</Text>
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
    flipOverlay: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      alignItems: 'center',
      justifyContent: 'center',
    },
    nextPageUnderlay: {
      position: 'absolute',
      zIndex: 1,
    },
    revealedPageShadow: {
      position: 'absolute',
      zIndex: 2,
      width: PAGE_W * 0.24,
      height: PAGE_H - 16,
      borderRadius: 28,
      backgroundColor: 'rgba(34,20,10,0.34)',
      shadowColor: '#000',
      shadowOpacity: 0.28,
      shadowRadius: 20,
      shadowOffset: { width: -10, height: 8 },
    },
    flipSheet: {
      position: 'absolute',
      zIndex: 3,
      shadowOpacity: 0.48,
      shadowRadius: 26,
      shadowOffset: { width: -24, height: 18 },
      elevation: 14,
    },
    curledPageSheet: {
      position: 'absolute',
      zIndex: 3,
      right: 20,
      width: CURL_W,
      height: PAGE_H,
      borderTopRightRadius: 18,
      borderBottomRightRadius: 18,
      overflow: 'hidden',
      backgroundColor: '#f4eadb',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.42)',
      shadowColor: '#000',
      shadowOpacity: 0.5,
      shadowRadius: 26,
      shadowOffset: { width: -22, height: 18 },
      elevation: 14,
      backfaceVisibility: 'hidden',
    },
    curledPageContent: {
      width: PAGE_W,
      height: PAGE_H,
      transform: [{ translateX: -(PAGE_W - CURL_W) }],
    },
    curledPageBackFace: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      paddingTop: 34,
      paddingHorizontal: 16,
      paddingBottom: 24,
      overflow: 'hidden',
      backgroundColor: '#f7efdf',
    },
    curlFaceShade: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      backgroundColor: '#2a1609',
    },
    flipBackSheet: {
      backgroundColor: '#f7efdf',
      borderColor: 'rgba(99,65,38,0.24)',
    },
    pageBackPaper: {
      flex: 1,
      padding: 26,
      backgroundColor: '#f7efdf',
    },
    pageBackFold: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      left: 0,
      width: 28,
      backgroundColor: 'rgba(91,55,30,0.1)',
      borderRightWidth: 1,
      borderRightColor: 'rgba(91,55,30,0.08)',
    },
    pageBackLine: {
      height: 10,
      borderRadius: 999,
      backgroundColor: 'rgba(118,88,62,0.16)',
      marginBottom: 13,
    },
    pageBackLineShort: {
      width: '62%',
    },
    pageBackPhotoGhost: {
      flex: 1,
      marginVertical: 18,
      borderRadius: 20,
      backgroundColor: 'rgba(150,108,72,0.14)',
      borderWidth: 1,
      borderColor: 'rgba(118,88,62,0.1)',
    },
    flipBackSheen: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      left: 0,
      width: 78,
    },
    flipBackCurl: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      width: 82,
      borderTopLeftRadius: 18,
      borderBottomLeftRadius: 18,
      backgroundColor: '#f7efdf',
      borderLeftWidth: 1,
      borderColor: 'rgba(99,65,38,0.18)',
      shadowColor: '#000',
      shadowOpacity: 0.18,
      shadowRadius: 12,
      shadowOffset: { width: -8, height: 0 },
    },
    flipCurlHighlight: {
      position: 'absolute',
      top: -20,
      bottom: -20,
      width: 34,
      borderRadius: 30,
      backgroundColor: 'rgba(255,255,255,0.42)',
      shadowColor: '#fff',
      shadowOpacity: 0.65,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 0 },
    },
    flipPageThickness: {
      position: 'absolute',
      top: 10,
      bottom: 10,
      right: -5,
      width: 11,
      borderTopRightRadius: 16,
      borderBottomRightRadius: 16,
      backgroundColor: '#d8c6ac',
      borderLeftWidth: 1,
      borderLeftColor: 'rgba(91,62,37,0.18)',
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
    statsList: {
      gap: 10,
      marginTop: 8,
    },
    statLine: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 14,
      borderRadius: 16,
      backgroundColor: '#fff6e9',
      borderWidth: 1,
      borderColor: '#e5d3bd',
    },
    statIcon: {
      width: 40,
      height: 40,
      borderRadius: 13,
      backgroundColor: '#ead4bb',
      alignItems: 'center',
      justifyContent: 'center',
    },
    statCopy: {
      flex: 1,
      minWidth: 0,
    },
    statLabel: {
      fontSize: 11,
      fontWeight: '800',
      color: '#92745e',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    statValue: {
      marginTop: 2,
      fontSize: 19,
      fontWeight: '900',
      color: '#2b2119',
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
