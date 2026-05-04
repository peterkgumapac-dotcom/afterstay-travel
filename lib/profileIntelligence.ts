import type { CompanionStatus, Flight, FollowState, LifetimeStats, Moment, Trip } from './types';
import {
  buildCountriesVisited,
  buildProfileMapData,
  buildProfileStatsFromTrips,
  buildTopTrip,
  normalizeStatsCountries,
  type CountryVisited,
  type ProfileMapData,
} from './profileStats';
import {
  buildTravelFlexVisual,
  type TravelFlexConfidence,
  type TravelFlexTemplate,
  type TravelFlexVisual,
} from './profileTravelVisual';

export type TravelVisualConfidence = TravelFlexConfidence;

export type ProfileMapTemplate = TravelFlexTemplate;

export type ProfileBadgeKey =
  | 'globetrotter'
  | 'local_explorer'
  | 'memory_maker'
  | 'trip_companion'
  | 'travel_flex';

export interface ProfileBadge {
  key: ProfileBadgeKey;
  label: string;
  description: string;
}

export interface ProfileRelationship {
  isSelf: boolean;
  isCompanion: boolean;
  viewerFollowsUser: boolean;
  userFollowsViewer: boolean;
  isMutualFollow: boolean;
  canMessage: boolean;
}

export interface ProfileTravelFacts {
  tripCount: number;
  countryCount: number;
  placeCount: number;
  nightCount: number;
  spentTotal: number;
  photoCount: number;
  countries: CountryVisited[];
  routes: ProfileMapData['routes'];
  mapData: ProfileMapData;
  mapTemplate: ProfileMapTemplate;
  travelVisual: TravelFlexVisual;
  badges: ProfileBadge[];
  confidence: TravelVisualConfidence;
  topTrip: Trip | null;
  stats: LifetimeStats;
}

export interface ProfileDisplayFacts {
  stats: LifetimeStats;
  countries: CountryVisited[];
  badges: ProfileBadge[];
}

type ProfileFlightInput = Flight & { tripId?: string };

interface BuildProfileTravelFactsInput {
  trips: Trip[];
  moments?: Moment[];
  flights?: ProfileFlightInput[];
  homeBase?: string;
  fallbackStats?: LifetimeStats;
  isCompanion?: boolean;
}

interface BuildProfileRelationshipInput {
  viewerId?: string | null;
  profileUserId?: string | null;
  companionStatus: CompanionStatus;
  followState?: FollowState | null;
}

function visibleTrip(trip: Trip): boolean {
  return !trip.deletedAt && !trip.isDraft && !trip.archivedAt;
}

function visiblePlaces(trips: Trip[]): string[] {
  const places = trips
    .filter(visibleTrip)
    .map((trip) => (trip.destination || trip.name || '').trim())
    .filter(Boolean)
    .map((place) => place.replace(/,\s*(Philippines|Thailand|Vietnam|Indonesia|Singapore|Japan|South Korea|Korea|United States)$/i, '').trim());

  return [...new Set(places.map((place) => place.toLowerCase()))]
    .map((key) => places.find((place) => place.toLowerCase() === key))
    .filter((place): place is string => !!place);
}

function hasInternationalRoutes(mapData: ProfileMapData): boolean {
  const countryFlags = new Set(mapData.destinations.map((destination) => destination.flag).filter(Boolean));
  return countryFlags.size > 1 || mapData.destinations.some((destination) => destination.flag && destination.flag !== '🇵🇭');
}

function chooseConfidence(input: {
  mapData: ProfileMapData;
  trips: Trip[];
  countryCount: number;
}): TravelVisualConfidence {
  if (input.mapData.routes.length > 0) return 'exact_flight';
  if (input.mapData.destinations.some((destination) => Number.isFinite(destination.lat) && Number.isFinite(destination.lng))) {
    return 'exact_place';
  }
  if (input.countryCount > 0) return 'country_estimate';
  if (input.trips.some((trip) => (trip.destination || trip.name || '').trim())) return 'text_guess';
  return 'unknown';
}

