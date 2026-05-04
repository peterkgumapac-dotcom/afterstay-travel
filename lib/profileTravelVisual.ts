import type { Flight, LifetimeStats, Moment, Trip } from './types';
import {
  buildCountriesVisited,
  buildProfileMapData,
  buildProfileStatsFromTrips,
  formatProfileCurrency,
  normalizeCountryName,
  normalizeStatsCountries,
  type CountryVisited,
  type ProfileMapData,
} from './profileStats';

export type TravelFlexTemplate =
  | 'empty'
  | 'first_place'
  | 'local_explorer'
  | 'first_abroad'
  | 'regional_traveler'
  | 'global_flex';

export type TravelFlexAnimationMode =
  | 'none'
  | 'single_arc'
  | 'local_hops'
  | 'country_hops'
  | 'route_constellation';

export type TravelFlexConfidence =
  | 'exact_flight'
  | 'exact_place'
  | 'country_estimate'
  | 'text_guess'
  | 'unknown';

export interface TravelFlexCounts {
  trips: number;
  countries: number;
  places: number;
  nights: number;
  photos: number;
  spent: number;
  km: number;
}

export interface TravelFlexFlag {
  countryCode: string;
  countryName: string;
  flag: string;
  visitedPlaces: number;
}

export interface TravelFlexPlace {
  id: string;
  label: string;
  countryCode?: string;
  countryName?: string;
  flag?: string;
  lat?: number;
  lng?: number;
  source: 'flight' | 'trip' | 'moment' | 'itinerary' | 'hotel' | 'manual' | 'fallback';
  confidence: TravelFlexConfidence;
}

export interface TravelFlexRoute {
  id: string;
  fromLabel: string;
  toLabel: string;
  fromCode?: string;
  toCode?: string;
  fromLat?: number;
  fromLng?: number;
  toLat?: number;
  toLng?: number;
  tripId?: string;
  flightId?: string;
  confidence: TravelFlexConfidence;
  featured?: boolean;
}

export interface TravelFlexVisual {
  template: TravelFlexTemplate;
  animationMode: TravelFlexAnimationMode;
  counts: TravelFlexCounts;
  flags: TravelFlexFlag[];
  places: TravelFlexPlace[];
  routes: TravelFlexRoute[];
  home: {
    code: string;
    label: string;
    lat?: number;
    lng?: number;
    flag?: string;
  };
  confidence: TravelFlexConfidence;
  since?: string;
}

type ProfileFlightInput = Flight & { tripId?: string };

interface BuildTravelFlexVisualInput {
  trips: Trip[];
  moments?: Moment[];
  flights?: ProfileFlightInput[];
  homeBase?: string;
  fallbackStats?: LifetimeStats;
}

const COUNTRY_CODE_ALIASES: Record<string, string> = {
  Philippines: 'PH',
  Thailand: 'TH',
  Vietnam: 'VN',
  Indonesia: 'ID',
  Singapore: 'SG',
  Japan: 'JP',
  'South Korea': 'KR',
  Korea: 'KR',
  'United States': 'US',
};

function visibleTrip(trip: Trip): boolean {
  return !trip.deletedAt && !trip.isDraft && !trip.archivedAt;
}

function stripCountry(label: string): string {
  return label
    .replace(/,\s*(Philippines|Thailand|Vietnam|Indonesia|Singapore|Japan|South Korea|Korea|United States)$/i, '')
    .trim();
}

function countryCode(country?: string, fallback?: string): string | undefined {
  const normalized = normalizeCountryName(country);
  if (normalized && COUNTRY_CODE_ALIASES[normalized]) return COUNTRY_CODE_ALIASES[normalized];
  const raw = (fallback ?? '').trim().toUpperCase();
  if (/^[A-Z]{2}$/.test(raw)) return raw;
  return normalized ? normalized.slice(0, 2).toUpperCase() : undefined;
}

function flagFromIso2(code?: string): string | undefined {
  if (!code || !/^[A-Z]{2}$/.test(code)) return undefined;
  const base = 127397;
  return String.fromCodePoint(...[...code].map((char) => char.charCodeAt(0) + base));
}

