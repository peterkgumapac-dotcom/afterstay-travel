/**
 * Collects all trip data and shapes it for AI prompt + database storage.
 * Reuses existing Supabase data functions — no new queries.
 */

import {
  getActiveTrip,
  getExpenses,
  getExpenseSummary,
  getFlights,
  getGroupMembers,
  getMoments,
  getSavedPlaces,
} from './supabase'
import type {
  Moment,
  TripMemoryExpenses,
  TripMemoryFlight,
  TripMemoryPlace,
  TripMemorySnapshot,
} from './types'

export interface TripMemoryData {
  tripId: string
  snapshot: TripMemorySnapshot
  expenseSummary: TripMemoryExpenses
  placesSummary: TripMemoryPlace[]
  flightSummary: TripMemoryFlight[]
  heroMomentId?: string
  featuredMomentIds: string[]
  // Raw data shaped for AI prompt
  momentsForAI: { date: string; caption: string; location?: string; tags: string[] }[]
  placesForAI: { name: string; category: string; vote: string; rating?: number; notes?: string }[]
  expensesForAI: { description: string; amount: number; category: string; date: string }[]
  flightsForAI: { direction: string; from: string; to: string; airline: string }[]
}

/** Score a moment for hero selection — prefer caption + location. */
function scoreMoment(m: Moment): number {
  let score = 0
  if (m.caption && m.caption !== 'Untitled') score += 2
  if (m.location) score += 1
  if (m.tags.length > 0) score += 1
  return score
}

/** Pick featured moments spread across trip days (max count). */
function pickFeatured(moments: Moment[], count: number): string[] {
  const byDay = new Map<string, Moment[]>()
  for (const m of moments) {
    if (!m.photo) continue
    const list = byDay.get(m.date) ?? []
    list.push(m)
    byDay.set(m.date, list)
  }

  const featured: string[] = []
  const sortedDays = [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b))

  // Round-robin across days, picking best-scored first
  let round = 0
  while (featured.length < count) {
    let added = false
    for (const [, dayMoments] of sortedDays) {
      const sorted = dayMoments
        .filter((m) => !featured.includes(m.id))
        .sort((a, b) => scoreMoment(b) - scoreMoment(a))
      if (sorted[round]) {
        featured.push(sorted[round].id)
        added = true
        if (featured.length >= count) break
      }
    }
    if (!added) break
    round++
  }

  return featured
}

export async function buildTripMemoryData(tripId: string): Promise<TripMemoryData> {
  // Fetch all trip data in parallel
  const [trip, moments, expenses, expSummary, places, flights, members] = await Promise.all([
    getActiveTrip(true),
    getMoments(tripId),
    getExpenses(tripId),
    getExpenseSummary(tripId),
    getSavedPlaces(tripId),
    getFlights(tripId),
    getGroupMembers(tripId),
  ])

  if (!trip) throw new Error('Trip not found')

  // --- Snapshot ---
  const snapshot: TripMemorySnapshot = {
    destination: trip.destination,
    startDate: trip.startDate,
    endDate: trip.endDate,
    nights: trip.nights,
    accommodation: trip.accommodation,
    memberNames: members.map((m) => m.name),
    memberCount: members.length,
    heroImageUrl: trip.heroImageUrl,
  }

  // --- Expense summary ---
  const sortedExpenses = [...expenses].sort((a, b) => b.amount - a.amount)
  const biggestSplurge = sortedExpenses[0]
    ? { description: sortedExpenses[0].description, amount: sortedExpenses[0].amount }
    : undefined
  const categoryTotals = new Map<string, number>()
  for (const e of expenses) {
    categoryTotals.set(e.category, (categoryTotals.get(e.category) ?? 0) + e.amount)
  }
  const topCategories = [...categoryTotals.entries()]
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([category, amount]) => ({ category, amount }))

  const expenseSummaryData: TripMemoryExpenses = {
    total: expSummary.total,
    currency: trip.costCurrency ?? 'PHP',
    topCategories,
    biggestSplurge,
    dailyAverage: trip.nights > 0 ? Math.round(expSummary.total / trip.nights) : expSummary.total,
  }

  // --- Places (voted Yes only) ---
  const visitedPlaces = places.filter((p) => p.vote === '👍 Yes' || p.saved)
  const placesSummary: TripMemoryPlace[] = visitedPlaces.map((p) => ({
    name: p.name,
    category: p.category,
    rating: p.rating,
    vote: p.vote,
  }))

  // --- Flights ---
  const flightSummary: TripMemoryFlight[] = flights.map((f) => ({
    direction: f.direction,
    airline: f.airline,
    flightNumber: f.flightNumber,
    from: f.from,
    to: f.to,
  }))

  // --- Hero + featured moments ---
  const momentsWithPhotos = moments.filter((m) => m.photo)
  const scored = momentsWithPhotos.map((m) => ({ m, score: scoreMoment(m) }))
  scored.sort((a, b) => b.score - a.score)
  const heroMomentId = scored[0]?.m.id
  const featuredMomentIds = pickFeatured(moments, 10)

  // --- Data shaped for AI prompt (capped to avoid huge prompts) ---
  const momentsForAI = moments
    .filter((m) => m.caption || m.location || m.tags.length > 0)
    .slice(0, 50)
    .map((m) => ({
      date: m.date,
      caption: m.caption || '',
      location: m.location || undefined,
      tags: m.tags,
    }))

  const placesForAI = visitedPlaces.slice(0, 30).map((p) => ({
    name: p.name,
    category: p.category,
    vote: p.vote,
    rating: p.rating,
    notes: p.notes || undefined,
  }))

  const expensesForAI = sortedExpenses.slice(0, 20).map((e) => ({
    description: e.description,
    amount: e.amount,
    category: e.category,
    date: e.date,
  }))

  const flightsForAI = flights.map((f) => ({
    direction: f.direction,
    from: f.from,
    to: f.to,
    airline: f.airline,
  }))

  return {
    tripId: trip.id,
    snapshot,
    expenseSummary: expenseSummaryData,
    placesSummary,
    flightSummary,
    heroMomentId,
    featuredMomentIds,
    momentsForAI,
    placesForAI,
    expensesForAI,
    flightsForAI,
  }
}
