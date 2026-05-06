// Anthropic client — routes all AI calls through the ai-proxy Edge Function.
// The API key stays server-side. Client sends structured payloads.

import { supabase } from './supabase';
import { CONFIG } from './config';
import type { TripMemoryStats, TripMemoryVibe } from './types';

// ── Proxy helper ──────────────────────────────────────────────────────

async function callProxy(action: string, payload: Record<string, unknown>): Promise<string> {
  const maxAttempts = action === 'trip-scan' ? 2 : 1;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) throw new Error('Please sign in again before using AI features.');

    const response = await fetch(`${CONFIG.SUPABASE_URL}/functions/v1/ai-proxy`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: CONFIG.SUPABASE_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action, payload }),
    });
    const bodyText = await response.text();
    let data: { text?: string; error?: unknown; message?: unknown; providerStatus?: unknown } = {};
    try {
      data = bodyText ? JSON.parse(bodyText) : {};
    } catch {
      data = { error: bodyText };
    }

    if (response.ok) return data?.text ?? '';

    const msg = formatProxyError(response.status, data, bodyText);
    lastError = new Error(msg);
    if (attempt < maxAttempts && /overload|rate.?limit|timeout|temporar|529|500|502|503|504/i.test(msg)) {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      continue;
    }
    if (msg.includes('credit balance is too low')) {
      throw new Error('AI credits exhausted. Please try again later.');
    }
    throw new Error(`AI error: ${msg}`);
  }

  throw lastError instanceof Error ? lastError : new Error('AI error: request failed');
}

function formatProxyError(
  status: number,
  data: { error?: unknown; message?: unknown; providerStatus?: unknown },
  rawBody: string,
): string {
  const detail = typeof data.error === 'string'
    ? data.error
    : typeof data.message === 'string'
      ? data.message
      : rawBody || 'Edge Function returned an error';
  const providerStatus = data.providerStatus ? ` provider ${String(data.providerStatus)},` : '';
  return `${status}:${providerStatus} ${detail}`;
}

// ── JSON extraction helpers ───────────────────────────────────────────

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const firstBracket = candidate.indexOf('[');
  const lastBracket = candidate.lastIndexOf(']');
  if (firstBracket === -1 || lastBracket === -1) {
    throw new Error('No JSON array found in AI response.');
  }
  return JSON.parse(candidate.slice(firstBracket, lastBracket + 1));
}

function extractJsonObject(text: string): Record<string, unknown> {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const firstBrace = candidate.indexOf('{');
  const lastBrace = candidate.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1) {
    throw new Error('No JSON object found in AI response.');
  }
  return JSON.parse(candidate.slice(firstBrace, lastBrace + 1));
}

// ── Itinerary domain types ────────────────────────────────────────────
// generateRecommendations() and generateItinerary() were removed — the
// recommendation surface migrated to the `ai-recommend` Edge Function
// (web-search-backed, cached in curated_lists). The itinerary generator
// itself is no longer wired up. The types below are retained because
// app/(tabs)/discover.tsx still imports them.

export interface ItineraryDay {
  day: number;
  date: string;
  theme: string;
  activities: ItineraryActivity[];
}

export interface ItineraryActivity {
  name: string;
  category: 'Food' | 'Beach' | 'Activity' | 'Culture' | 'Nightlife' | 'Wellness' | 'Shopping' | 'Transport';
  timeSlot: 'morning' | 'afternoon' | 'evening';
  duration: string;
  cost: string;
  tip: string;
  description: string;
}

export type PlannerScope = 'whole' | 'today' | 'surprise';
export type PlannerPace = 'relaxed' | 'moderate' | 'packed';

// ── Receipt scanning ───────────────────────────────────────────────────

export interface ReceiptLineItem {
  name: string;
  qty: number;
  amount: number;
}

export interface ScannedReceipt {
  placeName: string;
  description: string;
  amount: number;
  currency: string;
  category: 'Food' | 'Transport' | 'Activity' | 'Accommodation' | 'Shopping' | 'Other';
  date: string;
  items: ReceiptLineItem[];
}

export async function scanReceipt(base64Image: string, mimeType: string = 'image/jpeg'): Promise<ScannedReceipt> {
  const prompt = `Extract receipt information from this image. Read every line item with its quantity and price. Return ONLY a JSON object (no prose, no code fences) with these fields:
{
  "placeName": "store/restaurant name",
  "description": "brief summary, e.g. 'Lunch for 3'",
  "amount": 123.45,
  "currency": "PHP",
  "category": "Food|Transport|Activity|Accommodation|Shopping|Other",
  "date": "YYYY-MM-DD",
  "items": [
    { "name": "Chicken Adobo", "qty": 2, "amount": 350 },
    { "name": "Rice", "qty": 3, "amount": 75 }
  ]
}
Rules:
- "amount" is the receipt TOTAL (sum of all items + tax/service charge if shown).
- Each item in "items" has name, qty (default 1), and amount (unit price × qty).
- Include tax/service charge as a separate item if shown.
- If you cannot read a field, use reasonable defaults.
- Default currency to PHP. Default date to today: ${new Date().toISOString().slice(0, 10)}.`;

  const text = await callProxy('receipt-scan', {
    base64Image,
    mimeType,
    prompt,
  });

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const firstBrace = candidate.indexOf('{');
  const lastBrace = candidate.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1) throw new Error('Could not parse receipt data.');
  return JSON.parse(candidate.slice(firstBrace, lastBrace + 1)) as ScannedReceipt;
}

