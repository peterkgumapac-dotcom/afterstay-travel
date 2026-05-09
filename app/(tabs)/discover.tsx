import * as Haptics from 'expo-haptics';
import * as Updates from 'expo-updates';
import { StatusBar } from 'expo-status-bar';
import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Keyboard,
  Linking,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bookmark, CalendarDays, ChevronDown, ChevronRight, Filter, MapPin, Navigation, Search, Sparkles, ThumbsUp, Users, Vote } from 'lucide-react-native';

import EmptyState from '@/components/shared/EmptyState';
import { SwipeToDelete } from '@/components/shared/SwipeToDelete';
import { TabErrorBoundary } from '@/components/shared/TabErrorBoundary';

import {
  DiscoverPlaceCard,
  type DiscoverPlace,
} from '@/components/discover/DiscoverPlaceCard';
import { TopPicksByCategorySection, TopPicksSection } from '@/components/discover/DiscoverTopPicks';
import PlaceFilterPanel from '@/components/discover/PlaceFilterPanel';
import MiniLoader from '@/components/loader/MiniLoader';
const PlaceDetailSheet = React.lazy(() => import('@/components/discover/PlaceDetailSheet'));
const AIConcierge = React.lazy(() => import('@/components/discover/AIConcierge'));
const StaysTab = React.lazy(() => import('@/components/discover/StaysTab'));
import { useTheme } from '@/constants/ThemeContext';
import type { ItineraryDay, PlannerScope, PlannerPace } from '@/lib/anthropic';
import { distanceFromPoint, formatDistance } from '@/lib/distance';
import { mapNearbyToDiscoverPlace, mapSavedToDiscoverPlace } from '@/components/discover/shared';
import { MS_PER_DAY } from '@/lib/utils';
import { cacheGet, cacheSet } from '@/lib/cache';
import { searchNearby, searchNearbyPage, placeAutocomplete, getPlaceLocation, searchPlace, type NearbyPlace } from '@/lib/google-places';
import { CATEGORY_SEARCH_MAP, CATEGORY_RADIUS_MAP, DEFAULT_SEARCH_RADIUS } from '@/lib/category-config';
import { searchMultiCategory } from '@/lib/multi-category-search';
import {
  applyPlaceFilters,
  countActivePlaceFilters,
} from '@/lib/discoverPlaceFilters';
import {
  DEFAULT_FILTERS,
  PLACE_CATEGORY_CHIPS,
  PRIMARY_PLACE_CATEGORY_CHIPS,
  destinationToLabel,
  isBroadOriginQuery,
  originRefinementCopy,
  resolveCategory,
  type DiscoverOriginKind,
  type DistanceOrigin,
  type FilterState,
  type TabId,
  type TravelMode,
} from '@/lib/discoverScreenHelpers';
import {
  addPlace,
  getActiveTrip,
  getGroupMembers,
  getSavedPlaces,
  savePlace,
  voteOnPlace,
  voteAsMember,
  notifyGroupOfRecommendation,
} from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
const GroupVotingSheet = React.lazy(() => import('@/components/discover/GroupVotingSheet'));
import { useUserSegment } from '@/contexts/UserSegmentContext';
import { useVoteSubscription } from '@/hooks/useVoteSubscription';
import type { GroupMember, Place, PlaceCategory, PlaceVote } from '@/lib/types';
import DiscoverModeSwitch, { type DiscoverMode } from '@/components/discover/DiscoverModeSwitch';
import { getDiscoverStyles } from '@/components/discover/discoverScreenStyles';
const ExploreMomentsFeed = React.lazy(() => import('@/components/discover/ExploreMomentsFeed'));

const DISCOVER_MODE_CACHE_KEY = 'discover_mode';
const EXPLORE_MOMENTS_LAUNCH_KEY = 'discover_mode_explore_launch_seen_v1';
const DISCOVER_DIAGNOSTICS_ENABLED = __DEV__ || process.env.EXPO_PUBLIC_ENABLE_INTERNAL_QA === 'true';

type ThemeColors = ReturnType<typeof useTheme>['colors'];

type PlaceDistanceEntry = {
  place: DiscoverPlace;
  distanceKm: number;
  blendedScore: number;
};

function logDiscoverDiagnostics(event: string, payload: Record<string, unknown>) {
  if (!DISCOVER_DIAGNOSTICS_ENABLED) return;
  console.info('[DiscoverDiagnostics]', event, {
    updateId: Updates.updateId?.slice(0, 8) ?? null,
    channel: Updates.channel ?? null,
    runtimeVersion: Updates.runtimeVersion ?? null,
    ...payload,
  });
}

// ── Main screen ─────────────────────────────────────────────────────────

export default function DiscoverScreenWrapper() {
  return (
    <TabErrorBoundary name="Discover">
      <DiscoverScreenInner />
    </TabErrorBoundary>
  );
}

