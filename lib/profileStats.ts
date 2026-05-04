import type { Flight, LifetimeStats, Moment, Trip } from './types';

export interface CountryVisited {
  code: string;
  name: string;
  flag: string;
}

export interface AchievementBadge {
  key: string;
  title: string;
  description: string;
  icon: string;
}

export interface TravelProgressItem {
  code: string;
  label: string;
  flag: string;
  progress: number;
}

type ProfileFlightInput = Flight & { tripId?: string };

interface ProfileStatsInput {
  trips: Trip[];
  moments?: Moment[];
  flights?: ProfileFlightInput[];
}

export interface ProfileMapCoordinate {
  lat: number;
  lng: number;
}

export interface ProfileMapDestination extends ProfileMapCoordinate {
  code: string;
  label: string;
  flag?: string;
}

export interface ProfileFlightRoute {
  fromCode: string;
  toCode: string;
  fromLabel: string;
  toLabel: string;
  fromLat: number;
  fromLng: number;
  toLat: number;
  toLng: number;
  flightId: string;
  tripId?: string;
  direction: Flight['direction'];
}

export interface ProfileMapData {
  homeAirportCode: string;
  homeCoordinates: ProfileMapCoordinate;
  routes: ProfileFlightRoute[];
  destinations: ProfileMapDestination[];
  totalKm: number;
}

const AIRPORTS: Record<string, ProfileMapDestination> = {
  MNL: { code: 'MNL', label: 'Manila', lat: 14.5086, lng: 121.0195, flag: '🇵🇭' },
  MPH: { code: 'MPH', label: 'Boracay', lat: 11.9245, lng: 121.9540, flag: '🇵🇭' },
  CEB: { code: 'CEB', label: 'Cebu', lat: 10.3075, lng: 123.9794, flag: '🇵🇭' },
  KLO: { code: 'KLO', label: 'Kalibo', lat: 11.6794, lng: 122.3763, flag: '🇵🇭' },
  DPS: { code: 'DPS', label: 'Bali', lat: -8.7482, lng: 115.1675, flag: '🇮🇩' },
  BKK: { code: 'BKK', label: 'Bangkok', lat: 13.6900, lng: 100.7501, flag: '🇹🇭' },
  SIN: { code: 'SIN', label: 'Singapore', lat: 1.3644, lng: 103.9915, flag: '🇸🇬' },
  HKG: { code: 'HKG', label: 'Hong Kong', lat: 22.3080, lng: 113.9185, flag: '🇭🇰' },
  ICN: { code: 'ICN', label: 'Seoul', lat: 37.4602, lng: 126.4407, flag: '🇰🇷' },
  TYO: { code: 'TYO', label: 'Tokyo', lat: 35.6764, lng: 139.6500, flag: '🇯🇵' },
  NRT: { code: 'NRT', label: 'Tokyo Narita', lat: 35.7720, lng: 140.3929, flag: '🇯🇵' },
  HND: { code: 'HND', label: 'Tokyo Haneda', lat: 35.5494, lng: 139.7798, flag: '🇯🇵' },
};

const COUNTRY_CODES: Record<string, string> = {
  Philippines: 'PH',
  Thailand: 'TH',
  Vietnam: 'VN',
  Indonesia: 'ID',
  Singapore: 'SG',
  Japan: 'JP',
  Korea: 'KR',
  'South Korea': 'KR',
  'United States': 'US',
};

const COUNTRY_FLAGS: Record<string, string> = {
  PH: '🇵🇭',
  TH: '🇹🇭',
  VN: '🇻🇳',
  ID: '🇮🇩',
  SG: '🇸🇬',
  JP: '🇯🇵',
  KR: '🇰🇷',
  US: '🇺🇸',
};

function flagFromIso2(code?: string | null): string | undefined {
  const normalized = (code ?? '').trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalized)) return undefined;
  const base = 127397;
  return String.fromCodePoint(...[...normalized].map((char) => char.charCodeAt(0) + base));
}

function countryNameFromIso2(code?: string | null): string | undefined {
  const normalized = (code ?? '').trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalized)) return undefined;
  try {
    const DisplayNames = (Intl as typeof Intl & {
      DisplayNames?: new (locales: string[], options: { type: 'region' }) => { of: (code: string) => string | undefined };
    }).DisplayNames;
    return DisplayNames ? new DisplayNames(['en'], { type: 'region' }).of(normalized) ?? undefined : undefined;
  } catch {
    return undefined;
  }
}

