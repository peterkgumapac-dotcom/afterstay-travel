import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { EyeOff, MapPin, RefreshCw, Star } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/constants/ThemeContext';
import { getCuratedList, type CuratedItem } from '@/lib/supabase';
import { searchPlace } from '@/lib/google-places';

type ThemeColors = ReturnType<typeof useTheme>['colors'];

interface TopPicksSectionProps {
  destination: string;
  hotelName?: string;
}

interface EnrichedItem extends CuratedItem {
  photoUrl?: string;
  mapsUrl?: string;
}

const HIDE_KEY = 'top_picks_hidden';
const POOL_KEY = 'top_picks_pool';
const TWELVE_HOURS = 12 * 60 * 60 * 1000;
const POOL_SIZE = 20;
const SHOW_COUNT = 5;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function TopPicksSection({ destination, hotelName }: TopPicksSectionProps) {
  const { colors } = useTheme();
  const s = useMemo(() => getStyles(colors), [colors]);
  const [visible, setVisible] = useState<EnrichedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [hidden, setHidden] = useState(false);
  const pool = useRef<EnrichedItem[]>([]);
  const poolIndex = useRef(0);

  useEffect(() => {
    AsyncStorage.getItem(HIDE_KEY).then((v) => { if (v === 'true') setHidden(true); });
  }, []);

  // Pick next 5 from pool
  const showNext5 = useCallback(() => {
    const p = pool.current;
    if (p.length === 0) return;
    const start = poolIndex.current;
    const next: EnrichedItem[] = [];
    for (let i = 0; i < SHOW_COUNT; i++) {
      next.push(p[(start + i) % p.length]);
    }
    poolIndex.current = (start + SHOW_COUNT) % p.length;
    setVisible(next);
  }, []);

  const loadPool = useCallback(async (force = false) => {
    if (!destination) return;

    // Check cache
    if (!force) {
      try {
        const raw = await AsyncStorage.getItem(POOL_KEY);
        if (raw) {
          const { items, ts } = JSON.parse(raw);
          if (Date.now() - ts < TWELVE_HOURS && items?.length > 0) {
            pool.current = shuffle(items);
            poolIndex.current = 0;
            showNext5();
            setLoading(false);
            return;
          }
        }
      } catch { /* ignore */ }
    }

    setLoading(true);
    setError(undefined);
    try {
      const r = await getCuratedList({
        destination,
        category: 'must-visit places, restaurants, cafes, beaches, activities, and hidden gems',
        hotelName,
        count: POOL_SIZE,
      });

      // Enrich with Google Places photos (first 10 only to limit API calls)
      const enriched = await Promise.all(
        r.items.map(async (item, i) => {
          if (i >= 10) return item as EnrichedItem; // skip photo for items 11-20
          try {
            const place = await searchPlace(item.name, destination);
            return {
              ...item,
              photoUrl: place?.photo_url ?? undefined,
              mapsUrl: place?.place_id
                ? `https://www.google.com/maps/place/?q=place_id:${place.place_id}`
                : undefined,
            };
          } catch {
            return item as EnrichedItem;
          }
        }),
      );

      // Save to cache
      AsyncStorage.setItem(POOL_KEY, JSON.stringify({ items: enriched, ts: Date.now() })).catch(() => {});

      pool.current = shuffle(enriched);
      poolIndex.current = 0;
      showNext5();
    } catch {
      setError('Could not load');
    } finally {
      setLoading(false);
    }
  }, [destination, hotelName, showNext5]);

  useEffect(() => { if (!hidden) loadPool(); }, [destination, hotelName, hidden]);

  const handleRefresh = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    showNext5();
  };

  const handleHide = () => {
    setHidden(true);
    AsyncStorage.setItem(HIDE_KEY, 'true').catch(() => {});
  };

  const handleShow = () => {
    setHidden(false);
    AsyncStorage.removeItem(HIDE_KEY).catch(() => {});
    loadPool();
  };

  const openMaps = (item: EnrichedItem) => {
    const url = item.mapsUrl ?? `https://www.google.com/maps/search/${encodeURIComponent(item.name + ' ' + destination)}`;
    Linking.openURL(url).catch(() => {});
  };

  if (hidden) {
    return (
      <View style={s.hiddenWrap}>
        <TouchableOpacity onPress={handleShow} style={s.showBtn} activeOpacity={0.7}>
          <Text style={s.showText}>Show top picks</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={s.loadingWrap}>
        <ActivityIndicator color={colors.accent} size="small" />
        <Text style={s.loadingText}>Finding top picks...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={s.errorWrap}>
        <Text style={s.errorText}>{error}</Text>
        <TouchableOpacity onPress={() => loadPool(true)} style={s.retryBtn}>
          <RefreshCw size={14} color={colors.accent} />
          <Text style={s.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (visible.length === 0) return null;

  const hero = visible[0];
  const rest = visible.slice(1);

  return (
    <View style={s.list}>
      {/* Action row */}
      <View style={s.actionRow}>
        <TouchableOpacity onPress={handleRefresh} style={s.actionBtn} activeOpacity={0.7}>
          <RefreshCw size={12} color={colors.text3} />
          <Text style={s.actionText}>Shuffle</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleHide} style={s.actionBtn} activeOpacity={0.7}>
          <EyeOff size={12} color={colors.text3} />
          <Text style={s.actionText}>Hide</Text>
        </TouchableOpacity>
      </View>

      {/* Hero */}
      <TouchableOpacity style={s.heroCard} activeOpacity={0.8} onPress={() => openMaps(hero)}>
        {hero.photoUrl ? (
          <Image source={{ uri: hero.photoUrl }} style={s.heroImage} resizeMode="cover" />
        ) : (
          <View style={[s.heroImage, { backgroundColor: colors.card2 }]} />
        )}
        <LinearGradient colors={['transparent', 'rgba(0,0,0,0.75)']} locations={[0.3, 1]} style={StyleSheet.absoluteFill} />
        <View style={s.heroBadge}><Text style={s.heroBadgeText}>1</Text></View>
        <View style={s.heroContent}>
          <Text style={s.heroName}>{hero.name}</Text>
          <Text style={s.heroReason} numberOfLines={2}>{hero.reason}</Text>
          <View style={s.heroMeta}>
            {hero.price ? <Text style={s.heroPrice}>{hero.price}</Text> : null}
            {hero.rating != null && (
              <View style={s.heroRating}>
                <Star size={10} color="#fff" fill="#fff" />
                <Text style={s.heroRatingText}>{hero.rating}</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>

      {/* Rest */}
      {rest.map((item, i) => (
        <TouchableOpacity key={`${item.name}-${i}`} style={s.card} activeOpacity={0.7} onPress={() => openMaps(item)}>
          {item.photoUrl ? (
            <Image source={{ uri: item.photoUrl }} style={s.cardThumb} resizeMode="cover" />
          ) : (
            <View style={[s.cardThumb, { backgroundColor: colors.card2 }]}>
              <MapPin size={16} color={colors.text3} />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <View style={s.cardTop}>
              <Text style={s.rank}>{i + 2}</Text>
              <Text style={s.cardName} numberOfLines={1}>{item.name}</Text>
              {item.rating != null && (
                <View style={s.ratingBadge}>
                  <Star size={9} color={colors.accent} fill={colors.accent} />
                  <Text style={s.ratingText}>{item.rating}</Text>
                </View>
              )}
            </View>
            <Text style={s.cardReason} numberOfLines={2}>{item.reason}</Text>
            {item.price ? <Text style={s.cardPrice}>{item.price}</Text> : null}
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const getStyles = (c: ThemeColors) =>
  StyleSheet.create({
    loadingWrap: { alignItems: 'center', gap: 8, paddingVertical: 32 },
    loadingText: { fontSize: 12, color: c.text3 },
    errorWrap: { alignItems: 'center', gap: 8, paddingVertical: 24 },
    errorText: { fontSize: 12, color: c.danger },
    retryBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    retryText: { fontSize: 12, fontWeight: '600', color: c.accent },
    hiddenWrap: { paddingHorizontal: 16, marginBottom: 8 },
    showBtn: { paddingVertical: 10, alignItems: 'center' },
    showText: { fontSize: 12, fontWeight: '600', color: c.text3 },
    list: { paddingHorizontal: 16, gap: 10 },
    actionRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 16, marginBottom: -2 },
    actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    actionText: { fontSize: 11, color: c.text3 },
    heroCard: { height: 200, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: c.border },
    heroImage: { ...StyleSheet.absoluteFillObject },
    heroBadge: { position: 'absolute', top: 12, left: 12, width: 28, height: 28, borderRadius: 14, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' },
    heroBadgeText: { fontSize: 14, fontWeight: '800', color: c.bg },
    heroContent: { position: 'absolute', bottom: 14, left: 14, right: 14 },
    heroName: { fontSize: 18, fontWeight: '700', color: '#fff', letterSpacing: -0.3 },
    heroReason: { fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 4, lineHeight: 17 },
    heroMeta: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 },
    heroPrice: { fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: '600' },
    heroRating: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    heroRatingText: { fontSize: 11, fontWeight: '700', color: '#fff' },
    card: { flexDirection: 'row', gap: 12, padding: 10, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: 16 },
    cardThumb: { width: 72, height: 72, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    cardTop: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    rank: { fontSize: 14, fontWeight: '700', color: c.accent, width: 18 },
    cardName: { fontSize: 13, fontWeight: '600', color: c.text, flex: 1 },
    ratingBadge: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 5, paddingVertical: 2, backgroundColor: c.accentBg, borderRadius: 6 },
    ratingText: { fontSize: 10, fontWeight: '700', color: c.accent },
    cardReason: { fontSize: 11, color: c.text2, marginTop: 3, lineHeight: 15 },
    cardPrice: { fontSize: 10, color: c.text3, fontWeight: '600', marginTop: 4 },
  });