// ── Trip document scanner ─────────────────────────────────────────────

export interface ScannedTripDetails {
  destination: string;
  startDate: string;
  endDate: string;
  accommodation?: string;
  address?: string;
  checkIn?: string;
  checkOut?: string;
  roomType?: string;
  bookingRef?: string;
  cost?: number;
  costCurrency?: string;
  flights?: {
    direction: 'Outbound' | 'Return';
    flightNumber: string;
    airline?: string;
    from: string;
    to: string;
    departTime: string;
    arriveTime: string;
    bookingRef?: string;
    passenger?: string;
  }[];
  members?: string[];
}

export async function scanTripDocuments(
  images: { base64: string; mimeType: string }[],
): Promise<ScannedTripDetails> {
  const imageBlocks = images.map((img) => ({
    type: 'image' as const,
    source: {
      type: 'base64' as const,
      media_type: img.mimeType,
      data: img.base64,
    },
  }));

  const prompt = `Extract trip details from these screenshots. They may be flight bookings, hotel confirmations, itineraries, or general trip screenshots.

Return ONLY a JSON object (no prose, no code fences):
{
  "destination": "City, Country",
  "startDate": "YYYY-MM-DD",
  "endDate": "YYYY-MM-DD",
  "accommodation": "Hotel name",
  "address": "Hotel address",
  "checkIn": "3:00 PM",
  "checkOut": "12:00 PM",
  "roomType": "Deluxe King",
  "bookingRef": "ABC123",
  "cost": 15000,
  "costCurrency": "PHP",
  "flights": [
    {
      "direction": "Outbound",
      "flightNumber": "5J 123",
      "airline": "Cebu Pacific",
      "from": "Manila (MNL)",
      "to": "Kalibo (KLO)",
      "departTime": "2026-04-20T06:00:00+08:00",
      "arriveTime": "2026-04-20T07:05:00+08:00",
      "bookingRef": "XYZ789",
      "passenger": "Peter"
    }
  ],
  "members": ["Peter", "Jane"]
}

Rules:
- Extract as much as you can from the images. Leave fields empty/null if not found.
- Dates must be YYYY-MM-DD format. Times must include timezone offset (+08:00 for Philippines).
- Scan every image from top to bottom and include every flight segment/card you can see.
- For round-trip or return itineraries, include BOTH the outbound and return flights. Do not stop after the first segment.
- If multiple flights are shown, include all of them with correct direction (Outbound or Return). Example: MNL → MPH on the trip start date is Outbound; MPH → MNL on the trip end date is Return.
- If a screenshot shows route headers like "MNL - MPH" and "MPH - MNL", create two separate flight objects, one for each header.
- Example: a Flight Details screenshot showing "MNL - MPH" on 31 May 2026 with "FLIGHT NO. 5J 911" and "MPH - MNL" on 3 Jun 2026 with "FLIGHT NO. 5J 900" must return exactly two flights: 5J 911 as Outbound and 5J 900 as Return.
- Booking app flight detail pages often show two stacked sections such as "MNL - MPH" and "MPH - MNL" with "Hide details"; treat each visible section as its own flight even when they share the same passenger or booking reference.
- If the first section is outbound and a later section reverses the route, the later reversed section must be direction "Return".
- Do not merge round-trip details into one flight object. Preserve departure/arrival times separately for the outbound and return legs.
- If you see passenger names, list them in "members". If a passenger name is clearly attached to a flight, also include it on that flight as "passenger".
- Cost should be numeric (no currency symbol). Currency as ISO code.
- Default currency to PHP if not specified.`;

  const text = await callProxy('trip-scan', {
    imageBlocks,
    prompt,
  });

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const firstBrace = candidate.indexOf('{');
  const lastBrace = candidate.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1) throw new Error('Could not parse trip details.');
  return JSON.parse(candidate.slice(firstBrace, lastBrace + 1)) as ScannedTripDetails;
}

// ── Trip Memory generation ──────────────────────────────────────────

export interface GeneratedMemoryContent {
  narrative: string;
  dayHighlights: { day: string; summary: string }[];
  statsCard: TripMemoryStats;
  vibeAnalysis: TripMemoryVibe;
}