const PLACE_COUNTRY_FALLBACKS: Record<string, string> = {
  astoria: 'Philippines',
  boracay: 'Philippines',
  caticlan: 'Philippines',
  cebu: 'Philippines',
  kalibo: 'Philippines',
  manila: 'Philippines',
  palawan: 'Philippines',
  siargao: 'Philippines',
  tagaytay: 'Philippines',
  'hoi an': 'Vietnam',
};

const COUNTRY_ALIASES: Record<string, string> = {
  korea: 'South Korea',
  'republic of korea': 'South Korea',
  ph: 'Philippines',
  philippines: 'Philippines',
  thailand: 'Thailand',
  vietnam: 'Vietnam',
  indonesia: 'Indonesia',
  singapore: 'Singapore',
  japan: 'Japan',
  'south korea': 'South Korea',
  'united states': 'United States',
  usa: 'United States',
};

function visibleTrip(trip: Trip): boolean {
  return !trip.deletedAt && !trip.isDraft && !trip.archivedAt;
}

function tripNights(trip: Trip): number {
  if (trip.nights > 0) return trip.nights;
  if (trip.totalNights && trip.totalNights > 0) return trip.totalNights;
  const start = new Date(trip.startDate);
  const end = new Date(trip.endDate);
  const nights = Math.round((end.getTime() - start.getTime()) / 86400000);
  return Number.isFinite(nights) ? Math.max(0, nights) : 0;
}

function tripCountry(trip: Trip): string | undefined {
  if (trip.country) return trip.country;
  const countryFromCode = countryNameFromIso2(trip.countryCode);
  if (countryFromCode) return countryFromCode;
  const label = trip.destination || trip.name || '';
  const parts = label.split(',').map((part) => part.trim()).filter(Boolean);
  if (parts.length > 1) return normalizeCountryName(parts[parts.length - 1]) ?? parts[parts.length - 1];
  const normalized = label.toLowerCase();
  const fallbackKey = Object.keys(PLACE_COUNTRY_FALLBACKS).find((place) => normalized.includes(place));
  if (fallbackKey) return PLACE_COUNTRY_FALLBACKS[fallbackKey];
  return parts.length > 1 ? parts[parts.length - 1] : undefined;
}