function buildFactBadges(input: {
  stats: LifetimeStats;
  placeCount: number;
  isCompanion: boolean;
  hasInternationalRoute: boolean;
}): ProfileBadge[] {
  const badges: ProfileBadge[] = [];

  if (input.stats.totalCountries >= 3 || input.hasInternationalRoute) {
    badges.push({
      key: 'globetrotter',
      label: 'Globetrotter',
      description: 'Built an international travel trail',
    });
  }

  if (input.stats.totalCountries === 1 && input.placeCount >= 2) {
    badges.push({
      key: 'local_explorer',
      label: 'Local Explorer',
      description: 'Multiple places in one country',
    });
  }

  if (input.stats.totalMoments >= 10) {
    badges.push({
      key: 'memory_maker',
      label: 'Memory Maker',
      description: 'Shared 10+ travel moments',
    });
  }

  if (input.isCompanion) {
    badges.push({
      key: 'trip_companion',
      label: 'Trip Companion',
      description: 'Shared a trip together',
    });
  }

  if (input.stats.totalTrips > 0 || input.stats.totalMoments > 0) {
    badges.push({
      key: 'travel_flex',
      label: 'Travel Flex',
      description: 'Started a travel profile',
    });
  }

  return badges.slice(0, 3);
}

export function buildProfileDisplayFactsFromVisual({
  visual,
  isCompanion = false,
}: {
  visual: TravelFlexVisual;
  isCompanion?: boolean;
}): ProfileDisplayFacts {
  const normalizedStats = normalizeStatsCountries({
    totalTrips: visual.counts.trips,
    totalCountries: visual.counts.countries,
    totalNights: visual.counts.nights,
    totalMiles: Math.round(visual.counts.km / 1.60934),
    totalSpent: visual.counts.spent,
    homeCurrency: 'PHP',
    totalMoments: visual.counts.photos,
    countriesList: visual.flags.map((flag) => flag.countryName),
    earliestTripDate: visual.since && visual.since !== 'now' ? `${visual.since}-01-01` : undefined,
  });
  const stats = {
    ...normalizedStats,
    totalCountries: visual.counts.countries,
  };
  const countries = visual.flags.map((flag, index) => ({
    code: flag.countryCode,
    name: flag.countryName,
    flag: flag.flag,
    progress: visual.flags.length <= 1 ? 0.5 : index / (visual.flags.length - 1),
  }));

  return {
    stats,
    countries,
    badges: buildFactBadges({
      stats,
      placeCount: visual.counts.places,
      isCompanion,
      hasInternationalRoute: visual.counts.countries > 1,
    }),
  };
}

export function buildProfileRelationship({
  viewerId,
  profileUserId,
  companionStatus,
  followState,
}: BuildProfileRelationshipInput): ProfileRelationship {
  const isSelf = !!viewerId && !!profileUserId && viewerId === profileUserId;
  const isCompanion = !isSelf && companionStatus === 'companion';
  const viewerFollowsUser = !!followState?.isFollowing;
  const userFollowsViewer = !!followState?.isFollowedBy;
  const isMutualFollow = !isSelf && viewerFollowsUser && userFollowsViewer;

  return {
    isSelf,
    isCompanion,
    viewerFollowsUser,
    userFollowsViewer,
    isMutualFollow,
    canMessage: isSelf ? false : isCompanion || isMutualFollow,
  };
}

export function buildProfileTravelFacts({
  trips,
  moments = [],
  flights = [],
  homeBase,
  fallbackStats,
  isCompanion = false,
}: BuildProfileTravelFactsInput): ProfileTravelFacts {
  const computedStats = buildProfileStatsFromTrips({ trips, moments, flights });
  const hasComputedProfileFacts = computedStats.totalTrips > 0
    || computedStats.totalCountries > 0
    || computedStats.totalNights > 0
    || computedStats.totalMiles > 0
    || computedStats.totalSpent > 0
    || computedStats.totalMoments > 0
    || computedStats.countriesList.length > 0;
  const mergedStats = normalizeStatsCountries(!hasComputedProfileFacts && fallbackStats ? fallbackStats : computedStats);
  const mapData = buildProfileMapData({ trips, flights, homeBase });
  const countries = buildCountriesVisited(mergedStats);
  const places = visiblePlaces(trips);
  const internationalRoute = hasInternationalRoutes(mapData);
  const travelVisual = buildTravelFlexVisual({
    trips,
    moments,
    flights,
    homeBase,
    fallbackStats,
  });

  return {
    tripCount: mergedStats.totalTrips,
    countryCount: mergedStats.totalCountries,
    placeCount: places.length,
    nightCount: mergedStats.totalNights,
    spentTotal: mergedStats.totalSpent,
    photoCount: mergedStats.totalMoments,
    countries,
    routes: mapData.routes,
    mapData,
    mapTemplate: travelVisual.template,
    travelVisual,
    badges: buildFactBadges({
      stats: mergedStats,
      placeCount: places.length,
      isCompanion,
      hasInternationalRoute: internationalRoute,
    }),
    confidence: chooseConfidence({ mapData, trips, countryCount: mergedStats.totalCountries }),
    topTrip: buildTopTrip(trips),
    stats: mergedStats,
  };
}