export async function generateTripMemory(args: {
  destination: string;
  startDate: string;
  endDate: string;
  nights: number;
  accommodation: string;
  memberNames: string[];
  moments: { date: string; caption: string; location?: string; tags: string[] }[];
  places: { name: string; category: string; vote: string; rating?: number; notes?: string }[];
  expenses: { description: string; amount: number; category: string; date: string }[];
  flights: { direction: string; from: string; to: string; airline: string }[];
}): Promise<GeneratedMemoryContent> {
  const systemPrompt = `You are a gifted travel memoir writer. Given structured trip data, you create warm, vivid, second-person narratives that capture the essence of a journey.

Your output is a single JSON object with exactly these keys:
{
  "narrative": "2-3 paragraph prose summary of the entire trip, written in second person ('You arrived...', 'Your mornings were spent...'). Warm, specific, evocative — reference real places, foods, and moments from the data. Not generic.",
  "dayHighlights": [{"day": "2026-04-20", "summary": "1-2 sentence highlight of this day"}],
  "statsCard": {
    "mostPhotographedSpot": "place name or null",
    "favoriteFood": "food place or dish or null",
    "busiestDay": "day label like 'Day 3 — Tuesday' or null",
    "totalPhotos": number,
    "totalPlacesVisited": number,
    "totalExpenses": number,
    "longestDayOut": "day label or null",
    "topTag": "most common moment tag or null"
  },
  "vibeAnalysis": {
    "dominantMood": "one word like 'Relaxed' or 'Adventurous'",
    "topTags": ["top 3 moment tags"],
    "vibeDescription": "One vivid sentence describing the trip's overall vibe"
  }
}

Rules:
- Return ONLY the JSON object, no prose before or after, no code fences.
- Use the actual data provided — never invent places or events.
- dayHighlights should only include days that have moment data.
- Keep the narrative under 300 words.
- The tone should feel like a personal journal entry, not a travel brochure.`;

  const tripData = {
    destination: args.destination,
    dates: `${args.startDate} to ${args.endDate} (${args.nights} nights)`,
    accommodation: args.accommodation,
    travelers: args.memberNames.join(', '),
    flights: args.flights,
    moments: args.moments,
    placesVisited: args.places,
    topExpenses: args.expenses,
  };

  const userMsg = `Here is the complete trip data. Generate the trip memory JSON.\n\n${JSON.stringify(tripData, null, 2)}`;

  const text = await callProxy('trip-memory', {
    system: systemPrompt,
    userMessage: userMsg,
  });

  const json = extractJsonObject(text) as Record<string, unknown>;
  return {
    narrative: (json.narrative as string) ?? '',
    dayHighlights: (json.dayHighlights as GeneratedMemoryContent['dayHighlights']) ?? [],
    statsCard: (json.statsCard as TripMemoryStats) ?? { totalPhotos: 0, totalPlacesVisited: 0, totalExpenses: 0 },
    vibeAnalysis: (json.vibeAnalysis as TripMemoryVibe) ?? { dominantMood: '', topTags: [], vibeDescription: '' },
  };
}

// ── AI Concierge ────────────────────────────────────────────────────

export interface ConciergeSuggestion {
  name: string;
  category: string;
  reason: string;
  isQuickMoment: boolean;
  estimatedDuration: string;
  priceRange: string;
  bestTimeToGo: string;
}

export async function generateConciergeSuggestions(args: {
  what: string;
  when: string;
  whoCount: number;
  destination: string;
  hotelName?: string;
  currentTimeOfDay: string;
  budget?: number;
  budgetCurrency?: string;
}): Promise<ConciergeSuggestion[]> {
  const hotel = args.hotelName ? ` staying at ${args.hotelName}` : '';
  const budgetNote = args.budget
    ? ` Their trip budget is ${args.budgetCurrency ?? 'PHP'} ${args.budget.toLocaleString()} total.`
    : '';
  const groupNote = args.whoCount > 1 ? ` They are a group of ${args.whoCount}.` : ' They are solo.';

  const systemPrompt = `You are a friendly local concierge for ${args.destination}. The traveler is${hotel}.${groupNote}${budgetNote}

It is currently ${args.currentTimeOfDay}. They want: "${args.what}" — timing: "${args.when}".

Return exactly 3-5 real, specific place suggestions as a JSON array. For each place:
- "name": the real establishment name (must actually exist in ${args.destination})
- "category": one of Food, Coffee, Activity, Nightlife, Wellness, Explore
- "reason": one compelling sentence why this place (mention what makes it special)
- "isQuickMoment": true if typically under 2 hours (coffee, quick meal), false for longer activities
- "estimatedDuration": e.g. "30-45 min", "2-3 hours", "half day"
- "priceRange": e.g. "₱200-500", "Free", "$$$"
- "bestTimeToGo": e.g. "Now — before the lunch rush", "Sunset", "Any time"

Prioritize places that are:
1. Actually open or appropriate for the requested timing
2. Walkable or nearby the hotel when possible
3. Well-reviewed by locals and travelers
4. Varied (don't suggest 5 of the same type)

Return ONLY the JSON array, no other text.`;

  const text = await callProxy('concierge', {
    system: systemPrompt,
    userMessage: `Find me ${args.what} options for ${args.when}. What do you recommend?`,
  });

  const parsed = extractJson(text) as ConciergeSuggestion[];
  return parsed.map((s) => ({
    name: s.name ?? 'Unknown',
    category: s.category ?? 'Explore',
    reason: s.reason ?? '',
    isQuickMoment: s.isQuickMoment ?? false,
    estimatedDuration: s.estimatedDuration ?? '',
    priceRange: s.priceRange ?? '',
    bestTimeToGo: s.bestTimeToGo ?? '',
  }));
}