export function normalizeCountryName(value?: string | null): string | undefined {
  const raw = (value ?? '').trim();
  if (!raw) return undefined;
  const fromIso = countryNameFromIso2(raw);
  if (fromIso) return fromIso;
  const normalized = raw.toLowerCase().replace(/\s+/g, ' ');
  if (COUNTRY_ALIASES[normalized]) return COUNTRY_ALIASES[normalized];
  const fallbackKey = Object.keys(PLACE_COUNTRY_FALLBACKS).find((place) => normalized.includes(place));
  if (fallbackKey) return PLACE_COUNTRY_FALLBACKS[fallbackKey];
  return COUNTRY_CODES[raw] || /^[A-Za-z][A-Za-z\s.'-]{2,}$/.test(raw) ? raw : undefined;
}

export function normalizeStatsCountries(stats: LifetimeStats): LifetimeStats {
  const normalizedCountries = stats.countriesList
    .map((country) => normalizeCountryName(country))
    .filter((country): country is string => !!country);
  const countriesList = [...new Set(normalizedCountries)];

  return {
    ...stats,
    totalCountries: countriesList.length,
    countriesList,
  };
}

function countryCode(name: string): string {
  if (/^[A-Za-z]{2}$/.test(name.trim())) return name.trim().toUpperCase();
  return COUNTRY_CODES[name] ?? name.slice(0, 2).toUpperCase();
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

export function haversineKm(a: ProfileMapCoordinate, b: ProfileMapCoordinate): number {
  const earthKm = 6371;
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return earthKm * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function extractAirportCode(value?: string | null): string | undefined {
  const raw = (value ?? '').trim();
  if (!raw) return undefined;
  const explicit = raw.match(/\b[A-Z]{3}\b/)?.[0];
  if (explicit) return explicit;
  const normalized = raw.toLowerCase();
  if (normalized.includes('boracay') || normalized.includes('caticlan') || normalized.includes('godofredo')) return 'MPH';
  if (normalized.includes('manila') || normalized.includes('ninoy')) return 'MNL';
  if (normalized.includes('cebu')) return 'CEB';
  if (normalized.includes('kalibo')) return 'KLO';
  if (normalized.includes('bali') || normalized.includes('denpasar')) return 'DPS';
  if (normalized.includes('bangkok')) return 'BKK';
  if (normalized.includes('singapore')) return 'SIN';
  if (normalized.includes('hong kong')) return 'HKG';
  if (normalized.includes('seoul') || normalized.includes('incheon')) return 'ICN';
  if (normalized.includes('tokyo')) return 'TYO';
  return undefined;
}

function inferHomeAirportCode(homeBase?: string): string {
  return extractAirportCode(homeBase) ?? 'MNL';
}

function destinationFromTrip(trip: Trip): ProfileMapDestination | undefined {
  if (trip.latitude != null && trip.longitude != null) {
    const code = trip.countryCode ?? countryCode(tripCountry(trip) ?? trip.destination ?? trip.name);
    return {
      code,
      label: trip.destination || trip.name,
      lat: trip.latitude,
      lng: trip.longitude,
      flag: COUNTRY_FLAGS[code] ?? flagFromIso2(code),
    };
  }
  const airportCode = extractAirportCode(trip.destination || trip.name);
  return airportCode ? AIRPORTS[airportCode] : undefined;
}

export function buildProfileMapData({
  trips,
  flights = [],
  homeBase,
}: {
  trips: Trip[];
  flights?: ProfileFlightInput[];
  homeBase?: string;
}): ProfileMapData {
  const homeAirportCode = inferHomeAirportCode(homeBase);
  const home = AIRPORTS[homeAirportCode] ?? AIRPORTS.MNL;
  const routes: ProfileFlightRoute[] = [];

  for (const flight of flights) {
    const fromCode = extractAirportCode(flight.from);
    const toCode = extractAirportCode(flight.to);
    const from = fromCode ? AIRPORTS[fromCode] : undefined;
    const to = toCode ? AIRPORTS[toCode] : undefined;
    if (!fromCode || !toCode || !from || !to) continue;
    routes.push({
      fromCode,
      toCode,
      fromLabel: flight.from || from.label,
      toLabel: flight.to || to.label,
      fromLat: from.lat,
      fromLng: from.lng,
      toLat: to.lat,
      toLng: to.lng,
      flightId: flight.id,
      tripId: flight.tripId,
      direction: flight.direction,
    });
  }

  if (routes.length > 0) {
    const destinationsByCode = new Map<string, ProfileMapDestination>();
    for (const route of routes) {
      const to = AIRPORTS[route.toCode];
      const from = AIRPORTS[route.fromCode];
      if (to && route.toCode !== homeAirportCode) destinationsByCode.set(route.toCode, to);
      if (from && route.fromCode !== homeAirportCode) destinationsByCode.set(route.fromCode, from);
    }
    return {
      homeAirportCode,
      homeCoordinates: { lat: home.lat, lng: home.lng },
      routes,
      destinations: [...destinationsByCode.values()],
      totalKm: Math.round(routes.reduce((sum, route) => sum + haversineKm(
        { lat: route.fromLat, lng: route.fromLng },
        { lat: route.toLat, lng: route.toLng },
      ), 0)),
    };
  }

  const fallbackDestinations = trips
    .filter(visibleTrip)
    .map(destinationFromTrip)
    .filter((destination): destination is ProfileMapDestination => !!destination);
  const uniqueDestinations = [...new Map(fallbackDestinations.map((destination) => [destination.code, destination])).values()];

  return {
    homeAirportCode,
    homeCoordinates: { lat: home.lat, lng: home.lng },
    routes: [],
    destinations: uniqueDestinations,
    totalKm: Math.round(uniqueDestinations.reduce((sum, destination) => sum + haversineKm(home, destination), 0)),
  };
}

export function buildProfileStatsFromTrips({ trips, moments = [], flights = [] }: ProfileStatsInput): LifetimeStats {
  const visible = trips.filter(visibleTrip);
  const countries = new Set<string>();
  const flightMap = buildProfileMapData({ trips: visible, flights });

  for (const trip of visible) {
    const country = normalizeCountryName(tripCountry(trip));
    if (country) countries.add(country);
  }

  return {
    totalTrips: visible.length,
    totalCountries: countries.size,
    totalNights: visible.reduce((sum, trip) => sum + tripNights(trip), 0),
    totalMiles: flightMap.totalKm > 0 ? flightMap.totalKm / 1.60934 : 0,
    totalSpent: visible.reduce((sum, trip) => sum + (trip.totalSpent ?? trip.cost ?? 0), 0),
    homeCurrency: 'PHP',
    totalMoments: moments.filter((moment) => !!moment.photo).length,
    countriesList: [...countries],
    earliestTripDate: visible
      .map((trip) => trip.startDate)
      .filter(Boolean)
      .sort()[0],
  };
}

export function buildCountriesVisited(stats: LifetimeStats): CountryVisited[] {
  return [...new Set(stats.countriesList.map((name) => normalizeCountryName(name)).filter((name): name is string => !!name))].map((name) => {
    const code = countryCode(name);
    return {
      code,
      name,
      flag: COUNTRY_FLAGS[code] ?? flagFromIso2(code) ?? '🌍',
    };
  });
}

export function buildTravelProgressItems(stats: LifetimeStats, maxItems = 4): TravelProgressItem[] {
  const countries = [...new Set(stats.countriesList.map((name) => normalizeCountryName(name)).filter((name): name is string => !!name))].slice(0, maxItems);
  const denominator = Math.max(1, countries.length - 1);

  return countries.map((name, index) => {
    const code = countryCode(name);
    return {
      code,
      label: name,
      flag: COUNTRY_FLAGS[code] ?? flagFromIso2(code) ?? '🌍',
      progress: countries.length <= 1 ? 1 : index / denominator,
    };
  });
}

export function buildTravelProgressItemsFromTrips(trips: Trip[], maxItems = 4): TravelProgressItem[] {
  const visible = trips.filter(visibleTrip);
  const stops = visible.map((trip) => {
    const rawLabel = trip.destination || trip.name;
    const country = normalizeCountryName(tripCountry(trip));
    const code = trip.countryCode ?? (country ? countryCode(country) : extractAirportCode(rawLabel) ?? rawLabel.slice(0, 2).toUpperCase());
    return {
      code,
      label: rawLabel.replace(/,\s*(Philippines|Thailand|Vietnam|Indonesia|Singapore|Japan|South Korea|Korea|United States)$/i, ''),
      flag: COUNTRY_FLAGS[country ? countryCode(country) : code] ?? flagFromIso2(country ? countryCode(country) : code) ?? '🌍',
    };
  }).filter((item) => !!item.label);

  const uniqueStops = [...new Map(stops.map((stop) => [`${stop.label.toLowerCase()}-${stop.code}`, stop])).values()].slice(0, maxItems);
  const denominator = Math.max(1, uniqueStops.length - 1);

  return uniqueStops.map((stop, index) => ({
    ...stop,
    progress: uniqueStops.length <= 1 ? 1 : index / denominator,
  }));
}

export function buildAchievementBadges(stats: LifetimeStats): AchievementBadge[] {
  const badges: AchievementBadge[] = [];

  if (stats.totalCountries >= 1) {
    badges.push({
      key: 'explorer',
      title: 'Explorer',
      description: `Visited ${stats.totalCountries} ${stats.totalCountries === 1 ? 'country' : 'countries'}`,
      icon: 'compass',
    });
  }
  if (stats.totalMiles >= 6214 || stats.totalTrips >= 5) {
    badges.push({
      key: 'globetrotter',
      title: 'Globetrotter',
      description: `Traveled ${Math.round(stats.totalMiles * 1.60934).toLocaleString()}+ km`,
      icon: 'plane',
    });
  }
  if (stats.totalMoments >= 1) {
    badges.push({
      key: 'memory_maker',
      title: 'Memory Maker',
      description: `Shared ${stats.totalMoments} ${stats.totalMoments === 1 ? 'photo' : 'photos'}`,
      icon: 'camera',
    });
  }

  return badges.slice(0, 3);
}

export function buildTopTrip(trips: Trip[]): Trip | null {
  const completed = trips.filter((trip) => visibleTrip(trip) && trip.status === 'Completed');
  if (completed.length === 0) return null;

  return [...completed].sort((a, b) => {
    const aScore = tripNights(a) * 1000 + (a.totalSpent ?? 0);
    const bScore = tripNights(b) * 1000 + (b.totalSpent ?? 0);
    return bScore - aScore;
  })[0];
}

export function buildProfileCoverPhotoUrl({
  explicitCoverUrl,
  moments = [],
  fallbackUrl,
}: {
  explicitCoverUrl?: string | null;
  moments?: Moment[];
  fallbackUrl?: string | null;
}): string | undefined {
  const explicit = explicitCoverUrl?.trim();
  if (explicit) return explicit;
  const firstMomentPhoto = moments.find((moment) => !!moment.photo)?.photo?.trim();
  if (firstMomentPhoto) return firstMomentPhoto;
  const fallback = fallbackUrl?.trim();
  return fallback || undefined;
}

export function formatProfileCurrency(value: number): string {
  if (value >= 1000000) return `₱${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `₱${Math.round(value / 1000)}k`;
  return `₱${Math.round(value).toLocaleString()}`;
}