function DiscoverScreenInner() {
  const { colors, mode } = useTheme();
  const styles = useMemo(() => getDiscoverStyles(colors), [colors]);
  const { segment, isTestMode, mockData } = useUserSegment();
  const testModeRef = useRef(isTestMode);
  testModeRef.current = isTestMode;

  // Discover mode: explore_moments vs plan (places/stays)
  const [discoverMode, setDiscoverMode] = useState<DiscoverMode>('explore_moments');
  // Restore persisted mode
  useEffect(() => {
    let mounted = true;
    Promise.all([
      cacheGet<string>(DISCOVER_MODE_CACHE_KEY, 0),
      cacheGet<boolean>(EXPLORE_MOMENTS_LAUNCH_KEY, 0),
    ]).then(([v, hasSeenExploreLaunch]) => {
      if (!mounted) return;
      if (!hasSeenExploreLaunch) {
        setDiscoverMode('explore_moments');
        cacheSet(DISCOVER_MODE_CACHE_KEY, 'explore_moments');
        cacheSet(EXPLORE_MOMENTS_LAUNCH_KEY, true);
        return;
      }
      if (v === 'explore_moments' || v === 'plan') {
        setDiscoverMode(v as DiscoverMode);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);
  const handleModeChange = useCallback((m: DiscoverMode) => {
    setDiscoverMode(m);
    cacheSet(DISCOVER_MODE_CACHE_KEY, m);
    cacheSet(EXPLORE_MOMENTS_LAUNCH_KEY, true);
  }, []);

  const [tab, setTab] = useState<TabId>('places');
  const [travelMode, setTravelMode] = useState<TravelMode>('walk');
  const [distanceOrigin, setDistanceOrigin] = useState<DistanceOrigin>('hotel');
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [saved, setSaved] = useState<Set<string>>(() => new Set());
  const [recommended, setRecommended] = useState<Set<string>>(() => new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterState>({ ...DEFAULT_FILTERS });
  const [q, setQ] = useState('');

  // Destination explorer (no-trip mode)
  const [exploreCoords, setExploreCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [exploreDest, setExploreDest] = useState('');
  const [exploreQuery, setExploreQuery] = useState('');
  const [exploreResults, setExploreResults] = useState<{ placeId: string; description: string }[]>([]);
  const [exploreFocused, setExploreFocused] = useState(false);
  const [originEditorOpen, setOriginEditorOpen] = useState(true);
  const [originRefinementText, setOriginRefinementText] = useState('');
  const [manualOriginKind, setManualOriginKind] = useState<DiscoverOriginKind>('none');
  const exploreTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exploreInputRef = useRef<TextInput>(null);

  // Wishlist (no-trip saves)
  const [wishlistItems, setWishlistItems] = useState<import('@/lib/types').WishlistItem[]>([]);

  // API-wired state
  const [tripId, setTripId] = useState<string | null>(null);
  const [tripCoords, setTripCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [places, setPlaces] = useState<readonly DiscoverPlace[]>([]);
  const [placesLoading, setPlacesLoading] = useState(false);
  const [placesError, setPlacesError] = useState<string | null>(null);
  const [nextPageToken, setNextPageToken] = useState<string | undefined>();
  const [loadingMore, setLoadingMore] = useState(false);
  const [savedPlaces, setSavedPlaces] = useState<Place[]>([]);
  const [savedLoading, setSavedLoading] = useState(false);
  const [placeCategoryChip, setPlaceCategoryChip] = useState<typeof PLACE_CATEGORY_CHIPS[number]>('Food');
  const [visibleCount, setVisibleCount] = useState(20);

  // PlaceDetailSheet state
  const [detailPlaceId, setDetailPlaceId] = useState<string | null>(null);
  const [detailPlaceName, setDetailPlaceName] = useState('');
  const [showDetail, setShowDetail] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const placesCache = useRef<Record<string, readonly DiscoverPlace[]>>({});

  const [tripDest, setTripDest] = useState('');
  const [tripStartDate, setTripStartDate] = useState<string | undefined>();
  const [tripEndDate, setTripEndDate] = useState<string | undefined>();
  const [tripDays, setTripDays] = useState<number | undefined>();
  const [tripHotel, setTripHotel] = useState('');
  const [tripGroupSize, setTripGroupSize] = useState(0);
  const [tripMembers, setTripMembers] = useState<GroupMember[]>([]);
  const [showVotingSheet, setShowVotingSheet] = useState(false);
  const [votingPlace, setVotingPlace] = useState<Place | null>(null);
  const { user } = useAuth();

  // React "reset state on prop change" — clear synchronously on auth change
  // so the previous account's wishlist, saved places, trip context, and
  // discover-feed never flash for a frame after switching accounts.
  const [accountBoundUserId, setAccountBoundUserId] = useState<string | undefined>(user?.id);
  if (accountBoundUserId !== user?.id) {
    setAccountBoundUserId(user?.id);
    setWishlistItems([]);
    setSavedPlaces([]);
    setPlaces([]);
    setTripId(null);
    setTripCoords(null);
    setTripDest('');
    setTripStartDate(undefined);
    setTripEndDate(undefined);
    setTripDays(undefined);
    setTripHotel('');
    setTripGroupSize(0);
    setTripMembers([]);
    setExploreCoords(null);
    setExploreDest('');
    setExploreQuery('');
    setExploreResults([]);
    setVisibleCount(20);
    setNextPageToken(undefined);
    placesCache.current = {};
  }
  const votableTripMembers = useMemo(
    () => tripMembers.filter((member) => !!member.userId),
    [tripMembers],
  );
  const currentMemberId = useMemo(
    () => votableTripMembers.find((m) => m.userId === user?.id)?.id ?? '',
    [votableTripMembers, user?.id],
  );
  const votableMemberCount = votableTripMembers.length;
  const canGroupVote = votableMemberCount >= 2 && !!currentMemberId;
  const memberNames = useMemo(
    () => Object.fromEntries(votableTripMembers.map((m) => [m.id, m.name])),
    [votableTripMembers],
  );

  // Stable vote-by-member lookup to prevent React.memo bail-outs
  const voteByMemberMap = useMemo(() => {
    const map: Record<string, Record<string, PlaceVote>> = {};
    for (const sp of savedPlaces) {
      if (sp.voteByMember) map[sp.name] = sp.voteByMember;
    }
    return map;
  }, [savedPlaces]);

  // Places awaiting group votes
  const pendingVotePlaces = useMemo(
    () => savedPlaces.filter((p) => {
      if (p.vote !== 'Pending') return false;
      const votes = p.voteByMember ?? {};
      return Object.keys(votes).length < votableMemberCount;
    }),
    [savedPlaces, votableMemberCount],
  );
  const votedPlaces = useMemo(
    () => savedPlaces.filter((p) => p.voteByMember && Object.keys(p.voteByMember).length > 0 && p.vote !== 'Pending'),
    [savedPlaces],
  );

  // Realtime vote updates from other members
  useVoteSubscription(tripId, useCallback(
    (placeId: string, voteByMember: Record<string, any>, vote: any) => {
      setSavedPlaces((prev) =>
        prev.map((p) => (p.id === placeId ? { ...p, voteByMember, vote } : p)),
      );
    },
    [],
  ));
  const [tripBudget, setTripBudget] = useState(0);
  const [tripBudgetCurrency, setTripBudgetCurrency] = useState('PHP');


  // Effective coords: active trip unless the user explicitly chooses GPS/exact place.
  const hasManualOrigin = manualOriginKind !== 'none' && !!exploreCoords;
  const effectiveCoords = hasManualOrigin ? exploreCoords : tripCoords ?? exploreCoords;
  const effectiveDest = hasManualOrigin ? exploreDest : tripDest || exploreDest;
  const effectiveOriginLabel = hasManualOrigin
    ? exploreDest
    : tripCoords
      ? (tripHotel || tripDest || 'Trip location')
      : exploreDest;
  const effectiveOriginKind: DiscoverOriginKind = hasManualOrigin
    ? manualOriginKind
    : tripCoords
    ? 'trip'
    : 'none';
  const hasUsableOrigin = !!effectiveCoords;
  const canShowPlaceResults = hasUsableOrigin && !originEditorOpen;

  // Compute distance from the selected origin (hotel or current location)
  const getDistanceKm = useCallback((placeLat?: number, placeLng?: number): number => {
    if (placeLat == null || placeLng == null) return 0;
    if (distanceOrigin === 'me' && userLocation) {
      return distanceFromPoint(userLocation.lat, userLocation.lng, placeLat, placeLng);
    }
    if (effectiveCoords) {
      return distanceFromPoint(effectiveCoords.lat, effectiveCoords.lng, placeLat, placeLng);
    }
    return 0;
  }, [distanceOrigin, userLocation, effectiveCoords]);

  // Fetch GPS when user switches to "me"
  const switchToMyLocation = useCallback(async () => {
    // Always re-fetch GPS so distances stay fresh as user moves
    try {
      const Location = require('expo-location') as typeof import('expo-location');
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Location denied', 'Enable location permissions in Settings to use "From Me".');
        setDistanceOrigin('hotel');
        return;
      }
      // Use High accuracy for better distance comparison vs hotel
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.LocationAccuracy.High });
      const coords = { lat: loc.coords.latitude, lng: loc.coords.longitude };
      setUserLocation(coords);
      setDistanceOrigin('me');
    } catch {
      Alert.alert('Location unavailable', 'Could not get your location. Using hotel distance.');
      setDistanceOrigin('hotel');
    }
  }, []);

  const handleAnchorChange = useCallback((a: 'hotel' | 'me') => {
    if (a === 'me') {
      switchToMyLocation();
    } else {
      setDistanceOrigin('hotel');
    }
    cacheSet('discover:anchor', a);
  }, [switchToMyLocation]);

  const handleTravelModeChange = useCallback((m: 'walk' | 'car') => {
    setTravelMode(m);
    cacheSet('discover:travelMode', m);
  }, []);

  const applyExploreOrigin = useCallback((
    label: string,
    coords: { lat: number; lng: number },
    kind: DiscoverOriginKind = 'selected_place',
  ) => {
    setExploreCoords(coords);
    setExploreDest(label);
    setExploreQuery(label);
    setManualOriginKind(kind);
    setOriginEditorOpen(false);
    setOriginRefinementText('');
    setQ('');
    setPlaceCategoryChip('Food');
    setVisibleCount(20);
    setShowFilters(false);
    placesCache.current = {};
  }, []);

  const chooseExploreDestination = useCallback(async (
    label: string,
    placeId?: string,
  ) => {
    const cleaned = label.trim();
    if (!cleaned) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Keyboard.dismiss();
    setExploreFocused(false);
    setExploreQuery(cleaned);
    setExploreResults([]);
    setOriginRefinementText('');
    setPlacesError(null);
    setPlacesLoading(true);
    try {
      const isBroadQuery = isBroadOriginQuery(cleaned);
      const best = placeId
        ? { placeId, description: cleaned }
        : (await placeAutocomplete(cleaned))[0];

      if (isBroadQuery && !best) {
        setExploreCoords(null);
        setExploreDest('');
        setManualOriginKind('none');
        setPlaces([]);
        setOriginRefinementText(originRefinementCopy(cleaned));
        return;
      }
      let loc = best ? await getPlaceLocation(best.placeId) : null;
      if (!loc) {
        const fallback = await searchPlace(best?.description ?? cleaned);
        if (fallback && fallback.lat != null && fallback.lng != null) {
          loc = { name: fallback.name, lat: fallback.lat, lng: fallback.lng };
        }
      }
      if (!loc) {
        const Location = require('expo-location') as typeof import('expo-location');
        const geocoded = await Location.geocodeAsync(best?.description ?? cleaned).catch(() => []);
        const first = geocoded[0];
        if (first) {
          loc = {
            name: best?.description.split(',')[0] ?? cleaned,
            lat: first.latitude,
            lng: first.longitude,
          };
        }
      }
      if (!loc) {
        const params = new URLSearchParams({
          format: 'json',
          limit: '1',
          q: best?.description ?? cleaned,
        });
        const res = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
          headers: {
            Accept: 'application/json',
            'User-Agent': 'AfterStay/1.3.0',
          },
        }).catch(() => null);
        const data = res?.ok ? await res.json().catch(() => []) : [];
        const first = Array.isArray(data) ? data[0] : null;
        const lat = Number(first?.lat);
        const lng = Number(first?.lon);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          loc = {
            name: best?.description.split(',')[0] ?? cleaned,
            lat,
            lng,
          };
        }
      }
      if (!loc) {
        setExploreCoords(null);
        setExploreDest('');
        setManualOriginKind('none');
        setPlaces([]);
        setOriginRefinementText('Could not find that exact place. Search a hotel, address, station, landmark, neighborhood, or exact pin.');
        return;
      } else {
        const shortLabel = best?.description.split(',')[0] ?? cleaned;
        applyExploreOrigin(shortLabel, { lat: loc.lat, lng: loc.lng }, 'selected_place');
      }
    } catch (err) {
      if (__DEV__) console.warn('[DiscoverScreen] choose destination failed:', err);
      setExploreCoords(null);
      setExploreDest('');
      setManualOriginKind('none');
      setPlaces([]);
      setOriginRefinementText('Could not find that exact place. Search a hotel, address, station, landmark, neighborhood, or exact pin.');
    } finally {
      setPlacesLoading(false);
    }
  }, [applyExploreOrigin]);

  const useCurrentLocationForExplore = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPlacesError(null);
    setPlacesLoading(true);
    try {
      const Location = require('expo-location') as typeof import('expo-location');
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setOriginEditorOpen(true);
        setOriginRefinementText('Enable location permission or search an exact place to find recommendations.');
        return;
      }
      const loc = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.LocationAccuracy.Balanced }),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 10000)),
      ]) ?? await Location.getLastKnownPositionAsync({
        maxAge: 10 * 60 * 1000,
        requiredAccuracy: 5000,
      });
      if (!loc) {
        setOriginEditorOpen(true);
        setOriginRefinementText('Current location is unavailable. Search an exact place instead.');
        return;
      }
      const coords = { lat: loc.coords.latitude, lng: loc.coords.longitude };
      setUserLocation(coords);
      applyExploreOrigin('Current location', coords, 'current_location');
      setDistanceOrigin('me');
    } catch (err) {
      if (__DEV__) console.warn('[DiscoverScreen] current location failed:', err);
      setOriginEditorOpen(true);
      setOriginRefinementText('Could not get your location. Search an exact place instead.');
    } finally {
      setPlacesLoading(false);
    }
  }, [applyExploreOrigin]);

  // Restore cached anchor/travel mode (after switchToMyLocation is defined)
  useEffect(() => {
    if (discoverMode !== 'plan') return;
    cacheGet<'hotel' | 'me'>('discover:anchor').then((v) => {
      if (v === 'me') {
        switchToMyLocation();
      } else if (v) {
        setDistanceOrigin(v);
      }
    });
    cacheGet<'walk' | 'car'>('discover:travelMode').then((v) => { if (v) setTravelMode(v); });
  }, [discoverMode, switchToMyLocation]);

  // Dev test mode: apply mock trip data
  useEffect(() => {
    if (!isTestMode || !mockData) return;
    if (mockData.trip) {
      setTripId(mockData.trip.id);
      setTripDest(destinationToLabel(mockData.trip.destination));
      setTripStartDate(mockData.trip.startDate);
      setTripEndDate(mockData.trip.endDate);
      setTripHotel(mockData.trip.accommodation ?? '');
      const lat = mockData.trip.hotelLat ?? mockData.trip.latitude;
      const lng = mockData.trip.hotelLng ?? mockData.trip.longitude;
      if (lat != null && lng != null) {
        setTripCoords({ lat, lng });
        setOriginEditorOpen(false);
      }
      setTripMembers(mockData.members);
      setTripGroupSize(Math.max(1, mockData.members.length));
    } else {
      setTripId(null);
      setTripCoords(null);
      setTripDest('');
      setTripMembers([]);
      setOriginEditorOpen(true);
    }
    setSavedPlaces(mockData.places as Place[]);
    setSaved(new Set(mockData.places.filter(p => p.saved !== false).map(p => p.name)));
  }, [isTestMode, segment, mockData]);

  // Re-fetch real data when test mode turns off
  const prevTestModeDiscover = useRef(isTestMode);
  useEffect(() => {
    if (prevTestModeDiscover.current && !isTestMode) {
      // force remount-like behavior
      setTripId(null);
      setTripCoords(null);
      setSavedPlaces([]);
      setPlaces([]);
    }
    prevTestModeDiscover.current = isTestMode;
  }, [isTestMode]);

  // Load trip ID on mount
  useEffect(() => {
    let cancelled = false;
    if (testModeRef.current || discoverMode !== 'plan') return;
    const load = async () => {
      try {
        const trip = await getActiveTrip();
        if (!cancelled && trip) {
          setTripId(trip.id);
          setTripDest(destinationToLabel(trip.destination));
          setTripStartDate(trip.startDate);
          setTripEndDate(trip.endDate);
          setTripHotel(trip.accommodation ?? '');
          // Prefer hotel coords (active trip), fall back to general lat/lng (past trip)
          const lat = trip.hotelLat ?? trip.latitude;
          const lng = trip.hotelLng ?? trip.longitude;
          if (lat != null && lng != null) {
            setTripCoords({ lat, lng });
            setOriginEditorOpen(false);
          } else {
            setTripCoords(null);
            setOriginEditorOpen(true);
          }
          setTripBudget(trip.budgetLimit ?? 0);
          setTripBudgetCurrency(trip.costCurrency ?? 'PHP');
          const members = await getGroupMembers(trip.id).catch(() => []);
          setTripGroupSize(Math.max(1, members.length));
          setTripMembers(members);
          // Default travel mode based on transport (car/bus → car, else walk)
          if (trip.transport === 'car' || trip.transport === 'bus') {
            const cached = await cacheGet<'walk' | 'car'>('discover:travelMode');
            if (!cached) setTravelMode('car');
          }
          if (trip.startDate && trip.endDate) {
            const ms = new Date(trip.endDate + 'T00:00:00+08:00').getTime() - new Date(trip.startDate + 'T00:00:00+08:00').getTime();
            setTripDays(Math.max(1, Math.ceil(ms / MS_PER_DAY) + 1));
          }
        }
      } catch (e) {
        if (__DEV__) console.warn('[DiscoverScreen] load trip context failed:', e);
      }
    };
    placesCache.current = {};
    load();
    return () => { cancelled = true; };
  }, [discoverMode]);

  // Load saved places when Saved tab is selected or tripId changes
  const loadWishlist = useCallback(async () => {
    if (tripId) return;
    try {
      const { getWishlist } = await import('@/lib/supabase');
      const items = await getWishlist().catch(() => []);
      setWishlistItems(items);
      setSaved(new Set(items.map((item) => item.name)));
    } catch (e) {
      if (__DEV__) console.warn('[DiscoverScreen] load wishlist failed:', e);
    }
  }, [tripId]);

  const loadSavedPlaces = useCallback(async () => {
    if (!tripId) return;
    setSavedLoading(true);
    try {
      const result = await getSavedPlaces(tripId);
      setSavedPlaces(result);
      setSaved(new Set(result.filter((p) => p.saved !== false).map((p) => p.name)));
    } catch (e) {
      if (__DEV__) console.warn('[DiscoverScreen] load saved places failed:', e);
    } finally {
      setSavedLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    if (discoverMode !== 'plan') return;
    if (tripId) loadSavedPlaces();
    else loadWishlist();
  }, [discoverMode, tripId, loadSavedPlaces, loadWishlist]);

  useEffect(() => {
    if (discoverMode !== 'plan') return;
    if (tab === 'saved' && tripId) {
      loadSavedPlaces();
    }
    if (tab === 'saved' && !tripId) {
      loadWishlist();
    }
  }, [discoverMode, tab, tripId, loadSavedPlaces, loadWishlist]);

  // Search places via Google Places API
  const searchPlaces = useCallback(async (keyword?: string, type?: string, skipCache = false, radius?: number) => {
    if (!canShowPlaceResults && keyword?.trim()) {
      setPlaces([]);
      setPlacesLoading(false);
      setPlacesError('Set a precise location or use current location before searching places.');
      return;
    }
    if (!canShowPlaceResults || !effectiveCoords) {
      setPlaces([]);
      setPlacesLoading(false);
      setPlacesError(null);
      return;
    }

    const cacheKey = `${type ?? ''}_${keyword ?? ''}_${effectiveCoords.lat}_${effectiveCoords.lng}`;

    // Use cache if available and not forced refresh
    if (!skipCache && placesCache.current[cacheKey]) {
      setPlaces(placesCache.current[cacheKey]);
      return;
    }

    setPlacesLoading(true);
    setPlacesError(null);
    try {
      const { places: results, nextPageToken: token, errorMessage } = await searchNearby(type, keyword, effectiveCoords, radius ?? DEFAULT_SEARCH_RADIUS);
      setNextPageToken(token);
      logDiscoverDiagnostics('searchPlaces', {
        origin: effectiveDest,
        coords: effectiveCoords,
        category: placeCategoryChip,
        keyword,
        type,
        radius: radius ?? DEFAULT_SEARCH_RADIUS,
        rawCount: results.length,
        errorMessage: errorMessage ?? null,
      });
      if (results.length > 0) {
        const mapped = results.map((p) => mapNearbyToDiscoverPlace(p, effectiveCoords ?? undefined));
        placesCache.current[cacheKey] = mapped;
        setPlaces(mapped);
      } else {
        setPlaces([]);
        setPlacesError(errorMessage ?? 'No results found nearby.');
      }
    } catch (err) {
      if (__DEV__) console.warn('[Discover] searchPlaces failed:', err);
      setPlaces([]);
      setPlacesError('Could not load places.');
    } finally {
      setPlacesLoading(false);
      setRefreshing(false);
    }
  }, [canShowPlaceResults, effectiveCoords, effectiveDest, placeCategoryChip]);

  // Load curated multi-category mix for the "All" chip
  const loadAllView = useCallback(async (skipCache = false) => {
    if (!canShowPlaceResults || !effectiveCoords) { setPlaces([]); return; }

    const cacheKey = `all_multi_${effectiveCoords.lat}_${effectiveCoords.lng}`;
    if (!skipCache && placesCache.current[cacheKey]) {
      setPlaces(placesCache.current[cacheKey]);
      return;
    }

    setPlacesLoading(true);
    setPlacesError(null);
    try {
      const { places: results } = await searchMultiCategory(effectiveCoords);
      logDiscoverDiagnostics('loadAllView', {
        origin: effectiveDest,
        coords: effectiveCoords,
        rawCount: results.length,
      });
      if (results.length > 0) {
        const mapped = results.map((p) => mapNearbyToDiscoverPlace(p, effectiveCoords));
        placesCache.current[cacheKey] = mapped;
        setPlaces(mapped);
      } else {
        setPlaces([]);
        setPlacesError('No results found nearby.');
      }
      setNextPageToken(undefined);
    } catch (err) {
      if (__DEV__) console.warn('[Discover] loadAllView failed:', err);
      setPlaces([]);
      setPlacesError('Could not load places.');
    } finally {
      setPlacesLoading(false);
      setRefreshing(false);
    }
  }, [canShowPlaceResults, effectiveCoords, effectiveDest]);

  // Load places when category chip changes
  useEffect(() => {
    if (discoverMode !== 'plan') return;
    if (tab !== 'places') return;
    if (!canShowPlaceResults) {
      setPlaces([]);
      setPlacesError(null);
      setPlacesLoading(false);
      return;
    }
    if (placeCategoryChip === 'All') {
      loadAllView();
    } else {
      const chipKey = placeCategoryChip.toLowerCase();
      const searchConfig = CATEGORY_SEARCH_MAP[chipKey];
      const categoryRadius = CATEGORY_RADIUS_MAP[chipKey] ?? DEFAULT_SEARCH_RADIUS;
      searchPlaces(searchConfig?.keyword ?? chipKey, searchConfig?.type, false, categoryRadius);
    }
  }, [discoverMode, placeCategoryChip, tab, searchPlaces, loadAllView, canShowPlaceResults]);

  // Debounced search input
  useEffect(() => {
    if (discoverMode !== 'plan') return;
    if (tab !== 'places') return;
    if (!q.trim()) {
      // Reset to category-based search when query is cleared
      if (canShowPlaceResults && placeCategoryChip === 'All') {
        loadAllView();
      }
      return;
    }
    if (!canShowPlaceResults) {
      setPlaces([]);
      setPlacesError('Set a precise location or use current location before searching places.');
      return;
    }
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      searchPlaces(q.trim());
    }, 500);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [discoverMode, q, tab, placeCategoryChip, searchPlaces, canShowPlaceResults, loadAllView]);

  const savePlaceToWishlist = useCallback(async (placeData: DiscoverPlace) => {
    const { addToWishlist, getWishlist } = await import('@/lib/supabase');
    await addToWishlist({
      name: placeData.n,
      category: placeData.types ? resolveCategory(placeData.types) : undefined,
      googlePlaceId: placeData.placeId,
      photoUrl: placeData.img,
      rating: placeData.r,
      totalRatings: placeData.totalRatings,
      latitude: placeData.lat,
      longitude: placeData.lng,
      destination: effectiveDest || undefined,
    });
    setWishlistItems(await getWishlist());
  }, [effectiveDest]);

  const toggleSave = useCallback(async (name: string) => {
    // Optimistic local update
    const wasSaved = saved.has(name);
    setSaved((s) => {
      const next = new Set(s);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Persist to Supabase
    if (tripId) {
      // Save to trip
      const existingPlace = savedPlaces.find((p) => p.name === name);
      if (existingPlace) {
        try {
          await savePlace(existingPlace.id, !existingPlace.saved);
        } catch {
          Alert.alert('Error', 'Something went wrong. Please try again.');
          setSaved((s) => {
            const next = new Set(s);
            if (existingPlace.saved) next.add(name);
            else next.delete(name);
            return next;
          });
        }
      } else {
        const placeData = places.find((p) => p.n === name);
        if (placeData) {
          try {
            await addPlace({
              tripId,
              name: placeData.n,
              category: (placeData.types ? resolveCategory(placeData.types) : 'Do') as PlaceCategory,
              distance: placeData.d,
              rating: placeData.r,
              source: 'Manual',
              vote: 'Pending' as PlaceVote,
              photoUrl: placeData.img,
              googlePlaceId: placeData.placeId,
              latitude: placeData.lat,
              longitude: placeData.lng,
              totalRatings: placeData.totalRatings,
              saved: true,
            });
          } catch {
            Alert.alert('Error', 'Something went wrong. Please try again.');
            setSaved((s) => { const next = new Set(s); next.delete(name); return next; });
          }
        }
      }
    } else {
      // No trip — save to wishlist
      if (wasSaved) {
        try {
          const existing = wishlistItems.find((item) => item.name === name);
          if (existing) {
            const { removeFromWishlist } = await import('@/lib/supabase');
            await removeFromWishlist(existing.id);
            setWishlistItems((prev) => prev.filter((item) => item.id !== existing.id));
          }
        } catch {
          Alert.alert('Error', 'Something went wrong. Please try again.');
          setSaved((s) => { const next = new Set(s); next.add(name); return next; });
        }
        return;
      }
      const placeData = places.find((p) => p.n === name);
      if (placeData) {
        try {
          await savePlaceToWishlist(placeData);
        } catch {
          Alert.alert('Error', 'Something went wrong. Please try again.');
          setSaved((s) => { const next = new Set(s); next.delete(name); return next; });
        }
      }
    }
  }, [tripId, savedPlaces, places, saved, wishlistItems, savePlaceToWishlist]);

  const toggleRecommend = useCallback(async (name: string) => {
    // Optimistic local update
    setRecommended((s) => {
      const next = new Set(s);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Persist to Supabase as a suggested place
    if (!tripId) return;
    const existingPlace = savedPlaces.find((p) => p.name === name);
    if (existingPlace) {
      try {
        await voteOnPlace(existingPlace.id, '\uD83D\uDC4D Yes' as PlaceVote);
        // Record member vote and notify group
        if (canGroupVote) {
          const updated = await voteAsMember(existingPlace.id, currentMemberId, '👍 Yes' as PlaceVote, votableMemberCount);
          setSavedPlaces((prev) => prev.map((p) => (p.id === existingPlace.id ? { ...p, voteByMember: updated } : p)));
          if (tripId && user) {
            notifyGroupOfRecommendation(tripId, name, existingPlace.id, user.user_metadata?.name ?? 'Someone', user.id).catch(() => {});
          }
          setVotingPlace({ ...existingPlace, voteByMember: updated });
          setShowVotingSheet(true);
        }
      } catch {
        Alert.alert('Error', 'Something went wrong. Please try again.');
        setRecommended((s) => {
          const next = new Set(s);
          next.delete(name);
          return next;
        });
      }
    } else {
      const placeData = places.find((p) => p.n === name);
      if (placeData) {
        try {
          await addPlace({
            tripId,
            name: placeData.n,
            category: (placeData.types ? resolveCategory(placeData.types) : 'Do') as PlaceCategory,
            distance: placeData.d,
            rating: placeData.r,
            source: 'Suggested',
            vote: '\uD83D\uDC4D Yes' as PlaceVote,
            photoUrl: placeData.img,
            googlePlaceId: placeData.placeId,
            latitude: placeData.lat,
            longitude: placeData.lng,
            totalRatings: placeData.totalRatings,
            saved: true,
          });
        } catch {
          Alert.alert('Error', 'Something went wrong. Please try again.');
          setRecommended((s) => {
            const next = new Set(s);
            next.delete(name);
            return next;
          });
        }
      }
    }
  }, [tripId, savedPlaces, places, canGroupVote, currentMemberId, votableMemberCount, user]);

  // Stable callbacks so DiscoverPlaceCard React.memo actually works
  const handleSaveToggle = useCallback((name: string) => {
    toggleSave(name);
  }, [toggleSave]);

  const handleSavePlaceCard = useCallback(async (placeData: DiscoverPlace) => {
    if (tripId) {
      toggleSave(placeData.n);
      return;
    }

    const wasSaved = saved.has(placeData.n);
    setSaved((s) => {
      const next = new Set(s);
      if (wasSaved) next.delete(placeData.n);
      else next.add(placeData.n);
      return next;
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      if (wasSaved) {
        const existing = wishlistItems.find((item) => item.name === placeData.n);
        if (existing) {
          const { removeFromWishlist } = await import('@/lib/supabase');
          await removeFromWishlist(existing.id);
          setWishlistItems((prev) => prev.filter((item) => item.id !== existing.id));
        }
      } else {
        await savePlaceToWishlist(placeData);
      }
    } catch {
      Alert.alert('Error', 'Something went wrong. Please try again.');
      setSaved((s) => {
        const next = new Set(s);
        if (wasSaved) next.add(placeData.n);
        else next.delete(placeData.n);
        return next;
      });
    }
  }, [tripId, toggleSave, saved, wishlistItems, savePlaceToWishlist]);

  const handleRecommendToggle = useCallback((name: string) => {
    toggleRecommend(name);
  }, [toggleRecommend]);

  const handleVoteTap = useCallback((placeName: string) => {
    const sp = savedPlaces.find((s) => s.name === placeName);
    if (sp) {
      setVotingPlace(sp);
      setShowVotingSheet(true);
    }
  }, [savedPlaces]);

  // Generate itinerary via Anthropic

  const voteCountsByName = useMemo(() => new globalThis.Map(
    savedPlaces.map((p) => [p.name, Object.keys(p.voteByMember ?? {}).length]),
  ), [savedPlaces]);
  const placeFilterMetadata = useMemo(() => ({
    savedNames: saved,
    recommendedNames: recommended,
    voteCountsByName,
    memberCount: votableMemberCount,
  }), [saved, recommended, voteCountsByName, votableMemberCount]);

  const activeFilterCount = useMemo(() => countActivePlaceFilters(filters), [filters]);
  const filteredPlaces = useMemo(
    () => applyPlaceFilters(places, filters, placeFilterMetadata),
    [places, filters, placeFilterMetadata],
  );


  const sortPlaceDistanceEntries = useCallback((entries: PlaceDistanceEntry[]) => entries.sort((a, b) => {
    const openA = a.place.openNow ? 0 : 1;
    const openB = b.place.openNow ? 0 : 1;
    if (openA !== openB) return openA - openB;
    if (filters.sortMode === 'distance') {
      return a.distanceKm - b.distanceKm;
    }
    if (filters.sortMode === 'rating') {
      return (b.place.r ?? 0) - (a.place.r ?? 0);
    }
    if (filters.sortMode === 'popular') {
      return (b.place.totalRatings ?? 0) - (a.place.totalRatings ?? 0);
    }
    return b.blendedScore - a.blendedScore;
  }), [filters.sortMode]);

  const addDistanceToPlaces = useCallback((list: readonly DiscoverPlace[]) => list.map((p) => {
    const distanceKm = getDistanceKm(p.lat, p.lng);
    const qualityScore = (p.r ?? 0) * Math.log10(Math.max(p.totalRatings ?? 1, 1));
    const blendedScore = qualityScore - (distanceKm * 0.3);
    return { place: p, distanceKm, blendedScore };
  }), [getDistanceKm]);

  const allPlacesWithDistance = useMemo(
    () => sortPlaceDistanceEntries(addDistanceToPlaces(places)),
    [places, addDistanceToPlaces, sortPlaceDistanceEntries],
  );

  // Pre-compute distances, filter nearby, sort by quality-weighted score.
  const placesWithDistance = useMemo(() => {
    const withDist = addDistanceToPlaces(filteredPlaces);
    const nearbyRadius = travelMode === 'car' ? 10 : 2;
    const filtered = filters.nearby && hasUsableOrigin
      ? withDist.filter((p) => p.distanceKm > 0 && p.distanceKm <= nearbyRadius)
      : withDist;
    return sortPlaceDistanceEntries(filtered);
  }, [filteredPlaces, addDistanceToPlaces, filters.nearby, hasUsableOrigin, travelMode, sortPlaceDistanceEntries]);

  const canRelaxPlaceFilters = (
    filters.nearby ||
    filters.openNow ||
    filters.minRating > 0 ||
    filters.maxPrice < DEFAULT_FILTERS.maxPrice
  ) && !filters.savedOnly && !filters.recommendedOnly && !filters.needsVotesOnly;
  const minimumUsefulResults = Math.min(3, allPlacesWithDistance.length);
  const filtersRelaxedForResults = canShowPlaceResults &&
    canRelaxPlaceFilters &&
    allPlacesWithDistance.length > 0 &&
    placesWithDistance.length < minimumUsefulResults;
  const visiblePlacesWithDistance = useMemo(
    () => (canShowPlaceResults
      ? (filtersRelaxedForResults ? allPlacesWithDistance : placesWithDistance)
      : []),
    [allPlacesWithDistance, canShowPlaceResults, filtersRelaxedForResults, placesWithDistance],
  );
  const displayPlaces = useMemo(() => visiblePlacesWithDistance.map(({ place }) => place), [visiblePlacesWithDistance]);
  const hasLoadedPlaceResults = canShowPlaceResults && !placesLoading && !placesError && visiblePlacesWithDistance.length > 0;

  useEffect(() => {
    logDiscoverDiagnostics('filterResults', {
      origin: effectiveDest,
      category: placeCategoryChip,
      rawCount: places.length,
      filteredCount: placesWithDistance.length,
      visibleCount: visiblePlacesWithDistance.length,
      relaxed: filtersRelaxedForResults,
      activeFilterCount,
      filters,
    });
  }, [activeFilterCount, effectiveDest, filters, filtersRelaxedForResults, placeCategoryChip, places.length, placesWithDistance.length, visiblePlacesWithDistance.length]);

  const toggleShowFilters = useCallback(() => setShowFilters((s) => !s), []);

  const placesEmptyText = useMemo(() => {
    if (!hasUsableOrigin) return 'Set a precise location or use current location before searching.';
    if (filters.nearby) return 'No walkable places found. Try Any distance.';
    if (filters.openNow) return 'No open places found. Try All availability.';
    if (filters.savedOnly) return 'No saved ideas match this view yet.';
    if (filters.recommendedOnly) return 'No group recommendations match this view yet.';
    if (filters.needsVotesOnly) return 'No places need votes right now.';
    return 'No places match these filters.';
  }, [filters.nearby, filters.needsVotesOnly, filters.openNow, filters.recommendedOnly, filters.savedOnly, hasUsableOrigin]);

  const handleExplore = useCallback((placeId: string | undefined, name: string) => {
    setDetailPlaceId(placeId ?? null);
    setDetailPlaceName(name);
    setShowDetail(true);
  }, []);

  // FlatList renderItem for Places tab — stable ref prevents re-renders
  const renderPlaceItem = useCallback(({ item }: { item: PlaceDistanceEntry }) => {
    const p = item.place;
    return (
      <DiscoverPlaceCard
        place={p}
        distanceKm={item.distanceKm}
        travelMode={travelMode}
        isSaved={saved.has(p.n)}
        isRecommended={recommended.has(p.n)}
        onSave={handleSaveToggle}
        onRecommend={handleRecommendToggle}
        saveActionLabel={tripId ? 'Save to trip' : 'Save for later'}
        onExplore={handleExplore}
        onAddToPlanner={undefined}
        showRecommend={canGroupVote}
        voteByMember={voteByMemberMap[p.n]}
        memberNames={memberNames}
        totalMembers={votableMemberCount}
        onVoteTap={handleVoteTap}
      />
    );
  }, [travelMode, saved, recommended, handleSaveToggle, handleRecommendToggle, handleExplore, canGroupVote, voteByMemberMap, memberNames, votableMemberCount, handleVoteTap, tripId]);

  const CARD_HEIGHT = canGroupVote ? 154 : 128;

  const getPlaceLayout = useCallback((_: any, index: number) => ({
    length: CARD_HEIGHT,
    offset: CARD_HEIGHT * index,
    index,
  }), [CARD_HEIGHT]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style={mode === 'light' ? 'dark' : 'light'} />
      {/* Top bar */}
      <View style={styles.topBar}>
        <View>
          <Text style={styles.title}>Discover</Text>
          {canShowPlaceResults && effectiveOriginLabel && discoverMode !== 'explore_moments' ? <Text style={styles.subtitle}>{effectiveOriginLabel}</Text> : null}
        </View>
      </View>

      {/* Mode switch: Explore Moments / Find Places & Food */}
      <DiscoverModeSwitch mode={discoverMode} onModeChange={handleModeChange} />

      {/* ═══════ EXPLORE MOMENTS MODE ═══════ */}
      {discoverMode === 'explore_moments' && (
        <Suspense fallback={<MiniLoader />}>
          <ExploreMomentsFeed />
        </Suspense>
      )}

      {/* ═══════ PLAN MODE (existing Discover) ═══════ */}
      {discoverMode === 'plan' && <>

      <View style={styles.precisionOriginWrap}>
        <Text style={styles.precisionTitle}>Find Places & Food</Text>
        {!canShowPlaceResults ? (
          <View style={styles.precisionPanel}>
            <View style={styles.originChoiceRow}>
              <View style={[styles.originChoiceBtn, styles.originChoiceBtnActive]}>
                <MapPin size={16} color={colors.black} strokeWidth={2.2} />
                <Text style={[styles.originChoiceText, styles.originChoiceTextActive]}>Set precise location</Text>
              </View>
              <TouchableOpacity
                style={styles.originChoiceBtn}
                activeOpacity={0.75}
                onPress={useCurrentLocationForExplore}
              >
                <Navigation size={15} color={colors.accent} strokeWidth={2} />
                <Text style={styles.originChoiceText}>Current location</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.precisionInputBox}>
              <Search size={17} color={colors.text3} strokeWidth={1.8} />
              <TextInput
                ref={exploreInputRef}
                value={exploreQuery}
                onFocus={() => setExploreFocused(true)}
                onBlur={() => setTimeout(() => setExploreFocused(false), 120)}
                onChangeText={(text) => {
                  setExploreQuery(text);
                  setOriginRefinementText('');
                  if (exploreTimer.current) clearTimeout(exploreTimer.current);
                  if (text.trim().length < 2) { setExploreResults([]); return; }
                  exploreTimer.current = setTimeout(async () => {
                    const results = await placeAutocomplete(text);
                    setExploreResults(results);
                  }, 300);
                }}
                onSubmitEditing={() => chooseExploreDestination(exploreQuery)}
                placeholder="Accommodation, address, landmark, Airbnb, or exact pin"
                placeholderTextColor={colors.text3}
                style={styles.searchInput}
                returnKeyType="search"
                autoCorrect={false}
                spellCheck={false}
                autoCapitalize="words"
              />
            </View>
            {exploreFocused && exploreQuery.trim().length >= 2 && (
              <View style={styles.destDropdown}>
                <TouchableOpacity
                  style={styles.destRow}
                  onPressIn={() => chooseExploreDestination(exploreQuery)}
                  activeOpacity={0.7}
                >
                  <Search size={14} color={colors.accent} strokeWidth={2} />
                  <Text style={[styles.destRowText, { color: colors.text }]} numberOfLines={1}>
                    Use "{exploreQuery.trim()}" as search origin
                  </Text>
                </TouchableOpacity>
                {exploreResults.slice(0, 5).map((r) => (
                  <TouchableOpacity
                    key={r.placeId}
                    style={styles.destRow}
                    onPressIn={() => chooseExploreDestination(r.description, r.placeId)}
                    activeOpacity={0.7}
                  >
                    <MapPin size={14} color={colors.text3} />
                    <Text style={styles.destRowText} numberOfLines={1}>{r.description}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            <Text style={[styles.precisionHint, originRefinementText && { color: colors.danger }]}>
              {originRefinementText || 'For accurate recommendations, choose an exact place or use current GPS.'}
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.originStatusStrip}>
              <MapPin size={16} color={colors.accent} strokeWidth={2} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.originStatusLabel}>Searching near</Text>
                <Text style={styles.originStatusValue} numberOfLines={1}>{effectiveOriginLabel}</Text>
              </View>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => {
                  Haptics.selectionAsync();
                  setOriginEditorOpen(true);
                  setExploreCoords(null);
                  setExploreDest('');
                  setExploreQuery('');
                  setExploreResults([]);
                  setManualOriginKind('none');
                  setPlaces([]);
                  setPlacesError(null);
                  setShowFilters(false);
                }}
              >
                <Text style={styles.originChangeText}>Change</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.precisionInputBox}>
              <Search size={17} color={colors.text3} strokeWidth={1.8} />
              <TextInput
                value={q}
                onChangeText={setQ}
                placeholder="Search food, coffee, things to do..."
                placeholderTextColor={colors.text3}
                style={styles.searchInput}
                returnKeyType="search"
                autoCorrect={false}
                spellCheck={false}
                autoCapitalize="none"
              />
            </View>
            <View style={styles.primaryFilterRow}>
              {PRIMARY_PLACE_CATEGORY_CHIPS.map((chip) => {
                const active = placeCategoryChip === chip;
                const label = chip === 'Activity' ? 'Things to do' : chip;
                return (
                  <TouchableOpacity
                    key={chip}
                    style={[styles.primaryFilterChip, active && styles.primaryFilterChipActive]}
                    activeOpacity={0.72}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setPlaceCategoryChip(chip);
                      setQ('');
                      setVisibleCount(20);
                    }}
                  >
                    <Text style={[styles.primaryFilterText, active && styles.primaryFilterTextActive]}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity
                onPress={toggleShowFilters}
                style={[
                  styles.moreFiltersBtn,
                  activeFilterCount > 0 && { borderColor: colors.accent, backgroundColor: colors.accentBg },
                ]}
                activeOpacity={0.72}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={activeFilterCount > 0 ? `More filters, ${activeFilterCount} active` : 'More filters'}
              >
                <Filter size={17} color={activeFilterCount > 0 ? colors.accent : colors.text2} strokeWidth={2.2} />
                {activeFilterCount > 0 ? (
                  <View style={styles.filterCountBadge}>
                    <Text style={styles.filterCountText}>{activeFilterCount}</Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            </View>
            {showFilters ? (
              <PlaceFilterPanel
                colors={colors}
                styles={styles}
                filters={filters}
                distanceOrigin={distanceOrigin}
                travelMode={travelMode}
                onFiltersChange={setFilters}
                onAnchorChange={handleAnchorChange}
                onTravelModeChange={handleTravelModeChange}
                onClose={() => setShowFilters(false)}
              />
            ) : null}
          </>
        )}
      </View>

      {/* Segmented control */}
      <View style={styles.segWrapper}>
        <View style={styles.seg}>
          {(['places', 'stays', ...(tripId ? ['concierge' as const] : []), 'saved'] as TabId[]).map((id) => {
            const label =
              id === 'places' ? 'Places'
              : id === 'stays' ? 'Stays'
              : id === 'concierge' ? '\u2728 AI'
              : tripId ? `Saved${saved.size ? ` \u00B7 ${saved.size}` : ''}` : `Saved Ideas${wishlistItems.length ? ` \u00B7 ${wishlistItems.length}` : ''}`;
            return (
              <TouchableOpacity
                key={id}
                style={[styles.segBtn, tab === id && styles.segBtnActive]}
                onPress={() => setTab(id)}
                activeOpacity={0.7}
              >
                <Text style={[styles.segText, tab === id && styles.segTextActive]}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* ═══════ PLACES TAB (FlatList for virtualization) ═══════ */}
      {tab === 'places' && (
        <FlatList
          data={visiblePlacesWithDistance.slice(0, visibleCount)}
          keyExtractor={(item) => item.place.placeId ?? item.place.n}
          renderItem={renderPlaceItem}
          getItemLayout={getPlaceLayout}
          removeClippedSubviews={true}
          initialNumToRender={6}
          maxToRenderPerBatch={6}
          windowSize={5}
          contentContainerStyle={{ paddingBottom: 100 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                placesCache.current = {};
                if (placeCategoryChip === 'All') {
                  loadAllView(true);
                } else {
                  const chipKey = placeCategoryChip.toLowerCase();
                  const search = CATEGORY_SEARCH_MAP[chipKey];
                  const categoryRadius = CATEGORY_RADIUS_MAP[chipKey] ?? DEFAULT_SEARCH_RADIUS;
                  searchPlaces(search?.keyword, search?.type, true, categoryRadius);
                }
              }}
              tintColor={colors.accent}
            />
          }
          ListHeaderComponent={
            <>
              {/* Results count */}
              {canShowPlaceResults ? (
                <Text style={styles.resultsCount}>
                  Recommended nearby · {visiblePlacesWithDistance.length} {visiblePlacesWithDistance.length === 1 ? 'place' : 'places'}
                </Text>
              ) : null}

              {filtersRelaxedForResults ? (
                <View style={styles.emptyPlaces}>
                  <Text style={styles.emptyText}>
                    Filters narrowed this too much. Showing all nearby instead.
                  </Text>
                </View>
              ) : null}

              {placesError && (
                <View style={styles.emptyPlaces}>
                  <Text style={styles.errorText}>{placesError}</Text>
                </View>
              )}
              {placesLoading && (
                <View style={styles.emptyPlaces}>
                  <MiniLoader message="Finding places..." />
                </View>
              )}
              {canShowPlaceResults && !placesLoading && !placesError && visiblePlacesWithDistance.length === 0 && (
                <View style={styles.emptyPlaces}>
                  <Text style={styles.emptyText}>
                    {placesEmptyText}
                  </Text>
                </View>
              )}
            </>
          }
          ListFooterComponent={
            <>
              {visiblePlacesWithDistance.length > visibleCount ? (
                <TouchableOpacity
                  style={styles.showMoreBtn}
                  onPress={() => setVisibleCount((c) => c + 20)}
                  activeOpacity={0.7}
                >
                  <ChevronDown size={16} color={colors.accent} strokeWidth={2} />
                  <Text style={styles.showMoreText}>
                    Show more ({visiblePlacesWithDistance.length - visibleCount} remaining)
                  </Text>
                </TouchableOpacity>
              ) : nextPageToken ? (
                <TouchableOpacity
                  style={styles.showMoreBtn}
                  disabled={loadingMore}
                  onPress={async () => {
                    setLoadingMore(true);
                    try {
                      // Google requires ~2s before page token is valid
                      await new Promise((r) => setTimeout(r, 2000));
                      const { places: more, nextPageToken: token } = await searchNearbyPage(nextPageToken);
                      setNextPageToken(token);
                      if (more.length > 0) {
                        const mapped = more.map((p) => mapNearbyToDiscoverPlace(p, effectiveCoords ?? undefined));
                        setPlaces((prev) => [...prev, ...mapped]);
                        setVisibleCount((c) => c + more.length);
                      }
                    } catch (err) {
                      if (__DEV__) console.warn('[Discover] load more failed:', err);
                      setNextPageToken(undefined);
                    } finally {
                      setLoadingMore(false);
                    }
                  }}
                  activeOpacity={0.7}
                >
                  {loadingMore ? (
                    <ActivityIndicator size="small" color={colors.accent} />
                  ) : (
                    <ChevronDown size={16} color={colors.accent} strokeWidth={2} />
                  )}
                  <Text style={styles.showMoreText}>
                    {loadingMore ? 'Loading more places...' : 'Load more places'}
                  </Text>
                </TouchableOpacity>
              ) : null}
              {hasLoadedPlaceResults && placeCategoryChip === 'All' && !q ? (
                <>
                  <TopPicksSection places={displayPlaces} onExplore={handleExplore} distFn={getDistanceKm} />
                  <TopPicksByCategorySection places={displayPlaces} onExplore={handleExplore} distFn={getDistanceKm} />
                </>
              ) : null}
            </>
          }
        />
      )}

      {/* ═══════ CONCIERGE + SAVED TABS (ScrollView) ═══════ */}
      {(tab === 'concierge' || tab === 'saved') && (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* ═══════ AI CONCIERGE TAB ═══════ */}
          {tab === 'concierge' && (
            <Suspense fallback={<MiniLoader />}>
            <AIConcierge
              tripId={tripId}
              tripDest={tripDest}
              tripCoords={tripCoords}
              originCoords={effectiveCoords}
              originLabel={effectiveOriginLabel}
              tripHotel={tripHotel}
              tripGroupSize={tripGroupSize}
              tripMembers={votableTripMembers}
              tripBudget={tripBudget}
              tripBudgetCurrency={tripBudgetCurrency}
              savedNames={saved}
              travelMode={travelMode}
              onSavePlace={(name) => {
                setSaved((s) => { const next = new Set(s); next.add(name); return next; });
              }}
              onOpenDetail={handleExplore}
            />
            </Suspense>
          )}

          {/* ═══════ SAVED / WISHLIST TAB ═══════ */}
          {tab === 'saved' && !tripId && (
            <View style={styles.placeList}>
              {wishlistItems.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Bookmark size={28} color={colors.text3} strokeWidth={1.6} opacity={0.6} />
                  <Text style={styles.emptyCardTitle}>No saved ideas yet</Text>
                  <Text style={styles.emptyCardBody}>
                    Set a precise location or use current location, then bookmark places to save them for later.
                  </Text>
                </View>
              ) : (
                <>
                  <Text style={styles.wishlistHeader}>
                    {wishlistItems.length} saved {wishlistItems.length === 1 ? 'place' : 'places'}
                  </Text>
                  {wishlistItems.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      style={styles.wishlistRow}
                      onPress={() => {
                        if (item.googlePlaceId) {
                          setDetailPlaceId(item.googlePlaceId);
                          setDetailPlaceName(item.name);
                          setShowDetail(true);
                        }
                      }}
                      onLongPress={() => {
                        Alert.alert('Remove saved idea?', item.name, [
                          { text: 'Keep', style: 'cancel' },
                          {
                            text: 'Remove',
                            style: 'destructive',
                            onPress: async () => {
                              const { removeFromWishlist } = await import('@/lib/supabase');
                              await removeFromWishlist(item.id).catch(() => {});
                              setWishlistItems((prev) => prev.filter((w) => w.id !== item.id));
                              setSaved((s) => { const next = new Set(s); next.delete(item.name); return next; });
                            },
                          },
                        ]);
                      }}
                      activeOpacity={0.7}
                    >
                      {item.photoUrl ? (
                        <Image source={{ uri: item.photoUrl }} style={styles.wishlistThumb} />
                      ) : (
                        <View style={[styles.wishlistThumb, styles.wishlistThumbFallback]}>
                          <MapPin size={18} color={colors.text3} />
                        </View>
                      )}
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.wishlistName} numberOfLines={1}>{item.name}</Text>
                        {item.destination && <Text style={styles.wishlistDest} numberOfLines={1}>{item.destination}</Text>}
                        {item.rating != null && (
                          <Text style={styles.wishlistRating}>{'\u2605'} {item.rating.toFixed(1)}</Text>
                        )}
                      </View>
                      <Bookmark size={16} color={colors.accent} fill={colors.accent} />
                    </TouchableOpacity>
                  ))}
                </>
              )}
            </View>
          )}
          {tab === 'saved' && tripId && (
            <View style={styles.placeList}>
              {savedLoading ? (
                <View style={styles.emptyPlaces}>
                  <MiniLoader message="Loading saved places..." />
                </View>
              ) : savedPlaces.length === 0 && saved.size === 0 ? (
                <View style={styles.emptyCard}>
                  <Bookmark size={28} color={colors.text3} strokeWidth={1.6} opacity={0.6} />
                  <Text style={styles.emptyCardTitle}>No saved places yet</Text>
                  <Text style={styles.emptyCardBody}>
                    Tap the bookmark on a place to save it here.
                  </Text>
                </View>
              ) : (
                <>
                  {/* ── Group Voting Section ── */}
                  {votableMemberCount >= 2 && (
                    <View style={styles.votingSection}>
                      <View style={styles.votingSectionHeader}>
                        <Users size={16} color={colors.accent} strokeWidth={2} />
                        <Text style={styles.votingSectionTitle}>Group Voting</Text>
                        {pendingVotePlaces.length > 0 && (
                          <View style={styles.votingBadge}>
                            <Text style={styles.votingBadgeText}>{pendingVotePlaces.length} pending</Text>
                          </View>
                        )}
                      </View>

                      {/* Empty state for groups with no votes yet */}
                      {pendingVotePlaces.length === 0 && votedPlaces.length === 0 && (
                        <View style={styles.votingEmpty}>
                          <ThumbsUp size={20} color={colors.text3} strokeWidth={1.6} />
                          <Text style={styles.votingEmptyTitle}>No places to vote on yet</Text>
                          <Text style={styles.votingEmptyBody}>
                            Tap the {'\u{1F465}'} icon on any place in the Places tab to recommend it to your group.
                          </Text>
                        </View>
                      )}

                      {pendingVotePlaces.length > 0 && (
                        <>
                          <Text style={styles.votingSubhead}>Needs your vote</Text>
                          {pendingVotePlaces.map((p) => {
                            const votes = p.voteByMember ?? {};
                            const yes = Object.values(votes).filter((v) => v === '👍 Yes').length;
                            const voted = Object.keys(votes).length;
                            return (
                              <TouchableOpacity
                                key={p.id}
                                style={styles.votingRow}
                                activeOpacity={0.7}
                                onPress={() => { setVotingPlace(p); setShowVotingSheet(true); }}
                              >
                                {p.photoUrl ? (
                                  <Image source={{ uri: p.photoUrl }} style={styles.votingThumb} />
                                ) : (
                                  <View style={[styles.votingThumb, { backgroundColor: colors.bg3, justifyContent: 'center', alignItems: 'center' }]}>
                                    <ThumbsUp size={14} color={colors.text3} />
                                  </View>
                                )}
                                <View style={styles.votingInfo}>
                                  <Text style={styles.votingName} numberOfLines={1}>{p.name}</Text>
                                  <Text style={styles.votingMeta}>
                                    {voted}/{votableMemberCount} voted{yes > 0 ? ` · ${yes} yes` : ''}
                                  </Text>
                                </View>
                                <ChevronRight size={16} color={colors.text3} />
                              </TouchableOpacity>
                            );
                          })}
                        </>
                      )}

                      {votedPlaces.length > 0 && (
                        <>
                          <Text style={styles.votingSubhead}>Decided</Text>
                          {votedPlaces.map((p) => {
                            const isYes = p.vote === '👍 Yes';
                            return (
                              <TouchableOpacity
                                key={p.id}
                                style={styles.votingRow}
                                activeOpacity={0.7}
                                onPress={() => { setVotingPlace(p); setShowVotingSheet(true); }}
                              >
                                {p.photoUrl ? (
                                  <Image source={{ uri: p.photoUrl }} style={styles.votingThumb} />
                                ) : (
                                  <View style={[styles.votingThumb, { backgroundColor: colors.bg3, justifyContent: 'center', alignItems: 'center' }]}>
                                    <ThumbsUp size={14} color={colors.text3} />
                                  </View>
                                )}
                                <View style={styles.votingInfo}>
                                  <Text style={styles.votingName} numberOfLines={1}>{p.name}</Text>
                                  <View style={[styles.votingDecision, { backgroundColor: isYes ? 'rgba(45,106,46,0.15)' : 'rgba(158,58,52,0.15)' }]}>
                                    <Text style={{ fontSize: 11, fontWeight: '600', color: isYes ? '#2d6a2e' : '#9e3a34' }}>
                                      {isYes ? 'Going' : 'Skipped'}
                                    </Text>
                                  </View>
                                </View>
                                <ChevronRight size={16} color={colors.text3} />
                              </TouchableOpacity>
                            );
                          })}
                        </>
                      )}
                    </View>
                  )}

                  <View style={styles.savedHeaderRow}>
                    <Text style={styles.savedCount}>
                      {savedPlaces.length} saved {'\u00B7'} {recommended.size} recommended
                    </Text>
                    <TouchableOpacity
                      onPress={() => {
                        Alert.alert('Clear All', 'Remove all saved places?', [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: 'Clear',
                            style: 'destructive',
                            onPress: () => {
                              setSaved(new Set());
                              setRecommended(new Set());
                              setSavedPlaces([]);
                            },
                          },
                        ]);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.clearAllText}>Clear all</Text>
                    </TouchableOpacity>
                  </View>
                  {savedPlaces.map((p) => {
                    const dp = mapSavedToDiscoverPlace(p, tripCoords ?? undefined);
                    return (
                      <SwipeToDelete
                        key={p.id}
                        onDelete={() => handleSaveToggle(p.name)}
                      >
                        <DiscoverPlaceCard
                          place={dp}
                          distanceKm={getDistanceKm(dp.lat, dp.lng)}
                          travelMode={travelMode}
                          isSaved={true}
                          isRecommended={recommended.has(p.name)}
                          onSave={handleSaveToggle}
                          onRecommend={handleRecommendToggle}
                          saveActionLabel="Save to trip"
                          savedActionLabel="Saved to trip"
                          onAddToPlanner={undefined}
                          showRecommend={canGroupVote}
                          voteByMember={p.voteByMember}
                          memberNames={memberNames}
                          totalMembers={votableMemberCount}
                          onVoteTap={() => {
                            setVotingPlace(p);
                            setShowVotingSheet(true);
                          }}
                        />
                      </SwipeToDelete>
                    );
                  })}
                </>
              )}
            </View>
          )}

          <View style={{ height: 20 }} />
        </ScrollView>
      )}

      {/* ═══════ STAYS TAB (own ScrollView — outside parent) ═══════ */}
      {tab === 'stays' && (
        <Suspense fallback={<MiniLoader />}>
        {canShowPlaceResults ? (
          <StaysTab
            tripCoords={tripCoords}
            originCoords={effectiveCoords}
            originLabel={effectiveOriginLabel}
            originKind={effectiveOriginKind}
            tripId={tripId}
            tripDest={tripDest}
            travelMode={travelMode}
            tripMembers={votableTripMembers}
            memberNames={memberNames}
            savedPlaces={savedPlaces}
            savedNames={saved}
            onSavePlace={handleSavePlaceCard}
            onExplore={handleExplore}
          />
        ) : (
          <View style={styles.emptyPlaces}>
            <Text style={styles.emptyText}>Set a precise location or use current location before searching stays.</Text>
          </View>
        )}
        </Suspense>
      )}

      {showDetail && (
      <Suspense fallback={null}>
      <PlaceDetailSheet
        visible={showDetail}
        placeId={detailPlaceId}
        initialName={detailPlaceName}
        saved={saved.has(detailPlaceName)}
        onClose={() => setShowDetail(false)}
        onSaveToggle={() => {
          if (detailPlaceName) toggleSave(detailPlaceName);
        }}
        saveActionLabel={tripId ? 'Save to trip' : 'Save for later'}
        savedActionLabel={tripId ? 'Saved to trip' : 'Saved for later'}
        onRecommend={canGroupVote ? () => {
          setShowDetail(false);
          if (detailPlaceName) toggleRecommend(detailPlaceName);
        } : undefined}
        isRecommended={recommended.has(detailPlaceName)}
      />
      </Suspense>
      )}
      {showVotingSheet && (
      <Suspense fallback={null}>
      <GroupVotingSheet
        visible={showVotingSheet}
        onClose={() => setShowVotingSheet(false)}
        place={votingPlace}
        pendingPlaces={pendingVotePlaces}
        members={votableTripMembers}
        currentMemberId={currentMemberId}
        onVoteUpdated={(placeId, votes) => {
          setSavedPlaces((prev) =>
            prev.map((p) => (p.id === placeId ? { ...p, voteByMember: votes } : p)),
          );
        }}
      />
      </Suspense>
      )}

      </>}
    </SafeAreaView>
  );
}
