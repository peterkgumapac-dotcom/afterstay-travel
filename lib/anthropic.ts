// Anthropic client — routes all AI calls through the ai-proxy Edge Function.
// The API key stays server-side. Client sends structured payloads.

import { supabase } from './supabase';
import type { AIRecommendation, TripMemoryStats, TripMemoryVibe } from './types';

// ── Proxy helper ──────────────────────────────────────────────────────

async function callProxy(action: string, payload: Record<string, unknown>): Promise<string> {
  const { data, error } = await supabase.functions.invoke('ai-proxy', {
    body: { action, payload },
  });
  if (error) {
    const msg = typeof error === 'object' && 'message' in error ? (error as { message: string }).message : String(error);
    if (msg.includes('credit balance is too low')) {
      throw new Error('AI credits exhausted. Please try again later.');
    }
    throw new Error(`AI error: ${msg}`);
  }
  return data?.text ?? '';
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

// ── Recommendations ───────────────────────────────────────────────────

function buildRecommendationPrompt(trip?: { destination?: string; accommodation?: string; startDate?: string; endDate?: string; nights?: number }, groupSize = 2): string {
  const dest = trip?.destination || 'your destination';
  const hotel = trip?.accommodation || 'your hotel';
  const dates = trip?.startDate && trip?.endDate ? `${trip.startDate} to ${trip.endDate}` : 'your trip dates';
  const nights = trip?.nights ?? 7;

  return `You are a local travel expert for ${dest}. The user is staying at ${hotel} for ${nights} nights (${dates}). Generate a Top 5 list for each selected interest category.

For each recommendation include:
- Name
- Category
- Distance from ${hotel} (approximate)
- Price estimate in local currency
- One-line reason why
- Rating (1-5 stars)

Return as JSON array. Format:
[
  {
    "name": "Place Name",
    "category": "Eat",
    "distance": "1.2 km",
    "price_estimate": "500-800/person",
    "reason": "Best local cuisine with great atmosphere",
    "rating": 5
  }
]

Group of ${groupSize} travelers. Mix popular tourist spots with hidden gems locals know.`;
}

export async function generateRecommendations(args: {
  firstTime: 'First visit' | 'Been before' | 'Local-ish';
  interests: string[];
  trip?: { destination?: string; accommodation?: string; startDate?: string; endDate?: string; nights?: number };
  groupSize?: number;
}): Promise<AIRecommendation[]> {
  const userMsg = `Visitor profile: ${args.firstTime}.\nInterests (Top 5 per category please): ${args.interests.join(', ')}.\nReturn ONLY a single JSON array, no prose, no code fences.`;

  const text = await callProxy('recommend', {
    system: buildRecommendationPrompt(args.trip, args.groupSize),
    userMessage: userMsg,
  });
  const json = extractJson(text);
  if (!Array.isArray(json)) throw new Error('AI did not return a JSON array.');
  return json as AIRecommendation[];
}

// ── Itinerary generation ──────────────────────────────────────────────

export interface ItineraryActivity {
  name: string;
  category: 'Food' | 'Beach' | 'Activity' | 'Culture' | 'Nightlife' | 'Wellness' | 'Shopping' | 'Transport';
  timeSlot: 'morning' | 'afternoon' | 'evening';
  duration: string;
  cost: string;
  tip: string;
  description: string;
}

export interface ItineraryDay {
  day: number;
  date: string;
  theme: string;
  activities: ItineraryActivity[];
}

export interface ItineraryDayLegacy {
  day: number;
  date: string;
  theme: string;
  morning: string;
  afternoon: string;
  evening: string;
  dining: string;
  tips: string;
}

export type PlannerScope = 'whole' | 'today' | 'surprise';
export type PlannerPace = 'relaxed' | 'moderate' | 'packed';

function buildItinerarySystem(ctx: {
  destination?: string;
  hotelName?: string;
  groupSize?: number;
  budget?: number;
  budgetCurrency?: string;
}): string {
  const dest = ctx.destination || 'the destination';
  const hotel = ctx.hotelName ? `The user is staying at ${ctx.hotelName}.` : '';
  const group = ctx.groupSize ? `Group of ${ctx.groupSize} travelers.` : '';
  const budgetLine = ctx.budget
    ? `Trip budget: ${ctx.budgetCurrency || 'PHP'} ${ctx.budget.toLocaleString()}. Keep daily costs within a reasonable share of this.`
    : 'No budget limit — but still be practical with costs.';

  return `You are a local travel expert for ${dest}. ${hotel} ${group}
${budgetLine}

Return ONLY a JSON array of day objects (no prose, no code fences):
[
  {
    "day": 1,
    "date": "Apr 21",
    "theme": "Arrival & Beach Day",
    "activities": [
      {
        "name": "Place or Activity Name",
        "category": "Food|Beach|Activity|Culture|Nightlife|Wellness|Shopping|Transport",
        "timeSlot": "morning|afternoon|evening",
        "duration": "1-2 hrs",
        "cost": "₱500-800",
        "tip": "Go early to avoid crowds",
        "description": "Why this is worth it in one sentence"
      }
    ]
  }
]

Rules:
- Use the EXACT dates provided in the user message. The "date" field must match the actual calendar date for each day.
- Relaxed pace: 2-3 activities per day. Moderate: 3-4. Packed: 5-6.
- Order activities by time within each day (morning→afternoon→evening).
- Include at least one food recommendation per day.
- Mix popular tourist spots with hidden gems locals know.
- Each activity must have a real place name (not generic like "the beach").
- Cost should be specific local currency ranges, or "Free".`;
}

function formatShortDate(d: Date): string {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[d.getMonth()]} ${d.getDate()}`;
}

function getTimeOfDay(): string {
  const h = new Date().getHours();
  if (h < 6) return 'early morning (before 6 AM) — suggest breakfast and morning activities only';
  if (h < 12) return 'morning — suggest remaining morning + afternoon + evening activities';
  if (h < 17) return 'afternoon — skip morning, suggest afternoon + evening activities';
  return 'evening — suggest evening and nightlife activities only';
}

export async function generateItinerary(args: {
  scope: PlannerScope;
  pace: PlannerPace;
  interests: string[];
  tripDays?: number;
  startDate?: string;
  destination?: string;
  hotelName?: string;
  groupSize?: number;
  budget?: number;
  budgetCurrency?: string;
}): Promise<ItineraryDay[]> {
  const paceDescriptions: Record<PlannerPace, string> = {
    relaxed: 'Relaxed pace: 2-3 activities/day, plenty of free time and rest.',
    moderate: 'Moderate pace: 3-4 activities/day, balanced with downtime.',
    packed: 'Packed schedule: 5-6 activities/day, maximize every hour.',
  };

  const numDays = args.scope === 'today' ? 1 : (args.tripDays ?? 7);
  const todayStr = formatShortDate(new Date());
  const startDateStr = args.startDate ? formatShortDate(new Date(args.startDate + 'T00:00:00+08:00')) : todayStr;
  const dateInfo = args.scope === 'today'
    ? `Plan for TODAY only (1 day). Today is ${todayStr}. Current time of day: ${getTimeOfDay()}.`
    : `${numDays} days, starting ${startDateStr}. Use correct calendar dates for each day.`;

  const surpriseNote = args.scope === 'surprise'
    ? '\nSurprise the user — pick a random mix of popular and offbeat activities. Vary the theme each day.'
    : '';

  const userMsg = [
    `Pace: ${paceDescriptions[args.pace]}`,
    `Interests: ${args.interests.join(', ')}.`,
    dateInfo,
    surpriseNote,
    'Return ONLY a JSON array, no prose, no code fences.',
  ].filter(Boolean).join('\n');

  const text = await callProxy('itinerary', {
    system: buildItinerarySystem({
      destination: args.destination,
      hotelName: args.hotelName,
      groupSize: args.groupSize,
      budget: args.budget,
      budgetCurrency: args.budgetCurrency,
    }),
    userMessage: userMsg,
    maxTokens: args.scope === 'today' ? 1024 : 4096,
  });

  const json = extractJson(text);
  if (!Array.isArray(json)) throw new Error('AI did not return a JSON array.');
  return json as ItineraryDay[];
}

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
      "bookingRef": "XYZ789"
    }
  ],
  "members": ["Peter", "Jane"]
}

Rules:
- Extract as much as you can from the images. Leave fields empty/null if not found.
- Dates must be YYYY-MM-DD format. Times must include timezone offset (+08:00 for Philippines).
- If multiple flights found, include all of them with correct direction (Outbound or Return).
- If you see passenger names, list them in "members".
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