function countryFromTrip(trip: Trip): string | undefined {
  return normalizeCountryName(trip.country)
    ?? normalizeCountryName(trip.countryCode)
    ?? normalizeCountryName(trip.destination)
    ?? normalizeCountryName(trip.name);
}

function buildPlaces(trips: Trip[], countries: CountryVisited[]): TravelFlexPlace[] {
  const countryByName = new Map(countries.map((country) => [country.name, country]));
  const places = trips.filter(visibleTrip).map((trip) => {
    const rawLabel = trip.destination || trip.name || 'Trip stop';
    const countryName = countryFromTrip(trip);
    const country = countryName ? countryByName.get(countryName) : undefined;
    const code = trip.countryCode ?? country?.code ?? countryCode(countryName);
    return {
      id: trip.id,
      label: stripCountry(rawLabel) || rawLabel,
      countryCode: code,
      countryName,
      flag: country?.flag ?? flagFromIso2(code),
      lat: trip.latitude,
      lng: trip.longitude,
      source: 'trip',
      confidence: trip.latitude != null && trip.longitude != null ? 'exact_place' : countryName ? 'country_estimate' : 'text_guess',
    } satisfies TravelFlexPlace;
  });

  const seen = new Set<string>();
  return places.filter((place) => {
    const key = `${place.label.toLowerCase()}-${place.countryCode ?? place.countryName ?? ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildFlags(countries: CountryVisited[], places: TravelFlexPlace[]): TravelFlexFlag[] {
  return countries.map((country) => ({
    countryCode: country.code,
    countryName: country.name,
    flag: country.flag,
    visitedPlaces: Math.max(1, places.filter((place) =>
      place.countryCode === country.code || place.countryName === country.name,
    ).length),
  }));
}

export function chooseTravelFlexTemplate(counts: Pick<TravelFlexCounts, 'trips' | 'countries' | 'places'>): TravelFlexTemplate {
  if (counts.trips === 0 && counts.places === 0 && counts.countries === 0) return 'empty';
  if (counts.countries <= 1) {
    if (counts.places <= 1 && counts.trips <= 1) return 'first_place';
    return 'local_explorer';
  }
  if (counts.countries === 2) return 'first_abroad';
  if (counts.countries <= 8) return 'regional_traveler';
  return 'global_flex';
}

export function chooseTravelFlexAnimationMode(
  template: TravelFlexTemplate,
  routeCount = 0,
  placeCount = 0,
): TravelFlexAnimationMode {
  if (template === 'empty') return 'none';
  if (template === 'first_place' || (template === 'first_abroad' && routeCount <= 1)) return 'single_arc';
  if (template === 'local_explorer') return placeCount > 1 ? 'local_hops' : 'single_arc';
  if (template === 'first_abroad' || template === 'regional_traveler') return 'country_hops';
  return 'route_constellation';
}

function chooseConfidence(mapData: ProfileMapData, places: TravelFlexPlace[]): TravelFlexConfidence {
  if (mapData.routes.length > 0) return 'exact_flight';
  if (places.some((place) => place.confidence === 'exact_place')) return 'exact_place';
  if (places.some((place) => place.confidence === 'country_estimate')) return 'country_estimate';
  if (places.length > 0) return 'text_guess';
  return 'unknown';
}

function buildRoutes(mapData: ProfileMapData, places: TravelFlexPlace[]): TravelFlexRoute[] {
  if (mapData.routes.length > 0) {
    return mapData.routes.map((route, index) => ({
      id: route.flightId,
      fromLabel: route.fromLabel,
      toLabel: route.toLabel,
      fromCode: route.fromCode,
      toCode: route.toCode,
      fromLat: route.fromLat,
      fromLng: route.fromLng,
      toLat: route.toLat,
      toLng: route.toLng,
      tripId: route.tripId,
      flightId: route.flightId,
      confidence: 'exact_flight',
      featured: index === mapData.routes.length - 1,
    }));
  }

  return places.slice(0, 8).map((place, index) => ({
    id: `place-${place.id}`,
    fromLabel: index === 0 ? 'HOME' : places[index - 1]?.label ?? 'HOME',
    toLabel: place.label,
    toCode: place.countryCode,
    toLat: place.lat,
    toLng: place.lng,
    tripId: place.id,
    confidence: place.confidence,
    featured: index === Math.min(places.length, 8) - 1,
  }));
}

export function buildTravelFlexVisual({
  trips,
  moments = [],
  flights = [],
  homeBase,
  fallbackStats,
}: BuildTravelFlexVisualInput): TravelFlexVisual {
  const computedStats = buildProfileStatsFromTrips({ trips, moments, flights });
  const hasComputedProfileFacts = computedStats.totalTrips > 0
    || computedStats.totalCountries > 0
    || computedStats.totalNights > 0
    || computedStats.totalMiles > 0
    || computedStats.totalSpent > 0
    || computedStats.totalMoments > 0
    || computedStats.countriesList.length > 0;
  const stats = normalizeStatsCountries(!hasComputedProfileFacts && fallbackStats ? fallbackStats : computedStats);
  const mapData = buildProfileMapData({ trips, flights, homeBase });
  const countries = buildCountriesVisited(stats);
  const places = buildPlaces(trips, countries);
  const counts: TravelFlexCounts = {
    trips: stats.totalTrips,
    countries: stats.totalCountries,
    places: places.length,
    nights: stats.totalNights,
    photos: stats.totalMoments,
    spent: stats.totalSpent,
    km: mapData.totalKm || Math.round(stats.totalMiles * 1.60934),
  };
  const template = chooseTravelFlexTemplate(counts);

  return {
    template,
    animationMode: chooseTravelFlexAnimationMode(template, mapData.routes.length, places.length),
    counts,
    flags: buildFlags(countries, places),
    places,
    routes: buildRoutes(mapData, places),
    home: {
      code: mapData.homeAirportCode,
      label: homeBase || mapData.homeAirportCode || 'HOME',
      lat: mapData.homeCoordinates.lat,
      lng: mapData.homeCoordinates.lng,
      flag: flagFromIso2('PH'),
    },
    confidence: chooseConfidence(mapData, places),
    since: stats.earliestTripDate ? String(new Date(stats.earliestTripDate).getFullYear()) : 'now',
  };
}

export function formatTravelFlexSpent(value: number): string {
  return formatProfileCurrency(value);
}

export function visibleTravelFlexFlags(flags: TravelFlexFlag[], max = 5): {
  visible: TravelFlexFlag[];
  extraCount: number;
} {
  const deduped: TravelFlexFlag[] = [];
  const seen = new Set<string>();
  for (const flag of flags) {
    const key = flag.countryCode || flag.countryName;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    deduped.push(flag);
  }

  return {
    visible: deduped.slice(0, max),
    extraCount: Math.max(0, deduped.length - max),
  };
}

function numberFromRpc(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function stringFromRpc(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function confidenceFromRpc(value: unknown): TravelFlexConfidence {
  return value === 'exact_flight'
    || value === 'exact_place'
    || value === 'country_estimate'
    || value === 'text_guess'
    || value === 'unknown'
    ? value
    : 'unknown';
}

function templateFromRpc(value: unknown, counts: TravelFlexCounts): TravelFlexTemplate {
  return value === 'empty'
    || value === 'first_place'
    || value === 'local_explorer'
    || value === 'first_abroad'
    || value === 'regional_traveler'
    || value === 'global_flex'
    ? value
    : chooseTravelFlexTemplate(counts);
}

function animationFromRpc(value: unknown, template: TravelFlexTemplate, routeCount: number, placeCount: number): TravelFlexAnimationMode {
  return value === 'none'
    || value === 'single_arc'
    || value === 'local_hops'
    || value === 'country_hops'
    || value === 'route_constellation'
    ? value
    : chooseTravelFlexAnimationMode(template, routeCount, placeCount);
}

export function normalizeTravelFlexVisualFromRpc(data: unknown): TravelFlexVisual | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const row = data as Record<string, unknown>;
  const countsRow = (row.counts && typeof row.counts === 'object' && !Array.isArray(row.counts))
    ? row.counts as Record<string, unknown>
    : {};
  const counts: TravelFlexCounts = {
    trips: numberFromRpc(countsRow.trips),
    countries: numberFromRpc(countsRow.countries),
    places: numberFromRpc(countsRow.places),
    nights: numberFromRpc(countsRow.nights),
    photos: numberFromRpc(countsRow.photos),
    spent: numberFromRpc(countsRow.spent),
    km: numberFromRpc(countsRow.km),
  };
  const flags = Array.isArray(row.flags)
    ? row.flags.map((flag, index) => {
      const flagRow = flag && typeof flag === 'object' ? flag as Record<string, unknown> : {};
      const countryCode = stringFromRpc(flagRow.countryCode)?.toUpperCase() ?? `C${index}`;
      return {
        countryCode,
        countryName: stringFromRpc(flagRow.countryName) ?? countryCode,
        flag: stringFromRpc(flagRow.flag) ?? flagFromIso2(countryCode) ?? '🌍',
        visitedPlaces: Math.max(1, numberFromRpc(flagRow.visitedPlaces)),
      } satisfies TravelFlexFlag;
    })
    : [];
  const places = Array.isArray(row.places)
    ? row.places.map((place, index) => {
      const placeRow = place && typeof place === 'object' ? place as Record<string, unknown> : {};
      const countryCode = stringFromRpc(placeRow.countryCode)?.toUpperCase();
      return {
        id: stringFromRpc(placeRow.id) ?? `rpc-place-${index}`,
        label: stringFromRpc(placeRow.label) ?? 'Travel stop',
        countryCode,
        countryName: stringFromRpc(placeRow.countryName),
        flag: stringFromRpc(placeRow.flag) ?? flagFromIso2(countryCode),
        lat: placeRow.lat == null ? undefined : numberFromRpc(placeRow.lat),
        lng: placeRow.lng == null ? undefined : numberFromRpc(placeRow.lng),
        source: 'fallback',
        confidence: confidenceFromRpc(placeRow.confidence),
      } satisfies TravelFlexPlace;
    })
    : [];
  const routes = Array.isArray(row.routes)
    ? row.routes.map((route, index) => {
      const routeRow = route && typeof route === 'object' ? route as Record<string, unknown> : {};
      return {
        id: stringFromRpc(routeRow.id) ?? `rpc-route-${index}`,
        fromLabel: stringFromRpc(routeRow.fromLabel) ?? 'HOME',
        toLabel: stringFromRpc(routeRow.toLabel) ?? 'Travel stop',
        fromCode: stringFromRpc(routeRow.fromCode),
        toCode: stringFromRpc(routeRow.toCode),
        fromLat: routeRow.fromLat == null ? undefined : numberFromRpc(routeRow.fromLat),
        fromLng: routeRow.fromLng == null ? undefined : numberFromRpc(routeRow.fromLng),
        toLat: routeRow.toLat == null ? undefined : numberFromRpc(routeRow.toLat),
        toLng: routeRow.toLng == null ? undefined : numberFromRpc(routeRow.toLng),
        tripId: stringFromRpc(routeRow.tripId),
        flightId: stringFromRpc(routeRow.flightId),
        confidence: confidenceFromRpc(routeRow.confidence),
        featured: !!routeRow.featured,
      } satisfies TravelFlexRoute;
    })
    : [];
  const template = templateFromRpc(row.template, counts);
  const homeRow = (row.home && typeof row.home === 'object' && !Array.isArray(row.home))
    ? row.home as Record<string, unknown>
    : {};

  return {
    template,
    animationMode: animationFromRpc(row.animationMode, template, routes.length, places.length),
    counts,
    flags,
    places,
    routes,
    home: {
      code: stringFromRpc(homeRow.code) ?? 'MNL',
      label: stringFromRpc(homeRow.label) ?? 'HOME',
      lat: homeRow.lat == null ? undefined : numberFromRpc(homeRow.lat),
      lng: homeRow.lng == null ? undefined : numberFromRpc(homeRow.lng),
      flag: stringFromRpc(homeRow.flag) ?? flagFromIso2('PH'),
    },
    confidence: confidenceFromRpc(row.confidence),
    since: stringFromRpc(row.since),
  };
}
