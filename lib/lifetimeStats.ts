import { supabase } from './supabase'
import {
  getLifetimeStats,
  upsertLifetimeStats,
  saveHighlights,
} from './supabase'
import type { Trip, LifetimeStats, Highlight, HighlightType } from './types'

// ---------- CONSTANTS ----------

const EARTH_RADIUS_MILES = 3959
const HOME_LAT = 14.5995
const HOME_LNG = 120.9842
const DEG_TO_RAD = Math.PI / 180

// ---------- HAVERSINE ----------

export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const dLat = (lat2 - lat1) * DEG_TO_RAD
  const dLng = (lng2 - lng1) * DEG_TO_RAD
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * DEG_TO_RAD) *
      Math.cos(lat2 * DEG_TO_RAD) *
      Math.sin(dLng / 2) ** 2
  return EARTH_RADIUS_MILES * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// ---------- COMPUTE STATS ----------

export function computeLifetimeStats(trips: readonly Trip[]): LifetimeStats {
  const countriesSet = new Set<string>()
  let totalNights = 0
  let totalMiles = 0
  let totalSpent = 0
  let totalMoments = 0
  let earliestDate: string | undefined

  for (const trip of trips) {
    if (trip.country) {
      countriesSet.add(trip.country)
    }

    totalNights += trip.totalNights ?? trip.nights ?? 0

    if (trip.latitude != null && trip.longitude != null) {
      totalMiles += haversineDistance(
        HOME_LAT,
        HOME_LNG,
        trip.latitude,
        trip.longitude,
      )
    }

    totalSpent += trip.totalSpent ?? 0

    if (trip.startDate) {
      if (!earliestDate || trip.startDate < earliestDate) {
        earliestDate = trip.startDate
      }
    }
  }

  return {
    totalTrips: trips.length,
    totalCountries: countriesSet.size,
    totalNights,
    totalMiles: Math.round(totalMiles),
    totalSpent,
    homeCurrency: 'PHP',
    totalMoments,
    countriesList: Array.from(countriesSet).sort(),
    earliestTripDate: earliestDate,
  }
}

// ---------- GENERATE HIGHLIGHTS ----------

function makeHighlight(
  type: HighlightType,
  displayText: string,
  supportingData: Record<string, unknown>,
  rank: number,
): Highlight {
  return {
    id: `hl-${type}`,
    type,
    displayText,
    supportingData,
    rank,
  }
}

export function generateHighlights(
  stats: LifetimeStats,
  trips: readonly Trip[],
): Highlight[] {
  const highlights: Highlight[] = []
  let rank = 0

  // Countries visited
  if (stats.totalCountries > 0) {
    highlights.push(
      makeHighlight(
        'countries_visited',
        `${stats.totalCountries} countries explored`,
        { countries: stats.countriesList },
        rank++,
      ),
    )
  }

  // Miles traveled
  if (stats.totalMiles > 0) {
    highlights.push(
      makeHighlight(
        'miles_traveled',
        `${stats.totalMiles.toLocaleString()} miles`,
        { miles: stats.totalMiles },
        rank++,
      ),
    )
  }

  // Total nights
  if (stats.totalNights > 0) {
    highlights.push(
      makeHighlight(
        'beach_streak',
        `${stats.totalNights} nights away`,
        { nights: stats.totalNights },
        rank++,
      ),
    )
  }

  // Total moments
  if (stats.totalMoments > 0) {
    highlights.push(
      makeHighlight(
        'total_moments',
        `${stats.totalMoments} memories captured`,
        { moments: stats.totalMoments },
        rank++,
      ),
    )
  }

  // Longest trip
  const longestTrip = trips.reduce<Trip | null>((best, t) => {
    const n = t.totalNights ?? t.nights ?? 0
    const bestN = best ? (best.totalNights ?? best.nights ?? 0) : 0
    return n > bestN ? t : best
  }, null)

  if (longestTrip) {
    const longestNights = longestTrip.totalNights ?? longestTrip.nights ?? 0
    highlights.push(
      makeHighlight(
        'longest_trip',
        `${longestNights} nights in ${longestTrip.destination}`,
        { destination: longestTrip.destination, nights: longestNights },
        rank++,
      ),
    )
  }

  // Most visited destination
  const destCounts = new Map<string, number>()
  for (const t of trips) {
    if (t.destination) {
      destCounts.set(t.destination, (destCounts.get(t.destination) ?? 0) + 1)
    }
  }

  let mostVisitedDest = ''
  let mostVisitedCount = 0
  for (const [dest, count] of destCounts) {
    if (count > mostVisitedCount) {
      mostVisitedDest = dest
      mostVisitedCount = count
    }
  }

  if (mostVisitedCount > 1) {
    highlights.push(
      makeHighlight(
        'most_visited',
        `${mostVisitedDest} \u00D7 ${mostVisitedCount}`,
        { destination: mostVisitedDest, count: mostVisitedCount },
        rank++,
      ),
    )
  }

  // First trip
  const firstTrip = trips.reduce<Trip | null>((earliest, t) => {
    if (!t.startDate) return earliest
    if (!earliest || t.startDate < earliest.startDate) return t
    return earliest
  }, null)

  if (firstTrip) {
    const year = firstTrip.startDate.slice(0, 4)
    highlights.push(
      makeHighlight(
        'first_trip',
        `Started in ${firstTrip.destination}, ${year}`,
        { destination: firstTrip.destination, year },
        rank++,
      ),
    )
  }

  // Latest trip
  const latestTrip = trips.reduce<Trip | null>((latest, t) => {
    if (!t.startDate) return latest
    if (!latest || t.startDate > latest.startDate) return t
    return latest
  }, null)

  if (latestTrip && latestTrip !== firstTrip) {
    highlights.push(
      makeHighlight(
        'new_territory',
        `Just explored ${latestTrip.destination}`,
        { destination: latestTrip.destination },
        rank++,
      ),
    )
  }

  return highlights.slice(0, 8)
}

// ---------- RECOMPUTE AND CACHE ----------

export async function recomputeAndCacheStats(userId: string): Promise<void> {
  const { data } = await supabase
    .from('trips')
    .select('*')
    .eq('user_id', userId)
    .or('is_past_import.eq.true,status.eq.Completed')

  if (!data || data.length === 0) return

  const { mapTripRow } = await import('./supabase')
  const trips = data.map(mapTripRow)

  const stats = computeLifetimeStats(trips)
  const highlights = generateHighlights(stats, trips)

  await upsertLifetimeStats(userId, stats)
  await saveHighlights(userId, highlights)
}
